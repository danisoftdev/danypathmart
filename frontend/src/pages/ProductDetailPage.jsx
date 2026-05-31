import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProduct } from '../hooks/catalog';
import ProductImage from '../components/product/ProductImage';
import { formatPrice } from '../lib/currency';
import { useCartStore } from '../store/cartStore';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { data, isLoading, isError } = useProduct(slug);
  const addItem = useCartStore((s) => s.addItem);
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="h-6 w-1/3 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        </div>
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-gray-400">Product not found.</p>
        <Link to="/shop" className="btn-primary mt-4 inline-block">Back to shop</Link>
      </div>
    );
  }

  const product = data.data;
  const images = product.images?.length ? product.images : [null];
  const outOfStock = !product.is_preorder && product.stock_qty <= 0;

  const handleAdd = () => {
    addItem(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <nav className="mb-6 text-sm text-gray-400">
        <Link to="/shop" className="hover:text-brand-green">Shop</Link>
        {product.category && (
          <>
            {' / '}
            <Link to={`/shop?category=${product.category.slug}`} className="hover:text-brand-green">
              {product.category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="overflow-hidden rounded-xl border border-black/5 dark:border-white/10">
            <ProductImage
              src={images[active]}
              alt={product.name}
              className="aspect-square w-full object-cover"
            />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${
                    active === i ? 'border-brand-green' : 'border-transparent'
                  }`}
                >
                  <ProductImage src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <div className="mt-2 text-3xl font-extrabold text-brand-green">
            {formatPrice(product.price)}
          </div>

          <div className="mt-3">
            {product.is_preorder ? (
              <span className="inline-block rounded-full bg-brand-gold px-3 py-1 text-sm font-bold text-black">
                PRE-ORDER
              </span>
            ) : outOfStock ? (
              <span className="inline-block rounded-full bg-brand-red/15 px-3 py-1 text-sm font-semibold text-brand-red">
                Out of stock
              </span>
            ) : (
              <span className="inline-block rounded-full bg-brand-emerald/15 px-3 py-1 text-sm font-semibold text-brand-emerald">
                In stock ({product.stock_qty})
              </span>
            )}
          </div>

          {product.is_preorder && (
            <div className="mt-4 rounded-lg bg-brand-gold/10 p-3 text-sm text-brand-orange">
              This is a pre-order item.
              {product.estimated_arrival_days
                ? ` Estimated arrival: ~${product.estimated_arrival_days} days.`
                : ''}
            </div>
          )}

          {product.description && (
            <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {product.description}
            </p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center rounded-lg border-2 border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3 py-2 text-lg"
              >
                -
              </button>
              <span className="w-10 text-center">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="px-3 py-2 text-lg"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={outOfStock}
              className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {added ? 'Added!' : outOfStock ? 'Out of stock' : product.is_preorder ? 'Pre-order now' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
