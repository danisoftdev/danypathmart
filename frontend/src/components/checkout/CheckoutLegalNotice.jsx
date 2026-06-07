import { Fragment } from 'react';
import { Link } from 'react-router-dom';

function joinLinks(links) {
  if (links.length === 1) return links[0];
  return links.map((link, i) => {
    if (i === 0) return link;
    const sep = i === links.length - 1 ? ' and ' : ', ';
    return (
      <Fragment key={`sep-${link.path}`}>
        {sep}
        {link}
      </Fragment>
    );
  });
}

export default function CheckoutLegalNotice({ policies }) {
  const trustLinks = policies?.checkout_trust_links ?? [];

  const links =
    trustLinks.length > 0
      ? trustLinks.map((item) => (
          <Link key={item.path} to={item.path} className="font-bold text-brand-green hover:underline">
            {item.title}
          </Link>
        ))
      : policies?.return_policy
        ? [
            <Link
              key="returns"
              to={policies.return_policy_path || '/policies/returns'}
              className="font-bold text-brand-green hover:underline"
            >
              returns &amp; refunds policy
            </Link>,
          ]
        : [];

  if (links.length === 0) return null;

  return (
    <p className="text-center text-xs leading-relaxed text-muted">
      By continuing you agree to our {joinLinks(links)}.
    </p>
  );
}
