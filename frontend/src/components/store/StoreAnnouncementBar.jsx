import { Link } from 'react-router-dom';
import { usePlatformFeatures } from '../../hooks/checkout';
import { ShieldCheckIcon, StoreIcon, TruckIcon } from '../icons';

const TRUST_ITEMS = [
  {
    Icon: TruckIcon,
    title: 'Pickup & delivery',
    sub: 'Hub-to-station across Ghana',
    to: '/shop',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'Secure checkout',
    sub: 'MoMo, card & wallet',
    to: '/shop',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'Order support',
    sub: 'Track every step',
    to: '/contact',
  },
];

export default function StoreAnnouncementBar() {
  const { marketplaceEnabled, shopApplicationsOpen } = usePlatformFeatures();

  const marketplaceItems = [];
  if (marketplaceEnabled) {
    marketplaceItems.push({
      Icon: StoreIcon,
      title: 'Browse shops',
      sub: 'Find sellers nearby',
      to: '/stores',
    });
  }
  if (marketplaceEnabled && shopApplicationsOpen) {
    marketplaceItems.push({
      Icon: StoreIcon,
      title: 'Sell on DPM',
      sub: 'Apply to open a shop',
      to: '/sell',
    });
  }

  const items = [...TRUST_ITEMS, ...marketplaceItems].slice(0, 4);

  return (
    <div
      className="hidden border-b border-brand-green/20 bg-[#0F2418] text-white md:block"
      role="region"
      aria-label="Store benefits"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.Icon;
          return (
          <Link
            key={item.title}
            to={item.to}
            className="flex items-center gap-2.5 border-white/10 px-4 py-2.5 transition hover:bg-white/5 lg:border-l lg:first:border-l-0"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-green/25 text-brand-gold"
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold leading-tight">{item.title}</span>
              <span className="block text-[10px] leading-tight text-white/60">{item.sub}</span>
            </span>
          </Link>
          );
        })}
      </div>
    </div>
  );
}
