/* ==========================================================================
   components/Modal.js — diálogo modal

   Único componente com estado próprio no DOM: monta e desmonta a si mesmo.
   No React vira um portal com estado `aberto` controlado pelo pai.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  var aberto = null;

  function esc(v) { return App.dom.esc(v); }

  /**
   * @param {Object}   props
   * @param {string}   props.titulo
   * @param {string}   props.conteudo      HTML do corpo
   * @param {string}   [props.tamanho]     'lg' para modal largo
   * @param {Array}    [props.acoes]       [{rotulo, variante, acao, fechar}]
   * @param {Function} [props.aoAbrir]     (corpo, fechar) — liga listeners internos
   * @param {Function} [props.aoAcao]      (acao, corpo, fechar)
   * @param {Function} [props.aoFechar]
   */
  function abrir(props) {
    fechar();

    var p = props || {};

    var rodape = '';
    if (p.acoes && p.acoes.length) {
      rodape = '<div class="modal__footer">';
      p.acoes.forEach(function (a) {
        rodape += App.components.ui.Button({
          rotulo: a.rotulo,
          variante: a.variante || 'secondary',
          acao: a.acao,
          desabilitado: a.desabilitado
        });
      });
      rodape += '</div>';
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML =
      '<div class="modal' + (p.tamanho === 'lg' ? ' modal--lg' : '') + '"' +
        ' role="dialog" aria-modal="true" aria-label="' + esc(p.titulo || 'Diálogo') + '">' +
        '<div class="modal__header">' +
          '<h2 class="modal__title">' + esc(p.titulo || '') + '</h2>' +
          '<button class="modal__close" data-action="__fechar" aria-label="Fechar">×</button>' +
        '</div>' +
        '<div class="modal__body">' + (p.conteudo || '') + '</div>' +
        rodape +
      '</div>';

    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    var corpo = backdrop.querySelector('.modal__body');

    function fecharEste() {
      if (aberto !== estado) return;
      document.removeEventListener('keydown', aoTeclado);
      backdrop.remove();
      document.body.style.overflow = '';
      aberto = null;
      if (p.aoFechar) p.aoFechar();
    }

    function aoTeclado(evento) {
      if (evento.key === 'Escape') fecharEste();
    }

    backdrop.addEventListener('click', function (evento) {
      // Clique no backdrop (fora do diálogo) fecha.
      if (evento.target === backdrop) return fecharEste();

      var botao = evento.target.closest('[data-action]');
      if (!botao || !backdrop.contains(botao)) return;

      var acao = botao.dataset.action;
      if (acao === '__fechar') return fecharEste();

      var definicao = (p.acoes || []).filter(function (a) { return a.acao === acao; })[0];
      if (p.aoAcao) p.aoAcao(acao, corpo, fecharEste, botao);
      if (definicao && definicao.fechar) fecharEste();
    });

    document.addEventListener('keydown', aoTeclado);

    var estado = { backdrop: backdrop, corpo: corpo, fechar: fecharEste };
    aberto = estado;

    if (p.aoAbrir) p.aoAbrir(corpo, fecharEste);

    // Foco no primeiro campo — o usuário já começa digitando.
    var primeiro = corpo.querySelector('input:not([type=hidden]), select, textarea');
    if (primeiro) setTimeout(function () { primeiro.focus(); }, 60);

    return estado;
  }

  function fechar() {
    if (aberto) aberto.fechar();
  }

  /** Atalho para confirmação destrutiva. */
  function confirmar(props) {
    var p = props || {};
    return new Promise(function (resolve) {
      abrir({
        titulo: p.titulo || 'Confirmar',
        conteudo: '<p>' + esc(p.mensagem || 'Deseja continuar?') + '</p>' +
                  (p.detalhe ? '<p class="u-sm u-muted" style="margin-top:var(--space-3)">' +
                               esc(p.detalhe) + '</p>' : ''),
        acoes: [
          { rotulo: p.rotuloCancelar || 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
          { rotulo: p.rotuloConfirmar || 'Confirmar', variante: p.variante || 'primary', acao: 'confirmar', fechar: true }
        ],
        aoAcao: function (acao) { resolve(acao === 'confirmar'); },
        aoFechar: function () { resolve(false); }
      });
    });
  }

  App.components.Modal = {
    abrir: abrir,
    fechar: fechar,
    confirmar: confirmar
  };
})(window.App = window.App || {});
