import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useProducts } from '../hooks/catalog';
import { useCreateQuote, useInstitutionalFeatures } from '../hooks/quotes';
import { useAuthStore } from '../store/authStore';
import { useGroupOrderStore } from '../store/groupOrderStore';
import ProductImage from '../components/product/ProductImage';
import { formatPrice } from '../lib/currency';
import ShippingPreview from '../components/cart/ShippingPreview';
import PrintExportActions from '../components/ui/PrintExportActions';
import { downloadGroupRosterCsv } from '../lib/csvExport';
import { printGroupRoster } from '../lib/orderDocuments';
import { useCompanyStore } from '../store/companyStore';
import { useShippingQuote } from '../hooks/checkout';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];

function ProductPicker({ onPick }) {
  const [q, setQ] = useState('');
  const term = q.trim();
  const { data } = useProducts({ search: term, per_page: 8 });
  const results = term.length >= 2 ? (data?.data ?? []) : [];

  return (
    <div className="rounded-2xl border border-black/8 p-4 dark:border-white/10">
      <input
        className="input-field"
        placeholder="Search products to add a line…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {term.length >= 2 && (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-2 py-2 text-sm text-muted">No products found.</li>
          ) : (
            results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(p);
                    setQ('');
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <ProductImage src={p.images?.[0]} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                  <span className="text-sm font-bold text-brand-green">{formatPrice(p.price)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function GroupOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralFromUrl = searchParams.get('ref') || '';
  const user = useAuthStore((s) => s.user);
  const organizationName = useGroupOrderStore((s) => s.organizationName);
  const setOrganizationName = useGroupOrderStore((s) => s.setOrganizationName);
  const lines = useGroupOrderStore((s) => s.lines);
  const addLine = useGroupOrderStore((s) => s.addLine);
  const updateLine = useGroupOrderStore((s) => s.updateLine);
  const removeLine = useGroupOrderStore((s) => s.removeLine);

  const { data: features } = useInstitutionalFeatures();
  const createQuote = useCreateQuote();
  const company = useCompanyStore((s) => s.company);

  const [draftRecipient, setDraftRecipient] = useState('');
  const [draftSize, setDraftSize] = useState('');
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [contactName, setContactName] = useState(user?.name || '');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [contactPhone, setContactPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const quoteItems = useMemo(
    () =>
      lines.map((line) => ({
        product_id: line.product_id,
        quantity: line.quantity,
        recipient_name: line.recipient_name,
        size_label: line.size_label,
      })),
    [lines]
  );
  const { data: quote, isLoading: quoteLoading } = useShippingQuote(
    quoteItems,
    lines.length > 0,
    null,
    organizationName.trim()
      ? { order_type: 'group', organization_name: organizationName.trim() }
      : null
  );

  const onPickProduct = (product) => {
    addLine(product, draftRecipient, draftSize);
    setDraftRecipient('');
    setDraftSize('');
  };

  const goCheckout = () => {
    if (!organizationName.trim()) {
      setError('Enter your club, school, or group name.');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one line (member + item).');
      return;
    }
    if (lines.some((l) => !l.recipient_name.trim())) {
      setError('Every line needs a recipient name.');
      return;
    }
    setError('');
    if (!user) {
      navigate('/login', { state: { from: '/group-order/checkout' } });
      return;
    }
    navigate(
      referralFromUrl
        ? `/group-order/checkout?ref=${encodeURIComponent(referralFromUrl)}`
        : '/group-order/checkout'
    );
  };

  const submitQuote = async () => {
    setError('');
    setMessage('');
    if (!organizationName.trim()) {
      setError('Organization name is required.');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one item.');
      return;
    }
    if (!user) {
      navigate('/login', { state: { from: '/group-order' } });
      return;
    }
    try {
      const res = await createQuote.mutateAsync({
        organization_name: organizationName.trim(),
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim() || undefined,
        customer_notes: customerNotes.trim() || undefined,
        items: quoteItems,
      });
      setMessage(`Quote ${res.quote.quote_number} submitted. We will send a proforma soon.`);
      setShowQuoteForm(false);
      navigate(`/dashboard/quotes/${res.quote.id}`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not submit quote.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-24">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-green">Clubs &amp; schools</p>
        <h1 className="mt-1 text-3xl font-extrabold">Group order</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Add one line per member — name, size, and item — then checkout once or request a formal proforma
          for your organization.
        </p>
      </div>

      <div className="space-y-6">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Organization / group name</span>
          <input
            className="input-field"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder="e.g. Accra Academy Football Club"
          />
        </label>

        <div className="grid gap-4 rounded-2xl border border-black/8 p-4 dark:border-white/10 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Recipient name (for next line)</span>
            <input
              className="input-field"
              value={draftRecipient}
              onChange={(e) => setDraftRecipient(e.target.value)}
              placeholder="Member name"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Size (optional)</span>
            <select
              className="input-field"
              value={draftSize}
              onChange={(e) => setDraftSize(e.target.value)}
            >
              <option value="">Select size</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ProductPicker onPick={onPickProduct} />

        {lines.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-black/8 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-wide text-muted dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key} className="border-t border-black/5 dark:border-white/10">
                    <td className="px-4 py-3">
                      <input
                        className="input-field py-1 text-sm"
                        value={line.recipient_name}
                        onChange={(e) => updateLine(line.key, { recipient_name: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input-field py-1 text-sm"
                        value={line.size_label}
                        onChange={(e) => updateLine(line.key, { size_label: e.target.value })}
                      >
                        <option value="">—</option>
                        {SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 font-medium">{line.name}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatPrice(line.price)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="text-xs font-bold text-brand-red"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-black/8 px-4 py-3 dark:border-white/10">
              <PrintExportActions
                actions={[
                  {
                    label: 'Print roster',
                    onClick: () =>
                      printGroupRoster({
                        organizationName,
                        lines: lines.map((line) => ({
                          recipient_name: line.recipient_name,
                          size_label: line.size_label,
                          name: line.name,
                          quantity: line.quantity,
                        })),
                        company,
                      }),
                  },
                  {
                    label: 'Export roster CSV',
                    onClick: () =>
                      downloadGroupRosterCsv(
                        organizationName,
                        lines.map((line) => ({
                          recipient_name: line.recipient_name,
                          size_label: line.size_label,
                          name: line.name,
                          quantity: line.quantity,
                        }))
                      ),
                  },
                ]}
              />
            </div>
          </div>
        )}

        <ShippingPreview quote={quote} isLoading={quoteLoading} />

        {(error || message) && (
          <p
            className={`rounded-xl px-4 py-3 text-sm ${error ? 'bg-brand-red/10 text-brand-red' : 'bg-brand-green/10 text-brand-green'}`}
          >
            {error || message}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={goCheckout} className="btn-primary flex-1">
            Checkout group order
          </button>
          {features?.quotes_enabled !== false && (
            <button
              type="button"
              onClick={() => setShowQuoteForm((v) => !v)}
              className="min-h-[48px] flex-1 rounded-xl border-2 border-brand-green px-6 font-bold text-brand-green"
            >
              Request quote / proforma
            </button>
          )}
        </div>

        {showQuoteForm && (
          <div className="rounded-2xl border border-brand-green/30 bg-brand-green/5 p-5">
            <h2 className="font-extrabold">Quote request</h2>
            <p className="mt-1 text-sm text-muted">
              We will review your list and send a proforma with confirmed pricing. Pay by bank transfer or Paystack when ready.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-semibold">Contact name</span>
                <input className="input-field" value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-semibold">Contact email</span>
                <input className="input-field" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold">Phone (optional)</span>
                <input className="input-field" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold">Notes</span>
                <textarea className="input-field min-h-[80px]" value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} />
              </label>
            </div>
            <button
              type="button"
              onClick={submitQuote}
              disabled={createQuote.isPending}
              className="btn-primary mt-4"
            >
              {createQuote.isPending ? 'Submitting…' : 'Submit quote request'}
            </button>
          </div>
        )}

        <p className="text-center text-sm text-muted">
          Need kit templates? <Link to="/kits" className="font-bold text-brand-green hover:underline">Browse kits</Link>
        </p>
      </div>
    </div>
  );
}
