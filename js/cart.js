const SytamCart = {
  _items: [],

  init() {
    const stored = localStorage.getItem('sytam_cart');
    this._items = stored ? JSON.parse(stored) : [];
    // Clean invalid items
    this._items = this._items.filter(i => i.productName && typeof i.price === 'number');
    // Clean old variant labels (remove tissu, empty attrs)
    this._items.forEach(function(i) {
      if (i.variantLabel) {
        i.variantLabel = i.variantLabel.split(', ').filter(function(p) { return !p.startsWith('tissu:') && !p.endsWith(': '); }).join(', ');
      }
    });
    this._sort();
  },

  _sort() {
    this._items.sort((a, b) => a.addedAt - b.addedAt);
  },

  _save() {
    localStorage.setItem('sytam_cart', JSON.stringify(this._items));
    this._notify();
  },

  _notify() {
    document.dispatchEvent(new CustomEvent('cartupdate', { detail: this._items }));
  },

  getItems() { return [...this._items]; },

  getCount() {
    return this._items.reduce((sum, item) => sum + item.qty, 0);
  },

  getSubtotal() {
    return this._items.reduce((sum, item) => sum + item.price * item.qty, 0);
  },

  getDelivery() {
    return this.getSubtotal() >= 50000 ? 0 : 2000;
  },

  getTotal() {
    return this.getSubtotal() + this.getDelivery();
  },

  add(product, variant, qty = 1) {
    var maxStock = variant.stock || 0;
    if (maxStock === 0) { this._showError('Rupture de stock'); return; }
    var existing = this._items.find(function(i) { return i.productId === product.id && i.variantId === variant.id; });
    var currentQty = existing ? existing.qty : 0;
    if (currentQty + qty > maxStock) {
      this._showError('Stock disponible : ' + maxStock + ' seulement');
      return;
    }
    if (existing) {
      existing.qty += qty;
    } else {
      this._items.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
        productId: product.id,
        variantId: variant.id,
        productName: product.nom,
        variantLabel: this._variantLabel(variant),
        price: product.promo_pct ? Math.round(product.prix * (1 - product.promo_pct / 100)) : product.prix,
        image: product.images[0],
        qty,
        addedAt: Date.now(),
      });
    }
    if (typeof SytamAnalytics !== 'undefined') SytamAnalytics.trackAddToCart(product.id, product.nom);
    this._save();
    this._showNotification(product.nom);
  },

  updateQty(itemId, qty) {
    const item = this._items.find(i => i.id === itemId);
    if (!item) return;
    if (qty <= 0) {
      this.remove(itemId);
      return;
    }
    if (typeof SytamAnalytics !== 'undefined') SytamAnalytics.trackQtyChange(item.productId, item.productName, item.qty, qty);
    item.qty = qty;
    this._save();
  },

  remove(itemId) {
    var item = this._items.find(i => i.id === itemId);
    if (item && typeof SytamAnalytics !== 'undefined') SytamAnalytics.trackRemoveFromCart(item.productId, item.productName, item.variantLabel);
    this._items = this._items.filter(i => i.id !== itemId);
    this._save();
  },

  _showError(msg) {
    var el = document.createElement('div');
    el.className = 'cart-toast';
    el.innerHTML = '<span class="cart-toast-icon" style="background:var(--danger)">✕</span><span class="cart-toast-msg">' + msg + '</span>';
    document.body.appendChild(el);
    requestAnimationFrame(function() { el.classList.add('show'); });
    setTimeout(function() { el.classList.remove('show'); setTimeout(function() { el.remove(); }, 300); }, 3000);
  },

  clear() {
    this._items = [];
    this._save();
  },

  _variantLabel(variant) {
    const attrs = variant.attributs || {};
    return Object.entries(attrs)
      .filter(function(e) { return e[0] !== 'tissu' && e[1] && e[1].trim(); })
      .map(function(e) { return e[0] + ': ' + e[1]; })
      .join(', ');
  },

  _showNotification(productName) {
    const el = document.createElement('div');
    el.className = 'cart-toast';
    el.innerHTML = `
      <span class="cart-toast-icon">✓</span>
      <span class="cart-toast-msg">${productName} ajouté au panier</span>
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2500);
  },
};
