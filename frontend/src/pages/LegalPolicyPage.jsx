import { Link, useParams } from 'react-router-dom';
import { usePublicLegalPolicy } from '../hooks/storefront';
import { useCompanyStore } from '../store/companyStore';
import { looksLikeHtml, plainTextToHtml, sanitizePolicyHtml } from '../lib/policyHtml';

function PolicyBody({ text }) {
  if (!text?.trim()) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-brand-green/40 bg-brand-green/5 p-6 text-sm">
        <p className="font-semibold text-brand-green">Policy being updated</p>
        <p className="mt-2 text-muted">Contact us if you have questions before completing your order.</p>
        <Link to="/contact" className="mt-4 inline-block font-bold text-brand-green hover:underline">
          Contact support →
        </Link>
      </div>
    );
  }

  const html = sanitizePolicyHtml(looksLikeHtml(text) ? text : plainTextToHtml(text));

  return (
    <div
      className="prose-policy mt-8 rounded-2xl border border-black/8 bg-white p-6 text-[15px] leading-relaxed text-[#333] dark:border-white/10 dark:bg-[#1E1E1E] dark:text-[#ddd]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function LegalPolicyPage() {
  const { slug } = useParams();
  const company = useCompanyStore((s) => s.company);
  const { data: policy, isLoading, isError } = usePublicLegalPolicy(slug);

  const legacyReturns = slug === 'returns' ? company?.return_policy?.trim() : '';
  const title = policy?.title || (slug === 'returns' ? 'Returns & refunds' : slug?.replace(/-/g, ' ') || 'Policy');
  const body = policy?.body || legacyReturns || '';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <nav className="mb-6 text-sm text-muted">
        <Link to="/" className="font-semibold text-brand-green hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span>{title}</span>
      </nav>

      <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        Policy for orders placed on {company?.company_name || 'DanyPathMart'}.
      </p>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted">Loading…</p>
      ) : isError && !legacyReturns ? (
        <div className="mt-8 rounded-2xl border border-dashed border-brand-red/30 p-6 text-sm">
          <p className="font-semibold text-brand-red">Policy not found</p>
          <Link to="/contact" className="mt-4 inline-block font-bold text-brand-green hover:underline">
            Contact support →
          </Link>
        </div>
      ) : (
        <PolicyBody text={body} />
      )}

      <p className="mt-8 text-xs text-muted">
        Questions?{' '}
        <Link to="/contact" className="font-bold text-brand-green hover:underline">
          Message our team
        </Link>
        {company?.phone ? ` · ${company.phone}` : ''}
      </p>
    </div>
  );
}
