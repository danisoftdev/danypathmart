import { Link } from 'react-router-dom';
import ProductCard from '../../components/product/ProductCard';
import EmptyState from '../../components/ui/EmptyState';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';
import { useWishlistProducts } from '../../hooks/wishlist';

export default function WishlistPage() {
  const { data: products, isLoading, isError } = useWishlistProducts();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#111111] dark:text-white">Wishlist</h1>
        <p className="mt-1 text-sm text-muted">Items you saved for later.</p>
      </div>

      {isLoading ? (
        <ProductGridSkeleton count={4} />
      ) : isError ? (
        <p className="text-sm text-brand-red">Could not load wishlist.</p>
      ) : !products?.length ? (
        <EmptyState
          title="Your wishlist is empty"
          message="Tap the heart on any product to save it here."
          actionLabel="Browse shop"
          actionTo="/shop"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      <Link to="/shop" className="mt-6 inline-block text-sm font-bold text-brand-green hover:underline">
        Continue shopping →
      </Link>
    </div>
  );
}
