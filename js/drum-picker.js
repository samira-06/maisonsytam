// Hardcoded data lists
var QUARTIERS = [
  "Almadies","Amitié","Arafat","Bel Air","Biscuiterie",
  "Cambérène","Castors","Cité Keur Gorgui","Cité Lobatt Fall","Cité Millionnaire",
  "Colobane","Dakar Plateau","Dalifort","Diamaguène","Dieuppeul",
  "Fann Résidence","Fass","Golf Sud","Grand Dakar","Grand Yoff",
  "Gueule Tapée","Guédiawaye","Hann Bel Air","Hann Maristes","HLM",
  "Keur Massar","Keur Mbaye Fall","Khar Yalla","Liberté 1","Liberté 2",
  "Liberté 3","Liberté 4","Liberté 5","Liberté 6","Madeleine",
  "Malika","Mbao","Médina","Médina Gounass","Mermoz",
  "Ngor","Nimzatt","Ouakam","Ouest Foire","Parcelles Assainies",
  "Patte d'Oie","Pikine","Pikine Icotaf","Pikine Technopole","Point E",
  "Rebeuss","Rufisque","Sacré-Cœur","Sam Notaire","Sicap Amitié",
  "Sicap Dieuppeul","Soprim","Thiaroye","Thiaroye sur Mer","Tivaoune Peul",
  "Wakhinane Nimzatt","Yarakh","Yeumbeul","Yoff"
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
