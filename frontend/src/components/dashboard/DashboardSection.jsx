export default function DashboardSection({ title, subtitle, children }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#111111] dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
