import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useLaunchReadiness } from '../../hooks/admin';
import { useApplyPilotPreset, useEnableModule } from '../../hooks/pilot';
import { hasAnyPermission, hasPermission } from '../../lib/permissions';
import { useAuthStore } from '../../store/authStore';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminStatCard from '../../components/admin/AdminStatCard';
import { AdminPageError, AdminPageLoading } from '../../components/admin/AdminFetchState';

const MANUAL_P1_KEY = 'dpm_p1_manual_checks_v1';
const MANUAL_P2_KEY = 'dpm_p2_manual_checks_v1';
const MANUAL_P3_KEY = 'dpm_p3_manual_checks_v1';
const MANUAL_P4_KEY = 'dpm_p4_manual_checks_v1';
const MANUAL_P5_KEY = 'dpm_p5_manual_checks_v1';
const MANUAL_OPS_KEY = 'dpm_ops_weekly_checks_v1';

const OPS_WEEKLY_ITEMS = [
  { id: 'ops_webhooks', label: 'Review Paystack webhook failures (server error log)' },
  { id: 'ops_php', label: 'Review PHP error log for API 500 responses' },
  { id: 'ops_orders', label: 'Spot-check the latest paid orders in admin' },
  { id: 'ops_smoke', label: 'Run p5-smoke-test.php after any production deploy' },
];

const STATUS_STYLES = {
  pass: 'border-brand-green/30 bg-brand-green/10 text-brand-green',
  warn: 'border-brand-gold/40 bg-brand-gold/10 text-amber-900 dark:text-brand-gold',
  fail: 'border-brand-red/30 bg-brand-red/10 text-brand-red',
};

function StatusBadge({ status }) {
  const label = status === 'pass' ? 'Pass' : status === 'warn' ? 'Review' : 'Fix';
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[status] || ''}`}>
      {label}
    </span>
  );
}

function CheckList({ checks }) {
  return (
    <ul className="space-y-3">
      {(checks ?? []).map((check) => (
        <li
          key={check.id}
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-black/8 px-4 py-3 dark:border-white/10"
        >
          <div className="min-w-0 flex-1">
            <p className="font-bold">{check.label}</p>
            <p className="mt-0.5 text-sm text-muted">{check.message}</p>
            {check.fix_to && check.status !== 'pass' && (
              <Link to={check.fix_to} className="mt-2 inline-block text-xs font-bold text-brand-green hover:underline">
                Fix in admin →
              </Link>
            )}
          </div>
          <StatusBadge status={check.status} />
        </li>
      ))}
    </ul>
  );
}

function ManualChecklist({ items, manual, onToggle, doneMessage }) {
  const done = items.filter((m) => manual[m.id]).length;
  const allDone = items.length > 0 && done === items.length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Manual checklist</h2>
        <span className="text-xs font-semibold text-muted">
          {done}/{items.length} done
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/8 px-4 py-3 transition hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/5">
              <input
                type="checkbox"
                checked={!!manual[item.id]}
                onChange={() => onToggle(item.id)}
                className="mt-1 h-4 w-4 accent-brand-green"
              />
              <span className="text-sm font-medium">{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
      {allDone && doneMessage && (
        <p className="mt-4 text-sm font-semibold text-brand-green">{doneMessage}</p>
      )}
    </>
  );
}

function useManualChecks(storageKey) {
  const [manual, setManual] = useState({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setManual(JSON.parse(raw));
    } catch {
      setManual({});
    }
  }, [storageKey]);

  const toggle = useCallback(
    (id) => {
      setManual((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  return [manual, toggle];
}

function ModuleRolloutCard({ module: mod, onEnable, enabling, canEdit }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-black/8 px-4 py-3 dark:border-white/10">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold">{mod.label}</p>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase text-muted dark:bg-white/10">
            {mod.phase}
          </span>
          {mod.enabled && (
            <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-green">
              On
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">{mod.description}</p>
        {mod.blocked_by?.length > 0 && !mod.enabled && (
          <p className="mt-1 text-xs text-brand-gold">Requires: {mod.blocked_by.join(', ')}</p>
        )}
        {mod.enabled && mod.setup_admin && (
          <Link to={mod.setup_admin} className="mt-2 inline-block text-xs font-bold text-brand-green hover:underline">
            Open setup →
          </Link>
        )}
      </div>
      {!mod.enabled && canEdit && (
        <button
          type="button"
          className="btn-primary shrink-0 text-xs"
          disabled={!mod.can_enable || enabling}
          onClick={() => onEnable(mod.id)}
        >
          {enabling ? 'Enabling…' : 'Enable'}
        </button>
      )}
    </div>
  );
}

export default function AdminLaunchReadinessPage() {
  const user = useAuthStore((s) => s.user);
  const canView = hasAnyPermission(user, ['view_company_settings', 'edit_company_settings']);
  const { data, isLoading, isError, error, refetch, isFetching } = useLaunchReadiness(canView);
  const pilotPreset = useApplyPilotPreset();
  const enableModule = useEnableModule();
  const canEditSettings = hasPermission(user, 'edit_company_settings');
  const [pilotMsg, setPilotMsg] = useState('');
  const [growthMsg, setGrowthMsg] = useState('');
  const [enablingId, setEnablingId] = useState(null);

  const applyPilotPreset = useCallback(async () => {
    if (!window.confirm('Turn off logistics, marketplace, HR, and analytics toggles? Core store checkout stays on.')) {
      return;
    }
    try {
      const res = await pilotPreset.mutateAsync();
      setPilotMsg(res.message || 'Pilot preset applied.');
      refetch();
    } catch (e) {
      setPilotMsg(e?.response?.data?.message || 'Could not apply pilot preset.');
    }
  }, [pilotPreset, refetch]);

  const handleEnableModule = useCallback(
    async (moduleId) => {
      const label = data?.module_rollout?.modules?.find((m) => m.id === moduleId)?.label ?? moduleId;
      if (!window.confirm(`Enable ${label}? Complete admin setup and smoke tests before customers use it.`)) {
        return;
      }
      setEnablingId(moduleId);
      setGrowthMsg('');
      try {
        const res = await enableModule.mutateAsync(moduleId);
        setGrowthMsg(res.message || `${label} enabled.`);
        refetch();
      } catch (e) {
        setGrowthMsg(e?.response?.data?.message || `Could not enable ${label}.`);
      } finally {
        setEnablingId(null);
      }
    },
    [enableModule, refetch, data?.module_rollout?.modules]
  );

  const [manualP1, toggleP1] = useManualChecks(MANUAL_P1_KEY);
  const [manualP2, toggleP2] = useManualChecks(MANUAL_P2_KEY);
  const [manualP3, toggleP3] = useManualChecks(MANUAL_P3_KEY);
  const [manualP4, toggleP4] = useManualChecks(MANUAL_P4_KEY);
  const [manualP5, toggleP5] = useManualChecks(MANUAL_P5_KEY);
  const [manualOps, toggleOps] = useManualChecks(MANUAL_OPS_KEY);

  if (user && !canView) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (isLoading && !data) {
    return <AdminPageLoading message="Checking launch readiness…" />;
  }

  if (isError && !data) {
    return <AdminPageError message={error?.response?.data?.message || 'Could not load readiness checks.'} />;
  }

  const p1Ready = data?.ready;
  const p1Summary = data?.summary ?? { pass: 0, warn: 0, fail: 0 };
  const p2 = data?.p2;
  const p2Ready = p2?.ready;
  const p2Summary = p2?.summary ?? { pass: 0, warn: 0, fail: 0 };
  const p3 = data?.p3;
  const p3Ready = p3?.ready;
  const p3Summary = p3?.summary ?? { pass: 0, warn: 0, fail: 0 };
  const p3Modules = p3?.modules ?? {};
  const anyP3Module =
    p3Modules.pickup_stations_enabled
    || p3Modules.driver_module_enabled
    || p3Modules.station_repack_module_enabled
    || p3Modules.marketplace_enabled;
  const p4 = data?.p4;
  const p4Ready = p4?.ready;
  const p4Summary = p4?.summary ?? { pass: 0, warn: 0, fail: 0 };
  const p5 = data?.p5;
  const p5Ready = p5?.ready;
  const p5Summary = p5?.summary ?? { pass: 0, warn: 0, fail: 0 };
  const rollout = data?.module_rollout;
  const phase1Complete = rollout?.phase1_ready ?? (p1Ready && p2Ready);
  const phase2Complete = p3Ready && p4Ready && p5Ready;
  const rolloutModules = rollout?.modules ?? [];

  return (
    <div>
      <AdminPageHeader
        title="Launch readiness"
        subtitle="P1 pilot → P2 public launch → P3 logistics → P4 workforce → P5 quality & ops."
        actions={
          <button type="button" onClick={() => refetch()} className="btn-ghost text-sm" disabled={isFetching}>
            {isFetching ? 'Refreshing…' : 'Refresh checks'}
          </button>
        }
      />

      <section className="admin-panel mb-8 border-2 border-brand-green/30">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-brand-green">Phase 1 — Go live safely</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Fix P1/P2 blockers, run a live payment test, and keep extended modules off until you are ready to operate them.
            </p>
          </div>
          {canEditSettings && (
            <button
              type="button"
              className="btn-primary shrink-0 text-sm"
              disabled={pilotPreset.isPending}
              onClick={applyPilotPreset}
            >
              {pilotPreset.isPending ? 'Applying…' : 'Apply pilot preset'}
            </button>
          )}
        </div>
        {pilotMsg && (
          <p className="mb-4 rounded-xl bg-brand-green/10 px-4 py-2 text-sm font-medium text-brand-green">{pilotMsg}</p>
        )}
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div
            className={`rounded-xl border px-4 py-3 ${
              p1Ready ? 'border-brand-green/40 bg-brand-green/10' : 'border-brand-gold/40 bg-brand-gold/10'
            }`}
          >
            <p className="font-bold">{p1Ready ? 'P1 pilot — ready' : 'P1 pilot — fix blockers'}</p>
            <p className="mt-1 text-xs text-muted">
              Paystack key, catalog, company contact, live test payment + webhook.
            </p>
          </div>
          <div
            className={`rounded-xl border px-4 py-3 ${
              p2Ready ? 'border-brand-green/40 bg-brand-green/10' : 'border-brand-gold/40 bg-brand-gold/10'
            }`}
          >
            <p className="font-bold">{p2Ready ? 'P2 public — ready' : 'P2 public — before marketing'}</p>
            <p className="mt-1 text-xs text-muted">
              Legal policies in footer and checkout, hero, robots.txt + sitemap.
            </p>
          </div>
        </div>
        <pre className="overflow-x-auto rounded-xl bg-black/5 p-4 text-xs dark:bg-white/5">
{`php backend/scripts/pilot-preset.php
php backend/scripts/pilot-smoke-test.php
php backend/scripts/p5-smoke-test.php`}
        </pre>
      </section>

      <section
        className={`admin-panel mb-8 border-2 ${
          phase1Complete ? 'border-brand-gold/40' : 'border-black/10 opacity-90 dark:border-white/10'
        }`}
      >
        <div className="mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-brand-gold">Phase 2 — Operate and grow</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Enable one module at a time, finish its admin setup, then run smoke tests. Turn on HR and analytics when you
            are ready to operate them.
          </p>
          {!phase1Complete && (
            <p className="mt-2 rounded-xl bg-brand-gold/10 px-4 py-2 text-sm font-medium text-amber-900 dark:text-brand-gold">
              Complete Phase 1 (P1 + P2 checks) before enabling growth modules.
            </p>
          )}
        </div>
        {growthMsg && (
          <p className="mb-4 rounded-xl bg-brand-green/10 px-4 py-2 text-sm font-medium text-brand-green">{growthMsg}</p>
        )}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div
            className={`rounded-xl border px-4 py-3 ${
              p3Ready ? 'border-brand-green/40 bg-brand-green/10' : 'border-brand-gold/40 bg-brand-gold/10'
            }`}
          >
            <p className="font-bold">{p3Ready ? 'P3 logistics — ready' : 'P3 logistics'}</p>
            <p className="mt-1 text-xs text-muted">Pickup, drivers, repack, marketplace — enable below one at a time.</p>
          </div>
          <div
            className={`rounded-xl border px-4 py-3 ${
              p4Ready ? 'border-brand-green/40 bg-brand-green/10' : 'border-brand-gold/40 bg-brand-gold/10'
            }`}
          >
            <p className="font-bold">{p4Ready ? 'P4 HR — ready' : 'P4 workforce HR'}</p>
            <p className="mt-1 text-xs text-muted">Employee profiles and leave when HR is enabled.</p>
          </div>
          <div
            className={`rounded-xl border px-4 py-3 ${
              p5Ready ? 'border-brand-green/40 bg-brand-green/10' : 'border-brand-gold/40 bg-brand-gold/10'
            }`}
          >
            <p className="font-bold">{p5Ready ? 'P5 ops — ready' : 'P5 quality & ops'}</p>
            <p className="mt-1 text-xs text-muted">GA4, Sentry DSN, uptime monitor, post-deploy smoke tests.</p>
          </div>
        </div>

        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Module rollout</h3>
        <ul className="mb-6 space-y-2">
          {rolloutModules.map((mod) => (
            <li key={mod.id}>
              <ModuleRolloutCard
                module={mod}
                canEdit={canEditSettings && phase1Complete}
                enabling={enablingId === mod.id}
                onEnable={handleEnableModule}
              />
            </li>
          ))}
        </ul>

        <ManualChecklist
          items={OPS_WEEKLY_ITEMS}
          manual={manualOps}
          onToggle={toggleOps}
          doneMessage="Weekly ops review complete."
        />

        <pre className="mt-6 overflow-x-auto rounded-xl bg-black/5 p-4 text-xs dark:bg-white/5">
{`# After enabling a module — configure in admin, then:
php backend/scripts/p5-smoke-test.php
php backend/scripts/launch-readiness-cli.php

# Optional production monitoring (.env):
# SENTRY_DSN=https://...@sentry.io/...`}
        </pre>
        {phase2Complete && (
          <p className="mt-4 text-sm font-semibold text-brand-green">Phase 2 automated checks complete — keep the weekly ops habit.</p>
        )}
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div
          className={`rounded-2xl border px-5 py-4 ${
            p1Ready ? 'border-brand-green/40 bg-brand-green/10' : 'border-brand-gold/40 bg-brand-gold/10'
          }`}
        >
          <p className="text-lg font-extrabold">{p1Ready ? 'P1 — Pilot ready' : 'P1 — Complete pilot checks'}</p>
          <p className="mt-1 text-sm text-muted">
            {p1Ready
              ? 'Automated pilot checks passed. Run manual smoke tests with a live payment.'
              : 'Fix blocking items before real customer orders.'}
          </p>
        </div>
        <div
          className={`rounded-2xl border px-5 py-4 ${
            p2Ready ? 'border-brand-green/40 bg-brand-green/10' : 'border-brand-gold/40 bg-brand-gold/10'
          }`}
        >
          <p className="text-lg font-extrabold">{p2Ready ? 'P2 — Public launch ready' : 'P2 — Before marketing'}</p>
          <p className="mt-1 text-sm text-muted">
            {p2Ready
              ? 'Legal, checkout trust, and SEO checks passed.'
              : 'Publish returns, privacy, and terms; verify footer and checkout links.'}
          </p>
        </div>
        <div
          className={`rounded-2xl border px-5 py-4 ${
            p3Ready ? 'border-brand-green/40 bg-brand-green/10' : 'border-brand-gold/40 bg-brand-gold/10'
          }`}
        >
          <p className="text-lg font-extrabold">{p3Ready ? 'P3 — Modules ready' : 'P3 — Logistics & shops'}</p>
          <p className="mt-1 text-sm text-muted">
            {anyP3Module
              ? 'Configure stations, drivers, repack, or marketplace before rollout.'
              : 'Modules off — enable in Company settings when expanding beyond core store.'}
          </p>
        </div>
        <div
          className={`rounded-2xl border px-5 py-4 ${
            p4Ready ? 'border-brand-green/40 bg-brand-green/10' : 'border-brand-gold/40 bg-brand-gold/10'
          }`}
        >
          <p className="text-lg font-extrabold">{p4Ready ? 'P4 — HR ready' : 'P4 — Workforce HR'}</p>
          <p className="mt-1 text-sm text-muted">
            {p4?.hr_enabled
              ? 'Employee profiles and leave requests — complete setup below.'
              : 'Leave requests off — enable in Company settings when needed.'}
          </p>
        </div>
        <div
          className={`rounded-2xl border px-5 py-4 ${
            p5Ready ? 'border-brand-green/40 bg-brand-green/10' : 'border-brand-gold/40 bg-brand-gold/10'
          }`}
        >
          <p className="text-lg font-extrabold">{p5Ready ? 'P5 — Ops ready' : 'P5 — Quality & ops'}</p>
          <p className="mt-1 text-sm text-muted">
            {p5?.analytics_enabled
              ? 'Analytics on — verify smoke tests and monitoring.'
              : 'Smoke tests, monitoring, and optional GA4 tracking.'}
          </p>
        </div>
      </div>

      <section className="admin-panel mb-8">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-muted">Phase P1 — automated</h2>
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <AdminStatCard label="Passed" value={p1Summary.pass} icon="✓" tone="green" />
          <AdminStatCard label="Warnings" value={p1Summary.warn} icon="!" tone="gold" />
          <AdminStatCard label="Failed" value={p1Summary.fail} icon="✗" tone="neutral" />
          <AdminStatCard label="Active products" value={data?.stats?.products_active ?? '—'} icon="📦" tone="neutral" />
        </div>
        <CheckList checks={data?.checks} />
      </section>

      <section className="admin-panel mb-8">
        <ManualChecklist
          items={data?.manual ?? []}
          manual={manualP1}
          onToggle={toggleP1}
          doneMessage="P1 manual tests complete — aim for 3+ real pilot orders without database edits."
        />
      </section>

      <section className="admin-panel mb-8">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-muted">Phase P2 — public launch</h2>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Passed" value={p2Summary.pass} icon="✓" tone="green" />
          <AdminStatCard label="Warnings" value={p2Summary.warn} icon="!" tone="gold" />
          <AdminStatCard label="Failed" value={p2Summary.fail} icon="✗" tone="neutral" />
        </div>
        <CheckList checks={p2?.checks} />
      </section>

      <section className="admin-panel mb-8">
        <ManualChecklist
          items={p2?.manual ?? []}
          manual={manualP2}
          onToggle={toggleP2}
          doneMessage="P2 ops checklist complete — safe to start public marketing."
        />
      </section>

      <section className="admin-panel mb-8">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-muted">Phase P3 — logistics &amp; marketplace</h2>
        <p className="mb-4 text-sm text-muted">
          Toggle modules in{' '}
          <Link to="/admin/company-settings" className="font-bold text-brand-green hover:underline">
            Company settings
          </Link>
          . When a module is on, its setup must be complete before customers use it.
        </p>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Passed" value={p3Summary.pass} icon="✓" tone="green" />
          <AdminStatCard label="Warnings" value={p3Summary.warn} icon="!" tone="gold" />
          <AdminStatCard label="Failed" value={p3Summary.fail} icon="✗" tone="neutral" />
        </div>
        <CheckList checks={p3?.checks} />
      </section>

      <section className="admin-panel mb-8">
        <ManualChecklist
          items={p3?.manual ?? []}
          manual={manualP3}
          onToggle={toggleP3}
          doneMessage="P3 module smoke tests complete."
        />
      </section>

      <section className="admin-panel mb-8">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-muted">Phase P4 — workforce HR</h2>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Passed" value={p4Summary.pass} icon="✓" tone="green" />
          <AdminStatCard label="Warnings" value={p4Summary.warn} icon="!" tone="gold" />
          <AdminStatCard label="Failed" value={p4Summary.fail} icon="✗" tone="neutral" />
        </div>
        <CheckList checks={p4?.checks} />
      </section>

      <section className="admin-panel mb-8">
        <ManualChecklist
          items={p4?.manual ?? []}
          manual={manualP4}
          onToggle={toggleP4}
          doneMessage="P4 HR checklist complete."
        />
      </section>

      <section className="admin-panel mb-8">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-muted">Phase P5 — quality &amp; ops</h2>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Passed" value={p5Summary.pass} icon="✓" tone="green" />
          <AdminStatCard label="Warnings" value={p5Summary.warn} icon="!" tone="gold" />
          <AdminStatCard label="Failed" value={p5Summary.fail} icon="✗" tone="neutral" />
        </div>
        <CheckList checks={p5?.checks} />
      </section>

      <section className="admin-panel mb-8">
        <ManualChecklist
          items={p5?.manual ?? []}
          manual={manualP5}
          onToggle={toggleP5}
          doneMessage="P5 ops checklist complete."
        />
      </section>

      <section className="admin-panel">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">CLI helpers</h2>
        <pre className="overflow-x-auto rounded-xl bg-black/5 p-4 text-xs dark:bg-white/5">
{`php backend/scripts/pilot-smoke-test.php
php backend/scripts/p5-smoke-test.php
php backend/scripts/launch-readiness-cli.php`}
        </pre>
        <p className="mt-3 text-xs text-muted">
          Environment: <strong>{data?.stats?.app_env ?? '—'}</strong>
          {' · '}
          Paid orders: <strong>{data?.stats?.orders_paid ?? '—'}</strong>
        </p>
      </section>
    </div>
  );
}
