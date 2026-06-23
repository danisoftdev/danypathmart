/** Printable POS receipt — thermal-friendly via window.print(). */
export default function PosReceiptPrint({ receipt, onDone }) {
  if (!receipt?.sale) return null;
  const { company_name, footer, sale, printed_at } = receipt;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 print:relative print:inset-auto print:bg-white print:p-0">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-black shadow-xl print:max-w-none print:shadow-none">
        <div id="pos-receipt-print" className="text-sm">
          <p className="text-center text-base font-extrabold">{company_name}</p>
          {sale.location?.name && <p className="text-center text-xs text-gray-600">{sale.location.name}</p>}
          {sale.register?.name && <p className="text-center text-xs text-gray-600">Register: {sale.register.name}</p>}
          <p className="mt-2 text-center text-xs text-gray-500">{printed_at}</p>
          <p className="text-center font-bold">{sale.tracking_ref}</p>
          <hr className="my-3 border-dashed border-gray-300" />
          <ul className="space-y-1">
            {sale.items?.map((item) => (
              <li key={`${item.product_id}-${item.quantity}`} className="flex justify-between gap-2">
                <span className="min-w-0 flex-1">
                  {item.name} × {item.quantity}
                </span>
                <span className="shrink-0 font-semibold">{item.line_total.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <hr className="my-3 border-dashed border-gray-300" />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{sale.subtotal.toFixed(2)} GHS</span>
            </div>
            {sale.discount_amount > 0 && (
              <div className="flex justify-between text-brand-green">
                <span>Discount</span>
                <span>-{sale.discount_amount.toFixed(2)} GHS</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold">
              <span>Total</span>
              <span>{sale.total.toFixed(2)} GHS</span>
            </div>
          </div>
          {sale.payments?.length > 0 && (
            <>
              <hr className="my-3 border-dashed border-gray-300" />
              <p className="text-xs font-bold uppercase text-gray-500">Payment</p>
              {sale.payments.map((p, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="capitalize">
                    {p.method}
                    {p.reference ? ` (${p.reference})` : ''}
                  </span>
                  <span>{p.amount.toFixed(2)}</span>
                </div>
              ))}
            </>
          )}
          {sale.customer_name && <p className="mt-2 text-xs">Customer: {sale.customer_name}</p>}
          {sale.customer_phone && <p className="text-xs">Phone: {sale.customer_phone}</p>}
          {sale.cashier_name && <p className="mt-2 text-xs text-gray-500">Cashier: {sale.cashier_name}</p>}
          {footer && <p className="mt-4 text-center text-xs text-gray-500">{footer}</p>}
          <p className="mt-4 text-center text-xs">Thank you!</p>
        </div>
        <div className="mt-6 flex gap-2 print:hidden">
          <button type="button" className="btn-primary flex-1" onClick={() => window.print()}>
            Print receipt
          </button>
          <button type="button" className="btn-secondary flex-1" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
