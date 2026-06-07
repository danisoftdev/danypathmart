/** Download CSV text with UTF-8 BOM for Excel. */
export function downloadCsv(filename, headers, rows) {
  const escape = (val) => {
    const s = val == null ? '' : String(val);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ];
  const blob = new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function groupRosterCsvFilename(organizationName, orderId) {
  const slug = (organizationName || 'group')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const suffix = orderId ? `-order-${orderId}` : '';
  return `roster-${slug || 'group'}${suffix}.csv`;
}

export function buildGroupRosterRows(lines) {
  return (lines || []).map((line) => [
    line.recipient_name || '',
    line.size_label || '',
    line.name || line.product_name || '',
    line.quantity ?? line.qty ?? 1,
  ]);
}

export const GROUP_ROSTER_HEADERS = ['recipient_name', 'size', 'product', 'quantity'];

export function downloadGroupRosterCsv(organizationName, lines, orderId) {
  downloadCsv(
    groupRosterCsvFilename(organizationName, orderId),
    GROUP_ROSTER_HEADERS,
    buildGroupRosterRows(lines)
  );
}
