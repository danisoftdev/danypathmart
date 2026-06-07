export default function AdminTable({ columns = [], children, emptyMessage }) {
  return (
    <div className="admin-table-wrap">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((col) => {
                const isObject = col && typeof col === 'object';
                const key = isObject ? col.key : col;
                const className = isObject ? col.className || '' : '';
                const label = isObject ? (col.label ?? '') : col;
                return (
                  <th key={key} className={className}>
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {children}
          </tbody>
        </table>
      </div>
      {!children && emptyMessage && (
        <p className="p-8 text-center text-sm text-muted">{emptyMessage}</p>
      )}
    </div>
  );
}

export function AdminTableRow({ children, onClick, className = '' }) {
  return (
    <tr
      onClick={onClick}
      className={[
        onClick ? 'cursor-pointer' : '',
        className,
      ].join(' ')}
    >
      {children}
    </tr>
  );
}

export function AdminTableCell({ children, className = '', colSpan }) {
  return (
    <td className={className} colSpan={colSpan}>
      {children}
    </td>
  );
}
