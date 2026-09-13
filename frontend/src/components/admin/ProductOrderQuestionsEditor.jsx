function newQuestionId() {
  return `q${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

function emptyQuestion() {
  return { id: newQuestionId(), question: '', required: true, options: [''] };
}

export default function ProductOrderQuestionsEditor({ value = [], onChange, disabled = false }) {
  const questions = Array.isArray(value) ? value : [];

  const update = (next) => onChange(next);

  const setQuestion = (index, patch) => {
    update(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const setOption = (qIndex, optIndex, text) => {
    const q = questions[qIndex];
    const options = [...(q.options || [])];
    options[optIndex] = text;
    setQuestion(qIndex, { options });
  };

  const addOption = (qIndex) => {
    const q = questions[qIndex];
    setQuestion(qIndex, { options: [...(q.options || []), ''] });
  };

  const removeOption = (qIndex, optIndex) => {
    const q = questions[qIndex];
    const options = (q.options || []).filter((_, i) => i !== optIndex);
    setQuestion(qIndex, { options: options.length ? options : [''] });
  };

  const removeQuestion = (index) => {
    update(questions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Order questions (MCQ)</p>
          <p className="text-xs text-muted">Shoppers pick an answer before adding to cart — e.g. size, colour, flavour.</p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => update([...questions, emptyQuestion()])}
            className="shrink-0 rounded-lg border border-brand-green/40 px-3 py-1.5 text-xs font-bold text-brand-green hover:bg-brand-green/10"
          >
            + Add question
          </button>
        )}
      </div>

      {questions.length === 0 && (
        <p className="text-xs text-muted">No questions yet. Click &quot;Add question&quot; if buyers must choose options.</p>
      )}

      {questions.map((q, qIndex) => (
        <div key={q.id || qIndex} className="rounded-lg border border-black/8 bg-white p-3 dark:border-white/10 dark:bg-[#1E1E1E]">
          <div className="flex items-start justify-between gap-2">
            <label className="block flex-1 text-xs font-bold uppercase text-muted">
              Question
              <input
                className="input-field mt-1 w-full text-sm normal-case"
                value={q.question || ''}
                onChange={(e) => setQuestion(qIndex, { question: e.target.value })}
                placeholder="e.g. What size do you need?"
                disabled={disabled}
              />
            </label>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeQuestion(qIndex)}
                className="mt-5 text-xs font-bold text-brand-red hover:underline"
              >
                Remove
              </button>
            )}
          </div>

          <label className="mt-2 flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={!!q.required}
              onChange={(e) => setQuestion(qIndex, { required: e.target.checked })}
              disabled={disabled}
              className="h-4 w-4 accent-brand-green"
            />
            Required before add to cart
          </label>

          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-muted">Answer choices</p>
          <div className="mt-1 space-y-2">
            {(q.options || ['']).map((opt, optIndex) => (
              <div key={optIndex} className="flex gap-2">
                <input
                  className="input-field flex-1 text-sm"
                  value={opt}
                  onChange={(e) => setOption(qIndex, optIndex, e.target.value)}
                  placeholder={`Option ${optIndex + 1}`}
                  disabled={disabled}
                />
                {!disabled && (q.options || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOption(qIndex, optIndex)}
                    className="rounded-lg px-2 text-xs font-bold text-muted hover:text-brand-red"
                    aria-label="Remove option"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => addOption(qIndex)}
              className="mt-2 text-xs font-bold text-brand-green hover:underline"
            >
              + Add option
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function normalizeOrderQuestions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q, index) => {
      const question = String(q?.question || '').trim();
      const options = (Array.isArray(q?.options) ? q.options : [])
        .map((o) => String(o || '').trim())
        .filter(Boolean);
      if (!question || options.length === 0) return null;
      return {
        id: String(q?.id || `q${index + 1}`),
        question,
        required: q?.required !== false,
        options,
      };
    })
    .filter(Boolean);
}
