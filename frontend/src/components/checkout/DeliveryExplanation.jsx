export default function DeliveryExplanation({ explanation, className = '' }) {
  if (!explanation?.line) return null;

  return (
    <p className={`text-xs text-muted ${className}`}>
      <span className="font-semibold text-brand-green">Delivery calc:</span> {explanation.line}
      {explanation.intl_weight_note ? (
        <span className="block mt-0.5 text-subtle">{explanation.intl_weight_note}</span>
      ) : null}
    </p>
  );
}
