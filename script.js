// ===== Default Product (always shown, can't be deleted from admin) =====
// Each entry in "variations" is one size + color combination with its own
// stock count, e.g. { size: "S", color: "Blue", stock: 4 }. Measurement is
// a single product-level field, shown separately from size/color.
// "price" is in USD.
const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: "Interactive Feather Wand",
    description: "A playful wand toy with a feathered tip to engage your cat's natural hunting instincts.",
    measurement: "45 x 5 x 5",
    price: 5.50,
    discount: 0,
    hidden: false,
    images: ["images/feather-wand.jpg"],
    category: "toys",
    variations: [
      { size: "S", color: "Blue", stock: 4 },
      { size: "S", color: "Pink", stock: 2 },
      { size: "M", color: "Blue", stock: 6 },
      { size: "M", color: "Pink", stock: 0 },
      { size: "L", color: "Natural", stock: 3 }
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
// products into the current "variations" array of
// { size, color, stock } combinations, with "measurement" as a separate
// product-level field.
function getAllProducts() {
  const customProducts = JSON.parse(localStorage.getItem('products')) || [];
  return [...DEFAULT_PRODUCTS, ...customProducts]
    .filter(p => !p.hidden)
    .map(p => {
      const images = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
      const measurement = p.measurement || (p.variations && p.variations[0] && p.variations[0].measurement) || '';

      let variations;
      if (p.variations && p.variations.length) {
        // Make sure every variation has a "color" field, even if older
        // data only tracked size.
        variations = p.variations.map(v => ({
          size: v.size || '',
          color: v.color || '',
          stock: (v.stock === undefined ? null : v.stock)
        }));
      } else {
        variations = [{
          size: p.size || '',
          color: '',
          stock: (p.stock === undefined ? null : p.stock)
        }];
      }

      return { ...p, images, variations, measurement, colorImages: p.colorImages || {} };
    });
}

// ===== Stock helpers (operate on a single size/color variation) =====
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

// Finds the variation matching a given size + color combination. If that
// exact combination wasn't added by the admin, it's treated as out of
// stock (stock: 0) rather than silently falling back to another variation.
function findVariation(variations, size, color) {
  const match = variations.find(v => (v.size || '') === (size || '') && (v.color || '') === (color || ''));
  if (match) return match;
  return { size: size || '', color: color || '', stock: 0 };
}

// Returns the price after applying any discount percentage
function getEffectivePrice(product) {
  const discount = product.discount || 0;
  if (!discount) return product.price || 0;
  return Math.round((product.price || 0) * (1 - discount / 100) * 100) / 100;
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
      ? `<span class="old-price">$${product.price.toFixed(2)}</span>
         <span class="price">$${effectivePrice.toFixed(2)}</span>
         <span class="discount-badge">-${product.discount}%</span>`
      : `<span class="price">${product.price ? '$' + product.price.toFixed(2) : 'Price on request'}</span>`;

    const placeholder = `https://via.placeholder.com/300x230/bfdbfe/1e40af?text=${encodeURIComponent(product.name)}`;
    const defaultImages = (product.images && product.images.length) ? product.images : [placeholder];
    const colorImages = product.colorImages || {};

    // ===== Size + color variation matrix =====
    const variations = product.variations;
    const variationsAttr = JSON.stringify(variations).replace(/'/g, '&#39;');

    // Default selection: the first in-stock combination, if any
    let defaultVariation = variations.find(v => !isOutOfStock(v)) || variations[0] || { size: '', color: '', stock: null };
    const defaultSize = defaultVariation.size || '';
    const defaultColor = defaultVariation.color || '';
    card.dataset.selectedSize = defaultSize;
    card.dataset.selectedColor = defaultColor;

    // Use color-specific images if this color has its own photo set,
    // otherwise fall back to the product's default images.
    const initialImages = (defaultColor && colorImages[defaultColor] && colorImages[defaultColor].length)
      ? colorImages[defaultColor]
      : defaultImages;

    const { trackHTML, dotsHTML } = buildImageMarkup(initialImages, placeholder, product.name);

    // Escape single quotes so this JSON can safely live in single-quoted attributes
    const defaultImagesAttr = JSON.stringify(defaultImages).replace(/'/g, '&#39;');
    const colorImagesAttr = JSON.stringify(colorImages).replace(/'/g, '&#39;');

    const sizeAreaHTML = buildSizeAreaHTML(variations, defaultSize);
    const colorAreaHTML = buildColorAreaHTML(variations, defaultSize, defaultColor);

    // Measurement is a single product-level field, shown in its own
    // section separate from the size/color selectors.
    const measurementHTML = product.measurement
      ? `<p class="product-meta"><strong>Measurement:</strong> ${product.measurement} cm</p>`
      : '';

    const outOfStock = isOutOfStock(defaultVariation);

    card.innerHTML = `
      <div class="product-image-wrap" data-default-images='${defaultImagesAttr}' data-color-images='${colorImagesAttr}' data-placeholder="${placeholder}" data-product-name="${product.name}" data-current-index="0">
        <div class="image-track">${trackHTML}</div>
        ${dotsHTML}
      </div>
      <div class="product-info" data-variations='${variationsAttr}'>
        <span class="category-tag">${CATEGORY_LABELS[product.category] || product.category || 'Cat Toys'}</span>
        <h3>${product.name}</h3>
        ${product.description ? `<p class="product-desc">${product.description}</p>` : ''}
        ${measurementHTML}
        ${sizeAreaHTML}
        <div class="color-area-wrap">${colorAreaHTML}</div>
        <div class="price-row">${priceHTML}</div>
        <div class="stock-area">${renderStockBadge(defaultVariation)}</div>
        <button class="add-to-cart" onclick="addToCart(${product.id}, event)" ${outOfStock ? 'disabled' : ''}>
          ${outOfStock ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    `;
    grid.appendChild(card);
    initImageCarouselDrag(card.querySelector('.product-image-wrap'));
  });
}

// Builds the sliding image track + pagination dots markup for a given
// list of image URLs. Used both for the initial render and when switching
// to a color that has its own photo set.
function buildImageMarkup(images, placeholder, productName) {
  const list = (images && images.length) ? images : [placeholder];

  const trackHTML = list.map((src, i) =>
    `<img class="product-img" src="${src}" alt="${productName}${list.length > 1 ? ` (image ${i + 1})` : ''}" draggable="false" onerror="this.src='${placeholder}'">`
  ).join('');

  const dotsHTML = list.length > 1
    ? `<div class="image-dots">
        ${list.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" onclick="setProductImage(event, ${i})" aria-label="Show image ${i + 1}"></span>`).join('')}
       </div>`
    : '';

  return { trackHTML, dotsHTML };
}

// Re-renders the image track/dots for a card based on the currently
// selected color. If that color has its own image set, those are shown;
// otherwise the product's default images are used.
function updateProductImages(card, newColor) {
  const wrap = card.querySelector('.product-image-wrap');
  const defaultImages = JSON.parse(wrap.dataset.defaultImages.replace(/&#39;/g, "'"));
  const colorImages = JSON.parse(wrap.dataset.colorImages.replace(/&#39;/g, "'"));
  const placeholder = wrap.dataset.placeholder;
  const productName = wrap.dataset.productName;

  const images = (newColor && colorImages[newColor] && colorImages[newColor].length)
    ? colorImages[newColor]
    : defaultImages;

  const { trackHTML, dotsHTML } = buildImageMarkup(images, placeholder, productName);

  const track = wrap.querySelector('.image-track');
  track.style.transform = 'translateX(0%)';
  track.innerHTML = trackHTML;
  wrap.dataset.currentIndex = '0';

  let dotsEl = wrap.querySelector('.image-dots');
  if (dotsEl) dotsEl.remove();
  if (dotsHTML) wrap.insertAdjacentHTML('beforeend', dotsHTML);
}

// Sets up drag/swipe support for the image carousel: dragging the image
// track left/right slides between photos, same as clicking the dots.
// Works with both mouse and touch.
function initImageCarouselDrag(wrap) {
  function goToIndex(i, animate = true) {
    const track = wrap.querySelector('.image-track');
    if (!track) return;
    const count = track.children.length;
    i = Math.max(0, Math.min(count - 1, i));
    wrap.dataset.currentIndex = i;
    track.style.transition = animate ? '' : 'none';
    track.style.transform = `translateX(-${i * 100}%)`;
    wrap.querySelectorAll('.dot').forEach((dot, idx) => dot.classList.toggle('active', idx === i));
  }
  // Exposed so setProductImage (dot clicks) can reuse the same logic.
  wrap._goToIndex = goToIndex;

  let dragging = false;
  let startX = 0, startY = 0, width = 0, horizontalDrag = null;

  function startDrag(x, y) {
    const track = wrap.querySelector('.image-track');
    if (!track || track.children.length <= 1) return;
    dragging = true;
    startX = x;
    startY = y;
    horizontalDrag = null;
    width = wrap.getBoundingClientRect().width;
    track.style.transition = 'none';
  }

  function moveDrag(x, y, evt) {
    if (!dragging) return;
    const dx = x - startX;
    const dy = y - startY;
    if (horizontalDrag === null) {
      horizontalDrag = Math.abs(dx) > Math.abs(dy);
    }
    if (!horizontalDrag) return;
    if (evt && evt.cancelable) evt.preventDefault();

    const track = wrap.querySelector('.image-track');
    const index = parseInt(wrap.dataset.currentIndex || '0', 10);
    const percent = (dx / width) * 100;
    track.style.transform = `translateX(calc(-${index * 100}% + ${percent}%))`;
  }

  function endDrag(x) {
    if (!dragging) return;
    dragging = false;
    const track = wrap.querySelector('.image-track');
    track.style.transition = '';

    const index = parseInt(wrap.dataset.currentIndex || '0', 10);
    if (!horizontalDrag) {
      goToIndex(index);
      return;
    }

    const dx = x - startX;
    const threshold = width * 0.15;
    let newIndex = index;
    if (dx < -threshold) newIndex = index + 1;
    else if (dx > threshold) newIndex = index - 1;
    goToIndex(newIndex);
  }

  // Mouse
  wrap.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY, e));
  window.addEventListener('mouseup', (e) => endDrag(e.clientX));

  // Touch
  wrap.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
  }, { passive: true });
  wrap.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY, e);
  }, { passive: false });
  wrap.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    endDrag(t.clientX);
  });
}


function buildSizeAreaHTML(variations, selectedSize) {
  const sizes = [...new Set(variations.map(v => v.size).filter(s => s))];
  if (sizes.length === 0) return '';
  if (sizes.length === 1) return `<p class="product-meta"><strong>Size:</strong> ${sizes[0]}</p>`;

  return `<div class="size-selector">
    <span class="size-label">Size:</span>
    ${sizes.map(s => {
      const variantsForSize = variations.filter(v => (v.size || '') === s);
      const allOut = variantsForSize.every(v => isOutOfStock(v));
      return `<button type="button" class="size-btn ${s === selectedSize ? 'active' : ''}" ${allOut ? 'disabled' : ''} data-size="${s}" onclick="selectSize(event)">${s}</button>`;
    }).join('')}
  </div>`;
}

// Builds the "Color" area: nothing if the product has no colors at all,
// plain text if there's only one color overall, or a row of selectable
// swatch buttons covering every color the product offers. Colors that
// don't have a matching (in-stock) row for the currently selected size
// appear dashed/disabled, the same as an out-of-stock combination.
function buildColorAreaHTML(variations, selectedSize, selectedColor) {
  const allColors = [...new Set(variations.map(v => v.color).filter(c => c))];
  if (allColors.length === 0) return '';
  if (allColors.length === 1) return `<p class="product-meta"><strong>Color:</strong> ${allColors[0]}</p>`;

  return `<div class="color-selector">
    <span class="size-label">Color:</span>
    ${allColors.map(c => {
      const variation = findVariation(variations, selectedSize, c);
      const unavailable = isOutOfStock(variation);
      return `<button type="button" class="color-btn ${c === selectedColor ? 'active' : ''}" ${unavailable ? 'disabled' : ''} data-color="${c}" onclick="selectColor(event)"><span class="color-swatch" style="background:${c.toLowerCase()}"></span>${c}</button>`;
    }).join('')}
  </div>`;
}

// Updates the stock message and Add to Cart button for the currently
// selected size + color combination. Measurement is product-level and
// doesn't change with selection.
function updateStockState(card, variations, size, color) {
  const variation = findVariation(variations, size, color);

  const stockArea = card.querySelector('.stock-area');
  stockArea.innerHTML = renderStockBadge(variation);

  const addBtn = card.querySelector('.add-to-cart');
  const outOfStock = isOutOfStock(variation);
  addBtn.disabled = outOfStock;
  addBtn.textContent = outOfStock ? 'Out of Stock' : 'Add to Cart';
}

// Switches the selected size when a size button is clicked. The color
// options are rebuilt to match what's available for the new size.
window.selectSize = function(event) {
  const card = event.target.closest('.product-card');
  const btn = event.target.closest('.size-btn');
  if (!card || !btn) return;

  const newSize = btn.dataset.size;
  const infoEl = card.querySelector('.product-info');
  const variations = JSON.parse(infoEl.dataset.variations.replace(/&#39;/g, "'"));

  card.dataset.selectedSize = newSize;
  card.querySelectorAll('.size-btn').forEach(b => b.classList.toggle('active', b.dataset.size === newSize));

  // Pick a color for the new size: prefer one that's in stock for this
  // size; otherwise keep showing the full color list (others appear dashed)
  const allColors = [...new Set(variations.map(v => v.color).filter(c => c))];
  let newColor = '';
  if (allColors.length) {
    const inStockForSize = variations.find(v => (v.size || '') === newSize && v.color && !isOutOfStock(v));
    if (inStockForSize) {
      newColor = inStockForSize.color;
    } else {
      const anyForSize = variations.find(v => (v.size || '') === newSize && v.color);
      newColor = anyForSize ? anyForSize.color : allColors[0];
    }
  }
  card.dataset.selectedColor = newColor;

  card.querySelector('.color-area-wrap').innerHTML = buildColorAreaHTML(variations, newSize, newColor);
  updateProductImages(card, newColor);
  updateStockState(card, variations, newSize, newColor);
};

// Switches the selected color when a color swatch button is clicked.
window.selectColor = function(event) {
  const card = event.target.closest('.product-card');
  const btn = event.target.closest('.color-btn');
  if (!card || !btn) return;

  const newColor = btn.dataset.color;
  card.dataset.selectedColor = newColor;
  card.querySelectorAll('.color-btn').forEach(b => b.classList.toggle('active', b.dataset.color === newColor));

  updateProductImages(card, newColor);

  const infoEl = card.querySelector('.product-info');
  const variations = JSON.parse(infoEl.dataset.variations.replace(/&#39;/g, "'"));
  const selectedSize = card.dataset.selectedSize || '';
  updateStockState(card, variations, selectedSize, newColor);
};

// Slides the image track to show the chosen image, and updates the
// active pagination dot.
window.setProductImage = function(event, index) {
  const wrap = event.target.closest('.product-image-wrap');
  if (!wrap || !wrap._goToIndex) return;
  wrap._goToIndex(index);
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

  // Determine which size + color combination is currently selected on this card
  const card = event && event.target ? event.target.closest('.product-card') : null;
  const selectedSize = card ? (card.dataset.selectedSize || '') : '';
  const selectedColor = card ? (card.dataset.selectedColor || '') : '';
  const variation = findVariation(product.variations, selectedSize, selectedColor);

  // Items are matched by product id AND chosen size/color, so different
  // combinations of the same product appear as separate cart entries.
  const existingItem = cart.find(item =>
    item.id === id &&
    (item.size || '') === (variation.size || '') &&
    (item.color || '') === (variation.color || '')
  );

  // Respect stock limits for this size/color combination
  if (isVariationTracked(variation)) {
    const currentQty = existingItem ? existingItem.quantity : 0;
    if (currentQty + 1 > Number(variation.stock)) {
      const details = [variation.size, variation.color].filter(Boolean).join(' ');
      alert(`Sorry, only ${variation.stock} of "${product.name}"${details ? ` (${details})` : ''} available.`);
      return;
    }
  }

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    // Store the effective (post-discount) price so cart totals/checkout
    // automatically reflect any discount applied at the time of adding.
    // Also store a single "image" (first of the product's images) and the
    // chosen size/color/measurement for use in the cart sidebar and cart page.
    cart.push({
      ...product,
      image: (product.images && product.images[0]) || '',
      price: getEffectivePrice(product),
      quantity: 1,
      size: variation.size || '',
      color: variation.color || '',
      measurement: product.measurement || ''
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
    container.innerHTML = `
      <div class="empty-cart-msg">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M7 7h14l-1.5 9h-11L7 7z"/>
          <path d="M3 3h2l.5 3"/>
        </svg>
        <p>Your cart is empty</p>
      </div>`;
    totalEl.textContent = '$0.00';
    return;
  }

  container.innerHTML = cart.map((item, index) => `
    <div class="cart-sidebar-item">
      <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/60x60/bfdbfe/1e40af?text=Cat'">
      <div class="item-details">
        <h4>${item.name}${[item.size, item.color].filter(Boolean).length ? ` <span class="item-size">(${[item.size, item.color].filter(Boolean).join(', ')})</span>` : ''}</h4>
        <p>$${item.price.toFixed(2)}</p>
        <div class="quantity-controls">
          <button onclick="changeQuantity(${index}, -1)">–</button>
          <span>${item.quantity}</span>
          <button onclick="changeQuantity(${index}, 1)">+</button>
        </div>
      </div>
      <button class="remove-btn" onclick="removeFromCart(${index})" aria-label="Remove item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          <path d="M10 11v6"/>
          <path d="M14 11v6"/>
          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
        </svg>
      </button>
    </div>
  `).join('');

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  totalEl.textContent = `$${total.toFixed(2)}`;
}

window.changeQuantity = function(index, change) {
  const item = cart[index];

  // When increasing quantity, respect stock limits for the chosen size/color
  if (change > 0) {
    const product = getAllProducts().find(p => p.id === item.id);
    const variation = product ? findVariation(product.variations, item.size, item.color) : {};
    if (isVariationTracked(variation) && item.quantity + change > Number(variation.stock)) {
      const details = [item.size, item.color].filter(Boolean).join(', ');
      alert(`Sorry, only ${variation.stock} of "${item.name}"${details ? ` (${details})` : ''} available.`);
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
    const details = [item.size, item.color].filter(Boolean).join(', ');
    const label = details ? `${item.name} (${details})` : item.name;
    message += `${label} × ${item.quantity} = $${(item.price * item.quantity).toFixed(2)}\n`;
  });
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  message += `\nTotal: $${total.toFixed(2)}\n\nPlease confirm my order!`;

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
