import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { getToken } from '../../lib/api';
import { resolveImageUrl } from '../../lib/currency';
import {
  clearSupportGuestProfile,
  getSupportGuestProfile,
  getSupportGuestToken,
  saveSupportGuestProfile,
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

function ChatBubble({ message, shopName, isGuestThread }) {
  const isCustomer = message.sender_type === 'customer';
  const isSystem = message.sender_type === 'system' || message.sender_type === 'bot';
  const imageSrc = message.image_url ? resolveImageUrl(message.image_url) : null;

  if (isSystem) {
    return (
      <div className="flex justify-center px-2">
        <p className="max-w-[92%] rounded-full bg-black/5 px-3 py-1.5 text-center text-xs text-muted dark:bg-white/10">
          {message.body}
        </p>
      </div>
    );
  }

  const label = isCustomer
    ? null
    : message.sender_type === 'admin'
      ? 'DPM Support'
      : message.sender_type === 'shop'
        ? shopName || 'Shop'
        : 'Support';

  return (
    <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm',
          isCustomer
            ? isGuestThread
              ? 'rounded-br-md bg-[#c45c26] text-white'
              : 'rounded-br-md bg-brand-green text-white'
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

/** Buyer / guest storefront chat — not the staff inbox. */
export default function SupportChatWidget() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const isLoggedIn = !!getToken();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [guestForm, setGuestForm] = useState(() => {
    const saved = getSupportGuestProfile();
    return { name: saved?.name || '', email: saved?.email || '' };
  });
  const [pickingShop, setPickingShop] = useState(false);
  const [shopQuery, setShopQuery] = useState('');
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const startedForOpenRef = useRef(false);

  const guestProfile = getSupportGuestProfile();
  const isGuest = !isLoggedIn && !!guestProfile?.name;
  const canPoll = open && (isLoggedIn || isGuest);

  const { data, isLoading, isFetching, refetch } = useSupportChatThread(canPoll);
  const startChat = useStartSupportChat();
  const routeChat = useRouteSupportChat();
  const sendMessage = useSendSupportChatMessage();
  const uploadImage = useUploadSupportChatImage();
  const { data: shopResults = [], isFetching: shopsLoading } = useSearchSupportShops(shopQuery, open && pickingShop);

  const conversation = data?.conversation ?? null;
  const messages = data?.messages ?? [];
  const unread = conversation?.customer_unread_count ?? 0;
  const needsRouting = !!conversation && (conversation.routed_to === 'pending' || !conversation.routed_to);
  const shopName = conversation?.shop_name;
  const needsGuestForm = !isLoggedIn && !guestProfile?.name;
  const showBootLoading = !needsGuestForm && !conversation && (starting || isLoading || isFetching) && !startFailed;

  useEffect(() => {
    if (isLoggedIn) {
      clearSupportGuestProfile();
    }
  }, [isLoggedIn]);

  const startLiveChat = async (guestPayload = null) => {
    if (starting || startedForOpenRef.current) return;
    startedForOpenRef.current = true;
    setStarting(true);
    setStartFailed(false);
    setError('');
    try {
      if (!isLoggedIn) getSupportGuestToken();
      const res = await startChat.mutateAsync(guestPayload || {});
      const conv = res?.conversation;
      if (conv) {
        qc.setQueryData(['support-chat-thread'], (old) => ({
          success: true,
          ...(old || {}),
          conversation: conv,
          messages: old?.messages || [],
          is_guest: !!res.is_guest,
          needs_routing: (conv.routed_to || 'pending') === 'pending',
        }));
      }
      await refetch();
    } catch (err) {
      startedForOpenRef.current = false;
      setStartFailed(true);
      setError(err.response?.data?.message || 'Could not start chat.');
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!open || needsGuestForm || conversation || starting || startFailed || startedForOpenRef.current) return;
    if (isLoggedIn) {
      startLiveChat();
      return;
    }
    if (guestProfile?.name) {
      startLiveChat({ name: guestProfile.name, email: guestProfile.email });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, needsGuestForm, conversation, startFailed, isLoggedIn]);

  useEffect(() => {
    if (!open) {
      setStartFailed(false);
      startedForOpenRef.current = false;
      setPickingShop(false);
    }
  }, [open]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, open, needsRouting, pickingShop]);

  useEffect(() => {
    if (conversation?.routed_to && conversation.routed_to !== 'pending') {
      setPickingShop(false);
    }
  }, [conversation?.routed_to]);

  const handleGuestStart = async (e) => {
    e.preventDefault();
    setError('');
    const name = guestForm.name.trim();
    const email = guestForm.email.trim();
    if (!name || !email) return;
    getSupportGuestToken();
    saveSupportGuestProfile({ name, email });
    startedForOpenRef.current = false;
    await startLiveChat({ name, email });
  };

  const handleRouteDpm = async () => {
    if (!conversation?.id) return;
    setError('');
    try {
      await routeChat.mutateAsync({ conversation_id: conversation.id, route: 'dpm' });
      await refetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not connect chat.');
    }
  };

  const handleSelectShop = async (shop) => {
    if (!conversation?.id) return;
    setError('');
    setShopQuery('');
    try {
      await routeChat.mutateAsync({
        conversation_id: conversation.id,
        route: 'shop',
        shop_id: shop.id,
      });
      await refetch();
      setPickingShop(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not connect to that shop.');
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !conversation || sendMessage.isPending) return;
    setError('');
    setDraft('');
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
    if (!file || !conversation) return;
    setError('');
    try {
      const uploaded = await uploadImage.mutateAsync(file);
      await sendMessage.mutateAsync({ image_url: uploaded.url });
      await refetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send image.');
    }
  };

  const panelTitle = useMemo(() => {
    if (isLoggedIn) return `Hi ${user?.name?.split(' ')[0] || 'there'}`;
    if (guestProfile?.name) return `Hi ${guestProfile.name.split(' ')[0]}`;
    return 'Chat with us';
  }, [isLoggedIn, user, guestProfile]);

  const subtitle = useMemo(() => {
    if (!isLoggedIn && (isGuest || needsGuestForm)) return 'Guest chat · Support can see your messages';
    if (conversation?.routed_to === 'shop') return shopName ? `Connected with ${shopName}` : 'Connected with a shop';
    if (conversation?.routed_to === 'dpm') return 'Connected with DPM Support';
    return 'We typically reply as soon as we can.';
  }, [isLoggedIn, isGuest, needsGuestForm, conversation, shopName]);

  const canCompose = !!conversation && conversation.routed_to !== 'pending';
  const headerClass = isLoggedIn
    ? 'border-b border-black/8 bg-brand-green px-4 py-3 text-white dark:border-white/10'
    : 'border-b border-black/8 bg-[#c45c26] px-4 py-3 text-white dark:border-white/10';

  return (
    <>
      <button
        type="button"
        aria-label="Open customer live chat"
        onClick={() => setOpen((v) => !v)}
        className={[
          'fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white shadow-lg transition hover:scale-105 md:bottom-6',
          isLoggedIn ? 'bg-brand-green ring-4 ring-brand-green/20' : 'bg-[#c45c26] ring-4 ring-[#c45c26]/25',
        ].join(' ')}
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
            <div className={`flex items-center justify-between ${headerClass}`}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/80">
                  {isLoggedIn ? 'Customer chat' : 'Guest chat'}
                </p>
                <p className="text-sm font-extrabold">{panelTitle}</p>
                <p className="text-xs text-white/80">{subtitle}</p>
              </div>
              <button type="button" className="rounded-lg px-2 py-1 text-lg leading-none hover:bg-white/10" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            {error && (
              <div className="mx-3 mt-3 rounded-xl border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-red">
                <p>{error}</p>
                {startFailed && (
                  <button
                    type="button"
                    className="mt-2 font-bold underline"
                    onClick={() => {
                      setStartFailed(false);
                      setError('');
                      startedForOpenRef.current = false;
                    }}
                  >
                    Try again
                  </button>
                )}
              </div>
            )}

            {needsGuestForm ? (
              <form onSubmit={handleGuestStart} className="flex flex-1 flex-col gap-3 p-4">
                <p className="text-sm font-bold text-[#111] dark:text-white">Continue as guest</p>
                <p className="text-sm text-muted">
                  Tell us your name and email so support can reply. Or{' '}
                  <Link to="/login" className="font-bold text-brand-green underline" onClick={() => setOpen(false)}>
                    sign in
                  </Link>{' '}
                  for a full account chat.
                </p>
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
                <button type="submit" className="btn-primary py-3" disabled={startChat.isPending || starting}>
                  {startChat.isPending || starting ? 'Starting…' : 'Start guest chat'}
                </button>
              </form>
            ) : (
              <>
                {!isLoggedIn && (
                  <div className="mx-3 mt-3 rounded-xl border border-[#c45c26]/35 bg-[#c45c26]/10 px-3 py-2 text-xs">
                    You’re chatting as a <strong>guest</strong>. Messages are saved for DPM support.{' '}
                    <Link to="/login" className="font-bold text-brand-green underline" onClick={() => setOpen(false)}>
                      Sign in
                    </Link>{' '}
                    for an account chat.
                  </div>
                )}

                <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                  {showBootLoading && <p className="text-center text-sm text-muted">Loading chat…</p>}

                  {messages.map((m) => (
                    <ChatBubble key={m.id} message={m} shopName={shopName} isGuestThread={!isLoggedIn} />
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
                        onClick={() => {
                          setPickingShop(true);
                          setShopQuery('');
                        }}
                        className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-left text-sm font-bold shadow-sm hover:bg-black/5 dark:border-white/15 dark:bg-[#1E1E1E]"
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
                      <button type="button" className="text-xs font-semibold text-muted hover:underline" onClick={() => setPickingShop(false)}>
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
