/* ==========================================================================
   components/NotificationCenter.js — o sino da topbar

   O painel é a lista INTEIRA do usuário, repartida por categoria e rolando
   dentro de si. Não há mais tela cheia de notificações, e por isso não há mais
   corte: o que não coubesse aqui não teria para onde ir. Lida ou não, o aviso
   fica na gaveta até alguém apagá-lo na lixeira; o que a leitura muda é o
   realce e o contador do sino.

   Houve um teto de 3 por categoria enquanto existia um "ver todas" atrás dele.
   Com a tela fora, o teto viraria uma promessa quebrada — "+5 avisos" sem
   destino. A rolagem interna resolve o volume sem esconder nada, e a repartição
   por categoria continua garantindo que um lote de publicações não empurre o
   prazo vencido para fora da vista. Ver `agruparPorCategoria` em
   `domain/alertas.js`, onde essa regra é pura e testada.

   Contrato do projeto: função pura que recebe props e devolve HTML; os
   listeners ficam em `.mount()`. O componente não chama service — recebe a
   lista e emite callbacks.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  /* A linha tem DOIS alvos de clique: o aviso, que navega, e a lixeira, que
     apaga. Por isso o botão é irmão do link, e não filho — botão dentro de
     âncora é HTML inválido, e o navegador resolve isso do jeito dele.

     A lixeira fica sempre visível, não só no hover: metade do uso deste
     sistema é no telefone, onde hover não existe e uma ação escondida atrás
     dele simplesmente não existe. */
  function item(n) {
    return '<div class="notif__linha' + (n.lida ? '' : ' notif__linha--nova') + '">' +
             '<a class="notif__item"' +
               ' href="' + esc(n.destino) + '" data-action="abrir-notificacao"' +
               ' data-value="' + esc(n.id) + '">' +
               '<span class="notif__icon notif__icon--' + esc(n.gravidade) + '"' +
                 ' aria-hidden="true">' + App.icones.de(n.iconeChave) + '</span>' +
               '<span class="notif__body">' +
                 '<span class="notif__title">' + esc(n.titulo) + '</span>' +
                 (n.mensagem ? '<span class="notif__text">' + esc(n.mensagem) + '</span>' : '') +
                 '<span class="notif__when">' + esc(App.format.dataHora(n.quando)) + '</span>' +
               '</span>' +
               (n.lida ? '' : '<span class="notif__dot" aria-label="não lida"></span>') +
             '</a>' +
             '<button type="button" class="notif__excluir"' +
               ' data-action="excluir-notificacao" data-value="' + esc(n.id) + '"' +
               ' title="Apagar este aviso" aria-label="Apagar o aviso: ' + esc(n.titulo) + '">' +
               App.icones.de('lixeira') +
             '</button>' +
           '</div>';
  }

  /* Cabeçalho da gaveta: só o nome do assunto.

     Houve um número de não lidas ao lado. Saiu porque contava o que já estava
     visível logo abaixo — com a lista inteira aberta, os avisos da categoria
     são as próprias linhas, e as não lidas já se distinguem pelo realce e pelo
     ponto. Quem precisa de um número tem o do sino, que é o único lugar onde
     ele informa algo que não está à vista: quanto há com o painel FECHADO. */
  function grupo(g) {
    return '<div class="notif__group">' +
             '<div class="notif__group-label">' + esc(g.label) + '</div>' +
             g.itens.map(item).join('') +
           '</div>';
  }

  /**
   * @param {object}  p
   * @param {Array}   p.notificacoes  a lista INTEIRA do usuário — nada é
   *                                  cortado; o agrupamento só reparte
   * @param {number}  p.naoLidas
   * @param {boolean} p.aberto
   */
  function NotificationCenter(props) {
    var p = props || {};
    var naoLidas = p.naoLidas || 0;

    var painel = '';
    if (p.aberto) {
      // Só reparte quando há painel para mostrar: a casca re-renderiza a cada
      // rota, e o sino fechado é um botão com um número. Sem limite — o corte
      // existia para caber numa tela cheia que não existe mais.
      var grupos = App.domain.alertas.agruparPorCategoria(p.notificacoes || []);

      var corpo = grupos.length
        ? grupos.map(grupo).join('')
        : '<div class="notif__empty">' +
            // O mesmo sino do botão logo acima, cortado — e desenhado, para
            // herdar a cor do painel como todo o resto.
            '<span class="notif__empty-icone" aria-hidden="true">' +
              App.icones.de('sino-cortado') + '</span>' +
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
          /* A faixa do rodapé ficou, vazia. Era o "Ver todas", e o que saiu foi
             o texto e o link — não a faixa: ela é o acabamento inferior do
             painel, e tirá-la mudaria a altura e o arremate do canto
             arredondado, que é o que estava certo. */
          '<div class="notif__footer" aria-hidden="true"></div>' +
        '</div>';
    }

    return '<div class="topbar__notif">' +
             '<button class="topbar__icon-btn" data-action="alternar-notificacoes"' +
               ' data-count="' + naoLidas + '"' +
               ' aria-expanded="' + !!p.aberto + '"' +
               ' title="' + naoLidas + ' notificação(ões) não lida(s)">' +
               App.icones.de('sino') + '</button>' +
             painel +
           '</div>';
  }

  App.components.NotificationCenter = NotificationCenter;
})(window.App = window.App || {});
