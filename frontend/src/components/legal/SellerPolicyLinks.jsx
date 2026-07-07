import { Link } from 'react-router-dom';

/** Inline links to seller / shop legal documents. */
export function SellerPolicyLinks({ className = '' }) {
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`}>
      Read the{' '}
      <Link to="/policies/seller-handbook" className="font-bold text-brand-green hover:underline">
        Seller handbook
      </Link>
      ,{' '}
      <Link to="/policies/shop-seller-policy" className="font-bold text-brand-green hover:underline">
        Shop seller policy
      </Link>
      , and{' '}
      <Link to="/policies/payments" className="font-bold text-brand-green hover:underline">
        Payment policy
      </Link>
      .
    </p>
  );
}

/** Storefront checkout legal notice (shop-collected payments). */
export function StorefrontLegalNotice({ className = '' }) {
  return (
    <p className={`text-center text-xs leading-relaxed text-muted ${className}`}>
      You pay the shop directly. By placing this order you agree to our{' '}
      <Link to="/policies/payments" className="font-bold text-brand-green hover:underline">
        Payment policy
      </Link>
      ,{' '}
      <Link to="/policies/shop-seller-policy" className="font-bold text-brand-green hover:underline">
        Shop seller policy
      </Link>
      , and{' '}
      <Link to="/policies/complaints-disputes" className="font-bold text-brand-green hover:underline">
        Complaints & disputes
      </Link>
      .
    </p>
  );
}

/** Shop apply acceptance checkbox label. */
export function ShopApplyPolicyConsent({ checked, onChange, disabled }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-black/8 p-4 text-sm dark:border-white/10">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        required
      />
      <span>
        I agree to the{' '}
        <Link to="/policies/shop-seller-policy" className="font-bold text-brand-green hover:underline" target="_blank" rel="noreferrer">
          Shop seller policy
        </Link>
        ,{' '}
        <Link to="/policies/seller-handbook" className="font-bold text-brand-green hover:underline" target="_blank" rel="noreferrer">
          Seller handbook
        </Link>
        ,{' '}
        <Link to="/policies/payments" className="font-bold text-brand-green hover:underline" target="_blank" rel="noreferrer">
          Payment policy
        </Link>
        , and{' '}
        <Link to="/policies/terms" className="font-bold text-brand-green hover:underline" target="_blank" rel="noreferrer">
          Terms of service
        </Link>
        .
      </span>
    </label>
  );
}
