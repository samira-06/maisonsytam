window.AccountApp = (function() {
  var STORAGE_KEY = 'sytam_accounts';
  var SESSION_KEY = 'sytam_session';

  function _getAccounts() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }

  function _saveAccounts(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    if (typeof SupabaseAPI !== 'undefined' && SupabaseApp.ready) {
      SupabaseAPI.upsert('store_data', { key: STORAGE_KEY, value: list });
    }
  }

  function _hash(pwd) {
    return btoa(pwd + '_sytam_2024');
  }

  function _loadSession() {
    var s = localStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  }

  function _saveSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  function _clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isLoggedIn() {
    return !!_loadSession();
  }

  function register(phone, password, name, email) {
    // Validation
    phone = phone.replace(/[^0-9]/g, '');
    if (phone.length < 6) { return { error: 'Numéro de téléphone invalide' }; }
    if (password.length < 4) { return { error: 'Mot de passe (min 4 caractères)' }; }

    var accounts = _getAccounts();
    if (accounts.some(function(a) { return a.phone === phone; })) {
      return { error: 'Ce numéro est déjà inscrit. Connectez-vous.' };
    }

    var account = {
      phone: phone,
      password: _hash(password),
      name: name || '',
      email: email || '',
      wishlist: [],
      linkedOrders: [],
      created_at: new Date().toISOString()
    };

    // Link existing orders
    var orders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
    orders.forEach(function(o) {
      if (o && o.telephone && o.telephone.replace(/[^0-9]/g, '') === phone) {
        account.linkedOrders.push(o.id);
      }
    });

    accounts.push(account);
    _saveAccounts(accounts);
    _saveSession({ phone: phone, name: account.name, email: account.email });
    return { success: true };
  }

  function login(phone, password) {
    phone = phone.replace(/[^0-9]/g, '');
    var accounts = _getAccounts();
    var found = null;
    for (var i = 0; i < accounts.length; i++) {
      if (accounts[i].phone === phone) { found = accounts[i]; break; }
    }
    if (!found) return { error: 'Aucun compte trouvé avec ce numéro.' };
    if (found.password !== _hash(password)) return { error: 'Mot de passe incorrect.' };
    _saveSession({ phone: found.phone, name: found.name, email: found.email });
    return { success: true };
  }

  function logout() {
    _clearSession();
    if (window.SytamApp && SytamApp.navigate) SytamApp.navigate('home');
    _updateBanner();
  }

  function getCurrentAccount() {
    var session = _loadSession();
    if (!session) return null;
    var accounts = _getAccounts();
    for (var i = 0; i < accounts.length; i++) {
      if (accounts[i].phone === session.phone) return accounts[i];
    }
    return null;
  }

  function _saveAccount(account) {
    var accounts = _getAccounts();
    for (var i = 0; i < accounts.length; i++) {
      if (accounts[i].phone === account.phone) { accounts[i] = account; break; }
    }
    _saveAccounts(accounts);
  }

  // --- Wishlist ---
  function getWishlist() {
    var acc = getCurrentAccount();
    return acc ? (acc.wishlist || []) : [];
  }

  function toggleWishlist(productId) {
    var acc = getCurrentAccount();
    if (!acc) return { error: 'Connectez-vous pour ajouter aux favoris.' };
    var idx = acc.wishlist.indexOf(productId);
    if (idx > -1) {
      acc.wishlist.splice(idx, 1);
    } else {
      acc.wishlist.push(productId);
    }
    _saveAccount(acc);
    return { success: true, inWishlist: idx === -1 };
  }

  function isInWishlist(productId) {
    var wl = getWishlist();
    return wl.indexOf(productId) > -1;
  }

  // --- Rendering ---
  function renderAccount() {
    var container = document.getElementById('account-content');
    if (!container) return;
    var session = _loadSession();
    if (!session) {
      renderLoginForm(container);
    } else {
      renderDashboard(container);
    }
    _updateBanner();
  }

  function renderLoginForm(container) {
    container.innerHTML =
      '<div class="account-form-wrap">' +
        '<div class="account-form-tabs">' +
          '<button class="account-tab active" id="ac-tab-login" onclick="AccountApp._showLoginForm()">Connexion</button>' +
          '<button class="account-tab" id="ac-tab-register" onclick="AccountApp._showRegisterForm()">Inscription</button>' +
        '</div>' +
        '<div id="ac-form-content">' +
          _loginFormHtml() +
        '</div>' +
      '</div>';
  }

  function _loginFormHtml() {
    return '<form class="account-form" onsubmit="AccountApp._handleLogin(event)">' +
      '<h3>Connexion</h3>' +
      '<p class="account-form-sub">Connectez-vous pour suivre vos commandes et gérer vos favoris</p>' +
      '<div class="form-group"><label>Téléphone</label><input type="tel" class="form-input" id="ac-login-phone" placeholder="77 xxx xx xx" required></div>' +
      '<div class="form-group"><label>Mot de passe</label><input type="password" class="form-input" id="ac-login-pwd" placeholder="••••" required></div>' +
      '<div id="ac-login-error" class="account-error" style="display:none"></div>' +
      '<button type="submit" class="btn btn-primary btn-block">Se connecter</button>' +
      '<p class="account-form-foot">Pas encore de compte ? <a href="#" onclick="AccountApp._showRegisterForm();return false">S\'inscrire</a></p>' +
    '</form>';
  }

  function _registerFormHtml() {
    return '<form class="account-form" onsubmit="AccountApp._handleRegister(event)">' +
      '<h3>Inscription</h3>' +
      '<p class="account-form-sub">Créez votre compte pour suivre vos commandes</p>' +
      '<div class="form-group"><label>Nom & Prénom (optionnel)</label><input type="text" class="form-input" id="ac-reg-name" placeholder="Votre nom"></div>' +
      '<div class="form-group"><label>Téléphone *</label><input type="tel" class="form-input" id="ac-reg-phone" placeholder="77 xxx xx xx" required></div>' +
      '<div class="form-group"><label>Email (optionnel)</label><input type="email" class="form-input" id="ac-reg-email" placeholder="votre@email.com"></div>' +
      '<div class="form-group"><label>Mot de passe *</label><input type="password" class="form-input" id="ac-reg-pwd" placeholder="Min 4 caractères" required minlength="4"></div>' +
      '<div id="ac-reg-error" class="account-error" style="display:none"></div>' +
      '<button type="submit" class="btn btn-primary btn-block">Créer mon compte</button>' +
      '<p class="account-form-foot">Déjà un compte ? <a href="#" onclick="AccountApp._showLoginForm();return false">Se connecter</a></p>' +
    '</form>';
  }

  function _showLoginForm() {
    var el = document.getElementById('ac-form-content');
    if (el) el.innerHTML = _loginFormHtml();
    document.getElementById('ac-tab-login').classList.add('active');
    document.getElementById('ac-tab-register').classList.remove('active');
  }

  function _showRegisterForm() {
    var el = document.getElementById('ac-form-content');
    if (el) el.innerHTML = _registerFormHtml();
    document.getElementById('ac-tab-login').classList.remove('active');
    document.getElementById('ac-tab-register').classList.add('active');
  }

  function _handleLogin(e) {
    e.preventDefault();
    var phone = document.getElementById('ac-login-phone').value;
    var pwd = document.getElementById('ac-login-pwd').value;
    var errEl = document.getElementById('ac-login-error');
    var result = login(phone, pwd);
    if (result.error) {
      errEl.textContent = result.error;
      errEl.style.display = 'block';
    } else {
      renderAccount();
    }
  }

  function _handleRegister(e) {
    e.preventDefault();
    var phone = document.getElementById('ac-reg-phone').value;
    var pwd = document.getElementById('ac-reg-pwd').value;
    var name = document.getElementById('ac-reg-name').value;
    var email = document.getElementById('ac-reg-email').value;
    var errEl = document.getElementById('ac-reg-error');
    var result = register(phone, pwd, name, email);
    if (result.error) {
      errEl.textContent = result.error;
      errEl.style.display = 'block';
    } else {
      renderAccount();
    }
  }

  function renderDashboard(container) {
    var session = _loadSession();
    var acc = getCurrentAccount();
    var orders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
    var myOrders = orders.filter(function(o) {
      return o && o.telephone && o.telephone.replace(/[^0-9]/g, '') === session.phone;
    });
    var loyalty = JSON.parse(localStorage.getItem('sytam_loyalty_v2') || '{}');
    var loyaltyData = loyalty[session.phone] || { orders: 0, total: 0 };
    var wishlist = acc ? (acc.wishlist || []) : [];

    container.innerHTML =
      '<div class="account-dashboard">' +
        '<div class="account-sidebar">' +
          '<div class="account-avatar">' + (session.name ? session.name.charAt(0).toUpperCase() : session.phone.slice(-2)) + '</div>' +
          '<h3>' + (session.name || 'Client') + '</h3>' +
          '<p class="account-phone">' + session.phone + '</p>' +
          '<nav class="account-nav">' +
            '<a class="active" data-actab="profile" onclick="AccountApp._switchAcTab(\'profile\')">👤 Mon Profil</a>' +
            '<a data-actab="orders" onclick="AccountApp._switchAcTab(\'orders\')">📦 Mes Commandes (' + myOrders.length + ')</a>' +
            '<a data-actab="wishlist" onclick="AccountApp._switchAcTab(\'wishlist\')">♥ Mes Favoris (' + wishlist.length + ')</a>' +
            '<a data-actab="loyalty" onclick="AccountApp._switchAcTab(\'loyalty\')">⭐ Ma Fidélité</a>' +
            '<a data-actab="logout" onclick="AccountApp.logout()" style="color:var(--danger);margin-top:20px">🚪 Déconnexion</a>' +
          '</nav>' +
        '</div>' +
        '<div class="account-main" id="ac-main-content">' +
          _profileHtml(session, acc, myOrders, loyaltyData) +
        '</div>' +
      '</div>';
  }

  function _switchAcTab(tab) {
    var session = _loadSession();
    var acc = getCurrentAccount();
    var orders = JSON.parse(localStorage.getItem('sytam_orders_v2') || '[]');
    var myOrders = orders.filter(function(o) {
      return o && o.telephone && o.telephone.replace(/[^0-9]/g, '') === session.phone;
    });
    var loyalty = JSON.parse(localStorage.getItem('sytam_loyalty_v2') || '{}');
    var loyaltyData = loyalty[session.phone] || { orders: 0, total: 0 };
    var main = document.getElementById('ac-main-content');
    if (!main) return;
    document.querySelectorAll('.account-nav a').forEach(function(a) { a.classList.remove('active'); });
    var link = document.querySelector('.account-nav a[data-actab="' + tab + '"]');
    if (link) link.classList.add('active');
    switch (tab) {
      case 'profile': main.innerHTML = _profileHtml(session, acc, myOrders, loyaltyData); break;
      case 'orders': main.innerHTML = _ordersHtml(myOrders); break;
      case 'wishlist': main.innerHTML = _wishlistHtml(acc); break;
      case 'loyalty': main.innerHTML = _loyaltyHtml(loyaltyData); break;
    }
  }

  function _profileHtml(session, acc, myOrders, loyaltyData) {
    return '<div class="ac-card">' +
      '<h3>Bonjour ' + (session.name || 'Client') + ' 👋</h3>' +
      '<p class="ac-welcome">Bienvenue dans votre espace client</p>' +
      '<div class="ac-stats">' +
        '<div class="ac-stat"><span class="ac-stat-num">' + myOrders.length + '</span><span class="ac-stat-lbl">Commandes</span></div>' +
        '<div class="ac-stat"><span class="ac-stat-num">' + (acc ? (acc.wishlist || []).length : 0) + '</span><span class="ac-stat-lbl">Favoris</span></div>' +
        '<div class="ac-stat"><span class="ac-stat-num">' + loyaltyData.orders + '</span><span class="ac-stat-lbl">Achats</span></div>' +
      '</div>' +
      '<h4 style="margin-top:20px">Informations personnelles</h4>' +
      '<div class="ac-info"><span>Téléphone</span><span>' + session.phone + '</span></div>' +
      '<div class="ac-info"><span>Nom</span><span>' + (session.name || '—') + '</span></div>' +
      '<div class="ac-info"><span>Email</span><span>' + (session.email || '—') + '</span></div>' +
    '</div>';
  }

  function _ordersHtml(orders) {
    if (!orders.length) {
      return '<div class="ac-card"><h3>Mes Commandes</h3><p class="ac-empty">Vous n\'avez pas encore de commande.</p><a href="#shop" class="btn btn-primary" onclick="SytamApp.navigate(\'shop\')">Découvrir nos produits</a></div>';
    }
    var steps = {
      en_attente: 'Commande reçue',
      confirmee: 'Confirmée (paiement reçu)',
      preparation: 'En cours de traitement',
      livraison: 'En route pour livraison',
      livree: 'Livrée ✓',
      annulee: 'Annulée ✕'
    };
    var html = '<div class="ac-card"><h3>Mes Commandes (' + orders.length + ')</h3></div>';
    orders.forEach(function(o) {
      var statusLabel = steps[o.statut] || o.statut || 'en_attente';
      var itemsHtml = (o.items || []).map(function(it) {
        return '<div class="ac-order-item"><span>' + it.nom + (it.variantLabel ? ' (' + it.variantLabel + ')' : '') + ' x' + (it.qte || 1) + '</span><span>' + (it.prix || 0).toLocaleString('fr-FR') + ' FCFA</span></div>';
      }).join('');
      var statusClass = o.statut === 'annulee' ? 'status-cancelled' : (o.statut === 'livree' ? 'status-delivered' : '');
      html += '<div class="ac-order-card">' +
        '<div class="ac-order-header">' +
          '<span><strong>' + (o.id || '—') + '</strong></span>' +
          '<span class="order-status ' + statusClass + '">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="ac-order-body">' +
          '<div class="ac-order-date">' + (o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : '—') + '</div>' +
          itemsHtml +
          '<div class="ac-order-total"><span>Total</span><span><strong>' + (o.total || 0).toLocaleString('fr-FR') + ' FCFA</strong></span></div>' +
        '</div>' +
      '</div>';
    });
    return html;
  }

  function _wishlistHtml(acc) {
    var wl = acc ? (acc.wishlist || []) : [];
    if (!wl.length) {
      return '<div class="ac-card"><h3>Mes Favoris</h3><p class="ac-empty">Vous n\'avez pas encore de favoris.</p><a href="#shop" class="btn btn-primary" onclick="SytamApp.navigate(\'shop\')">Découvrir nos produits</a></div>';
    }
    var products = (typeof DB !== 'undefined' && DB.getAll) ? DB.getAll() : [];
    var html = '<div class="ac-card"><h3>Mes Favoris (' + wl.length + ')</h3></div>' +
      '<div class="ac-wishlist-grid">';
    wl.forEach(function(pid) {
      var p = null;
      for (var i = 0; i < products.length; i++) { if (products[i].id === pid) { p = products[i]; break; } }
      if (!p) return;
      var img = (p.images && p.images[0]) || '';
      html += '<div class="ac-wishlist-item">' +
        '<img src="' + img + '" alt="' + p.nom + '" onerror="this.style.display=\'none\'">' +
        '<div class="ac-wishlist-info">' +
          '<h4>' + p.nom + '</h4>' +
          '<p class="ac-wishlist-price">' + (p.prix || 0).toLocaleString('fr-FR') + ' FCFA</p>' +
          '<button class="btn btn-primary btn-sm" onclick="SytamApp.quickView(\'' + p.id + '\')">Voir</button>' +
          '<button class="btn btn-sm" style="background:none;color:var(--danger);border:none;cursor:pointer" onclick="AccountApp.toggleWishlist(\'' + p.id + '\');AccountApp._switchAcTab(\'wishlist\')">♥ Retirer</button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  function _loyaltyHtml(loyaltyData) {
    var orders = loyaltyData.orders || 0;
    var total = loyaltyData.total || 0;
    var nextFree = Math.max(0, 10 - orders);
    var pct = Math.min(100, (orders / 10) * 100);
    return '<div class="ac-card">' +
      '<h3>⭐ Ma Fidélité</h3>' +
      '<p class="ac-welcome">Plus vous commandez, plus vous économisez !</p>' +
      '<div class="ac-loyalty-card">' +
        '<div class="ac-loyalty-progress">' +
          '<div class="ac-loyalty-bar"><div class="ac-loyalty-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="ac-loyalty-labels">' +
            '<span>' + orders + ' commande' + (orders > 1 ? 's' : '') + '</span>' +
            '<span>' + nextFree + ' avant la 10ᵉ offerte</span>' +
          '</div>' +
        '</div>' +
        '<div class="ac-loyalty-stat">' +
          '<div><span class="ac-loyalty-num">' + total.toLocaleString('fr-FR') + ' FCFA</span><span>Dépensé au total</span></div>' +
        '</div>' +
        (orders >= 10 ? '<div class="ac-loyalty-reward">🎉 Félicitations ! Votre prochaine commande est offerte !</div>' : '') +
      '</div>' +
    '</div>';
  }

  // --- Banner ---
  function _updateBanner() {
    var banner = document.getElementById('account-banner');
    if (!banner) return;
    var session = _loadSession();
    banner.style.display = session ? 'none' : '';
  }

  function init() {
    // Try to sync accounts from Supabase on load
    if (typeof SupabaseAPI !== 'undefined') {
      SupabaseAPI.get('store_data?key=eq.' + STORAGE_KEY + '&select=value')
        .then(function(result) {
          if (result && result.length && result[0] && Array.isArray(result[0].value)) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(result[0].value));
          }
        })
        .catch(function() {});
    }
    _updateBanner();
  }

  return {
    init: init,
    isLoggedIn: isLoggedIn,
    login: login,
    register: register,
    logout: logout,
    getWishlist: getWishlist,
    toggleWishlist: toggleWishlist,
    isInWishlist: isInWishlist,
    renderAccount: renderAccount,
    getCurrentAccount: getCurrentAccount,
    _showLoginForm: _showLoginForm,
    _showRegisterForm: _showRegisterForm,
    _handleLogin: _handleLogin,
    _handleRegister: _handleRegister,
    _switchAcTab: _switchAcTab
  };
})();
