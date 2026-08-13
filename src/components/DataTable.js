/* ==========================================================================
   components/DataTable.js — tabela genérica

   props.colunas: [{
     chave, titulo, ordenavel, alinhamento, largura,
     render: (item) => string HTML
   }]

   Nenhuma regra de processo aqui — a tabela não sabe o que exibe.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  /**
   * @param {Object}   props
   * @param {Array}    props.colunas
   * @param {Array}    props.itens
   * @param {string}   [props.ordenarPor]
   * @param {string}   [props.direcao]    'asc' | 'desc'
   * @param {Function} [props.hrefDe]     (item) => string — linha inteira clicável
   * @param {string}   [props.vazio]      HTML exibido quando não há itens
   */
  function DataTable(props) {
    var p = props || {};
    var colunas = p.colunas || [];
    var itens = p.itens || [];

    if (!itens.length) {
      return p.vazio || App.components.ui.EmptyState({
        titulo: 'Nenhum registro encontrado',
        texto: 'Ajuste os filtros ou a busca para ver resultados.'
      });
    }

    var html = '<div class="table-wrap"><table class="table">';

    // --- Cabeçalho ---
    html += '<thead><tr>';
    colunas.forEach(function (coluna) {
      var atributos = '';
      var seta = '';

      if (coluna.ordenavel !== false && coluna.chave) {
        atributos += ' data-sort="' + esc(coluna.chave) + '"';
        if (p.ordenarPor === coluna.chave) {
          atributos += ' aria-sort="' + (p.direcao === 'desc' ? 'descending' : 'ascending') + '"';
          seta = '<span class="sort-arrow">' + (p.direcao === 'desc' ? '▾' : '▴') + '</span>';
        } else {
          seta = '<span class="sort-arrow">⇅</span>';
        }
      }

      if (coluna.alinhamento) atributos += ' style="text-align:' + coluna.alinhamento + '"';
      else if (coluna.largura) atributos += ' style="width:' + coluna.largura + '"';

      html += '<th' + atributos + '>' + esc(coluna.titulo) + seta + '</th>';
    });
    html += '</tr></thead>';

    // --- Corpo ---
    html += '<tbody>';
    itens.forEach(function (item) {
      var href = p.hrefDe ? p.hrefDe(item) : null;
      html += '<tr' + (href ? ' data-href="' + esc(href) + '"' : '') +
              (item.id ? ' data-id="' + esc(item.id) + '"' : '') + '>';

      colunas.forEach(function (coluna) {
        var estilo = coluna.alinhamento ? ' style="text-align:' + coluna.alinhamento + '"' : '';
        var conteudo = coluna.render
          ? coluna.render(item)
          : esc(item[coluna.chave] === undefined || item[coluna.chave] === null
                ? '—' : item[coluna.chave]);
        html += '<td' + estilo + '>' + conteudo + '</td>';
      });

      html += '</tr>';
    });
    html += '</tbody></table></div>';

    return html;
  }

  /**
   * Liga ordenação e navegação por clique na linha.
   * @param {Element}  root
   * @param {Object}   handlers  { aoOrdenar(chave), aoClicarLinha(id, href, evento) }
   */
  DataTable.mount = function (root, handlers) {
    var h = handlers || {};

    if (h.aoOrdenar) {
      App.dom.delegate(root, 'click', 'th[data-sort]', function (evento, alvo) {
        h.aoOrdenar(alvo.dataset.sort);
      });
    }

    App.dom.delegate(root, 'click', 'tbody tr[data-href]', function (evento, linha) {
      // Não sequestra o clique em botões e links dentro da célula.
      if (evento.target.closest('a, button, input, label')) return;
      if (h.aoClicarLinha) h.aoClicarLinha(linha.dataset.id, linha.dataset.href, evento);
      else window.location.hash = linha.dataset.href;
    });
  };

  App.components.DataTable = DataTable;
})(window.App = window.App || {});
