import { useState } from 'react';
import { X } from '@phosphor-icons/react';
import type { ZoneId } from '../../contracts';
import { NPC_DEFINITIONS, type NpcId } from '../../game/npc/npcDefinitions';
import { askNpc } from '../../game/npc/npcClient';
import { useLocale } from '../i18n/translate';
import './npc-chat.css';

interface Props { npcId: NpcId; zoneId: ZoneId; baseUrl: string; onClose: () => void }

export function NpcChatPanel({ npcId, zoneId, baseUrl, onClose }: Props) {
  const { t } = useLocale();
  const def = NPC_DEFINITIONS[npcId];
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ from: 'player' | 'npc'; text: string }[]>([]);
  const [sending, setSending] = useState(false);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput('');
    setMessages(m => [...m, { from: 'player', text: trimmed }]);
    setSending(true);
    const result = await askNpc({ npcId, message: trimmed, zoneId }, baseUrl);
    setMessages(m => [...m, { from: 'npc', text: result.reply }]);
    setSending(false);
  };

  return (
    <div className="npc-chat-panel" role="dialog" aria-label={def.name}>
      <div className="npc-chat-header"><strong>{def.name}</strong><button aria-label={t('npc.chat.close')} onClick={onClose}><X size={18}/></button></div>
      <div className="npc-chat-log">{messages.map((m, i) => <div key={i} className={`npc-chat-line npc-chat-${m.from}`}>{m.text}</div>)}</div>
      <form className="npc-chat-input" onSubmit={e => { e.preventDefault(); void send(); }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder={t('npc.chat.placeholder')} maxLength={300} disabled={sending}/>
        <button type="submit" disabled={sending || !input.trim()}>{t('npc.chat.send')}</button>
      </form>
    </div>
  );
}
