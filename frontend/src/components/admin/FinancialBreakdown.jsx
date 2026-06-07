import { formatPrice } from '../../lib/currency';

function ReportSection({ title, subtitle, children }) {
  return (
    <section className="admin-panel">
      <div className="mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ReportRow({ label, value, hint, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-[#111111] dark:text-white',
    green: 'text-brand-green',
    gold: 'text-amber-800 dark:text-brand-gold',
    red: 'text-brand-red',
  };

  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/5 py-3 last:border-0 dark:border-white/10">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <p className={`shrink-0 text-sm font-extrabold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function ReportTotal({ label, value, tone = 'green' }) {
  const tones = {
    green: 'border-brand-green/25 bg-brand-green/5 text-brand-green',
    red: 'border-brand-red/25 bg-brand-red/5 text-brand-red',
    gold: 'border-brand-gold/30 bg-brand-gold/10 text-amber-900 dark:text-brand-gold',
  };

  return (
    <div className={`mt-4 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-sm font-bold">{label}</p>
      <p className="text-lg font-extrabold">{value}</p>
    </div>
  );
}

export default function FinancialBreakdown({ data }) {
  const { revenue, deductions, interest, inventory, recent_sales: recentSales, paid_orders: paidOrders, units_sold: unitsSold } = data;

  return (
    <div className="space-y-6">
      <div className="admin-stat-card border-brand-green/30 bg-gradient-to-br from-brand-green/15 to-brand-green/5 text-brand-green">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">Net interest (after deductions)</p>
            <p className="mt-2 text-3xl font-extrabold sm:text-4xl">{formatPrice(interest.net_interest)}</p>
            <p className="mt-2 text-sm opacity-80">
              From {paidOrders} paid order{paidOrders === 1 ? '' : 's'} · {unitsSold} unit{unitsSold === 1 ? '' : 's'} sold
            </p>
          </div>
          <div className="rounded-xl bg-white/60 px-4 py-3 text-right dark:bg-black/20">
            <p className="text-xs font-bold uppercase tracking-wide opacity-70">Product interest</p>
            <p className="mt-1 text-xl font-extrabold">{formatPrice(interest.product_interest)}</p>
            <p className="mt-1 text-xs opacity-70">Sales minus product cost</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportSection title="Revenue collected" subtitle="All paid customer payments">
          <ReportRow label="Gross merchandise sales" value={formatPrice(revenue.gross_sales)} tone="green" />
          <ReportRow
            label="International shipping"
            value={formatPrice(revenue.intl_shipping_collected)}
            hint="Freight charged on pre-order items"
          />
          <ReportRow
            label="Local delivery fees"
            value={formatPrice(revenue.local_delivery_collected)}
            hint="Local delivery percentage on subtotal"
          />
          <ReportRow label="Total shipping fees" value={formatPrice(revenue.shipping_collected)} tone="gold" />
          <ReportTotal label="Total collected" value={formatPrice(revenue.total_collected)} tone="green" />
        </ReportSection>

        <ReportSection title="Costs & deductions" subtitle="Product cost and CBM freight">
          <ReportRow
            label="Product cost (COGS)"
            value={formatPrice(deductions.product_cost)}
            hint="What you paid for sold items"
            tone="red"
          />
          <ReportRow
            label="CBM freight cost"
            value={formatPrice(deductions.cbm_cost)}
            hint="International freight from cubic weight"
            tone="red"
          />
          <ReportTotal label="Total deductions" value={formatPrice(deductions.total)} tone="red" />
        </ReportSection>
      </div>

      <ReportSection title="Inventory on hand" subtitle="Current stock value across active catalogue">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-black/[0.03] p-4 dark:bg-white/5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Units in stock</p>
            <p className="mt-2 text-2xl font-extrabold">{inventory.units_on_hand}</p>
          </div>
          <div className="rounded-xl bg-black/[0.03] p-4 dark:bg-white/5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Cost value</p>
            <p className="mt-2 text-2xl font-extrabold">{formatPrice(inventory.cost_value)}</p>
          </div>
          <div className="rounded-xl bg-black/[0.03] p-4 dark:bg-white/5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Retail value</p>
            <p className="mt-2 text-2xl font-extrabold">{formatPrice(inventory.retail_value)}</p>
          </div>
          <div className="rounded-xl bg-brand-green/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-green">Potential interest</p>
            <p className="mt-2 text-2xl font-extrabold text-brand-green">{formatPrice(inventory.potential_interest)}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">
          {inventory.active_skus} active SKUs · {inventory.low_stock_skus} low stock · {inventory.out_of_stock_skus} out of stock
        </p>
      </ReportSection>

      {recentSales.length > 0 && (
        <ReportSection title="Recent paid sales" subtitle="Latest completed transactions">
          <div className="admin-table-wrap -mx-4 sm:mx-0">
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Sales</th>
                    <th className="hidden sm:table-cell">Intl shipping</th>
                    <th className="hidden md:table-cell">Local delivery</th>
                    <th>Total</th>
                    <th className="hidden lg:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="font-bold">#{sale.id}</td>
                      <td>{formatPrice(sale.subtotal)}</td>
                      <td className="hidden sm:table-cell">{formatPrice(sale.intl_shipping_cost)}</td>
                      <td className="hidden md:table-cell">{formatPrice(sale.local_delivery_cost)}</td>
                      <td className="font-bold text-brand-green">{formatPrice(sale.total)}</td>
                      <td className="hidden text-muted lg:table-cell">{sale.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ReportSection>
      )}
    </div>
  );
}
