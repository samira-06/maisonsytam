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

  renderAdminAnalytics() {
    var tab = document.getElementById('tab-analytics');
    if (!tab || !this._agg) return;
    var d = this._agg;
    var daily = d.dailyStats[this._todayKey()] || {};
    var totalOrders = this._countOrders();
    var confirmedOrders = this._countOrders('confirmee') + this._countOrders('livree');
    var revenue = this._totalRevenue();
    var panierMoyen = confirmedOrders > 0 ? Math.round(revenue / confirmedOrders) : 0;
    var conversionGlobal = d.totalVisits > 0 ? ((confirmedOrders / d.totalVisits) * 100).toFixed(1) : '0.0';
    var cartConversion = d.totalVisits > 0 ? ((d.totalAddToCart / d.totalVisits) * 100).toFixed(1) : '0.0';
    var days = Object.keys(d.dailyStats || {}).length;

    tab.innerHTML =
      // TOPBAR with action buttons regrouped at right
      '<div class="topbar">' +
        '<div style="display:flex;align-items:center;gap:.5rem;">' +
          '<div class="hamburger" onclick="SytamAdmin.toggleSidebar()">☰</div>' +
          '<div><h1>Analytiques</h1><p>Statistiques et rapports</p></div>' +
        '</div>' +
        '<div class="topbar-right">' +
          '<button class="btn-add btn-sm" onclick="SytamAdmin.syncAnalytics()" style="font-size:.75rem">🔄 Synchroniser</button>' +
          '<button class="btn-add btn-sm" onclick="SytamAnalytics.exportCSVFile()" style="font-size:.75rem;background:var(--ok)">⬇ CSV événements</button>' +
          '<button class="btn-add btn-sm" onclick="SytamAnalytics.exportProductCSV()" style="font-size:.75rem;background:var(--gold)">⬇ CSV produits</button>' +
        '</div>' +
      '</div>' +
      // SECTION 1: KPIs
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div><div class="stat-val">' + (d.totalVisits || 0) + '</div><div class="stat-lbl">Vues totales</div><div class="stat-sub">Ajd : ' + (daily.visits || 0) + '</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div class="stat-val">' + (d.totalUnique || 0) + '</div><div class="stat-lbl">Visiteurs uniques</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg></div><div class="stat-val">' + (d.totalProductClicks || 0) + '</div><div class="stat-lbl">Clics produits</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-val">' + (d.totalAddToCart || 0) + '</div><div class="stat-lbl">Ajouts panier</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div><div class="stat-val">' + confirmedOrders + '</div><div class="stat-lbl">Commandes confirmées</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></div><div class="stat-val">' + _fmtAnalytics(panierMoyen) + ' F</div><div class="stat-lbl">Panier moyen</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg></div><div class="stat-val">' + conversionGlobal + '%</div><div class="stat-lbl">Taux conversion global</div><div class="stat-sub">Visites → commandes</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-val">' + cartConversion + '%</div><div class="stat-lbl">Taux ajout panier</div><div class="stat-sub">Visites → panier</div></div>' +
      '</div>' +
      // SECTION 2: Graphique + Historique côte à côte (même classe grid-2 que le dashboard)
      '<div class="grid-2">' +
        '<div class="card">' +
          '<div class="card-title">Trafic (7 derniers jours)</div>' +
          '<div id="analyticsChart">' + this._renderChart(d.dailyStats) + '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-title">Historique journalier <span style="font-weight:400;font-size:.75rem;color:var(--tl)">(' + (days || 0) + ' jours)</span></div>' +
          '<div id="analyticsDailyHistory" style="max-height:300px;overflow-y:auto">' + this._renderDailyHistory(d.dailyStats) + '</div>' +
        '</div>' +
      '</div>' +
      // SECTION 3: Tableau produits
      '<div class="card" style="margin-top:0">' +
        '<div class="card-title">Détails par produit</div>' +
        '<div id="analyticsProductDetail">' + this._renderProductDetail(d) + '</div>' +
      '</div>' +
      // SECTION 4: Suivi clients
      '<div class="card">' +
        '<div class="card-title">Suivi clients</div>' +
        '<div id="analyticsCustomers">' + this._renderCustomerTracking() + '</div>' +
      '</div>';
  },

  _renderChart(dailyStats) {
    if (!dailyStats) return '<p style="color:var(--tl);font-size:.82rem;padding:16px 0;text-align:center">Aucune donnée</p>';
    var days = [];
    var now = new Date();
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    var dataPoints = days.map(function(date) {
      var day = dailyStats[date] || {};
      return { date: date, visits: day.visits || 0, clicks: day.clicks || 0, carts: day.addToCart || 0 };
    });
    var maxVal = 1;
    dataPoints.forEach(function(p) { maxVal = Math.max(maxVal, p.visits, p.clicks, p.carts); });
    if (maxVal < 5) maxVal = 5;
    var W = 500, H = 200, pad = { top: 14, right: 14, bottom: 24, left: 36 };
    var chartW = W - pad.left - pad.right;
    var chartH = H - pad.top - pad.bottom;
    var scaleX = function(i) { return pad.left + (i / (days.length - 1)) * chartW; };
    var scaleY = function(v) { return pad.top + chartH - (v / maxVal) * chartH; };
    var lines = [
      { key: 'visits', color: '#B8956A', label: 'Vues' },
      { key: 'clicks', color: '#C9A96E', label: 'Clics' },
      { key: 'carts', color: '#7BA888', label: 'Panier+' },
    ];
    var paths = lines.map(function(line) {
      var points = dataPoints.map(function(p, idx) { return scaleX(idx) + ',' + scaleY(p[line.key]); });
      return '<path d="M' + points.join(' L') + '" fill="none" stroke="' + line.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    }).join('');
    var dots = lines.map(function(line) {
      return dataPoints.map(function(p, idx) {
        return '<circle cx="' + scaleX(idx) + '" cy="' + scaleY(p[line.key]) + '" r="3" fill="' + line.color + '" stroke="white" stroke-width="1"/>';
      }).join('');
    }).join('');
    var labels = days.map(function(date, idx) {
      if (idx % 2 === 0 || idx === days.length - 1) {
        var dayNum = date.slice(8, 10);
        var month = date.slice(5, 7);
        return '<text x="' + scaleX(idx) + '" y="' + (H - 4) + '" text-anchor="middle" font-size="7" fill="var(--tl)">' + dayNum + '/' + month + '</text>';
      }
      return '';
    }).join('');
    var yLabels = '';
    for (var y = 0; y <= maxVal; y += Math.max(1, Math.ceil(maxVal / 4))) {
      yLabels += '<text x="' + (pad.left - 4) + '" y="' + (scaleY(y) + 3) + '" text-anchor="end" font-size="7" fill="var(--tl)">' + y + '</text>';
    }
    var legend = lines.map(function(line) {
      return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:.7rem;color:var(--tl);margin-right:12px"><span style="display:inline-block;width:10px;height:3px;background:' + line.color + ';border-radius:2px"></span>' + line.label + '</span>';
    }).join('');
    return '<div><svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%">' + paths + dots + labels + yLabels + '</svg><div style="margin-top:6px;text-align:center">' + legend + '</div></div>';
  },

  _renderCustomerTracking() {
    var orders = this._getOrders();
    var customers = {};
    orders.forEach(function(o) {
      var phone = (o.telephone || '').replace(/[^0-9+]/g, '');
      if (!phone) return;
      if (!customers[phone]) customers[phone] = { phone: phone, name: o.client || '—', commandes: 0, total: 0, derniere: '' };
      customers[phone].commandes++;
      customers[phone].total += (o.total || 0);
      if (!customers[phone].derniere || o.created_at > customers[phone].derniere) customers[phone].derniere = o.created_at;
    });
    var list = Object.values(customers).sort(function(a, b) { return b.commandes - a.commandes; });
    if (!list.length) return '<p style="color:var(--tl);font-size:.82rem;padding:12px 0">Aucun client pour le moment</p>';
    var rows = list.map(function(c, i) {
      var dateStr = c.derniere ? new Date(c.derniere).toLocaleDateString('fr-FR') : '—';
      return '<tr>' +
        '<td style="padding:6px 8px;font-weight:600;color:var(--tl);font-size:.78rem;white-space:nowrap">#' + (i + 1) + '</td>' +
        '<td style="padding:6px 8px;font-size:.82rem;white-space:nowrap">' + c.name + '</td>' +
        '<td style="padding:6px 8px;font-size:.78rem;white-space:nowrap">' + c.phone + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-weight:600;font-size:.82rem;white-space:nowrap">' + c.commandes + '</td>' +
        '<td style="padding:6px 8px;text-align:right;font-size:.82rem;font-weight:600;white-space:nowrap">' + _fmtAnalytics(c.total) + ' FCFA</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.75rem;color:var(--tl);white-space:nowrap">' + dateStr + '</td>' +
      '</tr>';
    }).join('');
    return '<div class="tbl-wrap"><table style="font-size:.82rem"><thead><tr>' +
      '<th style="width:35px">#</th><th style="text-align:left">Client</th><th style="text-align:left">Contact</th>' +
      '<th style="text-align:center">Commandes</th><th style="text-align:right">Total dépensé</th><th style="text-align:center">Dernière commande</th>' +
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
    var confirmedOrders = this._getOrders().filter(function(o) { return o.statut === 'confirmee' || o.statut === 'livree'; });
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
      confirmedOrders.forEach(function(o) {
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
      return {
        id: id, name: c.name || a.name || r.name || id,
        clicks: c.count || 0, cart: a.count || 0, remove: r.count || 0, hasRemoveTracking: hasRemoveTracking,
        img: p && p.images && p.images[0] ? p.images[0] : '',
        colors: p && p.colors ? p.colors : [],
        prix: p ? p.prix : 0, stockTotal: stockTotal,
        cmdCount: cmdCount, cmdQty: cmdQty, p: p,
        colorStats: colStats,
      };
    });
    items.sort(function(a, b) { return (b.clicks + b.cart) - (a.clicks + a.cart); });
    var rows = items.map(function(item, i) {
      var abandon = item.clicks > 0 ? Math.round((1 - item.cart / item.clicks) * 100) : 0;
      var conversion = item.clicks > 0 ? ((item.cmdCount / item.clicks) * 100).toFixed(1) + '%' : '—';
      var imgHtml = item.img ? '<img src="' + item.img + '" style="width:32px;height:32px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:6px">' : '';
      var stockLabel = item.stockTotal > 0 ? '<span style="color:var(--ok)">' + item.stockTotal + '</span>' : '<span style="color:var(--er)">Épuisé</span>';
      // Détail par couleur
      var colorRows = '';
      var colNames = Object.keys(item.colorStats);
      if (colNames.length) {
        colorRows = '<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:2px">';
        colNames.forEach(function(colName) {
          var cs = item.colorStats[colName];
          var cmdColor = 0;
          confirmedOrders.forEach(function(o) {
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
        '<td style="padding:6px 8px;font-size:.82rem">' + imgHtml + '<span style="font-weight:600">' + item.name + '</span><br><span style="font-size:.7rem;color:var(--tl)">' + _fmtAnalytics(item.prix) + ' FCFA</span>' + colorRows + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-weight:600;font-size:.82rem;white-space:nowrap">' + item.clicks + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-weight:600;font-size:.82rem;white-space:nowrap;color:var(--ok)">' + item.cart + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.82rem;white-space:nowrap;color:var(--er)">' + (item.hasRemoveTracking ? item.remove : '—') + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-weight:600;font-size:.82rem;white-space:nowrap;color:var(--gold)">' + conversion + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.82rem;white-space:nowrap">' + stockLabel + '</td>' +
      '</tr>';
    }).join('');
    return '<div class="tbl-wrap"><table style="font-size:.82rem"><thead><tr>' +
      '<th style="width:35px">#</th><th style="text-align:left">Produit</th>' +
      '<th style="text-align:center">Clics</th><th style="text-align:center">Panier+</th>' +
      '<th style="text-align:center">Retiré</th><th style="text-align:center">Conversion</th><th style="text-align:center">Stock</th>' +
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
      return '<tr>' +
        '<td style="padding:4px 6px;white-space:nowrap;font-weight:500;font-size:.78rem">' + date.slice(5) + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.78rem;white-space:nowrap">' + (day.visits || 0) + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.78rem;white-space:nowrap">' + (day.clicks || 0) + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.78rem;white-space:nowrap">' + (day.addToCart || 0) + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.72rem;white-space:nowrap;color:var(--er)">' + (day.removeFromCart || 0) + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.78rem;white-space:nowrap;font-weight:600;color:var(--ok)">' + cmdCount + '</td>' +
        '<td style="padding:4px 6px;text-align:center;font-size:.72rem;white-space:nowrap;color:var(--tl)">' + (day.timeSeconds ? SytamAnalytics._fmtTime(day.timeSeconds) : '—') + '</td>' +
      '</tr>';
    }).join('');
    return '<div class="tbl-wrap"><table style="font-size:.82rem"><thead><tr>' +
      '<th style="text-align:left;padding:4px 6px;font-size:.6rem">Date</th><th style="text-align:center;padding:4px 6px;font-size:.6rem">Vues</th>' +
      '<th style="text-align:center;padding:4px 6px;font-size:.6rem">Clics</th><th style="text-align:center;padding:4px 6px;font-size:.6rem">Panier+</th>' +
      '<th style="text-align:center;padding:4px 6px;font-size:.6rem">Retiré</th><th style="text-align:center;padding:4px 6px;font-size:.6rem">Cmd</th><th style="text-align:center;padding:4px 6px;font-size:.6rem">Temps</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
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
