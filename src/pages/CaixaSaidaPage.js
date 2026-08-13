/* ==========================================================================
   pages/CaixaSaidaPage.js — os e-mails que TERIAM sido enviados

   Nenhum e-mail sai daqui. A mensagem é montada de verdade — destinatário,
   assunto, corpo HTML — e fica visível para revisão.

   A tela existe porque a alternativa seria pior: um sistema que diz "enviei
   um e-mail" sem enviar nada é uma mentira; um que não mostra nada deixa o
   texto do aviso impossível de revisar antes de haver servidor.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var mensagens = [];
  var selecionada = null;
  var busca = '';

  function esc(v) { return App.dom.esc(v); }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });
    ligarEventos();
    carregar();
  }

  function carregar() {
    App.services.emailService.listar({ busca: busca }).then(function (lista) {
      mensagens = lista;
      if (!selecionada && lista.length) selecionada = lista[0].id;
      desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Erro ao carregar a caixa de saída', texto: erro.message
      });
    });
  }

  function itemLista(m) {
    var ativa = m.id === selecionada;
    return '<button type="button" class="outbox__item' + (ativa ? ' outbox__item--active' : '') + '"' +
             ' data-action="selecionar" data-value="' + esc(m.id) + '">' +
             '<span class="outbox__to">' + esc(m.paraNome || m.para) + '</span>' +
             '<span class="outbox__subject">' + esc(m.assunto) + '</span>' +
             '<span class="outbox__when">' + esc(App.format.dataHora(m.geradaEm)) + '</span>' +
           '</button>';
  }

  function previa() {
    var m = mensagens.filter(function (x) { return x.id === selecionada; })[0];
    if (!m) {
      return App.components.ui.EmptyState({
        icone: '✉', titulo: 'Selecione uma mensagem'
      });
    }

    return '<div class="outbox__preview">' +
      '<dl class="outbox__headers">' +
        '<div><dt>De</dt><dd>' + esc(m.de) + '</dd></div>' +
        '<div><dt>Para</dt><dd>' + esc(m.paraNome ? m.paraNome + ' <' + m.para + '>' : m.para) + '</dd></div>' +
        '<div><dt>Assunto</dt><dd>' + esc(m.assunto) + '</dd></div>' +
        '<div><dt>Gerada em</dt><dd>' + esc(App.format.dataHora(m.geradaEm)) + '</dd></div>' +
      '</dl>' +
      // O corpo é HTML montado pelo próprio sistema, não conteúdo de usuário.
      '<div class="outbox__body">' + m.corpoHtml + '</div>' +
    '</div>';
  }

  function desenhar() {
    var ui = App.components.ui;

    var lista = mensagens.length
      ? '<div class="outbox__list">' + mensagens.map(itemLista).join('') + '</div>'
      : ui.EmptyState({
          icone: '📭',
          titulo: 'Nenhuma mensagem gerada',
          texto: 'As regras de alerta com o canal "e-mail" ligado enfileiram mensagens aqui.'
        });

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Caixa de saída</h1>' +
          '<p class="page-header__subtitle">' +
            mensagens.length + ' ' + App.format.plural(mensagens.length, 'mensagem', 'mensagens') +
            ' que teriam sido enviadas' +
          '</p>' +
        '</div>' +
        '<div class="page-header__actions">' +
          (mensagens.length
            ? ui.Button({ rotulo: 'Limpar caixa', variante: 'ghost', acao: 'limpar' })
            : '') +
        '</div>' +
      '</div>' +

      App.components.SeloSimulado({
        oque: 'nenhum e-mail é enviado. As mensagens são montadas de verdade e ficam aqui.',
        detalhe: 'Assim o texto, o remetente e o gatilho de cada aviso podem ser revisados ' +
                 'antes de existir servidor de e-mail.',
        naFase3: 'POST /api/notificacoes/email e esta tela deixa de existir.'
      }) +

      '<div class="filter-bar">' +
        '<input class="input" type="search" data-filtro="busca" value="' + esc(busca) + '"' +
          ' placeholder="Buscar por assunto ou destinatário…">' +
      '</div>' +

      '<div class="outbox">' + lista + previa() + '</div>';
  }

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="selecionar"]', function (evento, alvo) {
      selecionada = alvo.getAttribute('data-value');
      desenhar();
    });

    App.dom.delegate(container, 'input', 'input[data-filtro="busca"]',
      App.dom.debounce(function (evento, alvo) {
        busca = alvo.value;
        carregar();
      }, 250));

    App.dom.delegate(container, 'click', '[data-action="limpar"]', function () {
      App.components.Modal.confirmar({
        titulo: 'Limpar caixa de saída',
        mensagem: 'As mensagens simuladas serão descartadas.',
        detalhe: 'As notificações no sino permanecem — só a prévia dos e-mails some.',
        rotuloConfirmar: 'Limpar',
        variante: 'danger'
      }).then(function (confirmado) {
        if (!confirmado) return;
        App.services.emailService.limpar().then(function (r) {
          selecionada = null;
          App.components.Toast.sucesso('Caixa limpa',
            r.removidas + ' ' + App.format.plural(r.removidas, 'mensagem', 'mensagens') + '.');
          carregar();
        });
      });
    });
  }

  App.pages.CaixaSaidaPage = { render: render };
})(window.App = window.App || {});
