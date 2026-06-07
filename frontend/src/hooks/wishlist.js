import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  fetchWishlistIds,
  getWishlistIdsLocal,
  isWishlistedLocal,
  onWishlistChange,
  syncWishlistToServer,
  toggleWishlistApi,
  toggleWishlistLocal,
} from '../lib/wishlistStorage';
import { useAuthStore } from '../store/authStore';

export function useWishlistIds() {
  const user = useAuthStore((s) => s.user);
  const isCustomer = user?.role === 'customer';

  const { data, refetch } = useQuery({
    queryKey: ['wishlist-ids'],
    queryFn: fetchWishlistIds,
    enabled: isCustomer,
    staleTime: 30_000,
  });

  const [localIds, setLocalIds] = useState(() => getWishlistIdsLocal());

  useEffect(() => onWishlistChange(() => setLocalIds(getWishlistIdsLocal())), []);

  const ids = isCustomer ? (data ?? []) : localIds;

  return { ids, refetch, isCustomer };
}

export function useIsWishlisted(productId) {
  const { ids, isCustomer } = useWishlistIds();
  const [local, setLocal] = useState(() => isWishlistedLocal(productId));

  useEffect(() => {
    if (!isCustomer) {
      return onWishlistChange(() => setLocal(isWishlistedLocal(productId)));
    }
    return undefined;
  }, [isCustomer, productId]);

  if (isCustomer) {
    return ids.includes(Number(productId));
  }
  return local;
}

export function useToggleWishlist() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const isCustomer = user?.role === 'customer';

  return useCallback(
    async (productId) => {
      if (isCustomer) {
        const on = await toggleWishlistApi(productId);
        qc.invalidateQueries({ queryKey: ['wishlist-ids'] });
        qc.invalidateQueries({ queryKey: ['wishlist'] });
        return on;
      }
      return toggleWishlistLocal(productId);
    },
    [isCustomer, qc]
  );
}

export function useWishlistProducts() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => (await api.get('/wishlist')).data.data,
    enabled: user?.role === 'customer',
  });
}

export { syncWishlistToServer };
