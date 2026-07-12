import { Link } from 'react-router-dom';
import { usePlatformFeatures } from '../../hooks/checkout';
import { usePublicLegalPolicies } from '../../hooks/storefront';
import { useCompanyStore } from '../../store/companyStore';
import SiteLogo from '../brand/SiteLogo';
import CopyableText from '../ui/CopyableText';
import {
  WhatsAppIcon,
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
} from '../icons';

function ExternalLink({ href, children, className, ...props }) {
  if (!href || !/^https?:\/\//i.test(href)) {
    return <span className={className}>{children}</span>;
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...props}>
      {children}
    </a>
  );
}

function normalizeWhatsAppGroupUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, '')}`;
}

export default function Footer() {
  const company = useCompanyStore((s) => s.company);
  const { marketplaceEnabled, shopApplicationsOpen } = usePlatformFeatures();
  const { data: footerPolicies = [] } = usePublicLegalPolicies();

  return (
    <footer className="mt-8 border-t-4 border-brand-green bg-[#111111] pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-white md:mt-16 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-2 lg:grid-cols-5">
        <div>
          <SiteLogo size="h-14 w-14" />
          <p className="mt-3 text-sm text-white/60">
            Supermarket essentials and marketplace shops — delivered across Ghana.
          </p>
        </div>

        <div className="text-sm">
          <h3 className="mb-3 font-semibold text-brand-gold">Contact</h3>
          <ul className="space-y-1 text-white/80">
            {company.phone && <li>{company.phone}</li>}
            {company.email && (
              <li>
                <CopyableText value={company.email} className="hover:text-white" title="Copy email address" />
              </li>
            )}
            {company.address && <li>{company.address}</li>}
            {company.business_hours && <li className="text-white/60">{company.business_hours}</li>}
          </ul>
          <Link to="/contact" className="mt-3 inline-block text-sm font-bold text-brand-gold hover:underline">
            Send us a message →
          </Link>
        </div>

        <div className="text-sm">
          <h3 className="mb-3 font-semibold text-brand-gold">Work with us</h3>
          <ul className="space-y-2">
            <li>
              <Link to="/careers" className="font-bold text-brand-gold hover:underline">
                Careers
              </Link>
              <p className="text-xs text-white/50">Warehouse &amp; station roles</p>
            </li>
            <li>
              <Link to="/careers/drivers" className="font-bold text-brand-gold hover:underline">
                Delivery driver sign-up
              </Link>
              <p className="text-xs text-white/50">Hub to pickup station runs</p>
            </li>
            {marketplaceEnabled && (
              <li>
                <Link to="/stores" className="font-bold text-brand-gold hover:underline">
                  Browse shops
                </Link>
                <p className="text-xs text-white/50">Find sellers on our marketplace</p>
              </li>
            )}
            {marketplaceEnabled && shopApplicationsOpen && (
              <li>
                <Link to="/sell" className="font-bold text-brand-gold hover:underline">
                  Sell on DanyPathMart
                </Link>
                <p className="text-xs text-white/50">Open your shop on our marketplace</p>
              </li>
            )}
          </ul>
        </div>

        <div className="text-sm">
          <h3 className="mb-3 font-semibold text-brand-gold">Policies</h3>
          <ul className="space-y-2 text-white/80">
            {footerPolicies.length > 0 ? (
              footerPolicies.map((p) => (
                <li key={p.slug}>
                  <Link to={`/policies/${p.slug}`} className="font-bold hover:text-brand-gold hover:underline">
                    {p.title}
                  </Link>
                </li>
              ))
            ) : (
              <li>
                <Link to="/policies/returns" className="font-bold hover:text-brand-gold hover:underline">
                  Returns &amp; refunds
                </Link>
              </li>
            )}
            <li>
              <Link to="/shop" className="hover:text-white hover:underline">
                Shop all products
              </Link>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <h3 className="mb-3 font-semibold text-brand-gold">Connect</h3>
          <div className="flex items-center gap-3">
            {company.facebook && (
              <ExternalLink href={company.facebook} aria-label="Facebook" className="text-white/80 hover:text-white">
                <FacebookIcon />
              </ExternalLink>
            )}
            {company.instagram && (
              <ExternalLink href={company.instagram} aria-label="Instagram" className="text-white/80 hover:text-white">
                <InstagramIcon />
              </ExternalLink>
            )}
            {company.twitter && (
              <ExternalLink href={company.twitter} aria-label="Twitter" className="text-white/80 hover:text-white">
                <TwitterIcon />
              </ExternalLink>
            )}
          </div>
          {company.whatsapp_group && (
            <>
              <ExternalLink
                href={normalizeWhatsAppGroupUrl(company.whatsapp_group)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-emerald px-3 py-2 font-semibold text-white hover:bg-opacity-90 hover:no-underline"
              >
                <WhatsAppIcon /> Join our WhatsApp
              </ExternalLink>
              <p className="mt-1 text-xs text-white/50">Opens WhatsApp to join our community group</p>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-4 text-center text-xs text-white/50">
        &copy; {new Date().getFullYear()} DanyPathMart &middot; Developed by{' '}
        <ExternalLink
          href="https://danysoftdev.com"
          className="font-semibold text-brand-gold hover:underline"
        >
          danysoftdev.com
        </ExternalLink>
      </div>
    </footer>
  );
}
