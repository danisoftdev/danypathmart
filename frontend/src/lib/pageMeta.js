/** Route-level document title / meta — uses admin company settings, not hardcoded copy. */

function clean(text) {
  return String(text || '').trim();
}

export function resolvePageMeta(pathname, company = {}) {
  const name = clean(company.company_name) || 'DanyPathMart';
  const defaultDescription = clean(company.site_seo_description);

  const authPaths = new Set([
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/2fa',
    '/auth/oauth/callback',
    '/admin/setup-2fa',
  ]);

  if (authPaths.has(pathname)) {
    return {
      title: pathname === '/register' ? `Create account | ${name}` : `Sign in | ${name}`,
      description: pathname === '/register'
        ? `Create your ${name} account to shop, track orders, and manage your profile.`
        : `Sign in to your ${name} account.`,
      robots: 'noindex, nofollow',
    };
  }

  const routes = {
    '/': { title: name, suffix: 'Home' },
    '/shop': { title: `Shop | ${name}`, suffix: 'Shop' },
    '/kits': { title: `Product kits | ${name}`, suffix: 'Kits' },
    '/group-order': { title: `Group order | ${name}`, suffix: 'Group order' },
    '/contact': { title: `Contact | ${name}`, suffix: 'Contact' },
    '/about': { title: `About | ${name}`, suffix: 'About' },
    '/stores': { title: `Marketplace shops | ${name}`, suffix: 'Shops' },
    '/cart': { title: `Cart | ${name}`, suffix: 'Cart', robots: 'noindex' },
    '/checkout': { title: `Checkout | ${name}`, suffix: 'Checkout', robots: 'noindex' },
    '/careers': { title: `Careers | ${name}`, suffix: 'Careers' },
    '/careers/drivers': { title: `Delivery drivers | ${name}`, suffix: 'Drivers' },
    '/become-a-promoter': { title: `Become a promoter | ${name}`, suffix: 'Promoter' },
    '/sell': { title: `Sell on ${name}`, suffix: 'Sell' },
    '/returns': { title: `Returns | ${name}`, suffix: 'Returns' },
  };

  const match = routes[pathname];
  if (match) {
    return {
      title: match.title,
      description: defaultDescription || `${match.suffix} — ${name}.`,
      robots: match.robots,
    };
  }

  if (pathname.startsWith('/product/')) {
    return {
      title: `Product | ${name}`,
      description: defaultDescription || `View product details at ${name}.`,
    };
  }

  if (pathname.startsWith('/policies/')) {
    return {
      title: `Policy | ${name}`,
      description: defaultDescription || `Read ${name} policies and terms.`,
    };
  }

  if (pathname.startsWith('/stores/')) {
    return {
      title: `Shop | ${name}`,
      description: defaultDescription || `Shop from a seller on ${name}.`,
    };
  }

  return {
    title: name,
    description: defaultDescription || undefined,
  };
}
