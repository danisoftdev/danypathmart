export const DELIVERY_ORDER_STEPS = [
  { key: 'placed', label: 'Order placed', desc: 'We received your order — complete payment to continue' },
  { key: 'payment_confirmed', label: 'Payment received', desc: 'Your payment cleared' },
  { key: 'pending', label: 'Awaiting preparation', desc: 'Paid — you can cancel until we start processing' },
  { key: 'processing', label: 'Preparing order', desc: 'Picking and packing at our warehouse' },
  { key: 'shipped', label: 'Shipped', desc: 'On the way across Ghana' },
  { key: 'out_for_delivery', label: 'Out for delivery', desc: 'With our local courier in your area' },
  { key: 'delivered', label: 'Delivered', desc: 'Handed to you or your pickup contact' },
];

export const PICKUP_ORDER_STEPS = [
  { key: 'placed', label: 'Order placed', desc: 'We received your order — complete payment to continue' },
  { key: 'payment_confirmed', label: 'Payment received', desc: 'Your payment cleared' },
  { key: 'pending', label: 'Awaiting preparation', desc: 'Paid — we will prepare your order for the station' },
  { key: 'processing', label: 'Preparing order', desc: 'Picking and packing at our hub' },
  { key: 'received_at_hub', label: 'At DPM hub', desc: 'Received at our central hub' },
  { key: 'sent_to_station', label: 'Sent to station', desc: 'On its way to your pickup point' },
  { key: 'ready_for_pickup', label: 'Ready for pickup', desc: 'Collect at your chosen station — bring order # or ID' },
  { key: 'collected', label: 'Collected', desc: 'You picked up your order' },
];

export const ADMIN_ORDER_STATUSES = [
  'placed',
  'payment_confirmed',
  'pending',
  'processing',
  'received_at_hub',
  'shipped',
  'out_for_delivery',
  'delivered',
  'sent_to_station',
  'ready_for_pickup',
  'collected',
  'cancelled',
];

const STATUS_LABELS = {
  placed: 'Order placed',
  payment_confirmed: 'Payment confirmed',
  pending: 'Awaiting preparation',
  processing: 'Processing',
  received_at_hub: 'At hub',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  sent_to_station: 'Sent to station',
  ready_for_pickup: 'Ready for pickup',
  collected: 'Collected',
  cancelled: 'Cancelled',
};

export function orderStatusLabel(status) {
  return STATUS_LABELS[status] || (status || '').replace(/_/g, ' ');
}

export function timelineStepsForOrder(order) {
  return order?.is_pickup || order?.pickup_station ? PICKUP_ORDER_STEPS : DELIVERY_ORDER_STEPS;
}

export const STATION_TYPES = [
  { value: 'owned', label: 'DPM owned' },
  { value: 'partner', label: 'Partner' },
  { value: 'club', label: 'Club / school' },
  { value: 'church', label: 'Church' },
];

export function stationTypeLabel(type) {
  return STATION_TYPES.find((t) => t.value === type)?.label || type;
}

export function formatStationAddress(station) {
  if (!station) return '';
  const parts = [station.street_address, station.landmark, station.city, station.region].filter(Boolean);
  return parts.join(', ');
}
