from __future__ import annotations

import ipaddress

from linkpad_agent.config import SecurityConfig
from linkpad_agent.drivers.base import IndustrialDriver
from linkpad_agent.protocol.errors import ProtocolError
from linkpad_agent.protocol.models import TargetDescriptor

_PRIVATE_IPV4_NETWORKS = tuple(
    ipaddress.ip_network(cidr) for cidr in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")
)


class TargetPolicy:
    def __init__(self, config: SecurityConfig):
        self._config = config

    def validate_device(self, device_id: str) -> None:
        whitelist = self._config.device_whitelist
        if whitelist and device_id not in whitelist:
            raise ProtocolError(
                403,
                "device_not_allowed",
                f"O device '{device_id}' não está autorizado.",
            )

    def validate_driver(self, target: TargetDescriptor) -> None:
        if target.driver not in self._config.allowed_drivers:
            raise ProtocolError(
                403,
                "driver_not_allowed",
                f"O driver '{target.driver}' não está permitido na configuração local.",
            )

    def validate_target(
        self, target: TargetDescriptor, driver: IndustrialDriver
    ) -> None:
        self.validate_driver(target)

        endpoint = driver.network_endpoint(target)
        if endpoint is None:
            return

        host, _ = endpoint
        try:
            address = ipaddress.ip_address(host)
        except ValueError as exc:
            raise ProtocolError(
                422,
                "target_ip_required",
                "O destino industrial deve usar um endereço IP literal.",
            ) from exc

        if (
            address.version != 4
            or address.is_loopback
            or address.is_link_local
            or address.is_multicast
            or address.is_unspecified
            or address.is_reserved
        ):
            raise ProtocolError(
                403,
                "target_network_not_allowed",
                f"O destino '{host}' não pertence a uma rede industrial permitida.",
            )

        for rule in self._config.allowed_target_networks:
            normalized = rule.strip().lower()
            if normalized == "private" and any(
                address in network for network in _PRIVATE_IPV4_NETWORKS
            ):
                return
            # Lido por compatibilidade com 0.2.0; regras novas devem usar CIDR.
            if normalized == "same-subnet":
                continue
            try:
                if address in ipaddress.ip_network(rule, strict=False):
                    return
            except ValueError:
                continue

        raise ProtocolError(
            403,
            "target_network_not_allowed",
            f"O destino '{host}' não pertence a allowedTargetNetworks.",
        )
