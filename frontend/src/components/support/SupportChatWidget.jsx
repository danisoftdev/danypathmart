import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { getToken } from '../../lib/api';
import { resolveImageUrl } from '../../lib/currency';
import {
  clearEphemeralChat,
  getEphemeralChat,
  saveEphemeralChat,
  useRouteSupportChat,
  useSearchSupportShops,
  useSendSupportChatMessage,
  useStartSupportChat,
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

function senderLabel(message, shopName) {
  switch (message.sender_type) {
    case 'customer':
      return null;
    case 'admin':
      return 'DPM Support';
    case 'shop':
      return shopName || 'Shop';
    case 'system':
    case 'bot':
      return 'Chat';
    default:
      return 'Support';
  }
}

function ChatBubble({ message, shopName }) {
  const isCustomer = message.sender_type === 'customer';
  const isSystem = message.sender_type === 'system' || message.sender_type === 'bot';
  const imageSrc = message.image_url ? resolveImageUrl(message.image_url) : null;
  const label = senderLabel(message, shopName);

  if (isSystem) {
    return (
      <div className="flex justify-center px-2">
        <p className="max-w-[92%] rounded-full bg-black/5 px-3 py-1.5 text-center text-xs text-muted dark:bg-white/10">
          {message.body}
        </p>
      </div>
    );
  }

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
        {label && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
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

function emptyEphemeral(name = 'Guest') {
  return {
    name,
    route: 'pending',
    shop: null,
    messages: [
      {
        id: 'sys-1',
        sender_type: 'system',
        body: 'Hi! How can we help you today? Is this about Danypath Mart, or a shop?',
        created_at: new Date().toISOString(),
      },
    ],
  };
}

export default function SupportChatWidget() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasSession = isAuthenticated || !!getToken();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState(() => (getToken() ? 'live' : getEphemeralChat() ? 'ephemeral' : 'gate'));
  const [ephemeral, setEphemeral] = useState(() => getEphemeralChat());
  const [shopQuery, setShopQuery] = useState('');
  const [pickingShopLive, setPickingShopLive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const startAttemptRef = useRef(0);

  const canPoll = open && hasSession && mode === 'live';

  const { data, isLoading, isFetching, refetch } = useSupportChatThread(canPoll);
  const startChat = useStartSupportChat();
  const routeChat = useRouteSupportChat();
  const sendMessage = useSendSupportChatMessage();
  const uploadImage = useUploadSupportChatImage();

  const conversation = mode === 'live' ? data?.conversation ?? null : null;
  const liveMessages = mode === 'live' ? data?.messages ?? [] : [];
  const unread = conversation?.customer_unread_count ?? 0;
  const needsRouting = mode === 'live'
    ? !!conversation && (conversation.routed_to === 'pending' || !conversation.routed_to)
    : mode === 'ephemeral' && ephemeral?.route === 'pending';
  const pickingShop = mode === 'live'
    ? needsRouting && pickingShopLive
    : mode === 'ephemeral' && ephemeral?.route === 'pick_shop';
  const shopName = mode === 'live'
    ? conversation?.shop_name
    : ephemeral?.shop?.name;

  const { data: shopResults = [], isFetching: shopsLoading } = useSearchSupportShops(
    shopQuery,
    open && pickingShop
  );

  const messages = mode === 'ephemeral' ? (ephemeral?.messages ?? []) : liveMessages;

  // Prefer session token over user object so chat doesn't reset while /auth/me loads.
  useEffect(() => {
    if (hasSession) {
      setMode('live');
      clearEphemeralChat();
      setEphemeral(null);
      return;
    }
    setMode((prev) => {
      if (prev === 'ephemeral') return 'ephemeral';
      return getEphemeralChat() ? 'ephemeral' : 'gate';
    });
  }, [hasSession]);

  const startLiveChat = async () => {
    if (!hasSession || mode !== 'live' || starting) return;
    setStarting(true);
    setStartFailed(false);
    setError('');
    const attempt = ++startAttemptRef.current;
    try {
      const res = await startChat.mutateAsync({});
      if (attempt !== startAttemptRef.current) return;
      if (res?.conversation) {
        qc.setQueryData(['support-chat-thread'], (old) => ({
          ...(old || {}),
          conversation: res.conversation,
          messages: old?.messages || [],
          needs_routing: (res.conversation.routed_to || 'pending') === 'pending',
        }));
      }
      await refetch();
    } catch (err) {
      if (attempt !== startAttemptRef.current) return;
      setStartFailed(true);
      setError(err.response?.data?.message || 'Could not start chat.');
    } finally {
      if (attempt === startAttemptRef.current) setStarting(false);
    }
  };

  useEffect(() => {
    if (!open || !hasSession || mode !== 'live') return;
    if (conversation || starting || startFailed) return;
    startLiveChat();
    // Intentionally only when open/session/conversation/failure state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasSession, mode, conversation, startFailed]);

  useEffect(() => {
    if (!open) {
      setStartFailed(false);
      startAttemptRef.current += 1;
    }
  }, [open]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, open, needsRouting, pickingShop]);

  useEffect(() => {
    if (mode === 'ephemeral' && ephemeral) saveEphemeralChat(ephemeral);
  }, [mode, ephemeral]);

  useEffect(() => {
    if (conversation?.routed_to && conversation.routed_to !== 'pending') {
      setPickingShopLive(false);
    }
  }, [conversation?.routed_to]);

  const continueWithoutAccount = () => {
    if (hasSession) return;
    const next = emptyEphemeral('Guest');
    setEphemeral(next);
    saveEphemeralChat(next);
    setMode('ephemeral');
    setError('');
    setShopQuery('');
  };

  const persistEphemeral = (updater) => {
    setEphemeral((prev) => {
      const base = prev || emptyEphemeral();
      const next = typeof updater === 'function' ? updater(base) : updater;
      saveEphemeralChat(next);
      return next;
    });
  };

  const handleRouteDpm = async () => {
    setError('');
    if (mode === 'ephemeral') {
      persistEphemeral((prev) => ({
        ...prev,
        route: 'dpm',
        messages: [
          ...prev.messages,
          {
            id: `sys-${Date.now()}`,
            sender_type: 'system',
            body: "You're chatting with Danypath Mart support. This preview chat is not saved — sign in so our team can reply.",
            created_at: new Date().toISOString(),
          },
        ],
      }));
      return;
    }
    if (!conversation?.id) return;
    try {
      const res = await routeChat.mutateAsync({ conversation_id: conversation.id, route: 'dpm' });
      if (res?.conversation) {
        qc.setQueryData(['support-chat-thread'], (old) => ({
          ...(old || {}),
          conversation: res.conversation,
          messages: [...(old?.messages || []), ...(res.message ? [res.message] : [])],
          needs_routing: false,
        }));
      }
      await refetch();
      setPickingShopLive(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not connect chat.');
    }
  };

  const handlePickShopMode = () => {
    setError('');
    setShopQuery('');
    if (mode === 'ephemeral') {
      persistEphemeral((prev) => ({ ...prev, route: 'pick_shop' }));
      return;
    }
    setPickingShopLive(true);
  };

  const handleSelectShop = async (shop) => {
    setError('');
    setShopQuery('');
    if (mode === 'ephemeral') {
      persistEphemeral((prev) => ({
        ...prev,
        route: 'shop',
        shop: { id: shop.id, name: shop.name },
        messages: [
          ...prev.messages,
          {
            id: `sys-${Date.now()}`,
            sender_type: 'system',
            body: `You're chatting with ${shop.name}. This preview chat is not saved — sign in so the shop can reply.`,
            created_at: new Date().toISOString(),
          },
        ],
      }));
      return;
    }
    if (!conversation?.id) return;
    try {
      const res = await routeChat.mutateAsync({
        conversation_id: conversation.id,
        route: 'shop',
        shop_id: shop.id,
      });
      if (res?.conversation) {
        qc.setQueryData(['support-chat-thread'], (old) => ({
          ...(old || {}),
          conversation: res.conversation,
          messages: [...(old?.messages || []), ...(res.message ? [res.message] : [])],
          needs_routing: false,
        }));
      }
      await refetch();
      setPickingShopLive(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not connect to that shop.');
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setError('');
    setDraft('');

    if (mode === 'ephemeral') {
      persistEphemeral((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: `c-${Date.now()}`,
            sender_type: 'customer',
            body: text,
            created_at: new Date().toISOString(),
          },
          {
            id: `sys-${Date.now() + 1}`,
            sender_type: 'system',
            body: 'This chat is not saved. Sign in to send it to support.',
            created_at: new Date().toISOString(),
          },
        ],
      }));
      return;
    }

    if (sendMessage.isPending || !conversation) return;
    try {
      await sendMessage.mutateAsync({ body: text });
      await refetch();
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

    if (mode === 'ephemeral') {
      setError('Sign in to send photos — preview chats are not saved.');
      return;
    }

    try {
      const uploaded = await uploadImage.mutateAsync(file);
      await sendMessage.mutateAsync({ image_url: uploaded.url });
      await refetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send image.');
    }
  };

  const panelTitle = useMemo(() => {
    if (hasSession) return `Hi ${user?.name?.split(' ')[0] || 'there'}`;
    if (mode === 'ephemeral') return 'Preview chat';
    return 'Chat with us';
  }, [hasSession, user, mode]);

  const subtitle = useMemo(() => {
    if (mode === 'ephemeral') return 'Not saved · Sign in for real replies';
    if (conversation?.routed_to === 'shop') return shopName ? `Connected with ${shopName}` : 'Connected with a shop';
    if (conversation?.routed_to === 'dpm') return 'Connected with DPM Support';
    return 'We typically reply as soon as we can.';
  }, [mode, conversation, shopName]);

  const canCompose = mode === 'ephemeral'
    ? ephemeral?.route === 'dpm' || ephemeral?.route === 'shop'
    : !!conversation && conversation.routed_to !== 'pending';

  const showBootLoading = mode === 'live' && hasSession && !conversation && (starting || isLoading || isFetching) && !startFailed;

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
                <p className="text-xs text-white/80">{subtitle}</p>
              </div>
              <button type="button" className="rounded-lg px-2 py-1 text-lg leading-none hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            {error && (
              <div className="mx-3 mt-3 rounded-xl border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-red">
                <p>{error}</p>
                {startFailed && mode === 'live' && (
                  <button
                    type="button"
                    className="mt-2 font-bold underline"
                    onClick={() => {
                      setStartFailed(false);
                      setError('');
                    }}
                  >
                    Try again
                  </button>
                )}
              </div>
            )}

            {mode === 'gate' ? (
              <div className="flex flex-1 flex-col justify-center gap-3 p-5">
                <p className="text-base font-extrabold text-[#111] dark:text-white">Let’s get you help</p>
                <p className="text-sm text-muted">
                  Sign in so we can save your chat and reply. Or preview without an account — that chat won’t be saved.
                </p>
                <Link
                  to="/login"
                  state={{ from: typeof window !== 'undefined' ? window.location.pathname : '/' }}
                  className="btn-primary py-3 text-center"
                  onClick={() => setOpen(false)}
                >
                  Sign in to chat
                </Link>
                <Link
                  to="/register"
                  state={{ from: typeof window !== 'undefined' ? window.location.pathname : '/' }}
                  className="btn-ghost py-3 text-center"
                  onClick={() => setOpen(false)}
                >
                  Create an account
                </Link>
                <button type="button" className="text-sm font-semibold text-brand-green hover:underline" onClick={continueWithoutAccount}>
                  Continue without account
                </button>
              </div>
            ) : (
              <>
                {mode === 'ephemeral' && (
                  <div className="mx-3 mt-3 rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-3 py-2 text-xs">
                    Preview only — not saved.{' '}
                    <Link to="/login" className="font-bold text-brand-green underline" onClick={() => setOpen(false)}>
                      Sign in
                    </Link>{' '}
                    for real support.
                  </div>
                )}

                <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                  {showBootLoading && (
                    <p className="text-center text-sm text-muted">Loading chat…</p>
                  )}

                  {messages.map((m) => (
                    <ChatBubble key={m.id} message={m} shopName={shopName} />
                  ))}

                  {needsRouting && !pickingShop && (
                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        type="button"
                        disabled={routeChat.isPending}
                        onClick={handleRouteDpm}
                        className="rounded-2xl border border-brand-green/40 bg-white px-4 py-3 text-left text-sm font-bold text-brand-green shadow-sm hover:bg-brand-green/10 dark:bg-[#1E1E1E]"
                      >
                        Danypath Mart (orders, payments, account)
                      </button>
                      <button
                        type="button"
                        disabled={routeChat.isPending}
                        onClick={handlePickShopMode}
                        className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-left text-sm font-bold shadow-sm hover:bg-black/5 dark:border-white/15 dark:bg-[#1E1E1E] dark:hover:bg-white/5"
                      >
                        A shop (product or seller)
                      </button>
                    </div>
                  )}

                  {pickingShop && (
                    <div className="space-y-2 rounded-2xl border border-black/8 bg-white p-3 dark:border-white/10 dark:bg-[#1E1E1E]">
                      <p className="text-sm font-bold">Which shop?</p>
                      <input
                        className="input-field"
                        placeholder="Search shop name…"
                        value={shopQuery}
                        onChange={(e) => setShopQuery(e.target.value)}
                        autoFocus
                      />
                      {shopsLoading && <p className="text-xs text-muted">Searching…</p>}
                      {!shopsLoading && shopQuery.trim() && shopResults.length === 0 && (
                        <p className="text-xs text-muted">No shops match that name.</p>
                      )}
                      <ul className="max-h-40 space-y-1 overflow-y-auto">
                        {shopResults.map((shop) => (
                          <li key={shop.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectShop(shop)}
                              className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-brand-green/10"
                            >
                              {shop.name}
                              {shop.city ? <span className="ml-1 text-xs font-normal text-muted">· {shop.city}</span> : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="text-xs font-semibold text-muted hover:underline"
                        onClick={() => {
                          setPickingShopLive(false);
                          setShopQuery('');
                          if (mode === 'ephemeral') {
                            persistEphemeral((prev) => ({ ...prev, route: 'pending' }));
                          }
                        }}
                      >
                        ← Back
                      </button>
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
                      disabled={uploadImage.isPending || !canCompose}
                      onClick={() => fileRef.current?.click()}
                    >
                      📷
                    </button>
                    <textarea
                      className="input-field min-h-[44px] flex-1 resize-none py-2"
                      rows={1}
                      placeholder={canCompose ? 'Type a message…' : 'Choose an option above…'}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      disabled={!canCompose}
                    />
                    <button
                      type="submit"
                      className="btn-primary shrink-0 px-4 py-2 text-sm"
                      disabled={!draft.trim() || sendMessage.isPending || !canCompose}
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
