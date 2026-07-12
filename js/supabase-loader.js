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
      return fetch(url + '/rest/v1/store_data', {
        method: 'POST',
        headers: { 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ key: key, value: value })
      }).then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    }
  };
  console.log('Supabase ready');
})();
