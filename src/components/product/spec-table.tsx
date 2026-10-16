type SpecRow = { label: string; value: React.ReactNode };

export function SpecTable({ rows, title }: { rows: SpecRow[]; title: string }) {
  const visible = rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== '');
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="spec-heading">
      <h2 id="spec-heading" className="text-lg font-semibold text-slate-900">
        {title}
      </h2>
      <dl className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
        {visible.map((row) => (
          <div key={row.label} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-slate-500">{row.label}</dt>
            <dd className="text-sm text-slate-900 sm:col-span-2">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
