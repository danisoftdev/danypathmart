import { useEffect, useRef, useState } from 'react';
import {
  useShopSupportChats,
  useShopSupportConversation,
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

function visitorKind(c) {
  if (c?.is_guest || !c?.user_id) return 'Guest';
  return 'Account';
}

function Bubble({ message }) {
  const isShop = message.sender_type === 'shop';
  const isHandoff = (message.sender_type === 'system' || message.sender_type === 'bot')
    && String(message.body || '').toLowerCase().includes('joined the chat');
  const imageSrc = message.image_url ? resolveImageUrl(message.image_url) : null;

  if (isHandoff) {
    return (
      <div className="flex justify-center">
        <p className="max-w-[90%] rounded-full bg-white/10 px-3 py-1.5 text-center text-xs text-white/70">
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
        : 'You';

  return (
    <div className={`flex ${isShop ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
          isShop ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white',
        ].join(' ')}
      >
        <p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${isShop ? 'text-white/75' : 'opacity-60'}`}>
          {label}
        </p>
        {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
        {imageSrc && (
          <a href={imageSrc} target="_blank" rel="noreferrer" className="mt-2 block">
            <img src={imageSrc} alt="Attachment" className="max-h-40 rounded-lg object-cover" />
          </a>
        )}
        <p className={`mt-1 text-[10px] ${isShop ? 'text-white/75' : 'opacity-60'}`}>{formatWhen(message.created_at)}</p>
      </div>
    </div>
  );
}

/** Full-page shop support inbox — styled like DPM staff chat, not buyer chat. */
export default function ShopSupportChatPage() {
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const fileRef = useRef(null);

  const { data: conversations = [], isLoading } = useShopSupportChats(true);
  const { data: thread, isLoading: threadLoading } = useShopSupportConversation(selectedId, !!selectedId);
  const reply = useShopSupportReply();
  const upload = useShopSupportUpload();

  const messages = staffVisibleMessages(thread?.messages ?? []);
  const active = thread?.conversation ?? null;

  useEffect(() => {
    if (!selectedId && conversations[0]?.id) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, selectedId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedId || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    setError('');
    try {
      await reply.mutateAsync({ conversation_id: selectedId, body: text });
    } catch (err) {
      setDraft(text);
      setError(err.response?.data?.message || 'Could not send reply.');
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

  return (
    <div>
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">Shop staff</p>
        <h1 className="text-xl font-extrabold">Support inbox</h1>
        <p className="text-sm text-muted">
          Reply to customers who messaged your shop. Customer greeting lines are hidden here — same as DPM inbox.
        </p>
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-sm text-brand-red">{error}</p>
      )}

      <div className="grid gap-4 overflow-hidden rounded-2xl border border-white/10 bg-[#121820] text-white lg:grid-cols-[minmax(240px,300px)_1fr]">
        <div className="max-h-[70vh] overflow-y-auto border-b border-white/10 p-2 lg:border-b-0 lg:border-r">
          {isLoading ? (
            <p className="p-3 text-sm text-white/50">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="p-3 text-sm text-white/50">No customer chats yet.</p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={[
                      'w-full rounded-xl px-3 py-2 text-left text-sm',
                      selectedId === c.id ? 'bg-white/15' : 'hover:bg-white/5',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold">{c.guest_name || 'Customer'}</span>
                      {(c.shop_unread_count || 0) > 0 && (
                        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-[#1a2332]">
                          {c.shop_unread_count}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-white/50">{c.guest_email}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200/80">
                      {visitorKind(c)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-h-[420px] max-h-[70vh] flex-col">
          {!selectedId ? (
            <p className="flex flex-1 items-center justify-center p-6 text-sm text-white/50">Select a conversation.</p>
          ) : threadLoading ? (
            <p className="p-4 text-sm text-white/50">Loading messages…</p>
          ) : (
            <>
              <div className="border-b border-white/10 px-4 py-3">
                <p className="font-bold">{active?.guest_name || 'Customer'}</p>
                <p className="text-xs text-white/50">{active?.guest_email}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className="rounded-md bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                    {visitorKind(active)}
                  </span>
                  {active?.dpm_joined && (
                    <span className="rounded-md bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                      DPM joined
                    </span>
                  )}
                </div>
              </div>
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-white/50">Waiting for the customer’s message…</p>
                ) : (
                  messages.map((m) => <Bubble key={m.id} message={m} />)
                )}
              </div>
              <form onSubmit={handleSend} className="border-t border-white/10 p-3">
                <div className="flex items-end gap-2">
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImage} />
                  <button type="button" className="rounded-lg px-2 py-2 text-lg hover:bg-white/10" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                    📷
                  </button>
                  <textarea
                    className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
                    rows={2}
                    placeholder="Reply as shop…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold disabled:opacity-50" disabled={!draft.trim() || reply.isPending}>
                    Send
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
