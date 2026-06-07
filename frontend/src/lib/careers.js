export const JOB_TYPES = [
  { value: 'driver', label: 'Delivery driver' },
  { value: 'warehouse', label: 'Warehouse assistant' },
  { value: 'station_coordinator', label: 'Pickup station coordinator' },
];

export const FIELD_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'textarea', label: 'Long text / cover letter' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown choice' },
  { value: 'file', label: 'File upload (CV, etc.)' },
  { value: 'url', label: 'Website / link' },
  { value: 'date', label: 'Date' },
];

export const DRIVER_ROLE_NOTE =
  'Hub ↔ pickup station runs only. No home delivery and no cash handling.';

export function jobTypeLabel(type) {
  return JOB_TYPES.find((t) => t.value === type)?.label || type;
}

export function fieldTypeLabel(type) {
  return FIELD_TYPES.find((t) => t.value === type)?.label || type;
}

export const DEFAULT_JOB_FIELDS = [
  {
    field_key: 'full_name',
    label: 'Full name',
    field_type: 'text',
    is_required: true,
    sort_order: 1,
    placeholder: 'Your full name',
    help_text: '',
    options: [],
    max_file_mb: 5,
    accepted_extensions: 'pdf,doc,docx',
  },
  {
    field_key: 'email',
    label: 'Email address',
    field_type: 'email',
    is_required: true,
    sort_order: 2,
    placeholder: 'you@example.com',
    help_text: '',
    options: [],
    max_file_mb: 5,
    accepted_extensions: 'pdf,doc,docx',
  },
  {
    field_key: 'phone',
    label: 'Phone number',
    field_type: 'phone',
    is_required: true,
    sort_order: 3,
    placeholder: '+233 …',
    help_text: '',
    options: [],
    max_file_mb: 5,
    accepted_extensions: 'pdf,doc,docx',
  },
  {
    field_key: 'city',
    label: 'City / area',
    field_type: 'text',
    is_required: false,
    sort_order: 4,
    placeholder: 'e.g. Accra',
    help_text: '',
    options: [],
    max_file_mb: 5,
    accepted_extensions: 'pdf,doc,docx',
  },
  {
    field_key: 'cv',
    label: 'CV / Résumé',
    field_type: 'file',
    is_required: false,
    sort_order: 5,
    placeholder: '',
    help_text: 'PDF or Word document.',
    options: [],
    max_file_mb: 5,
    accepted_extensions: 'pdf,doc,docx',
  },
  {
    field_key: 'cover_letter',
    label: 'Cover letter / message',
    field_type: 'textarea',
    is_required: false,
    sort_order: 6,
    placeholder: 'Tell us about your experience and availability…',
    help_text: '',
    options: [],
    max_file_mb: 5,
    accepted_extensions: 'pdf,doc,docx',
  },
];

export function cloneDefaultFields() {
  return DEFAULT_JOB_FIELDS.map((f) => ({ ...f, options: [...(f.options || [])] }));
}

export function newCustomField(sortOrder = 99) {
  return {
    field_key: '',
    label: '',
    field_type: 'text',
    is_required: false,
    sort_order: sortOrder,
    placeholder: '',
    help_text: '',
    options: [],
    max_file_mb: 5,
    accepted_extensions: 'pdf,doc,docx',
  };
}

export const DRIVER_JOB_TEMPLATE = `We are looking for reliable drivers to move orders from our central hub to pickup stations across the city.

What you will do:
• Collect sealed parcels at the DanyPathMart hub
• Drive to assigned pickup stations on scheduled runs
• Hand off to station staff — no customer home delivery
• No cash collection or payment handling

Requirements:
• Valid driver's licence and clean record
• Smartphone for run updates (Phase M7)
• Punctual and professional`;

export const WAREHOUSE_JOB_TEMPLATE = `Support inbound sorting, picking, and outbound prep at our central hub.

What you will do:
• Receive seller and international shipments
• Label and stage orders for hub-to-station runs
• Keep the warehouse organised and accurate`;

export const STATION_JOB_TEMPLATE = `Coordinate customer collections and repack orders into DanyPathMart packaging at a pickup station.

What you will do:
• Receive inbound totes from hub drivers
• Repack into DPM bags/boxes with station labels
• Release orders to customers when they collect`;

/** Build public URL for uploaded career files. */
export function careerFileUrl(filePath) {
  if (!filePath) return '';
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  return `${base}${filePath.startsWith('/') ? filePath : `/${filePath}`}`;
}
