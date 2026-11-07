/** A single event row as returned by the Mixpanel Raw Export API. */
export interface MixpanelEvent {
  event: string;
  properties: MixpanelEventProperties;
}

/** Properties used by the dashboard; Mixpanel may include many more. */
export interface MixpanelEventProperties {
  /** Event time in epoch seconds. */
  time: number;
  distinct_id?: string;
  page_name?: string;
  capability?: string;
  sign_in_type?: string;
  [key: string]: unknown;
}

/** Supported Mixpanel data residency regions. */
export type MixpanelRegion = "us" | "eu" | "in";

/** Server-side Mixpanel connection settings. */
export interface MixpanelConfig {
  user: string;
  secret: string;
  projectId: string;
  region: MixpanelRegion;
}
