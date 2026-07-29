import type { ComponentType } from "react";
import { defaultS7DataType, getConnectorManifest } from "../../data/connectorCatalog";
import type { ConnectorDriver, LinkPadValueType } from "../../types/project";

interface ConnectorAddressEditorProps {
  acceptedTypes?: LinkPadValueType[];
  driver: ConnectorDriver;
  type: LinkPadValueType;
  value: Record<string, string | number | boolean>;
  onChange: (address: Record<string, string | number | boolean>, type?: LinkPadValueType) => void;
}

interface AddressEditorProps extends ConnectorAddressEditorProps {}

const addressEditors: Partial<Record<ConnectorDriver, ComponentType<AddressEditorProps>>> = {
  "siemens-s7": S7AddressEditor,
  "opcua": OpcUaAddressEditor
};

export function ConnectorAddressEditor(props: ConnectorAddressEditorProps) {
  const Editor = addressEditors[props.driver] ?? GenericAddressEditor;
  return <Editor {...props} />;
}

function OpcUaAddressEditor({ value, onChange }: AddressEditorProps) {
  return (
    <label className="address-field opcua-address-field">
      Node ID
      <input
        placeholder="ns=3;s=Motor.Speed"
        value={String(value.nodeId ?? "")}
        onChange={(event) => onChange({ nodeId: event.target.value })}
      />
      <small>Aceita namespace por índice (`ns=`) ou URI estável (`nsu=`).</small>
    </label>
  );
}

function GenericAddressEditor({ driver, value, onChange }: AddressEditorProps) {
  const manifest = getConnectorManifest(driver);
  return (
    <label className="address-field">
      Endereço
      <input
        placeholder={manifest.addressExample}
        value={String(value[manifest.addressField] ?? "")}
        onChange={(event) => onChange({ [manifest.addressField]: event.target.value })}
      />
    </label>
  );
}

function S7AddressEditor({ acceptedTypes = ["bool", "int", "float"], type, value, onChange }: AddressEditorProps) {
  const allowedDataTypes = s7TypesFor(acceptedTypes);
  const currentDataType = String(value.dataType ?? defaultS7DataType(type));

  function update(field: string, fieldValue: string | number) {
    const address = { ...value, area: "DB", [field]: fieldValue };
    let nextType: LinkPadValueType | undefined;
    if (field === "dataType") {
      nextType = linkPadTypeForS7(String(fieldValue));
      if (fieldValue !== "BOOL") delete address.bitOffset;
      else if (address.bitOffset === undefined) address.bitOffset = 0;
    }
    onChange(address, nextType);
  }

  return (
    <div className="s7-address-editor compact-address-grid">
      <label>DB<input min={1} max={65535} type="number" value={Number(value.dbNumber ?? 1)} onChange={(event) => update("dbNumber", Number(event.target.value))} /></label>
      <label>Byte<input min={0} type="number" value={Number(value.byteOffset ?? 0)} onChange={(event) => update("byteOffset", Number(event.target.value))} /></label>
      <label>Tipo<select value={currentDataType} onChange={(event) => update("dataType", event.target.value)}>{allowedDataTypes.map((dataType) => <option key={dataType} value={dataType}>{dataType}</option>)}</select></label>
      {currentDataType === "BOOL" && <label>Bit<input min={0} max={7} type="number" value={Number(value.bitOffset ?? 0)} onChange={(event) => update("bitOffset", Number(event.target.value))} /></label>}
    </div>
  );
}

export function s7Types(type: LinkPadValueType) {
  if (type === "bool") return ["BOOL"];
  if (type === "int") return ["INT", "DINT"];
  if (type === "float") return ["REAL"];
  return [];
}

function s7TypesFor(types: LinkPadValueType[]) {
  return types.flatMap(s7Types);
}

function linkPadTypeForS7(dataType: string): LinkPadValueType {
  if (dataType === "BOOL") return "bool";
  if (dataType === "INT" || dataType === "DINT") return "int";
  return "float";
}
