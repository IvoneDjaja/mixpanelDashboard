import { Spinner } from "./StateMessage";

interface DataFreshnessProps {
  /** When the data was fetched from Mixpanel (epoch milliseconds), or null before the first load. */
  fetchedAt: number | null;
  /** Whether a request is in flight; Refresh is disabled so clicks cannot spend extra API calls. */
  loading: boolean;
  onRefresh: () => void;
}

/**
 * Shows when the displayed data was fetched from Mixpanel, with a Refresh button
 * that reloads it past the server's cache.
 * @param props - Fetch time, loading state and the refresh handler.
 * @returns The freshness label and Refresh button.
 */
export function DataFreshness({ fetchedAt, loading, onRefresh }: DataFreshnessProps) {
  return (
    <div className="freshness">
      {fetchedAt !== null && <span>Data as of {new Date(fetchedAt).toLocaleTimeString()}</span>}
      {loading && <Spinner />}
      <button type="button" disabled={loading} onClick={onRefresh}>
        Refresh
      </button>
    </div>
  );
}
