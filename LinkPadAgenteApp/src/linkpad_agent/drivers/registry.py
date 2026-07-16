from __future__ import annotations

from linkpad_agent.drivers.base import IndustrialDriver
from linkpad_agent.protocol.errors import ProtocolError


class DriverRegistry:
    def __init__(self) -> None:
        self._drivers: dict[str, IndustrialDriver] = {}

    def register(self, driver: IndustrialDriver) -> None:
        self._drivers[driver.id] = driver

    def get(self, driver_id: str) -> IndustrialDriver:
        driver = self._drivers.get(driver_id)
        if driver is None:
            raise ProtocolError(
                422,
                "driver_not_supported",
                f"O driver '{driver_id}' não está disponível nesta versão.",
            )
        return driver

    def capabilities(self) -> list[dict]:
        return [driver.capability() for driver in self._drivers.values()]

    def ids(self) -> list[str]:
        return list(self._drivers)
