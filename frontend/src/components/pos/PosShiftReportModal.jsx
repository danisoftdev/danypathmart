import { formatPrice } from '../../lib/currency';

/** X/Z shift report modal — print-friendly. */
export default function PosShiftReportModal({ report, title, onClose }) {
  if (!report) return null;
  const totals = report.totals ?? {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-6 text-black print:max-h-none print:shadow-none">
        <style>{`
          @media print {
            @page { margin: 8mm; size: 80mm auto; }
            body * { visibility: hidden; }
            #pos-shift-report, #pos-shift-report * { visibility: visible; }
            #pos-shift-report { position: absolute; left: 0; top: 0; width: 72mm; }
          }
        `}</style>
        <div id="pos-shift-report">
          <h3 className="text-lg font-extrabold">{title ?? `${report.type?.toUpperCase() ?? 'X'}-Report`}</h3>
          <p className="text-sm text-gray-600">{report.company_name}</p>
          <p className="mt-1 text-sm">
            {report.shift?.location_name} · {report.shift?.register_name}
          </p>
          <p className="text-xs text-gray-500">Shift #{report.shift?.id} · {report.generated_at?.slice(0, 16)}</p>
          <hr className="my-3 border-dashed" />
          <div className="space-y-1 text-sm">
            <p>Sales: <strong>{totals.sales ?? 0}</strong></p>
            <p>Gross: <strong>{formatPrice(report.gross_sales ?? 0)}</strong></p>
            <p>Cash: <strong>{formatPrice(totals.cash ?? 0)}</strong></p>
            <p>MoMo: <strong>{formatPrice(totals.momo ?? 0)}</strong></p>
            <p>Paystack: <strong>{formatPrice(totals.paystack ?? 0)}</strong></p>
            <p>Opening float: <strong>{formatPrice(report.shift?.opening_float ?? 0)}</strong></p>
            <p>Expected cash: <strong>{formatPrice(report.expected_cash ?? 0)}</strong></p>
            {report.shift?.counted_cash != null && (
              <p>Counted cash: <strong>{formatPrice(report.shift.counted_cash)}</strong></p>
            )}
            {report.shift?.cash_variance != null && Math.abs(report.shift.cash_variance) > 0.01 && (
              <p className="font-bold text-red-600">Variance: {formatPrice(report.shift.cash_variance)}</p>
            )}
            {(report.voided_count ?? 0) > 0 && (
              <p className="text-gray-600">Voided: {report.voided_count} ({formatPrice(report.voided_total ?? 0)})</p>
            )}
          </div>
        </div>
        <div className="mt-6 flex gap-2 print:hidden">
          <button type="button" className="btn-primary flex-1" onClick={() => window.print()}>Print</button>
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
