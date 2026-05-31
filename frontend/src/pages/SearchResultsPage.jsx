import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import ProductCard from '../components/product/ProductCard';
import EmptyState from '../components/ui/EmptyState';
import { ProductGridSkeleton } from '../components/ui/Skeleton';
import { useImageSearchStore } from '../store/imageSearchStore';

function ProductGrid({ products }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

function Labels({ labels }) {
  if (!labels?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {labels.map((label) => (
        <span
          key={label}
          className="rounded-full bg-brand-green/10 px-2.5 py-0.5 text-xs text-brand-green"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function ImageResults() {
  const result = useImageSearchStore((s) => s.result);
  const [description, setDescription] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  if (!result) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Search by image</h1>
        <p className="mt-2 text-black/60 dark:text-white/60">
          Use the camera icon in the search bar to upload a product photo.
        </p>
        <Link to="/shop" className="mt-6 inline-block text-brand-green hover:underline">
          Browse the shop
        </Link>
      </div>
    );
  }

  const sendDescription = async () => {
    if (!description.trim()) return;
    setSending(true);
    try {
      await api.post('/search/describe', {
        alert_id: result.alert_id,
        description: description.trim(),
      });
      setSent(true);
    } catch {
      setSent(true); // enumeration-safe / non-blocking
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        {result.previewUrl && (
          <img
            src={result.previewUrl}
            alt="Your search"
            className="h-20 w-20 flex-shrink-0 rounded-xl border border-black/10 object-cover dark:border-white/15"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold">
            {result.found ? 'Visual matches for your image' : 'No matches found'}
          </h1>
          <Labels labels={result.labels} />
        </div>
      </div>

      {result.found ? (
        <ProductGrid products={result.products} />
      ) : (
        <div className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/15 dark:bg-[#1c1c1c]">
          <p className="text-black/70 dark:text-white/70">
            We couldn&apos;t find a matching product, but our team has been notified.
          </p>

          {sent ? (
            <p className="mt-4 rounded-lg bg-brand-green/10 px-4 py-3 text-sm font-medium text-brand-green">
              Thank you! We&apos;ll look into sourcing this for you.
            </p>
          ) : (
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">
                Describe what you are looking for
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="e.g. A blue Pathfinder camping badge with white trim"
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green dark:border-white/15 dark:bg-[#111]"
              />
              <button
                type="button"
                onClick={sendDescription}
                disabled={sending || !description.trim()}
                className="mt-3 rounded-lg bg-brand-green px-5 py-2 text-sm font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          )}

          <Link to="/shop" className="mt-4 inline-block text-sm text-brand-green hover:underline">
            Browse the shop instead
          </Link>
        </div>
      )}
    </div>
  );
}

function TextResults({ query }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', query],
    queryFn: async () => (await api.get('/search', { params: { q: query, per_page: 24 } })).data,
    enabled: query.length > 0,
  });

  const products = data?.data ?? [];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">
        Search results{query ? ` for "${query}"` : ''}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {isLoading ? 'Searching...' : `${data?.meta?.total ?? products.length} item(s) found`}
      </p>

      {isLoading ? (
        <ProductGridSkeleton count={6} />
      ) : isError ? (
        <p className="text-brand-red">Something went wrong. Please try again.</p>
      ) : products.length === 0 ? (
        <EmptyState
          title="No products found"
          message="No products matched your search. Try different keywords or browse the catalogue."
          actionLabel="Browse all products"
          actionTo="/shop"
        />
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}

export default function SearchResultsPage() {
  const [params] = useSearchParams();
  const type = params.get('type');
  const query = (params.get('q') || '').trim();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {type === 'image' ? <ImageResults /> : <TextResults query={query} />}
    </div>
  );
}
