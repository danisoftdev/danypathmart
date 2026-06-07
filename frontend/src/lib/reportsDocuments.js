import { esc, fmtDate, fmtMoney, printHtml } from './orderDocuments';
import { formatPrice } from './currency';

/** One-page financial summary for meetings / records. */
export function printFinancialReport(summary, financial, company) {
  const name = esc(company?.company_name || 'DanyPathMart');
  const { revenue, deductions, interest, inventory, recent_sales: recentSales, paid_orders: paidOrders, units_sold: unitsSold } =
    financial;

  const recentRows = (recentSales || [])
    .map(
      (row) => `
    <tr>
      <td>#${row.id}</td>
      <td>${fmtDate(row.created_at)}</td>
      <td style="text-align:right">${fmtMoney(row.subtotal)}</td>
      <td style="text-align:right">${fmtMoney(row.total)}</td>
    </tr>`
    )
    .join('');

  const html = `
    <div class="brand">${name}</div>
    <h1>Financial report</h1>
    <p class="meta">Generated ${fmtDate(new Date().toISOString())}</p>

    <h2>Overview</h2>
    <table>
      <tbody>
        <tr><td>Total orders</td><td style="text-align:right;font-weight:bold">${summary.orders_total}</td></tr>
        <tr><td>Paid revenue</td><td style="text-align:right;font-weight:bold">${formatPrice(summary.revenue_paid)}</td></tr>
        <tr><td>Pending orders</td><td style="text-align:right">${summary.pending_orders}</td></tr>
        <tr><td>Active customers</td><td style="text-align:right">${summary.customers_total}</td></tr>
        <tr><td>Active products</td><td style="text-align:right">${summary.products_active}</td></tr>
      </tbody>
    </table>

    <h2>Revenue &amp; interest</h2>
    <table>
      <tbody>
        <tr><td>Gross merchandise sales</td><td style="text-align:right">${fmtMoney(revenue.gross_sales)}</td></tr>
        <tr><td>Shipping collected</td><td style="text-align:right">${fmtMoney(revenue.shipping_collected)}</td></tr>
        <tr><td>Total collected</td><td style="text-align:right;font-weight:bold">${fmtMoney(revenue.total_collected)}</td></tr>
        <tr><td>Product cost</td><td style="text-align:right">${fmtMoney(deductions.product_cost)}</td></tr>
        <tr><td>CBM / freight cost</td><td style="text-align:right">${fmtMoney(deductions.cbm_cost)}</td></tr>
        <tr><td><strong>Net interest</strong></td><td style="text-align:right;font-weight:bold">${fmtMoney(interest.net_interest)}</td></tr>
      </tbody>
    </table>
    <p class="meta">${paidOrders} paid order(s) · ${unitsSold} unit(s) sold</p>

    <h2>Inventory</h2>
    <table>
      <tbody>
        <tr><td>Units on hand</td><td style="text-align:right">${inventory.units_on_hand}</td></tr>
        <tr><td>Active SKUs</td><td style="text-align:right">${inventory.active_skus}</td></tr>
        <tr><td>Low stock SKUs</td><td style="text-align:right">${inventory.low_stock_skus}</td></tr>
        <tr><td>Out of stock SKUs</td><td style="text-align:right">${inventory.out_of_stock_skus}</td></tr>
        <tr><td>Retail value</td><td style="text-align:right">${fmtMoney(inventory.retail_value)}</td></tr>
        <tr><td>Cost value</td><td style="text-align:right">${fmtMoney(inventory.cost_value)}</td></tr>
      </tbody>
    </table>

    ${recentRows ? `<h2>Recent paid orders</h2>
    <table>
      <thead><tr><th>Order</th><th>Date</th><th style="text-align:right">Subtotal</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${recentRows}</tbody>
    </table>` : ''}

    <div class="footer">Internal report · ${name}</div>
  `;

  printHtml('Financial report', html);
}

/** Build CSV sections from loaded report data (client-side fallback). */
export function buildReportsCsv(summary, financial) {
  const { revenue, deductions, interest, inventory, recent_sales: recentSales } = financial;
  const lines = [];

  const addSection = (title, rows) => {
    lines.push([title, '']);
    rows.forEach((row) => lines.push(row));
    lines.push(['', '']);
  };

  addSection('SUMMARY', [
    ['orders_total', summary.orders_total],
    ['revenue_paid', summary.revenue_paid],
    ['pending_orders', summary.pending_orders],
    ['customers_total', summary.customers_total],
    ['products_active', summary.products_active],
    ['net_interest', summary.net_interest ?? interest.net_interest],
  ]);

  addSection('REVENUE', [
    ['gross_sales', revenue.gross_sales],
    ['intl_shipping_collected', revenue.intl_shipping_collected],
    ['local_delivery_collected', revenue.local_delivery_collected],
    ['shipping_collected', revenue.shipping_collected],
    ['total_collected', revenue.total_collected],
  ]);

  addSection('DEDUCTIONS', [
    ['product_cost', deductions.product_cost],
    ['cbm_cost', deductions.cbm_cost],
    ['total_deductions', deductions.total],
  ]);

  addSection('INTEREST', [
    ['product_interest', interest.product_interest],
    ['net_interest', interest.net_interest],
  ]);

  addSection('INVENTORY', [
    ['units_on_hand', inventory.units_on_hand],
    ['active_skus', inventory.active_skus],
    ['low_stock_skus', inventory.low_stock_skus],
    ['out_of_stock_skus', inventory.out_of_stock_skus],
    ['cost_value', inventory.cost_value],
    ['retail_value', inventory.retail_value],
    ['potential_interest', inventory.potential_interest],
  ]);

  lines.push(['RECENT_PAID_ORDERS', '', '', '']);
  lines.push(['order_id', 'created_at', 'subtotal', 'total']);
  (recentSales || []).forEach((row) => {
    lines.push([row.id, row.created_at, row.subtotal, row.total]);
  });

  return lines;
}
