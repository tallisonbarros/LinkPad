from __future__ import annotations

import asyncio
import ipaddress
import math
import struct
from dataclasses import dataclass, field
from typing import Any, Callable
from urllib.parse import urlparse

from snap7 import Client
from snap7.type import Parameter

from linkpad_agent.drivers.base import DriverError, DriverValue, IndustrialDriver
from linkpad_agent.protocol.errors import ProtocolError
from linkpad_agent.protocol.models import TargetDescriptor


_DATA_TYPES: dict[str, tuple[str | None, int]] = {
    "BOOL": (None, 1),
    "INT": (">h", 2),
    "DINT": (">i", 4),
    "REAL": (">f", 4),
}

_LOGICAL_TYPES: dict[str, set[str]] = {
    "BOOL": {"bool", "boolean"},
    "INT": {"int", "integer"},
    "DINT": {"int", "integer"},
    "REAL": {"float", "number", "real"},
}


@dataclass(frozen=True, slots=True)
class S7Target:
    host: str
    port: int
    rack: int
    slot: int
    timeout_ms: int


@dataclass(frozen=True, slots=True)
class S7Address:
    db_number: int
    byte_offset: int
    bit_offset: int | None
    data_type: str

    @property
    def size(self) -> int:
        return _DATA_TYPES[self.data_type][1]


@dataclass(slots=True)
class S7Connection:
    target: S7Target
    client: Any
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class SiemensS7Driver(IndustrialDriver):
    id = "siemens-s7"
    display_name = "Siemens S7 nativo"

    def __init__(self, client_factory: Callable[[], Any] = Client) -> None:
        self._client_factory = client_factory

    def validate_target(self, target: TargetDescriptor) -> None:
        self._parse_target(target)

    def network_endpoint(self, target: TargetDescriptor) -> tuple[str, int]:
        parsed = self._parse_target(target)
        return parsed.host, parsed.port

    async def connect(self, target: TargetDescriptor) -> S7Connection:
        parsed = self._parse_target(target)
        client = self._new_client(parsed)
        try:
            await self._connect_client(client, parsed)
        except Exception as exc:
            self._safe_disconnect(client)
            raise DriverError(
                "target_offline",
                f"Não foi possível conectar ao PLC S7 em {parsed.host}:102: {exc}",
                quality="offline",
                retryable=True,
            ) from exc
        return S7Connection(target=parsed, client=client)

    async def disconnect(self, connection: S7Connection) -> None:
        async with connection.lock:
            try:
                await asyncio.to_thread(connection.client.disconnect)
            except Exception:
                return

    async def read(
        self,
        connection: S7Connection,
        point_id: str,
        protocol: dict[str, Any],
        declared_type: str | None = None,
    ) -> DriverValue:
        address = self._parse_address(protocol)
        self._validate_declared_type(address, declared_type)
        async with connection.lock:
            raw = await self._read_with_one_reconnect(connection, address)
        return DriverValue(self._decode(address, raw))

    async def write(
        self,
        connection: S7Connection,
        point_id: str,
        protocol: dict[str, Any],
        value: Any,
        declared_type: str | None = None,
    ) -> DriverValue:
        address = self._parse_address(protocol)
        self._validate_declared_type(address, declared_type)
        async with connection.lock:
            try:
                if address.data_type == "BOOL":
                    current = await self._call(
                        connection,
                        connection.client.db_read,
                        address.db_number,
                        address.byte_offset,
                        1,
                    )
                    payload = self._encode(address, value, bytearray(current))
                else:
                    payload = self._encode(address, value)

                await self._call(
                    connection,
                    connection.client.db_write,
                    address.db_number,
                    address.byte_offset,
                    payload,
                )
                confirmed = await self._call(
                    connection,
                    connection.client.db_read,
                    address.db_number,
                    address.byte_offset,
                    address.size,
                )
            except DriverError:
                raise
            except Exception as exc:
                # Uma escrita com falha de transporte pode ter chegado ao PLC.
                # Não a repetimos automaticamente: a leitura de confirmação decide.
                raise DriverError(
                    "write_confirmation_failed",
                    f"Não foi possível confirmar a escrita S7: {exc}",
                    quality="uncertain",
                    retryable=False,
                ) from exc
        return DriverValue(self._decode(address, confirmed))

    def capability(self) -> dict[str, Any]:
        capability = super().capability()
        capability.update(
            {
                "addressSchemaVersion": "0.2.0",
                "target": {
                    "endpointScheme": "s7",
                    "defaultPort": 102,
                    "options": ["rack", "slot", "timeoutMs"],
                },
                "point": {
                    "areas": ["DB"],
                    "dataTypes": list(_DATA_TYPES),
                    "fields": [
                        "area",
                        "dbNumber",
                        "byteOffset",
                        "bitOffset",
                        "dataType",
                    ],
                },
            }
        )
        return capability

    def _new_client(self, target: S7Target) -> Any:
        client = self._client_factory()
        if hasattr(client, "set_param"):
            client.set_param(Parameter.SendTimeout, target.timeout_ms)
            client.set_param(Parameter.RecvTimeout, target.timeout_ms)
            client.set_param(Parameter.PingTimeout, target.timeout_ms)
        return client

    @staticmethod
    async def _connect_client(client: Any, target: S7Target) -> None:
        await SiemensS7Driver._thread_with_timeout(
            client.connect,
            target.host,
            target.rack,
            target.slot,
            tcp_port=target.port,
            timeout_seconds=target.timeout_ms / 1000,
        )
        # python-snap7 3.0.0 mantem os parametros legados apenas em memoria.
        # Aplicamos tambem o timeout no socket puro criado durante connect().
        transport = getattr(client, "connection", None)
        if transport is not None:
            transport.timeout = target.timeout_ms / 1000
            socket = getattr(transport, "socket", None)
            if socket is not None:
                socket.settimeout(target.timeout_ms / 1000)

    async def _read_with_one_reconnect(
        self, connection: S7Connection, address: S7Address
    ) -> bytearray:
        try:
            return await self._call(
                connection,
                connection.client.db_read,
                address.db_number,
                address.byte_offset,
                address.size,
            )
        except Exception:
            self._safe_disconnect(connection.client)
            replacement = self._new_client(connection.target)
            try:
                await self._connect_client(replacement, connection.target)
                connection.client = replacement
                return await self._call(
                    connection,
                    replacement.db_read,
                    address.db_number,
                    address.byte_offset,
                    address.size,
                )
            except Exception as exc:
                self._safe_disconnect(replacement)
                raise DriverError(
                    "target_offline",
                    f"PLC S7 indisponível durante a leitura: {exc}",
                    quality="offline",
                    retryable=True,
                ) from exc

    @staticmethod
    async def _call(connection: S7Connection, function: Callable, *args: Any) -> Any:
        return await SiemensS7Driver._thread_with_timeout(
            function,
            *args,
            timeout_seconds=connection.target.timeout_ms / 1000,
        )

    @staticmethod
    async def _thread_with_timeout(
        function: Callable,
        *args: Any,
        timeout_seconds: float,
        **kwargs: Any,
    ) -> Any:
        operation = asyncio.create_task(asyncio.to_thread(function, *args, **kwargs))
        try:
            return await asyncio.wait_for(
                asyncio.shield(operation), timeout=timeout_seconds
            )
        except BaseException:
            # Threads Python nao podem ser canceladas. Manter o lock do chamador
            # ate o termino evita duas operacoes simultaneas no mesmo cliente.
            try:
                await asyncio.shield(operation)
            except BaseException:
                pass
            raise

    @staticmethod
    def _safe_disconnect(client: Any) -> None:
        try:
            client.disconnect()
        except Exception:
            pass

    @staticmethod
    def _parse_target(target: TargetDescriptor) -> S7Target:
        if target.driver != "siemens-s7":
            raise ProtocolError(422, "invalid_target", "Driver S7 inválido.")
        if target.auth:
            raise ProtocolError(
                422,
                "invalid_target_auth",
                "O conector S7 nativo MVP não aceita credenciais no target.",
            )

        parsed = urlparse(target.endpoint)
        if (
            parsed.scheme.lower() != "s7"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path not in ("", "/")
            or parsed.query
            or parsed.fragment
        ):
            raise ProtocolError(
                422,
                "invalid_target",
                "Use endpoint S7 no formato s7://192.168.0.10:102.",
            )
        try:
            host = str(ipaddress.IPv4Address(parsed.hostname))
            port = parsed.port or 102
        except (ValueError, TypeError) as exc:
            raise ProtocolError(
                422,
                "invalid_target",
                "O endpoint S7 requer um IPv4 literal e porta válida.",
            ) from exc
        if port != 102:
            raise ProtocolError(
                422,
                "invalid_target_port",
                "O conector S7 nativo MVP permite somente a porta TCP 102.",
            )

        allowed_options = {"rack", "slot", "timeoutMs"}
        unknown = set(target.options) - allowed_options
        if unknown:
            raise ProtocolError(
                422,
                "invalid_target_options",
                f"Opções S7 desconhecidas: {', '.join(sorted(unknown))}.",
            )
        rack = SiemensS7Driver._bounded_int(target.options, "rack", 0, 0, 7)
        slot = SiemensS7Driver._bounded_int(target.options, "slot", 1, 0, 31)
        timeout_ms = SiemensS7Driver._bounded_int(
            target.options, "timeoutMs", 2000, 100, 30000
        )
        return S7Target(host, port, rack, slot, timeout_ms)

    @staticmethod
    def _parse_address(protocol: dict[str, Any]) -> S7Address:
        allowed = {"area", "dbNumber", "byteOffset", "bitOffset", "dataType"}
        unknown = set(protocol) - allowed
        if unknown:
            raise DriverError(
                "invalid_address",
                f"Campos S7 desconhecidos: {', '.join(sorted(unknown))}.",
            )
        if str(protocol.get("area", "")).upper() != "DB":
            raise DriverError(
                "invalid_address", "O MVP S7 aceita somente a área DB."
            )
        data_type = str(protocol.get("dataType", "")).upper()
        if data_type not in _DATA_TYPES:
            raise DriverError(
                "invalid_address",
                "dataType deve ser BOOL, INT, DINT ou REAL.",
            )
        db_number = SiemensS7Driver._address_int(protocol, "dbNumber", 1, 65535)
        byte_offset = SiemensS7Driver._address_int(
            protocol, "byteOffset", 0, 2_147_483_647
        )
        bit_offset: int | None = None
        if data_type == "BOOL":
            bit_offset = SiemensS7Driver._address_int(protocol, "bitOffset", 0, 7)
        elif "bitOffset" in protocol:
            raise DriverError(
                "invalid_address", "bitOffset é permitido somente para BOOL."
            )
        return S7Address(db_number, byte_offset, bit_offset, data_type)

    @staticmethod
    def _bounded_int(
        values: dict[str, Any], key: str, default: int, minimum: int, maximum: int
    ) -> int:
        value = values.get(key, default)
        if isinstance(value, bool) or not isinstance(value, int):
            raise ProtocolError(422, "invalid_target_options", f"{key} deve ser inteiro.")
        if not minimum <= value <= maximum:
            raise ProtocolError(
                422,
                "invalid_target_options",
                f"{key} deve estar entre {minimum} e {maximum}.",
            )
        return value

    @staticmethod
    def _address_int(
        values: dict[str, Any], key: str, minimum: int, maximum: int
    ) -> int:
        value = values.get(key)
        if isinstance(value, bool) or not isinstance(value, int):
            raise DriverError("invalid_address", f"{key} deve ser inteiro.")
        if not minimum <= value <= maximum:
            raise DriverError(
                "invalid_address", f"{key} deve estar entre {minimum} e {maximum}."
            )
        return value

    @staticmethod
    def _validate_declared_type(
        address: S7Address, declared_type: str | None
    ) -> None:
        if not declared_type:
            return
        normalized = declared_type.strip().lower()
        if normalized not in _LOGICAL_TYPES[address.data_type]:
            raise DriverError(
                "type_mismatch",
                f"A tag '{declared_type}' não é compatível com {address.data_type}.",
            )

    @staticmethod
    def _decode(address: S7Address, raw: bytes | bytearray) -> Any:
        if len(raw) != address.size:
            raise DriverError(
                "invalid_plc_response", "O PLC devolveu um tamanho de dado inesperado."
            )
        if address.data_type == "BOOL":
            assert address.bit_offset is not None
            return bool(raw[0] & (1 << address.bit_offset))
        format_code = _DATA_TYPES[address.data_type][0]
        assert format_code is not None
        return struct.unpack(format_code, bytes(raw))[0]

    @staticmethod
    def _encode(
        address: S7Address, value: Any, current: bytearray | None = None
    ) -> bytearray:
        if address.data_type == "BOOL":
            if not isinstance(value, bool):
                raise DriverError("invalid_value", "BOOL requer true ou false.")
            assert current is not None and address.bit_offset is not None
            mask = 1 << address.bit_offset
            current[0] = current[0] | mask if value else current[0] & ~mask
            return current

        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise DriverError(
                "invalid_value", f"{address.data_type} requer um valor numérico."
            )
        if address.data_type in {"INT", "DINT"} and not isinstance(value, int):
            raise DriverError(
                "invalid_value", f"{address.data_type} requer um número inteiro."
            )
        if address.data_type == "REAL":
            value = float(value)
            if not math.isfinite(value):
                raise DriverError("invalid_value", "REAL deve ser finito.")
        format_code = _DATA_TYPES[address.data_type][0]
        assert format_code is not None
        try:
            return bytearray(struct.pack(format_code, value))
        except (OverflowError, struct.error) as exc:
            raise DriverError(
                "value_out_of_range",
                f"Valor fora da faixa de {address.data_type}.",
            ) from exc
