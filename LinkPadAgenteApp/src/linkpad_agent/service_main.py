from __future__ import annotations

import sys

from linkpad_agent.config import load_config
from linkpad_agent.host import AgentHost
from linkpad_agent.logging_setup import configure_logging


SERVICE_NAME = "LinkPadAgent"
SERVICE_DISPLAY_NAME = "LinkPad Agent Gateway"
SERVICE_DESCRIPTION = "Gateway HTTP/JSON para devices LinkPad e protocolos industriais."


def _build_host() -> AgentHost:
    config, paths = load_config()
    configure_logging(config.logging, paths.log_dir)
    return AgentHost(config)


def console_main() -> None:
    host = _build_host()
    host.start()
    print(
        f"LinkPad Agent pronto em http://{host.config.server.bind}:"
        f"{host.config.server.port}/lpp/v1/status"
    )
    try:
        while not host.wait(0.5):
            pass
    except KeyboardInterrupt:
        host.stop()


def windows_service_main() -> None:
    try:
        import servicemanager
        import win32event
        import win32service
        import win32serviceutil
    except ImportError as exc:
        raise RuntimeError(
            "pywin32 é necessário para executar como serviço Windows."
        ) from exc

    class LinkPadAgentService(win32serviceutil.ServiceFramework):
        _svc_name_ = SERVICE_NAME
        _svc_display_name_ = SERVICE_DISPLAY_NAME
        _svc_description_ = SERVICE_DESCRIPTION

        def __init__(self, args):
            super().__init__(args)
            self._stop_event = win32event.CreateEvent(None, 0, 0, None)
            self._host: AgentHost | None = None

        def SvcStop(self):
            self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
            if self._host is not None:
                self._host.stop()
            win32event.SetEvent(self._stop_event)

        def SvcDoRun(self):
            servicemanager.LogInfoMsg(f"{SERVICE_DISPLAY_NAME} iniciando")
            self._host = _build_host()
            self._host.start()
            win32event.WaitForSingleObject(self._stop_event, win32event.INFINITE)
            servicemanager.LogInfoMsg(f"{SERVICE_DISPLAY_NAME} encerrado")

    if len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(LinkPadAgentService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(LinkPadAgentService)


def main() -> None:
    if "--console" in sys.argv or not getattr(sys, "frozen", False):
        console_main()
    else:
        windows_service_main()


if __name__ == "__main__":
    main()
