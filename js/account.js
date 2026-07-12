window.AccountApp = (function() {
  var STORAGE_KEY = 'sytam_accounts';
  var SESSION_KEY = 'sytam_session';

  function _getAccounts() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }

  function _saveAccounts(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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
      address: { name: '', phone: phone, region: 'Dakar', quartier: '', address_detail: '' },
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
    _saveSession({ phone: phone, name: account.name, email: account.email, address: account.address });
    return { success: true };
  }

  function login(phone, password, callback) {
    phone = phone.replace(/[^0-9]/g, '');
    var accounts = _getAccounts();
    var found = null;
    for (var i = 0; i < accounts.length; i++) {
      if (accounts[i].phone === phone) { found = accounts[i]; break; }
    }
    if (found) {
      if (found.password !== _hash(password)) return { error: 'Mot de passe incorrect.' };
      _saveSession({ phone: found.phone, name: found.name, email: found.email, address: found.address || { phone: found.phone, region: 'Dakar', quartier: '', address_detail: '' } });
      return { success: true };
    }
    return { error: 'Aucun compte trouvé avec ce numéro.' };
  }

  function _loginSync(phone, password) {
    phone = phone.replace(/[^0-9]/g, '');
    var accounts = _getAccounts();
    for (var i = 0; i < accounts.length; i++) {
      if (accounts[i].phone === phone) {
        if (accounts[i].password !== _hash(password)) return { error: 'Mot de passe incorrect.' };
        _saveSession({ phone: accounts[i].phone, name: accounts[i].name, email: accounts[i].email, address: accounts[i].address || { phone: accounts[i].phone, region: 'Dakar', quartier: '', address_detail: '' } });
        return { success: true };
      }
    }
    return { error: 'Aucun compte trouvé avec ce numéro.' };
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
  var _formLock = false;

  function renderAccount() {
    if (_formLock) return;
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
      '<p style="text-align:center;margin-top:8px"><a href="#" onclick="AccountApp._showForgotPassword();return false" style="font-size:.8rem;color:var(--text-lighter)">Mot de passe oublié ?</a></p>' +
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
    _formLock = false;
    var el = document.getElementById('ac-form-content');
    if (el) el.innerHTML = _loginFormHtml();
    document.getElementById('ac-tab-login').classList.add('active');
    document.getElementById('ac-tab-register').classList.remove('active');
  }

  function _showRegisterForm() {
    _formLock = false;
    var el = document.getElementById('ac-form-content');
    if (el) el.innerHTML = _registerFormHtml();
    document.getElementById('ac-tab-login').classList.remove('active');
    document.getElementById('ac-tab-register').classList.add('active');
  }

  function _generateToken() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var token = '';
    for (var i = 0; i < 32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    return token + '_' + Date.now();
  }

  function _forgotPasswordHtml() {
    return '<form class="account-form" onsubmit="AccountApp._handleForgotPassword(event)">' +
      '<h3>Mot de passe oublié</h3>' +
      '<p class="account-form-sub">Entrez votre email pour recevoir un lien de récupération</p>' +
      '<div class="form-group"><label>Email</label><input type="email" class="form-input" id="ac-forgot-email" placeholder="votre@email.com" required></div>' +
      '<div id="ac-forgot-error" class="account-error" style="display:none"></div>' +
      '<button type="submit" class="btn btn-primary btn-block" id="ac-forgot-btn">Envoyer le lien de récupération</button>' +
      '<p class="account-form-foot"><a href="#" onclick="AccountApp._showLoginForm();return false">Retour à la connexion</a></p>' +
    '</form>';
  }

  function _showForgotPassword() {
    _formLock = true;
    var el = document.getElementById('ac-form-content');
    if (el) el.innerHTML = _forgotPasswordHtml();
    document.getElementById('ac-tab-login').classList.add('active');
    document.getElementById('ac-tab-register').classList.remove('active');
  }

  function _handleForgotPassword(e) {
    e.preventDefault();
    var email = document.getElementById('ac-forgot-email').value.trim().toLowerCase();
    var accounts = _getAccounts();
    var found = null;
    for (var i = 0; i < accounts.length; i++) {
      if ((accounts[i].email || '').toLowerCase() === email) { found = accounts[i]; break; }
    }
    if (found) return _doSendRecovery(found, email);
    var errEl = document.getElementById('ac-forgot-error');
    errEl.textContent = 'Aucun compte trouvé avec cet email.';
    errEl.style.display = 'block';
  }

  function _doSendRecovery(found, email) {
    var errEl = document.getElementById('ac-forgot-error');
    var btn = document.getElementById('ac-forgot-btn');
    var token = _generateToken();
    if (!found.recoveryTokens) found.recoveryTokens = [];
    found.recoveryTokens.push({ token: token, expires: Date.now() + 3600000 });
    // Garder seulement les tokens valides (nettoyer les expirés)
    found.recoveryTokens = found.recoveryTokens.filter(function(t) { return t.expires > Date.now(); });
    _saveAccounts(_getAccounts().map(function(a) {
      return a.phone === found.phone ? found : a;
    }));

    // Construire le lien de récupération
    var baseUrl = window.location.origin + window.location.pathname.replace('mansourbadiya.html', 'index.html');
    var recoveryLink = baseUrl + '#account-recover?token=' + encodeURIComponent(token);

    // Envoyer via ntfy si configuré (notification admin)
    var ntfyTopic = localStorage.getItem('sytam_ntfy_topic') || 'sytam-shop';
    try {
      var x = new XMLHttpRequest();
      x.open('POST', 'https://ntfy.sh/' + encodeURIComponent(ntfyTopic), true);
      x.setRequestHeader('Title', '🔐 Demande de réinitialisation mot de passe');
      x.setRequestHeader('Priority', 'default');
      x.send('Email: ' + email + '\nLien: ' + recoveryLink);
    } catch(e) {}

    // Envoyer un vrai email via EmailJS si configuré
    var emailjsPubkey = localStorage.getItem('sytam_emailjs_pubkey') || '';
    var emailjsService = localStorage.getItem('sytam_emailjs_service') || '';
    var emailjsTemplate = localStorage.getItem('sytam_emailjs_template') || '';
    var emailConfigured = emailjsPubkey && emailjsService && emailjsTemplate;
    if (emailConfigured) {
      fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: emailjsService,
          template_id: emailjsTemplate,
          user_id: emailjsPubkey,
          template_params: {
            name: found.name || 'Client',
            link: recoveryLink,
            to_email: email
          }
        })
      }).then(function(r) {
        if (r.ok) {
          errEl.innerHTML = '✓ Un email de récupération a été envoyé à <strong>' + email + '</strong>. Vérifiez votre boîte de réception.';
          btn.textContent = 'Email envoyé ✓';
        } else {
          return r.text().then(function(txt) { console.error('EmailJS error:', txt); _showFallbackLink(); });
        }
      }).catch(function(e) {
        console.error('EmailJS fetch error:', e);
        _showFallbackLink();
      });
    } else {
      _showFallbackLink();
    }

    function _showFallbackLink() {
      errEl.innerHTML = '✓ Un lien de récupération a été généré pour <strong>' + email + '</strong>.';
      btn.textContent = 'Lien généré ✓';
      setTimeout(function() {
        var directLink = document.createElement('div');
        directLink.style.marginTop = '16px';
        directLink.style.padding = '12px';
        directLink.style.background = '#fff';
        directLink.style.border = '1px solid #d4c9b8';
        directLink.style.borderRadius = '6px';
        directLink.style.fontSize = '.8rem';
        directLink.style.textAlign = 'center';
        directLink.innerHTML = '🔗 <a href="' + recoveryLink + '" style="color:var(--primary);font-weight:600">Cliquez ici pour réinitialiser votre mot de passe</a>';
        errEl.parentNode.appendChild(directLink);
      }, 2000);
    }

    errEl.style.display = 'block';
    errEl.style.background = '#e8f5e9';
    errEl.style.color = '#2e7d32';
    btn.disabled = true;
  }

  function _recoverFormHtml(token) {
    return '<form class="account-form" onsubmit="AccountApp._handleRecover(event)">' +
      '<h3>Réinitialiser mon mot de passe</h3>' +
      '<p class="account-form-sub">Choisissez un nouveau mot de passe</p>' +
      '<input type="hidden" id="ac-recover-token" value="' + token + '">' +
      '<div class="form-group"><label>Nouveau mot de passe</label><input type="password" class="form-input" id="ac-recover-pwd" placeholder="Min 4 caractères" required minlength="4"></div>' +
      '<div class="form-group"><label>Confirmer le mot de passe</label><input type="password" class="form-input" id="ac-recover-pwd2" placeholder="Identique au ci-dessus" required minlength="4"></div>' +
      '<div id="ac-recover-error" class="account-error" style="display:none"></div>' +
      '<button type="submit" class="btn btn-primary btn-block" id="ac-recover-btn">Réinitialiser mon mot de passe</button>' +
      '<p class="account-form-foot"><a href="#" onclick="AccountApp._showLoginForm();return false" style="color:var(--primary)">Retour à la connexion</a></p>' +
    '</form>';
  }

  function _handleRecover(e) {
    e.preventDefault();
    var token = document.getElementById('ac-recover-token').value;
    var pwd = document.getElementById('ac-recover-pwd').value;
    var pwd2 = document.getElementById('ac-recover-pwd2').value;
    var errEl = document.getElementById('ac-recover-error');
    var btn = document.getElementById('ac-recover-btn');

    if (pwd !== pwd2) {
      errEl.textContent = 'Les mots de passe ne correspondent pas.';
      errEl.style.display = 'block';
      return;
    }
    if (pwd.length < 4) {
      errEl.textContent = 'Mot de passe (min 4 caractères)';
      errEl.style.display = 'block';
      return;
    }

    var accounts = _getAccounts();
    var found = null;
    var foundIdx = -1;
    for (var i = 0; i < accounts.length; i++) {
      var tokens = accounts[i].recoveryTokens || [];
      for (var j = 0; j < tokens.length; j++) {
        var expectedToken = tokens[j].token;
        var tokenBase = token.indexOf('_') > -1 ? token : token;
        if (tokens[j].token === token && tokens[j].expires > Date.now()) {
          found = accounts[i];
          foundIdx = i;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      errEl.textContent = 'Ce lien est invalide ou expiré. Veuillez refaire une demande.';
      errEl.style.display = 'block';
      return;
    }

    found.password = _hash(pwd);
    found.recoveryTokens = []; // clear all tokens after successful reset
    _saveAccounts(accounts);

    errEl.style.display = 'block';
    errEl.style.background = '#e8f5e9';
    errEl.style.color = '#2e7d32';
    errEl.innerHTML = '✓ Mot de passe réinitialisé avec succès !';
    btn.disabled = true;
    btn.textContent = '✓ Réinitialisé';

    setTimeout(function() {
      _showLoginForm();
    }, 2000);
  }

  // Vérifier si on arrive avec un token de récupération dans l'URL
  function checkRecoveryToken(token) {
    if (token) {
      _formLock = true;
      var container = document.getElementById('account-content');
      if (container) {
        container.innerHTML =
          '<div class="account-form-wrap">' +
            _recoverFormHtml(token) +
          '</div>';
      }
    }
  }

  function _handleLogin(e) {
    e.preventDefault();
    var phone = document.getElementById('ac-login-phone').value;
    var pwd = document.getElementById('ac-login-pwd').value;
    var errEl = document.getElementById('ac-login-error');
    var result = login(phone, pwd, function(res) {
      if (res.error) {
        errEl.textContent = res.error;
        errEl.style.display = 'block';
      } else {
        renderAccount();
      }
    });
    if (result && result.pending) {
      errEl.textContent = '⏳ Vérification...';
      errEl.style.display = 'block';
    } else if (result && result.error) {
      errEl.textContent = result.error;
      errEl.style.display = 'block';
    } else if (result && result.success) {
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
    var initial = session.name ? session.name.charAt(0).toUpperCase() : session.phone.slice(-2);

    container.innerHTML =
      '<div class="account-dashboard">' +
        '<div class="ac-header">' +
          '<div class="ac-header-avatar">' + initial + '</div>' +
          '<div class="ac-header-info">' +
            '<h3>' + (session.name || 'Client') + '</h3>' +
            '<span class="ac-phone">' + session.phone + '</span>' +
          '</div>' +
          '<button class="ac-logout" onclick="AccountApp.logout()">🚪 Quitter</button>' +
        '</div>' +
        '<div class="ac-cards-grid">' +
          '<div class="ac-card-item active" data-actab="profile" onclick="AccountApp._switchAcTab(\'profile\')">' +
            '<span class="ac-card-icon">👤</span>' +
            '<span class="ac-card-label">Mon Profil</span>' +
          '</div>' +
          '<div class="ac-card-item" data-actab="orders" onclick="AccountApp._switchAcTab(\'orders\')">' +
            '<span class="ac-card-icon">📦</span>' +
            '<span class="ac-card-label">Mes Commandes</span>' +
            '<span class="ac-card-badge">' + myOrders.length + '</span>' +
          '</div>' +
          '<div class="ac-card-item" data-actab="wishlist" onclick="AccountApp._switchAcTab(\'wishlist\')">' +
            '<span class="ac-card-icon">♥</span>' +
            '<span class="ac-card-label">Mes Favoris</span>' +
            '<span class="ac-card-badge">' + wishlist.length + '</span>' +
          '</div>' +
          '<div class="ac-card-item" data-actab="loyalty" onclick="AccountApp._switchAcTab(\'loyalty\')">' +
            '<span class="ac-card-icon">⭐</span>' +
            '<span class="ac-card-label">Ma Fidélité</span>' +
          '</div>' +
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
    document.querySelectorAll('.ac-card-item').forEach(function(c) { c.classList.remove('active'); });
    var card = document.querySelector('.ac-card-item[data-actab="' + tab + '"]');
    if (card) card.classList.add('active');
    switch (tab) {
      case 'profile': main.innerHTML = _profileHtml(session, acc, myOrders, loyaltyData); break;
      case 'orders': main.innerHTML = _ordersHtml(myOrders); break;
      case 'wishlist': main.innerHTML = _wishlistHtml(acc); break;
      case 'loyalty': main.innerHTML = _loyaltyHtml(loyaltyData); break;
    }
  }

  function _profileHtml(session, acc, myOrders, loyaltyData) {
    var addr = (acc && acc.address) ? acc.address : { phone: session.phone, region: 'Dakar', quartier: '', address_detail: '', name: session.name || '' };
    return '<div class="ac-card">' +
      '<h3>Bonjour ' + (session.name || 'Client') + ' 👋</h3>' +
      '<p class="ac-welcome">Bienvenue dans votre espace client</p>' +
      '<div class="ac-stats">' +
        '<div class="ac-stat"><span class="ac-stat-num">' + myOrders.length + '</span><span class="ac-stat-lbl">Commandes</span></div>' +
        '<div class="ac-stat"><span class="ac-stat-num">' + (acc ? (acc.wishlist || []).length : 0) + '</span><span class="ac-stat-lbl">Favoris</span></div>' +
        '<div class="ac-stat"><span class="ac-stat-num">' + loyaltyData.orders + '</span><span class="ac-stat-lbl">Achats</span></div>' +
      '</div>' +
      '<form class="ac-profile-form" onsubmit="AccountApp._saveProfile(event)">' +
        '<h4 style="margin-top:16px">Mes informations</h4>' +
        '<div class="form-group"><label>Nom & Prénom</label><input type="text" class="form-input" id="ac-prof-name" value="' + (session.name || '') + '"></div>' +
        '<div class="form-group"><label>Téléphone</label><input type="tel" class="form-input" value="' + session.phone + '" disabled style="background:#f5f5f5"></div>' +
        '<div class="form-group"><label>Email</label><input type="email" class="form-input" id="ac-prof-email" value="' + (session.email || '') + '"></div>' +
        '<h4 style="margin-top:16px">Adresse par défaut</h4>' +
        '<p style="font-size:.78rem;color:var(--text-lighter);margin-bottom:10px">Cette adresse sera pré-remplie lors de vos prochaines commandes</p>' +
        '<div class="form-group"><label>Nom du destinataire</label><input type="text" class="form-input" id="ac-prof-addr-name" value="' + (addr.name || '') + '"></div>' +
        '<div class="form-group"><label>Téléphone du destinataire</label><input type="tel" class="form-input" id="ac-prof-addr-phone" value="' + (addr.phone || '') + '"></div>' +
        '<div class="form-group"><label>Région</label><select class="form-input" id="ac-prof-region"><option value="Dakar"' + (addr.region === 'Dakar' ? ' selected' : '') + '>Dakar</option><option value="Banlieue"' + (addr.region === 'Banlieue' ? ' selected' : '') + '>Banlieue</option><option value="Régions"' + (addr.region && addr.region !== 'Dakar' && addr.region !== 'Banlieue' ? ' selected' : '') + '>Régions</option></select></div>' +
        '<div class="form-group"><label>Quartier / Ville</label><input type="text" class="form-input" id="ac-prof-quartier" value="' + (addr.quartier || '') + '"></div>' +
        '<div class="form-group"><label>Adresse complète</label><input type="text" class="form-input" id="ac-prof-addr-detail" value="' + (addr.address_detail || '') + '" placeholder="Rue, villa, n°..."></div>' +
        '<div id="ac-prof-error" class="account-error" style="display:none"></div>' +
        '<button type="submit" class="btn btn-primary">Enregistrer</button>' +
      '</form>' +
    '</div>';
  }

  function _saveProfile(e) {
    e.preventDefault();
    var acc = getCurrentAccount();
    if (!acc) return;
    var errEl = document.getElementById('ac-prof-error');
    acc.name = document.getElementById('ac-prof-name').value;
    acc.email = document.getElementById('ac-prof-email').value;
    if (!acc.address) acc.address = {};
    acc.address.name = document.getElementById('ac-prof-addr-name').value;
    acc.address.phone = document.getElementById('ac-prof-addr-phone').value;
    acc.address.region = document.getElementById('ac-prof-region').value;
    acc.address.quartier = document.getElementById('ac-prof-quartier').value;
    acc.address.address_detail = document.getElementById('ac-prof-addr-detail').value;
    _saveAccount(acc);
    _saveSession({ phone: acc.phone, name: acc.name, email: acc.email, address: acc.address });
    errEl.textContent = '✓ Profil mis à jour';
    errEl.style.display = 'block';
    errEl.style.background = '#e8f5e9';
    errEl.style.color = '#2e7d32';
    setTimeout(function() { errEl.style.display = 'none'; }, 3000);
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

  // --- Default address for checkout ---
  function getDefaultAddress() {
    var session = _loadSession();
    var acc = getCurrentAccount();
    if (acc && acc.address) return acc.address;
    if (session) return session.address || { phone: session.phone, region: 'Dakar', quartier: '', address_detail: '' };
    return null;
  }

  // --- Banner ---
  function _updateBanner() {
    var banner = document.getElementById('account-banner');
    if (!banner) return;
    var session = _loadSession();
    banner.style.display = session ? 'none' : '';
  }

  function init() {
    _updateBanner();
    // Vérifier token de récupération dans l'URL (initialisation directe)
    setTimeout(function() {
      var h = window.location.hash;
      if (h.indexOf('#account-recover') === 0) {
        var parts = h.split('?'), p = {};
        if (parts[1]) parts[1].replace(/([^=&]+)=([^&]*)/g, function(m, k, v) { p[decodeURIComponent(k)] = decodeURIComponent(v); });
        if (p.token) checkRecoveryToken(p.token);
      }
    }, 200);
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
    getDefaultAddress: getDefaultAddress,
    _showLoginForm: _showLoginForm,
    _showRegisterForm: _showRegisterForm,
    _showForgotPassword: _showForgotPassword,
    _handleForgotPassword: _handleForgotPassword,
    _handleRecover: _handleRecover,
    checkRecoveryToken: checkRecoveryToken,
    _handleLogin: _handleLogin,
    _handleRegister: _handleRegister,
    _saveProfile: _saveProfile,
    _switchAcTab: _switchAcTab,
    _unlockForm: function() { _formLock = false; }
  };
})();
