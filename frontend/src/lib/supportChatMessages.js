/** Customer-facing bot/system lines — hide these from DPM and shop staff inboxes. */
export function isCustomerOnlySystemMessage(message) {
  const type = message?.sender_type;
  if (type !== 'system' && type !== 'bot') return false;
  const body = String(message?.body || '').toLowerCase();
  // Staff still see handoff notices (e.g. DPM joined).
  if (body.includes('joined the chat')) return false;
  return true;
}

export function staffVisibleMessages(messages = []) {
  return messages.filter((m) => !isCustomerOnlySystemMessage(m));
}
