import { create } from 'zustand';
import api from '../lib/api';

const FALLBACK = {
  company_name: 'DanyPathMart',
  email: 'support@danypathmart.store',
  phone: '+233 00 000 0000',
  whatsapp_group: '',
  whatsapp_support: '',
  facebook: '',
  instagram: '',
  twitter: '',
  address: 'Accra, Ghana',
  business_hours: 'Mon-Fri 8am-6pm',
};

export const useCompanyStore = create((set) => ({
  company: FALLBACK,
  loaded: false,

  async load() {
    try {
      const { data } = await api.get('/public/company-info');
      const company = data.company || data;
      const analytics = data.analytics ?? { enabled: false, measurement_id: null };
      set({ company: { ...FALLBACK, ...company, analytics }, loaded: true });
    } catch {
      // The public company-info endpoint is delivered on Day 4; use defaults until then.
      set({ company: FALLBACK, loaded: true });
    }
  },
}));
