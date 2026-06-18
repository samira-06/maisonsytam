// Modèle produit : catégories, types de variantes, données initiales

const CATEGORIES = [
  { id: 'voiles', nom: 'Voiles & Hijabs' },
  { id: 'robes', nom: 'Robes' },
  { id: 'ensembles', nom: 'Ensembles' },
  { id: 'accessoires', nom: 'Accessoires' },
  { id: 'sport', nom: 'Tenues Sport' },
  { id: 'soiree', nom: 'Tenues de Soirée' },
];

const SOUS_TYPES = {
  voiles: ['Mousseline', 'Modal', 'Jersey Premium', 'Khimar', 'Soie de Médine', 'Pashmina'],
  robes: ['Modeste', 'Occasion'],
  ensembles: ['Chemise + Pantalon', 'Chemise + Jupe', 'Top + Pantalon', 'Top + Jupe'],
  accessoires: ['Bonnet', 'Pique à hijab', 'Chouchou', 'Cagoule / Sous-voile', 'Collant'],
  sport: ['Jogging', 'Burkini', 'Ensemble sport'],
  soiree: [],
};

const DELIVERY_ZONES = {
  dakar_centre: { nom: 'Dakar Centre', tarif: 2000 },
  dakar_banlieue: { nom: 'Dakar Banlieue', tarif: 3000 },
  regions: { nom: 'Régions', tarif: 5000 },
};

const FREE_DELIVERY_THRESHOLD = 50000; // 50 000 FCFA

const NEIGHBORHOODS = [
  // Dakar Centre — 2 000 FCFA
  { nom: 'Plateau', zone: 'dakar_centre' },
  { nom: 'Médina', zone: 'dakar_centre' },
  { nom: 'Fass', zone: 'dakar_centre' },
  { nom: 'Grand Dakar', zone: 'dakar_centre' },
  { nom: 'Liberté 1', zone: 'dakar_centre' },
  { nom: 'Liberté 2', zone: 'dakar_centre' },
  { nom: 'Liberté 3', zone: 'dakar_centre' },
  { nom: 'Liberté 4', zone: 'dakar_centre' },
  { nom: 'Liberté 5', zone: 'dakar_centre' },
  { nom: 'Liberté 6', zone: 'dakar_centre' },
  { nom: 'Sicap Liberté', zone: 'dakar_centre' },
  { nom: 'Foire', zone: 'dakar_centre' },
  { nom: 'Castor', zone: 'dakar_centre' },
  { nom: 'Point E', zone: 'dakar_centre' },
  { nom: 'Sacré Cœur', zone: 'dakar_centre' },
  { nom: 'HLM', zone: 'dakar_centre' },
  { nom: 'Dieuppeul', zone: 'dakar_centre' },
  { nom: 'Derklé', zone: 'dakar_centre' },
  { nom: 'Colobane', zone: 'dakar_centre' },
  { nom: 'Bopp', zone: 'dakar_centre' },
  { nom: 'Amitié', zone: 'dakar_centre' },
  { nom: 'Mermoz', zone: 'dakar_centre' },
  { nom: 'Ngor', zone: 'dakar_centre' },
  { nom: 'Ouakam', zone: 'dakar_centre' },
  { nom: 'Yoff', zone: 'dakar_centre' },
  { nom: 'Hann', zone: 'dakar_centre' },
  { nom: 'Bel-Air', zone: 'dakar_centre' },
  { nom: 'Corniche', zone: 'dakar_centre' },
  // Banlieue — 3 000 FCFA
  { nom: 'Parcelles Assainies', zone: 'dakar_banlieue' },
  { nom: 'Grand Yoff', zone: 'dakar_banlieue' },
  { nom: 'Guediawaye', zone: 'dakar_banlieue' },
  { nom: 'Pikine', zone: 'dakar_banlieue' },
  { nom: 'Thiaroye', zone: 'dakar_banlieue' },
  { nom: 'Yeumbeul', zone: 'dakar_banlieue' },
  { nom: 'Diamaguène', zone: 'dakar_banlieue' },
  { nom: 'Dalifort', zone: 'dakar_banlieue' },
  { nom: 'Mbao', zone: 'dakar_banlieue' },
  { nom: 'Keur Massar', zone: 'dakar_banlieue' },
  { nom: 'Malika', zone: 'dakar_banlieue' },
  // Régions — 5 000 FCFA
  { nom: 'Rufisque', zone: 'regions' },
  { nom: 'Bargny', zone: 'regions' },
  { nom: 'Sébikotane', zone: 'regions' },
  { nom: 'Diamniadio', zone: 'regions' },
  { nom: 'Sangalkam', zone: 'regions' },
];

// Retourne les attributs de variante selon catégorie + sous-type
function getVariantAttrs(categorie, sous_type) {
  var cat = (categorie || '').toLowerCase();
  if (cat === 'voiles') return ['tissu', 'couleur'];
  if (cat === 'accessoires') {
    var st = (sous_type || '').toLowerCase();
    if (st.indexOf('cagoule') !== -1 || st.indexOf('collant') !== -1) return ['couleur', 'taille'];
    return ['couleur'];
  }
  if (['robes', 'pantalons', 'ensembles', 'sport', 'jupes', 'manteaux', 'cardigan', 'collants', 'jellabas', 'chemise'].indexOf(cat) !== -1) return ['couleur', 'taille'];
  return ['couleur'];
}

const SIZES = ['S', 'M', 'L', 'XL'];
const COLORS_LIST = ['Noir', 'Blanc', 'Beige', 'Marron', 'Vert Sauge', 'Vert Olive', 'Rose Poudré', 'Bleu Ciel', 'Bleu Marine', 'Bordeaux', 'Gris', 'Mauve', 'Caramel'];

const COLOR_HEX_MAP = { Noir: '#000000', Blanc: '#FFFFFF', Beige: '#D4C5A9', Marron: '#6B4423', 'Vert Sauge': '#7B8D6B', 'Vert Olive': '#556B2F', 'Rose Poudré': '#E8B4C8', 'Bleu Ciel': '#87CEEB', 'Bleu Marine': '#1B3A5C', Bordeaux: '#722F37', Gris: '#808080', Mauve: '#9B7BB5', Caramel: '#AF6E4D', Nude: '#D4A98A', 'Vert Emeraude': '#2E8B57', Doré: '#C9A96E', Argenté: '#C0C0C0' };

function _colorObj(name, stock) { return { name: name, hex: COLOR_HEX_MAP[name] || '#B8956A', stock: stock || 0 }; }

const FABRICS = ['Mousseline', 'Modal', 'Jersey Premium', 'Khimar', 'Soie de Médine', 'Pashmina'];

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Génère un placeholder SVG inline (aucune dépendance externe)
function _ph(text) {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="700"><rect width="600" height="700" fill="#F5EFE8"/><text x="300" y="350" font-family="Arial,sans-serif" font-size="24" fill="#B8956A" text-anchor="middle" dominant-baseline="middle">' + text + '</text></svg>');
}

// ----- Données initiales (seed) -----
const SEED_PRODUCTS = [
  // ---- VOILES ----
  { id: 'p_v1', nom: 'Voile Mousseline', categorie: 'voiles', sous_type: 'Mousseline', description: 'Voile léger et fluide en mousseline de haute qualité. Parfait pour un porté quotidien élégant.', prix: 8500, images: ['images/produits/voiles/mousseline1.jpeg'], tag: 'nouveau', colors: ['Noir','Blanc','Beige','Rose','Bleu Ciel'].map(function(c) { return _colorObj(c, c==='Noir'?0:120); }), created_at: '2024-01-15' },
  { id: 'p_v2', nom: 'Voile Modal', categorie: 'voiles', sous_type: 'Modal', description: 'Voile doux et respirant en modal. Idéal pour les peaux sensibles.', prix: 9900, images: ['images/produits/voiles/modal1.jpeg'], tag: 'nouveau', colors: ['Noir','Blanc','Beige','Marron','Bordeaux','Gris'].map(function(c) { return _colorObj(c, 100); }), created_at: '2024-01-20' },
  { id: 'p_v3', nom: 'Voile Jersey Premium', categorie: 'voiles', sous_type: 'Jersey Premium', description: 'Voile anti-glisse en jersey premium. Tient parfaitement sans épingle.', prix: 12000, images: [_ph('Jersey Premium')], tag: 'nouveau', colors: ['Noir','Blanc','Beige','Nude','Rose'].map(function(c) { return _colorObj(c, 40); }), created_at: '2024-02-01' },
  { id: 'p_v4', nom: 'Khimar Luxe', categorie: 'voiles', sous_type: 'Khimar', description: 'Khimar ample et élégant, coupe généreuse. Tissu premium pour un tombé magnifique.', prix: 19000, images: [_ph('Khimar Luxe')], tag: 'tendance', colors: ['Noir','Bordeaux','Bleu Marine','Vert Emeraude'].map(function(c) { return _colorObj(c, 15); }), created_at: '2024-02-10' },
  { id: 'p_v5', nom: 'Voile Pashmina', categorie: 'voiles', sous_type: 'Pashmina', description: 'Voile en pashmina doux et chaud. Idéal pour l\'hiver et les soirées fraîches.', prix: 11000, images: [_ph('Pashmina')], tag: 'tendance', colors: ['Noir','Beige','Marron','Gris','Bordeaux'].map(function(c) { return _colorObj(c, 20); }), created_at: '2024-02-15' },
  { id: 'p_v6', nom: 'Voile Soie de Médine', categorie: 'voiles', sous_type: 'Soie de Médine', description: 'Voile en soie de Médine véritable. Luxueux, léger et brillant.', prix: 25000, images: [_ph('Soie de Médine')], colors: ['Blanc','Beige','Rose','Bleu Ciel','Mauve'].map(function(c) { return _colorObj(c, 10); }), created_at: '2024-03-01' },

  // ---- ROBES ----
  { id: 'p_r1', nom: 'Robe Modeste Longue', categorie: 'robes', sous_type: 'Modeste', description: 'Robe modeste coupe longue, manches longues. Tissu fluide et confortable.', prix: 25000, images: ['images/produits/robes/robe1.jpeg'], tag: 'nouveau', colors: [{name:'Noir',hex:'#000000',stock:25},{name:'Bordeaux',hex:'#722F37',stock:161},{name:'Bleu Marine',hex:'#1B3A5C',stock:160},{name:'Vert Sauge',hex:'#7B8D6B',stock:160}], created_at: '2024-03-05' },
  { id: 'p_r2', nom: 'Robe d\'Occasion Élégante', categorie: 'robes', sous_type: 'Occasion', description: 'Robe d\'occasion avec détails raffinés. Parfaite pour les mariages et cérémonies.', prix: 39000, images: [_ph('Robe Occasion')], tag: 'tendance', colors: ['Noir','Bordeaux','Bleu Marine','Mauve'].map(function(c) { return _colorObj(c, 20); }), created_at: '2024-03-10' },

  // ---- CARDIGANS ----
  { id: 'p_c1', nom: 'Cardigant', categorie: 'cardigan', sous_type: 'Cardigan', description: 'Cardigan élégant et confortable, parfait pour compléter vos tenues.', prix: 39000, images: [_ph('Cardigant')], promo_pct: 50, colors: [{name:'Noir',hex:'#000000',stock:60},{name:'Bordeaux',hex:'#722F37',stock:80},{name:'Bleu Marine',hex:'#1B3A5C',stock:80},{name:'Mauve',hex:'#9B7BB5',stock:60}], created_at: '2024-04-01' },

  // ---- ENSEMBLES ----
  { id: 'p_e1', nom: 'Ensemble Chemise + Pantalon Large', categorie: 'ensembles', sous_type: 'Chemise + Pantalon', description: 'Ensemble élégant chemise + pantalon large taille haute. Look moderne.', prix: 32000, images: [_ph('Ensemble Chemise')], tag: 'nouveau', colors: [{name:'Verde',hex:'#556B2F',stock:7},{name:'Vert Olive',hex:'#556B2F',stock:8}], created_at: '2024-03-15' },
  { id: 'p_e2', nom: 'Top + Jupe Longue', categorie: 'jupes', sous_type: 'Top + Jupe', description: 'Ensemble top + jupe longue taille haute. Élégant et confortable.', prix: 28000, images: ['images/produits/jupes/jupe1.jpeg','images/produits/jupes/jupe2.jpeg'], colors: [{name:'vert',hex:'#2E8B57',stock:0},{name:'Beige',hex:'#D4C5A9',stock:4}], created_at: '2024-03-20' },

  // ---- PANTALONS ----
  { id: 'p_p1', nom: 'Pantalon large', categorie: 'pantalons', sous_type: 'Pantalon', description: 'Pantalon large taille haute, confortable et élégant.', prix: 8000, images: ['images/produits/pantalons/pant1.jpeg'], colors: ['Noir','Blanc','Beige'].map(function(c) { return _colorObj(c, c==='Noir'?90:120); }), created_at: '2024-03-25' },

  // ---- ACCESSOIRES ----
  { id: 'p_a1', nom: 'Bonnet ajusté', categorie: 'accessoires', sous_type: 'Bonnet', description: 'Bonnet ajusté en jersey doux. Maintient parfaitement vos cheveux sous le voile.', prix: 4000, images: ['images/produits/accessoires/bonnet1.jpeg'], tag: 'nouveau', colors: ['Noir','Blanc','Beige','Nude'].map(function(c) { return _colorObj(c, 200); }), created_at: '2024-01-10' },
  { id: 'p_a2', nom: 'Pique à hijab dorée', categorie: 'accessoires', sous_type: 'Pique à hijab', description: 'Pique à hijab élégante, finition dorée. Fixation sécurisée.', prix: 3000, images: [_ph('Pique dorée')], colors: ['Doré','Argenté'].map(function(c) { return _colorObj(c, 0); }), created_at: '2024-01-05' },
  { id: 'p_a3', nom: 'Chouchou satiné', categorie: 'accessoires', sous_type: 'Chouchou', description: 'Chouchou en satin doux. Protège vos cheveux, reste élégant.', prix: 2500, images: ['images/produits/accessoires/chouchou1.jpeg'], tag: 'tendance', colors: ['Noir','Blanc','Beige','Rose','Bordeaux','Bleu Marine','Caramel'].map(function(c) { return _colorObj(c, 60); }), created_at: '2024-01-25' },
  { id: 'p_a4', nom: 'Cagoule / Sous-voile', categorie: 'accessoires', sous_type: 'Cagoule / Sous-voile', description: 'Cagoule légère à porter sous le voile. Confortable et invisible.', prix: 5000, images: [_ph('Cagoule')], colors: ['Noir','Blanc','Beige'].map(function(c) { return _colorObj(c, 30); }), created_at: '2024-02-20' },
  { id: 'p_a5', nom: 'Collant opaque', categorie: 'accessoires', sous_type: 'Collant', description: 'Collant opaque haute densité. Confortable et résistant.', prix: 5500, images: ['images/produits/collant/collant_sans_manche1.jpeg'], colors: [{name:'Noir',hex:'#000000',stock:75},{name:'Beige',hex:'#D4C5A9',stock:100}], created_at: '2024-02-25' },

  // ---- SPORT ----
  { id: 'p_s1', nom: 'Burkini Intégral', categorie: 'sport', sous_type: 'Burkini', description: 'Burkini intégral en tissu anti-UV. Confortable et léger pour la baignade.', prix: 25000, images: ['images/produits/burkini/burkini1.jpeg'], colors: [{name:'Noir',hex:'#000000',stock:128},{name:'Bleu Marine',hex:'#1B3A5C',stock:96},{name:'Bordeaux',hex:'#722F37',stock:96}], created_at: '2024-04-05' },
  { id: 'p_s2', nom: 'Hijab de Sport', categorie: 'sport', sous_type: 'Jogging', description: 'Hijab de sport en tissu technique respirant. Maintien parfait.', prix: 9000, images: [_ph('Hijab Sport')], tag: 'nouveau', colors: ['Noir','Gris','Bleu Marine','Blanc'].map(function(c) { return _colorObj(c, 25); }), created_at: '2024-04-08' },
  { id: 'p_s3', nom: 'Ensemble Sport Legging + Tunique', categorie: 'sport', sous_type: 'Ensemble sport', description: 'Ensemble sport legging + tunique longue. Tissu stretch confortable.', prix: 25000, images: [_ph('Ensemble Sport')], tag: 'tendance', colors: ['Noir','Gris','Bleu Marine'].map(function(c) { return _colorObj(c, 40); }), created_at: '2024-04-10' },
];

// ---- DB Layer (Supabase + localStorage fallback) ----
var DB_KEY = 'sytam_products_v4';

const DB = {
  _data: null,
  _ready: false,
  _notified: false,
  _readyCallbacks: [],

  init() {
    this._load();
  },

  _migrateData() {
    if (!this._data || !this._data.length) return;
    var noSizesCats = ['voiles', 'accessoires', 'collants', 'nikab'];
    var changed = false;
    this._data = this._data.map(function(p) {
      if (!p.sizes || !p.sizes.length) {
        if (noSizesCats.indexOf((p.categorie || '').toLowerCase()) === -1) {
          p.sizes = ['S', 'M', 'L', 'XL'];
          changed = true;
        }
      }
      var seed = null;
      for (var si = 0; si < SEED_PRODUCTS.length; si++) {
        if (SEED_PRODUCTS[si].id === p.id) { seed = SEED_PRODUCTS[si]; break; }
      }
      if (seed && !p.tag && seed.tag) {
        changed = true;
        p.tag = seed.tag;
      }
      return p;
    });
    if (changed) localStorage.setItem(DB_KEY, JSON.stringify(this._data));
  },

  _load() {
    // Migration automatique depuis localStorage vers Supabase
    var stored = localStorage.getItem(DB_KEY);

    if (stored && typeof SupabaseAPI !== 'undefined' && SupabaseApp.ready) {
      try { DB._data = JSON.parse(stored); }
      catch(e) { DB._data = null; }
      if (DB._data) {
        DB._migrateData();
        // Pousser vers Supabase (peut échouer sur file:/// → ignoré)
        SupabaseAPI.upsert('store_data', { key: DB_KEY, value: DB._data })
          .then(function() {
            // Maintenant charger depuis Supabase pour confirmer
            DB._loadFromSupabase();
          })
          .catch(function() {
            DB._ready = true;
            DB._notifyReady();
          });
        // En attendant, utiliser les données locales
        setTimeout(function() {
          if (!DB._ready) { DB._ready = true; DB._notifyReady(); }
        }, 100);
        return;
      }
    }

    DB._loadFromSupabase();
  },

  _loadFromSupabase() {
    console.log('DB: _loadFromSupabase');
    var fallbackTimer = setTimeout(function() {
      console.log('DB: Supabase timeout, fallback');
      if (!DB._ready) DB._fallback();
    }, 3000);
    if (typeof SupabaseAPI !== 'undefined' && SupabaseApp.ready) {
      SupabaseAPI.get('store_data?key=eq.' + DB_KEY + '&select=value')
        .then(function(result) {
          clearTimeout(fallbackTimer);
          if (result && result.length && result[0].value && result[0].value.length) {
            DB._data = result[0].value;
            DB._migrateData();
          } else {
            DB._data = JSON.parse(JSON.stringify(SEED_PRODUCTS));
            var stored = localStorage.getItem(DB_KEY);
            if (stored) { try { DB._data = JSON.parse(stored); } catch(e) {} }
            DB._migrateData();
            SupabaseAPI.upsert('store_data', { key: DB_KEY, value: DB._data });
          }
          localStorage.setItem(DB_KEY, JSON.stringify(DB._data));
          DB._ready = true;
          DB._notifyReady();
        })
        .catch(function() {
          clearTimeout(fallbackTimer);
          DB._fallback();
        });
    } else {
      clearTimeout(fallbackTimer);
      DB._fallback();
    }
  },

  _fallback() {
    console.log('DB: _fallback', localStorage.getItem(DB_KEY) ? 'localStorage' : 'seed');
    var stored = localStorage.getItem(DB_KEY);
    if (stored) {
      try { DB._data = JSON.parse(stored); }
      catch(e) { DB._data = JSON.parse(JSON.stringify(SEED_PRODUCTS)); }
    } else {
      DB._data = JSON.parse(JSON.stringify(SEED_PRODUCTS));
    }
    DB._migrateData();
    DB._ready = true;
    DB._notifyReady();
  },

  _loadLocal() {
    var stored = localStorage.getItem(DB_KEY);
    if (stored) {
      try { DB._data = JSON.parse(stored); }
      catch(e) { DB._data = JSON.parse(JSON.stringify(SEED_PRODUCTS)); }
    } else {
      DB._data = JSON.parse(JSON.stringify(SEED_PRODUCTS));
    }
    DB._ready = true;
    DB._notifyReady();
  },

  _save() {
    if (!this._data) return;
    localStorage.setItem(DB_KEY, JSON.stringify(this._data));
    if (typeof SupabaseAPI !== 'undefined' && SupabaseApp.ready) {
      SupabaseAPI.upsert('store_data', { key: DB_KEY, value: this._data });
    }
  },

  _notifyReady() {
    if (this._notified) return;
    this._notified = true;
    console.log('DB: _notifyReady, products count:', this._data ? this._data.length : 0);
    var cbs = this._readyCallbacks.slice();
    this._readyCallbacks = [];
    cbs.forEach(function(cb) { cb(); });
  },

  onReady(cb) {
    if (this._ready) { cb(); return; }
    this._readyCallbacks.push(cb);
  },

  getAll() { return this._data ? [...this._data] : []; },
  getById(id) { return this._data ? this._data.find(function(p) { return p.id === id; }) : null; },
  getByCategory(cat) { return this._data ? this._data.filter(function(p) { return p.categorie === cat; }) : []; },
  getFeatured() { return this._data ? this._data.filter(function(p) { return (p.tag === 'nouveau') || p.en_avant; }) : []; },
  getNewProducts() { return this._data ? this._data.filter(function(p) { return (p.tag === 'nouveau') || p.en_avant; }) : []; },
  getTrendingProducts() { return this._data ? this._data.filter(function(p) { return p.tag === 'tendance'; }) : []; },

  reloadFromLocal() {
    var stored = localStorage.getItem(DB_KEY);
    if (stored) {
      try { this._data = JSON.parse(stored); } catch(e) {}
    }
  },

  add(product) {
    product.id = genId();
    product.created_at = new Date().toISOString().split('T')[0];
    this._data.unshift(product);
    this._save();
    return product;
  },

  update(id, updates) {
    var idx = this._data ? this._data.findIndex(function(p) { return p.id === id; }) : -1;
    if (idx === -1) return null;
    this._data[idx] = Object.assign({}, this._data[idx], updates);
    this._save();
    return this._data[idx];
  },

  delete(id) {
    this._data = this._data.filter(function(p) { return p.id !== id; });
    this._save();
  },
};
