import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { MixpanelError, parseExportLines } from "./client";
import type { MixpanelEvent } from "./types";

/**
 * Parses event text that is either a JSON array or newline-delimited JSON
 * (Mixpanel export format).
 * @param text - File contents.
 * @returns Parsed events.
 * @throws MixpanelError of kind "upstream" when the text is malformed or an event lacks a numeric time.
 */
export function parseEventsFile(text: string): MixpanelEvent[] {
  let events: MixpanelEvent[];
  try {
    events = text.trimStart().startsWith("[")
      ? (JSON.parse(text) as MixpanelEvent[])
      : parseExportLines(text);
  } catch {
    throw new MixpanelError("upstream", "Events file is not valid JSON or JSONL");
  }
  const valid = events.every(
    (e) => typeof e?.event === "string" && typeof e.properties?.time === "number",
  );
  if (!valid) {
    throw new MixpanelError("upstream", "Each event needs an event name and properties.time (epoch seconds)");
  }
  return events;
}

/**
 * Loads events from one or more local files instead of the Mixpanel API.
 * @param files - Comma-separated paths, relative to the project root or absolute.
 * @returns Events from all files, concatenated.
 * @throws MixpanelError of kind "config" when a file cannot be read.
 */
export async function loadEventsFromFile(files: string): Promise<MixpanelEvent[]> {
  const paths = files.split(",").map((f) => f.trim()).filter(Boolean);
  const all = await Promise.all(
    paths.map(async (file) => {
      let text: string;
      try {
        text = await readFile(path.resolve(process.cwd(), file), "utf8");
      } catch {
        throw new MixpanelError("config", "MIXPANEL_EVENTS_FILE could not be read");
      }
      return parseEventsFile(text);
    }),
  );
  return all.flat();
}

/** Where dashboard events come from. */
export type DataSource = "file" | "api";

/**
 * Chooses the event source from environment variables.
 * MIXPANEL_DATA_SOURCE=api|file forces a source; when unset, "file" is used if
 * MIXPANEL_EVENTS_FILE is set, otherwise "api".
 * @param env - Environment to read from (defaults to process.env).
 * @returns The source to use.
 * @throws MixpanelError of kind "config" for an invalid value or "file" without MIXPANEL_EVENTS_FILE.
 */
export function resolveDataSource(
  env: Record<string, string | undefined> = process.env,
): DataSource {
  const requested = env.MIXPANEL_DATA_SOURCE?.trim().toLowerCase();
  if (requested && requested !== "api" && requested !== "file") {
    throw new MixpanelError("config", "MIXPANEL_DATA_SOURCE must be api or file");
  }
  const source = (requested as DataSource | undefined) ?? (env.MIXPANEL_EVENTS_FILE ? "file" : "api");
  if (source === "file" && !env.MIXPANEL_EVENTS_FILE) {
    throw new MixpanelError("config", "MIXPANEL_DATA_SOURCE=file requires MIXPANEL_EVENTS_FILE");
  }
  return source;
}
