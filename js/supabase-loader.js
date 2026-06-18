// Supabase Loader — API REST directe
const SupabaseApp = { ready: false };

(function () {
  if (typeof SUPABASE_READY === 'undefined' || !SUPABASE_READY) {
    console.warn('⚠ Supabase non configuré.');
    return;
  }
  SupabaseApp.ready = true;
  console.log('✓ Supabase prêt');
})();

// ---- API REST directe ----
var SupabaseAPI = {
  _headers: function() {
    return { 'apikey': SUPABASE_CONFIG.anonKey, 'Authorization': 'Bearer ' + SUPABASE_CONFIG.anonKey };
  },
  _url: function(endpoint) {
    return SUPABASE_CONFIG.url + '/rest/v1/' + endpoint;
  },
  get: function(endpoint) {
    if (!SupabaseApp.ready) return Promise.resolve([]);
    return fetch(this._url(endpoint), { headers: this._headers() })
      .then(function(r) {
        if (!r.ok) { console.warn('Supabase get error status:', r.status, r.statusText); return []; }
        return r.json();
      })
      .then(function(data) { return data || []; })
      .catch(function(e) { console.warn('Supabase get error:', e); return []; });
  },
  upsert: function(table, data) {
    if (!SupabaseApp.ready) return Promise.resolve();
    return fetch(this._url(table), {
      method: 'POST',
      headers: Object.assign(this._headers(), { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }),
      body: JSON.stringify(data),
    }).then(function(r) {
      if (!r.ok) console.warn('Supabase upsert status:', r.status, r.statusText);
      return r;
    }).catch(function(e) { console.warn('Supabase upsert error:', e); });
  },
};
