/* ==========================================================================
   pages/RelatoriosPage.js — catálogo de relatórios

   Cartões agrupados por tema. O catálogo é lido de
   `domain/indicadores.CATALOGO`, e o serviço já removeu o que o perfil não
   pode abrir — a tela não decide nada sobre acesso.

   O selo "só os seus números" aparece no cartão de quem tem escopo próprio:
   o advogado precisa saber que está vendo a si mesmo, não a equipe, antes
   de tirar conclusão do número.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;

  function esc(v) { return App.dom.esc(v); }

  function render(elemento) {
    container = elemento;
    desenhar();
  }

  function cartao(r) {
    return '<a class="rel-card" href="#/relatorios/' + esc(r.id) + '">' +
      '<span class="rel-card__icone" aria-hidden="true">' + r.icone + '</span>' +
      '<span class="rel-card__corpo">' +
        '<span class="rel-card__nome">' + esc(r.nome) + '</span>' +
        '<span class="rel-card__descricao">' + esc(r.descricao) + '</span>' +
        (r.restrito
          ? '<span class="rel-card__escopo">só os seus números</span>' : '') +
      '</span>' +
    '</a>';
  }

  function desenhar() {
    var lista = App.services.relatorioService.catalogo();

    if (!lista.length) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '📊',
        titulo: 'Nenhum relatório disponível',
        texto: 'Seu perfil não tem acesso aos relatórios do escritório.'
      });
      return;
    }

    var grupos = {};
    lista.forEach(function (r) { (grupos[r.grupo] = grupos[r.grupo] || []).push(r); });

    var corpo = Object.keys(grupos).map(function (grupo) {
      return '<section class="rel-grupo">' +
        '<h2 class="rel-grupo__titulo">' + esc(grupo) + '</h2>' +
        '<div class="rel-grade">' + grupos[grupo].map(cartao).join('') + '</div>' +
      '</section>';
    }).join('');

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Relatórios</h1>' +
          '<p class="page-header__subtitle">' +
            lista.length + ' relatório(s) disponíveis para o seu perfil' +
          '</p>' +
        '</div>' +
      '</div>' +
      corpo;
  }

  App.pages.RelatoriosPage = { render: render };
})(window.App = window.App || {});
