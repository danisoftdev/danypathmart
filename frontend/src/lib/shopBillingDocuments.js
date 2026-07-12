import { formatPrice } from './currency';

function esc(text) {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 0; padding: 28px; font-size: 13px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; font-family: system-ui, sans-serif; }
  .brand { font-weight: 700; color: #2C7A4B; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-family: system-ui, sans-serif; }
  .meta { color: #555; font-size: 12px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border-bottom: 1px solid #ddd; padding: 10px 8px; text-align: left; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; font-family: system-ui, sans-serif; }
  td.amt { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 16px; max-width: 280px; margin-left: auto; font-family: system-ui, sans-serif; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { font-weight: 700; font-size: 16px; border-top: 2px solid #111; margin-top: 8px; padding-top: 10px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #e8f5ee; color: #2C7A4B; font-size: 11px; font-weight: 700; font-family: system-ui, sans-serif; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #eee; font-size: 11px; color: #777; font-family: system-ui, sans-serif; }
  @media print { body { padding: 12px; } @page { margin: 12mm; } }
`;

function printHtml(title, bodyHtml) {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${esc(title)}</title><style>${PRINT_STYLES}</style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 250);
}

/** Print / save-as-PDF a shop billing receipt. */
export function printShopBillingReceipt(receipt, shopName) {
  if (!receipt) return;
  const company = receipt.company || {};
  const lines = receipt.lines || [];
  const rows = lines
    .map(
      (line) => `
    <tr>
      <td>${esc(line.label)}</td>
      <td class="amt">${formatPrice(line.amount)}</td>
    </tr>`
    )
    .join('');

  const html = `
    <div class="brand">${esc(company.company_name || 'DanyPathMart')}</div>
    <h1>Payment receipt</h1>
    <div class="meta">
      ${esc(receipt.receipt_number || '')}
      ${receipt.is_complimentary ? ' · <span class="badge">No payment / complimentary</span>' : ''}<br/>
      ${esc(shopName || 'Shop')} · ${esc(fmtDate(receipt.paid_at))}<br/>
      Ref: ${esc(receipt.paystack_ref || '—')}
      ${receipt.channel ? ` · ${esc(receipt.channel)}` : ''}
      ${receipt.card_last4 ? ` · •••• ${esc(receipt.card_last4)}` : ''}
    </div>
    <table>
      <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${rows || `<tr><td>Platform fee</td><td class="amt">${formatPrice(receipt.amount_ghs)}</td></tr>`}</tbody>
    </table>
    <div class="totals">
      <div class="grand"><span>Paid</span><span>${formatPrice(receipt.amount_ghs)}</span></div>
    </div>
    ${receipt.notes ? `<p class="meta" style="margin-top:16px">${esc(receipt.notes)}</p>` : ''}
    ${receipt.fee_policy_note ? `<p class="meta">${esc(receipt.fee_policy_note)}</p>` : ''}
    <div class="footer">
      ${(company.phone || company.email) ? esc([company.phone, company.email].filter(Boolean).join(' · ')) + '<br/>' : ''}
      Keep this receipt for your records. Use your browser’s print dialog to save as PDF.
    </div>
  `;

  printHtml(`Receipt ${receipt.receipt_number || receipt.id}`, html);
}
