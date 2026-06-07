import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useCompanyStore } from '../store/companyStore';

export function useApplyPilotPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post('/admin/company-settings/pilot-preset')).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-company-settings'] });
      qc.invalidateQueries({ queryKey: ['admin-launch-readiness'] });
      qc.invalidateQueries({ queryKey: ['checkout-policies'] });
      useCompanyStore.getState().load();
    },
  });
}

export function useEnableModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (moduleId) =>
      (await api.post('/admin/company-settings/enable-module', { module_id: moduleId })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-company-settings'] });
      qc.invalidateQueries({ queryKey: ['admin-launch-readiness'] });
      qc.invalidateQueries({ queryKey: ['checkout-policies'] });
      useCompanyStore.getState().load();
    },
  });
}
