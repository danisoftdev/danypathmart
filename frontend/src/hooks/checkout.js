import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useByAirLabels } from '../lib/airLabels';

/** Server-authoritative shipping/total quote for the given cart lines. */
export function useShippingQuote(items, enabled = true, region = null, loyalty = null, pickupStationId = null, shopFulfillmentMode = null) {
  const orderType = loyalty?.order_type ?? null;
  const organizationName = loyalty?.organization_name ?? null;

  return useQuery({
    queryKey: ['shipping', items, region, orderType, organizationName, pickupStationId, shopFulfillmentMode],
    queryFn: async () =>
      (await api.post('/shipping/calculate', {
        items,
        ...(region ? { region } : {}),
        ...(pickupStationId ? { pickup_station_id: pickupStationId } : {}),
        ...(shopFulfillmentMode ? { shop_fulfillment_mode: shopFulfillmentMode } : {}),
        ...(orderType ? { order_type: orderType } : {}),
        ...(organizationName ? { organization_name: organizationName } : {}),
      })).data,
    enabled: enabled && Array.isArray(items) && items.length > 0,
    staleTime: 30_000,
  });
}

export function usePickupStations(region = null, city = null) {
  return useQuery({
    queryKey: ['pickup-stations', region, city],
    queryFn: async () =>
      (await api.get('/public/pickup-stations', {
        params: {
          ...(region ? { region } : {}),
          ...(city ? { city } : {}),
        },
      })).data,
    staleTime: 60_000,
  });
}

export function useAddresses(enabled = true) {
  return useQuery({
    queryKey: ['addresses'],
    queryFn: async () => (await api.get('/addresses')).data,
    enabled,
  });
}

export function useAddAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/addresses', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });
}

export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.put(`/addresses/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/addresses/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });
}

export function useSetDefaultAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.post(`/addresses/${id}/default`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: async ({
      items,
      address_id,
      pickup_station_id,
      notes,
      payment_method,
      order_type,
      organization_name,
      notify_whatsapp,
      customizations,
      referral_code,
    }) =>
      (await api.post('/orders', {
        items,
        address_id,
        pickup_station_id,
        notes,
        payment_method,
        order_type,
        organization_name,
        notify_whatsapp,
        customizations,
        referral_code,
      })).data,
  });
}

export function useOrder(orderId) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => (await api.get(`/orders/${orderId}`)).data,
    enabled: !!orderId,
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) =>
      (await api.post(`/orders/${id}/cancel`, { reason })).data,
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useInitPayment() {
  return useMutation({
    mutationFn: async (orderId) =>
      (await api.post('/payments/initialize', { order_id: orderId })).data,
  });
}

export function usePayWithWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const orderId = payload.order_id ?? payload.orderId;
      return (await api.post('/payments/wallet', {
        order_id: orderId,
        amount: payload.amount,
      })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallet'] }),
  });
}

export function useSubmitBankTransfer() {
  return useMutation({
    mutationFn: async (payload) => {
      const orderId = payload.order_id ?? payload.orderId;
      return (await api.post('/payments/bank-transfer', {
        order_id: orderId,
        reference: payload.reference,
      })).data;
    },
  });
}

/** Development-only: simulate a successful Paystack charge. */
export function useDevConfirm() {
  return useMutation({
    mutationFn: async (orderId) =>
      (await api.post('/payments/dev-confirm', { order_id: orderId })).data,
  });
}

export function useCheckoutPolicies() {
  return useQuery({
    queryKey: ['checkout-policies'],
    queryFn: async () => (await api.get('/public/checkout-policies')).data,
    staleTime: 5 * 60_000,
  });
}

/** Customer-facing “By air” vs legacy pre-order labels (Phase M1). */
export function useAirLabels() {
  const { data } = useCheckoutPolicies();
  return useByAirLabels(data?.by_air_label_enabled !== false);
}

/** Platform feature flags from checkout-policies (Phase M1+). */
export function usePlatformFeatures() {
  const { data, isLoading } = useCheckoutPolicies();
  return {
    isLoading,
    careersEnabled: !!data?.careers_enabled,
    driverHiringEnabled: !!data?.driver_hiring_enabled,
    pickupStationsEnabled: !!data?.pickup_stations_enabled,
    marketplaceEnabled: !!data?.marketplace_enabled,
    shopApplicationsOpen: !!data?.shop_applications_open,
    shopReferralEnabled: !!data?.shop_referral_commission_enabled,
    imageSearchAvailable: !!data?.image_search_available,
  };
}
