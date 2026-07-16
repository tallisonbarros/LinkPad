#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod firmware;
mod serial_ports;
mod toolchain;

use serde_json::{json, Value};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::Emitter;

#[tauri::command]
fn pick_project_folder() -> Result<Option<String>, String> {
    Ok(rfd::FileDialog::new()
        .set_title("Selecionar pasta do projeto LinkPad")
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
fn open_project_from_dialog() -> Result<Option<Value>, String> {
    let selected = rfd::FileDialog::new()
        .set_title("Carregar projeto LinkPad")
        .add_filter("Projeto LinkPad", &["json"])
        .pick_file();

    match selected {
        Some(path) => Ok(Some(read_project_from_path(&path)?)),
        None => Ok(None),
    }
}

#[tauri::command]
fn save_project_to_disk(project: Value) -> Result<Value, String> {
    let project_dir = resolve_project_dir(&project)?;
    fs::create_dir_all(&project_dir).map_err(error_text)?;
    backup_legacy_project(&project_dir)?;
    fs::create_dir_all(project_dir.join("assets").join("fonts")).map_err(error_text)?;
    fs::create_dir_all(project_dir.join("assets").join("images")).map_err(error_text)?;
    fs::create_dir_all(project_dir.join("generated")).map_err(error_text)?;
    fs::create_dir_all(project_dir.join("build")).map_err(error_text)?;

    let mut updated_project = project;
    updated_project["folderPath"] = json!(project_dir.to_string_lossy().to_string());

    let project_meta = json!({
        "schemaVersion": updated_project.get("schemaVersion").cloned().unwrap_or(json!("0.1.0")),
        "studioVersion": updated_project.get("studioVersion").cloned().unwrap_or(json!("0.1.0")),
        "projectId": updated_project.get("projectId").cloned().unwrap_or(json!("")),
        "name": updated_project.get("name").cloned().unwrap_or(json!("")),
        "description": updated_project.get("description").cloned().unwrap_or(json!("")),
        "folderPath": updated_project.get("folderPath").cloned().unwrap_or(json!("")),
        "createdAt": updated_project.get("createdAt").cloned().unwrap_or(json!("")),
        "updatedAt": updated_project.get("updatedAt").cloned().unwrap_or(json!(""))
    });

    write_json(project_dir.join("project.json"), &project_meta)?;
    write_json(
        project_dir.join("hardware.json"),
        updated_project.get("hardware").unwrap_or(&json!({})),
    )?;
    write_json(
        project_dir.join("network.json"),
        updated_project.get("network").unwrap_or(&json!({})),
    )?;
    write_json(
        project_dir.join("agent.json"),
        updated_project.get("agent").unwrap_or(&json!({})),
    )?;
    write_json(
        project_dir.join("protocols.json"),
        &json!({ "profiles": updated_project.get("protocols").cloned().unwrap_or(json!([])) }),
    )?;
    write_json(
        project_dir.join("tags.json"),
        &json!({ "tags": updated_project.get("tags").cloned().unwrap_or(json!([])) }),
    )?;
    write_json(
        project_dir.join("screens.json"),
        &json!({ "screens": updated_project.get("screens").cloned().unwrap_or(json!([])) }),
    )?;
    write_json(
        project_dir.join("build.json"),
        updated_project.get("build").unwrap_or(&json!({})),
    )?;

    Ok(updated_project)
}

#[tauri::command]
fn test_agent_connection(
    host: String,
    port: u16,
    token: String,
    timeout_ms: u64,
) -> Result<Value, String> {
    let status = http_get_json(&host, port, "/lpp/v1/status", &token, timeout_ms)?;
    let capabilities = http_get_json(&host, port, "/lpp/v1/capabilities", &token, timeout_ms)?;
    Ok(json!({
        "status": status,
        "capabilities": capabilities
    }))
}

#[tauri::command]
async fn test_connector_connection(
    host: String,
    port: u16,
    token: String,
    timeout_ms: u64,
    project_id: String,
    profile: Value,
) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        test_connector_connection_blocking(&host, port, &token, timeout_ms, &project_id, &profile)
    })
    .await
    .map_err(|error| format!("Falha ao executar o teste do conector: {error}"))?
}

fn test_connector_connection_blocking(
    host: &str,
    port: u16,
    token: &str,
    timeout_ms: u64,
    project_id: &str,
    profile: &Value,
) -> Result<Value, String> {
    let target = connector_target(profile)?;
    let driver = target
        .get("driver")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let endpoint = target
        .get("endpoint")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let session_payload = connector_session_payload(project_id, target);
    let connector_timeout_ms = profile
        .pointer("/options/timeoutMs")
        .and_then(Value::as_u64)
        .unwrap_or(timeout_ms);
    let request_timeout_ms = timeout_ms
        .max(connector_timeout_ms.saturating_add(1_000))
        .clamp(100, 35_000);
    let base_url = agent_base_url(host, port)?;
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_millis(timeout_ms.clamp(100, 30_000)))
        .timeout(Duration::from_millis(request_timeout_ms))
        .build()
        .map_err(error_text)?;

    let started = Instant::now();
    let created = send_agent_json(
        client.post(format!("{base_url}/lpp/v1/sessions")),
        token,
        Some(&session_payload),
    )?;
    let elapsed_ms = started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64;
    let session_id = created
        .get("sessionId")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "O Agent abriu a conexão, mas não devolveu sessionId.".to_string())?;

    let cleanup_warning = send_agent_json(
        client.delete(format!("{base_url}/lpp/v1/sessions/{session_id}")),
        token,
        None,
    )
    .err();

    Ok(json!({
        "ok": true,
        "status": "connected",
        "driver": driver,
        "endpoint": endpoint,
        "latencyMs": elapsed_ms,
        "sessionClosed": cleanup_warning.is_none(),
        "cleanupWarning": cleanup_warning
    }))
}

fn connector_target(profile: &Value) -> Result<Value, String> {
    let driver = profile
        .get("driver")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "O perfil não possui driver.".to_string())?;
    let endpoint = profile
        .get("endpoint")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "O perfil não possui endpoint.".to_string())?;
    let mut target = json!({
        "driver": driver,
        "endpoint": endpoint,
        "options": profile.get("options").cloned().unwrap_or(json!({}))
    });
    if let Some(auth) = profile.get("auth") {
        target["auth"] = auth.clone();
    }
    Ok(target)
}

fn connector_session_payload(project_id: &str, target: Value) -> Value {
    json!({
        "contractVersion": "0.1.0",
        "deviceId": project_id,
        "projectId": project_id,
        "target": target
    })
}

fn agent_base_url(host: &str, port: u16) -> Result<String, String> {
    let host = host.trim();
    if host.is_empty()
        || host.chars().any(char::is_whitespace)
        || host.contains('/')
        || host.contains('\\')
        || host.contains(':')
    {
        return Err("Informe apenas o host ou IPv4 do LinkPad Agent.".to_string());
    }
    Ok(format!("http://{host}:{port}"))
}

fn send_agent_json(
    mut request: reqwest::blocking::RequestBuilder,
    token: &str,
    body: Option<&Value>,
) -> Result<Value, String> {
    if !token.is_empty() {
        request = request.header("X-LINKPAD-TOKEN", token);
    }
    if let Some(body) = body {
        request = request.json(body);
    }
    let response = request
        .send()
        .map_err(|error| format!("Não foi possível acessar o LinkPad Agent: {error}"))?;
    let status = response.status();
    let text = response.text().map_err(error_text)?;
    let payload = serde_json::from_str::<Value>(text.trim())
        .map_err(|error| format!("O Agent respondeu HTTP {status} com JSON inválido: {error}"))?;
    if !status.is_success() {
        let code = payload
            .pointer("/error/code")
            .and_then(Value::as_str)
            .unwrap_or("agent_error");
        let message = payload
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or("O Agent recusou o teste do conector.");
        return Err(format!("{code}: {message}"));
    }
    Ok(payload)
}

#[tauri::command]
fn generate_firmware(project: Value) -> Result<Value, String> {
    let project_dir = resolve_project_dir(&project)?;
    let output = firmware::generate(&project_dir, &project)?;
    Ok(json!({
        "ok": true,
        "outputPath": output.to_string_lossy()
    }))
}

#[tauri::command]
async fn run_firmware_build(
    app: tauri::AppHandle,
    project: Value,
    flash: bool,
) -> Result<Value, String> {
    let project_dir = resolve_project_dir(&project)?;
    let serial_port = project
        .pointer("/build/serialPort")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    tauri::async_runtime::spawn_blocking(move || {
        firmware::build(&project_dir, flash, &serial_port, |progress| {
            let _ = app.emit("firmware-progress", progress);
        })
    })
    .await
    .map_err(|error| format!("Falha ao executar o build do firmware: {error}"))?
}

#[tauri::command]
async fn list_serial_ports() -> Result<Vec<serial_ports::SerialPortDescriptor>, String> {
    tauri::async_runtime::spawn_blocking(serial_ports::list)
        .await
        .map_err(|error| format!("Falha ao listar as portas seriais: {error}"))?
}

#[tauri::command]
fn get_toolchain_status() -> toolchain::ToolchainStatus {
    toolchain::status()
}

#[tauri::command]
async fn prepare_toolchain(app: tauri::AppHandle) -> Result<toolchain::ToolchainStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        toolchain::prepare(|progress| {
            let _ = app.emit("toolchain-progress", progress);
        })
    })
    .await
    .map_err(|error| format!("Falha ao preparar a toolchain: {error}"))?
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            pick_project_folder,
            open_project_from_dialog,
            save_project_to_disk,
            test_agent_connection,
            test_connector_connection,
            generate_firmware,
            run_firmware_build,
            list_serial_ports,
            get_toolchain_status,
            prepare_toolchain
        ])
        .run(tauri::generate_context!())
        .expect("error while running LinkPad Studio");
}

fn resolve_project_dir(project: &Value) -> Result<PathBuf, String> {
    let folder = project
        .get("folderPath")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Pasta do projeto nao informada".to_string())?;

    let name = project
        .get("name")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Nome do projeto nao informado".to_string())?;

    let base = PathBuf::from(folder);
    if base
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("linkpad"))
    {
        return Ok(base);
    }

    Ok(base.join(format!("{}.linkpad", sanitize_folder_name(name))))
}

fn read_project_from_path(path: &Path) -> Result<Value, String> {
    let project_meta: Value = read_json(path)?;
    let dir = path
        .parent()
        .ok_or_else(|| "Caminho do projeto invalido".to_string())?;

    let mut project = project_meta;
    project["folderPath"] = json!(dir.to_string_lossy().to_string());

    if let Ok(hardware) = read_json(&dir.join("hardware.json")) {
        project["hardware"] = hardware;
    }
    if let Ok(network) = read_json(&dir.join("network.json")) {
        project["network"] = network;
    }
    if let Ok(agent) = read_json(&dir.join("agent.json")) {
        project["agent"] = agent;
    }
    if let Ok(protocols) = read_json(&dir.join("protocols.json")) {
        project["protocols"] = protocols.get("profiles").cloned().unwrap_or(protocols);
    }
    if let Ok(tags) = read_json(&dir.join("tags.json")) {
        project["tags"] = tags.get("tags").cloned().unwrap_or(tags);
    }
    if let Ok(screens) = read_json(&dir.join("screens.json")) {
        project["screens"] = screens.get("screens").cloned().unwrap_or(screens);
    }
    if let Ok(build) = read_json(&dir.join("build.json")) {
        project["build"] = build;
    }

    if project.get("assets").is_none() {
        project["assets"] = json!({
            "fonts": [],
            "images": []
        });
    }

    Ok(project)
}

fn read_json(path: &Path) -> Result<Value, String> {
    let text = fs::read_to_string(path).map_err(error_text)?;
    serde_json::from_str(&text).map_err(error_text)
}

fn write_json(path: PathBuf, value: &Value) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(error_text)?;
    fs::write(path, text).map_err(error_text)
}

fn backup_legacy_project(project_dir: &Path) -> Result<(), String> {
    let project_path = project_dir.join("project.json");
    let Ok(project) = read_json(&project_path) else {
        return Ok(());
    };
    let Some(schema_version @ ("0.1.0" | "0.2.0")) =
        project.get("schemaVersion").and_then(Value::as_str)
    else {
        return Ok(());
    };

    let backup_dir = project_dir.join(".migration-backup").join(schema_version);
    if backup_dir.exists() {
        return Ok(());
    }
    fs::create_dir_all(&backup_dir).map_err(error_text)?;
    for file_name in [
        "project.json",
        "hardware.json",
        "network.json",
        "agent.json",
        "protocols.json",
        "tags.json",
        "screens.json",
        "build.json",
    ] {
        let source = project_dir.join(file_name);
        if source.exists() {
            fs::copy(&source, backup_dir.join(file_name)).map_err(error_text)?;
        }
    }
    Ok(())
}

fn http_get_json(
    host: &str,
    port: u16,
    path: &str,
    token: &str,
    timeout_ms: u64,
) -> Result<Value, String> {
    let address = format!("{host}:{port}");
    let timeout = Duration::from_millis(timeout_ms.clamp(100, 30_000));
    let mut stream = TcpStream::connect(&address)
        .map_err(|error| format!("Nao foi possivel conectar a {address}: {error}"))?;
    stream.set_read_timeout(Some(timeout)).map_err(error_text)?;
    stream
        .set_write_timeout(Some(timeout))
        .map_err(error_text)?;

    let token_header = if token.is_empty() {
        String::new()
    } else {
        format!("X-LINKPAD-TOKEN: {token}\r\n")
    };
    let request = format!(
        "GET {path} HTTP/1.0\r\nHost: {host}:{port}\r\n{token_header}Connection: close\r\n\r\n"
    );
    stream.write_all(request.as_bytes()).map_err(error_text)?;

    let mut response = Vec::new();
    stream.read_to_end(&mut response).map_err(error_text)?;
    let response = String::from_utf8(response).map_err(error_text)?;
    let (headers, body) = response
        .split_once("\r\n\r\n")
        .ok_or_else(|| "Resposta HTTP invalida do Agent".to_string())?;
    let status_line = headers.lines().next().unwrap_or_default();
    if !status_line.contains(" 200 ") {
        return Err(format!("Agent respondeu {status_line}"));
    }
    serde_json::from_str(body.trim()).map_err(error_text)
}

fn sanitize_folder_name(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            _ => ch,
        })
        .collect();
    let trimmed = sanitized.trim().trim_matches('.').to_string();
    if trimmed.is_empty() {
        "Projeto LinkPad".to_string()
    } else {
        trimmed
    }
}

fn error_text(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::thread;

    #[test]
    fn sanitizes_windows_folder_names() {
        assert_eq!(sanitize_folder_name("Linha:01/Teste"), "Linha-01-Teste");
        assert_eq!(sanitize_folder_name("..."), "Projeto LinkPad");
    }

    #[test]
    fn resolves_linkpad_directory_only_once() {
        let project = json!({
            "name": "Minha Linha",
            "folderPath": "C:/Projetos"
        });
        assert!(resolve_project_dir(&project)
            .unwrap()
            .ends_with("Minha Linha.linkpad"));
    }

    #[test]
    fn backs_up_schema_0_2_before_saving_the_migrated_project() {
        let directory = std::env::temp_dir().join(format!(
            "linkpad-studio-project-backup-{}",
            std::process::id()
        ));
        if directory.exists() {
            fs::remove_dir_all(&directory).unwrap();
        }
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            directory.join("project.json"),
            r#"{"schemaVersion":"0.2.0","name":"Legacy"}"#,
        )
        .unwrap();
        fs::write(directory.join("screens.json"), r#"{"screens":[]}"#).unwrap();

        backup_legacy_project(&directory).unwrap();

        let backup = directory.join(".migration-backup/0.2.0");
        assert!(backup.join("project.json").exists());
        assert!(backup.join("screens.json").exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn connector_test_builds_only_the_linkpad_target_fields() {
        let profile = json!({
            "id": "s7-main",
            "name": "S7 principal",
            "driver": "siemens-s7",
            "endpoint": "s7://192.168.0.10:102",
            "enabled": true,
            "options": { "rack": 0, "slot": 1, "timeoutMs": 2000 }
        });
        let target = connector_target(&profile).unwrap();
        let payload = connector_session_payload("project-test", target);

        assert_eq!(payload["deviceId"], "project-test");
        assert_eq!(payload["target"]["driver"], "siemens-s7");
        assert_eq!(payload["target"]["options"]["slot"], 1);
        assert!(payload["target"].get("id").is_none());
        assert!(payload["target"].get("name").is_none());
        assert!(payload["target"].get("enabled").is_none());
    }

    #[test]
    fn connector_test_rejects_agent_urls_in_the_host_field() {
        assert!(agent_base_url("http://127.0.0.1", 8008).is_err());
        assert_eq!(
            agent_base_url("192.168.0.20", 8008).unwrap(),
            "http://192.168.0.20:8008"
        );
    }

    #[test]
    fn connector_test_creates_and_closes_session_without_tag_io() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = thread::spawn(move || {
            let create_request = respond_once(
                &listener,
                "201 Created",
                r#"{"ok":true,"sessionId":"temporary-session"}"#,
            );
            let delete_request =
                respond_once(&listener, "200 OK", r#"{"ok":true,"status":"closed"}"#);
            (create_request, delete_request)
        });
        let profile = json!({
            "id": "sim-main",
            "name": "Simulacao",
            "driver": "sim",
            "endpoint": "memory://connector-test",
            "enabled": true,
            "options": {}
        });

        let result = test_connector_connection_blocking(
            "127.0.0.1",
            port,
            "",
            1000,
            "project-test",
            &profile,
        )
        .unwrap();
        let (create_request, delete_request) = server.join().unwrap();

        assert_eq!(result["status"], "connected");
        assert_eq!(result["sessionClosed"], true);
        assert!(create_request.starts_with("POST /lpp/v1/sessions "));
        assert!(create_request.contains("\"driver\":\"sim\""));
        assert!(!create_request.contains("\"address\""));
        assert!(delete_request.starts_with("DELETE /lpp/v1/sessions/temporary-session "));
    }

    fn respond_once(listener: &TcpListener, status: &str, body: &str) -> String {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(2)))
            .unwrap();
        let mut request = Vec::new();
        let mut chunk = [0_u8; 4096];
        loop {
            let read = stream.read(&mut chunk).unwrap();
            if read == 0 {
                break;
            }
            request.extend_from_slice(&chunk[..read]);
            if let Some(header_end) = request.windows(4).position(|part| part == b"\r\n\r\n") {
                let headers = String::from_utf8_lossy(&request[..header_end]);
                let content_length = headers
                    .lines()
                    .find_map(|line| {
                        let (name, value) = line.split_once(':')?;
                        name.eq_ignore_ascii_case("content-length")
                            .then(|| value.trim().parse::<usize>().ok())
                            .flatten()
                    })
                    .unwrap_or(0);
                if request.len() >= header_end + 4 + content_length {
                    break;
                }
            }
        }
        let response = format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        stream.write_all(response.as_bytes()).unwrap();
        String::from_utf8(request).unwrap()
    }
}
