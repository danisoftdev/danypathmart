import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

function CategoryBranch({ node, depth, onNavigate, expandedIds, toggleExpanded }) {
  const children = node.children || [];
  const hasKids = children.length > 0;
  const expanded = expandedIds.has(node.id);
  const pad = depth > 0 ? { paddingLeft: `${8 + depth * 10}px` } : undefined;

  return (
    <div className="px-1">
      <div className="flex items-stretch" style={pad}>
        <Link
          to={`/shop?category=${node.slug}`}
          role="menuitem"
          onClick={onNavigate}
          className={`min-w-0 flex-1 rounded-lg px-2.5 py-2 hover:bg-black/5 dark:hover:bg-white/10 ${
            depth === 0
              ? 'text-sm font-semibold text-[#111111] dark:text-white'
              : 'text-sm text-muted hover:text-brand-green'
          }`}
        >
          {node.name}
        </Link>
        {hasKids && (
          <button
            type="button"
            aria-label={`${expanded ? 'Hide' : 'Show'} ${node.name} subcategories`}
            aria-expanded={expanded}
            onClick={() => toggleExpanded(node.id)}
            className="shrink-0 rounded-lg px-2 text-xs text-muted hover:bg-black/5 hover:text-brand-green dark:hover:bg-white/10"
          >
            {expanded ? '▴' : '▾'}
          </button>
        )}
      </div>
      {hasKids && expanded && (
        <div className={depth === 0 ? 'mb-1 ml-2 border-l border-black/10 pl-1 dark:border-white/15' : ''}>
          {children.map((child) => (
            <CategoryBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              onNavigate={onNavigate}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Main-site Categories dropdown: parents with nested children.
 */
export default function CategoryNavDropdown({ categories = [] }) {
  const [open, setOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const rootRef = useRef(null);

  const parents = (categories || []).filter(
    (c) => c.parent_id == null || c.parent_id === 0 || c.parent_id === '0'
  );

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setExpandedIds(new Set());
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setExpandedIds(new Set());
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (parents.length === 0) return null;

  const close = () => {
    setOpen(false);
    setExpandedIds(new Set());
  };

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold text-[#111111] transition hover:bg-brand-green/10 hover:text-brand-green dark:text-white dark:hover:text-brand-green"
      >
        Categories
        <span className={`text-[10px] transition ${open ? 'rotate-180' : ''}`} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-h-[min(70vh,28rem)] w-[min(100vw-2rem,20rem)] overflow-y-auto rounded-xl border border-black/10 bg-white py-2 shadow-xl dark:border-white/15 dark:bg-[#1E1E1E]"
          role="menu"
        >
          <Link
            to="/shop"
            role="menuitem"
            onClick={close}
            className="block px-3 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/10"
          >
            All products
          </Link>
          <div className="my-1 border-t border-black/8 dark:border-white/10" />

          {parents.map((parent) => (
            <CategoryBranch
              key={parent.id}
              node={parent}
              depth={0}
              onNavigate={close}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
