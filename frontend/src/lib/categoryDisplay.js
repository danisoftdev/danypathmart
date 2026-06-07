/** Auto icon + tint for category cards (keyword match, then index fallback). */

const ICON_RULES = [
  { pattern: /uniform|shirt|cloth|apparel|wear/i, emoji: '👕', tint: 'bg-brand-green/10 text-brand-green' },
  { pattern: /badge|medal|award|pin|honou?r/i, emoji: '🏅', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { pattern: /book|manual|guide|literature|read/i, emoji: '📚', tint: 'bg-brand-green/10 text-brand-green' },
  { pattern: /scarf|accessory|accessories|sash|slide/i, emoji: '🧣', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { pattern: /sign|banner|flag|poster/i, emoji: '🪧', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { pattern: /insignia|emblem|club|pathfinder|adventurer|youth/i, emoji: '⭐', tint: 'bg-brand-green/10 text-brand-green' },
  { pattern: /bag|pack|backpack/i, emoji: '🎒', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { pattern: /hat|cap|beret/i, emoji: '🧢', tint: 'bg-brand-green/10 text-brand-green' },
  { pattern: /shoe|boot|footwear/i, emoji: '👟', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { pattern: /gift|souvenir/i, emoji: '🎁', tint: 'bg-brand-green/10 text-brand-green' },
  { pattern: /tool|equipment|gear/i, emoji: '🛠️', tint: 'bg-brand-gold/15 text-[#92400E]' },
];

const FALLBACK_ICONS = [
  { emoji: '👕', tint: 'bg-brand-green/10 text-brand-green' },
  { emoji: '🏅', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { emoji: '📚', tint: 'bg-brand-green/10 text-brand-green' },
  { emoji: '🧣', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { emoji: '⭐', tint: 'bg-brand-green/10 text-brand-green' },
  { emoji: '🎒', tint: 'bg-brand-gold/15 text-[#92400E]' },
  { emoji: '🧢', tint: 'bg-brand-green/10 text-brand-green' },
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
