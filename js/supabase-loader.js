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
        // Si plusieurs lignes pour la même clé (ne devrait plus arriver avec upsert corrigé)
        if (data.length > 1 && endpoint.indexOf('key=eq.') !== -1) {
          console.warn('Supabase get ⚠ lignes multiples pour', endpoint, '→ prend la première');
          return [data[0]];
        }
        return data;
      })
      .catch(function(e) { console.warn('Supabase get erreur:', e); return []; });
  },
  upsert: function(table, data) {
    if (!SupabaseApp.ready) return Promise.resolve({ ok: false });
    var key = data.key;
    var url = this._url(table) + '?key=eq.' + encodeURIComponent(key);
    // PATCH d'abord ; si 204 (succès sans body) ou 200 avec body, c'est OK
    return fetch(url, {
      method: 'PATCH',
      headers: Object.assign(this._headers(), { 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    }).then(function(patchRes) {
      if (!patchRes.ok) {
        // 404 → aucune ligne trouvée → POST
        if (patchRes.status === 404 || patchRes.status === 406) {
          return fetch(SupabaseAPI._url(table), {
            method: 'POST',
            headers: Object.assign(SupabaseAPI._headers(), { 'Content-Type': 'application/json' }),
            body: JSON.stringify(data),
          }).then(function(postRes) {
            if (!postRes.ok) console.warn('Supabase upsert POST status:', postRes.status, postRes.statusText);
            return { ok: postRes.ok, method: 'POST' };
          });
        }
        console.warn('Supabase upsert PATCH status:', patchRes.status);
        return { ok: false, method: 'PATCH' };
      }
      // PATCH réussi (200 ou 204)
      return { ok: true, method: 'PATCH' };
    }).catch(function(e) { console.warn('Supabase upsert error:', e); return { ok: false }; });
  },
};
