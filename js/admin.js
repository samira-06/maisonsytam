(function () {
  DB.init();
  let editingId = null;
  var ALL_SIZES = typeof SIZES !== 'undefined' ? SIZES : [];

  function $(id) { return document.getElementById(id); }
  function qs(s, c) { return (c || document).querySelector(s); }
  function qsa(s, c) { return (c || document).querySelectorAll(s); }
  function fmt(n) { return (n || 0).toLocaleString('fr-FR'); }

  // LOGIN
  function checkAuth() {
    var session = sessionStorage.getItem('sytam_admin') || localStorage.getItem('sytam_admin');
    session === 'ok' ? showApp() : showLogin();
  }

  function showLogin() { $('loginScreen').style.display = 'flex'; $('adminApp').style.display = 'none'; }
  function showApp() {
    $('loginScreen').style.display = 'none'; $('adminApp').style.display = 'block';
    $('adminDate').textContent = 'Bienvenue ' + new Date().toLocaleDateString('fr-FR', { weekday: 'long', month: 'long', day: 'numeric' });
    $('topDate').textContent = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    loadNtfyTopic();
    DB.onReady(function() {
      syncAllFromSupabase(function() {
        DB.reloadFromLocal();
        loadDashboard(); loadProducts(); loadOrders(); loadReferrals();
      });
    });
    initNotifications();
  }

  // ---- SYNC SUPABASE ----
  function pushToSupabase(key) {
    if (typeof SupabaseAPI === 'undefined' || !SupabaseApp.ready) return;
    var val = localStorage.getItem(key);
    if (val) {
      try { SupabaseAPI.upsert('store_data', { key: key, value: JSON.parse(val) }); } catch(e) {}
    }
  }

  // ---- NOTIFICATIONS NAVIGATEUR ----
  var _notifLastCount = 0;
  var _currentTab = 'dashboard';
  function initNotifications() {
    if (('Notification' in window)) {
      if (Notification.permission === 'granted' || Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
    pollOrders();
    setInterval(pollOrders, 30000);
  }
  function refreshCurrentTab() {
    if (_currentTab === 'dashboard') loadDashboard();
    else if (_currentTab === 'orders') loadOrders();
    else if (_currentTab === 'messages') loadMessages();
    else if (_currentTab === 'promos') loadReferrals();
    else if (_currentTab === 'products') loadProducts();
  }
  function resetProducts() {
    if (!confirm('Réinitialiser TOUS les produits aux valeurs par défaut ? Les produits ajoutés seront perdus.')) return;
    var fresh = JSON.parse(JSON.stringify(SEED_PRODUCTS));
    localStorage.setItem('sytam_products_v4', JSON.stringify(fresh));
    if (typeof SupabaseAPI !== 'undefined' && SupabaseApp.ready) {
      SupabaseAPI.upsert('store_data', { key: 'sytam_products_v4', value: fresh });
    }
    showToast('✓ Produits réinitialisés');
    setTimeout(function() { location.reload(); }, 1500);
  }
  function syncNow() {
    showToast('⏳ Synchronisation...');
    // Test de connectivité Supabase
    if (typeof SupabaseAPI !== 'undefined' && SupabaseApp.ready) {
      SupabaseAPI.get('store_data?key=eq.sytam_orders_v2&select=value')
        .then(function(r) {
          console.log('syncNow: Supabase OK', r ? r.length + ' lignes' : 'vide');
        })
        .catch(function(e) {
          console.warn('syncNow: Supabase INACCESSIBLE', e);
          showToast('⚠ Supabase inaccessible — vérifie ton projet supabase.com');
        });
    } else {
      showToast('⚠ Supabase non configuré');
    }
    syncAllFromSupabase(function() {
      refreshCurrentTab();
      showToast('✓ Synchronisé');
    });
  }
  // Sync ALL data from Supabase (orders, products, messages, referrals, loyalty)
  function syncAllFromSupabase(cb) {
    if (typeof SupabaseAPI === 'undefined' || !SupabaseApp.ready) {
      console.warn('syncAllFromSupabase ⚡ Supabase non disponible');
      updateSupabaseStatus('HS', 'Supabase déconnecté');
      if (cb) cb(); return;
    }
    updateSupabaseStatus('...', 'Synchronisation...');
    var keys = ['sytam_orders_v2', 'sytam_messages', 'sytam_referrals', 'sytam_loyalty_v2', 'sytam_products_v4'];
    var total = keys.length + 1; // +1 pour analytics
    var done = 0;
    keys.forEach(function(k) {
      var localData = localStorage.getItem(k);
      SupabaseAPI.get('store_data?key=eq.' + k + '&select=value')
        .then(function(result) {
          var supabaseVal = null;
          try {
            if (result && result.length && result[0] && result[0].value) {
              supabaseVal = result[0].value;
            }
          } catch(e) { console.warn('syncAllFromSupabase parse error for', k, e); }
          var localVal = null;
          try { localVal = JSON.parse(localData || 'null'); } catch(e) { localVal = null; }
          // Loyalty = objet (pas un tableau)
          if (k === 'sytam_loyalty_v2') {
            var merged = {};
            if (supabaseVal && typeof supabaseVal === 'object' && !Array.isArray(supabaseVal)) {
              Object.keys(supabaseVal).forEach(function(ph) { merged[ph] = supabaseVal[ph]; });
            }
            if (localVal && typeof localVal === 'object' && !Array.isArray(localVal)) {
              Object.keys(localVal).forEach(function(ph) {
                if (!merged[ph]) merged[ph] = localVal[ph];
                else {
                  merged[ph].orders = Math.max(merged[ph].orders || 0, localVal[ph].orders || 0);
                  merged[ph].total = Math.max(merged[ph].total || 0, localVal[ph].total || 0);
                }
              });
            }
            if (Object.keys(merged).length) {
              localStorage.setItem(k, JSON.stringify(merged));
              SupabaseAPI.upsert('store_data', { key: k, value: merged });
            }
            if (typeof DB !== 'undefined') DB.reloadFromLocal();
            done++; if (done === total) { updateSupabaseStatus('✓', 'Synchronisé'); if (cb) cb(); }
            return;
          }
          // Tableaux classiques
          var supabaseItems = Array.isArray(supabaseVal) ? supabaseVal : [];
          var localItems = Array.isArray(localVal) ? localVal : [];
          var seen = {};
          supabaseItems.forEach(function(item) { if (item && item.id) seen[item.id] = item; });
          localItems.forEach(function(item) {
            if (item && item.id) {
              var existing = seen[item.id];
              if (existing && k === 'sytam_products_v4') {
                if (item.colors && existing.colors) {
                  existing.colors = existing.colors.map(function(sc) {
                    var lc = item.colors.find(function(c) { return c.name === sc.name; });
                    return lc ? { name: sc.name, hex: sc.hex, stock: lc.stock } : sc;
                  });
                }
                if (item.sizes && existing.sizes) existing.sizes = item.sizes;
              }
              seen[item.id] = item;
            }
          });
          supabaseItems = Object.values(seen);
          if (supabaseItems.length || localItems.length || k === 'sytam_products_v4') {
            localStorage.setItem(k, JSON.stringify(supabaseItems));
            SupabaseAPI.upsert('store_data', { key: k, value: supabaseItems });
          } else {
            console.log('syncAllFromSupabase: skip empty save for', k);
          }
          if (k === 'sytam_products_v4' && typeof DB !== 'undefined') {
            DB._data = supabaseItems;
            DB._migrateData();
          }
          done++; if (done === total) { updateSupabaseStatus('✓', 'Synchronisé'); if (cb) cb(); }
        })
        .catch(function(err) {
          console.warn('syncAllFromSupabase ⚠ échec pour', k, err);
          if (localData) {
            try { SupabaseAPI.upsert('store_data', { key: k, value: JSON.parse(localData) }); } catch(e) {}
          }
          done++; if (done === total) { updateSupabaseStatus('⚠', 'Sync échoué'); if (cb) cb(); }
        });
    });
    // Analytics (objet unique, pas un tableau)
    var ak = 'sytam_analytics_v1';
    SupabaseAPI.get('store_data?key=eq.' + ak + '&select=value')
      .then(function(result) {
        try {
          if (result && result.length && result[0] && result[0].value) {
            var remote = result[0].value;
            if (typeof SytamAnalytics !== 'undefined') {
              SytamAnalytics.loadFromSync({ value: remote });
            }
          }
        } catch(e) { console.warn('syncAllFromSupabase analytics error', e); }
        done++; if (done === total) { updateSupabaseStatus('✓', 'Synchronisé'); if (cb) cb(); }
      })
      .catch(function() {
        done++; if (done === total) { updateSupabaseStatus('⚠', 'Sync échoué'); if (cb) cb(); }
      });
  }
  function updateSupabaseStatus(sym, label) {
    var el = document.getElementById('supabase-status');
    if (el) { el.innerHTML = '<span style="font-size:1.2rem">' + sym + '</span> ' + label; }
  }
  function pollOrders() {
    // Toujours syncer depuis Supabase (même sans permission notification)
    syncAllFromSupabase(function() {
      var orders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
      // Auto-annulation des commandes en_attente depuis plus d'1h
      var now = Date.now();
      var changed = false;
      for (var oi = 0; oi < orders.length; oi++) {
        var oo = orders[oi];
        if (oo.statut === 'en_attente' && oo.created_at) {
          var created = new Date(oo.created_at).getTime();
          if (now - created > 3600000) { // 1h = 3600000ms
            oo.statut = 'annulee';
            changed = true;
          }
        }
      }
      if (changed) {
        localStorage.setItem('sytam_orders_v2', JSON.stringify(orders));
        pushToSupabase('sytam_orders_v2');
      }
      refreshCurrentTab();
      var pending = orders.filter(function(o) { return o.statut === 'en_attente'; }).length;
      if (pending > _notifLastCount && _notifLastCount > 0) {
        var diff = pending - _notifLastCount;
        var o = orders.filter(function(x) { return x.statut === 'en_attente'; });
        var latest = o.slice(0, diff);
        latest.forEach(function(order) {
          var total = fmt(order.total);
          var items = (order.items || []).length;
          // Notification navigateur
          if (('Notification' in window) && Notification.permission === 'granted') {
            new Notification('Nouvelle commande #' + order.id, {
              body: order.client + ' — ' + total + ' FCFA (' + items + ' art.)',
              icon: '/favicon.ico',
              tag: order.id
            });
          }
          // Notification ntfy (push vers téléphone même si page fermée)
          sendNtfy(order);
        });
      }
      _notifLastCount = pending;
    });
  }
  function sendNtfy(order) {
    var topic = localStorage.getItem('sytam_ntfy_topic') || 'sytam-shop';
    if (!topic) return;
    var itemNames = (order.items || []).map(function(i) { return i.nom + ' x' + i.qte; }).join(', ');
    var body = '#' + order.id + ' - ' + order.client + ' - ' + fmt(order.total) + ' FCFA\n' + itemNames;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://ntfy.sh/' + encodeURIComponent(topic), true);
    xhr.setRequestHeader('Title', 'Nouvelle commande !');
    xhr.setRequestHeader('Priority', 'high');
    xhr.setRequestHeader('Tags', 'shopping_cart');
    xhr.send(body);
  }

  function login() {
    var pass = $('pwdInput').value.trim();
    $('loginErr').style.display = 'none';
    if (!pass) { $('loginErr').style.display = 'flex'; return; }
    // Vérifie d'abord en local, puis Supabase
    var localPwd = localStorage.getItem('sytam_admin_pwd') || 'admin123';
    if (pass === localPwd) {
      sessionStorage.setItem('sytam_admin', 'ok');
      showApp();
      return;
    }
    SupabaseAPI.get('admin_settings?id=eq.default&select=password')
      .then(function(result) {
        var dbPwd = (result && result.length) ? result[0].password : 'admin123';
        if (pass === dbPwd) {
          localStorage.setItem('sytam_admin_pwd', dbPwd);
          sessionStorage.setItem('sytam_admin', 'ok');
          showApp();
        } else {
          $('loginErr').style.display = 'flex';
        }
      })
      .catch(function() {
        $('loginErr').style.display = 'flex';
      });
  }

  function logout() {
    sessionStorage.removeItem('sytam_admin');
    localStorage.removeItem('sytam_admin');
    showLogin();
  }

  function changePwd() {
    var n = $('pwd-new').value, c = $('pwd-cf').value;
    if (!n || n !== c) { showToast('Erreur', 'Les mots de passe ne correspondent pas'); return; }
    SupabaseAPI.upsert('admin_settings', { id: 'default', password: n })
      .then(function() { showToast('✓ Mot de passe modifié' + (SupabaseApp.ready ? ' sur Supabase' : ' (local)')); })
      .catch(function() { showToast('Erreur', 'Impossible de modifier le mot de passe'); });
  }

  function saveSettings() {
    SupabaseAPI.upsert('admin_settings', { id: 'default', phone: ($('shop-phone') && $('shop-phone').value) || '+221 77 478 98 75' })
      .then(function() { showToast('✓ Paramètres sauvegardés' + (SupabaseApp.ready ? ' sur Supabase' : ' (local)')); })
      .catch(function() { showToast('Erreur', 'Impossible de sauvegarder'); });
  }

  function saveNtfyTopic() {
    var topic = ($('ntfy-topic') && $('ntfy-topic').value.trim()) || 'sytam-shop';
    localStorage.setItem('sytam_ntfy_topic', topic);
    showToast('✓ Topic ntfy sauvegardé : ' + topic);
  }

  function loadNtfyTopic() {
    var saved = localStorage.getItem('sytam_ntfy_topic');
    if (saved && $('ntfy-topic')) $('ntfy-topic').value = saved;
  }

  function restoreDefaults() {
    if (!confirm('Réinitialiser tous les produits ? Les données Supabase seront écrasées.')) return;
    var fresh = JSON.parse(JSON.stringify(SEED_PRODUCTS));
    localStorage.setItem('sytam_products_v4', JSON.stringify(fresh));
    if (typeof SupabaseAPI !== 'undefined' && SupabaseApp.ready) {
      SupabaseAPI.upsert('store_data', { key: 'sytam_products_v4', value: fresh });
    }
    showToast('✓ Produits réinitialisés, recharge...');
    setTimeout(function() { location.reload(); }, 1500);
  }

  // Export/Import des données depuis/vers Supabase
  function exportData() {
    var data = {
      products: DB.getAll(),
      orders: JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]'),
      messages: JSON.parse(localStorage.getItem('sytam_messages') || '[]'),
      referrals: JSON.parse(localStorage.getItem('sytam_referrals') || '[]'),
      sizeGuide: JSON.parse(localStorage.getItem('sytam_size_guide') || 'null'),
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sytam-backup-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    showToast('✓ Fichier exporté');
  }

  function importData() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        try {
          var data = JSON.parse(ev.target.result);
          if (data.products && data.products.length) {
            // Envoyer à Supabase
            SupabaseAPI.upsert('store_data', { key: 'sytam_products_v4', value: data.products });
            localStorage.setItem('sytam_products_v4', JSON.stringify(data.products));
            showToast('✓ ' + data.products.length + ' produits importés ! Recharge...');
            setTimeout(function() { location.reload(); }, 1500);
          } else {
            showToast('Erreur', 'Fichier invalide');
          }
          if (data.sizeGuide) {
            localStorage.setItem('sytam_size_guide', JSON.stringify(data.sizeGuide));
            SupabaseAPI.upsert('store_data', { key: 'sytam_size_guide', value: data.sizeGuide });
          }
        } catch(e) { showToast('Erreur', 'Fichier corrompu'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // NAVIGATION
  function goTab(tab, el) {
    _currentTab = tab;
    qsa('.tab').forEach(function (t) { t.classList.remove('active'); });
    qsa('.sb-item').forEach(function (s) { s.classList.remove('active'); });
    var t = $('tab-' + tab);
    if (t) t.classList.add('active');
    if (el) el.classList.add('active');
    if (tab === 'dashboard') loadDashboard();
    else if (tab === 'orders') loadOrders();
    else if (tab === 'messages') loadMessages();
    else if (tab === 'products') loadProducts();
    else if (tab === 'promos') loadReferrals();
    else if (tab === 'loyalty') loadLoyalty();
    else if (tab === 'analytics') loadAnalytics();

    // Fermer la sidebar sur mobile
    if (window.innerWidth <= 768) {
      qs('.sidebar').classList.remove('open');
      var o = qs('.sb-overlay');
      if (o) o.classList.remove('open');
    }
  }

  function toggleSidebar() {
    qs('.sidebar').classList.toggle('open');
    var o = qs('.sb-overlay');
    if (o) o.classList.toggle('open');
  }

  // TOAST
  function showToast(title, body) {
    var t = $('toast');
    $('toastTitle').textContent = title || '';
    $('toastBody').textContent = body || '';
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  // MODAL
  function openModal(html) {
    $('modal').innerHTML = html;
    $('modalOv').classList.add('open');
  }
  function closeModal() { $('modalOv').classList.remove('open'); }
  function closeModalOut(e) { if (e.target === $('modalOv')) closeModal(); }

  function animateNum(id, target, suffix) {
    var el = document.getElementById(id);
    if (!el) return;
    var start = 0;
    var step = Math.max(1, Math.ceil(target / 30));
    el.textContent = '0' + (suffix || '');
    var interval = setInterval(function() {
      start += step;
      if (start >= target) { start = target; clearInterval(interval); }
      el.textContent = fmt(start) + (suffix || '');
    }, 40);
  }

  // DASHBOARD
  function loadDashboard() {
    var products = DB.getAll();
    var orders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
    var activeOrders = orders.filter(function (o) { return o.statut !== 'annulee'; });
    var pending = orders.filter(function (o) { return o.statut === 'en_attente'; });
    var revenue = activeOrders.reduce(function (s, o) { return s + (o.total || 0); }, 0);
    var msgs = JSON.parse(localStorage.getItem('sytam_messages') || '[]');
    var unread = msgs.filter(function(m) { return !m.lu; }).length;
    var totalSold = activeOrders.reduce(function(s, o) { return s + (o.items || []).reduce(function(a, it) { return a + (it.quantity || it.qte || 0); }, 0); }, 0);
    var avgCart = orders.length ? Math.round(revenue / orders.length) : 0;

    animateNum('s-revenue', revenue, ' FCFA');
    animateNum('s-orders', orders.length, '');
    animateNum('s-products', products.length, '');
    animateNum('s-pending', pending.length, '');
    animateNum('s-average', avgCart, ' FCFA');
    var unrd = $('s-unread'); if (unrd) unrd.textContent = unread;

    // Trends
    var now = new Date();
    var currMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    var prevMonth = now.getMonth() === 0 ? (now.getFullYear()-1) + '-12' : now.getFullYear() + '-' + String(now.getMonth()).padStart(2,'0');
    var currRev = 0, prevRev = 0;
    activeOrders.forEach(function(o) {
      var d = new Date(o.created_at);
      var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2, '0');
      if (key === currMonth) currRev += o.total || 0;
      else if (key === prevMonth) prevRev += o.total || 0;
    });
    var revTrend = $('rev-trend');
    if (revTrend) {
      if (prevRev > 0) {
        var diff = ((currRev - prevRev) / prevRev * 100);
        revTrend.innerHTML = (diff >= 0 ? '▲' : '▼') + ' ' + Math.abs(diff).toFixed(1) + '% vs mois dernier';
        revTrend.className = 'stat-trend ' + (diff >= 0 ? 'up' : 'down');
      } else if (currRev > 0) { revTrend.textContent = 'Nouveau ce mois'; revTrend.className = 'stat-trend up'; }
      else { revTrend.textContent = '—'; }
    }
    var ordSub = $('ord-sub');
    if (ordSub) ordSub.textContent = totalSold > 0 ? totalSold + ' articles vendus' : 'Aucune vente';
    var pendSub = $('pend-sub');
    if (pendSub) pendSub.textContent = pending.length > 0 ? pending.length + ' commande(s) à traiter' : 'Tout est à jour ✓';
    var prodSub = $('prod-sub');
    if (prodSub) {
      var lowStockCount = products.filter(function(p) {
        var total = p.colors ? p.colors.reduce(function(s, c) { return s + (typeof c.stock === 'number' ? c.stock : 0); }, 0) : 0;
        return total > 0 && total < 5;
      }).length;
      prodSub.textContent = lowStockCount > 0 ? lowStockCount + ' produit(s) stock faible' : 'Tous en stock ✓';
    }

    // Graphique ventes par mois
    var monthMap = {};
    activeOrders.forEach(function(o) {
      var d = new Date(o.created_at);
      var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2, '0');
      if (!monthMap[key]) monthMap[key] = 0;
      monthMap[key] += o.total || 0;
    });
    var monthEntries = Object.keys(monthMap).sort();
    var months = ['Janv','Fév','Mars','Avr','Mai','Juin','Juill','Août','Sept','Oct','Nov','Déc'];
    var svg = $('salesChart');
    if (svg && monthEntries.length) {
      var values = monthEntries.map(function(k) { return monthMap[k]; });
      var max = Math.max.apply(null, values) || 1;
      var pad = { top: 10, right: 10, bottom: 24, left: 52 };
      var w = 400, h = 160;
      var plotW = w - pad.left - pad.right;
      var plotH = h - pad.top - pad.bottom;
      var steps = 4;
      var tickVal = Math.ceil(max / steps / 1000) * 1000 || 1000;
      var gridLines = '';
      for (var s = 0; s <= steps; s++) {
        var val = tickVal * s;
        var yPos = pad.top + plotH - (val / max) * plotH;
        gridLines += '<line x1="' + pad.left + '" y1="' + yPos + '" x2="' + (w - pad.right) + '" y2="' + yPos + '" stroke="#eee" stroke-width="1"/>';
        gridLines += '<text x="' + (pad.left - 6) + '" y="' + (yPos + 3) + '" text-anchor="end" font-size="8" fill="#999">' + fmt(val) + '</text>';
      }
      var barW = Math.max(16, Math.min(36, (plotW - 10) / values.length));
      var gap = Math.max(4, (plotW - barW * values.length) / (values.length + 1));
      var bars = values.map(function(v, i) {
        var bh = Math.max(2, (v / max) * plotH);
        var x = pad.left + gap + i * (barW + gap);
        var y = pad.top + plotH - bh;
        var parts = monthEntries[i].split('-');
        var label = months[parseInt(parts[1])-1] || monthEntries[i];
        return '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + bh + '" rx="4" fill="#C9A96E" opacity="0.9" style="transition:opacity .2s" onmouseenter="this.setAttribute(\'opacity\',\'1\')" onmouseleave="this.setAttribute(\'opacity\',\'0.9\')"><title>' + label + ' : ' + fmt(v) + ' FCFA</title></rect>' +
          (bh > 20 ? '<text x="' + (x + barW/2) + '" y="' + (y + 12) + '" text-anchor="middle" font-size="7" fill="#fff" font-weight="bold">' + fmt(v) + '</text>' : '') +
          '<text x="' + (x + barW/2) + '" y="' + (h - 4) + '" text-anchor="middle" font-size="7" fill="#888">' + label + '</text>';
      }).join('');
      svg.innerHTML = gridLines + bars + '<line x1="' + pad.left + '" y1="' + pad.top + '" x2="' + pad.left + '" y2="' + (pad.top + plotH) + '" stroke="#ccc" stroke-width="1"/><line x1="' + pad.left + '" y1="' + (pad.top + plotH) + '" x2="' + (w - pad.right) + '" y2="' + (pad.top + plotH) + '" stroke="#ccc" stroke-width="1"/>';
    } else if (svg) {
      svg.innerHTML = '<text x="200" y="80" text-anchor="middle" font-size="12" fill="#bbb">Aucune vente</text>';
    }

    // Ventes par catégorie
    var catMap = {};
    var allProds = DB.getAll();
    activeOrders.forEach(function(o) {
      (o.items || []).forEach(function(it) {
        var prod = allProds.find(function(p) { return p.nom === it.nom; });
        var cat = prod ? prod.categorie : 'Autre';
        if (!catMap[cat]) catMap[cat] = { count: 0, total: 0 };
        var qte = it.quantity || it.qte || 1;
        catMap[cat].count += qte;
        catMap[cat].total += (it.prix || 0) * qte;
      });
    });
    var catEntries = Object.keys(catMap).sort();
    var catWrap = $('categoryChartWrap');
    if (catWrap) {
      if (catEntries.length) {
        var maxCat = Math.max.apply(null, catEntries.map(function(k) { return catMap[k].total; })) || 1;
        var catTotal = catEntries.reduce(function(s, k) { return s + catMap[k].total; }, 0);
        catWrap.innerHTML = catEntries.map(function(k) {
          var d = catMap[k];
          var pct = Math.round((d.total / catTotal) * 100);
          var barPct = Math.max(3, (d.total / maxCat) * 100);
          return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:.78rem">' +
            '<span style="width:80px;text-transform:capitalize;color:var(--tl)">' + k + '</span>' +
            '<div style="flex:1;height:20px;background:#f0ebe5;border-radius:10px;overflow:hidden">' +
            '<div style="width:' + barPct + '%;height:100%;background:#C9A96E;border-radius:10px;transition:width .6s ease"></div>' +
            '</div>' +
            '<span style="width:60px;text-align:right;font-weight:600;color:#555">' + fmt(d.total) + '</span>' +
            '<span style="width:30px;text-align:right;font-size:.7rem;color:#999">' + pct + '%</span></div>';
        }).join('');
      } else {
        catWrap.innerHTML = '<div style="text-align:center;padding:20px;color:#bbb;font-size:.85rem">Aucune vente</div>';
      }
    }

    // Top produits
    var prodSales = {};
    activeOrders.forEach(function(o) {
      (o.items || []).forEach(function(it) {
        var qte = it.quantity || it.qte || 1;
        if (!prodSales[it.nom]) prodSales[it.nom] = { qte: 0, total: 0 };
        prodSales[it.nom].qte += qte;
        prodSales[it.nom].total += (it.prix || 0) * qte;
      });
    });
    var topEntries = Object.keys(prodSales).sort(function(a, b) { return prodSales[b].qte - prodSales[a].qte; }).slice(0, 5);
    var topWrap = $('topProductsWrap');
    if (topWrap) {
      if (topEntries.length) {
        var topMax = Math.max.apply(null, topEntries.map(function(k) { return prodSales[k].qte; })) || 1;
        topWrap.innerHTML = topEntries.map(function(k, i) {
          var d = prodSales[k];
          var barPct = Math.max(3, (d.qte / topMax) * 100);
          var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1)+'.';
          return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:.78rem">' +
            '<span style="width:20px;text-align:center;font-size:.75rem">' + medal + '</span>' +
            '<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#2d2d2d">' + esc(k) + '</span>' +
            '<div style="width:60px;height:6px;background:#f0ebe5;border-radius:3px;overflow:hidden;flex-shrink:0">' +
            '<div style="width:' + barPct + '%;height:100%;background:#C9A96E;border-radius:3px"></div></div>' +
            '<span style="width:24px;text-align:right;font-weight:600;color:#555;font-size:.75rem">' + d.qte + '</span></div>';
        }).join('');
      } else {
        topWrap.innerHTML = '<div style="text-align:center;padding:20px;color:#bbb;font-size:.85rem">Aucun produit vendu</div>';
      }
    }

    // Alertes stock faible
    var lowStockItems = products.filter(function(p) {
      var total = 0;
      if (p.colors) total = p.colors.reduce(function(s, c) { return s + (typeof c.stock === 'number' ? c.stock : 0); }, 0);
      return total > 0 && total < 6;
    }).sort(function(a, b) {
      var ta = a.colors ? a.colors.reduce(function(s, c) { return s + (typeof c.stock === 'number' ? c.stock : 0); }, 0) : 0;
      var tb = b.colors ? b.colors.reduce(function(s, c) { return s + (typeof c.stock === 'number' ? c.stock : 0); }, 0) : 0;
      return ta - tb;
    });
    var alertWrap = $('stockAlertsWrap');
    var alertCount = $('stock-alert-count');
    if (alertCount) alertCount.textContent = lowStockItems.length ? '(' + lowStockItems.length + ')' : '(✓)';
    if (alertWrap) {
      if (lowStockItems.length) {
        alertWrap.innerHTML = lowStockItems.slice(0, 6).map(function(p) {
          var total = p.colors ? p.colors.reduce(function(s, c) { return s + (typeof c.stock === 'number' ? c.stock : 0); }, 0) : 0;
          var color = total <= 2 ? 'var(--er)' : '#e65100';
          return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:.78rem">' +
            '<span style="width:28px;height:36px;background:var(--cr);border-radius:4px;overflow:hidden;flex-shrink:0">' +
            (p.images[0] ? '<img src="' + p.images[0] + '" style="width:100%;height:100%;object-fit:cover">' : '') + '</span>' +
            '<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.nom) + '</span>' +
            '<span style="font-weight:600;color:' + color + '">' + total + '</span></div>';
        }).join('');
      } else {
        alertWrap.innerHTML = '<div style="text-align:center;padding:16px;color:var(--ok);font-size:.85rem">✓ Tous les stocks sont suffisants</div>';
      }
    }

    var tbody = $('recentOrders');
    tbody.innerHTML = orders.length
      ? orders.slice(0, 5).map(function (o) {
          return '<tr><td>' + o.id + '</td><td>' + (o.client || '—') + '</td><td>' + fmt(o.total) + ' FCFA</td><td><span class="order-status status-' + o.statut + '">' + labelStatut(o.statut) + '</span></td><td>' + new Date(o.created_at).toLocaleString('fr-FR') + '</td></tr>';
        }).join('')
      : '<tr><td colspan="5" class="empty-row">Aucune commande</td></tr>';
  }

  function labelStatut(s) { var m = { en_attente: 'En attente', confirmee: 'Confirmée', preparation: 'En cours', livraison: 'En route', livree: 'Livrée', annulee: 'Annulée' }; return m[s] || s; }

  // PRODUCTS
  function loadProducts() {
    var products = DB.getAll();
    var tbody = $('productsTable');
    tbody.innerHTML = products.length
      ? products.map(function (p, i) {
          var stock = p.colors && p.colors.length ? p.colors.map(function(c) { var s = typeof c.stock === 'number' ? c.stock : (c.stocks ? Object.values(c.stocks).reduce(function(a,b){return a+b},0) : 0); return '<span style="font-size:.72rem;color:#555;margin-right:6px;white-space:nowrap;display:inline-block;background:#f5f5f5;padding:1px 6px;border-radius:3px">' + c.name + ': ' + s + '</span>'; }).join('') : (p.variantes ? p.variantes.reduce(function (s, v) { return s + v.stock; }, 0) : 0);
          var promo = p.promo_pct ? '<span style="color:var(--ok);font-weight:600">-' + p.promo_pct + '%</span>' : '<span style="color:var(--tl);font-size:.78rem">—</span>';
          var totalStock = p.colors && p.colors.length ? p.colors.reduce(function (s, c) { return s + (typeof c.stock === 'number' ? c.stock : (c.stocks ? Object.values(c.stocks).reduce(function(a,b){return a+b},0) : 0)); }, 0) : 0;
          var niveau = totalStock > 50 ? '<span style="color:#2e7d32;font-weight:600">Élevé</span>' : totalStock > 20 ? '<span style="color:#e65100;font-weight:600">Moyen</span>' : totalStock > 0 ? '<span style="color:#c62828;font-weight:600">Faible</span>' : '<span style="color:#999">Rupture</span>';
          var vendus = 0;
          try { var ords = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]'); vendus = ords.filter(function(o){return o.statut!=='annulee'}).reduce(function(s, o) { return s + ((o.items||[]).filter(function(it){return it.nom===p.nom}).reduce(function(a,b){return a+(b.qte||0)},0)); }, 0); } catch(e) {}
          return '<tr><td>' + (p.images[0] ? '<img src="' + p.images[0] + '" class="prod-thumb">' : '') + '</td><td><span class="prod-name-cell">' + p.nom + '</span></td><td>' + p.categorie + '</td><td>' + fmt(p.prix) + ' FCFA</td><td>' + promo + '</td><td>' + stock + '</td><td>' + niveau + '</td><td>' + vendus + '</td><td class="actions-cell" style="white-space:nowrap"><button class="btn-add btn-sm" onclick="SytamAdmin.editProduct(\'' + p.id + '\')" title="Modifier">✎</button><button class="btn-del btn-sm" onclick="SytamAdmin.deleteProduct(\'' + p.id + '\')" title="Supprimer">✕</button></td></tr>';
        }).join('')
      : '<tr><td colspan="9" class="empty-row">Aucun produit</td></tr>';
  }

  function compressImage(file, cb) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var maxW = 1200, maxH = 1500;
        var w = img.width, h = img.height;
        if (w > maxW || h > maxH) {
          var ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio); h = Math.round(h * ratio);
        }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        cb(c.toDataURL('image/jpeg', 0.92));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function uploadImage(input) {
    var file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Erreur', 'L\'image ne doit pas dépasser 5 Mo'); return; }
    compressImage(file, function(dataUrl) {
      var ta = document.querySelector('#product-form [name="images"]');
      if (ta) {
        var val = ta.value.trim();
        ta.value = val ? val + '\n' + dataUrl : dataUrl;
      }
      var preview = $('image-preview');
      if (preview) {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;display:inline-block';
        var img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = 'width:60px;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--bd)';
        wrap.appendChild(img);
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-del btn-sm';
        del.innerHTML = '✕';
        del.style.cssText = 'position:absolute;top:-6px;right:-6px;padding:2px 5px;font-size:.65rem;border-radius:50%;line-height:1';
        del.onclick = function() { SytamAdmin.removeImage(del); };
        wrap.appendChild(del);
        preview.appendChild(wrap);
      }
      showToast('✓ Image compressée et chargée');
    });
  }

  function uploadColorImage(input) {
    var file = input.files[0];
    if (!file) return;
    compressImage(file, function(dataUrl) {
      var row = input.closest('.c-row');
      if (!row) return;
      var hidden = row.querySelector('.c-img-data');
      var preview = row.querySelector('.c-img-preview');
      if (hidden) hidden.value = dataUrl;
      if (preview) { preview.src = dataUrl; preview.style.display = ''; }
    });
  }

  var MEASURE_TEMPLATES = {
    robes: 'Longueur: 140cm | Poitrine: 86cm | Longueur manche: 60cm',
    jupe: 'Longueur: 88cm | Tour de taille: 66cm | Hanches: 90cm',
    jupes: 'Longueur: 88cm | Tour de taille: 66cm | Hanches: 90cm',
    pantalon: 'Longueur: 102cm | Tour de hanche: 94cm',
    pantalons: 'Longueur: 102cm | Tour de hanche: 94cm',
    chemise: 'Longueur chemise: 72cm | Longueur manche: 58cm',
    ensembles: 'Longueur tunique: 72cm | Longueur pantalon: 102cm',
    cardigan: 'Longueur: 90cm | Poitrine: 84cm | Longueur manche: 58cm',
    sport: 'Longueur tunique: 70cm | Longueur pantalon: 100cm',
    voiles: '',
    accessoires: '',
  };
  function getMeasurePlaceholder(cat) {
    var key = (cat || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    return MEASURE_TEMPLATES[key] !== undefined ? MEASURE_TEMPLATES[key] : 'Longueur: ... | Largeur: ...';
  }
  function updateMeasurePlaceholders(cat) {
    var ph = getMeasurePlaceholder(cat);
    document.querySelectorAll('.mesure-input').forEach(function(inp) { inp.placeholder = ph; });
  }
  function renderMesureEditor(mesures) {
    var fields = (mesures && mesures.fields) || [];
    if (!fields || !fields.length) return '<p style="font-size:.8rem;color:var(--tl);padding:8px 0">Ajoutez des mesures (Longueur, Poitrine, etc.)</p>';
    var html = '<div style="overflow-x:auto;margin-top:8px"><table style="width:100%;border-collapse:collapse;font-size:.8rem"><thead><tr><th style="padding:6px 8px;border:1px solid var(--bd);background:var(--bg2);text-align:left">Mesure</th>';
    ALL_SIZES.forEach(function(s) {
      html += '<th style="padding:6px 8px;border:1px solid var(--bd);background:var(--bg2);text-align:center">' + s + '</th>';
    });
    html += '<th style="padding:6px 8px;border:1px solid var(--bd);background:var(--bg2);width:30px"></th></tr></thead><tbody>';
    fields.forEach(function(f, fi) {
      html += '<tr><td style="padding:4px 8px;border:1px solid var(--bd);font-weight:500;white-space:nowrap">' + f.replace(/"/g,'&quot;') + '</td>';
      ALL_SIZES.forEach(function(s) {
        var val = (mesures[s] && mesures[s][fi]) || '';
        html += '<td style="padding:2px 4px;border:1px solid var(--bd);text-align:center"><input class="mesure-cell" data-fi="' + fi + '" data-size="' + s + '" value="' + val.replace(/"/g,'&quot;') + '" style="width:52px;padding:4px;border:1px solid #ddd;border-radius:4px;text-align:center;font-size:.75rem"></td>';
      });
      html += '<td style="padding:2px 4px;border:1px solid var(--bd);text-align:center"><button type="button" class="btn-del btn-sm" onclick="SytamAdmin.removeMesureField(' + fi + ')" style="padding:2px 6px;font-size:.7rem">✕</button></td></tr>';
    });
    html += '</tbody></table></div>';
    html += '<input type="hidden" name="mesure-fields" value=\'' + JSON.stringify(fields).replace(/'/g,"&apos;") + '\'>';
    return html;
  }
  function addMesureField() {
    var inp = document.getElementById('new-mesure-name');
    if (!inp || !inp.value.trim()) { showToast('Erreur', 'Donne un nom à la mesure'); return; }
    var name = inp.value.trim();
    inp.value = '';
    var editor = document.getElementById('mesure-editor');
    if (!editor) return;
    // Read current data
    var data = readMesureData();
    if (!data.fields) data.fields = [];
    data.fields.push(name);
    (data.S || (data.S = [])).push('');
    (data.M || (data.M = [])).push('');
    (data.L || (data.L = [])).push('');
    (data.XL || (data.XL = [])).push('');
    editor.innerHTML = renderMesureEditor(data);
  }
  function removeMesureField(fi) {
    var editor = document.getElementById('mesure-editor');
    if (!editor) return;
    var data = readMesureData();
    if (!data.fields || fi >= data.fields.length) return;
    data.fields.splice(fi, 1);
    ALL_SIZES.forEach(function(s) { if (data[s]) data[s].splice(fi, 1); });
    editor.innerHTML = renderMesureEditor(data);
  }
  function readMesureData() {
    var data = { fields: [] };
    var hidden = document.querySelector('[name="mesure-fields"]');
    if (hidden) { try { data.fields = JSON.parse(hidden.value); } catch(e) {} }
    ALL_SIZES.forEach(function(s) {
      data[s] = [];
      data.fields.forEach(function(f, fi) {
        var cell = document.querySelector('.mesure-cell[data-fi="' + fi + '"][data-size="' + s + '"]');
        data[s].push(cell ? cell.value.trim() : '');
      });
    });
    return data;
  }

  function openProductModal(product) {
    editingId = null;
    var nom = '', categorie = 'voiles', sous_type = '', prix = '', desc = '', images = '', tagSel = '', promoPct = '';
    var colors = [];

    if (product) {
      editingId = product.id;
      nom = product.nom; categorie = product.categorie; sous_type = product.sous_type;
      prix = product.prix; desc = product.description || '';
      images = (product.images || []).join('\n');
      promoPct = product.promo_pct || '';
      tagSel = product.tag || (product.en_avant ? 'nouveau' : '');
      if (product.colors && product.colors.length) {
        colors = product.colors;
      } else if (product.variantes && product.variantes.length) {
        colors = product.variantes.map(function (v) {
          return { name: v.attributs.couleur || 'Noir', hex: getHexForColor(v.attributs.couleur || 'Noir'), stock: v.stock || 0 };
        });
      }
    }
    var allCatOptions = (typeof CATEGORIES !== 'undefined' ? CATEGORIES.map(function(c) { return c.nom; }) : []).concat(['jupes', 'manteaux', 'cardigan', 'collants', 'nikab', 'jellabas']).filter(function(v,i,a) { return a.indexOf(v) === i; }).map(function(c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
    var mesures = (product && product.mesures) || {};
    // Convert old format to new structured format
    if (mesures && !mesures.fields) {
      var _oldSizes = ['S','M','L','XL'];
      var _firstVal = '';
      for (var _si = 0; _si < _oldSizes.length; _si++) {
        if (mesures[_oldSizes[_si]] && Array.isArray(mesures[_oldSizes[_si]]) && mesures[_oldSizes[_si]].length) {
          _firstVal = mesures[_oldSizes[_si]][0] || '';
          break;
        }
      }
      if (_firstVal && _firstVal.indexOf(':') !== -1) {
        var _sample = mesures[_oldSizes[0]] || mesures[_oldSizes[1]] || [];
        mesures.fields = _sample.map(function(m) { var parts = m.split(':'); return parts.length >= 2 ? parts[0].trim() : 'Mesure'; });
        _oldSizes.forEach(function(s) {
          if (mesures[s] && Array.isArray(mesures[s])) {
            mesures[s] = mesures[s].map(function(m) { var parts = m.split(':'); return parts.length >= 2 ? parts.slice(1).join(':').trim() : m; });
          }
        });
      } else if (_firstVal) {
        var _sample2 = mesures[_oldSizes[0]] || mesures[_oldSizes[1]] || [];
        mesures.fields = _sample2.map(function(_, i) { return 'Mesure ' + (i + 1); });
      }
    }
    var _defPlaceholder = getMeasurePlaceholder(categorie);

    openModal(
      '<button class="modal-close" onclick="SytamAdmin.closeModal()">✕</button>' +
      '<h2>' + (editingId ? 'Modifier' : 'Ajouter') + ' un produit</h2>' +
      '<form id="product-form" onsubmit="event.preventDefault();SytamAdmin.saveProduct()">' +
      '<div class="form-group"><label class="form-label">Nom du produit</label><input class="form-input" name="nom" value="' + nom.replace(/"/g, '&quot;') + '" required></div>' +
      '<div class="grid-2"><div class="form-group"><label class="form-label">Catégorie</label><input class="form-input" name="categorie" id="cat-input" list="cat-list" value="' + categorie + '" required oninput="SytamAdmin.updateMeasurePlaceholders(this.value)" onchange="SytamAdmin.updateMeasurePlaceholders(this.value)"><datalist id="cat-list">' + allCatOptions + '</datalist></div>' +
      '<div class="form-group"><label class="form-label">Sous-type</label><input class="form-input" name="sous_type" value="' + sous_type + '" required></div></div>' +
      '<div class="grid-2"><div class="form-group"><label class="form-label">Prix (FCFA)</label><input class="form-input" type="number" name="prix" value="' + prix + '" min="0" required></div>' +
      '<div class="form-group"><label class="form-label">Promo (%)</label><input class="form-input" type="number" name="promo_pct" value="' + promoPct + '" min="0" max="100" placeholder="0 = pas de promo"></div></div>' +
      '<div class="form-group"><label class="form-label">Étiquette</label><select class="form-input" name="tag"><option value=""' + (tagSel === '' ? ' selected' : '') + '>Simple</option><option value="nouveau"' + (tagSel === 'nouveau' ? ' selected' : '') + '>🌟 Nouveau</option><option value="tendance"' + (tagSel === 'tendance' ? ' selected' : '') + '>🔥 Populaire / Tendance</option></select></div>' +
      '<div class="form-group"><label class="form-label">Description</label><textarea class="form-input" name="description" rows="3">' + desc + '</textarea></div>' +
      '<div class="form-group"><label class="form-label">Images</label><div id="image-preview" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">' + (images ? images.split('\n').filter(Boolean).map(function(u, idx) { return '<div style="position:relative;display:inline-block"><img src="' + u + '" style="width:60px;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--bd)"><button type="button" class="btn-del btn-sm" onclick="SytamAdmin.removeImage(this)" style="position:absolute;top:-6px;right:-6px;padding:2px 5px;font-size:.65rem;border-radius:50%;line-height:1">✕</button></div>'; }).join('') : '') + '</div><div style="display:flex;gap:8px;margin-bottom:6px"><input type="file" accept="image/*" id="imageUpload" style="flex:1;padding:8px;border:1px solid var(--bd);border-radius:8px;font-size:.8rem" onchange="SytamAdmin.uploadImage(this)"><button type="button" class="btn-del btn-sm" onclick="this.previousElementSibling.value=\'\'" style="padding:8px 12px">✕</button></div><textarea class="form-input" name="images" rows="2" placeholder="https://...">' + images + '</textarea></div>' +
      '<div class="form-group"><label class="form-label" style="font-weight:600;font-size:.85rem;text-transform:uppercase;letter-spacing:.5px">COULEURS &amp; STOCKS</label>' +
      '<div id="colors-list">' + renderColorsEdit(colors) + '</div>' +
      '<div class="c-add-row"><input type="color" class="c-hex-add" value="#B8956A"><input type="text" class="c-name-add" placeholder="Nom couleur (ex: Doré)">' + sizeStockInputsHtml(ALL_SIZES, 'add') + '<button type="button" class="btn-add btn-sm c-add-btn" onclick="SytamAdmin.addColor()">+ Ajouter</button></div>' +
      '<div class="form-group" style="margin-top:16px"><label class="form-label" style="font-weight:600;font-size:.85rem;text-transform:uppercase;letter-spacing:.5px">MESURES PAR TAILLE</label>' +
      '<div id="mesure-editor">' + renderMesureEditor(mesures) + '</div>' +
      '<div style="display:flex;gap:6px;margin-top:8px"><input type="text" id="new-mesure-name" placeholder="Ex: Longueur" style="flex:1;padding:6px 8px;border:1px solid var(--bd);border-radius:6px;font-size:.8rem"><button type="button" class="btn-add btn-sm" onclick="SytamAdmin.addMesureField()">+ Ajouter</button></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="btn-add" onclick="SytamAdmin.saveProduct()">Enregistrer</button>' +
      '<button type="button" class="btn-del" onclick="SytamAdmin.closeModal()">Annuler</button></div></form>'
    );
  }

  function sizeStockInputsHtml(sizes, prefix) {
    if (!sizes || !sizes.length) return '<input type="number" class="c-stock-' + prefix + '" placeholder="Stock" value="10" min="0">';
    return sizes.map(function(s) { return '<input type="number" class="c-stock-' + prefix + '-' + s.toLowerCase() + '" placeholder="' + s + '" value="0" min="0" style="width:48px">'; }).join('');
  }

  function getHexForColor(name) { return COLOR_HEX_MAP[name] || '#B8956A'; }

  function removeImage(btn) {
    var wrap = btn.parentElement;
    if (!wrap) return;
    var img = wrap.querySelector('img');
    var src = img ? (img.getAttribute('src') || img.src) : '';
    // Remove from textarea (comparer l'attribut exact, pas l'URL absolue résolue par le navigateur)
    var ta = document.querySelector('#product-form [name="images"]');
    if (ta && src) {
      var urls = ta.value.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
      urls = urls.filter(function(u) { return u !== src && u !== img.src; });
      ta.value = urls.join('\n');
    }
    wrap.remove();
  }

  function getStockVal(c, s) {
    if (c.stocks && c.stocks[s]) return c.stocks[s];
    if (c.stock !== undefined) return c.stock;
    return 0;
  }

  function cRowHtml(hex, name, stock, img) {
    var imgAttr = img ? 'value="' + img.replace(/"/g, '&quot;') + '"' : 'value=""';
    var imgStyle = img ? '' : 'display:none;';
    var stockHtml = ALL_SIZES.length
      ? ALL_SIZES.map(function(s) {
          var v = (typeof stock === 'object' && stock !== null) ? (stock[s] || 0) : (typeof stock === 'number' ? stock : 0);
          return '<input type="number" class="c-stock-' + s.toLowerCase() + '" placeholder="' + s + '" value="' + v + '" min="0" style="width:48px">';
        }).join('')
      : '<input type="number" class="c-stock" placeholder="Stock" value="' + (typeof stock === 'number' ? stock : 0) + '" min="0">';
    return '<input type="color" class="c-hex" value="' + hex + '">' +
      '<input type="text" class="c-name" placeholder="Nom couleur" value="' + name.replace(/"/g, '&quot;') + '">' +
      stockHtml +
      '<div class="c-img-wrap">' +
      '<input type="file" accept="image/*" class="c-img-file" style="display:none" onchange="SytamAdmin.uploadColorImage(this)">' +
      '<input type="hidden" class="c-img-data" ' + imgAttr + '>' +
      '<button type="button" class="c-img-btn" onclick="this.parentElement.querySelector(\'.c-img-file\').click()" title="Photo couleur">🖼</button>' +
      '<img class="c-img-preview" src="' + img + '" style="' + imgStyle + 'width:32px;height:40px;object-fit:cover;border-radius:4px;border:1px solid var(--bd)">' +
      '</div>';
  }

  function renderColorsEdit(colors) {
    return colors.map(function (c) {
      return '<div class="c-row">' + cRowHtml(c.hex || getHexForColor(c.name), c.name, c.stocks || c.stock, c.image || '') + '<button type="button" class="btn-del btn-sm c-remove" onclick="this.closest(\'.c-row\').remove()">✕</button></div>';
    }).join('');
  }

  function addColor() {
    var list = $('colors-list');
    if (!list) return;
    var hex = (document.querySelector('.c-hex-add') && document.querySelector('.c-hex-add').value) || '#B8956A';
    var name = document.querySelector('.c-name-add') && document.querySelector('.c-name-add').value.trim();
    if (!name) { showToast('Erreur', 'Donne un nom à la couleur'); return; }
    var div = document.createElement('div');
    div.className = 'c-row';
    var stockVal = {};
    if (ALL_SIZES.length) { ALL_SIZES.forEach(function(s) { var inp = document.querySelector('.c-stock-add-' + s.toLowerCase()); stockVal[s] = parseInt(inp && inp.value) || 0; }); }
    else { var stockInp = document.querySelector('.c-stock-add'); stockVal = parseInt(stockInp && stockInp.value) || 0; }
    div.innerHTML = cRowHtml(hex, name.replace(/"/g, '&quot;'), stockVal, '') + '<button type="button" class="btn-del btn-sm c-remove" onclick="this.closest(\'.c-row\').remove()">✕</button>';
    list.appendChild(div);
    var addRow = document.querySelector('.c-add-row');
    if (addRow) {
      var addHex = addRow.querySelector('.c-hex-add');
      var addName = addRow.querySelector('.c-name-add');
      if (addHex) addHex.value = '#B8956A';
      if (addName) addName.value = '';
      addRow.querySelectorAll('.c-stock-add, [class^="c-stock-add-"]').forEach(function(inp) {
        inp.value = inp.className === 'c-stock-add' ? '10' : '0';
      });
    }
  }

  function saveProduct() {
    try {
      var f = $('product-form');
      if (!f) { showToast('Erreur', 'Formulaire introuvable'); return; }
      var colorRows = qsa('.c-row');
      var colors = Array.from(colorRows).map(function (row) {
      var c = {
        name: (row.querySelector('.c-name') && row.querySelector('.c-name').value || '').trim(),
        hex: row.querySelector('.c-hex') && row.querySelector('.c-hex').value || '#B8956A',
        image: row.querySelector('.c-img-data') && row.querySelector('.c-img-data').value || ''
      };
      if (ALL_SIZES.length) {
        c.stocks = {};
        ALL_SIZES.forEach(function(s) {
          var si = row.querySelector('.c-stock-' + s.toLowerCase());
          c.stocks[s] = parseInt(si && si.value) || 0;
        });
      } else {
        var si = row.querySelector('.c-stock');
        c.stock = parseInt(si && si.value) || 0;
      }
      return c;
    }).filter(function (c) { return c.name; });
    var data = {
      nom: f.querySelector('[name="nom"]').value.trim(),
      categorie: f.querySelector('[name="categorie"]').value,
      sous_type: f.querySelector('[name="sous_type"]').value.trim(),
      description: f.querySelector('[name="description"]').value.trim(),
      prix: parseInt(f.querySelector('[name="prix"]').value) || 0,
      promo_pct: parseInt(f.querySelector('[name="promo_pct"]').value) || 0,
      tag: f.querySelector('[name="tag"]').value,
      en_avant: f.querySelector('[name="tag"]').value === 'nouveau',
      images: f.querySelector('[name="images"]').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      colors: colors.length ? colors : [],
      sizes: ALL_SIZES.length ? ALL_SIZES : [],
      variantes: [],
      mesures: {},
    };
    // Read structured mesures
    var mesureData = readMesureData();
    if (mesureData.fields && mesureData.fields.length) {
      data.mesures = mesureData;
    }
    if (editingId) DB.update(editingId, data); else DB.add(data);
    closeModal();
    loadProducts();
    showToast('✓ Produit ' + (editingId ? 'modifié' : 'ajouté'));
    } catch(e) { showToast('Erreur', 'Impossible de sauvegarder: ' + e.message); }
  }

  function deleteProduct(id) {
    if (!confirm('Supprimer ce produit ?')) return;
    DB.delete(id);
    loadProducts();
    showToast('✓ Produit supprimé');
  }

  // MESSAGES
  function loadMessages() {
    var tbody = $('messagesTable');
    if (!tbody) return;
    var msgs = JSON.parse(localStorage.getItem('sytam_messages') || '[]');
    msgs.reverse();
    var unread = msgs.filter(function(m) { return !m.lu; }).length;
    var badge = $('msg-badge');
    if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'inline' : 'none'; }
    tbody.innerHTML = msgs.length
      ? msgs.map(function(m) {
          var cls = m.lu ? '' : ' style="font-weight:600;background:#FFF8F0"';
          return '<tr' + cls + ' onclick="SytamAdmin.openMessage(\'' + m.id + '\')"><td style="white-space:nowrap">' + new Date(m.created_at).toLocaleString('fr-FR') + '</td><td>' + esc(m.name) + '</td><td>' + esc(m.email || '') + '</td><td>' + esc(m.phone || '') + '</td><td style="max-width:250px;white-space:normal">' + esc(m.message) + '</td><td class="actions-cell"><button class="btn-del btn-sm" onclick="event.stopPropagation();SytamAdmin.deleteMessage(\'' + m.id + '\')" title="Supprimer">✕</button></td></tr>';
        }).join('')
      : '<tr><td colspan="6" class="empty-row">Aucun message</td></tr>';
  }

  function openMessage(id) {
    var msgs = JSON.parse(localStorage.getItem('sytam_messages') || '[]');
    var m = msgs.find(function(x) { return x.id === id; });
    if (!m) return;
    if (!m.lu) { m.lu = true; localStorage.setItem('sytam_messages', JSON.stringify(msgs)); loadMessages(); }
    openModal(
      '<button class="modal-close" onclick="SytamAdmin.closeModal()">✕</button>' +
      '<h2>Message de ' + esc(m.name) + '</h2>' +
      '<div style="margin:16px 0;font-size:.85rem;color:var(--tl)"><strong>Email :</strong> ' + esc(m.email || '—') + '<br><strong>Tél :</strong> ' + esc(m.phone || '—') + '<br><strong>Date :</strong> ' + new Date(m.created_at).toLocaleString('fr-FR') + '</div>' +
      '<div style="background:var(--bg);padding:16px;border-radius:8px;margin-bottom:16px;line-height:1.6;white-space:pre-wrap">' + esc(m.message) + '</div>' +
      '<button class="btn-del" onclick="SytamAdmin.deleteMessage(\'' + m.id + '\');SytamAdmin.closeModal()">Supprimer</button>'
    );
  }

  function deleteMessage(id) {
    if (!confirm('Supprimer ce message ?')) return;
    var msgs = JSON.parse(localStorage.getItem('sytam_messages') || '[]');
    msgs = msgs.filter(function(m) { return m.id !== id; });
    localStorage.setItem('sytam_messages', JSON.stringify(msgs));
    loadMessages();
    showToast('✓ Message supprimé');
  }

  function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ORDERS
  function loadOrders() {
    var orders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
    var filter = ($('orderFilter') && $('orderFilter').value) || 'all';
    if (filter !== 'all') orders = orders.filter(function (o) { return o.statut === filter; });
    var tbody = $('ordersTable');
    tbody.innerHTML = orders.length
      ? orders.map(function (o) {
          var itemsSummary = (o.items || []).length + ' art.';
          var firstItem = (o.items && o.items[0]) ? o.items[0].nom : '';
          if (firstItem) itemsSummary = firstItem + ((o.items||[]).length > 1 ? ' +' + ((o.items||[]).length-1) : '');
          var dateStr = new Date(o.created_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
          return '<tr>' +
            '<td style="font-size:.8rem;color:var(--tl)">#' + o.id + '</td>' +
            '<td><strong>' + (o.client || '—') + '</strong><br><span style="font-size:.75rem;color:var(--tl)">' + (o.telephone || '') + '</span></td>' +
            '<td style="font-size:.82rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + itemsSummary.replace(/"/g,'&quot;') + '">' + itemsSummary + '</td>' +
            '<td style="text-align:right;font-weight:600">' + fmt(o.total) + ' FCFA</td>' +
            '<td style="font-size:.8rem">' + (o.mode_paiement || '—') + '</td>' +
            '<td><span class="order-status status-' + o.statut + '">' + labelStatut(o.statut) + '</span></td>' +
            '<td style="font-size:.78rem;color:var(--tl)">' + dateStr + '</td>' +
            '<td class="actions-cell"><button class="btn-add btn-sm" onclick="SytamAdmin.viewOrder(\'' + o.id + '\')">Détail</button><select class="form-input" style="width:auto;padding:3px 6px;font-size:.72rem" onchange="SytamAdmin.updateStatus(\'' + o.id + '\',this.value)">' +
            ['en_attente', 'confirmee', 'preparation', 'livraison', 'livree', 'annulee'].map(function (s) { return '<option value="' + s + '"' + (o.statut === s ? ' selected' : '') + '>' + labelStatut(s) + '</option>'; }).join('') +
          '</select><button class="btn-del btn-sm" onclick="SytamAdmin.deleteOrder(\'' + o.id + '\')" title="Supprimer">✕</button></td></tr>';
        }).join('')
      : '<tr><td colspan="8" class="empty-row">Aucune commande</td></tr>';
    // Update badge
    var pending = orders.filter(function (o) { return o.statut === 'en_attente'; }).length;
    var badge = $('ord-badge');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'inline' : 'none'; }
  }

  function updateStatus(id, status) {
    var orders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
    var o = orders.find(function (x) { return x.id === id; });
    if (o) { o.statut = status; localStorage.setItem('sytam_orders_v2', JSON.stringify(orders)); pushToSupabase('sytam_orders_v2'); }
    loadOrders(); loadDashboard();
    showToast('✓ Statut mis à jour');
  }

  function deleteOrder(id) {
    if (!confirm('Supprimer cette commande ?')) return;
    var orders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
    orders = orders.filter(function(o) { return o.id !== id; });
    localStorage.setItem('sytam_orders_v2', JSON.stringify(orders)); pushToSupabase('sytam_orders_v2');
    loadOrders(); loadDashboard();
    showToast('✓ Commande supprimée');
  }

  function viewOrder(id) {
    var orders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
    var o = orders.find(function (x) { return x.id === id; });
    if (!o) return;
    var items = (o.items || []).map(function (item) {
      return '<tr><td>' + item.nom + '</td><td>' + (item.variantLabel || '—') + '</td><td>' + fmt(item.prix) + ' FCFA</td><td>' + item.qte + '</td><td>' + fmt(item.prix * item.qte) + ' FCFA</td></tr>';
    }).join('');
    var regionHtml = o.region ? '<p><strong>Région :</strong> ' + o.region + '</p>' : '';
    var quartierHtml = o.quartier ? '<p><strong>Quartier :</strong> ' + o.quartier + '</p>' : '';
    openModal(
      '<button class="modal-close" onclick="SytamAdmin.closeModal()">✕</button>' +
      '<div class="order-detail">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
      '<h2 style="margin:0">Commande #' + o.id + '</h2>' +
      '<span class="order-status status-' + o.statut + '" style="font-size:.9rem;padding:6px 14px">' + labelStatut(o.statut) + '</span>' +
      '</div>' +
      '<div class="order-info-grid">' +
      '<div><p><strong>Client :</strong> ' + (o.client || '—') + '</p><p><strong>Tél :</strong> ' + (o.telephone || '—') + '</p>' + regionHtml + quartierHtml + '<p><strong>Adresse :</strong> ' + (o.adresse || '—') + '</p></div>' +
      '<div><p><strong>Date :</strong> ' + new Date(o.created_at).toLocaleString('fr-FR') + '</p><p><strong>Paiement :</strong> ' + (o.mode_paiement || '—') + '</p><p><strong>Livraison :</strong> ' + fmt(o.frais_livraison) + ' FCFA</p><p><strong>Sous-total :</strong> ' + fmt(o.total - (o.frais_livraison || 0)) + ' FCFA</p></div>' +
      '</div>' +
      (o.notes ? '<div style="background:var(--bg);padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:.85rem;color:var(--tl)"><strong>Notes :</strong> ' + o.notes + '</div>' : '') +
      '<div class="tbl-wrap"><table><thead><tr><th>Produit</th><th>Variante</th><th>Prix</th><th>Qté</th><th>Total</th></tr></thead><tbody>' + (items || '<tr><td colspan="5" class="empty-row">Aucun article</td></tr>') + '</tbody></table></div>' +
      '<div class="order-total">Total : ' + fmt(o.total) + ' FCFA</div>' +
      '</div>'
    );
  }

  // ---- REFERRALS + FLASH PROMOS ----
  function loadReferrals() {
    var tbody = $('referralTable');
    if (!tbody) return;
    var refs = JSON.parse(localStorage.getItem('sytam_referrals') || '[]');
    tbody.innerHTML = refs.length
      ? refs.map(function(r) {
          return '<tr><td><strong>' + r.code + '</strong></td><td>-' + r.reduction + '%</td><td>' + (r.used || 0) + ' utilisations</td><td><button class="btn-del btn-sm" onclick="SytamAdmin.deleteReferral(\'' + r.id + '\')">✕</button></td></tr>';
        }).join('')
      : '<tr><td colspan="4" class="empty-row">Aucun code créé.</td></tr>';
    // Also render flash list if visible
    renderFlashList();
  }

  function openReferralModal() {
    openModal(
      '<button class="modal-close" onclick="SytamAdmin.closeModal()">✕</button>' +
      '<h2>Nouveau code parrainage</h2>' +
      '<form onsubmit="event.preventDefault();SytamAdmin.saveReferral()">' +
      '<div class="form-group"><label class="form-label">Code</label><input class="form-input" id="ref-code" placeholder="Ex: AMINA20" required style="text-transform:uppercase"></div>' +
      '<div class="form-group"><label class="form-label">Réduction (%)</label><input class="form-input" type="number" id="ref-reduction" min="1" max="100" required></div>' +
      '<div class="form-group" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="ref-active" checked><label for="ref-active" style="font-size:.85rem">Actif</label></div>' +
      '<div style="display:flex;gap:8px"><button type="submit" class="btn-primary-fidelite">Créer</button>' +
      '<button type="button" class="btn-del" onclick="SytamAdmin.closeModal()">Annuler</button></div></form>'
    );
  }

  function saveReferral() {
    var code = $('ref-code').value.toUpperCase().trim();
    var reduction = parseInt($('ref-reduction').value);
    var actif = $('ref-active').checked;
    if (!code || !reduction) return;
    var refs = JSON.parse(localStorage.getItem('sytam_referrals') || '[]');
    refs.push({ id: Date.now().toString(36), code: code, reduction: reduction, used: 0, actif: actif });
    localStorage.setItem('sytam_referrals', JSON.stringify(refs));
    closeModal();
    loadReferrals();
    showToast('✓ Code ' + code + ' créé');
  }

  function deleteReferral(id) {
    var refs = JSON.parse(localStorage.getItem('sytam_referrals') || '[]');
    refs = refs.filter(function(r) { return r.id !== id; });
    localStorage.setItem('sytam_referrals', JSON.stringify(refs));
    loadReferrals();
  }



  // ---- FIDELITE ----
  function _rebuildLoyaltyFromOrders(loyalty) {
    try {
      var orders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
      var changed = false;
      orders.forEach(function(o) {
        if (o.statut === 'confirmee' || o.statut === 'livree') {
          var phone = o.telephone || o.client_phone || '';
          if (phone) {
            var clean = phone.replace(/[^0-9+]/g, '');
            if (clean) {
              if (!loyalty[clean]) { loyalty[clean] = { orders: 0, total: 0 }; }
              var found = false;
              if (loyalty[clean]._orders && Array.isArray(loyalty[clean]._orders)) {
                found = loyalty[clean]._orders.indexOf(o.id) !== -1;
              }
              if (!found) {
                loyalty[clean].orders = Math.max(loyalty[clean].orders || 0, 1);
                // compter vraiment : on parcourt toutes les commandes
                changed = true;
              }
            }
          }
        }
      });
      // Recompter proprement depuis zéro
      var recount = {};
      orders.forEach(function(o) {
        if (o.statut === 'confirmee' || o.statut === 'livree') {
          var phone = o.telephone || o.client_phone || '';
          if (phone) {
            var clean = phone.replace(/[^0-9+]/g, '');
            if (clean) {
              if (!recount[clean]) recount[clean] = { orders: 0, total: 0 };
              recount[clean].orders += 1;
              recount[clean].total += (o.total || 0);
            }
          }
        }
      });
      Object.keys(recount).forEach(function(p) {
        if (!loyalty[p] || loyalty[p].orders !== recount[p].orders || loyalty[p].total !== recount[p].total) {
          loyalty[p] = recount[p];
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem('sytam_loyalty_v2', JSON.stringify(loyalty));
      }
    } catch(e) {}
  }

  function loadLoyalty() {
    var tbody = $('loyaltyTable');
    if (!tbody) return;
    var loyalty = JSON.parse(localStorage.getItem('sytam_loyalty_v2') || '{}');
    // Reconstruire la fidélité depuis toutes les commandes existantes
    _rebuildLoyaltyFromOrders(loyalty);
    var phones = Object.keys(loyalty).sort();
    tbody.innerHTML = phones.length
      ? phones.map(function(p) {
          var d = loyalty[p];
          var orders = d.orders || 0;
          var total = d.total || 0;
          var progress = Math.min(orders, 10);
          var pct = (progress / 10) * 100;
          var eligible = orders >= 10;
          return '<tr><td>' + p + '</td><td>' + orders + '</td><td>' + fmt(total) + ' FCFA</td><td><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:6px;background:var(--bd);border-radius:3px"><div style="width:' + pct + '%;height:6px;background:var(--gold);border-radius:3px"></div></div><span style="font-size:.75rem;color:var(--tl);white-space:nowrap">' + orders + '/10</span></div></td><td>' + (eligible ? '<span style="color:var(--ok);font-weight:600">🎁 Éligible</span>' : '<span style="color:var(--tl);font-size:.78rem">—</span>') + '</td></tr>';
        }).join('')
      : '<tr><td colspan="5" class="empty-row">Aucun client fidèle pour le moment.</td></tr>';
  }

  function searchLoyalty(val) {
    var tbody = $('loyaltyTable');
    if (!tbody) return;
    var loyalty = JSON.parse(localStorage.getItem('sytam_loyalty_v2') || '{}');
    var phones = Object.keys(loyalty).sort();
    if (val.trim()) {
      phones = phones.filter(function(p) { return p.indexOf(val.trim()) !== -1; });
    }
    tbody.innerHTML = phones.length
      ? phones.map(function(p) {
          var d = loyalty[p];
          var orders = d.orders || 0;
          var total = d.total || 0;
          var progress = Math.min(orders, 10);
          var pct = (progress / 10) * 100;
          var eligible = orders >= 10;
          return '<tr><td>' + p + '</td><td>' + orders + '</td><td>' + fmt(total) + ' FCFA</td><td><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:6px;background:var(--bd);border-radius:3px"><div style="width:' + pct + '%;height:6px;background:var(--gold);border-radius:3px"></div></div><span style="font-size:.75rem;color:var(--tl);white-space:nowrap">' + orders + '/10</span></div></td><td>' + (eligible ? '<span style="color:var(--ok);font-weight:600">🎁 Éligible</span>' : '<span style="color:var(--tl);font-size:.78rem">—</span>') + '</td></tr>';
        }).join('')
      : '<tr><td colspan="5" class="empty-row">Aucun résultat.</td></tr>';
  }

  function _generateAnalyticsFromOrders() {
    if (typeof SytamAnalytics === 'undefined' || !SytamAnalytics._agg) return;
    try {
      var orders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
      var agg = SytamAnalytics._agg;
      var events = SytamAnalytics._events;
      var existingOrderIds = {};
      events.forEach(function(e) {
        if (e.t === 'order_placed' && e.d && e.d.orderId) existingOrderIds[e.d.orderId] = true;
      });
      var newEvents = [];
      orders.forEach(function(o) {
        if ((o.statut === 'confirmee' || o.statut === 'livree') && !existingOrderIds[o.id]) {
          // Ajouter les produits comme "ajout panier"
          (o.items || []).forEach(function(item) {
            var pid = item.id || item.nom;
            if (!agg.addToCart[pid]) agg.addToCart[pid] = { name: item.nom, count: 0 };
            agg.addToCart[pid].count += (item.qte || 1);
            agg.totalAddToCart = (agg.totalAddToCart || 0) + (item.qte || 1);
            // Clic produit aussi (car vu puis acheté)
            if (!agg.productClicks[pid]) agg.productClicks[pid] = { name: item.nom, count: 0 };
            agg.productClicks[pid].count += (item.qte || 1);
            agg.totalProductClicks = (agg.totalProductClicks || 0) + (item.qte || 1);
            newEvents.push({
              t: 'add_to_cart', ts: o.created_at || new Date().toISOString(),
              s: 'admin_order', v: o.telephone || '',
              d: { productId: pid, productName: item.nom, variant: item.couleur || '', qty: item.qte || 1 },
            });
            newEvents.push({
              t: 'product_click', ts: o.created_at || new Date().toISOString(),
              s: 'admin_order', v: o.telephone || '',
              d: { productId: pid, productName: item.nom },
            });
          });
          // Événement commande
          newEvents.push({
            t: 'order_placed', ts: o.created_at || new Date().toISOString(),
            s: 'admin_order', v: o.telephone || '',
            d: { orderId: o.id, total: o.total || 0 },
          });
          // Visite et checkout
          newEvents.push({
            t: 'checkout_start', ts: o.created_at || new Date().toISOString(),
            s: 'admin_order', v: o.telephone || '',
            d: {},
          });
          newEvents.push({
            t: 'page_visit', ts: o.created_at || new Date().toISOString(),
            s: 'admin_order', v: o.telephone || '',
            d: { page: 'boutique' },
          });
          agg.totalVisits = (agg.totalVisits || 0) + 1;
          var uid = o.telephone || o.id;
          if (agg.uniqueVisitorIds.indexOf(uid) === -1) agg.uniqueVisitorIds.push(uid);
          agg.totalUnique = agg.uniqueVisitorIds.length;
          // Stats journalières
          var dayKey = (o.created_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
          if (!agg.dailyStats[dayKey]) agg.dailyStats[dayKey] = { visits: 0, addToCart: 0, clicks: 0, removeFromCart: 0, timeSeconds: 0 };
          agg.dailyStats[dayKey].visits = (agg.dailyStats[dayKey].visits || 0) + 1;
          agg.dailyStats[dayKey].addToCart = (agg.dailyStats[dayKey].addToCart || 0) + (o.items || []).length;
          agg.dailyStats[dayKey].clicks = (agg.dailyStats[dayKey].clicks || 0) + (o.items || []).length;
        }
      });
      if (newEvents.length) {
        agg.lastUpdated = Date.now();
        SytamAnalytics._events = events.concat(newEvents);
        SytamAnalytics._saveEvents();
        SytamAnalytics._saveAgg();
      }
    } catch(e) {}
  }

  function loadAnalytics() {
    if (typeof SytamAnalytics !== 'undefined') {
      if (!SytamAnalytics._agg) {
        var stored = localStorage.getItem(SytamAnalytics.AGG_KEY);
        if (stored) { try { SytamAnalytics._agg = JSON.parse(stored); } catch(e) {} }
      }
      if (!SytamAnalytics._agg) SytamAnalytics._loadAgg();
      if (!SytamAnalytics._events || !SytamAnalytics._events.length) SytamAnalytics._loadEvents();
      _generateAnalyticsFromOrders();
      SytamAnalytics.renderAdminAnalytics();
    } else {
      var tab = document.getElementById('tab-analytics');
      if (tab) tab.innerHTML = '<div class="topbar"><div style="display:flex;align-items:center;gap:.5rem;"><div class="hamburger" onclick="SytamAdmin.toggleSidebar()">☰</div><div><h1>Analytiques</h1><p>Statistiques et rapports</p></div></div></div><p style="color:var(--tl);padding:40px;text-align:center">Chargement des données...</p>';
    }
  }

  function syncAnalytics() {
    if (typeof SupabaseAPI === 'undefined' || !SupabaseApp.ready) {
      showToast('Supabase', 'Supabase pas prêt');
      return;
    }
    SupabaseAPI.get('store_data', 'sytam_analytics_v1').then(function(data) {
      if (data && data.value && typeof SytamAnalytics !== 'undefined') {
        SytamAnalytics.loadFromSync(data);
        SytamAnalytics.renderAdminAnalytics();
        showToast('Analytiques', 'Données synchronisées');
      }
    }).catch(function() {
      showToast('Erreur', 'Impossible de synchroniser');
    });
  }

  // EXPOSE
  window.SytamAdmin = {
    checkAuth, login, logout, goTab, toggleSidebar,
    openProductModal, editProduct: function (id) { openProductModal(DB.getById(id)); },
    deleteProduct, addColor, saveProduct, closeModal, closeModalOut, uploadImage, uploadColorImage, removeImage,
    viewOrder, updateStatus, deleteOrder, openMessage, deleteMessage,

    loadDashboard, loadOrders, loadMessages, showToast, changePwd, saveSettings, saveNtfyTopic,

    openReferralModal, saveReferral, deleteReferral, loadReferrals,
    loadLoyalty, searchLoyalty, exportData, importData, restoreDefaults,
    updateMeasurePlaceholders, addMesureField, removeMesureField, syncNow,
    loadAnalytics, syncAnalytics,
  };

  document.addEventListener('DOMContentLoaded', checkAuth);
})();
