from __future__ import annotations

import asyncio
import ipaddress
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable
from urllib.parse import urlparse

from asyncua import Client, ua
from asyncua.ua.uaerrors import UaError, UaStatusCodeError

from linkpad_agent.drivers.base import DriverError, DriverValue, IndustrialDriver
from linkpad_agent.protocol.errors import ProtocolError
from linkpad_agent.protocol.models import TargetDescriptor


_LOGICAL_TYPES: dict[ua.VariantType, str] = {
    ua.VariantType.Boolean: "bool",
    ua.VariantType.SByte: "int",
    ua.VariantType.Byte: "int",
    ua.VariantType.Int16: "int",
    ua.VariantType.UInt16: "int",
    ua.VariantType.Int32: "int",
    ua.VariantType.UInt32: "int",
    ua.VariantType.Int64: "int",
    ua.VariantType.UInt64: "int",
    ua.VariantType.Float: "float",
    ua.VariantType.Double: "float",
    ua.VariantType.String: "string",
}

_INTEGER_RANGES: dict[ua.VariantType, tuple[int, int]] = {
    ua.VariantType.SByte: (-128, 127),
    ua.VariantType.Byte: (0, 255),
    ua.VariantType.Int16: (-32_768, 32_767),
    ua.VariantType.UInt16: (0, 65_535),
    ua.VariantType.Int32: (-2_147_483_648, 2_147_483_647),
    ua.VariantType.UInt32: (0, 4_294_967_295),
    ua.VariantType.Int64: (-9_223_372_036_854_775_808, 9_223_372_036_854_775_807),
    ua.VariantType.UInt64: (0, 18_446_744_073_709_551_615),
}


@dataclass(frozen=True, slots=True)
class OpcUaTarget:
    endpoint: str
    host: str
    port: int
    session_timeout_ms: int
    request_timeout_ms: int


@dataclass(slots=True)
class OpcUaConnection:
    target: OpcUaTarget
    client: Any
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    nodes: dict[str, Any] = field(default_factory=dict)
    variant_types: dict[str, ua.VariantType] = field(default_factory=dict)


class OpcUaDriver(IndustrialDriver):
    id = "opcua"
    display_name = "OPC UA"

    def __init__(
        self,
        client_factory: Callable[[OpcUaTarget], Any] | None = None,
    ) -> None:
        self._client_factory = client_factory or self._new_asyncua_client

    def validate_target(self, target: TargetDescriptor) -> None:
        self._parse_target(target)

    def network_endpoint(self, target: TargetDescriptor) -> tuple[str, int]:
        parsed = self._parse_target(target)
        return parsed.host, parsed.port

    async def connect(self, target: TargetDescriptor) -> OpcUaConnection:
        parsed = self._parse_target(target)
        client = self._client_factory(parsed)
        try:
            await asyncio.wait_for(
                client.connect(), timeout=parsed.request_timeout_ms / 1000
            )
        except Exception as exc:
            await self._safe_disconnect(client)
            raise DriverError(
                "target_offline",
                f"Não foi possível abrir a sessão OPC UA em {parsed.endpoint}: {exc}",
                quality="offline",
                retryable=True,
            ) from exc
        return OpcUaConnection(target=parsed, client=client)

    async def disconnect(self, connection: OpcUaConnection) -> None:
        async with connection.lock:
            await self._safe_disconnect(connection.client)

    async def read(
        self,
        connection: OpcUaConnection,
        point_id: str,
        protocol: dict[str, Any],
        declared_type: str | None = None,
    ) -> DriverValue:
        node_id = self._parse_address(protocol)
        async with connection.lock:
            try:
                return await self._read_once(connection, node_id, declared_type)
            except DriverError:
                raise
            except Exception as first_error:
                if not self._is_reconnectable(first_error):
                    raise self._driver_error(first_error, "read") from first_error
                try:
                    await self._reconnect(connection)
                    return await self._read_once(connection, node_id, declared_type)
                except DriverError:
                    raise
                except Exception as exc:
                    raise DriverError(
                        "target_offline",
                        f"Servidor OPC UA indisponível durante a leitura: {exc}",
                        quality="offline",
                        retryable=True,
                    ) from exc

    async def write(
        self,
        connection: OpcUaConnection,
        point_id: str,
        protocol: dict[str, Any],
        value: Any,
        declared_type: str | None = None,
    ) -> DriverValue:
        node_id = self._parse_address(protocol)
        async with connection.lock:
            try:
                node = await self._node(connection, node_id)
                variant_type = connection.variant_types.get(node_id)
                if variant_type is None:
                    variant_type = await asyncio.wait_for(
                        node.read_data_type_as_variant_type(),
                        timeout=connection.target.request_timeout_ms / 1000,
                    )
                    connection.variant_types[node_id] = variant_type
                self._validate_declared_type(variant_type, declared_type)
                encoded = self._encode_value(value, variant_type)
                await asyncio.wait_for(
                    node.write_value(encoded, variant_type),
                    timeout=connection.target.request_timeout_ms / 1000,
                )
                confirmed = await self._read_data_value(connection, node)
                return self._driver_value(confirmed, variant_type, declared_type)
            except DriverError:
                raise
            except UaStatusCodeError as exc:
                error = self._driver_error(exc, "write")
                if error.code in {"access_denied", "node_not_found", "type_mismatch"}:
                    raise error from exc
                raise DriverError(
                    "write_confirmation_failed",
                    f"Não foi possível confirmar a escrita OPC UA: {exc}",
                    quality="uncertain",
                    retryable=False,
                ) from exc
            except Exception as exc:
                raise DriverError(
                    "write_confirmation_failed",
                    f"Não foi possível confirmar a escrita OPC UA: {exc}",
                    quality="uncertain",
                    retryable=False,
                ) from exc

    def capability(self) -> dict[str, Any]:
        capability = super().capability()
        capability.update(
            {
                "target": {
                    "endpointScheme": "opc.tcp",
                    "defaultPort": 4840,
                    "options": [
                        "securityPolicy",
                        "securityMode",
                        "sessionTimeoutMs",
                        "requestTimeoutMs",
                    ],
                    "securityPolicies": ["None"],
                    "securityModes": ["None"],
                    "authModes": ["anonymous"],
                },
                "point": {
                    "fields": ["nodeId"],
                    "dataTypes": [
                        "Boolean",
                        "SByte",
                        "Byte",
                        "Int16",
                        "UInt16",
                        "Int32",
                        "UInt32",
                        "Int64",
                        "UInt64",
                        "Float",
                        "Double",
                        "String",
                    ],
                },
            }
        )
        return capability

    @staticmethod
    def _new_asyncua_client(target: OpcUaTarget) -> Client:
        client = Client(
            url=target.endpoint,
            timeout=target.request_timeout_ms / 1000,
            auto_reconnect=False,
        )
        client.session_timeout = target.session_timeout_ms
        return client

    async def _read_once(
        self,
        connection: OpcUaConnection,
        node_id: str,
        declared_type: str | None,
    ) -> DriverValue:
        node = await self._node(connection, node_id)
        data_value = await self._read_data_value(connection, node)
        variant = data_value.Value
        if variant is None:
            raise DriverError(
                "invalid_server_value",
                "O servidor OPC UA não devolveu um valor.",
            )
        variant_type = variant.VariantType
        connection.variant_types[node_id] = variant_type
        return self._driver_value(data_value, variant_type, declared_type)

    async def _read_data_value(self, connection: OpcUaConnection, node: Any) -> Any:
        return await asyncio.wait_for(
            node.read_data_value(raise_on_bad_status=False),
            timeout=connection.target.request_timeout_ms / 1000,
        )

    async def _node(self, connection: OpcUaConnection, node_id: str) -> Any:
        cached = connection.nodes.get(node_id)
        if cached is not None:
            return cached
        parsed = ua.NodeId.from_string(node_id)
        namespace_uri = getattr(parsed, "NamespaceUri", None)
        if namespace_uri:
            namespace_index = await asyncio.wait_for(
                connection.client.get_namespace_index(namespace_uri),
                timeout=connection.target.request_timeout_ms / 1000,
            )
            parsed = ua.NodeId(parsed.Identifier, namespace_index, parsed.NodeIdType)
        node = connection.client.get_node(parsed)
        connection.nodes[node_id] = node
        return node

    async def _reconnect(self, connection: OpcUaConnection) -> None:
        replacement = self._client_factory(connection.target)
        try:
            await asyncio.wait_for(
                replacement.connect(),
                timeout=connection.target.request_timeout_ms / 1000,
            )
        except Exception:
            await self._safe_disconnect(replacement)
            raise
        previous = connection.client
        connection.client = replacement
        connection.nodes.clear()
        connection.variant_types.clear()
        await self._safe_disconnect(previous)

    @staticmethod
    async def _safe_disconnect(client: Any) -> None:
        try:
            await client.disconnect()
        except Exception:
            return

    @staticmethod
    def _driver_value(
        data_value: Any,
        variant_type: ua.VariantType,
        declared_type: str | None,
    ) -> DriverValue:
        status = data_value.StatusCode or ua.StatusCode()
        if status.is_bad():
            raise OpcUaDriver._status_error(status)
        variant = data_value.Value
        if variant is None or variant.Value is None or bool(variant.is_array):
            raise DriverError(
                "unsupported_value",
                "O MVP OPC UA aceita somente valores escalares não nulos.",
            )
        OpcUaDriver._validate_declared_type(variant_type, declared_type)
        timestamp = data_value.SourceTimestamp or data_value.ServerTimestamp
        return DriverValue(
            variant.Value,
            quality="uncertain" if status.is_uncertain() else "good",
            timestamp=OpcUaDriver._timestamp(timestamp),
        )

    @staticmethod
    def _validate_declared_type(
        variant_type: ua.VariantType, declared_type: str | None
    ) -> None:
        logical_type = _LOGICAL_TYPES.get(variant_type)
        if logical_type is None:
            raise DriverError(
                "unsupported_type",
                f"O tipo OPC UA {variant_type.name} ainda não é suportado pelo LinkPad.",
            )
        if declared_type and declared_type.strip().lower() != logical_type:
            raise DriverError(
                "type_mismatch",
                f"O ponto declarado como '{declared_type}' não é compatível com {variant_type.name}.",
            )

    @staticmethod
    def _encode_value(value: Any, variant_type: ua.VariantType) -> Any:
        if variant_type == ua.VariantType.Boolean:
            if not isinstance(value, bool):
                raise DriverError("invalid_value", "Boolean requer true ou false.")
            return value
        if variant_type in _INTEGER_RANGES:
            if isinstance(value, bool) or not isinstance(value, int):
                raise DriverError(
                    "invalid_value", f"{variant_type.name} requer um número inteiro."
                )
            minimum, maximum = _INTEGER_RANGES[variant_type]
            if not minimum <= value <= maximum:
                raise DriverError(
                    "value_out_of_range",
                    f"Valor fora da faixa de {variant_type.name}.",
                )
            return value
        if variant_type in {ua.VariantType.Float, ua.VariantType.Double}:
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise DriverError(
                    "invalid_value", f"{variant_type.name} requer um valor numérico."
                )
            numeric = float(value)
            if not math.isfinite(numeric):
                raise DriverError("invalid_value", "O valor numérico deve ser finito.")
            return numeric
        if variant_type == ua.VariantType.String:
            if not isinstance(value, str):
                raise DriverError("invalid_value", "String requer um texto.")
            return value
        raise DriverError(
            "unsupported_type",
            f"O tipo OPC UA {variant_type.name} ainda não é suportado pelo LinkPad.",
        )

    @staticmethod
    def _parse_target(target: TargetDescriptor) -> OpcUaTarget:
        if target.driver != "opcua":
            raise ProtocolError(422, "invalid_target", "Driver OPC UA inválido.")
        auth = target.auth or {"mode": "anonymous"}
        if set(auth) - {"mode"} or str(auth.get("mode", "anonymous")).lower() != "anonymous":
            raise ProtocolError(
                422,
                "unsupported_auth",
                "O MVP OPC UA aceita somente autenticação anônima.",
            )
        allowed_options = {
            "securityPolicy",
            "securityMode",
            "sessionTimeoutMs",
            "requestTimeoutMs",
        }
        unknown = set(target.options) - allowed_options
        if unknown:
            raise ProtocolError(
                422,
                "invalid_target_options",
                f"Opções OPC UA desconhecidas: {', '.join(sorted(unknown))}.",
            )
        security_policy = str(target.options.get("securityPolicy", "None"))
        security_mode = str(target.options.get("securityMode", "None"))
        if security_policy.lower() not in {"none", "nosecurity"} or security_mode.lower() != "none":
            raise ProtocolError(
                422,
                "unsupported_security",
                "O MVP OPC UA aceita somente SecurityPolicy None e SecurityMode None.",
            )

        parsed = urlparse(target.endpoint)
        if (
            parsed.scheme.lower() != "opc.tcp"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            raise ProtocolError(
                422,
                "invalid_target",
                "Use endpoint OPC UA no formato opc.tcp://192.168.0.10:4840.",
            )
        try:
            host = str(ipaddress.IPv4Address(parsed.hostname))
            port = parsed.port or 4840
        except (ValueError, TypeError) as exc:
            raise ProtocolError(
                422,
                "invalid_target",
                "O endpoint OPC UA requer um IPv4 literal e porta válida.",
            ) from exc
        if port != 4840:
            raise ProtocolError(
                422,
                "invalid_target_port",
                "O conector OPC UA MVP permite somente a porta TCP 4840.",
            )
        session_timeout_ms = OpcUaDriver._bounded_int(
            target.options, "sessionTimeoutMs", 30_000, 1_000, 3_600_000
        )
        request_timeout_ms = OpcUaDriver._bounded_int(
            target.options, "requestTimeoutMs", 2_000, 100, 30_000
        )
        return OpcUaTarget(
            endpoint=target.endpoint,
            host=host,
            port=port,
            session_timeout_ms=session_timeout_ms,
            request_timeout_ms=request_timeout_ms,
        )

    @staticmethod
    def _parse_address(protocol: dict[str, Any]) -> str:
        unknown = set(protocol) - {"nodeId"}
        if unknown:
            raise DriverError(
                "invalid_address",
                f"Campos OPC UA desconhecidos: {', '.join(sorted(unknown))}.",
            )
        node_id = protocol.get("nodeId")
        if not isinstance(node_id, str) or not node_id.strip() or len(node_id) > 1024:
            raise DriverError(
                "invalid_address",
                "Informe um Node ID OPC UA válido, como ns=3;s=Motor.Speed.",
            )
        node_id = node_id.strip()
        try:
            ua.NodeId.from_string(node_id)
        except Exception as exc:
            raise DriverError(
                "invalid_address",
                "Informe um Node ID OPC UA válido, como ns=3;s=Motor.Speed.",
            ) from exc
        return node_id

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
    def _is_reconnectable(exc: Exception) -> bool:
        if isinstance(exc, (TimeoutError, OSError, ConnectionError)):
            return True
        if isinstance(exc, UaStatusCodeError):
            name = ua.StatusCode(exc.code).name
            return name.startswith("BadSession") or name in {
                "BadConnectionClosed",
                "BadCommunicationError",
                "BadNoCommunication",
                "BadNotConnected",
                "BadServerNotConnected",
                "BadSecureChannelClosed",
                "BadSecureChannelIdInvalid",
                "BadTimeout",
            }
        return isinstance(exc, UaError)

    @staticmethod
    def _driver_error(exc: Exception, operation: str) -> DriverError:
        if isinstance(exc, UaStatusCodeError):
            status = ua.StatusCode(exc.code)
            return OpcUaDriver._status_error(status)
        if OpcUaDriver._is_reconnectable(exc):
            return DriverError(
                "target_offline",
                f"Falha de comunicação OPC UA durante {operation}: {exc}",
                quality="offline",
                retryable=True,
            )
        return DriverError(
            f"{operation}_failed",
            f"Falha OPC UA durante {operation}: {exc}",
        )

    @staticmethod
    def _status_error(status: ua.StatusCode) -> DriverError:
        name = status.name
        if name in {"BadNodeIdUnknown", "BadNodeIdInvalid", "BadAttributeIdInvalid"}:
            return DriverError("node_not_found", f"Node ID OPC UA inválido ou inexistente: {name}.")
        if name in {
            "BadUserAccessDenied",
            "BadNotReadable",
            "BadNotWritable",
            "BadWriteNotSupported",
        }:
            return DriverError("access_denied", f"Acesso OPC UA negado: {name}.")
        if name in {"BadTypeMismatch", "BadDataTypeIdUnknown"}:
            return DriverError("type_mismatch", f"Tipo OPC UA incompatível: {name}.")
        if name in {
            "BadCommunicationError",
            "BadNoCommunication",
            "BadNotConnected",
            "BadServerNotConnected",
            "BadTimeout",
        } or name.startswith("BadSession"):
            return DriverError(
                "target_offline",
                f"Comunicação OPC UA indisponível: {name}.",
                quality="offline",
                retryable=True,
            )
        return DriverError("opcua_status_bad", f"O servidor OPC UA retornou {name}.")

    @staticmethod
    def _timestamp(value: datetime | None) -> str | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
