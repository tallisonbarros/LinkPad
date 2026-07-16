from __future__ import annotations

import asyncio
import logging
import threading

import uvicorn

from linkpad_agent.api.management import create_management_app
from linkpad_agent.api.public import create_public_app
from linkpad_agent.config import AgentConfig
from linkpad_agent.runtime.agent import AgentRuntime


class AgentHost:
    def __init__(self, config: AgentConfig):
        self.config = config
        self.runtime = AgentRuntime(config)
        self._thread: threading.Thread | None = None
        self._ready = threading.Event()
        self._stopped = threading.Event()
        self._public_server: uvicorn.Server | None = None
        self._management_server: uvicorn.Server | None = None
        self._failure: BaseException | None = None

    def start(self, timeout: float = 10) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._ready.clear()
        self._stopped.clear()
        self._failure = None
        self._thread = threading.Thread(
            target=self._thread_main,
            name="LinkPadAgentHost",
            daemon=True,
        )
        self._thread.start()
        if not self._ready.wait(timeout):
            raise RuntimeError("Tempo excedido ao iniciar o LinkPad Agent.")
        if self._failure is not None:
            raise RuntimeError("Falha ao iniciar o LinkPad Agent.") from self._failure

    def stop(self, timeout: float = 15) -> None:
        if self._public_server is not None:
            self._public_server.should_exit = True
        if self._management_server is not None:
            self._management_server.should_exit = True
        if self._thread is not None:
            self._thread.join(timeout)
        self._thread = None

    def wait(self, timeout: float | None = None) -> bool:
        return self._stopped.wait(timeout)

    def _thread_main(self) -> None:
        try:
            asyncio.run(self._serve())
        except BaseException as exc:
            self._failure = exc
            logging.getLogger("linkpad_agent").exception("Falha no host do Agent")
            self._ready.set()
        finally:
            self._stopped.set()

    async def _serve(self) -> None:
        public_app = create_public_app(self.runtime, self.config)
        management_app = create_management_app(self.runtime)
        public_config = uvicorn.Config(
            public_app,
            host=self.config.server.bind,
            port=self.config.server.port,
            log_config=None,
            access_log=False,
        )
        management_config = uvicorn.Config(
            management_app,
            host=self.config.management.bind,
            port=self.config.management.port,
            log_config=None,
            access_log=False,
        )
        self._public_server = uvicorn.Server(public_config)
        self._management_server = uvicorn.Server(management_config)
        await self.runtime.start()
        tasks = [
            asyncio.create_task(self._public_server.serve(), name="linkpad-public-api"),
            asyncio.create_task(
                self._management_server.serve(), name="linkpad-management-api"
            ),
        ]
        try:
            while not (self._public_server.started and self._management_server.started):
                for task in tasks:
                    if task.done():
                        task.result()
                await asyncio.sleep(0.01)
            self._ready.set()
            await asyncio.gather(*tasks)
        finally:
            for task in tasks:
                if not task.done():
                    task.cancel()
            await self.runtime.stop()
