'use client';

import { Product } from '../../services/api';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  // Safely format price
  const formatPrice = (price: string | number | undefined): string => {
    if (price === undefined || price === null) return 'Price varies';
    
    try {
      const priceStr = typeof price === 'string' ? price : String(price);
      const priceNum = parseFloat(priceStr);
      
      if (isNaN(priceNum)) return 'Price varies';
      
      // Format with 2 decimal places and add currency
      return `${priceNum.toFixed(2)} lei`;
    } catch (error) {
      console.error('Error formatting price:', error, 'Price value:', price);
      return 'Price varies';
    }
  };

  // Get the best available image URL
  const getImageUrl = (): string | null => {
    if (product.image) return product.image;
    
    // Handle different image formats from the backend
    if (Array.isArray(product.images) && product.images.length > 0) {
      const firstImage = product.images[0];
      return typeof firstImage === 'string' ? firstImage : (firstImage as any)?.src || null;
    }
    
    return null;
  };

  const formattedPrice = formatPrice(product.price);
  const productName = product.name || 'Unnamed Product';
  const productUrl = product.url || '#';
  const imageUrl = getImageUrl();

  // Handle image loading errors
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
    
    const parent = target.parentElement;
    if (parent) {
      const noImageDiv = document.createElement('div');
      noImageDiv.className = styles.noImage;
      noImageDiv.textContent = 'No Image';
      parent.appendChild(noImageDiv);
    }
  };

  // Handle product click
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (productUrl === '#') {
      e.preventDefault();
    }
    // You can add analytics or other click handling here
  };

  // Check if the product is on sale
  const isOnSale = Boolean(
    product.regular_price && 
    product.price && 
    parseFloat(product.price) < parseFloat(product.regular_price)
  );

  return (
    <div 
      className={styles.productCard}
      data-has-sale={isOnSale}
      data-testid="product-card"
    >
      <a 
        href={productUrl} 
        target="_blank" 
        rel="noopener noreferrer nofollow" 
        className={styles.productLink}
        onClick={handleClick}
        aria-label={`View ${productName} details`}
      >
        <div className={styles.productImage}>
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={productName}
              loading="lazy"
              onError={handleImageError}
              className={styles.productImage}
            />
          ) : (
            <div className={styles.noImage}>
              <span>No Image</span>
            </div>
          )}
        </div>
        <div className={styles.productInfo}>
          <h3 className={styles.productName} title={productName}>
            {productName.length > 50 ? `${productName.substring(0, 47)}...` : productName}
          </h3>
          <div className={styles.productPrice}>
            {formattedPrice}
            {product.regular_price && product.price !== product.regular_price && (
              <span className={styles.originalPrice}>{formatPrice(product.regular_price)}</span>
            )}
          </div>
          {product.categories && product.categories.length > 0 && (
            <div className={styles.productCategories}>
              {product.categories.slice(0, 2).map((category, index) => (
                <span key={index} className={styles.categoryTag}>
                  {category}
                </span>
              ))}
              {product.categories.length > 2 && (
                <span className={styles.moreCategories}>+{product.categories.length - 2} more</span>
              )}
            </div>
          )}
        </div>
      </a>
    </div>
  );
};

export default ProductCard;
