import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useAdminReplySupportChat,
  useAdminSupportChatConversation,
  useAdminSupportChatConversations,
  useAdminUploadSupportChatImage,
} from '../../hooks/supportChat';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import { resolveImageUrl } from '../../lib/currency';

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function MessageBubble({ message }) {
  const isAdmin = message.sender_type === 'admin';
  const imageSrc = message.image_url ? resolveImageUrl(message.image_url) : null;

  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
          isAdmin ? 'bg-brand-green text-white' : 'border border-black/8 bg-white dark:border-white/10 dark:bg-[#1E1E1E]',
        ].join(' ')}
      >
        {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
        {imageSrc && (
          <a href={imageSrc} target="_blank" rel="noreferrer" className="mt-2 block">
            <img src={imageSrc} alt="Attachment" className="max-h-48 rounded-lg object-cover" />
          </a>
        )}
        <p className={`mt-1 text-[10px] ${isAdmin ? 'text-white/75' : 'text-muted'}`}>{formatWhen(message.created_at)}</p>
      </div>
    </div>
  );
}

export default function AdminSupportChatPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = Number(params.get('c') || 0) || null;
  const [filter, setFilter] = useState('open');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const fileRef = useRef(null);

  const { data: listData, isLoading: listLoading } = useAdminSupportChatConversations(filter);
  const { data: threadData, isLoading: threadLoading } = useAdminSupportChatConversation(selectedId, !!selectedId);
  const reply = useAdminReplySupportChat();
  const upload = useAdminUploadSupportChatImage();

  const conversations = listData?.conversations ?? [];
  const messages = threadData?.messages ?? [];
  const active = threadData?.conversation ?? null;

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, selectedId]);

  const selectConversation = (id) => {
    setParams(id ? { c: String(id) } : {});
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setError('');
    const text = draft.trim();
    setDraft('');
    try {
      await reply.mutateAsync({ id: selectedId, body: text });
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
      await reply.mutateAsync({ id: selectedId, image_url: uploaded.url });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send image.');
    }
  };

  const headerSubtitle = useMemo(() => {
    if (!active) return 'Reply to storefront live chat messages.';
    return `${active.guest_name || 'Customer'} · ${active.guest_email || '—'}`;
  }, [active]);

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Live chat"
        subtitle={headerSubtitle}
        actions={(
          <Link to="/admin/contact-inbox" className="btn-ghost px-3 py-2 text-sm">
            Contact form inbox
          </Link>
        )}
      />

      {error && <AdminPageAlert type="error" message={error} onDismiss={() => setError('')} />}

      <div className="mb-3 flex flex-wrap gap-2">
        {['open', 'closed', 'all'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={filter === s ? 'admin-mobile-pill-active' : 'admin-mobile-pill'}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
        <div className="admin-panel max-h-[70vh] overflow-y-auto p-2">
          {listLoading ? (
            <AdminTableSkeleton rows={6} cols={1} />
          ) : conversations.length === 0 ? (
            <p className="p-3 text-sm text-muted">No conversations yet.</p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectConversation(c.id)}
                    className={[
                      'w-full rounded-xl px-3 py-2 text-left text-sm transition',
                      selectedId === c.id ? 'bg-brand-green/15 ring-1 ring-brand-green/40' : 'hover:bg-black/5 dark:hover:bg-white/5',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold">{c.guest_name || 'Customer'}</span>
                      {c.admin_unread_count > 0 && (
                        <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-bold text-white">
                          {c.admin_unread_count}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted">{c.guest_email}</p>
                    <p className="mt-1 truncate text-xs">{c.last_preview || '—'}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-panel flex min-h-[420px] max-h-[70vh] flex-col">
          {!selectedId ? (
            <p className="flex flex-1 items-center justify-center p-6 text-sm text-muted">Select a conversation to reply.</p>
          ) : threadLoading ? (
            <div className="p-4"><AdminTableSkeleton rows={4} cols={1} /></div>
          ) : (
            <>
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              </div>
              <form onSubmit={handleReply} className="border-t border-black/8 p-3 dark:border-white/10">
                <div className="flex items-end gap-2">
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImage} />
                  <button type="button" className="btn-ghost px-2 py-2" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                    📷
                  </button>
                  <textarea
                    className="input-field min-h-[44px] flex-1 resize-none py-2"
                    rows={2}
                    placeholder="Reply to customer…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={!draft.trim() || reply.isPending}>
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
