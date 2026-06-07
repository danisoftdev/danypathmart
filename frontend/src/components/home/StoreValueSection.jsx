import { Link } from 'react-router-dom';
import { CardIcon, ChatIcon, MapPinIcon, StarIcon } from '../icons';

const VALUE_CARDS = [
  {
    title: 'Official Pathfinder & club supplies',
    desc: 'Uniforms, badges, insignia, and books from trusted sellers.',
    Icon: StarIcon,
    iconTone: 'text-brand-green',
    to: '/shop',
    tone: 'border-black/8 bg-white hover:border-brand-green/30 dark:border-white/10 dark:bg-[#1E1E1E]',
  },
  {
    title: 'Pay once at checkout',
    desc: 'MoMo, card, or wallet — one secure DPM payment.',
    Icon: CardIcon,
    iconTone: 'text-brand-gold',
    to: '/shop',
    tone: 'border-black/8 bg-white hover:border-brand-gold/40 dark:border-white/10 dark:bg-[#1E1E1E]',
  },
  {
    title: 'Pickup stations nationwide',
    desc: 'Choose a station near you or follow hub delivery updates.',
    Icon: MapPinIcon,
    iconTone: 'text-brand-emerald',
    to: '/shop',
    tone: 'border-black/8 bg-white hover:border-brand-emerald/40 dark:border-white/10 dark:bg-[#1E1E1E]',
  },
  {
    title: 'Need help?',
    desc: 'Quotes for schools & clubs, or message our team.',
    Icon: ChatIcon,
    iconTone: 'text-brand-green',
    to: '/contact',
    tone: 'border-black/8 bg-white hover:border-brand-green/30 dark:border-white/10 dark:bg-[#1E1E1E]',
  },
];

export default function StoreValueSection() {
  return (
    <section aria-labelledby="store-value-heading" className="space-y-3">
      <h2 id="store-value-heading" className="sr-only">
        Why shop with DanyPathMart
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {VALUE_CARDS.map((card) => {
          const Icon = card.Icon;
          return (
          <Link
            key={card.title}
            to={card.to}
            className={`flex gap-3 rounded-xl border p-4 transition hover:shadow-md ${card.tone}`}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F6F7F9] dark:bg-white/5"
              aria-hidden
            >
              <Icon className={`h-5 w-5 ${card.iconTone}`} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[#111111] dark:text-white">{card.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{card.desc}</span>
            </span>
          </Link>
          );
        })}
      </div>
    </section>
  );
}
