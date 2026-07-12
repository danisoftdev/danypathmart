/** Auto icon + tint for category cards (keyword match, then index fallback). */

const ICON_RULES = [
  { pattern: /grocery|food|rice|oil|produce|fresh|supermarket/i, emoji: '🛒', tint: 'bg-brand-green/10 text-brand-green' },
  { pattern: /drink|beverage|water|juice|soda/i, emoji: '🥤', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { pattern: /snack|biscuit|candy|sweet/i, emoji: '🍪', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { pattern: /household|clean|soap|detergent/i, emoji: '🧹', tint: 'bg-brand-green/10 text-brand-green' },
  { pattern: /shirt|cloth|apparel|wear|fashion/i, emoji: '👕', tint: 'bg-brand-green/10 text-brand-green' },
  { pattern: /book|manual|guide|literature|read/i, emoji: '📚', tint: 'bg-brand-green/10 text-brand-green' },
  { pattern: /electronic|phone|gadget|tech/i, emoji: '📱', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { pattern: /bag|pack|backpack/i, emoji: '🎒', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { pattern: /shoe|boot|footwear/i, emoji: '👟', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { pattern: /gift|souvenir/i, emoji: '🎁', tint: 'bg-brand-green/10 text-brand-green' },
  { pattern: /tool|equipment|gear|hardware/i, emoji: '🛠️', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { pattern: /market|shop|seller|store/i, emoji: '🏪', tint: 'bg-brand-green/10 text-brand-green' },
];

const FALLBACK_ICONS = [
  { emoji: '🛒', tint: 'bg-brand-green/10 text-brand-green' },
  { emoji: '🥤', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { emoji: '📚', tint: 'bg-brand-green/10 text-brand-green' },
  { emoji: '🏪', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { emoji: '🍪', tint: 'bg-brand-green/10 text-brand-green' },
  { emoji: '🎒', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { emoji: '🧹', tint: 'bg-brand-green/10 text-brand-green' },
  { emoji: '🎁', tint: 'bg-brand-gold/15 text-[#92400E]' },
];

export function getCategoryDisplay(category, index = 0) {
  const haystack = `${category?.slug || ''} ${category?.name || ''}`.toLowerCase();

  for (const rule of ICON_RULES) {
    if (rule.pattern.test(haystack)) {
      return { emoji: rule.emoji, tint: rule.tint };
    }
  }

  return FALLBACK_ICONS[index % FALLBACK_ICONS.length];
}
