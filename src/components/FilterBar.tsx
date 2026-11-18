import {
  ENVIRONMENTS,
  isValidDate,
  isValidLbu,
  toDateString,
  type Environment,
  type Lbu,
  type WindowKey,
} from "@/lib/validation";

/** Button labels for each supported time window, in display order. */
const WINDOW_LABELS: Record<WindowKey, string> = {
  "1h": "Last hour",
  "24h": "Last 24 hours",
  day: "Day",
};

/** The filters a user edits before pressing Apply. */
export interface FilterValues {
  window: WindowKey;
  /** UTC day (YYYY-MM-DD) used when `window` is `"day"`. */
  date: string;
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
 * Today's date in UTC, the latest day that can be selected.
 * @returns A YYYY-MM-DD string.
 */
export function todayUtc(): string {
  return toDateString(Math.floor(Date.now() / 1000));
}

/**
 * Moves a UTC day forwards or backwards.
 * @param date - A valid YYYY-MM-DD day.
 * @param days - Number of days to add (negative for earlier).
 * @returns The shifted YYYY-MM-DD day.
 */
export function shiftDate(date: string, days: number): string {
  return toDateString(Date.parse(`${date}T00:00:00Z`) / 1000 + days * 86400);
}

/**
 * Window, environment and LBU controls with an Apply button. Edits go
 * through `onChange` and never fetch on their own; `onApply` promotes them.
 * @param props - Current values and handlers.
 * @returns The filter controls.
 */
export function FilterBar({ values, dirty, onChange, onApply }: FilterBarProps) {
  const today = todayUtc();
  // An LBU that the server would reject cannot be applied; Apply stays disabled until it is fixed.
  const lbuValid = isValidLbu(values.lbu.trim());
  const canApply = dirty && lbuValid;
  return (
    <div className="controls">
      <div role="group" aria-label="Time window">
        {(Object.keys(WINDOW_LABELS) as WindowKey[]).map((w) => (
          <button key={w} aria-pressed={values.window === w} onClick={() => onChange({ window: w })}>
            {WINDOW_LABELS[w]}
          </button>
        ))}
      </div>
      {values.window === "day" && (
        <div role="group" aria-label="Day">
          <button aria-label="Previous day" onClick={() => onChange({ date: shiftDate(values.date, -1) })}>
            &lt;
          </button>
          <input
            type="date"
            aria-label="Date"
            value={values.date}
            max={today}
            onChange={(e) => {
              // Ignore cleared, malformed or future values so pending state is always valid.
              const next = e.target.value;
              if (isValidDate(next) && next <= today) onChange({ date: next });
            }}
          />
          <button
            aria-label="Next day"
            disabled={values.date >= today}
            onClick={() => onChange({ date: shiftDate(values.date, 1) })}
          >
            &gt;
          </button>
        </div>
      )}
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
        <input
          type="text"
          value={values.lbu}
          maxLength={50}
          aria-invalid={!lbuValid}
          onChange={(e) => onChange({ lbu: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canApply) onApply();
          }}
        />
      </label>
      <button className="apply-button" disabled={!canApply} onClick={onApply}>
        Apply
      </button>
    </div>
  );
}
