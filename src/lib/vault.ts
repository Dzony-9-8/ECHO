/**
 * Vault client.
 *
 * Deliberately has no function that reads a secret value, because the backend
 * has no endpoint that returns one. Secrets are written here and substituted
 * server-side at point of use via `{{vault:name}}` references. If you find
 * yourself wanting a `getSecret()`, that is the design working, not a gap.
 */

import { getBackendUrl } from "@/lib/api";

// Must be absolute: there is no dev proxy, so a relative /api path would hit
// the Vite server on :8080 instead of the backend on :8000.
const base = () => `${getBackendUrl()}/api/vault`;

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
  names: string[];
  count: number;
  idle_timeout_seconds: number;
  unlocked_at: number | null;
}

export const EMPTY_STATUS: VaultStatus = {
  exists: false,
  unlocked: false,
  names: [],
  count: 0,
  idle_timeout_seconds: 900,
  unlocked_at: null,
};

/** Thrown with the backend's own message, which is written to be user-facing. */
export class VaultRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call(
  path: string,
  init?: RequestInit,
): Promise<VaultStatus> {
  let res: Response;
  try {
    res = await fetch(base() + path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch {
    // Distinguish "backend is not there" from "backend said no" — the fixes
    // are completely different and the user should not have to guess.
    throw new VaultRequestError(
      "Can't reach the backend. The vault lives on the server, so it's unavailable while ECHO's backend is offline.",
      0,
    );
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* fall through to the status-code path below */
  }
  if (!res.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : `Request failed (HTTP ${res.status}).`;
    throw new VaultRequestError(detail, res.status);
  }
  return body as VaultStatus;
}

export const getStatus = () => call("/status");

export const createVault = (passphrase: string) =>
  call("/create", { method: "POST", body: JSON.stringify({ passphrase }) });

export const unlockVault = (passphrase: string) =>
  call("/unlock", { method: "POST", body: JSON.stringify({ passphrase }) });

export const lockVault = () => call("/lock", { method: "POST" });

export const setSecret = (name: string, value: string) =>
  call("/secret", { method: "PUT", body: JSON.stringify({ name, value }) });

export const deleteSecret = (name: string) =>
  call(`/secret/${encodeURIComponent(name)}`, { method: "DELETE" });

/** The reference to paste into a config value, e.g. IMAGE_API_KEY. */
export const referenceFor = (name: string) => `{{vault:${name}}}`;

/** Mirrors the backend's validation so the UI can object before a round trip. */
export const isValidName = (name: string) => /^[A-Za-z0-9_.-]{1,64}$/.test(name);
