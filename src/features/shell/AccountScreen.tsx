import { useState, type FormEvent } from 'react';
import type { Account } from '../../app/useAccount';
import { createEmailAccount, sendPasswordReset, sendPhoneCode, signInWithEmail } from '../../account/accountService';
import { useT, type TranslationKey } from '../i18n/translate';
import { ShellFrame } from './ShellFrame';
import { useMenuNavigation } from './useMenuNavigation';

type Method = 'email' | 'phone';

export function AccountScreen({ account, coins, onBack }: { account: Account; coins: number; onBack: () => void }) {
  const t = useT();
  const { status, user, sync, error } = account;
  // The forms own Enter; the menu keys only handle Escape here.
  useMenuNavigation({ count: 1, disabled: [true], onActivate: () => undefined, onBack });
  return <ShellFrame title={t('shell.menu.account')} subtitle={user ? <>🪙 {coins} {t('shell.store.coins')}</> : undefined} hints={t('shell.hints.back')} onBack={onBack}>
    <div className="shell-card">
      {status === 'checking' && <p>{t('account.checking')}</p>}
      {status === 'guest' && <GuestSignIn account={account}/>}
      {status === 'signedIn' && user && <>
        <div className="shell-account">
          {user.photoUrl && <img className="shell-account__photo" src={user.photoUrl} alt="" referrerPolicy="no-referrer" width={56} height={56}/>}
          <div><small>{t('account.signedInAs')}</small><strong>{user.name}</strong>{[user.email, user.phone].filter(v => v && v !== user.name).map(v => <span key={v}>{v}</span>)}</div>
        </div>
        <p>{t('account.unlockAll')}</p>
        {sync !== 'idle' && <p className={`shell-account__sync is-${sync}`} role="status">{t(`account.sync.${sync}`)}</p>}
        <div className="shell-actions"><button className="shell-button" onClick={account.signOut} autoFocus>{t('account.signOut')}</button></div>
      </>}
      {status !== 'guest' && error && <p className="shell-account__error" role="alert">{t(error)}</p>}
    </div>
  </ShellFrame>;
}

function GuestSignIn({ account }: { account: Account }) {
  const t = useT();
  const [method, setMethod] = useState<Method>('email');
  const [notice, setNotice] = useState<TranslationKey | null>(null);
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [phone, setPhone] = useState(''), [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState<((code: string) => Promise<void>) | null>(null);
  const { busy } = account;
  const choose = (next: Method) => { setMethod(next); setNotice(null); account.clearError(); };

  const emailSubmit = (event: FormEvent) => { event.preventDefault(); setNotice(null); void account.attempt(() => signInWithEmail(email, password)); };
  const createAccount = () => { setNotice(null); void account.attempt(() => createEmailAccount(email, password)); };
  const resetPassword = async () => {
    setNotice(null);
    if (await account.attempt(() => sendPasswordReset(email))) setNotice('account.resetSent');
  };
  const phoneSubmit = async (event: FormEvent) => {
    event.preventDefault(); setNotice(null);
    if (confirmCode) { await account.attempt(() => confirmCode(code)); return; }
    let confirm: ((code: string) => Promise<void>) | null = null;
    if (await account.attempt(async () => { confirm = await sendPhoneCode(phone); })) { setConfirmCode(() => confirm); setNotice('account.codeSent'); }
  };

  return <>
    <p>{t('account.guestBody')}</p>
    <div className="shell-actions"><button className="shell-button is-primary" onClick={account.signIn} disabled={busy} autoFocus>{t('account.signIn')}</button></div>
    <div className="shell-account__or"><span>{t('account.or')}</span></div>
    <div className="shell-tabs" role="tablist">
      {(['email', 'phone'] as const).map(entry => <button key={entry} type="button" role="tab" aria-selected={method === entry} className={`shell-tab ${method === entry ? 'is-active' : ''}`} onClick={() => choose(entry)}>{t(entry === 'email' ? 'account.tab.email' : 'account.tab.phone')}</button>)}
    </div>
    {method === 'email' && <form className="shell-form" onSubmit={emailSubmit}>
      <label className="shell-field"><span>{t('account.email')}</span><input type="email" autoComplete="email" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label className="shell-field"><span>{t('account.password')}</span><input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}/></label>
      <div className="shell-actions">
        <button className="shell-button is-primary" type="submit" disabled={busy}>{t('account.emailSignIn')}</button>
        <button className="shell-button" type="button" disabled={busy || !email || password.length < 6} onClick={createAccount}>{t('account.createAccount')}</button>
      </div>
      <button className="shell-link" type="button" disabled={busy || !email} onClick={() => void resetPassword()}>{t('account.forgotPassword')}</button>
    </form>}
    {method === 'phone' && <form className="shell-form" onSubmit={e => void phoneSubmit(e)}>
      <label className="shell-field"><span>{t('account.phone')}</span><input type="tel" autoComplete="tel" inputMode="tel" required placeholder="+91 98765 43210" value={phone} disabled={!!confirmCode} onChange={e => setPhone(e.target.value)}/></label>
      {confirmCode && <label className="shell-field"><span>{t('account.code')}</span><input autoComplete="one-time-code" inputMode="numeric" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value)} autoFocus/></label>}
      <div className="shell-actions">
        <button className="shell-button is-primary" type="submit" disabled={busy}>{t(confirmCode ? 'account.verifyCode' : 'account.sendCode')}</button>
        {confirmCode && <button className="shell-button" type="button" disabled={busy} onClick={() => { setConfirmCode(null); setCode(''); setNotice(null); }}>{t('account.changeNumber')}</button>}
      </div>
      <small className="shell-account__note">{t('account.phoneHint')}</small>
    </form>}
    {notice && <p className="shell-account__sync" role="status">{t(notice)}</p>}
    {account.error && <p className="shell-account__error" role="alert">{t(account.error)}</p>}
    <p className="shell-account__note">{t('account.guestFree')}</p>
  </>;
}
