/* ==========================================================================
   components/NotificationCenter.js — o sino da topbar

   Painel curto: as 8 mais recentes, com link para a tela cheia. O sino não é
   lugar de ler tudo — é lugar de perceber que existe algo para ler.

   Contrato do projeto: função pura que recebe props e devolve HTML; os
   listeners ficam em `.mount()`. O componente não chama service — recebe a
   lista e emite callbacks.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  var LIMITE_PAINEL = 8;

  function item(n) {
    return '<a class="notif__item' + (n.lida ? '' : ' notif__item--nova') + '"' +
             ' href="' + esc(n.destino) + '" data-action="abrir-notificacao"' +
             ' data-value="' + esc(n.id) + '">' +
             '<span class="notif__icon notif__icon--' + esc(n.gravidade) + '"' +
               ' aria-hidden="true">' + n.icone + '</span>' +
             '<span class="notif__body">' +
               '<span class="notif__title">' + esc(n.titulo) + '</span>' +
               (n.mensagem ? '<span class="notif__text">' + esc(n.mensagem) + '</span>' : '') +
               '<span class="notif__when">' + esc(App.format.dataHora(n.quando)) + '</span>' +
             '</span>' +
             (n.lida ? '' : '<span class="notif__dot" aria-label="não lida"></span>') +
           '</a>';
  }

  /**
   * @param {object}  p
   * @param {Array}   p.notificacoes
   * @param {number}  p.naoLidas
   * @param {boolean} p.aberto
   */
  function NotificationCenter(props) {
    var p = props || {};
    var lista = (p.notificacoes || []).slice(0, LIMITE_PAINEL);
    var naoLidas = p.naoLidas || 0;

    var painel = '';
    if (p.aberto) {
      var corpo = lista.length
        ? lista.map(item).join('')
        : '<div class="notif__empty">' +
            '<span aria-hidden="true">🔕</span>' +
            '<p>Nada pendente por enquanto.</p>' +
            '<p class="u-xs u-subtle">Prazos, audiências e tarefas aparecem aqui ' +
            'conforme as regras de alerta do escritório.</p>' +
          '</div>';

      painel =
        '<div class="notif" role="dialog" aria-label="Notificações">' +
          '<div class="notif__head">' +
            '<strong>Notificações</strong>' +
            (naoLidas
              ? '<button class="notif__link" data-action="marcar-todas-lidas">' +
                'marcar todas como lidas</button>'
              : '') +
          '</div>' +
          '<div class="notif__list">' + corpo + '</div>' +
          '<a class="notif__footer" href="#/notificacoes">Ver todas</a>' +
        '</div>';
    }

    return '<div class="topbar__notif">' +
             '<button class="topbar__icon-btn" data-action="alternar-notificacoes"' +
               ' data-count="' + naoLidas + '"' +
               ' aria-expanded="' + !!p.aberto + '"' +
               ' title="' + naoLidas + ' notificação(ões) não lida(s)">🔔</button>' +
             painel +
           '</div>';
  }

  NotificationCenter.LIMITE_PAINEL = LIMITE_PAINEL;

  App.components.NotificationCenter = NotificationCenter;
})(window.App = window.App || {});
