// Client for the Frunchy backend, contract v1:
// FrunchyBackend/specs/001-crunchyroll-history-import/contracts/import-api.md

import type { Settings } from "src/settings";
import type { HistoryPage } from "src/storage";

export type Me = {
  username: string;
  displayName: string;
  dashboardUrl: string;
  lastSyncAt: string | null;
  historyOwnerBound: boolean;
};

export type ImportSubmission = {
  exportedAt?: string;
  profileId?: string;
  pages: HistoryPage[];
};

export type ImportAccepted = {
  importId: string;
  status: "pending";
  statusUrl: string;
  entriesReceived: number;
};

export type ImportCounts = {
  received: number;
  processed: number;
  unresolved: number;
  unsupported: number;
  failed: number;
};

export type ImportStatus = {
  importId: string;
  status: "pending" | "processing" | "completed" | "failed";
  receivedAt: string;
  completedAt: string | null;
  counts: ImportCounts;
  issues: { page: number; index: number; episodeId: string | null; outcome: string; reason: string }[];
  error: string | null;
};

// A failed call: `code` is the backend's error code, "network" when the server
// couldn't be reached, or "server_error"/"http_<status>" when the body had none.
export class ApiFailure extends Error {
  readonly status: number | null;
  readonly code: string;

  constructor(status: number | null, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }

  // The contract allows retrying 5xx and network errors, never 4xx.
  get retryable() {
    return this.status === null || this.status >= 500;
  }
}

const request = async <T>(settings: Settings, path: string, init: RequestInit = {}): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(new URL(path, settings.baseUrl), {
      ...init,
      headers: {
        Authorization: `Bearer ${settings.syncKey.trim()}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch (err) {
    throw new ApiFailure(null, "network", String(err));
  }
  if (response.ok) return (await response.json()) as T;

  const body = await response.json().catch(() => null);
  const fallbackCode = response.status >= 500 ? "server_error" : `http_${response.status}`;
  throw new ApiFailure(response.status, body?.error ?? fallbackCode, body?.message ?? response.statusText);
};

export const api = {
  me: (settings: Settings) => request<Me>(settings, "/api/me"),

  submitImport: (settings: Settings, submission: ImportSubmission) =>
    request<ImportAccepted>(settings, "/api/imports", {
      method: "POST",
      body: JSON.stringify(submission),
    }),

  importStatus: (settings: Settings, statusUrl: string) => request<ImportStatus>(settings, statusUrl),
};
