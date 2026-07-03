// Hardcoded data lists
var QUARTIERS = [
  // Dakar Centre
  "Aïnoumady","Almadies","Amitié","Arafat","Bel Air","Biscuiterie",
  "Bopp","Cambérène","Castors","Centenaire","Cité Avion","Cité Damel",
  "Cité Djily Mbaye","Cité Keur Gorgui","Cité Lobatt Fall","Cité Millionnaire",
  "Cité Mixta","Colobane","Dakar Plateau","Dalifort","Derklé","Diamaguène",
  "Dieuppeul","Fan Hock","Fann Résidence","Fass","Gibraltar","Golf Sud",
  "Grand Dakar","Grand Yoff","Gueule Tapée","Hann Bel Air","Hann Maristes",
  "HLM","Hock","Jet d'Eau","Karack","Khar Yalla","Le Virage",
  "Liberté 1","Liberté 2","Liberté 3","Liberté 4",
  "Liberté 5","Liberté 6","Madeleine","Mamelles",
  "Médina","Médina Gounass","Mermoz","Ngor","Niary Tally","Nimzatt",
  "Ouakam","Ouest Foire","Parcelles Assainies","Patte d'Oie",
  "Petit Mbao","Pikine","Pikine Icotaf","Pikine Technopole","Point E",
  "Rebeuss","Route de l'Aéroport","Sacré-Cœur","Sam Notaire",
  "Sicap Amitié","Sicap Dieuppeul","Sicap Foire","Soprim","Thiaroye","Thiaroye sur Mer",
  "Tilène","Wakhinane Nimzatt","Yarakh","Yeumbeul",
  "Yoff","Zone de Captage",
  // Banlieue — Pikine / Guédiawaye / Keur Massar / Mbao
  "Cité Aliou Sow","Cité Biagui","Cité Douane","Cité Enseignants",
  "Cité Gadaye","Dalifort Foirail","Djiddah Thiaroye Kao","Gadaye",
  "Keur Massar","Keur Mbaye Fall",
  "Golf Nord","Guédiawaye","Guinaw Rails Nord","Guinaw Rails Sud",
  "Hamo 4","Hamo 5","Hamo 6","Hamo 7","Jaxaay",
  "Kounoune","Lac Rose","Malika","Mbao","Mbeubeuss","Ndiarème Limamoulaye","Niayes",
  "Nord Foire","Pikine Est","Pikine Nord","Pikine Ouest","Pikine Sud",
  "Sam Notaire Extension","Sangle","Sipres 1","Sipres 2","Sipres 3",
  "Sipres 4","Tivaouane Diacksao","Tivaouane Peulh Niague",
  "Tivaoune Peul",
  "Wakhinane",
  // Régions
  "Bambilor","Bargny","Diamniadio","Rufisque","Sangalkam",
  "Sébikotane","Sendou"
];

var REGIONS = [
  "Dakar","Thiès","Mbour","Saint-Louis","Diourbel",
  "Fatick","Kaolack","Kaffrine","Kolda","Louga",
  "Matam","Sédhiou","Tambacounda","Ziguinchor","Kédougou"
];

// Searchable list picker
var DrumPicker = window.DrumPicker = {
  _active: null,

  open: function(opts) {
    var self = this;
    var items = opts.items || [];
    var onConfirm = opts.onConfirm || function(){};
    var title = opts.title || 'Sélectionner';
    var showSearch = opts.showSearch !== false;

    if (self._active) self._active.close();

    var overlay = document.createElement('div');
    overlay.className = 'drum-overlay';
    document.body.appendChild(overlay);

    var sheet = document.createElement('div');
    sheet.className = 'drum-sheet';
    document.body.appendChild(sheet);

    var header = document.createElement('div');
    header.className = 'drum-header';
    header.innerHTML = '<span class="drum-title">' + title + '</span><button class="drum-close">✕</button>';
    sheet.appendChild(header);

    var searchWrap = document.createElement('div');
    searchWrap.className = 'drum-search-wrap';
    var searchInput = document.createElement('input');
    searchInput.className = 'drum-search';
    searchInput.type = 'text';
    searchInput.placeholder = 'Rechercher un quartier...';
    searchWrap.appendChild(searchInput);
    searchWrap.style.display = showSearch ? '' : 'none';
    sheet.appendChild(searchWrap);

    var list = document.createElement('div');
    list.className = 'drum-list';
    sheet.appendChild(list);

    function renderList(filter) {
      list.innerHTML = '';
      var q = (filter || '').toLowerCase().trim();
      for (var i = 0; i < items.length; i++) {
        if (q && items[i].toLowerCase().indexOf(q) === -1) continue;
        var el = document.createElement('div');
        el.className = 'drum-item';
        el.textContent = items[i];
        el.dataset.idx = i;
        el.onclick = function() {
          var idx = parseInt(this.dataset.idx);
          var val = items[idx] || '';
          onConfirm(val, idx);
          self.close();
        };
        list.appendChild(el);
      }
      if (list.children.length === 0) {
        list.innerHTML = '<div class="drum-empty">Aucun résultat</div>';
      }
    }

    renderList('');

    searchInput.oninput = function() {
      renderList(this.value);
    };

    header.querySelector('.drum-close').onclick = function(e) {
      e.stopPropagation();
      self.close();
    };

    overlay.onclick = function() {
      self.close();
    };

    requestAnimationFrame(function() {
      overlay.classList.add('open');
      sheet.classList.add('open');
      setTimeout(function() { searchInput.focus(); }, 350);
    });

    self._active = {
      close: function() {
        overlay.classList.remove('open');
        sheet.classList.remove('open');
        setTimeout(function() {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
        }, 300);
        self._active = null;
      }
    };
  },

  close: function() {
    if (this._active) {
      this._active.close();
      this._active = null;
    }
  }
};
