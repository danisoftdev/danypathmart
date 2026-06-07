import { esc, fmtDate, fmtMoney, printHtml } from './orderDocuments';

function quoteItemsTable(items) {
  const rows = (items || [])
    .map(
      (item) => `
    <tr>
      <td>${esc(item.product_name)}</td>
      <td>${esc([item.recipient_name, item.size_label].filter(Boolean).join(' · ') || '—')}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${item.unit_price != null ? fmtMoney(item.unit_price) : '—'}</td>
      <td style="text-align:right">${item.line_total != null ? fmtMoney(item.line_total) : item.unit_price != null ? fmtMoney(item.unit_price * item.quantity) : '—'}</td>
    </tr>`
    )
    .join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Member / size</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Unit</th>
          <th style="text-align:right">Line total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function quoteTotals(quote) {
  if (!(quote.total > 0) && !(quote.subtotal > 0)) {
    return '<p class="meta">Pricing to be confirmed.</p>';
  }
  return `
    <div class="totals">
      <div><span>Subtotal</span><span>${fmtMoney(quote.subtotal)}</span></div>
      ${quote.intl_shipping_cost > 0 ? `<div><span>International shipping</span><span>${fmtMoney(quote.intl_shipping_cost)}</span></div>` : ''}
      ${quote.local_delivery_cost > 0 ? `<div><span>Local delivery${quote.local_delivery_percent ? ` (${quote.local_delivery_percent}%)` : ''}</span><span>${fmtMoney(quote.local_delivery_cost)}</span></div>` : ''}
      <div class="grand"><span>Total</span><span>${fmtMoney(quote.total)}</span></div>
    </div>
  `;
}

/** Branded proforma / quote document — print or Save as PDF. */
export function printProforma(quote, company, { bank } = {}) {
  const name = esc(company?.company_name || 'DanyPathMart');
  const isProforma = ['proforma_sent', 'approved_pay_later', 'converted'].includes(quote.status);
  const docTitle = isProforma ? `Proforma invoice ${quote.quote_number}` : `Quote ${quote.quote_number}`;

  const bankBlock =
    bank?.bank_account_number && isProforma
      ? `
    <h2>Payment details</h2>
    <div class="box">
      ${bank.bank_name ? `<div>${esc(bank.bank_name)}</div>` : ''}
      ${bank.bank_account_name ? `<div>${esc(bank.bank_account_name)}</div>` : ''}
      <div class="font-mono"><strong>${esc(bank.bank_account_number)}</strong></div>
      <p class="meta" style="margin-top:8px">Use PO / reference: <strong>${esc(quote.quote_number)}</strong></p>
    </div>`
      : '';

  const html = `
    <div class="brand">${name}</div>
    <h1>${docTitle}</h1>
    <p class="meta">
      ${esc(quote.organization_name)}<br/>
      Attention: ${esc(quote.contact_name)} · ${esc(quote.contact_email)}
      ${quote.contact_phone ? `<br/>${esc(quote.contact_phone)}` : ''}
    </p>
    <p class="meta">
      Date: ${fmtDate(quote.proforma_sent_at || quote.created_at)}
      ${quote.valid_until ? `<br/>Valid until: ${esc(quote.valid_until)}` : ''}
      ${quote.po_reference || quote.quote_number ? `<br/>PO reference: <strong>${esc(quote.po_reference || quote.quote_number)}</strong>` : ''}
    </p>
    ${quote.proforma_note ? `<div class="box"><strong>Note:</strong> ${esc(quote.proforma_note)}</div>` : ''}
    ${quote.customer_notes ? `<p class="meta"><em>Your notes:</em> ${esc(quote.customer_notes)}</p>` : ''}
    <h2>Line items</h2>
    ${quoteItemsTable(quote.items)}
    ${quoteTotals(quote)}
    ${bankBlock}
    ${company?.address ? `<p class="meta">${esc(company.address)}</p>` : ''}
    <div class="footer">${name} · ${esc(company?.email || '')} ${company?.phone ? '· ' + esc(company.phone) : ''}</div>
  `;

  printHtml(docTitle, html);
}

export function canPrintProforma(quote) {
  if (!quote) return false;
  return quote.items?.length > 0;
}
