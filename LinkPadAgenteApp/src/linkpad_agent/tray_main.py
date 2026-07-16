from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import httpx
from PySide6.QtCore import QLockFile, Qt, QTimer
from PySide6.QtGui import (
    QAction,
    QColor,
    QCursor,
    QFont,
    QIcon,
    QPainter,
    QPixmap,
)
from PySide6.QtWidgets import QApplication, QMenu, QMessageBox, QSystemTrayIcon

from linkpad_agent.config import AgentConfig, AppPaths, load_config


SERVICE_NAME = "LinkPadAgent"


def _status_icon(color: str, label: str = "LP") -> QIcon:
    pixmap = QPixmap(64, 64)
    pixmap.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)
    painter.setBrush(QColor(color))
    painter.setPen(Qt.PenStyle.NoPen)
    painter.drawEllipse(2, 2, 60, 60)
    painter.setPen(QColor("white"))
    font = QFont("Segoe UI", 18, QFont.Weight.Bold)
    painter.setFont(font)
    painter.drawText(pixmap.rect(), Qt.AlignmentFlag.AlignCenter, label)
    painter.end()
    return QIcon(pixmap)


def tray_lock_path() -> Path:
    local_app_data = Path(os.getenv("LOCALAPPDATA", Path.home()))
    directory = local_app_data / "LinkPad" / "Agent"
    directory.mkdir(parents=True, exist_ok=True)
    return directory / "tray.lock"


def acquire_tray_lock(path: Path | None = None) -> QLockFile | None:
    lock = QLockFile(str(path or tray_lock_path()))
    lock.setStaleLockTime(0)
    if not lock.tryLock(0):
        return None
    return lock


class LinkPadTray:
    def __init__(
        self,
        app: QApplication,
        config: AgentConfig,
        paths: AppPaths,
        *,
        development: bool = False,
    ):
        self._app = app
        self._config = config
        self._paths = paths
        self._development = development
        self._base_url = (
            f"http://127.0.0.1:{self._config.management.port}/management/v1"
        )
        self._state = "starting"
        self._tray = QSystemTrayIcon(_status_icon("#d69e2e"), app)
        self._tray.setToolTip(self._tooltip("iniciando"))
        self._menu = QMenu()

        mode_text = (
            "MODO DESENVOLVIMENTO · API e bandeja juntas"
            if development
            else "MODO SERVIÇO WINDOWS · bandeja independente"
        )
        self._mode_action = QAction(mode_text, self._menu)
        self._mode_action.setEnabled(False)
        self._menu.addAction(self._mode_action)

        self._status_action = QAction("Verificando serviço...", self._menu)
        self._status_action.setEnabled(False)
        self._menu.addAction(self._status_action)
        self._menu.addSeparator()

        self._config_action = QAction("Abrir configuração", self._menu)
        self._config_action.triggered.connect(
            lambda: os.startfile(self._paths.config_file)
        )
        self._menu.addAction(self._config_action)
        self._logs_action = QAction("Abrir pasta de logs", self._menu)
        self._logs_action.triggered.connect(lambda: os.startfile(self._paths.log_dir))
        self._menu.addAction(self._logs_action)

        self._restart_action: QAction | None = None
        if not development:
            self._restart_action = QAction("Reiniciar serviço Windows", self._menu)
            self._restart_action.triggered.connect(self._restart_service)
            self._menu.addAction(self._restart_action)

        self._menu.addSeparator()
        exit_text = (
            "Encerrar Agent de desenvolvimento"
            if development
            else "Encerrar somente a bandeja"
        )
        self._exit_action = QAction(exit_text, self._menu)
        self._exit_action.triggered.connect(self.quit)
        self._menu.addAction(self._exit_action)

        self._tray.setContextMenu(self._menu)
        self._tray.activated.connect(self._on_activated)
        self._tray.show()
        self._timer = QTimer(self._tray)
        self._timer.timeout.connect(self._refresh)
        self._timer.start(3000)
        self._refresh()

    def _tooltip(self, message: str) -> str:
        product = "LinkPad Agent DEV" if self._development else "LinkPad Agent"
        return f"{product}: {message}"

    def _refresh(self) -> None:
        try:
            response = httpx.get(f"{self._base_url}/status", timeout=0.8)
            response.raise_for_status()
            payload = response.json()
            sessions = payload.get("sessions", 0)
            warnings = payload.get("warnings", [])
            if self._development:
                suffix = " · sem autenticação" if warnings else ""
                self._set_state(
                    "development", f"DEV ativo · {sessions} sessão(ões){suffix}"
                )
            elif warnings:
                self._set_state(
                    "warning",
                    f"Ativo · {sessions} sessão(ões) · atenção na configuração",
                )
            else:
                self._set_state("ready", f"Ativo · {sessions} sessão(ões)")
        except Exception:
            unavailable = (
                "Agent de desenvolvimento indisponível"
                if self._development
                else "Serviço Windows indisponível"
            )
            self._set_state("offline", unavailable)

    def _set_state(self, state: str, message: str) -> None:
        colors = {
            "ready": "#2f855a",
            "development": "#3182ce",
            "warning": "#d69e2e",
            "offline": "#c53030",
        }
        self._state = state
        label = "D" if self._development else "LP"
        self._tray.setIcon(_status_icon(colors[state], label))
        self._tray.setToolTip(self._tooltip(message))
        self._status_action.setText(message)

    def _on_activated(self, reason: QSystemTrayIcon.ActivationReason) -> None:
        if reason == QSystemTrayIcon.ActivationReason.Trigger:
            self._menu.popup(QCursor.pos())

    def _restart_service(self) -> None:
        command = (
            "Start-Process powershell.exe -Verb RunAs -ArgumentList "
            "'-NoProfile','-Command','Restart-Service -Name LinkPadAgent'"
        )
        try:
            subprocess.Popen(
                [
                    "powershell.exe",
                    "-NoProfile",
                    "-WindowStyle",
                    "Hidden",
                    "-Command",
                    command,
                ],
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        except Exception as exc:
            QMessageBox.warning(
                None, "LinkPad Agent", f"Não foi possível reiniciar: {exc}"
            )

    def quit(self) -> None:
        self.shutdown()
        self._app.quit()

    def shutdown(self) -> None:
        self._timer.stop()
        self._tray.hide()


def _create_application() -> QApplication:
    app = QApplication(sys.argv)
    app.setApplicationName("LinkPad Agent")
    app.setQuitOnLastWindowClosed(False)
    return app


def main() -> None:
    app = _create_application()
    if not QSystemTrayIcon.isSystemTrayAvailable():
        QMessageBox.critical(
            None, "LinkPad Agent", "A bandeja do sistema não está disponível."
        )
        raise SystemExit(1)

    lock = acquire_tray_lock()
    if lock is None:
        QMessageBox.information(
            None, "LinkPad Agent", "O ícone do LinkPad Agent já está em execução."
        )
        raise SystemExit(0)

    config, paths = load_config()
    tray = LinkPadTray(app, config, paths)
    try:
        exit_code = app.exec()
    finally:
        tray.shutdown()
        lock.unlock()
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
