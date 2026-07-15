import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { resolveImageUrl } from '../../lib/currency';
import {
  getSupportGuestProfile,
  getSupportGuestToken,
  saveSupportGuestProfile,
  useSendSupportChatMessage,
  useStartSupportChat,
  useSupportBotChoice,
  useSupportChatThread,
  useUploadSupportChatImage,
} from '../../hooks/supportChat';

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function ChatBubble({ message }) {
  const isCustomer = message.sender_type === 'customer';
  const imageSrc = message.image_url ? resolveImageUrl(message.image_url) : null;

  return (
    <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm',
          isCustomer
            ? 'rounded-br-md bg-brand-green text-white'
            : 'rounded-bl-md border border-black/8 bg-white text-[#111] dark:border-white/10 dark:bg-[#1E1E1E] dark:text-white',
        ].join(' ')}
      >
        {!isCustomer && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">Support</p>
        )}
        {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
        {imageSrc && (
          <a href={imageSrc} target="_blank" rel="noreferrer" className="mt-2 block">
            <img src={imageSrc} alt="Attachment" className="max-h-40 rounded-lg object-cover" />
          </a>
        )}
        <p className={`mt-1 text-[10px] ${isCustomer ? 'text-white/75' : 'text-muted'}`}>{formatWhen(message.created_at)}</p>
      </div>
    </div>
  );
}

export default function SupportChatWidget() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [guestForm, setGuestForm] = useState(() => {
    const saved = getSupportGuestProfile();
    return {
      name: saved?.name || user?.name || '',
      email: saved?.email || user?.email || '',
    };
  });
  const [starting, setStarting] = useState(false);
  const listRef = useRef(null);
  const fileRef = useRef(null);

  const isLoggedIn = !!user;
  const guestProfile = getSupportGuestProfile();
  const canPoll = open && (isLoggedIn || !!guestProfile?.name);

  const { data, isLoading, refetch } = useSupportChatThread(canPoll);
  const startChat = useStartSupportChat();
  const sendMessage = useSendSupportChatMessage();
  const uploadImage = useUploadSupportChatImage();
  const botChoice = useSupportBotChoice();
  const [localBotOptions, setLocalBotOptions] = useState([]);

  const conversation = data?.conversation ?? null;
  const messages = data?.messages ?? [];
  const unread = conversation?.customer_unread_count ?? 0;
  const botOptions = (data?.bot_options?.length ? data.bot_options : localBotOptions) || [];

  const needsGuestForm = !isLoggedIn && !conversation && !guestProfile?.name;

  useEffect(() => {
    if (conversation) setError('');
  }, [conversation]);

  useEffect(() => {
    if (!open || conversation || needsGuestForm) return;
    if (starting || startChat.isPending) return;

    setStarting(true);
    const payload = isLoggedIn
      ? {}
      : {
          name: guestProfile?.name || guestForm.name.trim(),
          email: guestProfile?.email || guestForm.email.trim(),
        };

    startChat
      .mutateAsync(payload)
      .then((res) => {
        if (res?.bot_options) setLocalBotOptions(res.bot_options);
        setError('');
        return refetch();
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not start chat.'))
      .finally(() => setStarting(false));
  }, [open, conversation, needsGuestForm, isLoggedIn, guestProfile, guestForm.name, guestForm.email, starting, startChat, refetch]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, botOptions.length, open]);

  const handleGuestStart = async (e) => {
    e.preventDefault();
    setError('');
    try {
      getSupportGuestToken();
      saveSupportGuestProfile({ name: guestForm.name.trim(), email: guestForm.email.trim() });
      await startChat.mutateAsync({
        name: guestForm.name.trim(),
        email: guestForm.email.trim(),
      });
      await refetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start chat.');
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sendMessage.isPending) return;
    setError('');
    setDraft('');
    try {
      await sendMessage.mutateAsync({ body: text });
    } catch (err) {
      setDraft(text);
      setError(err.response?.data?.message || 'Could not send message.');
    }
  };

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const uploaded = await uploadImage.mutateAsync(file);
      await sendMessage.mutateAsync({ image_url: uploaded.url });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send image.');
    }
  };

  const panelTitle = useMemo(() => {
    if (isLoggedIn) return `Hi ${user?.name?.split(' ')[0] || 'there'}`;
    if (guestProfile?.name) return `Hi ${guestProfile.name.split(' ')[0]}`;
    return 'Chat with us';
  }, [isLoggedIn, user, guestProfile]);

  return (
    <>
      <button
        type="button"
        aria-label="Open live chat"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-green text-2xl text-white shadow-lg ring-4 ring-brand-green/20 transition hover:scale-105 md:bottom-6"
      >
        💬
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-end p-0 md:inset-auto md:bottom-24 md:right-4 md:p-0">
          <button type="button" className="absolute inset-0 bg-black/40 md:hidden" aria-label="Close chat" onClick={() => setOpen(false)} />
          <div className="relative flex h-[min(85vh,560px)] w-full flex-col overflow-hidden rounded-t-3xl border border-black/10 bg-[#FFF9F3] shadow-2xl dark:border-white/10 dark:bg-[#121212] md:h-[520px] md:w-[380px] md:rounded-3xl">
            <div className="flex items-center justify-between border-b border-black/8 bg-brand-green px-4 py-3 text-white dark:border-white/10">
              <div>
                <p className="text-sm font-extrabold">{panelTitle}</p>
                <p className="text-xs text-white/80">We typically reply as soon as we can.</p>
              </div>
              <button type="button" className="rounded-lg px-2 py-1 text-lg leading-none hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            {error && (
              <p className="mx-3 mt-3 rounded-xl border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-red">{error}</p>
            )}

            {needsGuestForm ? (
              <form onSubmit={handleGuestStart} className="flex flex-1 flex-col gap-3 p-4">
                <p className="text-sm text-muted">Tell us how to reach you, then start chatting.</p>
                <input
                  className="input-field"
                  placeholder="Your name"
                  value={guestForm.name}
                  onChange={(e) => setGuestForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
                <input
                  type="email"
                  className="input-field"
                  placeholder="Email"
                  value={guestForm.email}
                  onChange={(e) => setGuestForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
                <button type="submit" className="btn-primary py-3" disabled={startChat.isPending}>
                  {startChat.isPending ? 'Starting…' : 'Start chat'}
                </button>
              </form>
            ) : (
              <>
                <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                  {(isLoading || starting || startChat.isPending) && messages.length === 0 && (
                    <p className="text-center text-sm text-muted">Loading chat…</p>
                  )}
                  {!isLoading && messages.length === 0 && conversation && (
                    <p className="rounded-xl bg-black/5 px-3 py-2 text-center text-sm text-muted dark:bg-white/5">
                      Send a message — our team will reply here.
                    </p>
                  )}
                  {messages.map((m) => (
                    <ChatBubble key={m.id} message={m} />
                  ))}
                  {conversation && botOptions.length > 0 && (
                    <div className="flex flex-col gap-2 pt-1">
                      {botOptions.map((opt) => (
                        <button
                          key={opt.node_key || opt.id}
                          type="button"
                          disabled={botChoice.isPending}
                          onClick={async () => {
                            setError('');
                            try {
                              const res = await botChoice.mutateAsync({
                                node_key: opt.node_key,
                                conversation_id: conversation.id,
                              });
                              if (res?.options) setLocalBotOptions(res.options);
                              else setLocalBotOptions([]);
                              await refetch();
                            } catch (err) {
                              setError(err.response?.data?.message || 'Could not send choice.');
                            }
                          }}
                          className="rounded-xl border border-brand-green/40 bg-white px-3 py-2 text-left text-sm font-semibold text-brand-green hover:bg-brand-green/10 dark:bg-[#1E1E1E]"
                        >
                          {opt.question_text || opt.node_key}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={handleSend} className="border-t border-black/8 p-3 dark:border-white/10">
                  <div className="flex items-end gap-2">
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImagePick} />
                    <button
                      type="button"
                      className="btn-ghost shrink-0 px-2 py-2 text-lg"
                      aria-label="Attach image"
                      disabled={uploadImage.isPending || !conversation}
                      onClick={() => fileRef.current?.click()}
                    >
                      📷
                    </button>
                    <textarea
                      className="input-field min-h-[44px] flex-1 resize-none py-2"
                      rows={1}
                      placeholder="Type a message…"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      disabled={!conversation}
                    />
                    <button
                      type="submit"
                      className="btn-primary shrink-0 px-4 py-2 text-sm"
                      disabled={!draft.trim() || sendMessage.isPending || !conversation}
                    >
                      Send
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
