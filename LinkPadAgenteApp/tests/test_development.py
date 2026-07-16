from __future__ import annotations

import gc
from pathlib import Path

from PySide6.QtWidgets import QApplication

from linkpad_agent.config import AgentConfig, AppPaths
from linkpad_agent.dev_main import development_paths
from linkpad_agent.tray_main import LinkPadTray, acquire_tray_lock


def test_development_uses_project_local_data_directory(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("LINKPAD_AGENT_CONFIG", raising=False)

    paths = development_paths(tmp_path)

    assert paths.data_dir == tmp_path / ".dev"
    assert paths.config_file == tmp_path / ".dev" / "config.json"
    assert paths.log_dir == tmp_path / ".dev" / "logs"


def test_development_respects_config_environment_variable(tmp_path: Path, monkeypatch):
    config_file = tmp_path / "custom" / "agent.json"
    monkeypatch.setenv("LINKPAD_AGENT_CONFIG", str(config_file))

    paths = development_paths(tmp_path / "ignored")

    assert paths.config_file == config_file.resolve()
    assert paths.data_dir == config_file.parent.resolve()


def test_tray_allows_only_one_instance(tmp_path: Path):
    lock_path = tmp_path / "tray.lock"
    first = acquire_tray_lock(lock_path)
    assert first is not None
    try:
        assert acquire_tray_lock(lock_path) is None
    finally:
        first.unlock()

    after_close = acquire_tray_lock(lock_path)
    assert after_close is not None
    after_close.unlock()


def test_development_tray_keeps_menu_actions_alive_after_garbage_collection(
    tmp_path: Path, monkeypatch
):
    class ManagementResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"sessions": 0, "warnings": []}

    monkeypatch.setattr(
        "linkpad_agent.tray_main.httpx.get", lambda *args, **kwargs: ManagementResponse()
    )
    app = QApplication.instance() or QApplication([])
    paths = AppPaths(
        data_dir=tmp_path,
        config_file=tmp_path / "config.json",
        log_dir=tmp_path / "logs",
    )
    tray = LinkPadTray(app, AgentConfig(), paths, development=True)
    try:
        gc.collect()
        labels = [action.text() for action in tray._menu.actions()]

        assert "MODO DESENVOLVIMENTO · API e bandeja juntas" in labels
        assert "Abrir configuração" in labels
        assert "Abrir pasta de logs" in labels
        assert "Encerrar Agent de desenvolvimento" in labels
    finally:
        tray.shutdown()
