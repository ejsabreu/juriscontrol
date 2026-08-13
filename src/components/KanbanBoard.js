/* ==========================================================================
   components/KanbanBoard.js — quadro kanban GENÉRICO

   O mesmo componente serve a Processos (colunas = fase/responsável/área)
   e a Tarefas (colunas = status). Ele não conhece nenhuma das duas: recebe
   colunas prontas e uma função que desenha o card.

   props:
     colunas    [{ id, label, cor, itens, total, rodape? }]
     renderCard (item, coluna) => HTML   — precisa conter data-id
     arrastavel bool
     vazio      texto da coluna sem itens

   mount(root, { aoMover(itemId, colunaDestinoId, colunaOrigemId) })
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  function KanbanBoard(props) {
    var p = props || {};
    var colunas = p.colunas || [];
    var arrastavel = p.arrastavel !== false;

    if (!colunas.length) {
      return App.components.ui.EmptyState({
        titulo: 'Nada para exibir no quadro',
        texto: 'Nenhum item corresponde aos filtros aplicados.'
      });
    }

    var html = '<div class="kanban" data-kanban>';

    colunas.forEach(function (coluna) {
      html += '<section class="kanban__column" data-coluna="' + esc(coluna.id) + '"' +
              (coluna.descricao ? ' title="' + esc(coluna.descricao) + '"' : '') + '>';

      html += '<header class="kanban__column-header">' +
                '<span class="kanban__column-dot" style="background:' +
                  (coluna.cor || 'var(--color-border-strong)') + '"></span>' +
                '<span class="kanban__column-title">' + esc(coluna.label) + '</span>' +
                '<span class="kanban__column-count">' + (coluna.total || 0) + '</span>' +
              '</header>';

      if (coluna.rodape) {
        html += '<div class="kanban__column-sum">' + coluna.rodape + '</div>';
      }

      html += '<div class="kanban__cards" data-dropzone="' + esc(coluna.id) + '">';

      if (!coluna.itens || !coluna.itens.length) {
        html += '<div class="kanban__empty">' + esc(p.vazio || 'Nenhum item') + '</div>';
      } else {
        coluna.itens.forEach(function (item) {
          html += p.renderCard(item, coluna);
        });
      }

      html += '</div></section>';
    });

    html += '</div>';

    if (!arrastavel) {
      html = html.replace(/draggable="true"/g, 'draggable="false"');
    }

    return html;
  }

  /**
   * Drag & drop nativo via delegação — sobrevive ao re-render do quadro.
   * @param {Element} root
   * @param {Object}  handlers  { aoMover(itemId, destinoId, origemId) }
   */
  KanbanBoard.mount = function (root, handlers) {
    var h = handlers || {};
    if (!root) return;

    var arrastando = null;      // { id, origem, elemento }

    App.dom.delegate(root, 'dragstart', '.kanban-card', function (evento, card) {
      var zona = card.closest('[data-dropzone]');
      arrastando = {
        id: card.dataset.id,
        origem: zona ? zona.dataset.dropzone : null,
        elemento: card
      };
      card.classList.add('kanban-card--dragging');

      if (evento.dataTransfer) {
        evento.dataTransfer.effectAllowed = 'move';
        // Alguns navegadores exigem algum payload para iniciar o arrasto.
        try { evento.dataTransfer.setData('text/plain', card.dataset.id); } catch (e) { /* ignora */ }
      }
    });

    App.dom.delegate(root, 'dragend', '.kanban-card', function (evento, card) {
      card.classList.remove('kanban-card--dragging');
      App.dom.qsa('.kanban__column--dragover', root).forEach(function (col) {
        col.classList.remove('kanban__column--dragover');
      });
      arrastando = null;
    });

    App.dom.delegate(root, 'dragover', '[data-dropzone]', function (evento, zona) {
      if (!arrastando) return;
      evento.preventDefault();   // sem isso o navegador não permite o drop
      if (evento.dataTransfer) evento.dataTransfer.dropEffect = 'move';

      var coluna = zona.closest('.kanban__column');
      if (coluna && !coluna.classList.contains('kanban__column--dragover')) {
        App.dom.qsa('.kanban__column--dragover', root).forEach(function (c) {
          c.classList.remove('kanban__column--dragover');
        });
        coluna.classList.add('kanban__column--dragover');
      }
    });

    App.dom.delegate(root, 'dragleave', '[data-dropzone]', function (evento, zona) {
      // Só limpa quando o ponteiro sai de fato da coluna, não ao cruzar filhos.
      if (zona.contains(evento.relatedTarget)) return;
      var coluna = zona.closest('.kanban__column');
      if (coluna) coluna.classList.remove('kanban__column--dragover');
    });

    App.dom.delegate(root, 'drop', '[data-dropzone]', function (evento, zona) {
      evento.preventDefault();
      var coluna = zona.closest('.kanban__column');
      if (coluna) coluna.classList.remove('kanban__column--dragover');

      if (!arrastando) return;

      var destino = zona.dataset.dropzone;
      var item = arrastando;
      arrastando = null;

      if (item.elemento) item.elemento.classList.remove('kanban-card--dragging');
      if (destino === item.origem) return;   // soltou na mesma coluna

      if (h.aoMover) h.aoMover(item.id, destino, item.origem);
    });

    // Clique no card navega, salvo quando o alvo é um controle interno.
    if (h.aoClicarCard) {
      App.dom.delegate(root, 'click', '.kanban-card', function (evento, card) {
        if (evento.target.closest('button, input, label')) return;
        h.aoClicarCard(card.dataset.id, evento, card);
      });
    }
  };

  App.components.KanbanBoard = KanbanBoard;
})(window.App = window.App || {});
