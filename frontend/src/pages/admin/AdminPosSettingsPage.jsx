import { useState } from 'react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { FormPanelSkeleton } from '../../components/ui/Skeleton';
import {
  usePosAdminSettings,
  usePosCreateLocation,
  usePosCreateRegister,
  usePosLocations,
  usePosRegisters,
  usePosUpdateSettings,
} from '../../hooks/pos';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/permissions';
import { Navigate } from 'react-router-dom';

export default function AdminPosSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const canConfig = user?.role === 'super_admin' || hasPermission(user, 'manage_pos_config') || hasPermission(user, 'edit_company_settings');

  const { data: settingsData, isLoading } = usePosAdminSettings();
  const updateSettings = usePosUpdateSettings();
  const { data: locData } = usePosLocations();
  const createLoc = usePosCreateLocation();
  const { data: regData } = usePosRegisters(null);
  const createReg = usePosCreateRegister();

  const [settings, setSettings] = useState(null);
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
      await updateSettings.mutateAsync(form);
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
      <AdminPageHeader title="POS setup" subtitle="Enable point of sale, locations, and registers." />
      {toast && <p className="mb-4 rounded-xl bg-brand-green/10 px-4 py-3 text-sm font-bold text-brand-green">{toast}</p>}
      {error && <p className="mb-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</p>}

      <form onSubmit={saveSettings} className="mb-8 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
        <h2 className="font-extrabold">Settings</h2>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!form.pos_module_enabled}
            onChange={(e) => setSettings({ ...form, pos_module_enabled: e.target.checked })}
          />
          Enable POS module
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold">Max cashier discount %</span>
            <input
              type="number"
              className="input-field mt-1 w-full"
              value={form.pos_max_cashier_discount_percent ?? 10}
              onChange={(e) => setSettings({ ...form, pos_max_cashier_discount_percent: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Central MoMo number</span>
            <input
              className="input-field mt-1 w-full"
              value={form.pos_central_momo || ''}
              onChange={(e) => setSettings({ ...form, pos_central_momo: e.target.value })}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-semibold">Receipt footer</span>
            <input
              className="input-field mt-1 w-full"
              value={form.pos_receipt_footer || ''}
              onChange={(e) => setSettings({ ...form, pos_receipt_footer: e.target.value })}
            />
          </label>
        </div>
        <button type="submit" className="btn-primary mt-4" disabled={updateSettings.isPending}>Save settings</button>
      </form>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
          <h2 className="font-extrabold">Locations</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(locData?.data ?? []).map((l) => (
              <li key={l.id} className="rounded-lg bg-black/5 px-3 py-2 dark:bg-white/5">
                <p className="font-bold">{l.name}</p>
                {l.address && <p className="text-muted">{l.address}</p>}
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
          <ul className="mt-3 space-y-2 text-sm">
            {(regData?.data ?? []).map((r) => (
              <li key={r.id} className="rounded-lg bg-black/5 px-3 py-2 dark:bg-white/5">
                <p className="font-bold">{r.name} <span className="text-muted">({r.code})</span></p>
                <p className="text-muted">{r.location_name}</p>
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
