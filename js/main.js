(function () {
  DB.init();
  SytamCart.init();

  const state = {
    currentPage: 'home',
    selectedProduct: null,
    selectedVariant: null,
    selectedQty: 1,
    showingCart: false,
    currentFilters: { category: 'all', sort: 'newest' },
  };

  function $s(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$s(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

  function fmt(num) { return (num || 0).toLocaleString('fr-FR'); }

  function promoPriceHtml(p) {
    if (p.promo_pct) {
      var disc = Math.round(p.prix * (1 - p.promo_pct / 100));
      return '<span style="text-decoration:line-through;color:var(--text-lighter);font-size:.8rem">' + fmt(p.prix) + ' FCFA</span> <span style="color:var(--danger);font-weight:700">' + fmt(disc) + ' FCFA</span>';
    }
    return fmt(p.prix) + ' FCFA';
  }

  function getShopPhone() {
    var fromLS = localStorage.getItem('sytam_shop_phone');
    return fromLS || '+221 77 478 98 75';
  }

  // Normalise indifféremment un produit avec variantes (ancien) ou colors (nouveau)
  function getEffectiveVariants(p) {
    if (p.variantes && p.variantes.length) return p.variantes;
    if (p.colors && p.colors.length) {
      var effSizes = (p.sizes && p.sizes.length) ? p.sizes : null;
      if (!effSizes) {
        // Vérifier si au moins une couleur a un stock par taille
        var hasPerSizeStock = p.colors.some(function(c) { return c.stocks && Object.keys(c.stocks).length; });
        if (hasPerSizeStock) {
          var attrs = (typeof getVariantAttrs !== 'undefined') ? getVariantAttrs(p.categorie, p.sous_type) : ['couleur'];
          if (attrs.indexOf('taille') !== -1) effSizes = (typeof SIZES !== 'undefined') ? SIZES : ['S','M','L','XL'];
        }
      }
      if (effSizes && effSizes.length) {
        var result = [];
        p.colors.forEach(function(c) {
          effSizes.forEach(function(s) {
            var stock = (c.stocks && c.stocks[s] !== undefined) ? c.stocks[s] : (c.stock || 0);
            result.push({ id: 'c_' + c.name + '_' + s, attributs: { couleur: c.name, taille: s }, stock: stock });
          });
        });
        return result;
      }
      return p.colors.map(function(c) { return { id: 'c_' + c.name, attributs: { tissu: '', couleur: c.name, taille: '' }, stock: c.stock || 0 }; });
    }
    return [];
  }

  function init() {
    if (typeof SytamAnalytics !== 'undefined') SytamAnalytics.init();
    if (typeof AccountApp !== 'undefined') AccountApp.init();
    _renderFromData(SEED_PRODUCTS || []);
    var _doRender = function() {
      DB.onReady(function() {
        renderHome();
        renderShop();
        updateCartUI();
        bindEvents();
        navigate(window.location.hash.slice(1) || 'home');
        observeAnimations();
        _initHero();
        _startFeaturedScroll();
      });
    };
    var _waitSupabase = setInterval(function() {
      if (typeof SupabaseAPI !== 'undefined' && SupabaseApp && SupabaseApp.ready) {
        clearInterval(_waitSupabase);
        _periodicPull(_doRender);
      }
    }, 200);
    setTimeout(function() { clearInterval(_waitSupabase); _doRender(); }, 8000);
  }

  function _renderFromData(data) {
    var featured = data.filter(function(p) { return p.tag === 'nouveau' || p.en_avant; });
    var trending = data.filter(function(p) { return p.tag === 'tendance'; });
    if (!trending.length) trending = data.slice().sort(function() { return 0.5 - Math.random(); });
    var fEl = document.getElementById('featured-products');
    var tEl = document.getElementById('trending-products');
    if (fEl && featured.length) fEl.innerHTML = featured.map(function(p) { return productCard(p); }).join('');
    if (tEl && trending.length) tEl.innerHTML = trending.map(function(p) { return productCard(p); }).join('');
  }

  function observeAnimations(ctx) {
    ctx = ctx || document;
    if ('IntersectionObserver' in window) {
      if (!window._animObs) {
        window._animObs = new IntersectionObserver(function(entries) {
          entries.forEach(function(e) {
            if (e.isIntersecting) {
              e.target.classList.add('visible');
              window._animObs.unobserve(e.target);
            }
          });
        }, { threshold: 0.15 });
      }
      ctx.querySelectorAll('.animate-in, .animate-in-left, .animate-in-right, .stagger-children, .section').forEach(function(el) {
        if (!el.classList.contains('visible')) window._animObs.observe(el);
      });
    } else {
      ctx.querySelectorAll('.animate-in, .animate-in-left, .animate-in-right, .stagger-children, .section').forEach(function(el) { el.classList.add('visible'); });
    }
  }

  function navigateToCategory(catId) {
    state.currentFilters = { ...state.currentFilters, category: catId };
    navigate('shop');
  }

  function navigate(page) {
    state.currentPage = page;
    // Déverrouiller le compte si on quitte la page account
    if (page !== 'account' && page.indexOf('account-recover') !== 0 && typeof AccountApp !== 'undefined' && AccountApp._unlockForm) {
      AccountApp._unlockForm();
    }
    if (page === 'shop') renderShop();
    if (page.indexOf('account-recover') === 0 && typeof AccountApp !== 'undefined') {
      var parts = page.split('?'), params = {};
      if (parts[1]) {
        parts[1].replace(/([^=&]+)=([^&]*)/g, function(m, k, v) { params[decodeURIComponent(k)] = decodeURIComponent(v); });
      }
      var recoverToken = params.token || '';
      // Ne pas appeler renderAccount() ni changer le hash → déclencherait un second hashchange
      if (AccountApp.checkRecoveryToken) AccountApp.checkRecoveryToken(recoverToken);
      page = 'account';
    } else if (page === 'account' && typeof AccountApp !== 'undefined') {
      AccountApp.renderAccount();
    }
    $$s('.page').forEach(p => p.classList.remove('active'));
    const t = document.getElementById(`page-${page}`);
    if (t) t.classList.add('active');
    $$s('.nav a').forEach(l => l.classList.toggle('active', l.dataset.page === page));
    if (page === 'account' && !recoverToken) window.location.hash = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.classList.remove('cart-open', 'menu-open');
    state.showingCart = false;
  }

  // ---- ACCUEIL ----
  function renderHome() {
    renderFeatured();
    renderTrending();
  }

  function renderFeatured() {
    const el = document.getElementById('featured-products');
    if (!el) return;
    var products = DB.getNewProducts();
    // Fallback: si le tag n'existe pas dans les données stockées, utiliser le seed
    if (!products.length) {
      var all = DB.getAll();
      products = all.filter(function(p) { return (p.tag === 'nouveau') || p.en_avant; });
    }
    el.innerHTML = products.length ? products.map(function(p) { return productCard(p); }).join('') : '';
  }

  function renderTrending() {
    const el = document.getElementById('trending-products');
    if (!el) return;
    var products = DB.getTrendingProducts();
    if (!products.length) {
      var all = DB.getAll();
      products = all.filter(function(p) { return p.tag === 'tendance'; });
      if (!products.length) products = all.slice().sort(function() { return 0.5 - Math.random(); }).slice(0, 8);
    }
    el.innerHTML = products.length
      ? products.map(function(p) { return productCard(p); }).join('')
      : '';
  }

  function renderCatStrip() {
    const el = document.getElementById('shop-categories');
    if (!el) return;
    var _svg = function(t) { return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="#F5EFE8" rx="30"/><text x="30" y="33" font-family="Arial,sans-serif" font-size="16" fill="#B8956A" text-anchor="middle" dominant-baseline="middle">' + t.charAt(0).toUpperCase() + '</text></svg>'); };
    var imgs = { accessoires: 'images/produits/accessoires/bonnet1.jpeg', cardigan: _svg('Cardigan'), ensembles: 'images/produits/ensembles/ens_1.jpeg', pantalons: 'images/produits/pantalons/pant1.jpeg', robes: 'images/produits/robes/robe1.jpeg', sport: 'images/produits/sport/sport1.jpeg', voiles: 'images/produits/voiles/mousseline1.jpeg' };
    var products = DB.getAll();
    var cats = ['all'].concat(products.map(function(p) { return p.categorie; }).filter(function(v,i,a) { return v && a.indexOf(v) === i; }).sort());
    var cur = state.currentFilters.category;
    el.innerHTML = cats.map(function(c) {
      var label = c === 'all' ? 'Tous' : c;
      var img = c === 'all' ? '' : (imgs[c.toLowerCase()] || '');
      var imgHtml = c === 'all'
        ? '<span class="cat-chip-img" style="background:var(--bg-alt);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:var(--text-light)">✦</span>'
        : '<span class="cat-chip-img"><img src="' + img + '" alt="' + label + '" onerror="this.src=\'' + _svg(label) + '\'"></span>';
      return '<span class="cat-chip' + (cur === c ? ' active' : '') + '" data-cat="' + c + '">' + imgHtml + '<span>' + label + '</span></span>';
    }).join('');
  }

  // ---- BOUTIQUE ----
  function renderShop(filters) {
    if (filters) {
      if ('category' in filters) {
        state.currentFilters = { ...state.currentFilters, category: filters.category };
      }
      if ('sort' in filters) {
        state.currentFilters = { ...state.currentFilters, sort: filters.sort };
      }
    }
    renderCatStrip();
    const el = document.getElementById('shop-products');
    if (!el) return;

    let products = DB.getAll();
    const cat = state.currentFilters.category;

    if (cat && cat !== 'all') {
      products = products.filter(p => p.categorie === cat);
    }

    const sort = state.currentFilters.sort || 'newest';
    function effectivePrice(p) { return p.promo_pct ? Math.round(p.prix * (1 - p.promo_pct / 100)) : p.prix; }
    if (sort === 'newest') products.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sort === 'price_asc') products.sort((a, b) => effectivePrice(a) - effectivePrice(b));
    else if (sort === 'price_desc') products.sort((a, b) => effectivePrice(b) - effectivePrice(a));

    el.innerHTML = products.length
      ? products.map(p => productCard(p)).join('')
      : '<div class="no-products">Aucun produit trouvé</div>';
  }

  function productCard(p) {
    const vs = getEffectiveVariants(p);
    const totalS = vs.reduce(function(s, v) { return s + (v.stock || 0); }, 0);
    const img = p.images[0];
    var inWish = (typeof AccountApp !== 'undefined' && AccountApp.isLoggedIn()) ? AccountApp.isInWishlist(p.id) : false;
    var placeholdersvg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#F5EFE8"/><text x="200" y="250" font-family="Arial,sans-serif" font-size="16" fill="#B8956A" text-anchor="middle" dominant-baseline="middle">' + p.nom + '</text></svg>');
    return `
      <div class="product-card" onclick="SytamApp.quickView('${p.id}')">
        <div class="product-card-img">
          <img src="${img}" alt="${p.nom}" onerror="this.src='${placeholdersvg}'">
          <button class="wishlist-heart${inWish ? ' active' : ''}" onclick="event.stopPropagation();if(!AccountApp.isLoggedIn()){SytamApp.navigate('account')}else{AccountApp.toggleWishlist('${p.id}');this.classList.toggle('active');this.textContent=this.classList.contains('active')?'♥':'♡'}">${inWish ? '♥' : '♡'}</button>
          ${p.promo_pct ? '<span class="badge" style="background:var(--danger)">-' + p.promo_pct + '%</span>' : ''}
          ${p.tag === 'nouveau' ? '<span class="badge">Nouveau</span>' : ''}
          ${p.tag === 'tendance' ? '<span class="badge" style="background:var(--gold);color:#fff">Populaire</span>' : ''}
          ${totalS === 0 ? '<span class="badge badge-warn">Épuisé</span>' : ''}
        </div>
        <div class="product-card-body">
          <h3>${p.nom}</h3>
          <p class="product-meta">${p.categorie} — ${p.sous_type}</p>
          <p class="product-price">${promoPriceHtml(p)}</p>
          ${totalS > 0 ? `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();SytamApp.quickView('${p.id}')">Ajouter</button>` : ''}
        </div>
      </div>
    `;
  }

  // ---- MODALE PRODUIT ----
  function quickView(id) {
    document.body.classList.remove('menu-open');
    state.selectedProduct = DB.getById(id);
    if (!state.selectedProduct) return;
    if (typeof SytamAnalytics !== 'undefined') SytamAnalytics.trackProductClick(id, state.selectedProduct.nom, state.selectedVariant ? state.selectedVariant.name : '');
    state.selectedVariant = null;
    state.selectedQty = 1;
    renderModal(state.selectedProduct);
    // Force layout calculation before showing
    document.body.offsetHeight;
    document.getElementById('product-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeQuickView() {
    document.getElementById('product-modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderModal(p) {
    const attrs = getVariantAttrs(p.categorie, p.sous_type);
    const hasTissu = attrs.includes('tissu');
    const hasCouleur = attrs.includes('couleur');
    const hasTaille = attrs.includes('taille');

    var effectiveVariants = getEffectiveVariants(p);
    var tissus = [...new Set(effectiveVariants.map(function(v) { return v.attributs.tissu; }).filter(Boolean))];
    var couleurs = [...new Set(effectiveVariants.map(function(v) { return v.attributs.couleur; }).filter(Boolean))];
    var tailles = [...new Set(effectiveVariants.map(function(v) { return v.attributs.taille; }).filter(Boolean))];

    if (!state.selectedVariant) {
      state.selectedVariant = effectiveVariants[0] || null;
    }

    // Build hex map from saved colors first, fallback to COLOR_HEX_MAP
    var savedHexMap = {};
    if (p.colors && p.colors.length) {
      p.colors.forEach(function(c) { savedHexMap[c.name] = c.hex; });
    }
    var hexFn = function(c) { return savedHexMap[c] || (typeof COLOR_HEX_MAP !== 'undefined' ? COLOR_HEX_MAP[c] : null) || getColorHex(c); };

    let html = '';
    if (hasTissu) {
      html += `<div class="option-group" data-attr="tissu"><label>Tissu</label><div class="option-choices">`;
      html += tissus.map(t => `
        <button class="option-btn ${state.selectedVariant && state.selectedVariant.attributs && state.selectedVariant.attributs.tissu === t ? 'active' : ''}" data-value="${t}" onclick="SytamApp.selectVariantAttr('tissu','${t}')">${t}</button>
      `).join('');
      html += `</div></div>`;
    }
    if (hasCouleur && couleurs.length) {
      html += `<div class="option-group" data-attr="couleur"><label>Couleur</label><div class="option-choices color-swatches">`;
      html += couleurs.map(c => `
        <button class="color-btn ${state.selectedVariant && state.selectedVariant.attributs && state.selectedVariant.attributs.couleur === c ? 'active' : ''}" data-value="${c}" style="background:${hexFn(c)}" onclick="SytamApp.selectVariantAttr('couleur','${c}')" title="${c}"></button>
      `).join('');
      html += `</div></div>`;
    }
    if (hasTaille && tailles.length) {
      html += `<div class="option-group" data-attr="taille"><label>Taille</label><div class="option-choices">`;
      html += tailles.map(s => `
        <button class="option-btn ${state.selectedVariant && state.selectedVariant.attributs && state.selectedVariant.attributs.taille === s ? 'active' : ''}" data-value="${s}" onclick="SytamApp.selectVariantAttr('taille','${s}')">${s}</button>
      `).join('');
      html += `</div></div>`;
      html += `<div style="margin-top:4px;text-align:right"><button class="btn-link" onclick="SytamApp.openSizeGuide()" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:.75rem;text-decoration:underline;opacity:.7">📏 Guide des tailles</button></div>`;
    }

    const stock = (state.selectedVariant && state.selectedVariant.stock) || 0;
    const price = p.prix;
    const img = p.images[0];
    var thumbsHtml = p.images && p.images.length > 1 ? '<div class="modal-thumbs">' + p.images.map(function(src, i) { return '<img src="' + src + '" class="' + (i === 0 ? 'active' : '') + '" onclick="SytamApp.switchImage(' + i + ')" onerror="this.remove()">'; }).join('') + '</div>' : '';

    document.getElementById('product-modal').innerHTML = `
      <div class="modal-overlay" onclick="SytamApp.closeQuickView()"></div>
      <div class="modal-content">
        <button class="modal-close" onclick="SytamApp.closeQuickView()">✕</button>
        <div class="modal-grid">
          <div class="modal-gallery" id="modal-gallery-wrap">
            <img src="${img}" alt="${p.nom}" class="modal-main-img" id="modal-main-img">
            ${thumbsHtml}
          </div>
          <div class="modal-info">
            <span class="modal-cat-badge">${p.categorie}</span>
            <h2>${p.nom}</h2>
            ${typeof AccountApp !== 'undefined' ? '<button class="modal-wishlist-heart" onclick="if(!AccountApp.isLoggedIn()){SytamApp.navigate(\'account\')}else{AccountApp.toggleWishlist(\'' + p.id + '\');var i=AccountApp.isInWishlist(\'' + p.id + '\');if(i){this.classList.add(\'active\');this.textContent=\'\u2665\'}else{this.classList.remove(\'active\');this.textContent=\'\u2661\'}}">' + (typeof AccountApp !== 'undefined' && AccountApp.isLoggedIn() && AccountApp.isInWishlist(p.id) ? '\u2665' : '\u2661') + '</button>' : ''}
            <p class="modal-price">${promoPriceHtml(p)}</p>
            <div class="modal-desc">${p.description}</div>
            ${html}
            <div class="qty-selector">
              <label>Quantité</label>
              <div class="qty-controls">
                <button onclick="SytamApp.changeQty(-1)">−</button>
                <span id="modal-qty">${state.selectedQty}</span>
                <button onclick="SytamApp.changeQty(1)">+</button>
              </div>
            </div>
            ${stock > 0
              ? `<button class="btn btn-primary btn-block" onclick="SytamApp.addFromModal()">Ajouter au panier</button>`
              : `<button class="btn btn-dark btn-block" disabled>Rupture de stock</button>`
            }
            <p class="stock-info">${stock > 0 ? '✓ Disponible' : 'Indisponible'}</p>
          </div>
        </div>
      </div>
    `;
  }

  function selectVariantAttr(attr, value) {
    const p = state.selectedProduct;
    if (!p) return;
    const target = {};
    if (state.selectedVariant) Object.assign(target, state.selectedVariant.attributs);
    target[attr] = value;
    var found = getEffectiveVariants(p).find(function(v) {
      return Object.keys(target).every(function(k) { return v.attributs[k] === target[k]; });
    });
    state.selectedVariant = found || null;

    // Update active buttons without re-rendering
    const modal = document.getElementById('product-modal');
    const group = modal.querySelector(`.option-group[data-attr="${attr}"]`);
    if (group) {
      group.querySelectorAll('.option-btn, .color-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.value === value);
      });
    }

    // Swap main image when a color is selected
    if (attr === 'couleur' && p.colors && p.colors.length) {
      var colorImg = '';
      for (var ci = 0; ci < p.colors.length; ci++) {
        if (p.colors[ci].name === value) {
          colorImg = p.colors[ci].image || (p.images && p.images[ci]) || '';
          break;
        }
      }
      var mainImg = document.getElementById('modal-main-img');
      if (mainImg) {
        if (colorImg) {
          mainImg.dataset.origSrc = mainImg.dataset.origSrc || mainImg.src;
          mainImg.src = colorImg;
        } else if (mainImg.dataset.origSrc) {
          mainImg.src = mainImg.dataset.origSrc;
        }
        // Mettre à jour la vignette active
        document.querySelectorAll('.modal-thumbs img').forEach(function(t, i) {
          var thumbs = window._modalImages || [];
          t.classList.toggle('active', thumbs[i] === mainImg.src);
        });
      }
    }
    const stock = (state.selectedVariant && state.selectedVariant.stock) || 0;
    const stockInfo = modal.querySelector('.stock-info');
    if (stockInfo) stockInfo.textContent = stock > 0 ? '✓ Disponible' : 'Indisponible';
    const btn = modal.querySelector('.btn-block');
    if (btn) {
      if (stock > 0) {
        btn.textContent = 'Ajouter au panier';
        btn.disabled = false;
        btn.className = 'btn btn-primary btn-block';
        btn.onclick = function () { SytamApp.addFromModal(); };
      } else {
        btn.textContent = 'Rupture de stock';
        btn.disabled = true;
        btn.className = 'btn btn-dark btn-block';
        btn.onclick = null;
      }
    }
  }

  function getSizeGuide() {
    var stored = localStorage.getItem('sytam_size_guide');
    if (stored) { try { return JSON.parse(stored); } catch(e) {} }
    return {};
  }
  function getProductMeasurements(p, size) {
    if (p && p.mesures && p.mesures[size]) return p.mesures[size];
    return null;
  }
  function getCategoryGuide(p) {
    var guide = getSizeGuide();
    if (!p) return guide;
    var catKey = p.categorie ? p.categorie.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g,'') : '';
    return guide[catKey];
  }
  function openSizeGuide() {
    var p = state.selectedProduct;
    if (!p) return;
    var sizes = ['S','M','L','XL'];
    var selSize = state.selectedVariant && state.selectedVariant.attributs && state.selectedVariant.attributs.taille ? state.selectedVariant.attributs.taille : '';
    // Check if product has its own measurements
    var hasProdMesures = p.mesures && p.mesures.fields && p.mesures.fields.length && sizes.some(function(s) { return p.mesures[s]; });
    if (hasProdMesures) {
      var fields = p.mesures.fields;
      var html = '<h3 style="margin-top:0">Guide des tailles — ' + p.nom + '</h3>';
      html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.85rem"><thead><tr>';
      html += '<th style="text-align:left;padding:8px 12px;border:1px solid var(--border);background:var(--bg2)">Taille</th>';
      fields.forEach(function(f) {
        html += '<th style="padding:8px 12px;border:1px solid var(--border);background:var(--bg2);text-align:center">' + f + '</th>';
      });
      html += '</tr></thead><tbody>';
      sizes.forEach(function(s) {
        var mesures = p.mesures[s];
        if (mesures && Array.isArray(mesures)) {
          html += '<tr' + (s === selSize ? ' style="background:var(--bg2);font-weight:600"' : '') + '>';
          html += '<td style="padding:8px 12px;border:1px solid var(--border);font-weight:600;text-align:center' + (s === selSize ? ';background:var(--primary);color:#fff' : '') + '">' + s + '</td>';
          fields.forEach(function(f, fi) {
            var val = mesures[fi] || '-';
            html += '<td style="padding:8px 12px;border:1px solid var(--border);text-align:center' + (s === selSize ? ';background:var(--bg2)' : '') + '">' + val + '</td>';
          });
          html += '</tr>';
        }
      });
      html += '</tbody></table></div>';
      html += '<p style="margin:12px 0 0;font-size:.75rem;color:var(--tl)">* Mesures approximatives.</p>';
      var el = document.getElementById('sizeguide-content');
      if (el) { el.innerHTML = html; }
      var modal = document.getElementById('sizeguide-modal');
      if (modal) { modal.classList.add('open'); }
      return;
    }
    // Fallback to category guide
    var catG = getCategoryGuide(p);
    if (!catG) { catG = { label: p.categorie, fields: ['Mesures'], S: ['-'], M: ['-'], L: ['-'], XL: ['-'] }; }
    var html = '<h3 style="margin-top:0">Guide des tailles — ' + catG.label + '</h3>';
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.85rem"><thead><tr>';
    html += '<th style="text-align:left;padding:8px 12px;border:1px solid var(--border);background:var(--bg2)">Mesure</th>';
    sizes.forEach(function(s) {
      html += '<th style="padding:8px 12px;border:1px solid var(--border);background:var(--bg2);text-align:center' + (s === selSize ? ';background:var(--primary);color:#fff' : '') + '">' + s + (s === selSize ? ' ✓' : '') + '</th>';
    });
    html += '</tr></thead><tbody>';
    (catG.fields || []).forEach(function(f, fi) {
      html += '<tr>';
      html += '<td style="padding:8px 12px;border:1px solid var(--border);font-weight:500">' + f + '</td>';
      sizes.forEach(function(s) {
        var val = (catG[s] && catG[s][fi]) || '-';
        html += '<td style="padding:8px 12px;border:1px solid var(--border);text-align:center' + (s === selSize ? ';background:var(--bg2);font-weight:600' : '') + '">' + val + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<p style="margin:12px 0 0;font-size:.75rem;color:var(--tl)">* Mesures approximatives. Le guide peut varier selon le modèle.</p>';
    var el = document.getElementById('sizeguide-content');
    if (el) { el.innerHTML = html; }
    var modal = document.getElementById('sizeguide-modal');
    if (modal) { modal.classList.add('open'); }
  }
  function closeSizeGuide() {
    var modal = document.getElementById('sizeguide-modal');
    if (modal) { modal.classList.remove('open'); }
  }
  function openGeneralSizeGuide() {
    var guide = getSizeGuide();
    var cats = Object.keys(guide);
    var html = '<h3 style="margin-top:0">Guide des tailles</h3>';
    html += '<p style="font-size:.85rem;color:var(--tl);margin-bottom:12px">Sélectionnez une catégorie pour voir les mesures :</p>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">';
    cats.forEach(function(cat) {
      html += '<button class="btn btn-sm btn-outline" onclick="SytamApp.showSizeGuideCategory(\'' + cat + '\')" style="font-size:.8rem">' + (guide[cat].label || cat) + '</button>';
    });
    html += '</div>';
    html += '<div id="sizeguide-cat-detail"></div>';
    var el = document.getElementById('sizeguide-content');
    if (el) { el.innerHTML = html; }
    var modal = document.getElementById('sizeguide-modal');
    if (modal) { modal.classList.add('open'); }
    // Show first category by default
    if (cats.length) { showSizeGuideCategory(cats[0]); }
  }
  function showSizeGuideCategory(catKey) {
    var guide = getSizeGuide();
    var g = guide[catKey];
    if (!g) return;
    var sizes = ['S','M','L','XL'];
    var html = '<h4 style="margin:0 0 8px">' + g.label + '</h4>';
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.85rem"><thead><tr>';
    html += '<th style="text-align:left;padding:8px 12px;border:1px solid var(--border);background:var(--bg2)">Mesure</th>';
    sizes.forEach(function(s) {
      html += '<th style="padding:8px 12px;border:1px solid var(--border);background:var(--bg2);text-align:center">' + s + '</th>';
    });
    html += '</tr></thead><tbody>';
    (g.fields || []).forEach(function(f, fi) {
      html += '<tr>';
      html += '<td style="padding:8px 12px;border:1px solid var(--border);font-weight:500">' + f + '</td>';
      sizes.forEach(function(s) {
        var val = (g[s] && g[s][fi]) || '-';
        html += '<td style="padding:8px 12px;border:1px solid var(--border);text-align:center">' + val + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<p style="margin:12px 0 0;font-size:.75rem;color:var(--tl)">* Mesures approximatives. Le guide peut varier selon le modèle.</p>';
    var el = document.getElementById('sizeguide-cat-detail');
    if (el) { el.innerHTML = html; }
  }
  function changeQty(delta) {
    state.selectedQty = Math.max(1, state.selectedQty + delta);
    const el = document.getElementById('modal-qty');
    if (el) el.textContent = state.selectedQty;
  }

  function addFromModal() {
    if (!state.selectedVariant) return;
    SytamCart.add(state.selectedProduct, state.selectedVariant, state.selectedQty);
    closeQuickView();
  }

  // ---- PANIER ----
  function toggleCart() {
    state.showingCart = !state.showingCart;
    document.body.classList.remove('menu-open');
    if (state.showingCart) {
      renderCart();
      requestAnimationFrame(function() {
        document.body.classList.add('cart-open');
      });
    } else {
      document.body.classList.remove('cart-open');
    }
  }

  function toggleMenu() {
    document.body.classList.toggle('menu-open');
    if (document.body.classList.contains('menu-open')) state.showingCart = false;
    document.body.classList.remove('cart-open');
  }

  function renderCart() {
    const items = SytamCart.getItems();
    const subtotal = SytamCart.getSubtotal();
    const delivery = SytamCart.getDelivery();
    const total = SytamCart.getTotal();
    const count = SytamCart.getCount();

    const itemsEl = document.getElementById('cart-items');
    const summaryEl = document.getElementById('cart-summary');
    const header = document.querySelector('.cart-header h3');
    const emptyEl = document.querySelector('.cart-empty');

    if (header) header.textContent = `Mon Panier (${count})`;

    if (items.length === 0) {
      if (itemsEl) itemsEl.innerHTML = '';
      if (summaryEl) summaryEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (itemsEl) itemsEl.innerHTML = items.map(item => `
      <div class="cart-item">
        <img src="${item.image}" alt="" class="cart-item-img">
        <div class="cart-item-info">
          <h4>${item.productName}</h4>
          <p class="cart-item-variant">${item.variantLabel}</p>
          <p class="cart-item-price">${fmt(item.price)} FCFA</p>
        </div>
        <div class="cart-item-qty">
          <button onclick="SytamApp.cartQty('${item.id}',${item.qty-1})">−</button>
          <span>${item.qty}</span>
          <button onclick="SytamApp.cartQty('${item.id}',${item.qty+1})">+</button>
        </div>
        <button class="cart-item-remove" onclick="SytamApp.cartRemove('${item.id}')">✕</button>
      </div>
    `).join('');

    if (summaryEl) summaryEl.innerHTML = `
      <div class="cart-summary-row"><span>Sous-total</span><span>${fmt(subtotal)} FCFA</span></div>
      <div class="cart-summary-row"><span>Livraison</span><span>${delivery === 0 ? 'Offerter' : fmt(delivery) + ' FCFA'}</span></div>
      <div class="cart-summary-row total"><span>Total</span><span>${fmt(total)} FCFA</span></div>
      <button class="btn btn-primary btn-block" onclick="SytamApp.showCheckout()">Commander</button>
      <button class="btn btn-outline btn-block" onclick="SytamApp.toggleCart()">Continuer</button>
    `;
  }

  function cartQty(id, qty) { SytamCart.updateQty(id, qty); renderCart(); }
  function cartRemove(id) { SytamCart.remove(id); renderCart(); }

  function updateCartUI() {
    const count = SytamCart.getCount();
    const badge = document.getElementById('cart-count');
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }
  }

  // ---- CHECKOUT ----
  function showCheckout() {
    if (typeof SytamAnalytics !== 'undefined') SytamAnalytics.trackCheckout();
    state.showingCart = false;
    document.body.classList.remove('cart-open');
    renderCheckoutSummary();
    document.getElementById('checkout-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Pre-fill from account if logged in
    if (typeof AccountApp !== 'undefined' && AccountApp.isLoggedIn()) {
      _prefillCheckout();
    }
    setTimeout(function() {
      var cc = document.querySelector('.checkout-content');
      if (cc) cc.scrollTop = cc.scrollHeight;
    }, 400);
    document.querySelectorAll('.checkout-content input, .checkout-content select, .checkout-content textarea').forEach(function(el) {
      el.addEventListener('focus', function() { this.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
    });
  }

  function _prefillCheckout() {
    var addr = AccountApp.getDefaultAddress();
    if (!addr) return;
    var nameInput = document.querySelector('#checkout-form [name="name"]');
    var phoneInput = document.querySelector('#checkout-form [name="phone"]');
    var regionInput = document.getElementById('region-input');
    var regionTrigger = document.querySelector('#region-trigger span');
    var quartierTrigger = document.querySelector('#quartier-trigger span');
    var quartierHidden = document.querySelector('#checkout-form [name="address"]');
    var addrDetail = document.getElementById('address-detail-input');
    if (nameInput && addr.name) nameInput.value = addr.name;
    if (phoneInput && addr.phone) phoneInput.value = addr.phone;
    if (regionInput && addr.region) {
      regionInput.value = addr.region;
      if (regionTrigger) regionTrigger.textContent = addr.region;
      if (typeof handleRegionChange === 'function') handleRegionChange(addr.region);
    }
    if (quartierTrigger && addr.quartier) {
      quartierTrigger.textContent = addr.quartier;
      if (quartierHidden) quartierHidden.value = addr.quartier;
    }
    if (addrDetail && addr.address_detail) addrDetail.value = addr.address_detail;
    renderCheckoutSummary();
  }

  function _neighborhoodZone() {
    var regionInput = document.getElementById('region-input');
    if (regionInput && regionInput.value !== 'Dakar') return 'regions';
    var trigger = document.getElementById('quartier-trigger');
    if (!trigger) return 'dakar_centre';
    var val = (trigger.querySelector('span').textContent || '').toLowerCase();
    if (!val || val === 'sélectionnez' || val === 'non applicable hors dakar') return 'dakar_centre';
    var banlieue = ['parcelles','grand yoff','guediawaye','pikine','thiaroye','yeumbeul','diamaguène','dalifort','mbao','keur massar','malika'];
    var regions = ['rufisque','bargny','sébikotane','diamniadio','sangalkam'];
    for (var i = 0; i < banlieue.length; i++) { if (val.indexOf(banlieue[i]) !== -1) return 'dakar_banlieue'; }
    for (var i = 0; i < regions.length; i++) { if (val.indexOf(regions[i]) !== -1) return 'regions'; }
    for (var i = 0; i < NEIGHBORHOODS.length; i++) {
      if (NEIGHBORHOODS[i].nom.toLowerCase() === val) return NEIGHBORHOODS[i].zone;
    }
    return 'dakar_centre';
  }

  function renderCheckoutSummary() {
    var el = document.getElementById('checkout-summary');
    if (!el) return;
    var items = SytamCart.getItems();
    if (items.length === 0) { el.innerHTML = ''; return; }
    var subtotal = SytamCart.getSubtotal();
    var zoneKey = _neighborhoodZone();
    var zone = DELIVERY_ZONES[zoneKey] || DELIVERY_ZONES.dakar_centre;
    var delivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : zone.tarif;
    var discount = _appliedPromo ? Math.round(subtotal * _appliedPromo.reduction / 100) : 0;
    var total = Math.max(0, subtotal - discount) + delivery;
    var itemsHtml = items.map(function(i) {
      var label = i.productName;
      if (i.variantLabel) label += ' — ' + i.variantLabel;
      return '<div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:2px;gap:6px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + label + ' <span style="color:var(--text-light)">x' + i.qty + '</span></span><span style="white-space:nowrap;flex-shrink:0">' + fmt(i.price * i.qty) + ' FCFA</span></div>';
    }).join('');
    el.innerHTML =
      '<div style="max-height:200px;overflow-y:auto;scrollbar-width:thin;margin-bottom:6px">' + itemsHtml + '</div>' +
      '<div class="cart-summary-row"><span>Sous-total</span><span>' + fmt(subtotal) + ' FCFA</span></div>' +
      '<div class="cart-summary-row"><span>Livraison</span><span>' + (delivery === 0 ? 'Offerte' : fmt(delivery) + ' FCFA') + '</span></div>' +
      (discount > 0 ? '<div class="cart-summary-row" style="color:var(--ok)"><span>Réduction (' + _appliedPromo.code + ')</span><span>-' + fmt(discount) + ' FCFA</span></div>' : '') +
      '<div class="cart-summary-row total"><span>Total</span><span>' + fmt(total) + ' FCFA</span></div>';
  }

  function closeCheckout() {
    document.getElementById('checkout-modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  var _appliedPromo = null;

  function applyPromo(btn) {
    var input = btn.parentElement.querySelector('[name="promo"]');
    var msg = document.getElementById('promo-msg');
    if (!input || !msg) return;
    var code = input.value.trim().toUpperCase();
    if (!code) { msg.textContent = 'Entre un code de parrainage'; msg.style.color = 'var(--er)'; return; }
    var refs = JSON.parse(localStorage.getItem('sytam_referrals') || '[]');
    var found = null;
    for (var i = 0; i < refs.length; i++) {
      if (refs[i].code === code) { found = refs[i]; break; }
    }
    if (!found && typeof SupabaseAPI !== 'undefined' && SupabaseApp.ready) {
      SupabaseAPI.get('store_data?key=eq.sytam_referrals&select=value').then(function(result) {
        try {
          if (result && result.length && result[0] && Array.isArray(result[0].value)) {
            var remoteRefs = result[0].value;
            var merged = JSON.parse(localStorage.getItem('sytam_referrals') || '[]');
            var seen = {};
            remoteRefs.forEach(function(r) { if (r && r.id) seen[r.id] = r; });
            merged.forEach(function(r) { if (r && r.id && !seen[r.id]) seen[r.id] = r; });
            var all = Object.values(seen);
            localStorage.setItem('sytam_referrals', JSON.stringify(all));
            for (var j = 0; j < all.length; j++) {
              if (all[j].code === code) { found = all[j]; break; }
            }
            if (found) {
              _appliedPromo = found;
              msg.textContent = '✓ Code ' + code + ' : -' + found.reduction + '%';
              msg.style.color = 'var(--ok)';
              renderCheckoutSummary();
            } else {
              msg.textContent = 'Code de parrainage invalide';
              msg.style.color = 'var(--er)';
            }
          } else {
            msg.textContent = 'Code de parrainage invalide';
            msg.style.color = 'var(--er)';
          }
        } catch(e) {
          msg.textContent = 'Code de parrainage invalide';
          msg.style.color = 'var(--er)';
        }
      }).catch(function() {
        msg.textContent = 'Code de parrainage invalide';
        msg.style.color = 'var(--er)';
      });
      return;
    }
    if (!found) { msg.textContent = 'Code de parrainage invalide'; msg.style.color = 'var(--er)'; return; }
    _appliedPromo = found;
    msg.textContent = '✓ Code ' + code + ' : -' + found.reduction + '%';
    msg.style.color = 'var(--ok)';
    renderCheckoutSummary();
  }

  var _submitting = false;
  function submitOrder(formData) {
    if (_submitting) return;
    _submitting = true;
    var items = SytamCart.getItems();
    if (items.length === 0) { _submitting = false; return; }

    try {
      var zone = DELIVERY_ZONES[_neighborhoodZone()] || DELIVERY_ZONES.dakar_centre;
      var subtotal = SytamCart.getSubtotal();
      var delivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : zone.tarif;

      // Apply promo discount
      var discount = 0;
      var promoCode = '';
      var promoLabel = '';
      if (_appliedPromo) {
        discount = Math.round(subtotal * _appliedPromo.reduction / 100);
        promoCode = _appliedPromo.code;
        promoLabel = _appliedPromo.code + ' (-' + _appliedPromo.reduction + '%)';
        var refs = JSON.parse(localStorage.getItem('sytam_referrals') || '[]');
        for (var ri = 0; ri < refs.length; ri++) {
          if (refs[ri].code === _appliedPromo.code) {
            refs[ri].used = (refs[ri].used || 0) + 1;
            break;
          }
        }
        localStorage.setItem('sytam_referrals', JSON.stringify(refs));
      }

      var total = Math.max(0, subtotal - discount) + delivery;

      var quartier = formData.region === 'Dakar' ? formData.address : '';
      var order = {
        id: 'CMD' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
        client: formData.name,
        telephone: formData.phone,
        adresse: formData.address + (formData.address_detail ? ', ' + formData.address_detail : '') + (formData.region ? ' (' + formData.region + ')' : ''),
        quartier: quartier,
        region: formData.region || '',
        zone_livraison: _neighborhoodZone(),
        frais_livraison: delivery,
        mode_paiement: formData.payment,
        notes: formData.notes,
        promo: promoLabel || '',
        reduction: discount,
        items: items.map(function (i) {
          var _c = '';
          if (i.variantLabel) {
            var _parts = i.variantLabel.split(',').map(function(s) { return s.trim(); });
            _parts.forEach(function(p) {
              if (p.indexOf('Couleur:') === 0 || p.indexOf('couleur:') === 0) _c = p.split(':')[1].trim();
            });
          }
          return { nom: i.productName, variantLabel: i.variantLabel, prix: i.price, qte: i.qty, productId: i.productId, couleur: _c };
        }),
        total: total,
        statut: 'en_attente',
        created_at: new Date().toISOString(),
        mis_a_jour: new Date().toISOString(),
      };

      // Sauvegarder la commande : localStorage immédiatement, puis Supabase en tâche de fond
      var orders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
      orders.unshift(order);
      localStorage.setItem('sytam_orders_v2', JSON.stringify(orders));
      var _pushAttempts = 0;
      function _tryPush() {
        if (_pushAttempts >= 20) return;
        _pushAttempts++;
        if (typeof SupabaseAPI === 'undefined' || !SupabaseApp.ready) {
          setTimeout(_tryPush, 3000);
          return;
        }
        SupabaseAPI.upsert('store_data', { key: 'sytam_orders_v2', value: orders })
          .then(function(r) {
            if (!(r && r.ok) && _pushAttempts < 5) {
              setTimeout(_tryPush, 3000);
            }
          })
          .catch(function() {
            if (_pushAttempts < 5) setTimeout(_tryPush, 3000);
          });
      }
      _tryPush();
      // Notifier via ntfy
      sendNtfyNotification(order);

      // Loyalty: track orders count + total per phone
      var cleanPhone = (formData.phone || '').replace(/[^0-9]/g, '');
      if (cleanPhone.length >= 6) {
        var loyalty = JSON.parse(localStorage.getItem('sytam_loyalty_v2') || '{}');
        if (!loyalty[cleanPhone]) loyalty[cleanPhone] = { orders: 0, total: 0 };
        loyalty[cleanPhone].orders = (loyalty[cleanPhone].orders || 0) + 1;
        loyalty[cleanPhone].total = (loyalty[cleanPhone].total || 0) + total;
        localStorage.setItem('sytam_loyalty_v2', JSON.stringify(loyalty));
      }

      SytamCart.clear();
      closeCheckout();
      document.getElementById('order-ref').textContent = order.id;
      var ref2 = document.getElementById('order-ref2');
      if (ref2) ref2.textContent = order.id;

      document.getElementById('order-success').classList.add('open');
      // Set WhatsApp link with order details
      var waLink = document.getElementById('whatsapp-link');
      if (waLink) {
        var shopPhone = localStorage.getItem('sytam_shop_phone') || '+221 77 478 98 75';
        var cleanPhone = shopPhone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('221')) cleanPhone = cleanPhone.slice(3);
        var waMsg = encodeURIComponent('Bonjour ! Je viens de passer commande (#' + order.id + ') et je souhaite confirmer mon paiement.');
        waLink.href = 'https://wa.me/221' + cleanPhone + '?text=' + waMsg;
      }
    } catch(e) {
      console.warn('submitOrder error:', e);
    } finally {
      _submitting = false;
    }
  }

  function closeOrderSuccess() {
    document.getElementById('order-success').classList.remove('open');
    toggleCart();
    // Réactiver le bouton de commande
    var _btn = document.getElementById('checkout-btn');
    if (_btn) { _btn.disabled = false; _btn.textContent = 'Confirmer la commande'; }
  }

  // ---- COULEURS ----
  function getColorHex(c) {
    const map = {
      'Noir':'#1a1a1a','Blanc':'#ffffff','Beige':'#f5e6d3','Nude':'#e8c9b0',
      'Marron':'#5c3a21','Caramel':'#c48a5c','Vert Sauge':'#8ba888','Vert Olive':'#6b7b4f',
      'Rose Poudré':'#e8b4b8','Rose':'#e8b4b8','Bleu Ciel':'#87ceeb','Bleu Marine':'#1a2d4a',
      'Bordeaux':'#6b2d3a','Gris':'#8a8a8a','Mauve':'#8a6b8a','Vert Emeraude':'#2d6b4f',
      'Doré':'#c9a96e','Argenté':'#b0b0b0',
    };
    return map[c] || '#ccc';
  }

  // ---- EVENTS ----
  function bindEvents() {
    document.addEventListener('cartupdate', updateCartUI);
    document.addEventListener('click', e => {
      const m = document.getElementById('checkout-modal');
      if (e.target === m) closeCheckout();
    });

    document.addEventListener('click', function(e) {
      var chip = e.target.closest('.cat-chip');
      if (chip && chip.dataset.cat) {
        e.preventDefault();
        renderShop({ category: chip.dataset.cat });
      }
    });
    // quartier + region picker
    document.addEventListener('click', function(e) {
      var qTrig = e.target.closest('[data-picker="quartier"]');
      var rTrig = e.target.closest('[data-picker="region"]');
      if (qTrig) {
        DrumPicker.open({
          items: QUARTIERS,
          title: 'Choisir un quartier',
          onConfirm: function(v) {
            qTrig.querySelector('span').textContent = v;
            document.querySelector('[name="address"]').value = v;
            if (window.SytamApp && SytamApp.renderCheckoutSummary) SytamApp.renderCheckoutSummary();
          }
        });
      } else if (rTrig) {
        DrumPicker.open({
          items: REGIONS,
          title: 'Choisir une région',
          showSearch: false,
          onConfirm: function(v) {
            rTrig.querySelector('span').textContent = v;
            document.getElementById('region-input').value = v;
            handleRegionChange(v);
            if (window.SytamApp && SytamApp.renderCheckoutSummary) SytamApp.renderCheckoutSummary();
          }
        });
      }
    });
    window.addEventListener('hashchange', () => navigate(window.location.hash.slice(1) || 'home'));
    var _scrollTimer;
    window.addEventListener('scroll', function() {
      if (document.body.classList.contains('menu-open')) {
        clearTimeout(_scrollTimer);
        _scrollTimer = setTimeout(function() { document.body.classList.remove('menu-open'); }, 150);
      }
    }, { passive: true });
  }

  // ---- HERO SLIDER ----
  var _heroIdx = 0;
  var _heroTimer = null;

  function _heroGo(idx) {
    var slides = document.querySelectorAll('.hero-slide');
    var dots = document.querySelectorAll('#hero-dots span');
    if (!slides.length) return;
    if (idx < 0) idx = slides.length - 1;
    if (idx >= slides.length) idx = 0;
    _heroIdx = idx;
    slides.forEach(function(s, i) { s.classList.toggle('active', i === idx); });
    dots.forEach(function(d, i) { d.classList.toggle('active', i === idx); });
    _heroResetTimer();
  }

  function _heroResetTimer() {
    if (_heroTimer) clearInterval(_heroTimer);
    _heroTimer = setInterval(function() { _heroGo(_heroIdx + 1); }, 3500);
  }

  function heroSlide(dir) { _heroGo(_heroIdx + dir); }

  function _initHero() {
    var slides = document.querySelectorAll('.hero-slide');
    var dots = document.getElementById('hero-dots');
    if (!dots || !slides.length) return;
    for (var i = 0; i < slides.length; i++) {
      var dot = document.createElement('span');
      dot.onclick = function(idx) { return function() { _heroGo(idx); }; }(i);
      dots.appendChild(dot);
    }
    _heroGo(0);
  }

  // ---- AUTO SCROLL SECTIONS ----
  var _scrollTimers = {};
  var _scrollListeners = {};

  function _autoScroll(id, dir, retries) {
    retries = retries || 3;
    dir = dir || 1;
    var el = document.getElementById(id);
    if (!el || el.children.length === 0) {
      if (retries > 0) setTimeout(function() { _autoScroll(id, dir, retries - 1); }, 500);
      return;
    }
    if (_scrollTimers[id]) clearInterval(_scrollTimers[id]);
    if (_scrollListeners[id]) {
      el.removeEventListener('mouseenter', _scrollListeners[id].enter);
      el.removeEventListener('mouseleave', _scrollListeners[id].leave);
    }
    var onEnter = function() { if (_scrollTimers[id]) clearInterval(_scrollTimers[id]); };
    var onLeave = function() { _autoScroll(id, dir); };
    _scrollListeners[id] = { enter: onEnter, leave: onLeave };
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    _scrollTimers[id] = setInterval(function() {
      var e = document.getElementById(id);
      if (!e) { clearInterval(_scrollTimers[id]); delete _scrollTimers[id]; return; }
      var max = e.scrollWidth - e.clientWidth;
      if (max <= 0) return;
      var step = Math.min(330, max * 0.3);
      var next = e.scrollLeft + step * dir;
      if (next >= max) next = (dir > 0 ? 0 : max);
      if (next < 0) next = (dir > 0 ? 0 : max);
      e.scrollTo({ left: next, behavior: 'smooth' });
    }, 3000);
  }

  function _startFeaturedScroll() {
    _autoScroll('featured-products', 1);
    _autoScroll('trending-products', -1);
  }

  // --- Notification ntfy (push vers téléphone) ---
  function sendNtfyNotification(order) {
    var topic = localStorage.getItem('sytam_ntfy_topic') || 'sytam-shop';
    if (!topic) return;
    var items = (order.items || []).map(function(i) { return i.nom + ' x' + i.qte; }).join(', ');
    var body = 'Commande #' + order.id + '\n' + order.client + ' - ' + fmt(order.total) + ' FCFA\n' + items;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://ntfy.sh/' + encodeURIComponent(topic), true);
    xhr.setRequestHeader('Title', 'Nouvelle commande !');
    xhr.setRequestHeader('Priority', 'high');
    xhr.setRequestHeader('Tags', 'shopping_cart');
    xhr.send(body);
  }

  // Périodiquement, pousse les données locales vers Supabase
  function _periodicSync() {
    if (typeof SupabaseAPI === 'undefined' || !SupabaseApp.ready) return;
    var _keys = ['sytam_orders_v2', 'sytam_messages', 'sytam_referrals', 'sytam_loyalty_v2', 'sytam_analytics_v1', 'sytam_product_costs', 'sytam_accounts'];
    _keys.forEach(function(k) {
      var d = localStorage.getItem(k);
      if (d) {
        try { SupabaseAPI.upsert('store_data', { key: k, value: JSON.parse(d) }); } catch(e) {}
      }
    });
  }
  setInterval(_periodicSync, 15000);

  // Périodiquement, tire les données depuis Supabase (pour voir les changements admin)
  function _periodicPull(cb) {
    if (typeof SupabaseAPI === 'undefined' || !SupabaseApp.ready) { if (cb) cb(); return; }
    // Commandes : on récupère les statuts à jour et on pousse les commandes locales manquantes
    SupabaseAPI.get('store_data?key=eq.sytam_orders_v2&select=value').then(function(result) {
      try {
        var localOrders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
        var merged = {};
        localOrders.forEach(function(o) { if (o && o.id) merged[o.id] = o; });
        var changed = false;
        if (result && result.length && result[0] && Array.isArray(result[0].value)) {
          var remoteOrders = result[0].value;
          remoteOrders.forEach(function(o) {
            if (o && o.id) {
              if (!merged[o.id]) { merged[o.id] = o; changed = true; }
              else if (merged[o.id].statut !== o.statut) {
                merged[o.id].statut = o.statut;
                changed = true;
              }
            }
          });
        }
        // Pousser les commandes locales qui ne sont pas encore dans Supabase
        var remoteIds = {};
        if (result && result.length && result[0] && Array.isArray(result[0].value)) {
          result[0].value.forEach(function(o) { if (o && o.id) remoteIds[o.id] = true; });
        }
        var needPush = localOrders.some(function(o) { return o && o.id && !remoteIds[o.id]; });
        if (needPush) {
          SupabaseAPI.upsert('store_data', { key: 'sytam_orders_v2', value: localOrders });
        }
        if (changed) {
          localStorage.setItem('sytam_orders_v2', JSON.stringify(Object.values(merged)));
        }
      } catch(e) {}
    }).catch(function() {});
    // Analytics : merger les données distantes
    SupabaseAPI.get('store_data?key=eq.sytam_analytics_v1&select=value').then(function(result) {
      try {
        if (result && result.length && result[0] && result[0].value && typeof SytamAnalytics !== 'undefined') {
          SytamAnalytics.loadFromSync({ value: result[0].value });
        }
      } catch(e) {}
    }).catch(function() {});
    // Événements analytics
    SupabaseAPI.get('store_data?key=eq.sytam_analytics_events&select=value').then(function(result) {
      try {
        if (result && result.length && result[0] && Array.isArray(result[0].value) && typeof SytamAnalytics !== 'undefined') {
          SytamAnalytics.loadEventsFromSync(result[0].value);
        }
      } catch(e) {}
    }).catch(function() {});
    // Références : merger les codes de parrainage distants
    SupabaseAPI.get('store_data?key=eq.sytam_referrals&select=value').then(function(result) {
      try {
        if (result && result.length && result[0] && Array.isArray(result[0].value)) {
          var remoteRefs = result[0].value;
          var localRefs = JSON.parse(localStorage.getItem('sytam_referrals') || '[]');
          var seen = {};
          remoteRefs.forEach(function(r) { if (r && r.id) seen[r.id] = r; });
          localRefs.forEach(function(r) {
            if (r && r.id && !seen[r.id]) { seen[r.id] = r; }
          });
          var merged = Object.values(seen);
          if (merged.length) localStorage.setItem('sytam_referrals', JSON.stringify(merged));
        }
      } catch(e) {}
    }).catch(function() {});
    // Comptes : merger les données distantes (déduplication par téléphone)
    SupabaseAPI.get('store_data?key=eq.sytam_accounts&select=value').then(function(result) {
      try {
        if (result && result.length && result[0] && Array.isArray(result[0].value)) {
          var remoteAccounts = result[0].value;
          var localAccounts = JSON.parse(localStorage.getItem('sytam_accounts') || '[]');
          var phoneMap = {};
          remoteAccounts.forEach(function(a) { if (a && a.phone) phoneMap[a.phone] = a; });
          localAccounts.forEach(function(a) {
            if (a && a.phone && !phoneMap[a.phone]) phoneMap[a.phone] = a;
          });
          localStorage.setItem('sytam_accounts', JSON.stringify(Object.values(phoneMap)));
        }
      } catch(e) {}
    }).catch(function() {});
    // Produits : merger les données distantes (préserver les stocks locaux)
    SupabaseAPI.get('store_data?key=eq.sytam_products_v4&select=value').then(function(result) {
      try {
        if (result && result.length && result[0] && Array.isArray(result[0].value)) {
          var remoteProducts = result[0].value;
          var localProducts = DB.list();
          var localMap = {};
          localProducts.forEach(function(p) { if (p && p.id) localMap[p.id] = p; });
          var changed = false;
          remoteProducts.forEach(function(rp) {
            if (rp && rp.id) {
              if (!localMap[rp.id]) { localProducts.push(rp); changed = true; }
              else {
                // Mettre à jour nom, prix, promo, images, couleurs MAIS garder le stock local
                var lp = localMap[rp.id];
                var oldStock = lp.colors ? JSON.parse(JSON.stringify(lp.colors)) : null;
                Object.keys(rp).forEach(function(k) {
                  if (k !== 'colors') lp[k] = rp[k];
                });
                // Restaurer les stocks locaux
                if (oldStock && lp.colors && Array.isArray(lp.colors)) {
                  lp.colors.forEach(function(lc) {
                    var remoteColor = rp.colors ? rp.colors.find(function(rc) { return rc.name === lc.name; }) : null;
                    if (remoteColor) {
                      var matchedLocal = oldStock.find(function(os) { return os.name === lc.name; });
                      if (matchedLocal) {
                        if (matchedLocal.stocks) {
                          Object.keys(matchedLocal.stocks).forEach(function(sz) {
                            if (lc.stocks) lc.stocks[sz] = matchedLocal.stocks[sz];
                          });
                        } else if (matchedLocal.stock !== undefined) {
                          lc.stock = matchedLocal.stock;
                        }
                      }
                    }
                  });
                }
                changed = true;
              }
            }
          });
          // Supprimer les produits locaux qui n'existent plus dans Supabase ou qui sont dans la liste de suppression
          var remoteIds = {};
          remoteProducts.forEach(function(rp) { if (rp && rp.id) remoteIds[rp.id] = true; });
          var deletedIds = {};
          try { var d = JSON.parse(localStorage.getItem('sytam_deleted_products') || '[]'); d.forEach(function(id) { deletedIds[id] = true; }); } catch(e) {}
          var beforeCount = localProducts.length;
          localProducts = localProducts.filter(function(lp) { return lp && lp.id && remoteIds[lp.id] && !deletedIds[lp.id]; });
          if (localProducts.length !== beforeCount) changed = true;
          if (changed) {
            localStorage.setItem('sytam_products_v4', JSON.stringify(localProducts));
            if (typeof DB !== 'undefined') { DB._data = localProducts; DB.reloadFromLocal(); }
            if (state.currentPage === 'shop') renderShop();
          }
        }
      } catch(e) {}
    }).catch(function() {});
    if (cb) setTimeout(cb, 100);
  }
  setInterval(_periodicPull, 30000);

  // --- Suivi de commande ---
  function trackOrder() {
    var phone = document.getElementById('track-phone').value.trim();
    var orderId = document.getElementById('track-id').value.trim().toUpperCase();
    var resultDiv = document.getElementById('track-result');
    if (!phone || !orderId) { resultDiv.style.display = 'block'; resultDiv.innerHTML = '<p style="color:var(--danger)">Veuillez remplir les deux champs.</p>'; return; }
    // Phone: only digits allowed
    var phoneDigits = phone.replace(/[^0-9]/g, '');
    if (phone !== phoneDigits) { resultDiv.style.display = 'block'; resultDiv.innerHTML = '<p style="color:var(--danger)">Le numéro de téléphone ne doit contenir que des chiffres.</p>'; return; }
    function showOrder(ordersList) {
      var found = null;
      for (var i = 0; i < ordersList.length; i++) {
        var o = ordersList[i];
        var cleanPhone = (o.telephone || '').replace(/[^0-9]/g, '');
        if (o.id.toUpperCase() === orderId && cleanPhone === phoneDigits) { found = o; break; }
      }
      if (!found) { resultDiv.style.display = 'block'; resultDiv.innerHTML = '<p style="color:var(--danger)">Aucune commande trouvée. Vérifiez le numéro et l\'ID.</p>'; return; }
      var cancelled = found.statut === 'annulee';
      var itemsHtml = (found.items || []).map(function(it) { return '<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:4px 0"><span>' + it.nom + ' ' + (it.variantLabel ? '(' + it.variantLabel + ')' : '') + ' x' + (it.qte||1) + '</span><span>' + fmt(it.prix) + ' FCFA</span></div>'; }).join('');
      var cardHtml =
        '<div class="track-order-card">' +
          '<div class="row"><span class="label">Commande</span><span>' + found.id + '</span></div>' +
          '<div class="row"><span class="label">Client</span><span>' + (found.client || '—') + '</span></div>' +
          '<div class="row"><span class="label">Total</span><span><strong>' + fmt(found.total) + ' FCFA</strong></span></div>' +
          (found.mode_paiement ? '<div class="row"><span class="label">Paiement</span><span>' + found.mode_paiement + '</span></div>' : '') +
          (found.adresse ? '<div class="row"><span class="label">Adresse</span><span style="text-align:right;max-width:200px">' + found.adresse + '</span></div>' : '') +
          '<div style="border-top:1px solid var(--border);margin:10px 0 6px;padding-top:8px">' + itemsHtml + '</div>' +
        '</div>';
      if (cancelled) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = cardHtml +
          '<div style="text-align:center;padding:24px;background:#fff5f5;border-radius:8px;border:1px solid #ffcdd2">' +
            '<div style="font-size:2rem;margin-bottom:8px">❌</div>' +
            '<h3 style="color:#c62828;margin:0 0 8px">Commande annulée</h3>' +
            '<p style="color:#666;font-size:.85rem;margin:0">Merci de nous contacter sur WhatsApp au <strong>77 478 98 75</strong> pour plus d\'informations.</p>' +
          '</div>';
        return;
      }
      var steps = [
        { key: 'en_attente', label: 'Commande reçue' },
        { key: 'confirmee', label: 'Confirmée (paiement reçu)' },
        { key: 'preparation', label: 'En cours de traitement' },
        { key: 'livraison', label: 'En route pour livraison' },
        { key: 'livree', label: 'Livrée' },
      ];
      var statusIdx = -1;
      for (var si = 0; si < steps.length; si++) { if (steps[si].key === found.statut) { statusIdx = si; break; } }
      if (statusIdx === -1) { steps = [{ key: found.statut, label: found.statut }]; statusIdx = 0; }
      var timelineHtml = '<ul class="track-timeline">' + steps.map(function(s, si) {
        var cls = si < statusIdx ? 'done' : (si === statusIdx ? 'active' : '');
        return '<li class="track-step ' + cls + '"><span class="dot"></span><div class="step-label">' + s.label + '</div></li>';
      }).join('') + '</ul>';
      resultDiv.style.display = 'block';
      var lastUpdate = found.created_at || found.mis_a_jour || '';
      var dateStr = lastUpdate ? new Date(lastUpdate).toLocaleString('fr-FR', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
      resultDiv.innerHTML = cardHtml + timelineHtml +
        '<p style="font-size:.78rem;color:var(--text-lighter);text-align:center;margin-top:12px">Dernière mise à jour : ' + dateStr + '</p>';
    }
    // Chercher Supabase d'abord (données à jour), fallback localStorage
    function trySupabase() {
      if (typeof SupabaseAPI !== 'undefined' && SupabaseApp.ready) {
        SupabaseAPI.get('store_data?key=eq.sytam_orders_v2&select=value')
          .then(function(result) {
            if (result && result.length && result[0].value) { showOrder(result[0].value); }
            else { tryLocal(); }
          })
          .catch(function() { tryLocal(); });
      } else { tryLocal(); }
    }
    function tryLocal() {
      var orders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
      if (orders.length) { showOrder(orders); return; }
      resultDiv.style.display = 'block'; resultDiv.innerHTML = '<p style="color:var(--danger)">Aucune commande trouvée.</p>';
    }
    trySupabase();
  }

  window.SytamApp = {
    init, navigate, navigateToCategory, renderShop, quickView, closeQuickView,
    selectVariantAttr, changeQty, addFromModal,
    toggleCart, toggleMenu, renderCart, cartQty, cartRemove,
    showCheckout, closeCheckout, submitOrder, closeOrderSuccess, renderCheckoutSummary,
    applyPromo, heroSlide, trackOrder,
    openSizeGuide, closeSizeGuide, openGeneralSizeGuide, showSizeGuideCategory,
    scrollHoriz: function (id, dir) {
      var el = document.getElementById(id);
      if (!el) return;
      var child = el.firstElementChild;
      var w = child ? child.offsetWidth + 16 : 220;
      el.scrollBy({ left: dir * w * 2, behavior: 'smooth' });
    },
    getColorHex, updateCartUI,
    switchImage: function(idx) {
      var imgs = window._modalImages || [];
      var main = document.getElementById('modal-main-img');
      var thumbs = document.querySelectorAll('.modal-thumbs img');
      if (!main || !imgs[idx]) return;
      main.src = imgs[idx];
      thumbs.forEach(function(t, i) { t.classList.toggle('active', i === idx); });
    },
  };

  document.addEventListener('DOMContentLoaded', init);
})();
