use crate::toolchain;
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{ExitStatus, Stdio};
use std::sync::mpsc;
use std::thread;

const PLATFORMIO_INI: &str = include_str!("../templates/m5stickc-plus2/platformio.ini");
const MAIN_CPP: &str = include_str!("../templates/m5stickc-plus2/src/main.cpp");
const RUNTIME_H: &str = include_str!("../templates/m5stickc-plus2/include/LinkPadRuntime.h");
const INPUT_ADAPTER_H: &str =
    include_str!("../templates/m5stickc-plus2/include/LinkPadInputAdapter.h");
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
        "// Gerado pelo LinkPad Studio 0.17.1. Nao editar.\n#pragma once\n\nstatic const char LINKPAD_PROJECT_JSON[] = {};\n",
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
    write(include_dir.join("LinkPadInputAdapter.h"), INPUT_ADAPTER_H)?;
    write(include_dir.join("LinkPadStatusOverlay.h"), STATUS_OVERLAY_H)?;
    write(source_dir.join("LinkPadRuntime.cpp"), RUNTIME_CPP)?;
    write(include_dir.join("generated_project.h"), &generated_header)?;

    Ok(output)
}

pub fn build<F>(
    project_dir: &Path,
    project: &Value,
    flash: bool,
    serial_port: &str,
    mut progress: F,
) -> Result<Value, String>
where
    F: FnMut(FirmwareProgress),
{
    let firmware_dir = generate_for_build(project_dir, project, &mut progress)?;
    emit_progress(
        &mut progress,
        "preparing",
        "Preparando os arquivos do firmware...",
        2,
    );

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

fn generate_for_build<F>(
    project_dir: &Path,
    project: &Value,
    progress: &mut F,
) -> Result<PathBuf, String>
where
    F: FnMut(FirmwareProgress),
{
    emit_progress(
        progress,
        "generating",
        "Gerando o codigo do projeto...",
        1,
    );
    generate(project_dir, project)
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
    let (tags, screens) = compile_data_bindings(project);
    json!({
        "runtimeVersion": "0.12.1",
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
        "tags": tags,
        "screens": screens
    })
}

fn compile_data_bindings(project: &Value) -> (Value, Value) {
    let project_tags = project
        .get("tags")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let global_names: HashMap<String, String> = project_tags
        .iter()
        .filter_map(|tag| {
            Some((
                tag.get("id")?.as_str()?.to_string(),
                tag.get("name")?.as_str()?.to_string(),
            ))
        })
        .collect();
    let mut screens = project
        .get("screens")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let referenced_global_ids = referenced_global_tag_ids(&screens);
    let mut tags = project_tags
        .into_iter()
        .filter(|tag| {
            tag.get("id")
                .and_then(Value::as_str)
                .is_some_and(|tag_id| referenced_global_ids.contains(tag_id))
        })
        .collect::<Vec<_>>();
    let mut direct_indexes: HashMap<String, usize> = HashMap::new();

    for screen in &mut screens {
        let Some(screen_object) = screen.as_object_mut() else {
            continue;
        };
        if let Some(widgets) = screen_object
            .get_mut("widgets")
            .and_then(Value::as_array_mut)
        {
            for widget in widgets {
                if let Some(widget_object) = widget.as_object_mut() {
                    widget_object.remove("editor");
                }
                let widget_type = widget.get("type").and_then(Value::as_str).unwrap_or("");
                let direction = match widget_type {
                    "tag_value" | "boolean_indicator" | "gauge" | "progress_bar" => Some("read"),
                    "write_button" => Some("write"),
                    _ => None,
                };
                let Some(direction) = direction else {
                    continue;
                };
                let binding = widget.pointer("/props/binding").cloned();
                let Some(binding) = binding else {
                    continue;
                };
                let limits = widget.get("props").cloned().unwrap_or_else(|| json!({}));
                let label = runtime_binding_label(&binding, &global_names);
                let resolved = resolve_data_binding(
                    &binding,
                    direction,
                    &limits,
                    &global_names,
                    &mut tags,
                    &mut direct_indexes,
                );
                if let Some(props) = widget.get_mut("props").and_then(Value::as_object_mut) {
                    props.remove("binding");
                    props.insert("tag".to_string(), json!(resolved.unwrap_or_default()));
                    props.insert("label".to_string(), json!(label));
                }
            }
        }
        if let Some(input_bindings) = screen_object
            .get_mut("inputBindings")
            .and_then(Value::as_array_mut)
        {
            for input_binding in input_bindings {
                let Some(action) = input_binding.get_mut("action") else {
                    continue;
                };
                let action_type = action.get("type").and_then(Value::as_str).unwrap_or("");
                let direction = match action_type {
                    "changeValue" => Some(
                        if action
                            .get("operation")
                            .and_then(Value::as_str)
                            .unwrap_or("set")
                            == "set"
                        {
                            "write"
                        } else {
                            "readWrite"
                        },
                    ),
                    _ => None,
                };
                let Some(direction) = direction else {
                    continue;
                };
                let binding = action.get("binding").cloned();
                let Some(binding) = binding else {
                    continue;
                };
                let limits = action.clone();
                let resolved = resolve_data_binding(
                    &binding,
                    direction,
                    &limits,
                    &global_names,
                    &mut tags,
                    &mut direct_indexes,
                );
                if let Some(action_object) = action.as_object_mut() {
                    action_object.remove("binding");
                    action_object.insert("tag".to_string(), json!(resolved.unwrap_or_default()));
                }
            }
        }
    }

    (Value::Array(tags), Value::Array(screens))
}

fn referenced_global_tag_ids(screens: &[Value]) -> HashSet<String> {
    let mut referenced = HashSet::new();
    for screen in screens {
        if let Some(widgets) = screen.get("widgets").and_then(Value::as_array) {
            for widget in widgets {
                collect_global_tag_id(widget.pointer("/props/binding"), &mut referenced);
            }
        }
        if let Some(input_bindings) = screen.get("inputBindings").and_then(Value::as_array) {
            for input_binding in input_bindings {
                collect_global_tag_id(input_binding.pointer("/action/binding"), &mut referenced);
            }
        }
    }
    referenced
}

fn collect_global_tag_id(binding: Option<&Value>, referenced: &mut HashSet<String>) {
    let Some(binding) = binding else {
        return;
    };
    if binding.get("kind").and_then(Value::as_str) != Some("global-tag") {
        return;
    }
    if let Some(tag_id) = binding.get("tagId").and_then(Value::as_str) {
        referenced.insert(tag_id.to_string());
    }
}

fn runtime_binding_label(binding: &Value, global_names: &HashMap<String, String>) -> String {
    if binding.get("kind").and_then(Value::as_str) == Some("global-tag") {
        return binding
            .get("tagId")
            .and_then(Value::as_str)
            .and_then(|tag_id| global_names.get(tag_id))
            .cloned()
            .unwrap_or_default();
    }
    let Some(address) = binding.get("address") else {
        return String::new();
    };
    if address.get("area").and_then(Value::as_str) == Some("DB") {
        let db = address
            .get("dbNumber")
            .and_then(Value::as_i64)
            .unwrap_or_default();
        let byte = address
            .get("byteOffset")
            .and_then(Value::as_i64)
            .unwrap_or_default();
        return match address
            .get("dataType")
            .and_then(Value::as_str)
            .unwrap_or("")
        {
            "BOOL" => format!(
                "DB{db}.DBX{byte}.{}",
                address
                    .get("bitOffset")
                    .and_then(Value::as_i64)
                    .unwrap_or_default()
            ),
            "INT" => format!("DB{db}.DBW{byte}"),
            _ => format!("DB{db}.DBD{byte}"),
        };
    }
    for field in ["key", "tag", "nodeId", "register", "symbol"] {
        if let Some(value) = address.get(field) {
            return value
                .as_str()
                .map(str::to_string)
                .unwrap_or_else(|| value.to_string());
        }
    }
    canonical_json(address)
}

fn resolve_data_binding(
    binding: &Value,
    direction: &str,
    consumer_limits: &Value,
    global_names: &HashMap<String, String>,
    tags: &mut Vec<Value>,
    direct_indexes: &mut HashMap<String, usize>,
) -> Option<String> {
    match binding.get("kind").and_then(Value::as_str)? {
        "global-tag" => {
            let name = global_names.get(binding.get("tagId")?.as_str()?)?.clone();
            if let Some(point) = tags
                .iter_mut()
                .find(|tag| tag.get("name").and_then(Value::as_str) == Some(name.as_str()))
            {
                merge_numeric_limit(point, consumer_limits, "min", f64::max);
                merge_numeric_limit(point, consumer_limits, "max", f64::min);
            }
            Some(name)
        }
        "connector" => {
            let profile_id = binding.get("protocolProfileId")?.as_str()?;
            let value_type = binding.get("type")?.as_str()?;
            let address = binding.get("address")?;
            let key = format!("{profile_id}:{value_type}:{}", canonical_json(address));
            if let Some(index) = direct_indexes.get(&key).copied() {
                merge_direct_point(&mut tags[index], direction, binding);
                merge_numeric_limit(&mut tags[index], consumer_limits, "min", f64::max);
                merge_numeric_limit(&mut tags[index], consumer_limits, "max", f64::min);
                return tags[index]
                    .get("name")
                    .and_then(Value::as_str)
                    .map(str::to_string);
            }

            let digest = Sha256::digest(key.as_bytes());
            let point_name = format!("__direct_{}", &format!("{digest:x}")[..12]);
            let mut point = json!({
                "name": point_name,
                "type": value_type,
                "direction": direction,
                "source": "agent",
                "protocolProfileId": profile_id,
                "address": address,
                "pollMs": binding.get("pollMs").cloned().unwrap_or(json!(1000)),
                "quality": "unknown"
            });
            copy_optional_number(binding, &mut point, "min");
            copy_optional_number(binding, &mut point, "max");
            merge_numeric_limit(&mut point, consumer_limits, "min", f64::max);
            merge_numeric_limit(&mut point, consumer_limits, "max", f64::min);
            tags.push(point);
            direct_indexes.insert(key, tags.len() - 1);
            Some(point_name)
        }
        _ => None,
    }
}

fn merge_direct_point(point: &mut Value, direction: &str, binding: &Value) {
    let existing_direction = point
        .get("direction")
        .and_then(Value::as_str)
        .unwrap_or("read");
    let merged_direction = if existing_direction == direction {
        existing_direction
    } else {
        "readWrite"
    };
    point["direction"] = json!(merged_direction);

    if let Some(incoming_poll) = binding.get("pollMs").and_then(Value::as_u64) {
        let current_poll = point
            .get("pollMs")
            .and_then(Value::as_u64)
            .unwrap_or(incoming_poll);
        point["pollMs"] = json!(current_poll.min(incoming_poll));
    }
    merge_numeric_limit(point, binding, "min", f64::max);
    merge_numeric_limit(point, binding, "max", f64::min);
}

fn merge_numeric_limit(
    point: &mut Value,
    binding: &Value,
    field: &str,
    merge: fn(f64, f64) -> f64,
) {
    let Some(incoming) = binding.get(field).and_then(Value::as_f64) else {
        return;
    };
    let value = point
        .get(field)
        .and_then(Value::as_f64)
        .map(|current| merge(current, incoming))
        .unwrap_or(incoming);
    point[field] = json!(value);
}

fn copy_optional_number(source: &Value, target: &mut Value, field: &str) {
    if let Some(value) = source.get(field).and_then(Value::as_f64) {
        target[field] = json!(value);
    }
}

fn canonical_json(value: &Value) -> String {
    match value {
        Value::Object(object) => {
            let mut keys: Vec<&String> = object.keys().collect();
            keys.sort();
            let fields = keys
                .into_iter()
                .map(|key| {
                    format!(
                        "{}:{}",
                        serde_json::to_string(key).unwrap_or_default(),
                        canonical_json(&object[key])
                    )
                })
                .collect::<Vec<_>>()
                .join(",");
            format!("{{{fields}}}")
        }
        Value::Array(items) => format!(
            "[{}]",
            items
                .iter()
                .map(canonical_json)
                .collect::<Vec<_>>()
                .join(",")
        ),
        _ => serde_json::to_string(value).unwrap_or_default(),
    }
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
            "screens": [{
                "id": "main",
                "widgets": [{
                    "id": "label",
                    "type": "static_text",
                    "editor": { "locked": true, "groupId": "group-1" },
                    "props": {}
                }]
            }]
        });
        let runtime = runtime_project(&project);
        assert!(runtime.get("name").is_none());
        assert_eq!(runtime["projectId"], "p1");
        assert_eq!(runtime["ui"]["statusOverlay"]["placement"], "top-right");
        assert_eq!(
            runtime["ui"]["statusOverlay"]["indicators"],
            json!(["wifi", "agent"])
        );
        assert_eq!(runtime["runtimeVersion"], "0.12.1");
        assert!(runtime["screens"][0]["widgets"][0].get("editor").is_none());
    }

    #[test]
    fn keeps_internal_retentive_tags_outside_agent_sessions() {
        let project = json!({
            "projectId": "p-local",
            "network": {},
            "agent": { "protocolVersion": "0.1.0" },
            "protocols": [],
            "tags": [{
                "id": "global-counter",
                "name": "Counter",
                "type": "int",
                "direction": "readWrite",
                "source": "internal",
                "initialValue": 3,
                "retentive": true,
                "quality": "good"
            }],
            "screens": [{
                "id": "main",
                "widgets": [{
                    "id": "counter-value",
                    "type": "tag_value",
                    "props": { "binding": { "kind": "global-tag", "tagId": "global-counter" } }
                }],
                "inputBindings": [{
                    "inputId": "primary",
                    "event": "press",
                    "action": {
                        "type": "changeValue",
                        "binding": { "kind": "global-tag", "tagId": "global-counter" },
                        "operation": "set",
                        "operand": 4,
                        "min": 0,
                        "max": 10
                    }
                }]
            }]
        });

        let runtime = runtime_project(&project);
        let tag = &runtime["tags"][0];
        assert_eq!(tag["source"], "internal");
        assert_eq!(tag["initialValue"], 3);
        assert_eq!(tag["retentive"], true);
        assert!(tag.get("protocolProfileId").is_none());
        assert!(tag.get("address").is_none());
        assert_eq!(tag["min"], 0.0);
        assert_eq!(tag["max"], 10.0);
        assert_eq!(
            runtime["screens"][0]["widgets"][0]["props"]["tag"],
            "Counter"
        );
        assert_eq!(
            runtime["screens"][0]["inputBindings"][0]["action"]["tag"],
            "Counter"
        );
    }

    #[test]
    fn omits_unused_global_tags_from_the_embedded_runtime() {
        let project = json!({
            "projectId": "p-pruned-tags",
            "network": {},
            "agent": { "protocolVersion": "0.1.0" },
            "protocols": [{ "id": "s7-main", "driver": "siemens-s7", "enabled": true }],
            "tags": [{
                "id": "global-used",
                "name": "Used",
                "type": "bool",
                "direction": "readWrite",
                "source": "agent",
                "protocolProfileId": "s7-main",
                "address": { "area": "DB", "dbNumber": 2, "byteOffset": 2, "bitOffset": 0, "dataType": "BOOL" },
                "quality": "unknown"
            }, {
                "id": "global-unused",
                "name": "UnusedInvalidAddress",
                "type": "float",
                "direction": "read",
                "source": "agent",
                "protocolProfileId": "s7-main",
                "address": { "area": "DB", "dbNumber": 999, "byteOffset": 4, "dataType": "REAL" },
                "quality": "unknown"
            }],
            "screens": [{
                "id": "main",
                "widgets": [{
                    "id": "used-value",
                    "type": "tag_value",
                    "props": { "binding": { "kind": "global-tag", "tagId": "global-used" } }
                }],
                "inputBindings": [{
                    "inputId": "primary",
                    "event": "press",
                    "action": {
                        "type": "changeValue",
                        "binding": { "kind": "global-tag", "tagId": "global-used" },
                        "operation": "toggle"
                    }
                }]
            }]
        });

        let runtime = runtime_project(&project);
        let tags = runtime["tags"].as_array().unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0]["name"], "Used");
        assert_eq!(tags[0]["direction"], "readWrite");
        assert!(tags
            .iter()
            .all(|tag| tag.get("name").and_then(Value::as_str) != Some("UnusedInvalidAddress")));
    }

    #[test]
    fn keeps_opcua_as_a_generic_agent_descriptor() {
        let project = json!({
            "projectId": "p-opcua",
            "network": {},
            "agent": { "protocolVersion": "0.1.0" },
            "protocols": [{
                "id": "opc-main",
                "name": "PLC OPC UA",
                "driver": "opcua",
                "endpoint": "opc.tcp://192.168.0.10:4840",
                "enabled": true,
                "options": {
                    "securityPolicy": "None",
                    "securityMode": "None",
                    "sessionTimeoutMs": 30000,
                    "requestTimeoutMs": 2000
                },
                "auth": { "mode": "anonymous" }
            }],
            "tags": [],
            "screens": [{
                "id": "main",
                "widgets": [{
                    "id": "opc-value",
                    "type": "tag_value",
                    "props": { "binding": {
                        "kind": "connector",
                        "protocolProfileId": "opc-main",
                        "type": "float",
                        "address": { "nodeId": "ns=3;s=Motor.Speed" },
                        "pollMs": 500
                    }}
                }],
                "inputBindings": []
            }]
        });

        let runtime = runtime_project(&project);
        assert_eq!(runtime["protocols"][0]["driver"], "opcua");
        assert_eq!(
            runtime["protocols"][0]["endpoint"],
            "opc.tcp://192.168.0.10:4840"
        );
        assert_eq!(
            runtime["tags"][0]["address"]["nodeId"],
            "ns=3;s=Motor.Speed"
        );
        assert_eq!(runtime["tags"][0]["protocolProfileId"], "opc-main");
        assert_eq!(
            runtime["screens"][0]["widgets"][0]["props"]["label"],
            "ns=3;s=Motor.Speed"
        );
    }

    #[test]
    fn compiles_global_and_direct_bindings_into_runtime_points() {
        let direct_read = json!({
            "kind": "connector",
            "protocolProfileId": "s7-main",
            "type": "float",
            "address": { "area": "DB", "dbNumber": 10, "byteOffset": 4, "dataType": "REAL" },
            "pollMs": 500,
            "simulationValue": 12.5
        });
        let direct_write = json!({
            "kind": "connector",
            "protocolProfileId": "s7-main",
            "type": "float",
            "address": { "dataType": "REAL", "byteOffset": 4, "dbNumber": 10, "area": "DB" },
            "pollMs": 1000
        });
        let project = json!({
            "projectId": "p1",
            "network": {},
            "agent": { "protocolVersion": "0.1.0" },
            "protocols": [{ "id": "s7-main", "driver": "siemens-s7", "enabled": true }],
            "tags": [{
                "id": "global-enabled",
                "name": "Enabled",
                "type": "bool",
                "direction": "readWrite",
                "source": "agent",
                "protocolProfileId": "s7-main",
                "address": { "area": "DB", "dbNumber": 10, "byteOffset": 0, "bitOffset": 0, "dataType": "BOOL" },
                "quality": "unknown"
            }, {
                "id": "global-setpoint",
                "name": "Setpoint",
                "type": "float",
                "direction": "readWrite",
                "source": "agent",
                "protocolProfileId": "s7-main",
                "address": { "area": "DB", "dbNumber": 10, "byteOffset": 8, "dataType": "REAL" },
                "quality": "unknown"
            }],
            "screens": [{
                "id": "main",
                "widgets": [
                    { "id": "read", "type": "tag_value", "props": { "binding": direct_read } },
                    { "id": "write", "type": "write_button", "props": { "binding": direct_write, "value": 42, "min": 0, "max": 100 } },
                    { "id": "global", "type": "boolean_indicator", "props": { "binding": { "kind": "global-tag", "tagId": "global-enabled" } } },
                    { "id": "gauge", "type": "gauge", "props": { "binding": { "kind": "global-tag", "tagId": "global-setpoint" }, "min": 0, "max": 100 } }
                ],
                "inputBindings": [{
                    "inputId": "primary",
                    "event": "press",
                    "action": { "type": "changeValue", "binding": { "kind": "global-tag", "tagId": "global-enabled" }, "operation": "toggle" }
                }, {
                    "inputId": "primary",
                    "event": "press",
                    "action": { "type": "changeValue", "binding": { "kind": "global-tag", "tagId": "global-setpoint" }, "operation": "add", "operand": 5, "min": 5, "max": 50 }
                }, {
                    "inputId": "primary",
                    "event": "press",
                    "action": { "type": "powerOff" }
                }]
            }]
        });

        let runtime = runtime_project(&project);
        let tags = runtime["tags"].as_array().unwrap();
        assert_eq!(tags.len(), 3);
        let direct = tags
            .iter()
            .find(|tag| {
                tag.get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .starts_with("__direct_")
            })
            .unwrap();
        assert_eq!(direct["direction"], "readWrite");
        assert_eq!(direct["pollMs"], 500);
        assert_eq!(direct["min"].as_f64(), Some(0.0));
        assert_eq!(direct["max"].as_f64(), Some(100.0));
        let direct_name = direct["name"].as_str().unwrap();
        assert_eq!(
            runtime["screens"][0]["widgets"][0]["props"]["tag"],
            direct_name
        );
        assert_eq!(
            runtime["screens"][0]["widgets"][0]["props"]["label"],
            "DB10.DBD4"
        );
        assert_eq!(
            runtime["screens"][0]["widgets"][1]["props"]["tag"],
            direct_name
        );
        assert!(runtime["screens"][0]["widgets"][0]["props"]
            .get("binding")
            .is_none());
        assert_eq!(
            runtime["screens"][0]["widgets"][2]["props"]["tag"],
            "Enabled"
        );
        assert_eq!(
            runtime["screens"][0]["widgets"][2]["props"]["label"],
            "Enabled"
        );
        assert_eq!(
            runtime["screens"][0]["widgets"][3]["props"]["tag"],
            "Setpoint"
        );
        assert!(runtime["screens"][0]["widgets"][3]["props"]
            .get("binding")
            .is_none());
        assert_eq!(
            runtime["screens"][0]["inputBindings"][0]["action"]["tag"],
            "Enabled"
        );
        assert_eq!(
            runtime["screens"][0]["inputBindings"][0]["action"]["operation"],
            "toggle"
        );
        assert_eq!(
            runtime["screens"][0]["inputBindings"][1]["action"]["tag"],
            "Setpoint"
        );
        assert_eq!(
            runtime["screens"][0]["inputBindings"][1]["action"]["operation"],
            "add"
        );
        assert_eq!(
            runtime["screens"][0]["inputBindings"][1]["action"]["operand"],
            5
        );
        assert_eq!(
            runtime["screens"][0]["inputBindings"][2]["action"]["type"],
            "powerOff"
        );
        let global_setpoint = tags
            .iter()
            .find(|tag| tag.get("name").and_then(Value::as_str) == Some("Setpoint"))
            .unwrap();
        assert_eq!(global_setpoint["min"].as_f64(), Some(5.0));
        assert_eq!(global_setpoint["max"].as_f64(), Some(50.0));
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
        assert!(output.join("include/LinkPadInputAdapter.h").exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn build_preparation_always_regenerates_the_current_project() {
        let project = json!({
            "projectId": "current-project",
            "network": {},
            "agent": { "protocolVersion": "0.1.0" },
            "protocols": [],
            "tags": [],
            "screens": [],
            "build": { "baudRate": 115200 }
        });
        let directory = std::env::temp_dir().join(format!(
            "linkpad-studio-build-preparation-{}",
            std::process::id()
        ));
        if directory.exists() {
            fs::remove_dir_all(&directory).unwrap();
        }
        let mut progress = Vec::new();
        let output = generate_for_build(&directory, &project, &mut |item| progress.push(item))
            .unwrap();
        let header = fs::read_to_string(output.join("include/generated_project.h")).unwrap();

        assert!(header.contains("current-project"));
        assert_eq!(progress.len(), 1);
        assert_eq!(progress[0].stage, "generating");
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
        assert!(RUNTIME_CPP.contains("handleInput(input)"));
        assert!(RUNTIME_CPP.contains("executeAction"));
        assert!(RUNTIME_CPP.contains("changeTagValue(action)"));
        assert!(RUNTIME_CPP.contains("\"changeValue\""));
        assert!(RUNTIME_CPP.contains("markProfileTagsQuality(profileId, \"unknown\")"));
        assert!(RUNTIME_CPP.contains("strlen(profileId) == 0 || sessionFor(profileId).isEmpty()"));
        assert!(!RUNTIME_CPP.contains(
            "strlen(profileId) == 0 || !(connectorStates_[profileId][\"tagsGood\"] | false)"
        ));
        assert!(RUNTIME_H.contains("markProfileTagsQuality"));
        assert!(RUNTIME_CPP.contains("inputBindings"));
        assert!(RUNTIME_CPP.contains("handled = executeAction"));
        assert!(RUNTIME_CPP.contains("M5.Power.powerOff()"));
        assert!(RUNTIME_CPP.contains("initializeInternalTags"));
        assert!(RUNTIME_CPP.contains("writeInternalTag"));
        assert!(RUNTIME_CPP.contains("retainInternalValue"));
        assert!(RUNTIME_H.contains("Preferences preferences_"));
        assert!(!RUNTIME_CPP.contains("M5.BtnA"));
        assert!(INPUT_ADAPTER_H.contains("M5.BtnA.wasClicked()"));
        assert!(INPUT_ADAPTER_H.contains("M5.BtnA.wasHold()"));
        assert!(INPUT_ADAPTER_H.contains("M5.BtnPWR.wasClicked()"));
        assert!(INPUT_ADAPTER_H.contains("M5.BtnPWR.wasHold()"));
        assert!(INPUT_ADAPTER_H.contains("{\"primary\", \"press\"}"));
        assert!(INPUT_ADAPTER_H.contains("{\"power\", \"longPress\"}"));
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
                    "id": "global-motor-speed",
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
                    "id": "global-aux-value",
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
                    { "id": "value", "type": "tag_value", "x": 5, "y": 25, "width": 100, "height": 20, "visible": true, "props": { "binding": { "kind": "global-tag", "tagId": "global-motor-speed" } } },
                    { "id": "aux", "type": "tag_value", "x": 110, "y": 25, "width": 100, "height": 20, "visible": true, "props": { "binding": { "kind": "global-tag", "tagId": "global-aux-value" } } },
                    { "id": "write", "type": "write_button", "x": 5, "y": 60, "width": 80, "height": 24, "visible": true, "props": { "binding": { "kind": "global-tag", "tagId": "global-motor-speed" }, "text": "Set 42", "value": 42 } }
                ],
                "inputBindings": [
                    { "inputId": "primary", "event": "press", "action": { "type": "navigate", "target": "next" } },
                    { "inputId": "secondary", "event": "press", "action": { "type": "activateWidget", "widgetId": "write" } }
                ]
            }],
            "build": { "serialPort": "", "baudRate": 115200 }
        });
        let mut received_progress = Vec::new();
        if let Err(error) = build(&directory, &project, false, "", |progress| {
            received_progress.push(progress)
        }) {
            let log = fs::read_to_string(directory.join("build/latest.log")).unwrap_or_default();
            panic!("{error}\n{log}");
        }
        assert!(received_progress.len() > 2);
        assert_eq!(received_progress.first().map(|item| item.stage), Some("generating"));
        assert_eq!(received_progress.last().map(|item| item.percent), Some(100));
        fs::remove_dir_all(directory).unwrap();
    }
}
