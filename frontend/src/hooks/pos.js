import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function usePosSaleReceipt() {
  return useMutation({
    mutationFn: async (orderId) => (await api.get(`/pos/sales/${orderId}`)).data,
  });
}

export function usePosBootstrap(registerId, enabled = true) {
  return useQuery({
    queryKey: ['pos-bootstrap', registerId],
    queryFn: async () =>
      (await api.get('/pos/bootstrap', { params: registerId ? { register_id: registerId } : {} })).data,
    enabled,
    staleTime: 15_000,
  });
}

export function usePosProductSearch(q, enabled = true) {
  return useQuery({
    queryKey: ['pos-products', q],
    queryFn: async () => (await api.get('/pos/products/search', { params: { q: q || undefined } })).data,
    enabled,
    staleTime: 10_000,
  });
}

export function usePosBarcodeLookup() {
  return useMutation({
    mutationFn: async (code) => (await api.get('/pos/products/barcode', { params: { code } })).data,
  });
}

export function usePosQuote() {
  return useMutation({
    mutationFn: async (payload) => (await api.post('/pos/sales/quote', payload)).data,
  });
}

export function usePosCompleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/pos/sales', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-bootstrap'] });
      qc.invalidateQueries({ queryKey: ['pos-shift'] });
    },
  });
}

export function usePosPaystackInit() {
  return useMutation({
    mutationFn: async (payload) => (await api.post('/pos/sales/paystack-init', payload)).data,
  });
}

export function usePosPaystackVerify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/pos/sales/paystack-verify', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-bootstrap'] });
      qc.invalidateQueries({ queryKey: ['pos-shift'] });
    },
  });
}

export function usePosOpenShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/pos/shift/open', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-bootstrap'] }),
  });
}

export function usePosCloseShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/pos/shift/close', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-bootstrap'] });
      qc.invalidateQueries({ queryKey: ['pos-shifts-pending'] });
    },
  });
}

export function usePosShiftCurrent(registerId, enabled = true) {
  return useQuery({
    queryKey: ['pos-shift', registerId],
    queryFn: async () =>
      (await api.get('/pos/shift/current', { params: { register_id: registerId } })).data,
    enabled: enabled && registerId > 0,
    refetchInterval: 30_000,
  });
}

export function usePosShiftReport(shiftId, type, enabled = true) {
  return useQuery({
    queryKey: ['pos-shift-report', shiftId, type],
    queryFn: async () =>
      (await api.get('/pos/shift/report', { params: { shift_id: shiftId, type } })).data,
    enabled: enabled && shiftId > 0,
  });
}

export function usePosPendingShifts(enabled = true) {
  return useQuery({
    queryKey: ['pos-shifts-pending'],
    queryFn: async () => (await api.get('/pos/shifts/pending')).data,
    enabled,
  });
}

export function usePosApproveShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shiftId) => (await api.post(`/pos/shifts/${shiftId}/approve`, { shift_id: shiftId })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-shifts-pending'] }),
  });
}

export function usePosRejectShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shiftId, note }) =>
      (await api.post(`/pos/shifts/${shiftId}/reject`, { shift_id: shiftId, note })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-shifts-pending'] }),
  });
}

export function usePosVoidSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, reason, supervisor_pin }) =>
      (await api.post(`/pos/sales/${orderId}/void`, { reason, supervisor_pin })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-shift'] }),
  });
}

export function usePosAdminSettings() {
  return useQuery({
    queryKey: ['pos-admin-settings'],
    queryFn: async () => (await api.get('/admin/pos/settings')).data,
  });
}

export function usePosUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.put('/admin/pos/settings', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-admin-settings'] });
      qc.invalidateQueries({ queryKey: ['pos-bootstrap'] });
    },
  });
}

export function usePosLocations() {
  return useQuery({
    queryKey: ['pos-locations'],
    queryFn: async () => (await api.get('/admin/pos/locations')).data,
  });
}

export function usePosCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/pos/locations', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-locations'] }),
  });
}

export function usePosUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.put(`/admin/pos/locations/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-locations'] }),
  });
}

export function usePosRegisters(locationId) {
  return useQuery({
    queryKey: ['pos-registers', locationId],
    queryFn: async () =>
      (await api.get('/admin/pos/registers', {
        params: locationId ? { location_id: locationId } : {},
      })).data,
  });
}

export function usePosCreateRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/pos/registers', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-registers'] }),
  });
}

export function usePosUpdateRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.put(`/admin/pos/registers/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-registers'] }),
  });
}

export function usePosReportsSummary(from, to, enabled = true) {
  return useQuery({
    queryKey: ['pos-reports-summary', from, to],
    queryFn: async () =>
      (await api.get('/admin/pos/reports/summary', { params: { from, to } })).data,
    enabled,
  });
}
