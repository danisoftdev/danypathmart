import { Link } from 'react-router-dom';
import ProductImage from './ProductImage';
import { formatPrice } from '../../lib/currency';
import { useCartStore } from '../../store/cartStore';

export default function ProductCard({ product }) {
  const addItem = useCartStore((s) => s.addItem);
  const outOfStock = !product.is_preorder && product.stock_qty <= 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white transition duration-200 hover:scale-[1.01] hover:shadow-lg dark:border-white/10 dark:bg-[#1c1c1c]">
      {product.is_preorder && (
        <span className="absolute left-2 top-2 z-10 rounded-full bg-brand-gold px-2 py-0.5 text-xs font-bold text-black">
          PRE-ORDER
        </span>
      )}

      <Link to={`/product/${product.slug}`} className="block overflow-hidden">
        <ProductImage
          src={product.images?.[0]}
          alt={product.name}
          className="aspect-square w-full object-cover"
        />
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <Link
          to={`/product/${product.slug}`}
          className="line-clamp-2 text-sm font-medium hover:text-brand-green"
        >
          {product.name}
        </Link>
        <div className="mt-1 text-lg font-bold text-brand-green">{formatPrice(product.price)}</div>

        <button
          type="button"
          onClick={() => addItem(product, 1)}
          disabled={outOfStock}
          className="mt-3 rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {outOfStock ? 'Out of stock' : product.is_preorder ? 'Pre-order' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
