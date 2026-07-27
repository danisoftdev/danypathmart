import { useEffect, useRef } from 'react';
import { looksLikeHtml, normalizePolicyBody, plainTextToHtml } from '../../lib/policyHtml';

function ToolbarButton({ label, title, onMouseDown, active }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={onMouseDown}
      className={`rounded px-2 py-1 text-xs font-bold transition ${
        active
          ? 'bg-brand-green text-white'
          : 'bg-black/5 text-[#111] hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Lightweight rich-text editor for legal policies.
 * Font is always Times New Roman; formatting is bold / italic / underline / lists / headings.
 */
export default function PolicyRichTextEditor({ value, onChange, disabled }) {
  const ref = useRef(null);
  const lastEmitted = useRef('');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = looksLikeHtml(value) ? value || '<p><br></p>' : plainTextToHtml(value);
    if (next === lastEmitted.current) return;
    if (el.innerHTML !== next) {
      el.innerHTML = next || '<p><br></p>';
    }
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = normalizePolicyBody(el.innerHTML);
    lastEmitted.current = html;
    onChange?.(html);
  };

  const run = (command, arg = null) => (e) => {
    e.preventDefault();
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  return (
    <div className={`overflow-hidden rounded-xl border border-black/15 dark:border-white/15 ${disabled ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap gap-1 border-b border-black/10 bg-black/[0.03] p-2 dark:border-white/10 dark:bg-white/[0.04]">
        <ToolbarButton label="B" title="Bold" onMouseDown={run('bold')} />
        <ToolbarButton label={<em>I</em>} title="Italic" onMouseDown={run('italic')} />
        <ToolbarButton label={<span className="underline">U</span>} title="Underline" onMouseDown={run('underline')} />
        <span className="mx-1 self-center text-muted">|</span>
        <ToolbarButton label="H2" title="Heading" onMouseDown={run('formatBlock', 'h2')} />
        <ToolbarButton label="¶" title="Paragraph" onMouseDown={run('formatBlock', 'p')} />
        <span className="mx-1 self-center text-muted">|</span>
        <ToolbarButton label="1." title="Numbered list" onMouseDown={run('insertOrderedList')} />
        <ToolbarButton label="•" title="Bullet list" onMouseDown={run('insertUnorderedList')} />
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        className="policy-rich-editor min-h-[220px] max-h-[420px] overflow-y-auto bg-white px-4 py-3 text-[15px] leading-relaxed text-[#111] outline-none dark:bg-[#1a1a1a] dark:text-white"
      />
      <p className="border-t border-black/10 px-3 py-1.5 text-[11px] text-muted dark:border-white/10">
        Times New Roman only — use the toolbar for bold, italic, underline, headings, and lists.
      </p>
    </div>
  );
}
