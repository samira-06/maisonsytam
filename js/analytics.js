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
  _logTimer: null,

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
        totalTimeSeconds: 0, dailyStats: {}, colorStats: {},
        lastUpdated: Date.now(),
      };
    }
    if (!this._agg.colorStats) this._agg.colorStats = {};
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

  trackProductClick(productId, productName, colorName) {
    if (!this._agg) return;
    this._agg.totalProductClicks++;
    if (!this._agg.productClicks[productId]) {
      this._agg.productClicks[productId] = { name: productName, count: 0 };
    }
    this._agg.productClicks[productId].count++;
    if (colorName) {
      if (!this._agg.colorStats[productId]) this._agg.colorStats[productId] = {};
      if (!this._agg.colorStats[productId][colorName]) this._agg.colorStats[productId][colorName] = { clicks: 0, addToCart: 0, removeFromCart: 0 };
      this._agg.colorStats[productId][colorName].clicks++;
    }
    var daily = this._ensureDaily();
    daily.clicks++;
    this._saveAgg();
    this._pushEvent('product_click', { productId: productId, productName: productName, color: colorName || '' });
  },

  trackAddToCart(productId, productName, variant, qty) {
    if (!this._agg) return;
    this._agg.totalAddToCart++;
    if (!this._agg.addToCart[productId]) {
      this._agg.addToCart[productId] = { name: productName, count: 0 };
    }
    this._agg.addToCart[productId].count++;
    if (variant) {
      if (!this._agg.colorStats[productId]) this._agg.colorStats[productId] = {};
      if (!this._agg.colorStats[productId][variant]) this._agg.colorStats[productId][variant] = { clicks: 0, addToCart: 0, removeFromCart: 0 };
      this._agg.colorStats[productId][variant].addToCart += (qty || 1);
    }
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
    if (variant) {
      if (!this._agg.colorStats[productId]) this._agg.colorStats[productId] = {};
      if (!this._agg.colorStats[productId][variant]) this._agg.colorStats[productId][variant] = { clicks: 0, addToCart: 0, removeFromCart: 0 };
      this._agg.colorStats[productId][variant].removeFromCart++;
    }
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

  _startLogTimer() {
    if (this._logTimer) clearInterval(this._logTimer);
    this._logTimer = setInterval(function() {
      var el = document.getElementById('analyticsEventLog');
      if (el) {
        el.innerHTML = SytamAnalytics._renderEventLog();
      } else {
        clearInterval(SytamAnalytics._logTimer);
        SytamAnalytics._logTimer = null;
      }
    }, 3000);
  },
  _stopLogTimer() {
    if (this._logTimer) { clearInterval(this._logTimer); this._logTimer = null; }
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
    if (!m.colorStats) m.colorStats = {};
    var rc = remote.colorStats || {};
    for (var pid in rc) {
      if (!m.colorStats[pid]) m.colorStats[pid] = {};
      for (var col in rc[pid]) {
        if (!m.colorStats[pid][col]) m.colorStats[pid][col] = { clicks: 0, addToCart: 0, removeFromCart: 0 };
        m.colorStats[pid][col].clicks = Math.max(m.colorStats[pid][col].clicks || 0, rc[pid][col].clicks || 0);
        m.colorStats[pid][col].addToCart = Math.max(m.colorStats[pid][col].addToCart || 0, rc[pid][col].addToCart || 0);
        m.colorStats[pid][col].removeFromCart = Math.max(m.colorStats[pid][col].removeFromCart || 0, rc[pid][col].removeFromCart || 0);
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
  _getOrders() {
    try { return JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]'); } catch(e) { return []; }
  },
  _countOrders(status) {
    var orders = this._getOrders();
    if (status) return orders.filter(function(o) { return o.statut === status; }).length;
    return orders.length;
  },
  _totalRevenue() {
    var orders = this._getOrders().filter(function(o) { return o.statut === 'confirmee' || o.statut === 'livree'; });
    return orders.reduce(function(s, o) { return s + (o.total || 0); }, 0);
  },

  _getSessions() {
    var events = this._events;
    var sessions = {};
    events.forEach(function(e) {
      var sid = e.s;
      if (!sid) return;
      if (!sessions[sid]) {
        sessions[sid] = {
          id: sid, start: e.ts, end: e.ts,
          pages: [], productsClicked: [], productsAdded: [], productsRemoved: [],
          hasCheckout: false, hasOrder: false,
        };
      }
      var s = sessions[sid];
      if (e.ts < s.start) s.start = e.ts;
      if (e.ts > s.end) s.end = e.ts;
      if (e.t === 'page_visit' && e.d && e.d.page) {
        if (s.pages.indexOf(e.d.page) === -1) s.pages.push(e.d.page);
      }
      if (e.t === 'product_click' && e.d && e.d.productName) {
        if (s.productsClicked.indexOf(e.d.productName) === -1) s.productsClicked.push(e.d.productName);
      }
      if (e.t === 'add_to_cart' && e.d && e.d.productName) {
        if (s.productsAdded.indexOf(e.d.productName) === -1) s.productsAdded.push(e.d.productName);
      }
      if (e.t === 'remove_from_cart' && e.d && e.d.productName) {
        if (s.productsRemoved.indexOf(e.d.productName) === -1) s.productsRemoved.push(e.d.productName);
      }
      if (e.t === 'checkout_start') s.hasCheckout = true;
      if (e.t === 'order_placed') s.hasOrder = true;
    });
    var result = [];
    for (var k in sessions) result.push(sessions[k]);
    result.forEach(function(s) {
      var diff = new Date(s.end) - new Date(s.start);
      s.duration = Math.round(diff / 1000);
      // Limiter les sessions aberrantes (> 4h) — probablement un visiteur revenu sans recharger la page
      if (s.duration > 14400) {
        s.duration = 14400;
        s.durationNote = '≥4h (plusieurs visites)';
      }
      if (s.hasOrder) s.result = 'Commande confirmée';
      else if (s.hasCheckout) s.result = 'Abandon';
      else s.result = 'Navigation seule';
    });
    result.sort(function(a, b) { return a.start < b.start ? 1 : -1; });
    return result;
  },

  renderAdminAnalytics() {
    this._stopLogTimer();
    var tab = document.getElementById('tab-analytics');
    if (!tab || !this._agg) return;
    var d = this._agg;
    var daily = d.dailyStats[this._todayKey()] || {};
    var confirmedOrders = this._countOrders('confirmee') + this._countOrders('livree');
    var allOrders = this._countOrders();
    var revenue = this._totalRevenue();
    var panierMoyen = confirmedOrders > 0 ? Math.round(revenue / confirmedOrders) : 0;
    var conversionGlobal = d.totalVisits > 0 ? ((confirmedOrders / d.totalVisits) * 100).toFixed(1) : '0.0';
    var days = Object.keys(d.dailyStats || {}).length;
    var avgTime = d.totalUnique > 0 && d.totalTimeSeconds ? this._fmtTime(Math.round(d.totalTimeSeconds / d.totalUnique)) : '—';
    var chartRange = localStorage.getItem('sytam_chart_range') || '7';
    var globalPeriod = localStorage.getItem('sytam_analytics_period') || 'all';

    // KPIs supplémentaires
    var ordersAll = this._getOrders().filter(function(o) { return o.statut === 'confirmee' || o.statut === 'livree'; });
    // Produit le plus/moins vendu (toutes commandes)
    var prodSales = {};
    ordersAll.forEach(function(o) { if (o.items) o.items.forEach(function(i) { var pid = i.productId || ''; if (pid) prodSales[pid] = (prodSales[pid] || 0) + parseInt(i.qte || i.qty || 1); }); });
    var prodSalesSorted = Object.keys(prodSales).sort(function(a, b) { return prodSales[b] - prodSales[a]; });
    var productsMap = this._getProductsMap();
    var bestProd = prodSalesSorted.length ? productsMap[prodSalesSorted[0]] : null;
    var worstProd = prodSalesSorted.length > 1 ? productsMap[prodSalesSorted[prodSalesSorted.length - 1]] : null;
    var bestName = bestProd ? bestProd.nom : '—';
    var worstName = worstProd ? worstProd.nom : '—';
    // Abandon panier
    var totalAdds = d.totalAddToCart || 0;
    var totalRemoves = d.totalRemoveFromCart || 0;
    var abandonRate = totalAdds > 0 ? Math.round(totalRemoves / totalAdds * 100) : 0;
    // Revenu mois courant
    var now = new Date();
    var monthRevenue = 0;
    ordersAll.forEach(function(o) {
      if (!o.created_at) return;
      var od = new Date(o.created_at);
      if (od.getMonth() === now.getMonth() && od.getFullYear() === now.getFullYear()) monthRevenue += (o.total || 0);
    });
    // Produits épuisés
    var products = []; try { products = JSON.parse(localStorage.getItem('sytam_products_v4') || '[]'); } catch(e) {}
    var epuises = products.filter(function(p) {
      if (!p.stock || typeof p.stock !== 'object') return true;
      var totalStock = 0;
      Object.keys(p.stock).forEach(function(sz) {
        var c = p.stock[sz];
        if (typeof c === 'object') Object.keys(c).forEach(function(col) { totalStock += parseInt(c[col]) || 0; });
        else totalStock += parseInt(c) || 0;
      });
      return totalStock === 0;
    });

    // Période filtrée pour les sections
    var filteredOrders = ordersAll;
    if (globalPeriod !== 'all') {
      var nowDate = new Date();
      if (globalPeriod === '7days') { var d7 = new Date(nowDate); d7.setDate(d7.getDate() - 7); filteredOrders = ordersAll.filter(function(o) { return o.created_at && new Date(o.created_at) >= d7; }); }
      else if (globalPeriod === 'month') { filteredOrders = ordersAll.filter(function(o) { if (!o.created_at) return false; var od = new Date(o.created_at); return od.getMonth() === nowDate.getMonth() && od.getFullYear() === nowDate.getFullYear(); }); }
      else if (globalPeriod === 'year') { filteredOrders = ordersAll.filter(function(o) { return o.created_at && new Date(o.created_at).getFullYear() === nowDate.getFullYear(); }); }
    }

    tab.innerHTML =
      // TOPBAR
      '<div class="topbar">' +
        '<div style="display:flex;align-items:center;gap:.5rem;">' +
          '<div class="hamburger" onclick="SytamAdmin.toggleSidebar()">☰</div>' +
          '<div><h1>Analytiques</h1><p>Statistiques et rapports</p></div>' +
        '</div>' +
        '<div class="topbar-right">' +
          '<select class="form-input" style="width:auto;padding:.35rem .5rem;font-size:.72rem" onchange="localStorage.setItem(\'sytam_analytics_period\',this.value);SytamAnalytics.renderAdminAnalytics()">' +
            '<option value="all"' + (globalPeriod === 'all' ? ' selected' : '') + '>Toutes les périodes</option>' +
            '<option value="7days"' + (globalPeriod === '7days' ? ' selected' : '') + '>7 jours</option>' +
            '<option value="month"' + (globalPeriod === 'month' ? ' selected' : '') + '>Ce mois</option>' +
            '<option value="year"' + (globalPeriod === 'year' ? ' selected' : '') + '>Cette année</option>' +
          '</select>' +
          '<button class="btn-add btn-sm" onclick="SytamAdmin.syncAnalytics()" style="font-size:.75rem">🔄 Synchroniser</button>' +
          '<button class="btn-add btn-sm" onclick="SytamAnalytics.exportCSVFile()" style="font-size:.75rem;background:var(--ok)">⬇ CSV événements</button>' +
          '<button class="btn-add btn-sm" onclick="SytamAnalytics.exportProductCSV()" style="font-size:.75rem;background:var(--gold)">⬇ CSV produits</button>' +
        '</div>' +
      '</div>' +
      // SECTION 1 — KPIs (7 cards)
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div><div class="stat-val">' + (d.totalVisits || 0) + '</div><div class="stat-lbl">Vues totales</div><div class="stat-sub">Ajd : ' + (daily.visits || 0) + '</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div class="stat-val">' + (d.totalUnique || 0) + '</div><div class="stat-lbl">Visiteurs uniques</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div><div class="stat-val">' + conversionGlobal + '%</div><div class="stat-lbl">Tx conversion</div><div class="stat-sub">Commandes / Vues</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div><div class="stat-val">' + confirmedOrders + '</div><div class="stat-lbl">Commandes confirmées</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="#3B6D11" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div><div class="stat-val">' + (bestName.length > 18 ? bestName.slice(0,16) + '…' : bestName) + '</div><div class="stat-lbl">⭐ Meilleure vente</div><div class="stat-sub">' + (prodSalesSorted.length ? prodSales[prodSalesSorted[0]] : 0) + ' unités</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="#A32D2D" stroke-width="2"><path d="M10 14L21 3M21 3l-7 18-4-7-7-4 18-7z"/></svg></div><div class="stat-val">' + (worstName.length > 18 ? worstName.slice(0,16) + '…' : worstName) + '</div><div class="stat-lbl">⚠ Moins vendue</div><div class="stat-sub">' + (prodSalesSorted.length > 1 ? prodSales[prodSalesSorted[prodSalesSorted.length - 1]] : 0) + ' unités</div></div>' +
        '<div class="stat-card" onclick="document.querySelector(\'[data-anafilter=\\\'inactif\\\']\').click();document.getElementById(\'anaProdSection\').scrollIntoView({behavior:\'smooth\'})" style="cursor:pointer"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="var(--er)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div><div class="stat-val">' + epuises.length + '</div><div class="stat-lbl">🚫 Produits épuisés</div><div class="stat-sub">Cliquez pour voir</div></div>' +
      '</div>' +
      // SECTION 2+3: Graphique (60%) + Historique journalier (40%)
      '<div class="analytics-chart-grid">' +
        '<div class="card" style="margin-bottom:0">' +
          '<div class="card-title">' +
            'Visites &amp; ventes' +
            '<span style="display:inline-flex;gap:4px;font-weight:400">' +
              '<button class="btn-sm ' + (chartRange === '7' ? 'btn-add' : 'btn-del') + '" onclick="SytamAnalytics._setChartRange(7)" style="padding:2px 8px;font-size:.65rem;border:none;border-radius:4px">7 jours</button>' +
              '<button class="btn-sm ' + (chartRange === '30' ? 'btn-add' : 'btn-del') + '" onclick="SytamAnalytics._setChartRange(30)" style="padding:2px 8px;font-size:.65rem;border:none;border-radius:4px">30 jours</button>' +
            '</span>' +
          '</div>' +
          '<div id="analyticsChart">' + this._renderChart(d.dailyStats, parseInt(chartRange)) + '</div>' +
        '</div>' +
        '<div class="card" style="margin-bottom:0">' +
          '<div class="card-title">Historique journalier <span style="font-weight:400;font-size:.75rem;color:var(--tl)">(' + (days || 0) + ' jours)</span></div>' +
          '<div id="analyticsDailyHistory" style="max-height:320px;overflow-y:auto">' + this._renderDailyHistory(d.dailyStats) + '</div>' +
        '</div>' +
      '</div>' +
      // SECTION 4 — Analyse comportementale par produit (CARTES)
      '<div class="card" id="anaProdSection">' +
        '<div class="card-title">' +
          'Analyse comportementale par produit <span style="font-weight:400;font-size:.75rem;color:var(--tl)">clics, ventes, tailles, couleurs</span>' +
          '<span style="display:inline-flex;gap:4px;font-weight:400;margin-left:8px">' +
            '<button class="btn-sm btn-add" data-anafilter="all" onclick="SytamAnalytics._setProdFilter(\'all\')" style="padding:2px 8px;font-size:.65rem;border:none;border-radius:4px">Tous</button>' +
            '<button class="btn-sm btn-del" data-anafilter="top" onclick="SytamAnalytics._setProdFilter(\'top\')" style="padding:2px 8px;font-size:.65rem;border:none;border-radius:4px">★ Top</button>' +
            '<button class="btn-sm btn-del" data-anafilter="actif" onclick="SytamAnalytics._setProdFilter(\'actif\')" style="padding:2px 8px;font-size:.65rem;border:none;border-radius:4px">✓ Actifs</button>' +
            '<button class="btn-sm btn-del" data-anafilter="faible" onclick="SytamAnalytics._setProdFilter(\'faible\')" style="padding:2px 8px;font-size:.65rem;border:none;border-radius:4px">⚠ Faibles</button>' +
            '<button class="btn-sm btn-del" data-anafilter="inactif" onclick="SytamAnalytics._setProdFilter(\'inactif\')" style="padding:2px 8px;font-size:.65rem;border:none;border-radius:4px">❄ Inactifs</button>' +
          '</span>' +
        '</div>' +
        '<div id="analyticsProductCards">' + this._renderProductAnalysisCards('all') + '</div>' +
      '</div>' +
      // SECTION 5 — Détails par produit (tableau)
      '<div class="card">' +
        '<div class="card-title">Détails par produit</div>' +
        '<div id="analyticsProductDetail">' + this._renderProductDetail(d) + '</div>' +
      '</div>' +
      // SECTION 6 — Quartiers enrichis
      '<div class="card">' +
        '<div class="card-title">Quartiers &amp; régions <span style="font-weight:400;font-size:.75rem;color:var(--tl)">(commandes confirmées)</span></div>' +
        '<div id="analyticsQuartiers">' + this._renderQuartierChart() + '</div>' +
      '</div>' +
      // SECTION 7 — Comportement session
      '<div class="card">' +
        '<div class="card-title">Comportement client <span style="font-weight:400;font-size:.75rem;color:var(--tl)">(sessions)</span></div>' +
        '<div id="analyticsSessions">' + this._renderSessionBehavior() + '</div>' +
      '</div>' +
      // SECTION 8 — Suivi clients amélioré
      '<div class="card">' +
        '<div class="card-title">Suivi clients</div>' +
        '<div id="analyticsCustomers">' + this._renderCustomerTracking() + '</div>' +
      '</div>' +
      // SECTION 9 — Journal temps réel
      '<div class="card">' +
        '<div class="card-title">Journal d\'activité <span style="font-size:.6rem;background:#4caf50;color:#fff;padding:1px 6px;border-radius:3px;vertical-align:middle;animation:pulse 1.5s infinite">EN DIRECT</span>' +
          '<span style="display:inline-flex;gap:4px;font-weight:400;margin-left:8px;font-size:.7rem">' +
            '<button class="btn-sm btn-add" data-logfilter="all" onclick="SytamAnalytics._setLogFilter(\'all\')" style="padding:1px 6px;font-size:.6rem;border:none;border-radius:3px">Tout</button>' +
            '<button class="btn-sm btn-del" data-logfilter="order" onclick="SytamAnalytics._setLogFilter(\'order\')" style="padding:1px 6px;font-size:.6rem;border:none;border-radius:3px">Commandes</button>' +
            '<button class="btn-sm btn-del" data-logfilter="abandon" onclick="SytamAnalytics._setLogFilter(\'abandon\')" style="padding:1px 6px;font-size:.6rem;border:none;border-radius:3px">Abandons</button>' +
            '<button class="btn-sm btn-del" data-logfilter="cart" onclick="SytamAnalytics._setLogFilter(\'cart\')" style="padding:1px 6px;font-size:.6rem;border:none;border-radius:3px">Paniers</button>' +
          '</span>' +
        '</div>' +
        '<div id="analyticsEventLog" style="max-height:400px;overflow-y:auto">' + this._renderEventLog() + '</div>' +
      '</div>';
    this._startLogTimer();
  },
  _setProdFilter(filter) {
    var el = document.getElementById('analyticsProductCards');
    if (el) el.innerHTML = this._renderProductAnalysisCards(filter);
    document.querySelectorAll('[data-anafilter]').forEach(function(b) { b.className = 'btn-sm ' + (b.dataset.anafilter === filter ? 'btn-add' : 'btn-del'); });
  },
  _setLogFilter(filter) {
    localStorage.setItem('sytam_log_filter', filter);
    var el = document.getElementById('analyticsEventLog');
    if (el) el.innerHTML = this._renderEventLog();
    document.querySelectorAll('[data-logfilter]').forEach(function(b) { b.className = 'btn-sm ' + (b.dataset.logfilter === filter ? 'btn-add' : 'btn-del'); });
  },

  _setChartRange(days) {
    localStorage.setItem('sytam_chart_range', String(days));
    this.renderAdminAnalytics();
  },

  _renderChart(dailyStats, range) {
    if (!dailyStats) return '<p style="color:var(--tl);font-size:.82rem;padding:16px 0;text-align:center">Aucune donnée</p>';
    if (!range) range = 7;
    var days = [];
    var now = new Date();
    for (var i = range - 1; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    var orders = this._getOrders();
    var ordersByDate = {};
    orders.forEach(function(o) {
      if (!o.created_at) return;
      var od = o.created_at.slice(0, 10);
      if (!ordersByDate[od]) ordersByDate[od] = 0;
      ordersByDate[od]++;
    });
    var dataPoints = days.map(function(date) {
      var day = dailyStats[date] || {};
      return { date: date, visits: day.visits || 0, clicks: day.clicks || 0, carts: day.addToCart || 0, orders: ordersByDate[date] || 0 };
    });
    var maxVal = 1;
    dataPoints.forEach(function(p) { maxVal = Math.max(maxVal, p.visits, p.orders); });
    if (maxVal < 5) maxVal = 5;
    var W = 700, H = 240, pad = { top: 20, right: 20, bottom: 32, left: 48 };
    var chartW = W - pad.left - pad.right;
    var chartH = H - pad.top - pad.bottom;
    var scaleX = function(i) { return pad.left + (i / Math.max(days.length - 1, 1)) * chartW; };
    var scaleY = function(v) { return pad.top + chartH - (v / maxVal) * chartH; };
    var lines = [
      { key: 'visits', color: '#B8956A', label: 'Vues' },
      { key: 'orders', color: '#A32D2D', label: 'Commandes' },
    ];
    // Grille horizontale
    var yStep = Math.max(1, Math.ceil(maxVal / 5));
    var yGrid = '';
    var yLabels = '';
    for (var y = 0; y <= maxVal; y += yStep) {
      var yy = scaleY(y);
      yGrid += '<line x1="' + pad.left + '" y1="' + yy + '" x2="' + (W - pad.right) + '" y2="' + yy + '" stroke="#E8E0D6" stroke-width="0.5"/>';
      yLabels += '<text x="' + (pad.left - 8) + '" y="' + (yy + 3) + '" text-anchor="end" font-size="8" fill="#B5A594">' + y + '</text>';
    }
    // Courbes lissées (cubic bezier par segments)
    function _smoothPath(points) {
      if (points.length < 2) return '';
      var pts = points.map(function(p) { return p.split(',').map(Number); });
      var d = 'M' + pts[0][0] + ',' + pts[0][1];
      for (var i = 1; i < pts.length; i++) {
        var prev = pts[i - 1], cur = pts[i];
        var cpx1 = prev[0] + (cur[0] - prev[0]) * 0.5, cpx2 = prev[0] + (cur[0] - prev[0]) * 0.5;
        d += ' C ' + cpx1 + ',' + prev[1] + ' ' + cpx2 + ',' + cur[1] + ' ' + cur[0] + ',' + cur[1];
      }
      return d;
    }
    var paths = lines.map(function(line) {
      var pts = dataPoints.map(function(p, idx) { return scaleX(idx) + ',' + scaleY(p[line.key]); });
      var fillPoints = [scaleX(0) + ',' + scaleY(0)].concat(pts).concat([scaleX(dataPoints.length - 1) + ',' + scaleY(0)]);
      var fillPath = _smoothPath(fillPoints);
      return '<path d="' + fillPath + '" fill="' + line.color + '" fill-opacity="0.05" stroke="none"/>' +
        '<path d="' + _smoothPath(pts) + '" fill="none" stroke="' + line.color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    }).join('');
    // Points avec valeurs
    var dots = lines.map(function(line) {
      return dataPoints.map(function(p, idx) {
        var cx = scaleX(idx), cy = scaleY(p[line.key]);
        var val = p[line.key];
        return '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="' + line.color + '" stroke="#fff" stroke-width="1.5"/>' +
          (val > 0 ? '<text x="' + cx + '" y="' + (cy - 8) + '" text-anchor="middle" font-size="7" font-weight="bold" fill="' + line.color + '">' + val + '</text>' : '');
      }).join('');
    }).join('');
    // Axe X avec jour/mois
    var everyN = range > 14 ? 4 : (range > 7 ? 2 : 1);
    var xLabels = days.map(function(date, idx) {
      if (idx % everyN === 0 || idx === days.length - 1) {
        var label = date.slice(8, 10) + '/' + date.slice(5, 7);
        return '<text x="' + scaleX(idx) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="8" fill="#B5A594">' + label + '</text>';
      }
      return '';
    }).join('');
    // Légende moderne en bas
    var legend = lines.map(function(line) {
      return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:.75rem;color:var(--tl);margin:0 10px 4px 0"><span style="display:inline-block;width:16px;height:3px;border-radius:2px;background:' + line.color + '"></span>' + line.label + '</span>';
    }).join('');
    return '<div><svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:100%;height:auto">' + yGrid + paths + dots + yLabels + xLabels + '</svg><div style="margin-top:8px;display:flex;flex-wrap:wrap;justify-content:center;gap:0">' + legend + '</div></div>';
  },

  _renderDailyHistory(dailyStats) {
    if (!dailyStats) return '';
    var days = Object.keys(dailyStats).sort().reverse();
    if (days.length === 0) return '';
    var orders = this._getOrders();
    var ordersByDate = {};
    orders.forEach(function(o) {
      if (!o.created_at) return;
      var d = o.created_at.slice(0, 10);
      if (!ordersByDate[d]) ordersByDate[d] = 0;
      ordersByDate[d]++;
    });
    var rows = days.map(function(date) {
      var day = dailyStats[date];
      var cmdCount = ordersByDate[date] || 0;
      var tauxConv = day.visits > 0 ? ((cmdCount / day.visits) * 100).toFixed(1) + '%' : '—';
      return '<tr>' +
        '<td style="padding:4px 6px;white-space:nowrap;font-weight:500;font-size:.78rem">' + date.slice(5) + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.78rem;white-space:nowrap">' + (day.visits || 0) + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.78rem;white-space:nowrap">' + (day.clicks || 0) + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.78rem;white-space:nowrap">' + (day.addToCart || 0) + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.72rem;white-space:nowrap;color:var(--er)">' + (day.removeFromCart || 0) + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.78rem;white-space:nowrap;font-weight:600;color:var(--ok)">' + cmdCount + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.72rem;white-space:nowrap;font-weight:500;color:var(--gold)">' + tauxConv + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.72rem;white-space:nowrap;color:var(--tl)">' + (day.timeSeconds ? SytamAnalytics._fmtTime(day.timeSeconds) : '—') + '</td>' +
      '</tr>';
    }).join('');
    return '<div class="tbl-wrap"><table style="font-size:.82rem"><thead><tr>' +
      '<th style="text-align:left;padding:4px 6px;font-size:.6rem">Date</th><th style="text-align:center;padding:4px 6px;font-size:.6rem">Vues</th>' +
      '<th style="text-align:center;padding:4px 6px;font-size:.6rem">Clics</th><th style="text-align:center;padding:4px 6px;font-size:.6rem">Panier+</th>' +
      '<th style="text-align:center;padding:4px 6px;font-size:.6rem">Retiré</th><th style="text-align:center;padding:4px 6px;font-size:.6rem">Cmd</th>' +
      '<th style="text-align:center;padding:4px 6px;font-size:.6rem" title="Taux de conversion = Commandes ÷ Vues">Conv.<br><span style="font-weight:400;font-size:.55rem">Cmd/Vues</span></th><th style="text-align:center;padding:4px 6px;font-size:.6rem">Temps</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  },

  _getProductsMap() {
    try { var p = JSON.parse(localStorage.getItem('sytam_products_v4') || '[]'); var m = {}; p.forEach(function(x) { if (x && x.id) m[x.id] = x; }); return m; } catch(e) { return {}; }
  },

  _renderProductDetail(d) {
    var allIds = {};
    var clicks = d.productClicks || {};
    var carts = d.addToCart || {};
    var removes = d.removeFromCart || {};
    var colorStats = d.colorStats || {};
    Object.keys(clicks).forEach(function(k) { allIds[k] = true; });
    Object.keys(carts).forEach(function(k) { allIds[k] = true; });
    Object.keys(removes).forEach(function(k) { allIds[k] = true; });
    var ids = Object.keys(allIds);
    if (!ids.length) return '<p style="color:var(--tl);font-size:.85rem;padding:12px 0">Aucune donnée produit</p>';
    var products = this._getProductsMap();
    var nameMap = {};
    var allOrders = this._getOrders().filter(function(o) { return o.statut === 'confirmee' || o.statut === 'livree'; });
    var items = ids.map(function(id) {
      var c = clicks[id] || {};
      var a = carts[id] || {};
      var r = removes[id] || {};
      var p = products[id];
      if (!p) {
        if (!nameMap._built) {
          try { var all = JSON.parse(localStorage.getItem('sytam_products_v4') || '[]'); all.forEach(function(x) { if (x && x.nom) nameMap[x.nom] = x; }); } catch(e) {}
          nameMap._built = true;
        }
        p = nameMap[c.name || a.name || r.name || id];
      }
      var colStats = colorStats[id] || {};
      var cmdCount = 0, cmdQty = 0;
      allOrders.forEach(function(o) {
        if (o.items) o.items.forEach(function(item) {
          if (item.productId === id || (item.id && item.id === id) || item.nom === (p ? p.nom : null) || item.nom === (c.name || a.name || r.name || id)) {
            cmdCount++;
            cmdQty += parseInt(item.quantite || item.qty || 1);
          }
        });
      });
      var stockTotal = 0;
      if (p && p.stocks) {
        Object.keys(p.stocks).forEach(function(col) {
          Object.keys(p.stocks[col]).forEach(function(tail) { stockTotal += parseInt(p.stocks[col][tail] || 0); });
        });
      }
      var hasRemoveTracking = removes && removes[id];
      var revenueGen = (p ? p.prix : 0) * cmdQty;
      return {
        id: id, name: c.name || a.name || r.name || id,
        clicks: c.count || 0, cart: a.count || 0, remove: r.count || 0, hasRemoveTracking: hasRemoveTracking,
        img: p && p.images && p.images[0] ? p.images[0] : '',
        colors: p && p.colors ? p.colors : [],
        prix: p ? p.prix : 0, stockTotal: stockTotal,
        cmdCount: cmdCount, cmdQty: cmdQty, revenueGen: revenueGen,
        p: p, colorStats: colStats,
      };
    });
    items.sort(function(a, b) { return b.cmdCount - a.cmdCount; });
    var maxCmd = items.length > 0 ? items[0].cmdCount : 0;
    var minCmd = items.length > 0 ? items[items.length - 1].cmdCount : 0;
    var rows = items.map(function(item, i) {
      var conversion = item.clicks > 0 ? ((item.cmdCount / item.clicks) * 100).toFixed(1) + '%' : '—';
      var imgHtml = item.img ? '<img src="' + item.img + '" style="width:32px;height:32px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:6px">' : '';
      var stockLabel = item.stockTotal > 0 ? '<span style="color:var(--ok)">' + item.stockTotal + '</span>' : '<span style="color:var(--er)">Épuisé</span>';
      var badge = '';
      if (item.cmdCount === maxCmd && maxCmd > 0) badge = ' <span style="font-size:.6rem;background:#fff3cd;color:#856404;padding:1px 5px;border-radius:3px">⭐ Top vente</span>';
      else if (item.cmdCount === minCmd && minCmd < maxCmd && item.cmdCount === 0) badge = ' <span style="font-size:.6rem;background:#f8d7da;color:#721c24;padding:1px 5px;border-radius:3px">⚠️ Faible</span>';
      var colorRows = '';
      var colNames = Object.keys(item.colorStats);
      if (colNames.length) {
        colorRows = '<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:2px">';
        colNames.forEach(function(colName) {
          var cs = item.colorStats[colName];
          var cmdColor = 0;
          allOrders.forEach(function(o) {
            if (o.items) o.items.forEach(function(item2) {
              if ((item2.productId === item.id || item2.nom === item.name) && item2.couleur === colName) cmdColor += parseInt(item2.quantite || item2.qty || 0);
            });
          });
          colorRows += '<span style="font-size:.65rem;background:var(--cr);border:1px solid var(--bd);border-radius:3px;padding:1px 5px;white-space:nowrap">' +
            colName + ' clics:' + (cs.clicks || 0) + ' +:' + (cs.addToCart || 0) + ' -:' + (cs.removeFromCart || 0) + ' cmd:' + cmdColor +
          '</span>';
        });
        colorRows += '</div>';
      }
      return '<tr>' +
        '<td style="padding:6px 8px;font-weight:600;color:var(--tl);font-size:.78rem;white-space:nowrap">#' + (i + 1) + '</td>' +
        '<td style="padding:6px 8px;font-size:.82rem">' + imgHtml + '<span style="font-weight:600">' + item.name + '</span>' + badge + '<br><span style="font-size:.7rem;color:var(--tl)">' + _fmtAnalytics(item.prix) + ' FCFA</span>' + colorRows + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.78rem;white-space:nowrap">' + item.clicks + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.78rem;white-space:nowrap;color:var(--ok)">' + item.cart + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.78rem;white-space:nowrap;color:var(--er)">' + (item.hasRemoveTracking ? item.remove : '—') + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.78rem;white-space:nowrap;font-weight:600">' + item.cmdCount + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.78rem;white-space:nowrap;color:var(--gold)">' + conversion + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.78rem;white-space:nowrap">' + stockLabel + '</td>' +
        '<td style="padding:6px 8px;text-align:right;font-size:.78rem;white-space:nowrap;font-weight:600;color:var(--ok)">' + _fmtAnalytics(item.revenueGen) + ' F</td>' +
      '</tr>';
    }).join('');
    return '<div class="tbl-wrap"><table style="font-size:.82rem"><thead><tr>' +
      '<th style="width:30px">#</th><th style="text-align:left">Produit</th><th style="text-align:center">Clics</th><th style="text-align:center">Panier+</th>' +
      '<th style="text-align:center">Retiré</th><th style="text-align:center">Commandes</th><th style="text-align:center">Conv.</th><th style="text-align:center">Stock</th><th style="text-align:right">Revenu</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  },

  _renderSessionBehavior() {
    var sessions = this._getSessions();
    if (!sessions.length) return '<p style="color:var(--tl);font-size:.82rem;padding:12px 0">Aucune session enregistrée</p>';
    var total = sessions.length;
    var withOrder = sessions.filter(function(s) { return s.result === 'Commande confirmée'; }).length;
    var abandoned = sessions.filter(function(s) { return s.result === 'Abandon'; }).length;
    var browsing = sessions.filter(function(s) { return s.result === 'Navigation seule'; }).length;
    var avgDuration = Math.round(sessions.reduce(function(sum, s) { return sum + s.duration; }, 0) / total);
    var avgPages = Math.round(sessions.reduce(function(sum, s) { return sum + s.pages.length; }, 0) / total * 10) / 10;
    var convRate = total > 0 ? (withOrder / total * 100).toFixed(1) : 0;
    var abandonRate = total > 0 ? (abandoned / total * 100).toFixed(1) : 0;
    var topProducts = {};
    sessions.forEach(function(s) {
      s.productsClicked.forEach(function(p) { topProducts[p] = (topProducts[p] || 0) + 1; });
    });
    var topSorted = Object.keys(topProducts).sort(function(a, b) { return topProducts[b] - topProducts[a]; }).slice(0, 5);
    var topList = topSorted.length ? topSorted.map(function(p) { return '<div style="font-size:.72rem;margin:2px 0">✦ ' + p + ' (' + topProducts[p] + ')</div>'; }).join('') : '<span style="color:var(--tl);font-size:.72rem">Aucun</span>';

    // Mini tableau des 10 dernières sessions (simplifié)
    var recent = sessions.slice(0, 10);
    var miniRows = recent.map(function(s) {
      var dateStr = s.start ? new Date(s.start).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
      var durStr = SytamAnalytics._fmtTime(s.duration);
      var color = s.result === 'Commande confirmée' ? 'var(--ok)' : (s.result === 'Abandon' ? 'var(--er)' : 'var(--tl)');
      return '<tr><td style="padding:3px 6px;font-size:.7rem;color:var(--tl)">' + dateStr + '</td>' +
        '<td style="padding:3px 6px;text-align:center;font-size:.7rem">' + durStr + '</td>' +
        '<td style="padding:3px 6px;text-align:center;font-size:.7rem">' + s.pages.length + '</td>' +
        '<td style="padding:3px 6px;text-align:center;font-size:.7rem;font-weight:600;color:' + color + '">' + s.result + '</td></tr>';
    }).join('');

    return '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">' +
      '<div class="stat-box" style="background:var(--bg-card);padding:12px;border-radius:6px;border:1px solid var(--bd)"><div style="font-size:1.2rem;font-weight:700;color:var(--tx)">' + total + '</div><div style="font-size:.7rem;color:var(--tl)">Sessions totales</div></div>' +
      '<div class="stat-box" style="background:var(--bg-card);padding:12px;border-radius:6px;border:1px solid var(--ok);"><div style="font-size:1.2rem;font-weight:700;color:var(--ok)">' + convRate + '%</div><div style="font-size:.7rem;color:var(--tl)">Taux de conversion</div><div style="font-size:.65rem;color:var(--tl)">' + withOrder + ' commandes</div></div>' +
      '<div class="stat-box" style="background:var(--bg-card);padding:12px;border-radius:6px;border:1px solid var(--er);"><div style="font-size:1.2rem;font-weight:700;color:var(--er)">' + abandonRate + '%</div><div style="font-size:.7rem;color:var(--tl)">Taux d\'abandon</div><div style="font-size:.65rem;color:var(--tl)">' + abandoned + ' paniers</div></div>' +
      '<div class="stat-box" style="background:var(--bg-card);padding:12px;border-radius:6px;border:1px solid var(--bd)"><div style="font-size:1.2rem;font-weight:700;color:var(--tx)">' + this._fmtTime(avgDuration) + '</div><div style="font-size:.7rem;color:var(--tl)">Durée moyenne</div></div>' +
      '<div class="stat-box" style="background:var(--bg-card);padding:12px;border-radius:6px;border:1px solid var(--bd)"><div style="font-size:1.2rem;font-weight:700;color:var(--tx)">' + avgPages + '</div><div style="font-size:.7rem;color:var(--tl)">Pages vues en moyenne</div></div>' +
      '<div class="stat-box" style="background:var(--bg-card);padding:12px;border-radius:6px;border:1px solid var(--bd)"><div style="font-size:.7rem;font-weight:600;color:var(--tx);margin-bottom:4px">Top produits cliqués</div>' + topList + '</div>' +
      '</div>' +
      '<details style="margin-top:8px"><summary style="font-size:.78rem;font-weight:600;cursor:pointer;color:var(--tx)">📋 10 dernières sessions</summary>' +
      '<div class="tbl-wrap" style="margin-top:8px"><table style="font-size:.72rem"><thead><tr>' +
      '<th style="text-align:left;padding:3px 6px;font-size:.6rem">Date</th><th style="text-align:center;padding:3px 6px;font-size:.6rem">Durée</th>' +
      '<th style="text-align:center;padding:3px 6px;font-size:.6rem">Pages</th><th style="text-align:center;padding:3px 6px;font-size:.6rem">Résultat</th></tr></thead><tbody>' + miniRows + '</tbody></table></div></details>';
  },

  _renderQuartierChart() {
    var orders = this._getOrders().filter(function(o) { return o.statut === 'confirmee' || o.statut === 'livree'; });
    if (!orders.length) return '<p style="color:var(--tl);font-size:.82rem;padding:12px 0">Aucune commande confirmée</p>';
    // Quartiers + régions
    var counts = {}, regionCounts = {}, quartierTotals = {}, quartierNotFound = 0;
    orders.forEach(function(o) {
      var q = '';
      if (o.quartier) { q = o.quartier; } else if (o.adresse) { var addr = o.adresse.split(',')[0].trim(); q = addr; }
      if (q) {
        if (!counts[q]) counts[q] = 0;
        counts[q]++;
        if (!quartierTotals[q]) quartierTotals[q] = 0;
        quartierTotals[q] += (o.total || 0);
      } else { quartierNotFound++; }
      var r = o.region || 'Non spécifié';
      regionCounts[r] = (regionCounts[r] || 0) + 1;
    });
    var sorted = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; });
    var regionsSorted = Object.keys(regionCounts).sort(function(a, b) { return regionCounts[b] - regionCounts[a]; });
    if (!sorted.length) return '<p style="color:var(--tl);font-size:.82rem;padding:12px 0">Aucun quartier trouvé</p>';
    var top = sorted.slice(0, 12);
    var maxVal = counts[top[0]] || 1;
    var barH = 20, gap = 6, padLeft = 140, padRight = 40, charW = 600;
    var totalH = top.length * (barH + gap) + 10;
    var bars = top.map(function(q, i) {
      var v = counts[q];
      var barW = (v / maxVal) * (charW - padLeft - padRight);
      var y = 10 + i * (barH + gap);
      var color = 'hsl(' + (220 - i * 12) + ', 45%, 55%)';
      var avg = quartierTotals[q] > 0 ? Math.round(quartierTotals[q] / v) : 0;
      return '<rect x="' + padLeft + '" y="' + y + '" width="' + barW + '" height="' + barH + '" fill="' + color + '" rx="3" ry="3"/>' +
        '<text x="' + (padLeft - 6) + '" y="' + (y + barH - 4) + '" text-anchor="end" font-size="10" fill="var(--tl)">' + q + '</text>' +
        '<text x="' + (padLeft + barW + 4) + '" y="' + (y + 10) + '" font-size="10" fill="var(--tx)" font-weight="600">' + v + '</text>' +
        '<text x="' + (padLeft + barW + 4) + '" y="' + (y + barH - 2) + '" font-size="7" fill="var(--tl)">' + _fmtAnalytics(avg) + ' F/ cmd</text>';
    }).join('');
    var svgH = totalH;
    // Regions cards
    var regionCards = regionsSorted.slice(0, 5).map(function(r) {
      return '<div style="background:var(--bg-card);padding:6px 10px;border-radius:4px;text-align:center;min-width:80px"><div style="font-size:.75rem;font-weight:600;color:var(--tx)">' + r + '</div><div style="font-size:1rem;color:var(--tx)">' + regionCounts[r] + '</div><div style="font-size:.6rem;color:var(--tl)">commandes</div></div>';
    }).join('');
    var html =
      '<div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">' +
        '<svg viewBox="0 0 ' + charW + ' ' + svgH + '" style="max-width:100%;height:auto;flex-shrink:0">' + bars + '</svg>' +
        '<div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;min-width:120px">' +
          '<div style="font-weight:600;font-size:.75rem;color:var(--tx);margin-bottom:4px">Régions</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px">' + regionCards + '</div>' +
          '<div style="font-size:.65rem;color:var(--tl);margin-top:8px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#B8935A;vertical-align:middle;margin-right:4px"></span> Nombre commandes</div>' +
          '<div style="font-size:.65rem;color:var(--tl)"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--bg-card);vertical-align:middle;margin-right:4px;border:1px solid #ddd"></span> Montant moyen par commande</div>' +
          (quartierNotFound > 0 ? '<div style="margin-top:4px;color:var(--er);font-size:.7rem">⚠️ ' + quartierNotFound + ' commande(s) sans quartier</div>' : '') +
        '</div>' +
      '</div>';
    return html;
  },

  _renderCustomerTracking() {
    var orders = this._getOrders();
    var customers = {};
    orders.forEach(function(o) {
      var phone = (o.telephone || '').replace(/[^0-9+]/g, '');
      if (!phone) return;
      if (!customers[phone]) customers[phone] = { phone: phone, name: o.client || '—', commandes: 0, total: 0, derniere: '', produits: [] };
      customers[phone].commandes++;
      customers[phone].total += (o.total || 0);
      if (!customers[phone].derniere || o.created_at > customers[phone].derniere) customers[phone].derniere = o.created_at;
      if (o.items) o.items.forEach(function(item) {
        var pName = item.nom || '';
        if (pName && customers[phone].produits.indexOf(pName) === -1) customers[phone].produits.push(pName);
      });
    });
    var list = [];
    for (var k in customers) list.push(customers[k]);
    list.sort(function(a, b) { return b.commandes - a.commandes; });
    if (!list.length) return '<p style="color:var(--tl);font-size:.82rem;padding:12px 0">Aucun client pour le moment</p>';
    var rows = list.map(function(c, i) {
      var dateStr = c.derniere ? new Date(c.derniere).toLocaleDateString('fr-FR') : '—';
      var status, statusColor;
      if (c.commandes >= 5) { status = 'VIP'; statusColor = '#C9A96E'; }
      else if (c.commandes >= 2) { status = 'Régulier'; statusColor = 'var(--gold)'; }
      else { status = 'Nouveau'; statusColor = 'var(--tl)'; }
      var produitsStr = c.produits.join(', ');
      produitsStr = produitsStr.length > 50 ? produitsStr.slice(0, 50) + '…' : produitsStr;
      return '<tr onclick="SytamAnalytics.showCustomerOrders(\'' + c.phone + '\')" style="cursor:pointer">' +
        '<td style="padding:6px 8px;font-weight:600;color:var(--tl);font-size:.78rem;white-space:nowrap">#' + (i + 1) + '</td>' +
        '<td style="padding:6px 8px;font-size:.82rem;white-space:nowrap">' + c.name + '</td>' +
        '<td style="padding:6px 8px;font-size:.78rem;white-space:nowrap">' + c.phone + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-weight:600;font-size:.82rem;white-space:nowrap">' + c.commandes + '</td>' +
        '<td style="padding:6px 8px;text-align:right;font-size:.82rem;font-weight:600;white-space:nowrap">' + _fmtAnalytics(c.total) + ' FCFA</td>' +
        '<td style="padding:6px 8px;font-size:.72rem;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + produitsStr + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.75rem;color:var(--tl);white-space:nowrap">' + dateStr + '</td>' +
        '<td style="padding:6px 8px;text-align:center;white-space:nowrap"><span style="font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:10px;background:' + statusColor + '20;color:' + statusColor + '">' + status + '</span></td>' +
      '</tr>';
    }).join('');
    return '<div class="tbl-wrap"><table style="font-size:.82rem"><thead><tr>' +
      '<th style="width:30px">#</th><th style="text-align:left">Client</th><th style="text-align:left">Contact</th>' +
      '<th style="text-align:center">Commandes</th><th style="text-align:right">Total</th>' +
      '<th style="text-align:left">Produits achetés</th><th style="text-align:center">Dernière</th><th style="text-align:center">Statut</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  },

  showCustomerOrders(phone) {
    var orders = this._getOrders().filter(function(o) {
      return (o.telephone || '').replace(/[^0-9+]/g, '') === phone;
    });
    if (!orders.length) return;
    var client = orders[0].client || 'Client';
    var rows = orders.map(function(o) {
      var items = o.items ? o.items.map(function(item) { return (item.nom || item.productName || '') + ' x' + (item.quantite || item.qty || 1); }).join(', ') : '—';
      var statusColor = 'var(--ok)';
      if (o.statut === 'en_attente') statusColor = 'var(--wa)';
      else if (o.statut === 'annulee') statusColor = 'var(--er)';
      return '<tr>' +
        '<td style="padding:4px 6px;font-size:.75rem;white-space:nowrap">#' + (o.numero || '—') + '</td>' +
        '<td style="padding:4px 6px;font-size:.75rem">' + items + '</td>' +
        '<td style="padding:4px 6px;text-align:right;font-size:.75rem;white-space:nowrap;font-weight:600">' + _fmtAnalytics(o.total || 0) + ' F</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.7rem;white-space:nowrap;font-weight:600;color:' + statusColor + '">' + (o.statut || '—') + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.7rem;color:var(--tl);white-space:nowrap">' + (o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : '—') + '</td>' +
      '</tr>';
    }).join('');
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<h2 style="font-family:var(--font-serif);font-size:1.2rem;font-weight:600">Commandes de ' + client + '</h2>' +
      '<button onclick="document.getElementById(\'modalOv\').classList.remove(\'open\')" style="background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--tl)">✕</button>' +
    '</div>' +
    '<div class="tbl-wrap"><table style="width:100%;font-size:.82rem;border-collapse:collapse"><thead><tr>' +
      '<th style="text-align:left;padding:4px 6px;font-size:.6rem;text-transform:uppercase;color:var(--tl);border-bottom:1px solid var(--bd)">N°</th>' +
      '<th style="text-align:left;padding:4px 6px;font-size:.6rem;text-transform:uppercase;color:var(--tl);border-bottom:1px solid var(--bd)">Articles</th>' +
      '<th style="text-align:right;padding:4px 6px;font-size:.6rem;text-transform:uppercase;color:var(--tl);border-bottom:1px solid var(--bd)">Total</th>' +
      '<th style="text-align:center;padding:4px 6px;font-size:.6rem;text-transform:uppercase;color:var(--tl);border-bottom:1px solid var(--bd)">Statut</th>' +
      '<th style="text-align:center;padding:4px 6px;font-size:.6rem;text-transform:uppercase;color:var(--tl);border-bottom:1px solid var(--bd)">Date</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    var m = document.getElementById('modal');
    if (m) m.innerHTML = html;
    var ov = document.getElementById('modalOv');
    if (ov) ov.classList.add('open');
  },

  _renderEventLog() {
    var logFilter = localStorage.getItem('sytam_log_filter') || 'all';
    var events = this._events.slice(-300).reverse();
    if (!events.length) return '<p style="color:var(--tl);font-size:.82rem;padding:12px 0">Aucun événement pour le moment — les actions des visiteurs apparaîtront ici en direct.</p>';
    if (logFilter === 'order') events = events.filter(function(e) { return e.t === 'order_placed'; });
    else if (logFilter === 'abandon') events = events.filter(function(e) { return e.t === 'checkout_start' || e.t === 'remove_from_cart'; });
    else if (logFilter === 'cart') events = events.filter(function(e) { return e.t === 'add_to_cart' || e.t === 'remove_from_cart' || e.t === 'qty_change'; });
    events = events.slice(0, 50);
    var rows = events.map(function(e) {
      var time = e.ts ? e.ts.slice(11, 19) : '';
      var d = e.d || {};
      var msg = '';
      var detail = '';
      switch (e.t) {
        case 'page_visit':
          msg = '📄 Un visiteur a ouvert la page';
          detail = d.page || 'accueil';
          break;
        case 'product_click':
          msg = '👆 Un visiteur a cliqué sur';
          detail = d.productName || '';
          if (d.variant) detail += ' (' + d.variant + ')';
          break;
        case 'add_to_cart':
          msg = '🛒 Un visiteur a ajouté au panier';
          detail = d.productName || '';
          if (d.variant) detail += ' (' + d.variant + ')';
          if (d.qty && d.qty > 1) detail += ' x' + d.qty;
          break;
        case 'remove_from_cart':
          msg = '🗑 Un visiteur a retiré du panier';
          detail = d.productName || '';
          if (d.variant) detail += ' (' + d.variant + ')';
          break;
        case 'qty_change':
          msg = '🔢 Quantité modifiée';
          detail = (d.productName || '') + ' : ' + (d.oldQty || '?') + ' → ' + (d.newQty || '?');
          break;
        case 'search':
          msg = '🔍 Un visiteur a recherché';
          detail = '"' + (d.query || '') + '"';
          break;
        case 'checkout_start':
          msg = '💳 Un visiteur a commencé le paiement';
          detail = '';
          break;
        case 'order_placed':
          msg = '✅ Nouvelle commande passée';
          detail = '';
          if (d.total) detail = _fmtAnalytics(d.total) + ' FCFA';
          if (d.orderId) detail += (detail ? ' — ' : '') + '#' + d.orderId;
          break;
        default:
          msg = '• ' + (e.t || 'événement');
          detail = d.productName || d.query || d.page || '';
      }
      var rowBg = '';
      if (e.t === 'order_placed') rowBg = 'style="background:rgba(59,109,17,0.08)"';
      else if (e.t === 'checkout_start') rowBg = 'style="background:rgba(184,147,90,0.1)"';
      else if (e.t === 'remove_from_cart') rowBg = 'style="background:rgba(163,45,45,0.08)"';
      return '<tr ' + rowBg + '>' +
        '<td style="padding:3px 6px;font-size:.7rem;color:var(--tl);white-space:nowrap">' + time + '</td>' +
        '<td style="padding:3px 6px;font-size:.75rem">' + msg + '</td>' +
        '<td style="padding:3px 6px;font-size:.72rem;color:var(--tl);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + detail + '</td>' +
      '</tr>';
    }).join('');
    return '<div class="tbl-wrap"><table style="font-size:.82rem"><thead><tr>' +
      '<th style="width:48px;padding:4px 6px;font-size:.6rem;text-align:left;text-transform:uppercase;color:var(--tl)">Heure</th>' +
      '<th style="padding:4px 6px;font-size:.6rem;text-align:left;text-transform:uppercase;color:var(--tl)">Action</th>' +
      '<th style="padding:4px 6px;font-size:.6rem;text-align:left;text-transform:uppercase;color:var(--tl)">Détail</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    (events.length > 80 ? '<p style="font-size:.72rem;color:var(--tl);padding:6px;text-align:center">80 derniers — ' + events.length + ' événements au total</p>' : '');
  },

  // ---- NOUVEAU : Analyse comportementale par produit (cartes détaillées) ----
  _getTaille(vl) {
    if (!vl) return '';
    var m = vl.match(/Taille\s*:\s*(\S+)/i);
    return m ? m[1] : '';
  },
  _renderProductAnalysisCards(filter) {
    var orders = this._getOrders().filter(function(o) { return o.statut === 'confirmee' || o.statut === 'livree'; });
    var productsMap = this._getProductsMap();
    var agg = this._agg || {};
    var pClicks = agg.productClicks || {};
    var pCarts = agg.addToCart || {};
    var pRemoves = agg.removeFromCart || {};

    // Map nom → productId pour image/prix
    var nameToId = {};
    Object.keys(productsMap).forEach(function(k) { if (productsMap[k] && productsMap[k].nom) nameToId[productsMap[k].nom.trim().toLowerCase()] = k; });

    // Grouper par NOM de produit (évite les doublons si productId diffère entre commandes)
    var prodData = {};
    orders.forEach(function(o) {
      if (!o.items) return;
      o.items.forEach(function(item) {
        var nom = (item.nom || '').trim();
        if (!nom) return;
        var key = nom.toLowerCase();
        if (!prodData[key]) {
          var pid = item.productId || nameToId[key] || '';
          prodData[key] = { id: pid, key: key, nom: nom, prix: item.prix || 0, cmdCount: 0, qteTotal: 0, ca: 0, tailles: {}, couleurs: {} };
        }
        var d = prodData[key];
        d.cmdCount++;
        d.qteTotal += parseInt(item.qte || item.qty || 1);
        d.ca += (item.prix || 0) * parseInt(item.qte || item.qty || 1);
        var taille = this._getTaille(item.variantLabel) || '';
        var couleur = item.couleur || '';
        if (item.variantLabel) {
          var _vp = item.variantLabel.split(',').map(function(s){return s.trim();});
          _vp.forEach(function(p) {
            if (p.indexOf('taille:')===0||p.indexOf('Taille:')===0) { if (!taille) taille = p.split(':')[1].trim(); }
            if (p.indexOf('couleur:')===0||p.indexOf('Couleur:')===0) { if (!couleur) couleur = p.split(':')[1].trim(); }
          });
        }
        if (!taille) taille = 'N/D';
        if (!couleur) couleur = 'N/D';
        d.tailles[taille] = (d.tailles[taille] || 0) + parseInt(item.qte || item.qty || 1);
        d.couleurs[couleur] = (d.couleurs[couleur] || 0) + parseInt(item.qte || item.qty || 1);
      }.bind(this));
    }.bind(this));

    // Ajouter clics/ajouts/retraits depuis les analytics
    Object.keys(pClicks).forEach(function(pid) {
      var key = (pClicks[pid].name || pid).trim().toLowerCase();
      if (!prodData[key]) prodData[key] = { id: pid, key: key, nom: pClicks[pid].name || pid, prix: 0, cmdCount: 0, qteTotal: 0, ca: 0, tailles: {}, couleurs: {} };
    });

    // Enrichir avec analytics events
    Object.keys(prodData).forEach(function(key) {
      var d = prodData[key];
      var pid = d.id;
      d.clics = (pClicks[pid] && pClicks[pid].count) || 0;
      d.ajouts = (pCarts[pid] && pCarts[pid].count) || 0;
      d.retraits = (pRemoves[pid] && pRemoves[pid].count) || 0;
      d.tauxAbandon = d.ajouts > 0 ? Math.round(d.retraits / d.ajouts * 100) : 0;
      d.tauxConv = d.clics > 0 ? (d.cmdCount / d.clics * 100).toFixed(1) : '0.0';
      var maxCmd = 0; Object.keys(prodData).forEach(function(k) { if (prodData[k].cmdCount > maxCmd) maxCmd = prodData[k].cmdCount; });
      var minCmd = Infinity; Object.keys(prodData).forEach(function(k) { if (prodData[k].cmdCount < minCmd) minCmd = prodData[k].cmdCount; });
      var isTop = d.cmdCount === maxCmd && maxCmd > 0;
      var isWeak = d.cmdCount === minCmd && d.cmdCount > 0 && minCmd < maxCmd;
      var isInactive = d.cmdCount === 0 && d.clics > 0;
      d.badge = isTop ? '★ Top vente' : isWeak ? '⚠ Faible vente' : isInactive ? '❄ Inactif' : (d.cmdCount > 0 ? '✓ Actif' : '');
      d.badgeClass = isTop ? 'ok' : isWeak ? 'er' : isInactive ? 'tl' : 'tx';
    });

    // Cross-sell par nom
    var crossSell = {};
    orders.forEach(function(o) {
      if (!o.items || o.items.length < 2) return;
      var noms = o.items.map(function(i) { return (i.nom || '').trim().toLowerCase(); }).filter(Boolean);
      for (var i = 0; i < noms.length; i++) {
        for (var j = i + 1; j < noms.length; j++) {
          var pair = [noms[i], noms[j]].sort();
          var ckey = pair[0] + '|||' + pair[1];
          crossSell[ckey] = (crossSell[ckey] || 0) + 1;
        }
      }
    });

    // Appliquer le filtre
    var list = Object.keys(prodData);
    if (filter === 'top') list = list.filter(function(k) { return prodData[k].badge === '★ Top vente'; });
    else if (filter === 'faible') list = list.filter(function(k) { return prodData[k].badge === '⚠ Faible vente'; });
    else if (filter === 'inactif') list = list.filter(function(k) { return prodData[k].badge === '❄ Inactif'; });
    else if (filter === 'actif') list = list.filter(function(k) { return prodData[k].cmdCount > 0; });

    if (!list.length) return '<p style="color:var(--tl);font-size:.82rem;padding:16px;text-align:center">Aucun produit dans cette catégorie</p>';

    list.sort(function(a, b) { return prodData[b].cmdCount - prodData[a].cmdCount; });

    var cards = list.map(function(key) {
      var d = prodData[key];
      var p = productsMap[d.id] || {};
      var img = p.images && p.images[0] ? p.images[0] : '';
      var nom = d.nom;

      // Tailles barres avec nombre de commandes
      var tailleKeys = Object.keys(d.tailles);
      var tailleTotal = tailleKeys.reduce(function(s, k) { return s + d.tailles[k]; }, 0);
      var tailleBars = tailleKeys.sort().map(function(t) {
        var cnt = d.tailles[t];
        var pct = tailleTotal > 0 ? Math.round(cnt / tailleTotal * 100) : 0;
        return '<div style="font-size:.7rem;margin:3px 0;display:flex;align-items:center;gap:4px">' +
          '<span style="width:24px;flex-shrink:0;font-weight:600">' + t + '</span>' +
          '<div style="flex:1;height:14px;background:var(--bg-card);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:#B8935A;border-radius:3px;min-width:4px"></div></div>' +
          '<span style="width:40px;text-align:right;font-size:.65rem;color:var(--tx);font-weight:600">' + cnt + '</span>' +
        '</div>';
      }).join('');

      // Couleurs barres avec nombre de commandes
      var coulKeys = Object.keys(d.couleurs);
      var coulTotal = coulKeys.reduce(function(s, k) { return s + d.couleurs[k]; }, 0);
      var coulBars = coulKeys.sort().map(function(c) {
        var cnt = d.couleurs[c];
        var pct = coulTotal > 0 ? Math.round(cnt / coulTotal * 100) : 0;
        var colorDot = c.toLowerCase();
        var dotBg = colorDot === 'noir' ? '#222' : colorDot === 'blanc' ? '#fff' : colorDot === 'beige' ? '#D4B896' : colorDot === 'marron' ? '#8B5E3C' : colorDot === 'rouge' ? '#C0392B' : colorDot === 'bleu' ? '#2980B9' : colorDot === 'vert' ? '#27AE60' : colorDot === 'rose' ? '#E91E63' : colorDot === 'gris' ? '#999' : colorDot === 'doré' ? '#C9A96E' : '#B8935A';
        return '<div style="font-size:.7rem;margin:3px 0;display:flex;align-items:center;gap:4px">' +
          '<span style="width:12px;height:12px;border-radius:50%;background:' + dotBg + ';border:1px solid #ddd;flex-shrink:0"></span>' +
          '<span style="width:48px;flex-shrink:0">' + c + '</span>' +
          '<div style="flex:1;height:14px;background:var(--bg-card);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + dotBg + ';border-radius:3px;min-width:4px"></div></div>' +
          '<span style="width:40px;text-align:right;font-size:.65rem;color:var(--tx);font-weight:600">' + cnt + '</span>' +
        '</div>';
      }).join('');

      // Cross-sell
      var crossList = [];
      Object.keys(crossSell).forEach(function(ck) {
        var parts = ck.split('|||');
        if (parts[0] === key) crossList.push({ nom: parts[1], count: crossSell[ck] });
        else if (parts[1] === key) crossList.push({ nom: parts[0], count: crossSell[ck] });
      });
      crossList.sort(function(a, b) { return b.count - a.count; });
      var crossHtml = crossList.slice(0, 3).map(function(c) {
        var cName = (prodData[c.nom] && prodData[c.nom].nom) || c.nom;
        return '<span style="font-size:.68rem;color:var(--tl);display:inline-block;margin:2px 4px 2px 0;background:var(--bg-card);padding:2px 6px;border-radius:3px">' + cName + ' (' + c.count + ')</span>';
      }).join('') || '<span style="color:var(--tl);font-size:.7rem">—</span>';

      var badgeHtml = d.badge ? '<span style="display:inline-block;font-size:.65rem;font-weight:600;padding:2px 8px;border-radius:3px;background:' + (d.badgeClass === 'ok' ? 'rgba(59,109,17,0.12);color:#3B6D11' : d.badgeClass === 'er' ? 'rgba(163,45,45,0.12);color:#A32D2D' : d.badgeClass === 'tl' ? 'var(--bg-card);color:var(--tl)' : 'rgba(133,79,11,0.12);color:#854F0B') + '">' + d.badge + '</span>' : '';

      return '<div class="card" style="overflow:visible;break-inside:avoid">' +
        '<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">' +
          (img ? '<img src="' + img + '" style="width:56px;height:56px;border-radius:6px;object-fit:cover;flex-shrink:0" loading="lazy">' : '<div style="width:56px;height:56px;border-radius:6px;background:var(--bg-card);flex-shrink:0"></div>') +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:.82rem;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + nom + '</div>' +
            '<div style="font-size:.72rem;color:var(--tl);margin:2px 0">' + _fmtAnalytics(d.prix) + ' FCFA</div>' +
            badgeHtml +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">' +
          '<div style="text-align:center;background:var(--bg-card);padding:6px;border-radius:4px"><div style="font-size:1rem;font-weight:700;color:var(--tx)">' + d.clics + '</div><div style="font-size:.6rem;color:var(--tl)">Vues</div></div>' +
          '<div style="text-align:center;background:var(--bg-card);padding:6px;border-radius:4px"><div style="font-size:1rem;font-weight:700;color:var(--tx)">' + d.cmdCount + '</div><div style="font-size:.6rem;color:var(--tl)">Commandes</div></div>' +
          '<div style="text-align:center;background:var(--bg-card);padding:6px;border-radius:4px"><div style="font-size:1rem;font-weight:700;color:var(--tx)">' + d.tauxConv + '%</div><div style="font-size:.6rem;color:var(--tl)">Conversion</div></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">' +
          '<div><div style="font-size:.7rem;font-weight:600;color:var(--tl);margin-bottom:4px">Tailles</div>' + (tailleBars || '<span style="font-size:.7rem;color:var(--tl)">Aucune donnée taille</span>') + '</div>' +
          '<div><div style="font-size:.7rem;font-weight:600;color:var(--tl);margin-bottom:4px">Couleurs</div>' + (coulBars || '<span style="font-size:.7rem;color:var(--tl)">Aucune donnée couleur</span>') + '</div>' +
        '</div>' +
        '<div style="font-size:.68rem;color:var(--tl);padding-top:6px;border-top:1px solid var(--bd)">' +
          '<div><span style="font-weight:600">Ajouts panier :</span> ' + d.ajouts + ' — <span style="font-weight:600">Retraits :</span> ' + d.retraits + ' <span style="color:var(--er)">(' + d.tauxAbandon + '% abandon)</span></div>' +
          '<div style="margin-top:2px"><span style="font-weight:600">CA généré :</span> ' + _fmtAnalytics(d.ca) + ' FCFA</div>' +
          '<div style="margin-top:4px"><span style="font-weight:600">Souvent acheté avec :</span><br>' + crossHtml + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div style="column-count:2;column-gap:16px">' + cards + '</div>';
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
    var header = 'produit,prix,image,clics_total,panier_total,retires_total,taux_abandon,couleur,clics_couleur,panier_couleur,retires_couleur';
    var products = this._getProductsMap();
    var allIds = {};
    var clicks = d.productClicks || {};
    var carts = d.addToCart || {};
    var removes = d.removeFromCart || {};
    var colorStats = d.colorStats || {};
    Object.keys(clicks).forEach(function(k) { allIds[k] = true; });
    Object.keys(carts).forEach(function(k) { allIds[k] = true; });
    Object.keys(removes).forEach(function(k) { allIds[k] = true; });
    var esc = function(s) { return '"' + String(s || '').replace(/"/g, '""') + '"'; };
    var rows = [];
    Object.keys(allIds).forEach(function(id) {
      var c = clicks[id] || {}, a = carts[id] || {}, r = removes[id] || {};
      var name = c.name || a.name || r.name || id;
      var p = products[id];
      var prix = p ? p.prix : '';
      var img = p && p.images && p.images[0] ? p.images[0] : '';
      var abandon = c.count > 0 ? Math.round((1 - a.count / c.count) * 100) : 0;
      var colStats = colorStats[id] || {};
      var colNames = Object.keys(colStats);
      if (colNames.length) {
        colNames.forEach(function(col) {
          var cs = colStats[col];
          rows.push([esc(name), prix, esc(img), c.count || 0, a.count || 0, r.count || 0, abandon + '%', esc(col), cs.clicks || 0, cs.addToCart || 0, cs.removeFromCart || 0].join(','));
        });
      } else {
        rows.push([esc(name), prix, esc(img), c.count || 0, a.count || 0, r.count || 0, abandon + '%', '', '', '', ''].join(','));
      }
    });
    var csv = header + '\n' + rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sytam_analytics_produits_' + this._todayKey() + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  },
};
