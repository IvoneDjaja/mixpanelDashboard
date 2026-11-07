/** Props for StateMessage. */
interface Props {
  kind: "loading" | "empty" | "error";
  message?: string;
}

const DEFAULTS = { loading: "Loading…", empty: "No data for this window.", error: "Something went wrong." };

/**
 * Shows a loading, empty or error message in place of a widget.
 * @param props - State kind and optional custom message.
 * @returns A status element.
 */
export function StateMessage({ kind, message }: Props) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`state state-${kind}`}>
      {message ?? DEFAULTS[kind]}
    </p>
  );
}
