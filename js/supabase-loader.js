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
        if (!r.ok) { console.warn('Supabase get ⚠ code ' + r.status + ' pour', endpoint); return []; }
        return r.json();
      })
      .then(function(data) {
        if (!data || !data.length) return [];
        // Si plusieurs lignes (ex: clés dupliquées), garder la dernière (insertion la plus récente)
        if (data.length > 1 && endpoint.indexOf('key=eq.') !== -1) {
          console.warn('Supabase get ⚠ lignes multiples pour', endpoint, '→ dernière utilisée');
          return [data[data.length - 1]];
        }
        return data;
      })
      .catch(function(e) { console.warn('Supabase get erreur:', e); return []; });
  },
  upsert: function(table, data) {
    if (!SupabaseApp.ready) return Promise.resolve();
    var key = data.key;
    var url = this._url(table) + '?key=eq.' + encodeURIComponent(key);
    // Essaie UPDATE (PATCH) d'abord avec return=representation pour voir si ligne existe
    return fetch(url, {
      method: 'PATCH',
      headers: Object.assign(this._headers(), {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }),
      body: JSON.stringify(data),
    }).then(function(patchRes) {
      if (!patchRes.ok) {
        // PATCH a échoué → POST en dernier recours
        return fetch(SupabaseAPI._url(table), {
          method: 'POST',
          headers: Object.assign(SupabaseAPI._headers(), { 'Content-Type': 'application/json' }),
          body: JSON.stringify(data),
        }).then(function(postRes) {
          if (!postRes.ok) console.warn('Supabase upsert POST status:', postRes.status, postRes.statusText);
          return { ok: postRes.ok, method: 'POST' };
        });
      }
      return patchRes.json().then(function(body) {
        if (!body || (Array.isArray(body) && body.length === 0)) {
          // Aucune ligne trouvée → faire INSERT
          return fetch(SupabaseAPI._url(table), {
            method: 'POST',
            headers: Object.assign(SupabaseAPI._headers(), { 'Content-Type': 'application/json' }),
            body: JSON.stringify(data),
          }).then(function(postRes) {
            if (!postRes.ok) console.warn('Supabase upsert POST status:', postRes.status, postRes.statusText);
            return { ok: postRes.ok, method: 'POST' };
          });
        }
        return { ok: true, method: 'PATCH' };
      });
    }).catch(function(e) { console.warn('Supabase upsert error:', e); return { ok: false }; });
  },
};
