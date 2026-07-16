use flate2::read::GzDecoder;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use tar::Archive;

const PYTHON_ARCHIVE_URL: &str = "https://dl.registry.platformio.org/download/platformio/tool/python-portable/1.31107.0/python-portable-windows_amd64-1.31107.0.tar.gz";
const PYTHON_ARCHIVE_SHA256: &str =
    "f3bfa6adff27db34f9b25dfa6ea62a70d2d7ddbb69ca12c141cc56eef0724fde";
const INSTALLER_URL: &str = "https://raw.githubusercontent.com/platformio/platformio-core-installer/5f852c87e5647a3cfa9ef470322aa2c788179e2c/get-platformio.py";
const INSTALLER_SHA256: &str = "068d5dca983b22ed36a00dea7d42e58b646f0ac495885892f5746357f39a0470";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolchainStatus {
    pub state: &'static str,
    pub ready: bool,
    pub version: Option<String>,
    pub executable_path: String,
    pub root_path: String,
    pub managed: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolchainProgress {
    pub stage: &'static str,
    pub message: String,
    pub percent: u8,
}

pub fn status() -> ToolchainStatus {
    let root = toolchain_root();
    let executable = platformio_executable(&root);
    let version = platformio_version(&executable, &root).ok();
    ToolchainStatus {
        state: if version.is_some() {
            "ready"
        } else {
            "not_installed"
        },
        ready: version.is_some(),
        version,
        executable_path: executable.to_string_lossy().to_string(),
        root_path: root.to_string_lossy().to_string(),
        managed: true,
    }
}

pub fn prepare<F>(mut progress: F) -> Result<ToolchainStatus, String>
where
    F: FnMut(ToolchainProgress),
{
    if !cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        return Err("A toolchain gerenciada desta versão suporta Windows x64.".to_string());
    }

    migrate_legacy_root()?;
    emit(
        &mut progress,
        "checking",
        "Verificando a toolchain local...",
        2,
    );
    let current = status();
    if current.ready {
        emit(&mut progress, "ready", "Toolchain pronta para uso.", 100);
        return Ok(current);
    }

    let root = toolchain_root();
    let downloads_dir = root.join("downloads");
    let python_dir = root.join("python");
    let installer_dir = root.join("installer");
    let core_dir = root.join("core");
    fs::create_dir_all(&downloads_dir).map_err(error_text)?;
    fs::create_dir_all(&installer_dir).map_err(error_text)?;

    let python_executable = python_dir.join("python.exe");
    if !python_executable.exists() {
        emit(
            &mut progress,
            "python_download",
            "Baixando o Python portátil da toolchain...",
            5,
        );
        let archive_path = downloads_dir.join("python-portable.tar.gz");
        download_verified(
            PYTHON_ARCHIVE_URL,
            PYTHON_ARCHIVE_SHA256,
            &archive_path,
            5,
            35,
            &mut progress,
        )?;
        emit(
            &mut progress,
            "python_extract",
            "Preparando o Python portátil...",
            38,
        );
        extract_python(&archive_path, &python_dir)?;
        if !python_executable.exists() {
            return Err(
                "O pacote Python foi extraído, mas python.exe não foi encontrado.".to_string(),
            );
        }
    }

    let installer_path = installer_dir.join("get-platformio.py");
    emit(
        &mut progress,
        "installer_download",
        "Obtendo o instalador oficial do PlatformIO Core...",
        45,
    );
    if !file_matches_hash(&installer_path, INSTALLER_SHA256)? {
        download_verified(
            INSTALLER_URL,
            INSTALLER_SHA256,
            &installer_path,
            45,
            52,
            &mut progress,
        )?;
    }

    emit(
        &mut progress,
        "platformio_install",
        "Instalando o PlatformIO Core no ambiente do LinkPad Studio...",
        55,
    );
    fs::create_dir_all(&core_dir).map_err(error_text)?;
    let output = Command::new(&python_executable)
        .arg(&installer_path)
        .current_dir(&installer_dir)
        .env("PLATFORMIO_CORE_DIR", &core_dir)
        .env("PLATFORMIO_FORCE_COLOR", "0")
        .output()
        .map_err(|error| format!("Não foi possível iniciar o instalador do PlatformIO: {error}"))?;

    let install_log = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    fs::write(root.join("install.log"), &install_log).map_err(error_text)?;
    if !output.status.success() {
        return Err(format!(
            "A preparação do PlatformIO falhou (código {}). Consulte {}.",
            output.status.code().unwrap_or(-1),
            root.join("install.log").to_string_lossy()
        ));
    }

    emit(
        &mut progress,
        "verifying",
        "Validando o PlatformIO gerenciado...",
        95,
    );
    let prepared = status();
    if !prepared.ready {
        return Err(format!(
            "O instalador terminou, mas o PlatformIO não foi encontrado em {}. Consulte {}.",
            prepared.executable_path,
            root.join("install.log").to_string_lossy()
        ));
    }
    emit(&mut progress, "ready", "Toolchain pronta para uso.", 100);
    Ok(prepared)
}

pub fn platformio_command() -> Result<Command, String> {
    let root = toolchain_root();
    let executable = platformio_executable(&root);
    if !executable.exists() {
        return Err("A toolchain ainda não foi preparada pelo LinkPad Studio.".to_string());
    }
    let mut command = Command::new(executable);
    command
        .env("PLATFORMIO_CORE_DIR", root.join("core"))
        .env("PLATFORMIO_FORCE_COLOR", "0")
        .env("PLATFORMIO_SETTING_ENABLE_TELEMETRY", "false");
    Ok(command)
}

pub fn toolchain_root() -> PathBuf {
    app_data_root().join("pio")
}

pub fn build_cache_root() -> PathBuf {
    app_data_root().join("b")
}

fn app_data_root() -> PathBuf {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("LinkPadStudio")
}

fn migrate_legacy_root() -> Result<(), String> {
    let destination = toolchain_root();
    if destination.exists() {
        return Ok(());
    }
    let legacy = app_data_root().join("toolchains").join("platformio");
    if !legacy.exists() {
        return Ok(());
    }
    fs::create_dir_all(app_data_root()).map_err(error_text)?;
    fs::rename(&legacy, &destination).map_err(|error| {
        format!(
            "Não foi possível migrar a toolchain para o caminho compacto {}: {error}",
            destination.to_string_lossy()
        )
    })
}

fn platformio_executable(root: &Path) -> PathBuf {
    root.join("core")
        .join("penv")
        .join("Scripts")
        .join("platformio.exe")
}

fn platformio_version(executable: &Path, root: &Path) -> Result<String, String> {
    if !executable.exists() {
        return Err("PlatformIO ausente.".to_string());
    }
    let output = Command::new(executable)
        .arg("--version")
        .env("PLATFORMIO_CORE_DIR", root.join("core"))
        .env("PLATFORMIO_FORCE_COLOR", "0")
        .output()
        .map_err(error_text)?;
    if !output.status.success() {
        return Err("PlatformIO instalado, mas indisponível.".to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn download_verified<F>(
    url: &str,
    expected_sha256: &str,
    destination: &Path,
    start_percent: u8,
    end_percent: u8,
    progress: &mut F,
) -> Result<(), String>
where
    F: FnMut(ToolchainProgress),
{
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(300))
        .user_agent("LinkPadStudio/0.5.0")
        .build()
        .map_err(error_text)?;
    let mut response = client.get(url).send().map_err(error_text)?;
    if !response.status().is_success() {
        return Err(format!(
            "Download da toolchain respondeu HTTP {}.",
            response.status()
        ));
    }

    let total = response.content_length().unwrap_or(0);
    let part_path = destination.with_extension("part");
    let mut file = File::create(&part_path).map_err(error_text)?;
    let mut hasher = Sha256::new();
    let mut downloaded = 0_u64;
    let mut last_emitted_percent = u8::MAX;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = response.read(&mut buffer).map_err(error_text)?;
        if count == 0 {
            break;
        }
        file.write_all(&buffer[..count]).map_err(error_text)?;
        hasher.update(&buffer[..count]);
        downloaded += count as u64;
        if total > 0 {
            let fraction = downloaded.saturating_mul((end_percent - start_percent) as u64) / total;
            let percent = start_percent
                .saturating_add(fraction as u8)
                .min(end_percent);
            if percent != last_emitted_percent {
                emit(
                    progress,
                    "downloading",
                    &format!(
                        "Baixando toolchain... {}%",
                        downloaded.saturating_mul(100) / total
                    ),
                    percent,
                );
                last_emitted_percent = percent;
            }
        }
    }
    file.flush().map_err(error_text)?;

    let actual = format!("{:x}", hasher.finalize());
    if actual != expected_sha256 {
        let _ = fs::remove_file(&part_path);
        return Err("O download da toolchain falhou na verificação de integridade.".to_string());
    }
    if destination.exists() {
        fs::remove_file(destination).map_err(error_text)?;
    }
    fs::rename(part_path, destination).map_err(error_text)
}

fn extract_python(archive_path: &Path, python_dir: &Path) -> Result<(), String> {
    let root = python_dir
        .parent()
        .ok_or_else(|| "Pasta de toolchain inválida.".to_string())?;
    let temp_dir = root.join("python-extracting");
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).map_err(error_text)?;
    }
    fs::create_dir_all(&temp_dir).map_err(error_text)?;

    let file = File::open(archive_path).map_err(error_text)?;
    let decoder = GzDecoder::new(file);
    let mut archive = Archive::new(decoder);
    for entry in archive.entries().map_err(error_text)? {
        let mut entry = entry.map_err(error_text)?;
        if !entry.unpack_in(&temp_dir).map_err(error_text)? {
            return Err("O pacote Python contém um caminho inválido.".to_string());
        }
    }
    if !temp_dir.join("python.exe").exists() {
        return Err("O pacote Python portátil está incompleto.".to_string());
    }
    if python_dir.exists() {
        fs::remove_dir_all(python_dir).map_err(error_text)?;
    }
    fs::rename(temp_dir, python_dir).map_err(error_text)
}

fn file_matches_hash(path: &Path, expected_sha256: &str) -> Result<bool, String> {
    if !path.exists() {
        return Ok(false);
    }
    let mut file = File::open(path).map_err(error_text)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(error_text)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()) == expected_sha256)
}

fn emit<F>(progress: &mut F, stage: &'static str, message: &str, percent: u8)
where
    F: FnMut(ToolchainProgress),
{
    progress(ToolchainProgress {
        stage,
        message: message.to_string(),
        percent,
    });
}

fn error_text(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn managed_executable_is_inside_toolchain_root() {
        let root = PathBuf::from("C:/LinkPadStudio/toolchains/platformio");
        assert!(platformio_executable(&root).starts_with(&root));
        assert!(platformio_executable(&root).ends_with("platformio.exe"));
    }

    #[test]
    fn pinned_hashes_are_sha256() {
        assert_eq!(PYTHON_ARCHIVE_SHA256.len(), 64);
        assert_eq!(INSTALLER_SHA256.len(), 64);
        assert!(PYTHON_ARCHIVE_SHA256
            .chars()
            .all(|value| value.is_ascii_hexdigit()));
        assert!(INSTALLER_SHA256
            .chars()
            .all(|value| value.is_ascii_hexdigit()));
    }

    #[test]
    #[ignore = "baixa e instala a toolchain gerenciada em LOCALAPPDATA"]
    fn prepares_managed_toolchain() {
        let prepared = prepare(|progress| {
            println!("{}% {}", progress.percent, progress.message);
        })
        .unwrap();
        assert!(prepared.ready);
        assert!(Path::new(&prepared.executable_path).exists());
    }
}
