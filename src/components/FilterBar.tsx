import { ENVIRONMENTS, LBUS, type Environment, type Lbu, type WindowKey } from "@/lib/validation";

/** Button labels for each supported time window, in display order. */
const WINDOW_LABELS: Record<WindowKey, string> = {
  "1h": "Last hour",
  "24h": "Last 24 hours",
  "30d": "Last 30 days",
};

/** The filters a user edits before pressing Apply. */
export interface FilterValues {
  window: WindowKey;
  environment: Environment;
  lbu: Lbu;
}

interface FilterBarProps {
  values: FilterValues;
  /** Whether the edited values differ from the applied ones. */
  dirty: boolean;
  onChange: (update: Partial<FilterValues>) => void;
  onApply: () => void;
}

/**
 * Window, environment and LBU controls with an Apply button. Edits go
 * through `onChange` and never fetch on their own; `onApply` promotes them.
 * @param props - Current values and handlers.
 * @returns The filter controls.
 */
export function FilterBar({ values, dirty, onChange, onApply }: FilterBarProps) {
  return (
    <div className="controls">
      <div role="group" aria-label="Time window">
        {(Object.keys(WINDOW_LABELS) as WindowKey[]).map((w) => (
          <button key={w} aria-pressed={values.window === w} onClick={() => onChange({ window: w })}>
            {WINDOW_LABELS[w]}
          </button>
        ))}
      </div>
      <label>
        Environment{" "}
        <select value={values.environment} onChange={(e) => onChange({ environment: e.target.value as Environment })}>
          {ENVIRONMENTS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        LBU{" "}
        <select value={values.lbu} onChange={(e) => onChange({ lbu: e.target.value as Lbu })}>
          {LBUS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <button disabled={!dirty} onClick={onApply}>
        Apply
      </button>
    </div>
  );
}
