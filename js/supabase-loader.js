(function() {
  if (window.SupabaseApp && window.SupabaseApp.ready) return;
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) { console.warn('Supabase config missing'); return; }
  var url = window.SUPABASE_URL.replace(/\/$/, '');
  var anonKey = window.SUPABASE_ANON_KEY;
  var headers = { 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
  window.SupabaseApp = { ready: true };
  window.SupabaseAPI = {
    get: function(key) {
      return fetch(url + '/rest/v1/store_data?key=eq.' + encodeURIComponent(key) + '&select=value', { headers: headers })
        .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function(data) { return data; });
    },
    upsert: function(key, value) {
      return fetch(url + '/rest/v1/store_data?key=eq.' + encodeURIComponent(key), {
        method: 'PATCH', headers: headers, body: JSON.stringify({ key: key, value: value })
      }).then(function(r) {
        if (r.status === 404) {
          // Table doesn't exist yet → POST to create
          return fetch(url + '/rest/v1/store_data', {
            method: 'POST', headers: headers, body: JSON.stringify({ key: key, value: value })
          }).then(function(r2) { if (!r2.ok) throw new Error(r2.status); return r2.json(); });
        }
        if (!r.ok) throw new Error(r.status);
        return r.json();
      });
    }
  };
  console.log('Supabase ready');
})();
