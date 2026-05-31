import { useCompanyStore } from '../../store/companyStore';
import {
  WhatsAppIcon,
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
} from '../icons';

export default function Footer() {
  const company = useCompanyStore((s) => s.company);

  return (
    <footer className="mt-16 border-t-4 border-brand-green bg-[#111111] text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-3">
        <div>
          <div className="text-lg font-extrabold">
            <span className="text-brand-green">DanyPathMart</span>
            <span className="text-brand-gold">.</span>
          </div>
          <p className="mt-2 text-sm text-white/60">
            SDA youth insignias, uniforms, badges, books &amp; materials across Ghana.
          </p>
        </div>

        <div className="text-sm">
          <h3 className="mb-3 font-semibold text-brand-gold">Contact</h3>
          <ul className="space-y-1 text-white/80">
            {company.phone && <li>{company.phone}</li>}
            {company.email && (
              <li>
                <a href={`mailto:${company.email}`} className="hover:text-white">
                  {company.email}
                </a>
              </li>
            )}
            {company.address && <li>{company.address}</li>}
            {company.business_hours && <li className="text-white/60">{company.business_hours}</li>}
          </ul>
        </div>

        <div className="text-sm">
          <h3 className="mb-3 font-semibold text-brand-gold">Connect</h3>
          <div className="flex items-center gap-3">
            {company.facebook && (
              <a href={company.facebook} aria-label="Facebook" className="text-white/80 hover:text-white">
                <FacebookIcon />
              </a>
            )}
            {company.instagram && (
              <a href={company.instagram} aria-label="Instagram" className="text-white/80 hover:text-white">
                <InstagramIcon />
              </a>
            )}
            {company.twitter && (
              <a href={company.twitter} aria-label="Twitter" className="text-white/80 hover:text-white">
                <TwitterIcon />
              </a>
            )}
          </div>
          {company.whatsapp_group && (
            <a
              href={company.whatsapp_group}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-emerald px-3 py-2 font-semibold text-white hover:bg-opacity-90"
            >
              <WhatsAppIcon /> Join our WhatsApp
            </a>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-4 text-center text-xs text-white/50">
        &copy; {new Date().getFullYear()} DanyPathMart &middot; Developed by{' '}
        <a
          href="https://danysoftdev.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-gold hover:underline"
        >
          danysoftdev.com
        </a>
      </div>
    </footer>
  );
}
