import { useState } from 'react';

/** Shows text and copies to clipboard on click — avoids mailto/tel app popups. */
export default function CopyableText({ value, children, className = '', title = 'Click to copy' }) {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      title={title}
      className={`cursor-pointer text-left hover:underline ${className}`}
    >
      {children ?? value}
      {copied && <span className="ml-1 text-xs font-semibold text-brand-green">Copied!</span>}
    </button>
  );
}
