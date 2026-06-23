import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { formatPrice } from '../../lib/currency';
import { hasPermission } from '../../lib/permissions';
import { useAuthStore } from '../../store/authStore';
import PosReceiptPrint from '../../components/pos/PosReceiptPrint';
import {
  usePosBarcodeLookup,
  usePosBootstrap,
  usePosCloseShift,
  usePosCompleteSale,
  usePosOpenShift,
  usePosPaystackInit,
  usePosPaystackVerify,
  usePosProductSearch,
  usePosQuote,
  usePosShiftCurrent,
  usePosShiftReport,
  usePosVoidSale,
  usePosSaleReceipt,
} from '../../hooks/pos';

const PAY_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'momo', label: 'Mobile money' },
  { id: 'paystack', label: 'Paystack' },
];

function emptyPayment() {
  return { method: 'cash', amount: '', reference: '' };
}

export default function PosTerminalPage() {
  const user = useAuthStore((s) => s.user);
  const canUse = user?.role === 'super_admin' || hasPermission(user, 'use_pos');
  const canSupervise = user?.role === 'super_admin' || hasPermission(user, 'manage_pos_shifts');

  const scanRef = useRef(null);
  const [registerId, setRegisterId] = useState(() => Number(localStorage.getItem('pos_register_id') || 0));
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [openingFloat, setOpeningFloat] = useState('0');
  const [payOpen, setPayOpen] = useState(false);
  const [splitPay, setSplitPay] = useState(false);
  const [payments, setPayments] = useState([emptyPayment()]);
  const [cashTendered, setCashTendered] = useState('');
  const [sendSms, setSendSms] = useState(true);
  const [receipt, setReceipt] = useState(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [voidSale, setVoidSale] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidPin, setVoidPin] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [varianceNote, setVarianceNote] = useState('');
  const [error, setError] = useState('');
  const [scanFlash, setScanFlash] = useState('');

  const { data: boot, isLoading: bootLoading } = usePosBootstrap(registerId, canUse);
  const { data: shiftData, refetch: refetchShift } = usePosShiftCurrent(registerId, registerId > 0 && canUse);
  const shift = shiftData?.shift ?? boot?.shift;
  const shiftSales = shiftData?.sales ?? [];
  const { data: products } = usePosProductSearch(search, canUse && !!shift && !scanFlash);
  const { data: xReport } = usePosShiftReport(shift?.id, 'x', reportOpen && !!shift?.id);

  const quoteItems = useMemo(() => cart.map((c) => ({ product_id: c.id, quantity: c.qty })), [cart]);
  const quoteMut = usePosQuote();
  const barcodeLookup = usePosBarcodeLookup();
  const openShift = usePosOpenShift();
  const closeShift = usePosCloseShift();
  const completeSale = usePosCompleteSale();
  const paystackInit = usePosPaystackInit();
  const paystackVerify = usePosPaystackVerify();
  const voidMut = usePosVoidSale();
  const saleReceipt = usePosSaleReceipt();

  useEffect(() => {
    if (registerId > 0) localStorage.setItem('pos_register_id', String(registerId));
  }, [registerId]);

  useEffect(() => {
    if (quoteItems.length === 0) return;
    quoteMut.mutate({ items: quoteItems, discount_amount: discount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteItems, discount]);

  useEffect(() => {
    if (shift && scanRef.current) scanRef.current.focus();
  }, [shift]);

  const quote = quoteMut.data;
  const total = quote?.total ?? 0;

  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        return prev.map((p) => (p.id === product.id ? { ...p, qty: p.qty + 1 } : p));
      }
      return [...prev, { ...product, qty: 1 }];
    });
    setSearch('');
    setScanFlash('ok');
    setTimeout(() => setScanFlash(''), 300);
  }, []);

  const handleScanSubmit = async (code) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError('');
    try {
      const res = await barcodeLookup.mutateAsync(trimmed);
      if (res?.data) {
        addToCart(res.data);
        return;
      }
    } catch {
      const match = (products?.data ?? []).find(
        (p) => String(p.id) === trimmed || p.barcode === trimmed
      );
      if (match) {
        addToCart(match);
        return;
      }
      setScanFlash('err');
      setTimeout(() => setScanFlash(''), 500);
      setError(`No product for barcode: ${trimmed}`);
    }
    setSearch('');
  };

  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev.map((p) => (p.id === id ? { ...p, qty: p.qty + delta } : p)).filter((p) => p.qty > 0)
    );
  };

  const payRemaining = useMemo(() => {
    if (!splitPay) return total;
    const sum = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
    return Math.max(0, round2(total - sum));
  }, [splitPay, payments, total]);

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  const changeDue = useMemo(() => {
    if (splitPay) return 0;
    const p = payments[0];
    if (p?.method !== 'cash') return 0;
    const tendered = cashTendered !== '' ? Number(cashTendered) : Number(p.amount) || total;
    return tendered > total ? round2(tendered - total) : 0;
  }, [cashTendered, payments, splitPay, total]);

  const buildPaymentsPayload = () => {
    if (!splitPay) {
      const p = payments[0];
      const amount = p.method === 'cash' && cashTendered !== ''
        ? total
        : Number(p.amount) || total;
      return [{
        method: p.method,
        amount,
        reference: p.method === 'momo' ? p.reference : undefined,
      }];
    }
    return payments
      .filter((p) => Number(p.amount) > 0)
      .map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        reference: p.method === 'momo' ? p.reference : undefined,
      }));
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

  const resetAfterSale = (res) => {
    setCart([]);
    setDiscount(0);
    setSupervisorPin('');
    setCustomerName('');
    setCustomerPhone('');
    setPayments([emptyPayment()]);
    setCashTendered('');
    setPayOpen(false);
    setReceipt(res.receipt);
    refetchShift();
  };

  const handlePaystack = async () => {
    const init = await paystackInit.mutateAsync({
      shift_id: shift.id,
      items: quoteItems,
      discount_amount: discount,
      customer_name: customerName || undefined,
      customer_phone: customerPhone || undefined,
      supervisor_pin: supervisorPin || undefined,
    });
    const session = init.paystack;
    if (session?.dev_mock) {
      const res = await paystackVerify.mutateAsync({
        order_id: init.order_id,
        reference: session.reference,
        send_sms: sendSms && !!customerPhone,
      });
      resetAfterSale(res);
      return;
    }
    const { default: PaystackPop } = await import('@paystack/inline-js');
    const popup = new PaystackPop();
    await new Promise((resolve, reject) => {
      popup.resumeTransaction(session.access_code, {
        onSuccess: async (trx) => {
          try {
            const res = await paystackVerify.mutateAsync({
              order_id: init.order_id,
              reference: trx.reference || session.reference,
              send_sms: sendSms && !!customerPhone,
            });
            resetAfterSale(res);
            resolve();
          } catch (err) {
            reject(err);
          }
        },
        onCancel: () => reject(new Error('Payment cancelled.')),
        onError: () => reject(new Error('Payment failed.')),
      });
    });
  };

  const handleComplete = async () => {
    setError('');
    const primary = payments[0];
    if (primary?.method === 'paystack') {
      try {
        await handlePaystack();
      } catch (e) {
        setError(e.response?.data?.message || e.message || 'Paystack failed.');
      }
      return;
    }
    if (primary?.method === 'momo' && !primary.reference?.trim()) {
      setError('MoMo reference is required.');
      return;
    }
    try {
      const res = await completeSale.mutateAsync({
        shift_id: shift.id,
        items: quoteItems,
        discount_amount: discount,
        payments: buildPaymentsPayload(),
        cash_tendered: !splitPay && primary?.method === 'cash' && cashTendered !== ''
          ? Number(cashTendered)
          : undefined,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        supervisor_pin: supervisorPin || undefined,
        send_sms: sendSms && !!customerPhone,
      });
      resetAfterSale(res);
    } catch (e) {
      setError(e.response?.data?.message || 'Sale failed.');
    }
  };

  const handleVoid = async () => {
    if (!voidSale || !voidReason.trim()) return;
    try {
      await voidMut.mutateAsync({
        orderId: voidSale.id,
        reason: voidReason,
        supervisor_pin: voidPin || undefined,
      });
      setVoidSale(null);
      setVoidReason('');
      setVoidPin('');
      refetchShift();
    } catch (e) {
      setError(e.response?.data?.message || 'Void failed.');
    }
  };

  if (!canUse) return <Navigate to="/admin" replace />;

  if (!bootLoading && boot && !boot.settings?.pos_module_enabled) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="text-lg font-bold">POS is not enabled</p>
        <p className="mt-2 text-sm text-white/60">Enable it under Admin → POS setup.</p>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-extrabold">Open register shift</h1>
        <p className="mt-1 text-sm text-white/60">Select a register and enter your opening float.</p>
        {error && <p className="mt-4 rounded-lg bg-brand-red/20 px-3 py-2 text-sm text-brand-red">{error}</p>}
        <label className="mt-6 block text-sm">
          <span className="mb-1 block font-semibold">Register</span>
          <select className="input-field w-full bg-[#1a1f26] text-white" value={registerId || ''} onChange={(e) => setRegisterId(Number(e.target.value))}>
            <option value="">Choose register…</option>
            {(boot?.registers ?? []).map((r) => (
              <option key={r.id} value={r.id}>{r.location_name} — {r.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-semibold">Opening float (GHS)</span>
          <input type="number" min="0" step="0.01" className="input-field w-full bg-[#1a1f26] text-white" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} />
        </label>
        <button type="button" className="btn-primary mt-6 min-h-[48px] w-full" disabled={!registerId || openShift.isPending} onClick={handleOpenShift}>
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
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold" onClick={() => setSalesOpen(true)}>Sales ({shiftSales.filter((s) => !s.voided).length})</button>
            <button type="button" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold" onClick={() => setReportOpen(true)}>X-report</button>
            <button type="button" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold" onClick={() => setCloseOpen(true)}>Close shift</button>
          </div>
        </div>
        <input
          ref={scanRef}
          className={`input-field mb-3 w-full bg-[#1a1f26] text-white ${scanFlash === 'ok' ? 'ring-2 ring-brand-green' : ''} ${scanFlash === 'err' ? 'ring-2 ring-brand-red' : ''}`}
          placeholder="Scan barcode or search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleScanSubmit(search);
            }
          }}
        />
        <div className="grid flex-1 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3 xl:grid-cols-4">
          {(products?.data ?? []).map((p) => (
            <button key={p.id} type="button" className="rounded-xl border border-white/10 bg-[#1a1f26] p-3 text-left transition hover:border-brand-green/50" onClick={() => addToCart(p)}>
              <p className="line-clamp-2 text-sm font-bold">{p.name}</p>
              <p className="mt-1 text-brand-green">{formatPrice(p.price)}</p>
              <p className="text-xs text-white/40">Stock {p.stock_qty}{p.barcode ? ` · ${p.barcode}` : ''}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col border-t border-white/10 p-4 lg:w-[26rem] lg:border-t-0">
        <h2 className="font-extrabold">Cart</h2>
        {error && <p className="mt-2 rounded-lg bg-brand-red/20 px-3 py-2 text-xs text-brand-red">{error}</p>}
        <ul className="mt-3 max-h-48 space-y-2 overflow-auto lg:max-h-none lg:flex-1">
          {cart.length === 0 && <p className="text-sm text-white/40">Scan or tap products to add.</p>}
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
          <input type="number" min="0" step="0.01" className="input-field mt-1 w-full bg-[#1a1f26] text-white" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
        </label>
        {(discount > 0 && quote?.subtotal > 0 && (discount / quote.subtotal) * 100 > (boot?.settings?.pos_max_cashier_discount_percent ?? 10)) && (
          <label className="mt-2 block text-xs">
            <span className="font-semibold text-brand-gold">Supervisor PIN</span>
            <input type="password" className="input-field mt-1 w-full bg-[#1a1f26] text-white" value={supervisorPin} onChange={(e) => setSupervisorPin(e.target.value)} placeholder="Required for large discount" />
          </label>
        )}
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatPrice(quote?.subtotal ?? 0)}</span></div>
          <div className="mt-1 flex justify-between text-lg font-extrabold text-brand-green"><span>Total</span><span>{formatPrice(total)}</span></div>
        </div>
        <button type="button" className="btn-primary mt-4 min-h-[52px] w-full text-base" disabled={cart.length === 0 || completeSale.isPending} onClick={() => { setPayments([{ ...emptyPayment(), amount: String(total) }]); setPayOpen(true); }}>
          Charge {formatPrice(total)}
        </button>
      </div>

      {payOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-auto bg-black/70 p-4">
          <div className="my-4 w-full max-w-lg rounded-2xl bg-[#1a1f26] p-6">
            <h3 className="text-lg font-extrabold">Payment</h3>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={splitPay} onChange={(e) => { setSplitPay(e.target.checked); if (!e.target.checked) setPayments([{ method: 'cash', amount: String(total), reference: '' }]); }} />
              Split payment
            </label>
            {!splitPay ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {PAY_METHODS.map((m) => (
                    <button key={m.id} type="button" className={`rounded-lg px-3 py-2 text-sm font-bold ${payments[0]?.method === m.id ? 'bg-brand-green text-black' : 'bg-white/10'}`} onClick={() => setPayments([{ method: m.id, amount: String(total), reference: '' }])}>{m.label}</button>
                  ))}
                </div>
                {payments[0]?.method === 'cash' && (
                  <label className="mt-4 block text-sm">
                    <span className="font-semibold">Cash tendered (GHS)</span>
                    <input type="number" className="input-field mt-1 w-full bg-[#0f1419] text-white" value={cashTendered} onChange={(e) => setCashTendered(e.target.value)} placeholder={String(total)} />
                    {changeDue > 0 && <p className="mt-2 text-brand-green font-bold">Change: {formatPrice(changeDue)}</p>}
                  </label>
                )}
                {payments[0]?.method === 'momo' && (
                  <label className="mt-3 block text-sm">
                    <span className="font-semibold">MoMo reference *</span>
                    <input className="input-field mt-1 w-full bg-[#0f1419] text-white" value={payments[0].reference} onChange={(e) => setPayments([{ ...payments[0], reference: e.target.value }])} />
                  </label>
                )}
              </>
            ) : (
              <div className="mt-4 space-y-3">
                {payments.map((p, i) => (
                  <div key={i} className="flex flex-wrap gap-2">
                    <select className="input-field bg-[#0f1419] text-white" value={p.method} onChange={(e) => setPayments((prev) => prev.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}>
                      <option value="cash">Cash</option>
                      <option value="momo">MoMo</option>
                    </select>
                    <input type="number" className="input-field min-w-[100px] flex-1 bg-[#0f1419] text-white" placeholder="Amount" value={p.amount} onChange={(e) => setPayments((prev) => prev.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                    {p.method === 'momo' && (
                      <input className="input-field min-w-[120px] flex-1 bg-[#0f1419] text-white" placeholder="MoMo ref" value={p.reference} onChange={(e) => setPayments((prev) => prev.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))} />
                    )}
                  </div>
                ))}
                <p className="text-sm text-white/60">Remaining: <strong className="text-white">{formatPrice(payRemaining)}</strong></p>
                <button type="button" className="text-xs text-brand-green" onClick={() => setPayments((prev) => [...prev, emptyPayment()])}>+ Add payment line</button>
              </div>
            )}
            <label className="mt-3 block text-sm"><span className="font-semibold">Customer name</span><input className="input-field mt-1 w-full bg-[#0f1419] text-white" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></label>
            <label className="mt-3 block text-sm"><span className="font-semibold">Customer phone</span><input className="input-field mt-1 w-full bg-[#0f1419] text-white" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></label>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />Send SMS receipt</label>
            <div className="mt-6 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setPayOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary flex-1" disabled={completeSale.isPending || paystackInit.isPending || paystackVerify.isPending || (splitPay && payRemaining > 0.02)} onClick={handleComplete}>
                {completeSale.isPending || paystackInit.isPending ? 'Processing…' : 'Complete sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {salesOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-[#1a1f26] p-6">
            <h3 className="text-lg font-extrabold">Shift sales</h3>
            <ul className="mt-4 flex-1 space-y-2 overflow-auto">
              {shiftSales.length === 0 && <p className="text-sm text-white/50">No sales yet.</p>}
              {shiftSales.map((s) => (
                <li key={s.id} className={`rounded-lg p-3 text-sm ${s.voided ? 'bg-white/5 opacity-60' : 'bg-white/10'}`}>
                  <div className="flex justify-between gap-2">
                    <span className="font-bold">{s.tracking_ref}</span>
                    <span>{formatPrice(s.total)}</span>
                  </div>
                  <p className="text-xs text-white/50">{s.created_at}{s.voided ? ' · VOIDED' : ''}</p>
                  <div className="mt-2 flex gap-2">
                    {!s.voided && (
                      <>
                        <button type="button" className="text-xs text-brand-green" onClick={async () => {
                          const r = await saleReceipt.mutateAsync(s.id);
                          setReceipt(r.receipt);
                          setSalesOpen(false);
                        }}>Reprint</button>
                        <button type="button" className="text-xs text-brand-red" onClick={() => { setVoidSale(s); setSalesOpen(false); }}>Void</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-secondary mt-4" onClick={() => setSalesOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {voidSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#1a1f26] p-6">
            <h3 className="font-extrabold">Void {voidSale.tracking_ref}</h3>
            <textarea className="input-field mt-3 min-h-[80px] w-full bg-[#0f1419] text-white" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason…" />
            {!canSupervise && (
              <input type="password" className="input-field mt-3 w-full bg-[#0f1419] text-white" value={voidPin} onChange={(e) => setVoidPin(e.target.value)} placeholder="Supervisor PIN (if outside void window)" />
            )}
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setVoidSale(null)}>Cancel</button>
              <button type="button" className="btn-primary flex-1" disabled={!voidReason.trim() || voidMut.isPending} onClick={handleVoid}>Void sale</button>
            </div>
          </div>
        </div>
      )}

      {reportOpen && xReport && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-6 text-black">
            <h3 className="font-extrabold">X-Report · Shift #{shift.id}</h3>
            <p className="text-sm text-gray-500">{xReport.company_name}</p>
            <div className="mt-4 space-y-1 text-sm">
              <p>Sales count: <strong>{xReport.totals?.sales ?? 0}</strong></p>
              <p>Gross: <strong>{formatPrice(xReport.gross_sales)}</strong></p>
              <p>Cash: <strong>{formatPrice(xReport.totals?.cash)}</strong></p>
              <p>MoMo: <strong>{formatPrice(xReport.totals?.momo)}</strong></p>
              <p>Paystack: <strong>{formatPrice(xReport.totals?.paystack)}</strong></p>
              <p>Expected cash in drawer: <strong>{formatPrice(xReport.expected_cash)}</strong></p>
            </div>
            <button type="button" className="btn-primary mt-6 w-full print:hidden" onClick={() => window.print()}>Print</button>
            <button type="button" className="btn-secondary mt-2 w-full" onClick={() => setReportOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {closeOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#1a1f26] p-6">
            <h3 className="text-lg font-extrabold">Close shift</h3>
            <p className="mt-1 text-sm text-white/60">Count cash in drawer. A supervisor must approve.</p>
            <label className="mt-4 block text-sm"><span className="font-semibold">Counted cash (GHS)</span><input type="number" className="input-field mt-1 w-full bg-[#0f1419] text-white" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} /></label>
            <label className="mt-3 block text-sm"><span className="font-semibold">Variance note</span><input className="input-field mt-1 w-full bg-[#0f1419] text-white" value={varianceNote} onChange={(e) => setVarianceNote(e.target.value)} /></label>
            <div className="mt-6 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setCloseOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary flex-1" disabled={closeShift.isPending} onClick={handleCloseShift}>Submit for approval</button>
            </div>
          </div>
        </div>
      )}

      {receipt && <PosReceiptPrint receipt={receipt} onDone={() => setReceipt(null)} />}
    </div>
  );
}
