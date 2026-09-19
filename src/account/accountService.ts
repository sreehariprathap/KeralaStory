import { parseCloudDoc, toCloudDoc, type CloudRecord } from './cloudSave';

export interface AccountUser { uid: string; name: string; email: string; phone: string; photoUrl: string | null }

/** Firebase is loaded on first use, so the splash and menu never wait on it. */
const sdk = () => Promise.all([import('../firebase'), import('firebase/auth'), import('firebase/firestore')])
  .then(([app, auth, firestore]) => ({ app, auth, firestore }));

export function watchAccount(onChange: (user: AccountUser | null) => void, onError: (error: unknown) => void): () => void {
  let stop: (() => void) | null = null, stopped = false;
  sdk().then(({ app, auth }) => {
    if (stopped) return;
    stop = auth.onAuthStateChanged(app.auth, user => onChange(user && {
      uid: user.uid, name: user.displayName ?? user.email ?? user.phoneNumber ?? 'Explorer', email: user.email ?? '', phone: user.phoneNumber ?? '', photoUrl: user.photoURL,
    }), onError);
  }, onError);
  return () => { stopped = true; stop?.(); };
}

/** A popup keeps the game running; installed apps and blocked popups fall back to a full-page redirect. */
export async function signInWithGoogle(): Promise<void> {
  const { app, auth } = await sdk();
  try {
    await auth.signInWithPopup(app.auth, app.googleProvider);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') await auth.signInWithRedirect(app.auth, app.googleProvider);
    else throw error;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { app, auth } = await sdk();
  await auth.signInWithEmailAndPassword(app.auth, email.trim(), password);
}

export async function createEmailAccount(email: string, password: string): Promise<void> {
  const { app, auth } = await sdk();
  await auth.createUserWithEmailAndPassword(app.auth, email.trim(), password);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { app, auth } = await sdk();
  await auth.sendPasswordResetEmail(app.auth, email.trim());
}

/** A dismissed reCAPTCHA puzzle never settles, so an SMS request gives up after this long. */
const PHONE_CODE_TIMEOUT_MS = 120_000;

/**
 * Sends an SMS code. Firebase requires a reCAPTCHA check first; it runs invisibly in a fresh
 * container each time, so a retry after a closed puzzle does not clash with the last one.
 * Resolves to the function that confirms the code the player types.
 */
export async function sendPhoneCode(phoneNumber: string): Promise<(code: string) => Promise<void>> {
  const { app, auth } = await sdk();
  const container = document.createElement('div');
  document.body.append(container);
  const verifier = new auth.RecaptchaVerifier(app.auth, container, { size: 'invisible' });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const confirmation = await Promise.race([
      auth.signInWithPhoneNumber(app.auth, phoneNumber.replace(/[\s-]/g, ''), verifier),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('Phone check timed out'), { code: 'auth/timeout' })), PHONE_CODE_TIMEOUT_MS); }),
    ]);
    return async code => { await confirmation.confirm(code.trim()); };
  } finally {
    clearTimeout(timer);
    verifier.clear();
    container.remove();
  }
}

export async function signOutAccount(): Promise<void> {
  const { app, auth } = await sdk();
  await auth.signOut(app.auth);
}

export async function readCloud(uid: string): Promise<CloudRecord> {
  const { app, firestore } = await sdk();
  const snapshot = await firestore.getDoc(firestore.doc(app.db, 'users', uid));
  return parseCloudDoc(snapshot.exists() ? snapshot.data() : undefined);
}

export async function writeCloud(uid: string, record: Partial<CloudRecord>): Promise<void> {
  const { app, firestore } = await sdk();
  await firestore.setDoc(firestore.doc(app.db, 'users', uid), { ...toCloudDoc(record), updatedAt: firestore.serverTimestamp() }, { merge: true });
}

const ERROR_KEYS = {
  'auth/network-request-failed': 'account.error.network',
  'auth/unauthorized-domain': 'account.error.domain',
  'auth/operation-not-allowed': 'account.error.disabled',
  'auth/invalid-email': 'account.error.email',
  'auth/missing-email': 'account.error.email',
  'auth/invalid-credential': 'account.error.credentials',
  'auth/invalid-login-credentials': 'account.error.credentials',
  'auth/wrong-password': 'account.error.credentials',
  'auth/user-not-found': 'account.error.credentials',
  'auth/missing-password': 'account.error.weakPassword',
  'auth/weak-password': 'account.error.weakPassword',
  'auth/email-already-in-use': 'account.error.emailTaken',
  'auth/invalid-phone-number': 'account.error.phone',
  'auth/missing-phone-number': 'account.error.phone',
  'auth/invalid-verification-code': 'account.error.code',
  'auth/code-expired': 'account.error.codeExpired',
  'auth/too-many-requests': 'account.error.tooMany',
  'auth/quota-exceeded': 'account.error.tooMany',
  'auth/billing-not-enabled': 'account.error.disabled',
  'auth/timeout': 'account.error.timeout',
} as const;
export type AccountErrorKey = (typeof ERROR_KEYS)[keyof typeof ERROR_KEYS] | 'account.error.generic';

/** A short, player-facing reason for a failed sign-in, or null when the player simply closed the popup. */
export function signInErrorKey(error: unknown): AccountErrorKey | null {
  const code = (error as { code?: string }).code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled') return null;
  return (ERROR_KEYS as Record<string, AccountErrorKey>)[code] ?? 'account.error.generic';
}
