from __future__ import annotations

import os
import sys
from pathlib import Path

from PySide6.QtCore import QTimer
from PySide6.QtWidgets import QMessageBox, QSystemTrayIcon

from linkpad_agent.config import AppPaths, load_config
from linkpad_agent.host import AgentHost
from linkpad_agent.logging_setup import configure_logging
from linkpad_agent.tray_main import (
    LinkPadTray,
    _create_application,
    acquire_tray_lock,
)


def development_paths(project_root: Path | None = None) -> AppPaths:
    configured = os.getenv("LINKPAD_AGENT_CONFIG")
    if configured:
        return AppPaths.discover()

    project_root = project_root or Path(__file__).resolve().parents[2]
    data_dir = project_root / ".dev"
    return AppPaths(
        data_dir=data_dir,
        config_file=data_dir / "config.json",
        log_dir=data_dir / "logs",
    )


def main() -> None:
    app = _create_application()
    app.setApplicationName("LinkPad Agent DEV")
    if not QSystemTrayIcon.isSystemTrayAvailable():
        QMessageBox.critical(
            None, "LinkPad Agent DEV", "A bandeja do sistema não está disponível."
        )
        raise SystemExit(1)

    lock = acquire_tray_lock()
    if lock is None:
        QMessageBox.information(
            None,
            "LinkPad Agent DEV",
            "Já existe uma bandeja do LinkPad Agent em execução.",
        )
        raise SystemExit(0)

    paths = development_paths()
    config, paths = load_config(paths)
    configure_logging(config.logging, paths.log_dir)
    host = AgentHost(config)
    try:
        host.start()
    except Exception as exc:
        lock.unlock()
        QMessageBox.critical(
            None,
            "LinkPad Agent DEV",
            "Não foi possível iniciar as APIs. Verifique se as portas "
            f"{config.server.port} e {config.management.port} já estão em uso.\n\n{exc}",
        )
        raise SystemExit(1) from exc

    print("LinkPad Agent DEV ativo. Use o ícone azul 'D' para consultar ou encerrar.")
    print(f"API pública: http://127.0.0.1:{config.server.port}/lpp/v1/status")
    tray = LinkPadTray(app, config, paths, development=True)
    if "--smoke-test" in sys.argv:
        QTimer.singleShot(1500, tray.quit)
    try:
        exit_code = app.exec()
    except KeyboardInterrupt:
        exit_code = 0
    finally:
        tray.shutdown()
        host.stop()
        lock.unlock()
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
