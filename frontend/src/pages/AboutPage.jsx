import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { usePublicAboutPage } from '../hooks/storefront';
import { resolveImageUrl } from '../lib/currency';
import { GlobeIcon, LinkedInIcon } from '../components/icons';

function Paragraphs({ text }) {
  const parts = String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-[#333] dark:text-[#ddd]">
      {parts.map((p) => (
        <p key={p.slice(0, 24)}>{p}</p>
      ))}
    </div>
  );
}

function CtaLink({ to, children, primary }) {
  if (!to || !children) return null;
  const external = /^https?:\/\//i.test(to);
  const className = primary
    ? 'btn-primary inline-flex px-5 py-2.5 text-sm'
    : 'inline-flex rounded-xl border border-brand-green/30 px-5 py-2.5 text-sm font-bold text-brand-green hover:bg-brand-green/5';
  if (external) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

function teamPhotoUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/images/') || url.startsWith('/assets/')) return url;
  return resolveImageUrl(url);
}

function TeamMemberCard({ member }) {
  const photo = teamPhotoUrl(member.photo_url);
  const linkedin = String(member.linkedin_url || '').trim();
  const website = String(member.website_url || '').trim();
  const hasLinks = !!(linkedin || website);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-black/8 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#1A1A1A] sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-green via-brand-gold to-brand-green" />
      <div className="flex gap-3 sm:gap-4">
        <div className="relative shrink-0">
          {photo ? (
            <img
              src={photo}
              alt={member.name}
              className="h-14 w-14 rounded-full object-cover ring-2 ring-brand-green/15 sm:h-16 sm:w-16"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-green text-lg font-extrabold text-white sm:h-16 sm:w-16">
              {(member.name || '?').slice(0, 1)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-extrabold leading-tight text-[#111] dark:text-white sm:text-base">
            {member.name}
          </h3>
          {member.role_title ? (
            <p className="mt-0.5 text-[11px] font-bold tracking-wide text-brand-gold sm:text-xs">
              {member.role_title}
            </p>
          ) : null}
          {member.bio ? (
            <p className="mt-2 text-[11.5px] leading-snug text-[#555] dark:text-[#ccc] sm:text-xs sm:leading-relaxed">
              {member.bio}
            </p>
          ) : null}
          {hasLinks ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {linkedin && (
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-[#0A66C2]/25 bg-[#0A66C2]/5 px-2.5 py-1 text-[11px] font-bold text-[#0A66C2] transition hover:bg-[#0A66C2] hover:text-white"
                >
                  <LinkedInIcon className="h-3 w-3" />
                  LinkedIn
                </a>
              )}
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 px-2.5 py-1 text-[11px] font-bold text-[#333] transition hover:border-brand-gold hover:text-brand-gold dark:border-white/15 dark:text-white"
                >
                  <GlobeIcon className="h-3 w-3" />
                  Website
                </a>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ItemGrid({ items }) {
  const list = Array.isArray(items) ? items.filter((i) => (i.title || i.label || i.body || i.value)) : [];
  if (list.length === 0) return null;
  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((item, idx) => (
        <div key={`${item.title || item.label}-${idx}`} className="border-t border-brand-green/25 pt-4">
          <h3 className="text-base font-extrabold text-brand-green">{item.title || item.label}</h3>
          {(item.body || item.value) && (
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.body || item.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AboutPage() {
  const { data, isLoading, isError } = usePublicAboutPage();
  const enabled = !!data?.enabled;
  const page = data?.page;

  useEffect(() => {
    if (!page?.seo_title) return undefined;
    const prev = document.title;
    document.title = page.seo_title;
    let meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content') || '';
    if (page.seo_description) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', page.seo_description);
    }
    return () => {
      document.title = prev;
      if (meta && page.seo_description) meta.setAttribute('content', prevDesc);
    };
  }, [page?.seo_title, page?.seo_description]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-muted">
        Loading…
      </div>
    );
  }

  if (isError || !enabled || !page) {
    return <Navigate to="/" replace />;
  }

  const team = Array.isArray(page.team) ? page.team : [];
  const trustedItems = Array.isArray(page.trusted_by_items) ? page.trusted_by_items : [];

  return (
    <div className="bg-gradient-to-b from-brand-green/[0.06] via-transparent to-transparent dark:from-brand-green/10">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-brand-green/15">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(20,120,70,0.12),_transparent_55%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-14 md:py-20">
          <nav className="mb-8 text-sm text-muted">
            <Link to="/" className="font-semibold text-brand-green hover:underline">Home</Link>
            <span className="mx-2">/</span>
            <span>About</span>
          </nav>
          {page.hero_kicker && (
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold">{page.hero_kicker}</p>
          )}
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-brand-green sm:text-5xl md:text-6xl">
            {page.hero_title}
          </h1>
          {page.hero_subtitle && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#444] dark:text-[#ccc] md:text-lg">
              {page.hero_subtitle}
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaLink to={page.hero_cta_link} primary>{page.hero_cta_label}</CtaLink>
            <CtaLink to={page.hero_secondary_link}>{page.hero_secondary_label}</CtaLink>
          </div>
        </div>
      </section>

      {/* Trusted by (optional toggle) */}
      {page.trusted_by_enabled && trustedItems.length > 0 && (
        <section className="border-b border-black/5 py-10 dark:border-white/10">
          <div className="mx-auto max-w-5xl px-4">
            <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-muted">
              {page.trusted_by_heading || 'Trusted by'}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {trustedItems.map((item, idx) => (
                <span key={`${item.label}-${idx}`} className="text-sm font-semibold text-[#555] dark:text-[#bbb]">
                  {item.label || item.value}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Our story */}
      <section className="mx-auto max-w-3xl px-4 py-14 md:py-16">
        <h2 className="text-2xl font-extrabold text-brand-green md:text-3xl">{page.story_heading}</h2>
        <div className="mt-6">
          <Paragraphs text={page.story_body} />
        </div>
      </section>

      {/* What we do */}
      <section className="border-y border-brand-green/10 bg-white/60 py-14 dark:bg-[#161616]/60 md:py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-2xl font-extrabold text-brand-green md:text-3xl">{page.what_we_do_heading}</h2>
          {page.what_we_do_intro && <p className="mt-3 max-w-2xl text-muted">{page.what_we_do_intro}</p>}
          <ItemGrid items={page.what_we_do_items} />
        </div>
      </section>

      {/* Who we serve */}
      <section className="mx-auto max-w-5xl px-4 py-14 md:py-16">
        <h2 className="text-2xl font-extrabold text-brand-green md:text-3xl">{page.who_we_serve_heading}</h2>
        {page.who_we_serve_intro && <p className="mt-3 max-w-2xl text-muted">{page.who_we_serve_intro}</p>}
        <ItemGrid items={page.who_we_serve_items} />
      </section>

      {/* Team */}
      {team.length > 0 && (
        <section className="border-y border-brand-green/10 bg-[linear-gradient(180deg,rgba(44,122,75,0.04),rgba(255,255,255,0))] py-12 md:py-14">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-extrabold text-brand-green md:text-3xl">{page.team_heading}</h2>
            {page.team_intro && <p className="mt-2 max-w-2xl text-sm text-muted">{page.team_intro}</p>}
            <div className={`mt-6 grid items-start gap-4 ${team.length === 1 ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
              {team.map((m) => (
                <TeamMemberCard key={m.id} member={m} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* DSD Groups */}
      <section className="mx-auto max-w-5xl px-4 py-14 md:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold">DSD Groups</p>
        <h2 className="mt-2 text-2xl font-extrabold text-brand-green md:text-3xl">{page.dsd_heading}</h2>
        {page.dsd_intro && <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[#444] dark:text-[#ccc]">{page.dsd_intro}</p>}
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {page.dsd_vision && (
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-brand-green">Vision</h3>
              <p className="mt-2 text-[15px] leading-relaxed">{page.dsd_vision}</p>
            </div>
          )}
          {page.dsd_mission && (
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-brand-green">Mission</h3>
              <p className="mt-2 text-[15px] leading-relaxed">{page.dsd_mission}</p>
            </div>
          )}
        </div>
        {Array.isArray(page.dsd_values) && page.dsd_values.length > 0 && (
          <div className="mt-10">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-brand-green">Core values</h3>
            <ItemGrid items={page.dsd_values} />
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="border-t border-brand-green/15 bg-[#111] py-14 text-white md:py-16">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <h2 className="text-2xl font-extrabold text-brand-gold md:text-3xl">{page.cta_heading}</h2>
          {page.cta_body && <p className="mx-auto mt-3 max-w-xl text-sm text-white/70">{page.cta_body}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <CtaLink to={page.cta_primary_link} primary>{page.cta_primary_label}</CtaLink>
            {page.cta_secondary_label && page.cta_secondary_link && (
              <Link
                to={page.cta_secondary_link}
                className="inline-flex rounded-xl border border-white/25 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10"
              >
                {page.cta_secondary_label}
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
