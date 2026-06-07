import { Link } from 'react-router-dom';
import { useProducts } from '../../hooks/catalog';
import ProductCard from '../product/ProductCard';
import { ProductGridSkeleton } from '../ui/Skeleton';

export default function CartRecommendations() {
  const { data, isLoading } = useProducts({ sort: 'popular', page: 1, per_page: 8 });
  const products = data?.data ?? [];

  if (isLoading) {
    return (
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-extrabold">You might also like</h2>
        <ProductGridSkeleton count={4} />
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">You might also like</h2>
        <Link to="/shop" className="text-sm font-bold text-brand-green hover:underline">
          See all
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.slice(0, 8).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
