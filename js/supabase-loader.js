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
      .then(function(data) {
        if (!data || !data.length) return [];
        // If multiple rows returned (e.g. same key), merge them by keeping the last with the most data
        if (data.length > 1 && endpoint.indexOf('key=eq.') !== -1) {
          var merged = data[data.length - 1];
          return [merged];
        }
        return data;
      })
      .catch(function(e) { console.warn('Supabase get error:', e); return []; });
  },
  upsert: function(table, data) {
    if (!SupabaseApp.ready) return Promise.resolve();
    // First delete existing row with same key, then insert
    var key = data.key;
    return fetch(this._url(table) + '?key=eq.' + encodeURIComponent(key), {
      method: 'DELETE',
      headers: this._headers(),
    }).then(function() {
      return fetch(SupabaseAPI._url(table), {
        method: 'POST',
        headers: Object.assign(SupabaseAPI._headers(), { 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
      });
    }).then(function(r) {
      if (!r.ok) console.warn('Supabase upsert status:', r.status, r.statusText);
      return r;
    }).catch(function(e) { console.warn('Supabase upsert error:', e); });
  },
};
