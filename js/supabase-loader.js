(function() {
  if (typeof supabase === 'undefined') { console.warn('supabase-js not loaded'); return; }
  if (window.SupabaseApp && window.SupabaseApp.ready) return;
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) { console.warn('Supabase config missing'); return; }
  try {
    var client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    window.SupabaseApp = { client: client, ready: true };
    window.SupabaseAPI = {
      get: function(key) {
        return client.from('store_data').select('*').eq('key', key).then(function(r) {
          if (r.error) throw r.error;
          return r.data;
        });
      },
      upsert: function(key, value) {
        return client.from('store_data').upsert({ key: key, value: value }, { onConflict: 'key' }).then(function(r) {
          if (r.error) throw r.error;
          return r;
        });
      }
    };
    console.log('Supabase ready');
  } catch(e) {
    console.warn('Supabase init failed:', e);
  }
})();
