/** Build wa.me deep link — opens WhatsApp app/browser, no login popup. */
export function whatsAppLink(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const text = encodeURIComponent(message || '');
  return `https://wa.me/${digits}${text ? `?text=${text}` : ''}`;
}

export function orderWhatsAppMessage(orderId) {
  const ref = `DPM-${String(orderId).padStart(6, '0')}`;
  return `Hi DanyPathMart, please send me WhatsApp updates for order ${ref}.`;
}
