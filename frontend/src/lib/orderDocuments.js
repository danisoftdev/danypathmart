function esc(text) {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtMoney(amount) {
  const n = Number(amount) || 0;
  return `GH₵${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #111; margin: 0; padding: 24px; font-size: 13px; line-height: 1.45; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
  .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
  .brand { font-weight: 700; color: #2C7A4B; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
  .totals { margin-top: 12px; max-width: 280px; margin-left: auto; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { font-weight: 700; font-size: 15px; border-top: 2px solid #111; margin-top: 6px; padding-top: 8px; }
  .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-top: 8px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; font-size: 11px; color: #777; }
  @media print {
    body { padding: 12px; }
    @page { margin: 12mm; }
  }
`;

function companyHeader(company, docTitle) {
  const name = esc(company?.company_name || 'DanyPathMart');
  const contact = [company?.phone, company?.email].filter(Boolean).map(esc).join(' · ');
  return `
    <div class="brand">${name}</div>
    <h1>${esc(docTitle)}</h1>
    ${contact ? `<div class="meta">${contact}</div>` : ''}
  `;
}

function addressBlock(address) {
  if (!address) return '<p class="meta">No delivery address on file.</p>';
  return `
    <div class="box">
      <strong>${esc(address.recipient_name)}</strong><br/>
      ${esc(address.street)}<br/>
      ${esc(address.city)}, ${esc(address.region)}<br/>
      ${address.landmark ? `${esc(address.landmark)}<br/>` : ''}
      ${esc(address.phone)}
    </div>
  `;
}

function itemsTable(items, { showPrices = false, showMembers = false } = {}) {
  const rows = (items || [])
    .map(
      (it) => `
    <tr>
      ${showMembers ? `<td>${esc(it.recipient_name || '—')}</td><td>${esc(it.size_label || '—')}</td>` : ''}
      <td>${esc(it.name)}${it.is_preorder ? ' <em>(by air)</em>' : ''}</td>
      <td style="text-align:center">${it.quantity}</td>
      ${showPrices ? `<td style="text-align:right">${fmtMoney(it.line_total ?? it.unit_price * it.quantity)}</td>` : ''}
    </tr>`
    )
    .join('');

  return `
    <table>
      <thead>
        <tr>
          ${showMembers ? '<th>Member</th><th>Size</th>' : ''}
          <th>Product</th>
          <th style="text-align:center;width:60px">Qty</th>
          ${showPrices ? '<th style="text-align:right;width:90px">Amount</th>' : ''}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function totalsBlock(order) {
  const lines = [
    ['Subtotal', order.subtotal],
    order.intl_shipping_cost > 0 ? ['International delivery', order.intl_shipping_cost] : null,
    order.local_delivery_cost > 0 ? ['Local delivery & handling', order.local_delivery_cost] : null,
    order.discount_amount > 0 ? [order.discount_label || 'Discount', -order.discount_amount] : null,
  ].filter(Boolean);

  return `
    <div class="totals">
      ${lines
        .map(([label, amt]) => `<div><span>${esc(label)}</span><span>${fmtMoney(Math.abs(amt))}</span></div>`)
        .join('')}
      <div class="grand"><span>Total</span><span>${fmtMoney(order.total)}</span></div>
    </div>
  `;
}

export function printHtml(title, bodyHtml) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!win) {
    window.alert('Allow pop-ups to print this document.');
    return;
  }
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>${PRINT_STYLES}</style></head>
<body>${bodyHtml}
<script>window.onload=function(){window.print();};</script>
</body></html>`);
  win.document.close();
}

export function printPackingSlip(order, company) {
  const org = order.organization_name
    ? `<p class="meta"><strong>Group:</strong> ${esc(order.organization_name)}</p>`
    : '';
  const html = `
    ${companyHeader(company, `Packing slip — Order #${order.id}`)}
    <p class="meta">
      Placed ${fmtDate(order.created_at)} · Status: ${esc((order.status || '').replace(/_/g, ' '))}<br/>
      Customer: ${esc(order.customer?.name || '')} · ${esc(order.customer?.email || '')}
    </p>
    ${org}
    <h2>Deliver to</h2>
    ${addressBlock(order.address)}
    <h2>Items to pack</h2>
    ${itemsTable(order.items, { showMembers: isGroupOrder(order) })}
    ${order.notes ? `<h2>Order notes</h2><p>${esc(order.notes)}</p>` : ''}
    <div class="footer">Printed ${fmtDate(new Date().toISOString())} · Internal use</div>
  `;
  printHtml(`Packing slip #${order.id}`, html);
}

export function printReceipt(order, company) {
  const paid = order.payment_status === 'paid';
  const html = `
    ${companyHeader(company, `Order receipt #${order.id}`)}
    <p class="meta">
      ${fmtDate(order.created_at)} · ${paid ? 'Paid' : 'Payment pending'} · ${esc((order.payment_method || 'paystack').replace(/_/g, ' '))}
    </p>
    ${order.organization_name ? `<p class="meta"><strong>${esc(order.organization_name)}</strong></p>` : ''}
    <h2>Items</h2>
    ${itemsTable(order.items, { showPrices: true, showMembers: isGroupOrder(order) })}
    ${totalsBlock(order)}
    ${order.address ? `<h2>Delivery address</h2>${addressBlock(order.address)}` : ''}
    <div class="footer">${esc(company?.company_name || 'DanyPathMart')} · Thank you for your order.</div>
  `;
  printHtml(`Receipt #${order.id}`, html);
}

export function printGroupRoster({ organizationName, lines, order, company }) {
  const items = (lines || order?.items || []).map((line) => ({
    recipient_name: line.recipient_name,
    size_label: line.size_label,
    name: line.name || line.product_name,
    quantity: line.quantity ?? line.qty ?? 1,
  }));
  const html = `
    ${companyHeader(company, 'Group order roster')}
    <p class="meta"><strong>${esc(organizationName || order?.organization_name || 'Group')}</strong>
    ${order?.id ? ` · Order #${order.id}` : ' · Draft roster'}
    ${order?.total ? ` · Total ${fmtMoney(order.total)}` : ''}
    </p>
    <h2>Members</h2>
    ${itemsTable(items, { showMembers: true })}
    <div class="footer">${items.length} line(s) · Printed ${fmtDate(new Date().toISOString())}</div>
  `;
  printHtml('Group roster', html);
}

export function isGroupOrder(order) {
  if (!order) return false;
  if (order.order_type === 'group' || order.order_type === 'institutional') return true;
  if (order.organization_name) return true;
  return (order.items || []).some((it) => it.recipient_name || it.size_label);
}

export function rosterLinesFromOrder(order) {
  return (order?.items || []).map((it) => ({
    recipient_name: it.recipient_name,
    size_label: it.size_label,
    name: it.name,
    quantity: it.quantity,
  }));
}

export { esc, fmtMoney, fmtDate };
