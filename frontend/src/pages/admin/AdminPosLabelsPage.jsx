import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { formatPrice } from '../../lib/currency';
import { usePosLabelProducts } from '../../hooks/pos';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/permissions';

function LabelSheet({ items }) {
  const refs = useRef([]);

  useEffect(() => {
    items.forEach((item, i) => {
      const el = refs.current[i];
      if (!el || !item.barcode) return;
      try {
        JsBarcode(el, item.barcode, {
          format: 'CODE128',
          width: 1.4,
          height: 40,
          displayValue: true,
          fontSize: 11,
          margin: 4,
        });
      } catch {
        // skip invalid barcode
      }
    });
  }, [items]);

  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-2">
      {items.map((item, i) => (
        <div
          key={item.id}
          className="rounded border border-black/15 bg-white p-2 text-center text-black print:break-inside-avoid"
        >
          <p className="line-clamp-2 text-xs font-bold leading-tight">{item.name}</p>
          <p className="mt-1 text-sm font-extrabold text-brand-green">{formatPrice(item.price)}</p>
          <svg ref={(el) => { refs.current[i] = el; }} className="mx-auto mt-1 max-w-full" />
        </div>
      ))}
    </div>
  );
}

export default function AdminPosLabelsPage() {
  const user = useAuthStore((s) => s.user);
  const canConfig = user?.role === 'super_admin' || hasPermission(user, 'manage_pos_config') || hasPermission(user, 'edit_company_settings');
  const { data, isLoading } = usePosLabelProducts(canConfig);
  const [selected, setSelected] = useState(new Set());
  const [printing, setPrinting] = useState(false);

  const products = data?.data ?? [];

  if (!canConfig) return <Navigate to="/admin" replace />;

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p.id)));
  };

  const printItems = printing
    ? products.filter((p) => selected.has(p.id))
    : [];

  if (printing && printItems.length > 0) {
    return (
      <div>
        <div className="print:hidden fixed inset-x-0 top-0 z-50 flex gap-2 bg-white p-4 shadow">
          <button type="button" className="btn-primary" onClick={() => window.print()}>Print labels</button>
          <button type="button" className="btn-secondary" onClick={() => setPrinting(false)}>Back</button>
        </div>
        <LabelSheet items={printItems} />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader title="Barcode labels" subtitle="Print shelf labels for USB scanner checkout at POS." />
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary text-sm" onClick={selectAll}>
          {selected.size === products.length ? 'Deselect all' : 'Select all'}
        </button>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={selected.size === 0}
          onClick={() => setPrinting(true)}
        >
          Preview & print ({selected.size})
        </button>
      </div>
      {isLoading && <p className="text-sm text-muted">Loading products…</p>}
      <ul className="space-y-2">
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl border border-black/8 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#1E1E1E]">
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-muted">{p.barcode} · {formatPrice(p.price)}</p>
            </div>
          </li>
        ))}
      </ul>
      {!isLoading && products.length === 0 && (
        <p className="text-sm text-muted">No products with barcodes. Run &quot;Assign barcodes&quot; in POS setup first.</p>
      )}
    </div>
  );
}
