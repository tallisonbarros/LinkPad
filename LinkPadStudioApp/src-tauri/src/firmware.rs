use crate::toolchain;
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{ExitStatus, Stdio};
use std::sync::mpsc;
use std::thread;

const PLATFORMIO_INI: &str = include_str!("../templates/m5stickc-plus2/platformio.ini");
const MAIN_CPP: &str = include_str!("../templates/m5stickc-plus2/src/main.cpp");
const RUNTIME_H: &str = include_str!("../templates/m5stickc-plus2/include/LinkPadRuntime.h");
const STATUS_OVERLAY_H: &str =
    include_str!("../templates/m5stickc-plus2/include/LinkPadStatusOverlay.h");
const RUNTIME_CPP: &str = include_str!("../templates/m5stickc-plus2/src/LinkPadRuntime.cpp");

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareProgress {
    pub stage: &'static str,
    pub message: String,
    pub percent: u8,
}

struct PlatformioOutput {
    status: ExitStatus,
    stdout: String,
    stderr: String,
}

#[derive(Clone, Copy)]
enum OutputStream {
    Stdout,
    Stderr,
}

pub fn generate(project_dir: &Path, project: &Value) -> Result<PathBuf, String> {
    let output = project_dir.join("generated").join("m5stickc-plus2");
    let include_dir = output.join("include");
    let source_dir = output.join("src");
    fs::create_dir_all(&include_dir).map_err(error_text)?;
    fs::create_dir_all(&source_dir).map_err(error_text)?;

    let runtime_project = runtime_project(project);
    let compact_json = serde_json::to_string(&runtime_project).map_err(error_text)?;
    let generated_header = format!(
        "// Gerado pelo LinkPad Studio 0.5.0. Nao editar.\n#pragma once\n\nstatic const char LINKPAD_PROJECT_JSON[] = {};\n",
        cpp_string_literal(&compact_json)
    );

    let monitor_speed = project
        .pointer("/build/baudRate")
        .and_then(Value::as_u64)
        .unwrap_or(115_200);
    write(
        output.join("platformio.ini"),
        &PLATFORMIO_INI.replace("{{MONITOR_SPEED}}", &monitor_speed.to_string()),
    )?;
    write(source_dir.join("main.cpp"), MAIN_CPP)?;
    write(include_dir.join("LinkPadRuntime.h"), RUNTIME_H)?;
    write(include_dir.join("LinkPadStatusOverlay.h"), STATUS_OVERLAY_H)?;
    write(source_dir.join("LinkPadRuntime.cpp"), RUNTIME_CPP)?;
    write(include_dir.join("generated_project.h"), &generated_header)?;

    Ok(output)
}

pub fn build<F>(
    project_dir: &Path,
    flash: bool,
    serial_port: &str,
    mut progress: F,
) -> Result<Value, String>
where
    F: FnMut(FirmwareProgress),
{
    emit_progress(
        &mut progress,
        "preparing",
        "Preparando os arquivos do firmware...",
        2,
    );
    let firmware_dir = project_dir.join("generated").join("m5stickc-plus2");
    if !firmware_dir.join("platformio.ini").exists() {
        return Err("Gere o firmware antes de compilar.".to_string());
    }

    let staging_dir = toolchain::build_cache_root().join(staging_id(project_dir));
    sync_directory(&firmware_dir, &staging_dir)?;
    emit_progress(
        &mut progress,
        "starting",
        if flash {
            "Iniciando compilacao e gravacao..."
        } else {
            "Iniciando compilacao..."
        },
        5,
    );

    let mut args = vec![
        "run".to_string(),
        "--project-dir".to_string(),
        staging_dir.to_string_lossy().to_string(),
    ];
    if flash {
        if serial_port.trim().is_empty() {
            return Err("Informe a porta serial antes de gravar.".to_string());
        }
        args.extend([
            "--target".to_string(),
            "upload".to_string(),
            "--upload-port".to_string(),
            serial_port.trim().to_string(),
        ]);
    }

    let output = run_platformio(&args, flash, &mut progress)?;
    let log = format!(
        "$ PlatformIO gerenciado {}\n\n{}\n{}",
        args.join(" "),
        output.stdout,
        output.stderr
    );
    let log_dir = project_dir.join("build");
    fs::create_dir_all(&log_dir).map_err(error_text)?;
    write(log_dir.join("latest.log"), &log)?;

    if !output.status.success() {
        emit_progress(
            &mut progress,
            "failed",
            "O PlatformIO encerrou a operacao com erro.",
            100,
        );
        return Err(format!(
            "PlatformIO terminou com código {}. Consulte build/latest.log.",
            output.status.code().unwrap_or(-1)
        ));
    }

    copy_build_artifacts(&staging_dir, &log_dir)?;
    emit_progress(
        &mut progress,
        "complete",
        if flash {
            "Firmware gravado com sucesso."
        } else {
            "Compilacao concluida com sucesso."
        },
        100,
    );

    Ok(json!({
        "ok": true,
        "action": if flash { "flash" } else { "build" },
        "firmwareDir": firmware_dir.to_string_lossy(),
        "stagingDir": staging_dir.to_string_lossy(),
        "logPath": log_dir.join("latest.log").to_string_lossy()
    }))
}

fn staging_id(project_dir: &Path) -> String {
    let digest = Sha256::digest(project_dir.to_string_lossy().as_bytes());
    format!("{:x}", digest)[..12].to_string()
}

fn sync_directory(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(error_text)?;
    for entry in fs::read_dir(source).map_err(error_text)? {
        let entry = entry.map_err(error_text)?;
        if entry.file_name() == ".pio" {
            continue;
        }
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if source_path.is_dir() {
            sync_directory(&source_path, &destination_path)?;
        } else {
            fs::copy(&source_path, &destination_path).map_err(error_text)?;
        }
    }
    Ok(())
}

fn copy_build_artifacts(staging_dir: &Path, log_dir: &Path) -> Result<(), String> {
    let platformio_output = staging_dir
        .join(".pio")
        .join("build")
        .join("m5stack-stickc-plus2");
    let destination = log_dir.join("firmware");
    fs::create_dir_all(&destination).map_err(error_text)?;
    for file_name in [
        "firmware.bin",
        "firmware.elf",
        "bootloader.bin",
        "partitions.bin",
    ] {
        let source = platformio_output.join(file_name);
        if source.exists() {
            fs::copy(source, destination.join(file_name)).map_err(error_text)?;
        }
    }
    Ok(())
}

fn runtime_project(project: &Value) -> Value {
    json!({
        "runtimeVersion": "0.5.0",
        "hardwareId": project.pointer("/hardware/hardwareId").cloned().unwrap_or(json!("m5stickc-plus2")),
        "contractVersion": project.pointer("/agent/protocolVersion").cloned().unwrap_or(json!("0.1.0")),
        "deviceId": project.get("projectId").cloned().unwrap_or(json!("linkpad-device")),
        "projectId": project.get("projectId").cloned().unwrap_or(json!("linkpad-project")),
        "network": project.get("network").cloned().unwrap_or(json!({})),
        "agent": project.get("agent").cloned().unwrap_or(json!({})),
        "ui": {
            "statusOverlay": project.pointer("/hardware/statusOverlay").cloned().unwrap_or(json!({
                "enabled": true,
                "placement": "top-right",
                "style": "watermark",
                "indicators": ["wifi", "agent"]
            }))
        },
        "protocols": project.get("protocols").cloned().unwrap_or(json!([])),
        "tags": project.get("tags").cloned().unwrap_or(json!([])),
        "screens": project.get("screens").cloned().unwrap_or(json!([]))
    })
}

fn cpp_string_literal(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len() + 2);
    escaped.push('"');
    for ch in value.chars() {
        match ch {
            '\\' => escaped.push_str("\\\\"),
            '"' => escaped.push_str("\\\""),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            _ => escaped.push(ch),
        }
    }
    escaped.push('"');
    escaped
}

fn run_platformio<F>(
    args: &[String],
    flash: bool,
    progress: &mut F,
) -> Result<PlatformioOutput, String>
where
    F: FnMut(FirmwareProgress),
{
    let mut child = toolchain::platformio_command()?
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(error_text)?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Nao foi possivel capturar a saida do PlatformIO.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Nao foi possivel capturar os erros do PlatformIO.".to_string())?;
    let (sender, receiver) = mpsc::channel();
    let stdout_reader = spawn_output_reader(stdout, OutputStream::Stdout, sender.clone());
    let stderr_reader = spawn_output_reader(stderr, OutputStream::Stderr, sender.clone());
    drop(sender);

    let mut stdout_text = String::new();
    let mut stderr_text = String::new();
    let mut tracker = ProgressTracker::new(flash);
    for (stream, line) in receiver {
        match stream {
            OutputStream::Stdout => append_output_line(&mut stdout_text, &line),
            OutputStream::Stderr => append_output_line(&mut stderr_text, &line),
        }
        if !line.trim().is_empty() {
            progress(tracker.observe(&line));
        }
    }

    let status = child.wait().map_err(error_text)?;
    join_output_reader(stdout_reader)?;
    join_output_reader(stderr_reader)?;
    Ok(PlatformioOutput {
        status,
        stdout: stdout_text,
        stderr: stderr_text,
    })
}

fn spawn_output_reader<R>(
    reader: R,
    stream: OutputStream,
    sender: mpsc::Sender<(OutputStream, String)>,
) -> thread::JoinHandle<Result<(), String>>
where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        loop {
            let mut buffer = Vec::new();
            if reader.read_until(b'\n', &mut buffer).map_err(error_text)? == 0 {
                break;
            }
            let line = String::from_utf8_lossy(&buffer)
                .trim_end_matches(['\r', '\n'])
                .to_string();
            if sender.send((stream, line)).is_err() {
                break;
            }
        }
        Ok(())
    })
}

fn join_output_reader(reader: thread::JoinHandle<Result<(), String>>) -> Result<(), String> {
    reader
        .join()
        .map_err(|_| "Falha ao processar a saida do PlatformIO.".to_string())?
}

fn append_output_line(output: &mut String, line: &str) {
    output.push_str(line);
    output.push('\n');
}

struct ProgressTracker {
    percent: u8,
    flash: bool,
}

impl ProgressTracker {
    fn new(flash: bool) -> Self {
        Self { percent: 5, flash }
    }

    fn observe(&mut self, line: &str) -> FirmwareProgress {
        let lower = line.to_ascii_lowercase();
        let compile_ceiling = if self.flash { 58 } else { 86 };
        let (stage, target) = if lower.contains("success") {
            ("complete", 100)
        } else if lower.contains("hard resetting") || lower.contains("hash of data verified") {
            ("verifying", 98)
        } else if let Some(upload_percent) = percentage_in_line(line)
            .filter(|_| lower.contains("writing at") || lower.contains("upload"))
        {
            ("uploading", 72 + ((upload_percent as u16 * 25) / 100) as u8)
        } else if lower.contains("uploading") || lower.contains("writing at") {
            ("uploading", 72)
        } else if lower.contains("looking for upload port") {
            ("connecting", 68)
        } else if lower.contains("configuring upload protocol") {
            ("connecting", 64)
        } else if lower.contains("building .pio") || lower.contains("building firmware") {
            ("packaging", if self.flash { 60 } else { 90 })
        } else if lower.contains("linking") {
            ("linking", if self.flash { 56 } else { 82 })
        } else if lower.contains("compiling") {
            (
                "compiling",
                self.percent.saturating_add(2).clamp(15, compile_ceiling),
            )
        } else if lower.contains("building in") {
            ("building", 12)
        } else if lower.contains("processing ") {
            ("preparing", 8)
        } else if lower.contains("error") || lower.contains("failed") {
            ("error", self.percent)
        } else {
            ("running", self.percent.max(6))
        };
        self.percent = self.percent.max(target).min(100);
        FirmwareProgress {
            stage,
            message: line.chars().take(320).collect(),
            percent: self.percent,
        }
    }
}

fn percentage_in_line(line: &str) -> Option<u8> {
    let percent_index = line.rfind('%')?;
    let digits_reversed: String = line[..percent_index]
        .chars()
        .rev()
        .skip_while(|value| value.is_whitespace())
        .take_while(|value| value.is_ascii_digit())
        .collect();
    let digits: String = digits_reversed.chars().rev().collect();
    digits.parse::<u8>().ok().filter(|value| *value <= 100)
}

fn emit_progress<F>(progress: &mut F, stage: &'static str, message: &str, percent: u8)
where
    F: FnMut(FirmwareProgress),
{
    progress(FirmwareProgress {
        stage,
        message: message.to_string(),
        percent,
    });
}

fn write(path: PathBuf, contents: &str) -> Result<(), String> {
    fs::write(path, contents.replace("\r\n", "\n")).map_err(error_text)
}

fn error_text(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_json_for_cpp_header() {
        assert_eq!(
            cpp_string_literal("{\"a\":\"b\\\\c\"}"),
            "\"{\\\"a\\\":\\\"b\\\\\\\\c\\\"}\""
        );
    }

    #[test]
    fn runtime_project_does_not_include_studio_metadata() {
        let project = json!({
            "name": "Nao embarcar",
            "projectId": "p1",
            "network": {},
            "agent": { "protocolVersion": "0.1.0" },
            "protocols": [],
            "tags": [],
            "screens": []
        });
        let runtime = runtime_project(&project);
        assert!(runtime.get("name").is_none());
        assert_eq!(runtime["projectId"], "p1");
        assert_eq!(runtime["ui"]["statusOverlay"]["placement"], "top-right");
        assert_eq!(
            runtime["ui"]["statusOverlay"]["indicators"],
            json!(["wifi", "agent"])
        );
    }

    #[test]
    fn generation_is_deterministic_and_resolves_template_markers() {
        let project = json!({
            "projectId": "p1",
            "network": { "ssid": "factory", "password": "secret" },
            "agent": { "protocolVersion": "0.1.0" },
            "protocols": [],
            "tags": [],
            "screens": [],
            "build": { "baudRate": 115200 }
        });
        let directory =
            std::env::temp_dir().join(format!("linkpad-studio-generator-{}", std::process::id()));
        if directory.exists() {
            fs::remove_dir_all(&directory).unwrap();
        }
        let output = generate(&directory, &project).unwrap();
        let first = fs::read(output.join("include/generated_project.h")).unwrap();
        generate(&directory, &project).unwrap();
        let second = fs::read(output.join("include/generated_project.h")).unwrap();
        assert_eq!(first, second);
        assert!(!fs::read_to_string(output.join("platformio.ini"))
            .unwrap()
            .contains("{{"));
        assert!(output.join("include/LinkPadStatusOverlay.h").exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn runtime_template_uses_linkpad_protocol_endpoints() {
        for endpoint in [
            "/lpp/v1/status",
            "/lpp/v1/capabilities",
            "/lpp/v1/sessions",
            "/lpp/v1/read",
            "/lpp/v1/write",
        ] {
            assert!(RUNTIME_CPP.contains(endpoint));
        }
        assert!(RUNTIME_CPP.contains("item[\"value\"]"));
        assert!(RUNTIME_CPP.contains("item[\"valor\"]"));
        assert!(RUNTIME_CPP.contains("LinkPadState::TagStale"));
        assert!(RUNTIME_CPP.contains("LinkPadState::WriteFailed"));
        assert!(RUNTIME_CPP.contains("\"written\""));
        assert!(RUNTIME_H.contains("connectorStates_"));
        assert!(RUNTIME_CPP.contains("ensureSessions()"));
        assert!(RUNTIME_CPP.contains("tag[\"protocolProfileId\"]"));
        assert!(RUNTIME_CPP.contains("sessionFor(profileId)"));
        assert!(RUNTIME_CPP.contains("LinkPadStatusOverlay::render"));
        assert!(STATUS_OVERLAY_H.contains("drawWifi"));
        assert!(STATUS_OVERLAY_H.contains("drawAgent"));
        assert!(!RUNTIME_CPP.contains("WiFi:%s Agent:%s"));
    }

    #[test]
    fn reads_platformio_upload_percentages() {
        assert_eq!(percentage_in_line("Writing at 0x0010... ( 42 %)"), Some(42));
        assert_eq!(
            percentage_in_line("Writing at 0x0010... (100 %)"),
            Some(100)
        );
        assert_eq!(percentage_in_line("Compiling source.cpp"), None);
    }

    #[test]
    fn build_progress_is_monotonic() {
        let mut tracker = ProgressTracker::new(true);
        let values = [
            tracker.observe("Processing m5stack-stickc-plus2").percent,
            tracker.observe("Compiling .pio/src/main.cpp").percent,
            tracker.observe("Linking .pio/firmware.elf").percent,
            tracker.observe("Writing at 0x0010... (50 %)").percent,
            tracker.observe("SUCCESS").percent,
        ];
        assert!(values.windows(2).all(|pair| pair[0] <= pair[1]));
        assert_eq!(values.last(), Some(&100));
    }

    #[test]
    #[ignore = "baixa a plataforma ESP32 e compila o template M5"]
    fn compiles_m5_template_with_managed_toolchain() {
        if !toolchain::status().ready {
            toolchain::prepare(|_| {}).unwrap();
        }
        let directory = std::env::temp_dir().join("linkpad-studio-m5-build-validation");
        if directory.exists() {
            fs::remove_dir_all(&directory).unwrap();
        }
        let project = json!({
            "projectId": "firmware-validation",
            "hardware": { "hardwareId": "m5stickc-plus2" },
            "network": { "mode": "wifi", "ssid": "validation", "password": "" },
            "agent": {
                "host": "127.0.0.1",
                "port": 8008,
                "timeoutMs": 1200,
                "pollMs": 1000,
                "token": "",
                "protocolVersion": "0.1.0"
            },
            "protocols": [
                {
                    "id": "sim-main",
                    "name": "Simulacao",
                    "driver": "sim",
                    "endpoint": "memory://validation-main",
                    "enabled": true,
                    "options": {}
                },
                {
                    "id": "sim-aux",
                    "name": "Simulacao auxiliar",
                    "driver": "sim",
                    "endpoint": "memory://validation-aux",
                    "enabled": true,
                    "options": {}
                }
            ],
            "tags": [
                {
                    "name": "MotorSpeed",
                    "type": "float",
                    "direction": "readWrite",
                    "source": "agent",
                    "protocolProfileId": "sim-main",
                    "address": { "key": "Motor.Speed" },
                    "min": 0,
                    "max": 60,
                    "quality": "unknown"
                },
                {
                    "name": "AuxValue",
                    "type": "int",
                    "direction": "read",
                    "source": "agent",
                    "protocolProfileId": "sim-aux",
                    "address": { "key": "Aux.Value" },
                    "quality": "unknown"
                }
            ],
            "screens": [{
                "id": "main",
                "name": "Principal",
                "width": 240,
                "height": 135,
                "widgets": [
                    { "id": "value", "type": "tag_value", "x": 5, "y": 25, "width": 100, "height": 20, "visible": true, "props": { "tag": "MotorSpeed" } },
                    { "id": "write", "type": "write_button", "x": 5, "y": 60, "width": 80, "height": 24, "visible": true, "props": { "tag": "MotorSpeed", "text": "Set 42", "value": 42 } }
                ]
            }],
            "build": { "serialPort": "", "baudRate": 115200 }
        });
        generate(&directory, &project).unwrap();
        let mut received_progress = Vec::new();
        if let Err(error) = build(&directory, false, "", |progress| {
            received_progress.push(progress)
        }) {
            let log = fs::read_to_string(directory.join("build/latest.log")).unwrap_or_default();
            panic!("{error}\n{log}");
        }
        assert!(received_progress.len() > 2);
        assert_eq!(received_progress.last().map(|item| item.percent), Some(100));
        fs::remove_dir_all(directory).unwrap();
    }
}
