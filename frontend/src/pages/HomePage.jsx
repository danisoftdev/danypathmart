import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <div className="rounded-3xl bg-gradient-to-br from-brand-green to-brand-emerald p-10 text-white md:p-16">
        <h1 className="max-w-2xl text-3xl font-extrabold leading-tight md:text-5xl">
          SDA youth insignias, uniforms &amp; materials
          <span className="text-brand-gold">.</span>
        </h1>
        <p className="mt-4 max-w-xl text-white/90">
          Shop badges, uniforms, books and resources for Adventurers, Pathfinders and
          Master Guides - delivered across Ghana.
        </p>
        <Link to="/shop" className="btn-secondary mt-6 inline-block">
          Start shopping
        </Link>
      </div>
      <p className="mt-10 text-center text-sm text-gray-400">
        Product catalog and storefront arrive on Day 2.
      </p>
    </section>
  );
}
