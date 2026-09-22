export default function ProductOrderQuestionsForm({ questions = [], value = {}, onChange, error = '' }) {
  if (!questions.length) return null;

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-black/8 bg-[#FFF9F3] p-4 dark:border-white/10 dark:bg-black/20">
      <p className="text-sm font-bold text-[#111111] dark:text-white">Before you add this item</p>
      {questions.map((q) => (
        <fieldset key={q.id}>
          <legend className="mb-2 text-sm font-semibold text-[#111111] dark:text-white">
            {q.question}
            {q.required && <span className="text-brand-red"> *</span>}
          </legend>
          <div className="space-y-2">
            {q.options.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/8 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#1E1E1E]"
              >
                <input
                  type="radio"
                  name={`product-q-${q.id}`}
                  value={opt}
                  checked={value[q.id] === opt}
                  onChange={() => onChange({ ...value, [q.id]: opt })}
                  className="h-4 w-4 accent-brand-green"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {error && <p className="text-xs font-semibold text-brand-red">{error}</p>}
    </div>
  );
}

export function validateOrderQuestionAnswers(questions, answers) {
  for (const q of questions) {
    if (!q.required) continue;
    const picked = String(answers[q.id] || '').trim();
    if (!picked) {
      return `Please answer: ${q.question}`;
    }
    if (!q.options.includes(picked)) {
      return `Please choose a valid option for: ${q.question}`;
    }
  }
  return '';
}

export function formatOrderQuestionAnswers(questions, answers) {
  const parts = [];
  for (const q of questions) {
    const picked = String(answers[q.id] || '').trim();
    if (picked) parts.push(`${q.question}: ${picked}`);
  }
  return parts.join('; ');
}
