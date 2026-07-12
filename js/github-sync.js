var GITHUB_OWNER = 'samira-06';
var GITHUB_REPO = 'maisonsytam';

function _ghHeaders() {
  var token = localStorage.getItem('sytam_github_token');
  if (!token) return null;
  return { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' };
}

function _ghReadFile(path) {
  return fetch('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + path, { headers: _ghHeaders() })
    .then(function(r) { if (r.status === 404) return null; if (!r.ok) throw new Error(r.status); return r.json(); });
}

function _ghWriteFile(path, content, message) {
  return _ghReadFile(path).then(function(existing) {
    var sha = existing ? existing.sha : null;
    var body = { message: message || 'sync', content: btoa(unescape(encodeURIComponent(content))) };
    if (sha) body.sha = sha;
    return fetch('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + path, {
      method: 'PUT', headers: _ghHeaders(), body: JSON.stringify(body)
    }).then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  });
}

function GhSyncAPI() {}

GhSyncAPI.getProducts = function() {
  return _ghReadFile('data/products.json').then(function(data) {
    if (!data) return null;
    var json = JSON.parse(atob(data.content));
    return json.products || json || [];
  });
};

GhSyncAPI.pushProducts = function(products) {
  return _ghWriteFile('data/products.json', JSON.stringify({ products: products, updated_at: new Date().toISOString() }), 'Sync produits');
};

GhSyncAPI.getOrders = function() {
  return _ghReadFile('data/orders.json').then(function(data) {
    if (!data) return null;
    return JSON.parse(atob(data.content));
  });
};

GhSyncAPI.pushOrders = function(orders) {
  return _ghWriteFile('data/orders.json', JSON.stringify({ orders: orders, updated_at: new Date().toISOString() }), 'Sync commandes');
};
