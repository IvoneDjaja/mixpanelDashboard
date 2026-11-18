/**
 * Small rotating ring shown while data loads.
 * @returns A decorative spinner element, hidden from assistive technology.
 */
export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/** Props for StateMessage. */
interface Props {
  kind: "loading" | "empty" | "error";
  message?: string;
}

const DEFAULTS = { loading: "Loading…", empty: "No data for this window.", error: "Something went wrong." };

/**
 * Shows a loading, empty or error message in place of a widget. The loading
 * message carries a spinner; the spinner is decorative, so screen readers get the text only.
 * @param props - State kind and optional custom message.
 * @returns A status element.
 */
export function StateMessage({ kind, message }: Props) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`state state-${kind}`}>
      {kind === "loading" && <Spinner />}
      {message ?? DEFAULTS[kind]}
    </p>
  );
}
