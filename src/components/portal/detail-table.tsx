export type DetailRow = {
  label: string;
  value: React.ReactNode;
};

type DetailTableProps = {
  rows: DetailRow[];
  className?: string;
};

/** Label/value rows for detail modals and panels. */
export function DetailTable({ rows, className }: DetailTableProps) {
  return (
    <table className={`w-full text-sm ${className ?? ""}`.trim()}>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-slate-100 last:border-0">
            <th className="w-[38%] py-2.5 pr-4 align-top text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              {row.label}
            </th>
            <td className="py-2.5 align-top text-slate-900">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
