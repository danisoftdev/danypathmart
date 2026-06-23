import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { formatPrice } from '../../lib/currency';
import { hasPermission } from '../../lib/permissions';
import { useAuthStore } from '../../store/authStore';
import PosReceiptPrint from '../../components/pos/PosReceiptPrint';
import {
  usePosBootstrap,
  usePosCloseShift,
  usePosCompleteSale,
  usePosOpenShift,
  usePosProductSearch,
  usePosQuote,
  usePosShiftCurrent,
} from '../../hooks/pos';

const PAY_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'momo', label: 'Mobile money' },
  { id: 'card', label: 'Card' },
  { id: 'paystack', label: 'Paystack' },
];

export default function PosTerminalPage() {
  const user = useAuthStore((s) => s.user);
  const canUse = user?.role === 'super_admin' || hasPermission(user, 'use_pos');

  const [registerId, setRegisterId] = useState(() => Number(localStorage.getItem('pos_register_id') || 0));
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [openingFloat, setOpeningFloat] = useState('0');
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');
  const [payAmount, setPayAmount] = useState('');
  const [momoRef, setMomoRef] = useState('');
  const [sendSms, setSendSms] = useState(true);
  const [receipt, setReceipt] = useState(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [varianceNote, setVarianceNote] = useState('');
  const [error, setError] = useState('');

  const { data: boot, isLoading: bootLoading } = usePosBootstrap(registerId, canUse);
  const { data: shiftData } = usePosShiftCurrent(registerId, registerId > 0 && canUse);
  const shift = shiftData?.shift ?? boot?.shift;
  const { data: products } = usePosProductSearch(search, canUse && !!shift);

  const quoteItems = useMemo(() => cart.map((c) => ({ product_id: c.id, quantity: c.qty })), [cart]);
  const quoteMut = usePosQuote();
  const openShift = usePosOpenShift();
  const closeShift = usePosCloseShift();
  const completeSale = usePosCompleteSale();

  useEffect(() => {
    if (registerId > 0) localStorage.setItem('pos_register_id', String(registerId));
  }, [registerId]);

  useEffect(() => {
    if (quoteItems.length === 0) return;
    quoteMut.mutate({ items: quoteItems, discount_amount: discount });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quote on cart/discount only
  }, [quoteItems, discount]);

  const quote = quoteMut.data;
  const total = quote?.total ?? 0;

  if (!canUse) {
    return <Navigate to="/admin" replace />;
  }

  if (!bootLoading && boot && !boot.settings?.pos_module_enabled) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="text-lg font-bold">POS is not enabled</p>
        <p className="mt-2 text-sm text-white/60">Enable it under Admin → POS setup.</p>
      </div>
    );
  }

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        return prev.map((p) => (p.id === product.id ? { ...p, qty: p.qty + 1 } : p));
      }
      return [...prev, { ...product, qty: 1 }];
    });
    setSearch('');
  };

  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((p) => (p.id === id ? { ...p, qty: p.qty + delta } : p))
        .filter((p) => p.qty > 0)
    );
  };

  const handleOpenShift = async () => {
    setError('');
    try {
      await openShift.mutateAsync({ register_id: registerId, opening_float: Number(openingFloat) || 0 });
    } catch (e) {
      setError(e.response?.data?.message || 'Could not open shift.');
    }
  };

  const handleCloseShift = async () => {
    setError('');
    try {
      await closeShift.mutateAsync({
        shift_id: shift.id,
        counted_cash: Number(countedCash) || 0,
        variance_note: varianceNote,
      });
      setCloseOpen(false);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not close shift.');
    }
  };

  const handleComplete = async () => {
    setError('');
    const amount = payAmount !== '' ? Number(payAmount) : total;
    const payments = [{ method: payMethod, amount, reference: payMethod === 'momo' ? momoRef : undefined }];
    try {
      const res = await completeSale.mutateAsync({
        shift_id: shift.id,
        items: quoteItems,
        discount_amount: discount,
        payments,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        send_sms: sendSms && !!customerPhone,
      });
      setCart([]);
      setDiscount(0);
      setCustomerName('');
      setCustomerPhone('');
      setPayOpen(false);
      setReceipt(res.receipt);
    } catch (e) {
      setError(e.response?.data?.message || 'Sale failed.');
    }
  };

  if (!shift) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-extrabold">Open register shift</h1>
        <p className="mt-1 text-sm text-white/60">Select a register and enter your opening float.</p>
        {error && <p className="mt-4 rounded-lg bg-brand-red/20 px-3 py-2 text-sm text-brand-red">{error}</p>}
        <label className="mt-6 block text-sm">
          <span className="mb-1 block font-semibold">Register</span>
          <select
            className="input-field w-full bg-[#1a1f26] text-white"
            value={registerId || ''}
            onChange={(e) => setRegisterId(Number(e.target.value))}
          >
            <option value="">Choose register…</option>
            {(boot?.registers ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.location_name} — {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-semibold">Opening float (GHS)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input-field w-full bg-[#1a1f26] text-white"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn-primary mt-6 min-h-[48px] w-full"
          disabled={!registerId || openShift.isPending}
          onClick={handleOpenShift}
        >
          {openShift.isPending ? 'Opening…' : 'Open shift'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col lg:flex-row">
      <div className="flex flex-1 flex-col border-r border-white/10 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            <p className="font-bold">{shift.location_name} · {shift.register_name}</p>
            <p className="text-white/50">Shift #{shift.id} · {shift.opened_by_name}</p>
          </div>
          <button type="button" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold" onClick={() => setCloseOpen(true)}>
            Close shift
          </button>
        </div>
        <input
          className="input-field mb-3 w-full bg-[#1a1f26] text-white"
          placeholder="Search product name or scan ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="grid flex-1 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3 xl:grid-cols-4">
          {(products?.data ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              className="rounded-xl border border-white/10 bg-[#1a1f26] p-3 text-left transition hover:border-brand-green/50"
              onClick={() => addToCart(p)}
            >
              <p className="line-clamp-2 text-sm font-bold">{p.name}</p>
              <p className="mt-1 text-brand-green">{formatPrice(p.price)}</p>
              <p className="text-xs text-white/40">Stock {p.stock_qty}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col border-t border-white/10 p-4 lg:w-96 lg:border-t-0">
        <h2 className="font-extrabold">Cart</h2>
        {error && <p className="mt-2 rounded-lg bg-brand-red/20 px-3 py-2 text-xs text-brand-red">{error}</p>}
        <ul className="mt-3 flex-1 space-y-2 overflow-auto">
          {cart.length === 0 && <p className="text-sm text-white/40">Add products from the left.</p>}
          {cart.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded-lg bg-[#1a1f26] p-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{item.name}</p>
                <p className="text-xs text-white/50">{formatPrice(item.price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="h-8 w-8 rounded bg-white/10" onClick={() => updateQty(item.id, -1)}>−</button>
                <span className="w-6 text-center">{item.qty}</span>
                <button type="button" className="h-8 w-8 rounded bg-white/10" onClick={() => updateQty(item.id, 1)}>+</button>
              </div>
            </li>
          ))}
        </ul>
        <label className="mt-3 block text-xs">
          <span className="font-semibold">Discount (GHS)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input-field mt-1 w-full bg-[#1a1f26] text-white"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
          />
        </label>
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatPrice(quote?.subtotal ?? 0)}</span>
          </div>
          <div className="mt-1 flex justify-between text-lg font-extrabold text-brand-green">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary mt-4 min-h-[52px] w-full text-base"
          disabled={cart.length === 0 || completeSale.isPending}
          onClick={() => {
            setPayAmount(String(total));
            setPayOpen(true);
          }}
        >
          Charge {formatPrice(total)}
        </button>
      </div>

      {payOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#1a1f26] p-6">
            <h3 className="text-lg font-extrabold">Payment</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {PAY_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`rounded-lg px-3 py-2 text-sm font-bold ${payMethod === m.id ? 'bg-brand-green text-black' : 'bg-white/10'}`}
                  onClick={() => setPayMethod(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm">
              <span className="font-semibold">Amount (GHS)</span>
              <input
                type="number"
                className="input-field mt-1 w-full bg-[#0f1419] text-white"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </label>
            {payMethod === 'momo' && (
              <label className="mt-3 block text-sm">
                <span className="font-semibold">MoMo reference *</span>
                <input className="input-field mt-1 w-full bg-[#0f1419] text-white" value={momoRef} onChange={(e) => setMomoRef(e.target.value)} />
              </label>
            )}
            <label className="mt-3 block text-sm">
              <span className="font-semibold">Customer name</span>
              <input className="input-field mt-1 w-full bg-[#0f1419] text-white" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-semibold">Customer phone (for SMS receipt)</span>
              <input className="input-field mt-1 w-full bg-[#0f1419] text-white" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />
              Send SMS receipt
            </label>
            <div className="mt-6 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setPayOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary flex-1" disabled={completeSale.isPending} onClick={handleComplete}>
                {completeSale.isPending ? 'Processing…' : 'Complete sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {closeOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#1a1f26] p-6">
            <h3 className="text-lg font-extrabold">Close shift</h3>
            <p className="mt-1 text-sm text-white/60">Count cash in drawer. A supervisor must approve.</p>
            <label className="mt-4 block text-sm">
              <span className="font-semibold">Counted cash (GHS)</span>
              <input type="number" className="input-field mt-1 w-full bg-[#0f1419] text-white" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-semibold">Variance note (if needed)</span>
              <input className="input-field mt-1 w-full bg-[#0f1419] text-white" value={varianceNote} onChange={(e) => setVarianceNote(e.target.value)} />
            </label>
            <div className="mt-6 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setCloseOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary flex-1" disabled={closeShift.isPending} onClick={handleCloseShift}>
                Submit for approval
              </button>
            </div>
          </div>
        </div>
      )}

      {receipt && <PosReceiptPrint receipt={receipt} onDone={() => setReceipt(null)} />}
    </div>
  );
}
