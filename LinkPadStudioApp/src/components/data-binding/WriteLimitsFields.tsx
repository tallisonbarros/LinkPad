import type { LinkPadValueType } from "../../types/project";

interface WriteLimitsFieldsProps {
  type?: LinkPadValueType;
  min?: number;
  max?: number;
  onChange: (limits: { min?: number; max?: number }) => void;
}

export function WriteLimitsFields({ type, min, max, onChange }: WriteLimitsFieldsProps) {
  if (type !== "int" && type !== "float") return null;
  return (
    <div className="write-limits-fields">
      <span>Limites de escrita</span>
      <div className="two-columns">
        <label>Mínimo<input type="number" value={min ?? ""} onChange={(event) => onChange({ min: numberFrom(event.target.value), max })} /></label>
        <label>Máximo<input type="number" value={max ?? ""} onChange={(event) => onChange({ min, max: numberFrom(event.target.value) })} /></label>
      </div>
    </div>
  );
}

function numberFrom(value: string) {
  return value === "" ? undefined : Number(value);
}
