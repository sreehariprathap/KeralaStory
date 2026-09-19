import { useCallback, useEffect, useRef, useState } from 'react';
import type { Equipped, SaveV3 } from '../contracts';
import { readCloud, signInErrorKey, signInWithGoogle, signOutAccount, watchAccount, writeCloud, type AccountErrorKey, type AccountUser } from '../account/accountService';
import type { CloudRecord } from '../account/cloudSave';

export type AccountStatus = 'checking' | 'guest' | 'signedIn';
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline';
export type { AccountErrorKey };

/** Saves reach the account at most this often while playing; pausing, quitting and hiding the app send at once. */
const CLOUD_WRITE_INTERVAL_MS = 30_000;

export interface Account {
  status: AccountStatus;
  user: AccountUser | null;
  sync: SyncStatus;
  error: AccountErrorKey | null;
  /** True while a sign-in request is in flight. */
  busy: boolean;
  signIn: () => void;
  /** Runs any sign-in step (email, phone), turning a failure into `error`. Resolves true on success. */
  attempt: (step: () => Promise<unknown>) => Promise<boolean>;
  clearError: () => void;
  signOut: () => void;
  /** Queue the latest save and loadout for the account; `now` sends immediately. */
  push: (record: Partial<CloudRecord>, now?: boolean) => void;
}

/**
 * `onSignedIn` receives the account's cloud copy once per sign-in, before any local write is sent,
 * and returns what this device should send back (the newer save, a loadout the account lacks).
 */
export function useAccount(onSignedIn: (user: AccountUser, cloud: CloudRecord) => Partial<CloudRecord>): Account {
  const [status, setStatus] = useState<AccountStatus>('checking');
  const [user, setUser] = useState<AccountUser | null>(null);
  const [sync, setSync] = useState<SyncStatus>('idle');
  const [error, setError] = useState<AccountErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(onSignedIn); latest.current = onSignedIn;
  // Nothing is written until the cloud copy has been read and merged, so a stale device never overwrites it.
  const ready = useRef<string | null>(null);
  const pending = useRef<{ save?: SaveV3 | null; equipped?: Equipped | null }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback((): Promise<void> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const uid = ready.current, record = pending.current;
    if (!uid || (!record.save && !record.equipped)) return Promise.resolve();
    pending.current = {};
    setSync('syncing');
    return writeCloud(uid, record).then(() => setSync('synced'), () => {
      // Keep what failed so the next push retries it, without dropping anything newer.
      pending.current = { ...record, ...pending.current };
      setSync('offline');
    });
  }, []);

  useEffect(() => watchAccount(next => {
    setUser(next); setStatus(next ? 'signedIn' : 'guest'); setError(null);
    ready.current = null; pending.current = {};
    if (!next) { setSync('idle'); return; }
    setSync('syncing');
    readCloud(next.uid).then(cloud => {
      // Anything queued before the merge may be the losing copy; the merge pushes what should be kept.
      pending.current = { ...latest.current(next, cloud) };
      ready.current = next.uid;
      setSync('synced');
      void flush();
    }, () => setSync('offline'));
  }, () => setStatus('guest')), [flush]);

  // Hiding or closing the tab sends whatever is waiting.
  useEffect(() => {
    const hide = () => { if (document.hidden) void flush(); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [flush]);

  const push = useCallback((record: Partial<CloudRecord>, now = false) => {
    pending.current = { ...pending.current, ...record };
    if (!ready.current) return;
    if (now) void flush();
    else if (!timer.current) timer.current = setTimeout(flush, CLOUD_WRITE_INTERVAL_MS);
  }, [flush]);

  const attempt = useCallback(async (step: () => Promise<unknown>) => {
    setError(null); setBusy(true);
    try { await step(); return true; } catch (reason) { setError(signInErrorKey(reason)); return false; } finally { setBusy(false); }
  }, []);
  const signIn = useCallback(() => { void attempt(signInWithGoogle); }, [attempt]);
  const clearError = useCallback(() => setError(null), []);
  // The last save goes out before the session ends, while the write is still authorised.
  const signOut = useCallback(() => { void flush().finally(() => signOutAccount()); }, [flush]);

  return { status, user, sync, error, busy, signIn, attempt, clearError, signOut, push };
}
