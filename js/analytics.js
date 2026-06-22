const SytamAnalytics = {
  STORAGE_KEY: 'sytam_analytics_v1',
  _data: null,
  _sessionStart: null,
  _timer: null,

  init() {
    this._load();
    this._sessionStart = Date.now();
    this._trackVisit();
    this._startTimer();
    this._bindEvents();
  },

  _load() {
    var stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try { this._data = JSON.parse(stored); } catch(e) {}
    }
    if (!this._data) {
      this._data = {
        totalVisits: 0,
        uniqueVisitorIds: [],
        totalUnique: 0,
        productClicks: {},
        addToCart: {},
        totalAddToCart: 0,
        totalProductClicks: 0,
        totalTimeSeconds: 0,
        dailyStats: {},
        lastUpdated: Date.now(),
      };
    }
  },

  _save() {
    this._data.lastUpdated = Date.now();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._data));
  },

  _getUuid() {
    var key = 'sytam_visitor_id';
    var id = localStorage.getItem(key);
    if (!id) {
      id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(key, id);
    }
    return id;
  },

  _todayKey() {
    return new Date().toISOString().slice(0, 10);
  },

  _ensureDaily() {
    var key = this._todayKey();
    if (!this._data.dailyStats[key]) {
      this._data.dailyStats[key] = { visits: 0, addToCart: 0, clicks: 0, timeSeconds: 0 };
    }
    return this._data.dailyStats[key];
  },

  _trackVisit() {
    this._data.totalVisits++;
    var uid = this._getUuid();
    if (this._data.uniqueVisitorIds.indexOf(uid) === -1) {
      this._data.uniqueVisitorIds.push(uid);
      this._data.totalUnique = this._data.uniqueVisitorIds.length;
    }
    var daily = this._ensureDaily();
    daily.visits++;
    this._save();
    this._sync();
  },

  trackProductClick(productId, productName) {
    if (!this._data) return;
    this._data.totalProductClicks++;
    if (!this._data.productClicks[productId]) {
      this._data.productClicks[productId] = { name: productName, count: 0 };
    }
    this._data.productClicks[productId].count++;
    var daily = this._ensureDaily();
    daily.clicks++;
    this._save();
  },

  trackAddToCart(productId, productName) {
    if (!this._data) return;
    this._data.totalAddToCart++;
    if (!this._data.addToCart[productId]) {
      this._data.addToCart[productId] = { name: productName, count: 0 };
    }
    this._data.addToCart[productId].count++;
    var daily = this._ensureDaily();
    daily.addToCart++;
    this._save();
  },

  _startTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => {
      if (this._sessionStart) {
        var elapsed = Math.floor((Date.now() - this._sessionStart) / 1000);
        if (elapsed > 0 && elapsed <= 86400) {
          this._data.totalTimeSeconds = elapsed;
          var daily = this._ensureDaily();
          daily.timeSeconds = elapsed;
          this._save();
        }
      }
    }, 30000);
  },

  _bindEvents() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._updateSessionTime();
      } else {
        this._sessionStart = Date.now();
      }
    });
    window.addEventListener('beforeunload', () => {
      this._updateSessionTime();
      this._sync();
    });
  },

  _updateSessionTime() {
    if (this._sessionStart) {
      var elapsed = Math.floor((Date.now() - this._sessionStart) / 1000);
      if (elapsed > 0 && elapsed <= 86400) {
        this._data.totalTimeSeconds = Math.max(this._data.totalTimeSeconds || 0, elapsed);
        var daily = this._ensureDaily();
        daily.timeSeconds = Math.max(daily.timeSeconds || 0, elapsed);
        this._save();
      }
    }
  },

  getData() {
    return this._data ? JSON.parse(JSON.stringify(this._data)) : null;
  },

  _sync() {
    if (typeof SupabaseAPI !== 'undefined' && SupabaseApp && SupabaseApp.ready) {
      SupabaseAPI.upsert('store_data', { key: this.STORAGE_KEY, value: this._data });
    }
  },

  loadFromSync(data) {
    if (data && data.value) {
      var merged = this._mergeData(this._data, data.value);
      this._data = merged;
      this._save();
    }
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
    m.totalTimeSeconds = Math.max(local.totalTimeSeconds || 0, remote.totalTimeSeconds || 0);
    var mergeObj = function(a, b) {
      var r = JSON.parse(JSON.stringify(a || {}));
      for (var k in (b || {})) {
        if (r[k]) { r[k].count = Math.max(r[k].count, b[k].count); }
        else { r[k] = { name: b[k].name, count: b[k].count }; }
      }
      return r;
    };
    m.productClicks = mergeObj(local.productClicks, remote.productClicks);
    m.addToCart = mergeObj(local.addToCart, remote.addToCart);
    m.dailyStats = JSON.parse(JSON.stringify(local.dailyStats || {}));
    for (var d in (remote.dailyStats || {})) {
      if (m.dailyStats[d]) {
        m.dailyStats[d].visits = Math.max(m.dailyStats[d].visits, remote.dailyStats[d].visits);
        m.dailyStats[d].addToCart = Math.max(m.dailyStats[d].addToCart, remote.dailyStats[d].addToCart);
        m.dailyStats[d].clicks = Math.max(m.dailyStats[d].clicks, remote.dailyStats[d].clicks);
        m.dailyStats[d].timeSeconds = Math.max(m.dailyStats[d].timeSeconds, remote.dailyStats[d].timeSeconds);
      } else {
        m.dailyStats[d] = JSON.parse(JSON.stringify(remote.dailyStats[d]));
      }
    }
    return m;
  },

  _formatTime(seconds) {
    if (!seconds || seconds < 0) return '—';
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
  },

  renderAdminAnalytics() {
    var tab = document.getElementById('tab-analytics');
    if (!tab || !this._data) return;
    var d = this._data;
    var daily = d.dailyStats[this._todayKey()] || {};
    var conversion = d.totalVisits > 0 ? ((d.totalAddToCart / d.totalVisits) * 100).toFixed(1) : '0.0';
    tab.innerHTML =
      '<div class="topbar"><div style="display:flex;align-items:center;gap:.5rem;"><div class="hamburger" onclick="SytamAdmin.toggleSidebar()">☰</div><div><h1>Analytiques</h1><p>Statistiques et rapports</p></div></div><button class="btn-add btn-sm" onclick="SytamAdmin.syncAnalytics()" style="font-size:.75rem">🔄</button></div>' +
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div><div class="stat-val">' + (d.totalVisits || 0) + '</div><div class="stat-lbl">Vues totales</div><div class="stat-sub">Aujourd\'hui : ' + (daily.visits || 0) + '</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div class="stat-val">' + (d.totalUnique || 0) + '</div><div class="stat-lbl">Visiteurs uniques</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-val">' + (d.totalAddToCart || 0) + '</div><div class="stat-lbl">Ajouts au panier</div><div class="stat-sub">Aujourd\'hui : ' + (daily.addToCart || 0) + '</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg></div><div class="stat-val">' + (d.totalProductClicks || 0) + '</div><div class="stat-lbl">Clics produits</div><div class="stat-sub">Aujourd\'hui : ' + (daily.clicks || 0) + '</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="stat-val">' + this._formatTime(d.totalTimeSeconds) + '</div><div class="stat-lbl">Temps passé</div></div>' +
        '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-val">' + conversion + '%</div><div class="stat-lbl">Taux conversion</div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:16px">' +
        '<div class="card-title">Top produits cliqués</div>' +
        '<div id="analyticsTopClicks">' + this._renderTopList(d.productClicks) + '</div>' +
      '</div>' +
      '<div class="card" style="margin-top:16px">' +
        '<div class="card-title">Top ajouts au panier</div>' +
        '<div id="analyticsTopCart">' + this._renderTopList(d.addToCart) + '</div>' +
      '</div>';
  },

  _renderTopList(obj) {
    if (!obj) return '<p style="color:var(--tl);font-size:.85rem;padding:12px 0">Aucune donnée</p>';
    var items = [];
    for (var k in obj) { items.push({ id: k, name: obj[k].name, count: obj[k].count }); }
    items.sort(function(a, b) { return b.count - a.count; });
    if (items.length === 0) return '<p style="color:var(--tl);font-size:.85rem;padding:12px 0">Aucune donnée</p>';
    var rows = items.slice(0, 10).map(function(item, i) {
      return '<tr><td style="padding:6px 0;font-weight:600;color:var(--tl)">#' + (i + 1) + '</td><td style="padding:6px 0">' + item.name + '</td><td style="padding:6px 0;text-align:right;font-weight:600">' + item.count + '</td></tr>';
    }).join('');
    return '<div class="tbl-wrap"><table><thead><tr><th style="width:40px">#</th><th>Produit</th><th style="text-align:right">Compteur</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  },
};
