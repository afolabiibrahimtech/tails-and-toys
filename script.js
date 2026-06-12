// Fallback NGN -> USD conversion rate, used only if a product has no
// priceUSD set (e.g. older admin-added products). Update as needed.
const NGN_TO_USD_RATE = 1500;

// ===== Default Product (always shown, can't be deleted from admin) =====
const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: "Interactive Feather Wand",
    description: "A playful wand toy with a feathered tip to engage your cat's natural hunting instincts.",
    colors: "Blue, Pink, Natural",
    price: 8500,
    priceUSD: 5.50,
    discount: 0,
    hidden: false,
    images: ["images/feather-wand.jpg"],
    category: "toys",
    variations: [
      { size: "S", measurement: "35 x 5 x 5", stock: 10 },
      { size: "M", measurement: "45 x 5 x 5", stock: 25 },
      { size: "L", measurement: "60 x 5 x 5", stock: 8 }
    ]
  }
];

// Human-friendly labels for category values
const CATEGORY_LABELS = {
  toys: "Cat Toys",
  accessories: "Accessories"
};

let currentCategory = 'all';

let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Combine the default product(s) with anything added via the admin panel,
// excluding any products the admin has marked as hidden. Normalizes older
// products that only have a single "image" field into an "images" array,
// and older single-size products (with top-level size/measurement/stock)
// into a "variations" array.
function getAllProducts() {
  const customProducts = JSON.parse(localStorage.getItem('products')) || [];
  return [...DEFAULT_PRODUCTS, ...customProducts]
    .filter(p => !p.hidden)
    .map(p => {
      const images = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
      const variations = (p.variations && p.variations.length)
        ? p.variations
        : [{
            size: p.size || '',
            measurement: p.measurement || '',
            stock: (p.stock === undefined ? null : p.stock)
          }];
      return { ...p, images, variations };
    });
}

// ===== Stock helpers (operate on a single size variation) =====
function isVariationTracked(variation) {
  return !!variation && variation.stock !== null && variation.stock !== undefined && variation.stock !== '';
}

function isOutOfStock(variation) {
  return isVariationTracked(variation) && Number(variation.stock) <= 0;
}

function isLowStock(variation) {
  return isVariationTracked(variation) && Number(variation.stock) > 0 && Number(variation.stock) <= 3;
}

function renderStockBadge(variation) {
  if (isOutOfStock(variation)) return `<p class="stock-msg out-of-stock">Out of Stock</p>`;
  if (isLowStock(variation)) return `<p class="stock-msg low-stock">Only ${variation.stock} left</p>`;
  return '';
}

// Returns the price after applying any discount percentage
function getEffectivePrice(product) {
  const discount = product.discount || 0;
  if (!discount) return product.price || 0;
  return Math.round((product.price || 0) * (1 - discount / 100));
}

// ===== Render product grid =====
function renderProducts(category = currentCategory) {
  currentCategory = category;
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '';

  // Update active state on filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  const products = getAllProducts().filter(p =>
    category === 'all' || (p.category || 'toys') === category
  );

  if (products.length === 0) {
    grid.innerHTML = `<p class="no-products-msg">No products in this category yet.</p>`;
    return;
  }

  products.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';

    const hasDiscount = product.discount && product.discount > 0;
    const effectivePrice = getEffectivePrice(product);
    const priceHTML = hasDiscount
      ? `<span class="old-price">₦${product.price.toLocaleString()}</span>
         <span class="price">₦${effectivePrice.toLocaleString()}</span>
         <span class="discount-badge">-${product.discount}%</span>`
      : `<span class="price">${product.price ? '₦' + product.price.toLocaleString() : 'Price on request'}</span>`;

    const placeholder = `https://via.placeholder.com/300x230/bfdbfe/1e40af?text=${encodeURIComponent(product.name)}`;
    const images = (product.images && product.images.length) ? product.images : [placeholder];

    const dotsHTML = images.length > 1
      ? `<div class="image-dots">
          ${images.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" onclick="setProductImage(event, ${i})" aria-label="Show image ${i + 1}"></span>`).join('')}
         </div>`
      : '';

    // Escape single quotes so the JSON can safely live inside a single-quoted attribute
    const imagesAttr = JSON.stringify(images).replace(/'/g, '&#39;');

    // ===== Size variations =====
    const variations = product.variations;
    const hasMultipleSizes = variations.length > 1;
    const variationsAttr = JSON.stringify(variations).replace(/'/g, '&#39;');

    // Default to the first in-stock size, if any are tracked
    let defaultIndex = variations.findIndex(v => !isOutOfStock(v));
    if (defaultIndex === -1) defaultIndex = 0;
    card.dataset.selectedVariation = String(defaultIndex);

    const sizeSelectorHTML = hasMultipleSizes
      ? `<div class="size-selector">
           <span class="size-label">Size:</span>
           ${variations.map((v, i) => `
             <button type="button" class="size-btn ${i === defaultIndex ? 'active' : ''}" ${isOutOfStock(v) ? 'disabled' : ''} onclick="selectVariation(event, ${i})">${v.size || 'Option ' + (i + 1)}</button>
           `).join('')}
         </div>`
      : '';

    const selectedVariation = variations[defaultIndex] || {};

    // For single-variation products, still show the size as plain text if set
    const singleSizeHTML = (!hasMultipleSizes && selectedVariation.size)
      ? `<p class="product-meta"><strong>Size:</strong> ${selectedVariation.size}</p>`
      : '';

    const measurementHTML = selectedVariation.measurement
      ? `<p class="product-meta variation-measurement"><strong>Measurement:</strong> ${selectedVariation.measurement} cm</p>`
      : '';

    const outOfStock = isOutOfStock(selectedVariation);

    card.innerHTML = `
      <div class="product-image-wrap" data-images='${imagesAttr}'>
        <img class="product-img" src="${images[0]}" alt="${product.name}" onerror="this.src='${placeholder}'">
        ${dotsHTML}
      </div>
      <div class="product-info" data-variations='${variationsAttr}'>
        <span class="category-tag">${CATEGORY_LABELS[product.category] || product.category || 'Cat Toys'}</span>
        <h3>${product.name}</h3>
        ${product.description ? `<p class="product-desc">${product.description}</p>` : ''}
        ${product.colors ? `<p class="product-meta"><strong>Colors:</strong> ${product.colors}</p>` : ''}
        ${singleSizeHTML}
        ${sizeSelectorHTML}
        <div class="variation-measurement-wrap">${measurementHTML}</div>
        <div class="price-row">${priceHTML}</div>
        <div class="stock-area">${renderStockBadge(selectedVariation)}</div>
        <button class="add-to-cart" onclick="addToCart(${product.id}, event)" ${outOfStock ? 'disabled' : ''}>
          ${outOfStock ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Switches the selected size variation when a size button is clicked,
// updating the measurement, stock message, and Add to Cart state.
window.selectVariation = function(event, index) {
  const card = event.target.closest('.product-card');
  if (!card) return;

  const infoEl = card.querySelector('.product-info');
  const variations = JSON.parse(infoEl.dataset.variations.replace(/&#39;/g, "'"));
  const variation = variations[index];
  if (!variation) return;

  card.dataset.selectedVariation = String(index);

  card.querySelectorAll('.size-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });

  const measurementWrap = card.querySelector('.variation-measurement-wrap');
  measurementWrap.innerHTML = variation.measurement
    ? `<p class="product-meta variation-measurement"><strong>Measurement:</strong> ${variation.measurement} cm</p>`
    : '';

  const stockArea = card.querySelector('.stock-area');
  stockArea.innerHTML = renderStockBadge(variation);

  const addBtn = card.querySelector('.add-to-cart');
  const outOfStock = isOutOfStock(variation);
  addBtn.disabled = outOfStock;
  addBtn.textContent = outOfStock ? 'Out of Stock' : 'Add to Cart';
};

// Switches the displayed image when a pagination dot is clicked
window.setProductImage = function(event, index) {
  const wrap = event.target.closest('.product-image-wrap');
  if (!wrap) return;

  const images = JSON.parse(wrap.dataset.images.replace(/&#39;/g, "'"));
  const img = wrap.querySelector('.product-img');
  img.src = images[index];

  wrap.querySelectorAll('.dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
};

// Switches the active category filter and scrolls to the shop section
window.filterProducts = function(category) {
  renderProducts(category);
  const shopSection = document.getElementById('shop');
  if (shopSection) {
    shopSection.scrollIntoView({ behavior: 'smooth' });
  }
};

// ===== Add to Cart =====
window.addToCart = function(id, event) {
  const product = getAllProducts().find(p => p.id === id);
  if (!product) return;

  // Determine which size variation is currently selected on this card
  const card = event && event.target ? event.target.closest('.product-card') : null;
  const variationIndex = card ? parseInt(card.dataset.selectedVariation || '0') : 0;
  const variation = product.variations[variationIndex] || product.variations[0] || {};

  // Items are matched by product id AND chosen size, so different sizes
  // of the same product appear as separate cart entries.
  const existingItem = cart.find(item => item.id === id && (item.variationIndex || 0) === variationIndex);

  // Respect stock limits if this size variation tracks stock
  if (isVariationTracked(variation)) {
    const currentQty = existingItem ? existingItem.quantity : 0;
    if (currentQty + 1 > Number(variation.stock)) {
      const sizeLabel = variation.size ? ` (${variation.size})` : '';
      alert(`Sorry, only ${variation.stock} of "${product.name}"${sizeLabel} available.`);
      return;
    }
  }

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    // Store the effective (post-discount) price so cart totals/checkout
    // automatically reflect any discount applied at the time of adding.
    // Also store a single "image" (first of the product's images) and the
    // chosen size/measurement for use in the cart sidebar and cart page.
    cart.push({
      ...product,
      image: (product.images && product.images[0]) || '',
      price: getEffectivePrice(product),
      quantity: 1,
      variationIndex,
      size: variation.size || '',
      measurement: variation.measurement || ''
    });
  }

  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  renderCartSidebar();

  // Simple button feedback
  if (event && event.target) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = 'Added ✓';
    btn.style.background = '#10b981';

    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 1200);
  }
};

// ===== Cart count badge =====
function updateCartCount() {
  const countEl = document.getElementById('cartCount');
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  countEl.textContent = totalItems;
}

// ===== Mini Cart Sidebar =====
function renderCartSidebar() {
  const container = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');

  if (cart.length === 0) {
    container.innerHTML = `<p class="empty-cart-msg">Your cart is empty 🛒</p>`;
    totalEl.textContent = '₦0';
    return;
  }

  container.innerHTML = cart.map((item, index) => `
    <div class="cart-sidebar-item">
      <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/60x60/bfdbfe/1e40af?text=Cat'">
      <div class="item-details">
        <h4>${item.name}${item.size ? ` <span class="item-size">(${item.size})</span>` : ''}</h4>
        <p>₦${item.price.toLocaleString()}</p>
        <div class="quantity-controls">
          <button onclick="changeQuantity(${index}, -1)">–</button>
          <span>${item.quantity}</span>
          <button onclick="changeQuantity(${index}, 1)">+</button>
        </div>
      </div>
      <button class="remove-btn" onclick="removeFromCart(${index})">🗑</button>
    </div>
  `).join('');

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  totalEl.textContent = `₦${total.toLocaleString()}`;
}

window.changeQuantity = function(index, change) {
  const item = cart[index];

  // When increasing quantity, respect stock limits for the chosen size
  if (change > 0) {
    const product = getAllProducts().find(p => p.id === item.id);
    const variation = product ? (product.variations[item.variationIndex || 0] || {}) : {};
    if (isVariationTracked(variation) && item.quantity + change > Number(variation.stock)) {
      const sizeLabel = item.size ? ` (${item.size})` : '';
      alert(`Sorry, only ${variation.stock} of "${item.name}"${sizeLabel} available.`);
      return;
    }
  }

  item.quantity += change;
  if (item.quantity < 1) {
    cart.splice(index, 1);
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  renderCartSidebar();
};

window.removeFromCart = function(index) {
  cart.splice(index, 1);
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  renderCartSidebar();
};

function openCart() {
  document.getElementById('cartSidebar').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  renderCartSidebar();
}

function closeCart() {
  document.getElementById('cartSidebar').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
}
window.closeCart = closeCart;

// ===== Checkout via Instagram =====
const INSTAGRAM_USERNAME = "tailsandtoysllc";

function checkoutInstagram() {
  if (cart.length === 0) {
    alert("Your cart is empty 🛍️");
    return;
  }

  let message = "🛍️ New Order from Tails & Toys\n\n";
  cart.forEach(item => {
    message += `${item.name} × ${item.quantity} = ₦${(item.price * item.quantity).toLocaleString()}\n`;
  });
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  message += `\nTotal: ₦${total.toLocaleString()}\n\nPlease confirm my order!`;

  // Instagram DMs don't support pre-filled message text via link, so we
  // copy the order details to the clipboard and let the customer paste
  // them into the chat that opens.
  if (navigator.clipboard) {
    navigator.clipboard.writeText(message).catch(() => {});
  }

  alert("Your order details have been copied!\nPaste them into the Instagram DM that opens, then send.");

  window.open(`https://ig.me/m/${INSTAGRAM_USERNAME}`, '_blank');
}
window.checkoutInstagram = checkoutInstagram;

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  updateCartCount();
  renderCartSidebar();

  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);
});
