import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyRound, Lock, Unlock, Plus, Trash2, Copy, Loader2, ShieldAlert, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  type VaultStatus,
  EMPTY_STATUS,
  VaultRequestError,
  getStatus,
  createVault,
  unlockVault,
  lockVault,
  setSecret,
  deleteSecret,
  referenceFor,
  isValidName,
} from "@/lib/vault";

const MIN_PASSPHRASE = 8;

const VaultView = () => {
  const [status, setStatus] = useState<VaultStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState<string | null>(null);

  const [passphrase, setPassphrase] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);

  // Guards against setState after unmount — the same fix DiagnosticsView needed.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await getStatus();
      if (!alive.current) return;
      setStatus(s);
      setOffline(null);
    } catch (e) {
      if (!alive.current) return;
      setOffline(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll while unlocked so the idle auto-lock is reflected without a reload.
  useEffect(() => {
    if (!status.unlocked) return;
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [status.unlocked, refresh]);

  const run = async (fn: () => Promise<VaultStatus>, ok?: string) => {
    setBusy(true);
    try {
      const s = await fn();
      if (!alive.current) return true;
      setStatus(s);
      setOffline(null);
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      const msg = e instanceof VaultRequestError ? e.message : String(e);
      toast.error(msg);
      return false;
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (passphrase.length < MIN_PASSPHRASE) {
      toast.error(`Passphrase must be at least ${MIN_PASSPHRASE} characters.`);
      return;
    }
    if (passphrase !== confirmPass) {
      toast.error("Passphrases don't match.");
      return;
    }
    if (await run(() => createVault(passphrase), "Vault created and unlocked.")) {
      setPassphrase("");
      setConfirmPass("");
    }
  };

  const handleUnlock = async () => {
    if (!passphrase) return;
    if (await run(() => unlockVault(passphrase), "Vault unlocked.")) setPassphrase("");
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!isValidName(name)) {
      toast.error("Name may only contain letters, numbers, dot, dash and underscore.");
      return;
    }
    if (!newValue) {
      toast.error("Value can't be empty.");
      return;
    }
    const replacing = status.names.includes(name);
    if (await run(
      () => setSecret(name, newValue),
      replacing ? `Replaced "${name}".` : `Stored "${name}".`,
    )) {
      setNewName("");
      setNewValue("");
      setAdding(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete "${name}"? It cannot be recovered.`)) return;
    await run(() => deleteSecret(name), `Deleted "${name}".`);
  };

  const copyReference = (name: string) => {
    navigator.clipboard.writeText(referenceFor(name));
    toast.success(`Copied ${referenceFor(name)}`);
  };

  /* ── Honest limitations, shown rather than buried in docs ──────────────── */
  const Limitations = () => (
    <div className="mt-6 rounded border border-terminal-amber/30 bg-terminal-amber/5 p-4">
      <div className="flex items-center gap-2 text-terminal-amber">
        <ShieldAlert className="h-4 w-4" />
        <span className="font-display text-sm uppercase tracking-wide">What this does and doesn't protect</span>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <li>
          <span className="text-foreground">Protects</span> the file at rest — a stolen laptop,
          a backup, or a synced folder. Without the passphrase it's unreadable.
        </li>
        <li>
          <span className="text-foreground">Does not protect</span> against anything running
          on this machine as you while the vault is unlocked. The key is in memory by then.
        </li>
        <li>
          There is <span className="text-foreground">no recovery</span>. Forget the passphrase
          and the secrets are gone — that's the point.
        </li>
        <li>
          Secrets are <span className="text-foreground">never displayed again</span> after you
          save them, and no part of ECHO can read one back over the network.
        </li>
      </ul>
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking vault…
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <KeyRound className="h-6 w-6 text-terminal-amber" />
          <div>
            <h1 className="font-display text-xl uppercase tracking-wider text-foreground">Vault</h1>
            <p className="text-xs text-muted-foreground">
              Encrypted storage for API keys and credentials
            </p>
          </div>
          {status.exists && (
            <div className="ml-auto flex items-center gap-1.5 text-xs">
              {status.unlocked ? (
                <><Unlock className="h-3.5 w-3.5 text-terminal-green" />
                  <span className="text-terminal-green">Unlocked</span></>
              ) : (
                <><Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Locked</span></>
              )}
            </div>
          )}
        </div>

        {offline && (
          <div className="mb-4 rounded border border-terminal-red/40 bg-terminal-red/5 p-3 text-xs text-terminal-red">
            {offline}
          </div>
        )}

        {/* ── No vault yet ─────────────────────────────────────────────── */}
        {!status.exists && !offline && (
          <div className="rounded border border-border bg-card p-5">
            <h2 className="font-display text-sm uppercase tracking-wide text-foreground">
              Create a vault
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose a passphrase. It's the only way in — it isn't stored anywhere and can't be reset.
            </p>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={`Passphrase (min ${MIN_PASSPHRASE} characters)`}
              className="mt-3 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <input
              type="password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Confirm passphrase"
              className="mt-2 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <button
              onClick={handleCreate}
              disabled={busy}
              className="mt-3 flex items-center gap-2 rounded bg-terminal-green/15 px-4 py-2 text-sm text-terminal-green hover:bg-terminal-green/25 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Create vault
            </button>
            <Limitations />
          </div>
        )}

        {/* ── Locked ───────────────────────────────────────────────────── */}
        {status.exists && !status.unlocked && !offline && (
          <div className="rounded border border-border bg-card p-5">
            <h2 className="font-display text-sm uppercase tracking-wide text-foreground">
              Unlock
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The vault locks itself after {Math.round(status.idle_timeout_seconds / 60)} minutes
              of inactivity, and whenever the backend restarts.
            </p>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="Passphrase"
              autoFocus
              className="mt-3 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <button
              onClick={handleUnlock}
              disabled={busy || !passphrase}
              className="mt-3 flex items-center gap-2 rounded bg-terminal-amber/15 px-4 py-2 text-sm text-terminal-amber hover:bg-terminal-amber/25 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              Unlock
            </button>
          </div>
        )}

        {/* ── Unlocked ─────────────────────────────────────────────────── */}
        {status.exists && status.unlocked && !offline && (
          <>
            <div className="rounded border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-display text-sm uppercase tracking-wide text-foreground">
                  Secrets ({status.count})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAdding((v) => !v)}
                    className="flex items-center gap-1.5 rounded bg-terminal-green/15 px-3 py-1.5 text-xs text-terminal-green hover:bg-terminal-green/25"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                  <button
                    onClick={() => run(() => lockVault(), "Vault locked.")}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Lock className="h-3.5 w-3.5" /> Lock
                  </button>
                </div>
              </div>

              {adding && (
                <div className="border-b border-border bg-background/40 p-4">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name, e.g. openai"
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                  <input
                    type="password"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    placeholder="Value — you won't be shown this again"
                    className="mt-2 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                  {status.names.includes(newName.trim()) && newName.trim() !== "" && (
                    <p className="mt-2 text-xs text-terminal-amber">
                      "{newName.trim()}" already exists — saving will replace it.
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleAdd}
                      disabled={busy}
                      className="rounded bg-terminal-green/15 px-3 py-1.5 text-xs text-terminal-green hover:bg-terminal-green/25 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setAdding(false); setNewName(""); setNewValue(""); }}
                      className="rounded bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {status.names.length === 0 && !adding && (
                <p className="p-6 text-center text-xs text-muted-foreground">
                  No secrets yet. Add one, then reference it as{" "}
                  <code className="text-terminal-cyan">{"{{vault:name}}"}</code> in a config value.
                </p>
              )}

              <ul>
                {status.names.map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0"
                  >
                    <KeyRound className="h-4 w-4 shrink-0 text-terminal-amber" />
                    <span className="font-mono text-sm text-foreground">{name}</span>
                    <span className="text-xs text-muted-foreground">••••••••</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => copyReference(name)}
                        title={`Copy ${referenceFor(name)}`}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-terminal-cyan"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(name)}
                        title="Delete"
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-terminal-red"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 rounded border border-border bg-card p-4">
              <h3 className="font-display text-xs uppercase tracking-wide text-foreground">
                Using a secret
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Put the reference where the key would go, and ECHO substitutes the real value
                only when it makes the request:
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-background p-3 text-xs text-terminal-cyan">
IMAGE_API_KEY={"{{vault:openai}}"}
              </pre>
              <p className="mt-2 text-xs text-muted-foreground">
                The secret never sits in the environment, and nothing reads it back over the network.
              </p>
            </div>

            <Limitations />
          </>
        )}
      </div>
    </div>
  );
};

export default VaultView;
