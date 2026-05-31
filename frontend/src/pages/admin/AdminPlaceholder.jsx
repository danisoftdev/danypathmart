export default function AdminPlaceholder({ title, description }) {
  return (
    <div className="card-panel max-w-xl">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        {description || 'This admin section is coming in the next build.'}
      </p>
      <p className="mt-4 text-xs text-black/40 dark:text-white/40">
        Your super admin account already has full access — the UI for this panel will be wired up shortly.
      </p>
    </div>
  );
}
