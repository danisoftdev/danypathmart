import { useCompanyStore } from '../../store/companyStore';

export default function WhatsAppOptIn({ checked, onChange, orderId }) {
  const company = useCompanyStore((s) => s.company);
  const support = company?.whatsapp_support;

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/8 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-brand-green"
      />
      <span className="text-sm">
        <span className="font-bold">WhatsApp me order updates</span>
        <span className="mt-1 block text-xs text-muted">
          After placing your order, open WhatsApp with a pre-filled message
          {orderId ? ` for order #${orderId}` : ''}. No extra login — uses your phone app.
          {!support && ' (Support number will appear once configured in store settings.)'}
        </span>
      </span>
    </label>
  );
}
