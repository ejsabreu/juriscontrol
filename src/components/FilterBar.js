/* ==========================================================================
   components/FilterBar.js — barra de busca e filtros

   props.campos: [{ tipo:'busca'|'select'|'toggle', nome, rotulo, opcoes, valor }]
   Emite tudo por callback — a barra não conhece o store nem os services.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  function FilterBar(props) {
    var p = props || {};
    var campos = p.campos || [];
    var ui = App.components.ui;

    var html = '<div class="filter-bar">';

    campos.forEach(function (campo) {
      if (campo.tipo === 'busca') {
        html += '<div class="filter-bar__search">' +
                  '<span class="filter-bar__search-icon" aria-hidden="true">⌕</span>' +
                  '<input class="input" type="search" data-filtro="' + esc(campo.nome) + '"' +
                    ' placeholder="' + esc(campo.placeholder || 'Buscar...') + '"' +
                    ' value="' + esc(campo.valor || '') + '"' +
                    ' aria-label="' + esc(campo.rotulo || 'Buscar') + '">' +
                '</div>';

      } else if (campo.tipo === 'select') {
        html += '<select class="select" data-filtro="' + esc(campo.nome) + '"' +
                  ' aria-label="' + esc(campo.rotulo) + '">' +
                  campo.opcoes +
                '</select>';

      } else if (campo.tipo === 'toggle') {
        html += '<label class="checkbox u-sm">' +
                  '<input type="checkbox" data-filtro="' + esc(campo.nome) + '"' +
                    (campo.valor ? ' checked' : '') + '>' +
                  '<span>' + esc(campo.rotulo) + '</span>' +
                '</label>';

      } else if (campo.tipo === 'divisor') {
        html += '<span class="filter-bar__divider"></span>';

      } else if (campo.tipo === 'html') {
        html += campo.conteudo;
      }
    });

    if (p.totalAtivos) {
      html += '<span class="u-spacer"></span>' +
              ui.Button({
                rotulo: 'Limpar filtros (' + p.totalAtivos + ')',
                variante: 'ghost',
                tamanho: 'sm',
                acao: 'limpar-filtros'
              });
    }

    if (p.direita) {
      html += (p.totalAtivos ? '' : '<span class="u-spacer"></span>') + p.direita;
    }

    return html + '</div>';
  }

  /**
   * @param {Element}  root
   * @param {Object}   handlers  { aoMudar(nome, valor), aoLimpar() }
   * @param {number}   [atrasoBusca]  debounce do campo de busca
   */
  FilterBar.mount = function (root, handlers, atrasoBusca) {
    var h = handlers || {};
    if (!h.aoMudar) return;

    var buscarComAtraso = App.dom.debounce(function (nome, valor) {
      h.aoMudar(nome, valor);
    }, atrasoBusca || 280);

    App.dom.delegate(root, 'input', 'input[type="search"][data-filtro]', function (evento, campo) {
      buscarComAtraso(campo.dataset.filtro, campo.value);
    });

    App.dom.delegate(root, 'change', 'select[data-filtro]', function (evento, campo) {
      h.aoMudar(campo.dataset.filtro, campo.value);
    });

    App.dom.delegate(root, 'change', 'input[type="checkbox"][data-filtro]', function (evento, campo) {
      h.aoMudar(campo.dataset.filtro, campo.checked);
    });

    if (h.aoLimpar) {
      App.dom.delegate(root, 'click', '[data-action="limpar-filtros"]', function () {
        h.aoLimpar();
      });
    }
  };

  App.components.FilterBar = FilterBar;
})(window.App = window.App || {});
