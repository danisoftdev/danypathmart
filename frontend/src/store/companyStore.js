import { create } from 'zustand';
import api from '../lib/api';

const FALLBACK = {
  company_name: 'DanyPathMart',
  email: '',
  phone: '',
  whatsapp_group: '',
  whatsapp_support: '',
  facebook: '',
  instagram: '',
  twitter: '',
  address: '',
  business_hours: '',
  site_tagline: '',
  site_seo_description: '',
};

export const useCompanyStore = create((set) => ({
  company: FALLBACK,
  loaded: false,

  async load() {
    try {
      const { data } = await api.get('/public/company-info');
      const company = data.company || data;
      const analytics = data.analytics ?? { enabled: false, measurement_id: null };
      set({
        company: {
          ...FALLBACK,
          ...Object.fromEntries(
            Object.entries(company).map(([key, value]) => [key, value ?? FALLBACK[key] ?? ''])
          ),
          analytics,
        },
        loaded: true,
      });
    } catch {
      set({ company: FALLBACK, loaded: true });
    }
  },
}));
