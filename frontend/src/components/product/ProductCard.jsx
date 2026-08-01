import { Link } from 'react-router-dom';

import ProductImage from './ProductImage';

import ProductRating from './ProductRating';
import ProductBadges from './ProductBadges';

import { formatPrice } from '../../lib/currency';

import { productDiscount, stockLabel, unitsSoldLabel } from '../../lib/productUi';
import { useCatalogSettings } from '../../hooks/catalogSettings';

import { useIsWishlisted, useToggleWishlist } from '../../hooks/wishlist';

import { addRecentlyViewed } from '../../lib/browseStorage';

import { useAirLabels } from '../../hooks/checkout';
import { useCartStore } from '../../store/cartStore';
import { useStoreCartStore } from '../../store/storeCartStore';



export default function ProductCard({ product, onQuickView, storeMode = false, shopSlug, shopName }) {

  const addItem = useCartStore((s) => s.addItem);
  const addStoreItem = useStoreCartStore((s) => s.addItem);
  const labels = useAirLabels();
  const { data: catalogSettings } = useCatalogSettings();
  const inv = catalogSettings?.inventory;

  const wishlisted = useIsWishlisted(product.id);
  const toggleWish = useToggleWishlist();

  const stockQty = Number(product.stock_qty ?? product.stock ?? 0);
  const outOfStock = !product.is_preorder && stockQty <= 0;
  // Shop products live on /stores/{slug}, not the main DPM /product/:slug catalogue.
  const detailTo = storeMode && shopSlug
    ? `/stores/${shopSlug}#product-${product.id}`
    : `/product/${product.slug}`;

  const discount = productDiscount(product);

  const stock = stockLabel(product, labels, inv);
  const sold = unitsSoldLabel(product, inv);



  const onNavigate = () => addRecentlyViewed(product);



  return (

    <article
      id={storeMode ? `product-${product.id}` : undefined}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-[#1E1E1E]"
    >

      <div className="relative">

        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">

          {discount && (

            <span className="rounded-lg bg-brand-red px-2 py-0.5 text-[10px] font-bold text-white shadow">

              -{discount.percent}%

            </span>

          )}

          <ProductBadges product={product} labels={labels} />

        </div>



        <button

          type="button"

          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}

          onClick={async (e) => {
            e.preventDefault();
            await toggleWish(product.id);
          }}

          className={`absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-lg shadow transition hover:scale-105 dark:bg-black/70 ${

            wishlisted ? 'text-brand-gold' : 'text-black/40'

          }`}

        >

          {wishlisted ? '♥' : '♡'}

        </button>



        <Link to={detailTo} onClick={onNavigate} className="block overflow-hidden">

          <ProductImage
            src={product.images?.[0]}
            alt={product.name}
            className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />

        </Link>



        {onQuickView && (

          <button

            type="button"

            onClick={() => onQuickView(product)}

            className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/95 px-4 py-1.5 text-xs font-bold text-[#111111] opacity-0 shadow transition group-hover:opacity-100 dark:bg-black/80 dark:text-white md:opacity-0 max-md:opacity-100"

          >

            Quick view

          </button>

        )}

      </div>



      <div className="flex flex-1 flex-col p-3">

        <ProductRating product={product} />

        <Link

          to={detailTo}

          onClick={onNavigate}

          className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-[#111111] hover:text-brand-green dark:text-white"

        >

          {product.name}

        </Link>

        {product.shop?.name && (
          <Link
            to={`/stores/${product.shop.slug}`}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-brand-green"
          >
            {product.shop.logo_url && (
              <img src={product.shop.logo_url} alt="" className="h-4 w-4 rounded-full object-cover" />
            )}
            Sold by {product.shop.name}
          </Link>
        )}



        <div className="mt-1.5 flex flex-wrap items-baseline gap-2">

          <span className="text-lg font-extrabold text-brand-green">{formatPrice(product.price)}</span>

          {discount && (

            <span className="text-xs text-muted line-through">{formatPrice(discount.compareAt)}</span>

          )}

        </div>



        <span

          className={`mt-1.5 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${

            stock.tone === 'gold'

              ? 'bg-brand-gold/20 text-[#92400E]'

              : stock.tone === 'red'

                ? 'bg-brand-red/15 text-brand-red'

                : stock.tone === 'orange'

                  ? 'bg-brand-orange/15 text-brand-orange'

                  : 'bg-brand-green/15 text-brand-green'

          }`}

        >

          {stock.text}

        </span>

        {sold && (
          <span className="mt-1 inline-flex w-fit rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-muted dark:bg-white/10">
            {sold}
          </span>
        )}



        <button

          type="button"

          onClick={() => (storeMode ? addStoreItem(product, 1, shopSlug, shopName) : addItem(product, 1))}

          disabled={outOfStock}

          className="mt-3 w-full rounded-xl bg-brand-green py-2.5 text-sm font-bold text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"

        >

          {outOfStock ? 'Out of stock' : product.is_preorder ? labels.addToCart : 'Add to cart'}

        </button>

      </div>

    </article>

  );

}

