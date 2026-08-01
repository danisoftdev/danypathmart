import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useShopSupportChats,
  useShopSupportConversation,
  useShopSupportDelete,
  useShopSupportReply,
  useShopSupportUpload,
} from '../../hooks/supportChat';
import { resolveImageUrl } from '../../lib/currency';
import { staffVisibleMessages } from '../../lib/supportChatMessages';

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function visitorLabel(c) {
  if (!c) return 'Customer';
  if (c.is_guest || !c.user_id) return `Guest · ${c.guest_name || 'Visitor'}`;
  return c.guest_name || 'Customer';
}

function Bubble({ message }) {
  const isShop = message.sender_type === 'shop';
  const isHandoff = (message.sender_type === 'system' || message.sender_type === 'bot')
    && String(message.body || '').toLowerCase().includes('joined the chat');
  const imageSrc = message.image_url ? resolveImageUrl(message.image_url) : null;

  if (isHandoff) {
    return (
      <div className="flex justify-center">
        <p className="max-w-[92%] rounded-full bg-white/10 px-3 py-1.5 text-center text-[11px] text-white/70">
          {message.body}
        </p>
      </div>
    );
  }

  const label =
    message.sender_type === 'customer'
      ? 'Customer'
      : message.sender_type === 'admin'
        ? 'DPM Support'
        : 'You (shop)';

  return (
    <div className={`flex ${isShop ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
          isShop ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white',
        ].join(' ')}
      >
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
        {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
        {imageSrc && (
          <a href={imageSrc} target="_blank" rel="noreferrer" className="mt-2 block">
            <img src={imageSrc} alt="" className="max-h-36 rounded-lg object-cover" />
          </a>
        )}
        <p className="mt-1 text-[10px] opacity-60">{formatWhen(message.created_at)}</p>
      </div>
    </div>
  );
}

/** Shop seller floating inbox — same style as DPM staff inbox, not buyer chat. */
export default function ShopSupportInboxWidget() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const fileRef = useRef(null);

  const { data: conversations = [], isLoading } = useShopSupportChats(open);
  const { data: thread, isLoading: threadLoading } = useShopSupportConversation(selectedId, open && !!selectedId);
  const reply = useShopSupportReply();
  const upload = useShopSupportUpload();
  const removeChat = useShopSupportDelete();

  const unread = useMemo(
    () => conversations.reduce((sum, c) => sum + (Number(c.shop_unread_count) || 0), 0),
    [conversations]
  );
  const active = thread?.conversation ?? null;
  const messages = staffVisibleMessages(thread?.messages ?? []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, selectedId, open]);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!selectedId || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    setError('');
    try {
      await reply.mutateAsync({ conversation_id: selectedId, body: text });
    } catch (err) {
      setDraft(text);
      setError(err.response?.data?.message || 'Could not send.');
    }
  };

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedId) return;
    setError('');
    try {
      const uploaded = await upload.mutateAsync(file);
      await reply.mutateAsync({ conversation_id: selectedId, image_url: uploaded.url });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send image.');
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('Delete this chat and all its messages? This cannot be undone.')) return;
    setError('');
    try {
      const deletedId = selectedId;
      await removeChat.mutateAsync(deletedId);
      setDraft('');
      setSelectedId(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete chat.');
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Open shop support inbox"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1a2332] text-xl text-white shadow-lg ring-4 ring-[#1a2332]/25 transition hover:scale-105 md:bottom-6"
      >
        <span aria-hidden>🏪</span>
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-[#1a2332]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-end p-0 md:inset-auto md:bottom-24 md:right-4 md:p-0">
          <button type="button" className="absolute inset-0 bg-black/50 md:hidden" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="relative flex h-[min(88vh,620px)] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#121820] text-white shadow-2xl md:h-[560px] md:w-[400px] md:rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#1a2332] px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">Shop staff</p>
                <p className="text-sm font-extrabold">Support inbox</p>
                <p className="text-xs text-white/60">Reply to customers — not the buyer chat.</p>
              </div>
              <button type="button" className="rounded-lg px-2 py-1 text-lg leading-none hover:bg-white/10" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            {error && (
              <p className="mx-3 mt-3 rounded-xl border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs text-red-200">{error}</p>
            )}

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[140px_1fr]">
              <div className="max-h-[40%] overflow-y-auto border-b border-white/10 md:max-h-none md:border-b-0 md:border-r">
                {isLoading ? (
                  <p className="p-3 text-xs text-white/50">Loading…</p>
                ) : conversations.length === 0 ? (
                  <p className="p-3 text-xs text-white/50">No shop chats yet.</p>
                ) : (
                  <ul className="p-1">
                    {conversations.slice(0, 30).map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(c.id)}
                          className={[
                            'w-full rounded-xl px-2 py-2 text-left text-xs transition',
                            selectedId === c.id ? 'bg-white/15' : 'hover:bg-white/5',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold leading-tight">{visitorLabel(c)}</span>
                            {(c.shop_unread_count || 0) > 0 && (
                              <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-[#1a2332]">
                                {c.shop_unread_count}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[10px] text-white/45">
                            {(c.is_guest || !c.user_id) ? 'Guest' : 'Account'}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex min-h-0 flex-col">
                {!selectedId ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                    <p className="text-sm text-white/70">Select a conversation to reply.</p>
                    <Link to="/seller/chat" className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-[#1a2332]" onClick={() => setOpen(false)}>
                      Open full inbox
                    </Link>
                  </div>
                ) : threadLoading ? (
                  <p className="p-4 text-sm text-white/50">Loading thread…</p>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{visitorLabel(active)}</p>
                        <p className="text-[11px] text-white/50">{active?.guest_email}</p>
                        {active?.dpm_joined && (
                          <span className="mt-1 inline-block rounded-md bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                            DPM joined
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/15"
                        onClick={handleDelete}
                        disabled={removeChat.isPending}
                      >
                        Delete
                      </button>
                    </div>
                    <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
                      {messages.map((m) => (
                        <Bubble key={m.id} message={m} />
                      ))}
                    </div>
                    <form onSubmit={handleReply} className="border-t border-white/10 p-2">
                      <div className="flex items-end gap-2">
                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImage} />
                        <button type="button" className="rounded-lg px-2 py-2 text-lg hover:bg-white/10" onClick={() => fileRef.current?.click()}>
                          📷
                        </button>
                        <textarea
                          className="min-h-[40px] flex-1 resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
                          rows={1}
                          placeholder="Reply as shop…"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                        />
                        <button type="submit" className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold disabled:opacity-50" disabled={!draft.trim() || reply.isPending}>
                          Send
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 px-3 py-2 text-center">
              <Link to="/seller/chat" className="text-xs font-bold text-amber-300 hover:underline" onClick={() => setOpen(false)}>
                Open full shop inbox →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
