function _fmtAnalytics(n) { return (n || 0).toLocaleString('fr-FR'); }
const SytamAnalytics = {
  AGG_KEY: 'sytam_analytics_v1',
  EVENTS_KEY: 'sytam_analytics_events',
  MAX_EVENTS: 20000,
  _agg: null,
  _events: [],
  _sessionId: null,
  _sessionStart: null,
  _timer: null,

  init() {
    this._sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this._sessionStart = Date.now();
    this._loadAgg();
    this._loadEvents();
    this._trackVisit();
    this._startTimer();
    this._bindEvents();
  },

  _loadAgg() {
    var stored = localStorage.getItem(this.AGG_KEY);
    if (stored) { try { this._agg = JSON.parse(stored); } catch(e) {} }
    if (!this._agg) {
      this._agg = {
        totalVisits: 0, uniqueVisitorIds: [], totalUnique: 0,
        productClicks: {}, addToCart: {}, removeFromCart: {},
        totalAddToCart: 0, totalProductClicks: 0, totalRemoveFromCart: 0,
        totalTimeSeconds: 0, dailyStats: {}, lastUpdated: Date.now(),
      };
    }
  },

  _loadEvents() {
    var stored = localStorage.getItem(this.EVENTS_KEY);
    if (stored) { try { this._events = JSON.parse(stored); } catch(e) {} }
    if (!Array.isArray(this._events)) this._events = [];
  },

  _saveAgg() {
    this._agg.lastUpdated = Date.now();
    localStorage.setItem(this.AGG_KEY, JSON.stringify(this._agg));
  },

  _saveEvents() {
    if (this._events.length > this.MAX_EVENTS) {
      this._events = this._events.slice(this._events.length - this.MAX_EVENTS);
    }
    localStorage.setItem(this.EVENTS_KEY, JSON.stringify(this._events));
  },

  _getVisitorId() {
    var key = 'sytam_visitor_id';
    var id = localStorage.getItem(key);
    if (!id) {
      id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(key, id);
    }
    return id;
  },

  _todayKey() { return new Date().toISOString().slice(0, 10); },

  _ensureDaily() {
    var key = this._todayKey();
    if (!this._agg.dailyStats[key]) {
      this._agg.dailyStats[key] = { visits: 0, addToCart: 0, clicks: 0, removeFromCart: 0, timeSeconds: 0 };
    }
    return this._agg.dailyStats[key];
  },

  _trackVisit() {
    this._agg.totalVisits++;
    var uid = this._getVisitorId();
    if (this._agg.uniqueVisitorIds.indexOf(uid) === -1) {
      this._agg.uniqueVisitorIds.push(uid);
      this._agg.totalUnique = this._agg.uniqueVisitorIds.length;
    }
    var daily = this._ensureDaily();
    daily.visits++;
    this._saveAgg();
    this._pushEvent('page_visit', { page: window.location.hash || 'home' });
  },

  trackProductClick(productId, productName) {
    if (!this._agg) return;
    this._agg.totalProductClicks++;
    if (!this._agg.productClicks[productId]) {
      this._agg.productClicks[productId] = { name: productName, count: 0 };
    }
    this._agg.productClicks[productId].count++;
    var daily = this._ensureDaily();
    daily.clicks++;
    this._saveAgg();
    this._pushEvent('product_click', { productId: productId, productName: productName });
  },

  trackAddToCart(productId, productName, variant, qty) {
    if (!this._agg) return;
    this._agg.totalAddToCart++;
    if (!this._agg.addToCart[productId]) {
      this._agg.addToCart[productId] = { name: productName, count: 0 };
    }
    this._agg.addToCart[productId].count++;
    var daily = this._ensureDaily();
    daily.addToCart++;
    this._saveAgg();
    this._pushEvent('add_to_cart', { productId: productId, productName: productName, variant: variant || '', qty: qty || 1 });
  },

  trackRemoveFromCart(productId, productName, variant) {
    if (!this._agg) return;
    this._agg.totalRemoveFromCart++;
    if (!this._agg.removeFromCart[productId]) {
      this._agg.removeFromCart[productId] = { name: productName, count: 0 };
    }
    this._agg.removeFromCart[productId].count++;
    var daily = this._ensureDaily();
    daily.removeFromCart = (daily.removeFromCart || 0) + 1;
    this._saveAgg();
    this._pushEvent('remove_from_cart', { productId: productId, productName: productName, variant: variant || '' });
  },

  trackQtyChange(productId, productName, oldQty, newQty) {
    this._pushEvent('qty_change', { productId: productId, productName: productName, oldQty: oldQty, newQty: newQty });
  },

  trackSearch(query) {
    if (!query || query.trim().length < 2) return;
    this._pushEvent('search', { query: query.trim() });
  },

  trackCheckout() {
    this._pushEvent('checkout_start', {});
  },

  trackOrderPlaced(orderId, total) {
    this._pushEvent('order_placed', { orderId: orderId, total: total });
  },

  _pushEvent(type, data) {
    this._events.push({
      t: type,
      ts: new Date().toISOString(),
      s: this._sessionId,
      v: this._getVisitorId(),
      d: data || {},
    });
    this._saveEvents();
  },

  _startTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(function() {
      if (SytamAnalytics._sessionStart) {
        var elapsed = Math.floor((Date.now() - SytamAnalytics._sessionStart) / 1000);
        if (elapsed > 0 && elapsed <= 86400) {
          SytamAnalytics._agg.totalTimeSeconds = elapsed;
          var daily = SytamAnalytics._ensureDaily();
          daily.timeSeconds = elapsed;
          SytamAnalytics._saveAgg();
        }
      }
    }, 30000);
  },

  _bindEvents() {
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) { SytamAnalytics._updateSessionTime(); }
      else { SytamAnalytics._sessionStart = Date.now(); }
    });
    window.addEventListener('beforeunload', function() {
      SytamAnalytics._updateSessionTime();
      SytamAnalytics._sync();
    });
  },

  _updateSessionTime() {
    if (this._sessionStart) {
      var elapsed = Math.floor((Date.now() - this._sessionStart) / 1000);
      if (elapsed > 0 && elapsed <= 86400) {
        this._agg.totalTimeSeconds = Math.max(this._agg.totalTimeSeconds || 0, elapsed);
        var daily = this._ensureDaily();
        daily.timeSeconds = Math.max(daily.timeSeconds || 0, elapsed);
        this._saveAgg();
      }
    }
  },

  getAgg() { return this._agg ? JSON.parse(JSON.stringify(this._agg)) : null; },

  getEvents(filters) {
    var events = this._events.slice();
    if (filters) {
      if (filters.type) events = events.filter(function(e) { return e.t === filters.type; });
      if (filters.since) events = events.filter(function(e) { return e.ts >= filters.since; });
      if (filters.productId) events = events.filter(function(e) { return e.d && e.d.productId === filters.productId; });
      if (filters.limit) events = events.slice(-filters.limit);
    }
    return events;
  },

  exportCSV(events) {
    if (!events || !events.length) events = this._events;
    var header = 'timestamp,type,sessionId,visitorId' +
      ',productId,productName,variant,qty,oldQty,newQty,query,orderId,total,page';
    var rows = events.map(function(e) {
      var d = e.d || {};
      var esc = function(s) { return '"' + String(s || '').replace(/"/g, '""') + '"'; };
      return [
        e.ts, esc(e.t), esc(e.s), esc(e.v),
        esc(d.productId || ''), esc(d.productName || ''), esc(d.variant || ''),
        d.qty || '', d.oldQty || '', d.newQty || '',
        esc(d.query || ''), esc(d.orderId || ''), d.total || '',
        esc(d.page || ''),
      ].join(',');
    }).join('\n');
    return header + '\n' + rows;
  },

  _sync() {
    if (typeof SupabaseAPI !== 'undefined' && SupabaseApp && SupabaseApp.ready) {
      SupabaseAPI.upsert('store_data', { key: this.AGG_KEY, value: this._agg });
      SupabaseAPI.upsert('store_data', { key: this.EVENTS_KEY, value: this._events.slice(-5000) });
    }
  },

  loadFromSync(data) {
    if (data && data.value) {
      var merged = this._mergeData(this._agg, data.value);
      this._agg = merged;
      this._saveAgg();
    }
  },

  loadEventsFromSync(remoteEvents) {
    if (!Array.isArray(remoteEvents) || !remoteEvents.length) return;
    var existing = {};
    this._events.forEach(function(e) { existing[e.ts + '_' + e.s + '_' + (e.d && e.d.productId || '')] = true; });
    remoteEvents.forEach(function(e) {
      var key = e.ts + '_' + e.s + '_' + (e.d && e.d.productId || '');
      if (!existing[key]) { SytamAnalytics._events.push(e); existing[key] = true; }
    });
    this._events.sort(function(a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0; });
    this._saveEvents();
  },

  _mergeData(local, remote) {
    if (!local) return remote || local;
    if (!remote) return local;
    var m = JSON.parse(JSON.stringify(local));
    m.totalVisits = Math.max(local.totalVisits || 0, remote.totalVisits || 0);
    var allIds = (local.uniqueVisitorIds || []).concat(remote.uniqueVisitorIds || []);
    m.uniqueVisitorIds = allIds.filter(function(v, i, a) { return a.indexOf(v) === i; });
    m.totalUnique = m.uniqueVisitorIds.length;
    m.totalAddToCart = Math.max(local.totalAddToCart || 0, remote.totalAddToCart || 0);
    m.totalProductClicks = Math.max(local.totalProductClicks || 0, remote.totalProductClicks || 0);
    m.totalRemoveFromCart = Math.max(local.totalRemoveFromCart || 0, remote.totalRemoveFromCart || 0);
    m.totalTimeSeconds = Math.max(local.totalTimeSeconds || 0, remote.totalTimeSeconds || 0);
    var mergeObj = function(a, b) {
      var r = JSON.parse(JSON.stringify(a || {}));
      for (var k in (b || {})) {
        if (r[k]) r[k].count = Math.max(r[k].count, b[k].count);
        else r[k] = { name: b[k].name, count: b[k].count };
      }
      return r;
    };
    m.productClicks = mergeObj(local.productClicks, remote.productClicks);
    m.addToCart = mergeObj(local.addToCart, remote.addToCart);
    m.removeFromCart = mergeObj(local.removeFromCart, remote.removeFromCart);
    m.dailyStats = JSON.parse(JSON.stringify(local.dailyStats || {}));
    for (var d in (remote.dailyStats || {})) {
      if (m.dailyStats[d]) {
        m.dailyStats[d].visits = Math.max(m.dailyStats[d].visits, remote.dailyStats[d].visits);
        m.dailyStats[d].addToCart = Math.max(m.dailyStats[d].addToCart, remote.dailyStats[d].addToCart);
        m.dailyStats[d].clicks = Math.max(m.dailyStats[d].clicks, remote.dailyStats[d].clicks);
        m.dailyStats[d].removeFromCart = Math.max(m.dailyStats[d].removeFromCart || 0, remote.dailyStats[d].removeFromCart || 0);
        m.dailyStats[d].timeSeconds = Math.max(m.dailyStats[d].timeSeconds, remote.dailyStats[d].timeSeconds);
      } else {
        m.dailyStats[d] = JSON.parse(JSON.stringify(remote.dailyStats[d]));
      }
    }
    return m;
  },

  _fmtTime(seconds) {
    if (!seconds || seconds < 0) return '—';
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
  },

  // ---- RENDU ADMIN ----
  renderAdminAnalytics() {
    var tab = document.getElementById('tab-analytics');
    if (!tab || !this._agg) return;
    var d = this._agg;
    var daily = d.dailyStats[this._todayKey()] || {};
    var conversion = d.totalVisits > 0 ? ((d.totalAddToCart / d.totalVisits) * 100).toFixed(1) : '0.0';
    var eventCount = this._events.length;
    tab.innerHTML =
      '<div class="topbar"><div style="display:flex;align-items:center;gap:.5rem;">' +
        '<div class="hamburger" onclick="SytamAdmin.toggleSidebar()">☰</div>' +
        '<div><h1>Analytiques</h1><p>Statistiques et rapports</p></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
        '<button class="btn-add btn-sm" onclick="SytamAdmin.syncAnalytics()" style="font-size:.75rem">🔄 Synchroniser</button>' +
        '<button class="btn-add btn-sm" onclick="SytamAnalytics.exportCSVFile()" style="font-size:.75rem;background:var(--ok)">⬇ Exporter CSV</button>' +
        '<button class="btn-add btn-sm" onclick="SytamAnalytics.exportProductCSV()" style="font-size:.75rem;background:var(--gold)">⬇ CSV par produit</button>' +
      '</div>' +
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div><div class="stat-val">' + (d.totalVisits || 0) + '</div><div class="stat-lbl">Vues totales</div><div class="stat-sub">Ajd : ' + (daily.visits || 0) + ' | Événements : ' + eventCount + '</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div class="stat-val">' + (d.totalUnique || 0) + '</div><div class="stat-lbl">Visiteurs uniques</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg></div><div class="stat-val">' + (d.totalProductClicks || 0) + '</div><div class="stat-lbl">Clics produits</div><div class="stat-sub">Ajd : ' + (daily.clicks || 0) + '</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-val">' + (d.totalAddToCart || 0) + '</div><div class="stat-lbl">Ajouts panier</div><div class="stat-sub">Ajd : ' + (daily.addToCart || 0) + ' | Retraits : ' + (d.totalRemoveFromCart || 0) + '</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="stat-val">' + this._fmtTime(d.totalTimeSeconds) + '</div><div class="stat-lbl">Temps passé total</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-val">' + conversion + '%</div><div class="stat-lbl">Taux conversion</div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:16px">' +
        '<div class="card-title">Détails par produit</div>' +
        '<div id="analyticsProductDetail">' + this._renderProductDetail(d) + '</div>' +
      '</div>' +
      '<div class="card" style="margin-top:16px">' +
        '<div class="card-title">Événements récents <span style="font-weight:400;font-size:.75rem;color:var(--tl)">(' + eventCount + ' au total)</span></div>' +
        '<div id="analyticsEventLog">' + this._renderEventLog() + '</div>' +
      '</div>' +
      this._renderDailyHistory(d.dailyStats);
  },

  _getProductsMap() {
    try { var p = JSON.parse(localStorage.getItem('sytam_products_v4') || '[]'); var m = {}; p.forEach(function(x) { if (x && x.id) m[x.id] = x; }); return m; } catch(e) { return {}; }
  },

  _renderProductDetail(d) {
    var allIds = {};
    var clicks = d.productClicks || {};
    var carts = d.addToCart || {};
    var removes = d.removeFromCart || {};
    Object.keys(clicks).forEach(function(k) { allIds[k] = true; });
    Object.keys(carts).forEach(function(k) { allIds[k] = true; });
    Object.keys(removes).forEach(function(k) { allIds[k] = true; });
    var ids = Object.keys(allIds);
    if (!ids.length) return '<p style="color:var(--tl);font-size:.85rem;padding:12px 0">Aucune donnée produit</p>';
    var products = this._getProductsMap();
    var items = ids.map(function(id) {
      var c = clicks[id] || {};
      var a = carts[id] || {};
      var r = removes[id] || {};
      var p = products[id];
      return {
        id: id, name: c.name || a.name || r.name || id,
        clicks: c.count || 0, cart: a.count || 0, remove: r.count || 0,
        img: p && p.images && p.images[0] ? p.images[0] : '',
        colors: p && p.colors ? p.colors : [],
        prix: p ? p.prix : 0,
      };
    });
    items.sort(function(a, b) { return (b.clicks + b.cart) - (a.clicks + a.cart); });
    var rows = items.map(function(item, i) {
      var abandon = item.clicks > 0 ? Math.round((1 - item.cart / item.clicks) * 100) : 0;
      var imgHtml = item.img ? '<img src="' + item.img + '" style="width:36px;height:36px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:6px">' : '';
      // Couleurs : montrer la répartition si disponibles
      var colorsHtml = item.colors.length ? item.colors.map(function(col) {
        var colClicks = 0, colCarts = 0;
        // Estimation depuis le nom dans les events
        var colImg = col.image ? '<img src="' + col.image + '" style="width:20px;height:20px;object-fit:cover;border-radius:2px;vertical-align:middle;margin:0 2px">' : '';
        return '<span style="display:inline-block;margin:2px 4px 2px 0;font-size:.72rem;background:var(--bd);padding:1px 6px;border-radius:3px;white-space:nowrap">' + colImg + '<span style="display:inline-block;width:8px;height:8px;background:' + col.hex + ';border-radius:50%;vertical-align:middle;margin-right:2px"></span>' + col.name + '</span>';
      }).join('') : '';
      return '<tr>' +
        '<td style="padding:6px 8px;font-weight:600;color:var(--tl);font-size:.78rem">#' + (i + 1) + '</td>' +
        '<td style="padding:6px 8px;font-size:.82rem">' + imgHtml + item.name + '<br><span style="font-size:.7rem;color:var(--tl)">' + _fmtAnalytics(item.prix) + ' FCFA</span>' + (colorsHtml ? '<br>' + colorsHtml : '') + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-weight:600;font-size:.82rem">' + item.clicks + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-weight:600;font-size:.82rem;color:var(--ok)">' + item.cart + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.82rem;color:var(--er)">' + (item.remove || '—') + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.78rem;color:var(--tl)">' + abandon + '%</td>' +
      '</tr>';
    }).join('');
    return '<div class="tbl-wrap"><table style="font-size:.82rem"><thead><tr>' +
      '<th style="width:35px">#</th><th style="text-align:left">Produit</th>' +
      '<th style="text-align:center">Clics</th><th style="text-align:center">Panier+</th>' +
      '<th style="text-align:center">Retiré</th><th style="text-align:center">Abandon</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  },

  _renderEventLog() {
    var events = this._events.slice(-100).reverse();
    if (!events.length) return '<p style="color:var(--tl);font-size:.85rem;padding:12px 0">Aucun événement</p>';
    var labels = {
      page_visit: '📄 Visite', product_click: '👆 Clic', add_to_cart: '🛒 Ajout panier',
      remove_from_cart: '🗑 Retrait panier', qty_change: '🔢 Qté changée',
      search: '🔍 Recherche', checkout_start: '💳 Checkout', order_placed: '✅ Commande',
    };
    var rows = events.slice(0, 50).map(function(e) {
      var label = labels[e.t] || e.t;
      var detail = '';
      if (e.d && e.d.productName) detail = e.d.productName;
      else if (e.d && e.d.query) detail = '"' + e.d.query + '"';
      else if (e.d && e.d.page) detail = e.d.page;
      var time = e.ts ? e.ts.slice(11, 19) : '';
      return '<tr>' +
        '<td style="padding:4px 6px;font-size:.72rem;color:var(--tl);white-space:nowrap">' + time + '</td>' +
        '<td style="padding:4px 6px;font-size:.78rem">' + label + '</td>' +
        '<td style="padding:4px 6px;font-size:.78rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + detail + '</td>' +
      '</tr>';
    }).join('');
    return '<div class="tbl-wrap"><table style="font-size:.82rem"><thead><tr>' +
      '<th style="width:60px">Heure</th><th style="text-align:left">Type</th><th style="text-align:left">Détail</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    (events.length > 50 ? '<p style="font-size:.75rem;color:var(--tl);padding:8px;text-align:center">50 événements affichés sur ' + events.length + '</p>' : '');
  },

  _renderDailyHistory(dailyStats) {
    if (!dailyStats) return '';
    var days = Object.keys(dailyStats).sort().reverse();
    if (days.length === 0) return '';
    var rows = days.map(function(date) {
      var day = dailyStats[date];
      return '<tr>' +
        '<td style="padding:6px 8px;white-space:nowrap;font-weight:500;font-size:.82rem">' + date + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.82rem">' + (day.visits || 0) + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.82rem">' + (day.clicks || 0) + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.82rem">' + (day.addToCart || 0) + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.78rem;color:var(--er)">' + (day.removeFromCart || 0) + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.78rem;color:var(--tl)">' + (day.timeSeconds ? SytamAnalytics._fmtTime(day.timeSeconds) : '—') + '</td>' +
      '</tr>';
    }).join('');
    return '<div class="card" style="margin-top:16px">' +
      '<div class="card-title">Historique journalier <span style="font-weight:400;font-size:.75rem;color:var(--tl)">(' + days.length + ' jours)</span></div>' +
      '<div class="tbl-wrap"><table style="font-size:.82rem"><thead><tr>' +
        '<th style="text-align:left">Date</th><th style="text-align:center">Vues</th>' +
        '<th style="text-align:center">Clics</th><th style="text-align:center">Panier+</th>' +
        '<th style="text-align:center">Retiré</th><th style="text-align:center">Temps</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  exportCSVFile() {
    var csv = this.exportCSV();
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sytam_analytics_events_' + this._todayKey() + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  },

  exportProductCSV() {
    if (!this._agg) return;
    var d = this._agg;
    var header = 'produit,prix,image,couleurs,clics,ajouts_panier,retires_panier,taux_abandon';
    var products = this._getProductsMap();
    var allIds = {};
    var clicks = d.productClicks || {};
    var carts = d.addToCart || {};
    var removes = d.removeFromCart || {};
    Object.keys(clicks).forEach(function(k) { allIds[k] = true; });
    Object.keys(carts).forEach(function(k) { allIds[k] = true; });
    Object.keys(removes).forEach(function(k) { allIds[k] = true; });
    var esc = function(s) { return '"' + String(s || '').replace(/"/g, '""') + '"'; };
    var rows = Object.keys(allIds).map(function(id) {
      var c = clicks[id] || {}, a = carts[id] || {}, r = removes[id] || {};
      var name = c.name || a.name || r.name || id;
      var p = products[id];
      var prix = p ? p.prix : '';
      var img = p && p.images && p.images[0] ? p.images[0] : '';
      var colors = (p && p.colors) ? p.colors.map(function(col) { return col.name + '(' + col.hex + ')'; }).join('; ') : '';
      var abandon = c.count > 0 ? Math.round((1 - a.count / c.count) * 100) : 0;
      return [esc(name), prix, esc(img), esc(colors), c.count || 0, a.count || 0, r.count || 0, abandon + '%'].join(',');
    }).sort().join('\n');
    var csv = header + '\n' + rows;
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sytam_analytics_produits_' + this._todayKey() + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  },
};
