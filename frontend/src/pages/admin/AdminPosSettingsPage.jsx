import { useState } from 'react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { FormPanelSkeleton } from '../../components/ui/Skeleton';
import {
  usePosAdminSettings,
  usePosCreateLocation,
  usePosCreateRegister,
  usePosLocations,
  usePosRegisters,
  usePosUpdateLocation,
  usePosUpdateRegister,
  usePosUpdateSettings,
  usePosBackfillBarcodes,
} from '../../hooks/pos';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/permissions';
import { Navigate } from 'react-router-dom';

export default function AdminPosSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const canConfig = user?.role === 'super_admin' || hasPermission(user, 'manage_pos_config') || hasPermission(user, 'edit_company_settings');

  const { data: settingsData, isLoading } = usePosAdminSettings();
  const updateSettings = usePosUpdateSettings();
  const backfillBarcodes = usePosBackfillBarcodes();
  const { data: locData } = usePosLocations();
  const createLoc = usePosCreateLocation();
  const updateLoc = usePosUpdateLocation();
  const { data: regData } = usePosRegisters(null);
  const createReg = usePosCreateRegister();
  const updateReg = usePosUpdateRegister();

  const [settings, setSettings] = useState(null);
  const [newSupervisorPin, setNewSupervisorPin] = useState('');
  const [locForm, setLocForm] = useState({ name: '', address: '', momo_number: '' });
  const [regForm, setRegForm] = useState({ location_id: '', name: '', code: '', momo_number: '' });
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const form = settings ?? settingsData?.settings ?? {};

  if (!canConfig) return <Navigate to="/admin" replace />;
  if (isLoading && !settingsData) return <FormPanelSkeleton sections={2} />;

  const saveSettings = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = { ...form };
      if (newSupervisorPin.trim()) {
        payload.pos_supervisor_pin = newSupervisorPin.trim();
      }
      await updateSettings.mutateAsync(payload);
      setNewSupervisorPin('');
      setToast('POS settings saved.');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed.');
    }
  };

  const addLocation = async (e) => {
    e.preventDefault();
    try {
      await createLoc.mutateAsync({ ...locForm, is_active: true });
      setLocForm({ name: '', address: '', momo_number: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add location.');
    }
  };

  const addRegister = async (e) => {
    e.preventDefault();
    try {
      await createReg.mutateAsync({
        ...regForm,
        location_id: Number(regForm.location_id),
        is_active: true,
      });
      setRegForm({ location_id: '', name: '', code: '', momo_number: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add register.');
    }
  };

  return (
    <div>
      <AdminPageHeader title="POS setup" subtitle="Enable point of sale, locations, registers, and supervisor controls." />
      {toast && <p className="mb-4 rounded-xl bg-brand-green/10 px-4 py-3 text-sm font-bold text-brand-green">{toast}</p>}
      {error && <p className="mb-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</p>}

      <form onSubmit={saveSettings} className="mb-8 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
        <h2 className="font-extrabold">Settings</h2>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!form.pos_module_enabled} onChange={(e) => setSettings({ ...form, pos_module_enabled: e.target.checked })} />
          Enable POS module
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold">Max cashier discount %</span>
            <input type="number" className="input-field mt-1 w-full" value={form.pos_max_cashier_discount_percent ?? 10} onChange={(e) => setSettings({ ...form, pos_max_cashier_discount_percent: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Void window (minutes)</span>
            <input type="number" className="input-field mt-1 w-full" value={form.pos_void_window_minutes ?? 30} onChange={(e) => setSettings({ ...form, pos_void_window_minutes: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Central MoMo number</span>
            <input className="input-field mt-1 w-full" value={form.pos_central_momo || ''} onChange={(e) => setSettings({ ...form, pos_central_momo: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Supervisor PIN {form.has_supervisor_pin ? '(set — enter new to change)' : '(not set)'}</span>
            <input type="password" className="input-field mt-1 w-full" value={newSupervisorPin} onChange={(e) => setNewSupervisorPin(e.target.value)} placeholder="4–6 digits" autoComplete="new-password" />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-semibold">Receipt footer</span>
            <input className="input-field mt-1 w-full" value={form.pos_receipt_footer || ''} onChange={(e) => setSettings({ ...form, pos_receipt_footer: e.target.value })} />
          </label>
        </div>
        <button type="submit" className="btn-primary mt-4" disabled={updateSettings.isPending}>Save settings</button>
        <button
          type="button"
          className="btn-secondary mt-4 ml-3"
          disabled={backfillBarcodes.isPending}
          onClick={async () => {
            try {
              const res = await backfillBarcodes.mutateAsync();
              setToast(res.message || 'Barcodes assigned.');
              setTimeout(() => setToast(''), 4000);
            } catch (err) {
              setError(err.response?.data?.message || 'Backfill failed.');
            }
          }}
        >
          Assign barcodes to all DPM products
        </button>
      </form>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
          <h2 className="font-extrabold">Locations</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {(locData?.data ?? []).map((l) => (
              <li key={l.id} className="rounded-lg bg-black/5 p-3 dark:bg-white/5">
                <input className="input-field mb-1 w-full font-bold" defaultValue={l.name} onBlur={(e) => updateLoc.mutate({ id: l.id, name: e.target.value, address: l.address, momo_number: l.momo_number, is_active: l.is_active })} />
                <input className="input-field mb-1 w-full text-muted" defaultValue={l.address || ''} placeholder="Address" onBlur={(e) => updateLoc.mutate({ id: l.id, name: l.name, address: e.target.value, momo_number: l.momo_number, is_active: l.is_active })} />
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" defaultChecked={l.is_active} onChange={(e) => updateLoc.mutate({ id: l.id, name: l.name, address: l.address, momo_number: l.momo_number, is_active: e.target.checked })} />
                  Active
                </label>
              </li>
            ))}
          </ul>
          <form onSubmit={addLocation} className="mt-4 space-y-2">
            <input className="input-field w-full" placeholder="Location name" value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} required />
            <input className="input-field w-full" placeholder="Address" value={locForm.address} onChange={(e) => setLocForm({ ...locForm, address: e.target.value })} />
            <input className="input-field w-full" placeholder="MoMo override" value={locForm.momo_number} onChange={(e) => setLocForm({ ...locForm, momo_number: e.target.value })} />
            <button type="submit" className="btn-secondary w-full">Add location</button>
          </form>
        </section>

        <section className="rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
          <h2 className="font-extrabold">Registers</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {(regData?.data ?? []).map((r) => (
              <li key={r.id} className="rounded-lg bg-black/5 p-3 dark:bg-white/5">
                <input className="input-field mb-1 w-full font-bold" defaultValue={r.name} onBlur={(e) => updateReg.mutate({ id: r.id, name: e.target.value, code: r.code, momo_number: r.momo_number, is_active: r.is_active })} />
                <p className="text-xs text-muted">{r.location_name} · {r.code}</p>
                <label className="mt-1 flex items-center gap-2 text-xs">
                  <input type="checkbox" defaultChecked={r.is_active} onChange={(e) => updateReg.mutate({ id: r.id, name: r.name, code: r.code, momo_number: r.momo_number, is_active: e.target.checked })} />
                  Active
                </label>
              </li>
            ))}
          </ul>
          <form onSubmit={addRegister} className="mt-4 space-y-2">
            <select className="input-field w-full" value={regForm.location_id} onChange={(e) => setRegForm({ ...regForm, location_id: e.target.value })} required>
              <option value="">Location…</option>
              {(locData?.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <input className="input-field w-full" placeholder="Register name" value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} required />
            <input className="input-field w-full" placeholder="Code (e.g. counter-1)" value={regForm.code} onChange={(e) => setRegForm({ ...regForm, code: e.target.value })} required />
            <button type="submit" className="btn-secondary w-full">Add register</button>
          </form>
        </section>
      </div>
    </div>
  );
}
