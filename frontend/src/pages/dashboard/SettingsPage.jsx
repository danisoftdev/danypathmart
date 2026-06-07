import { useSearchParams } from 'react-router-dom';
import ProfileTab from '../../components/dashboard/settings/ProfileTab';
import SecurityTab from '../../components/dashboard/settings/SecurityTab';
import AddressesTab from '../../components/dashboard/settings/AddressesTab';

const TABS = [
  { id: 'profile', label: 'Profile', Component: ProfileTab },
  { id: 'security', label: 'Security', Component: SecurityTab },
  { id: 'addresses', label: 'Addresses', Component: AddressesTab },
];

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const active = TABS.find((t) => t.id === params.get('tab')) ? params.get('tab') : 'profile';
  const ActiveComponent = TABS.find((t) => t.id === active).Component;

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold">Settings</h1>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-black/5 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-[#161616]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setParams({ tab: t.id })}
            className={[
              'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition',
              active === t.id
                ? 'bg-brand-green text-white'
                : 'text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/5',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ActiveComponent />
    </div>
  );
}
