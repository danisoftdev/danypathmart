import { useContext } from 'react';
import { SearchContext } from '../context/searchContext';

export function useSearchOverlay() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearchOverlay must be used within SearchProvider');
  return ctx;
}
