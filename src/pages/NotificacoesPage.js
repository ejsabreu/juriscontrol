/* ==========================================================================
   pages/NotificacoesPage.js — todas as notificações do usuário

   O sino mostra as 8 mais recentes; aqui está o histórico inteiro, com
   filtro e a possibilidade de arquivar.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var resultado = null;
  var filtros = { apenasNaoLidas: false, tipo: '', incluirArquivadas: false };

  function esc(v) { return App.dom.esc(v); }
  function usuario() { return App.store.getState().usuarioAtual; }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });
    ligarEventos();
    carregar();
  }

  function carregar() {
    var u = usuario();
    if (!u) return;

    // Avalia antes de listar: entrar nesta tela é o gesto de "quero saber o
    // que há", e não faria sentido mostrar uma foto desatualizada.
    App.services.notificacaoService.sincronizar();

    App.services.notificacaoService
      .listar(Object.assign({ usuarioId: u.id }, filtros))
      .then(function (r) {
        resultado = r;
        desenhar();
      })
      .catch(function (erro) {
        container.innerHTML = App.components.ui.EmptyState({
          icone: '⚠', titulo: 'Erro ao carregar notificações', texto: erro.message
        });
      });
  }

  function linha(n) {
    var ui = App.components.ui;

    return '<li class="notif-row' + (n.lida ? '' : ' notif-row--nova') + '">' +
      '<span class="notif__icon notif__icon--' + esc(n.gravidade) + '" aria-hidden="true">' +
        n.icone + '</span>' +
      '<div class="notif-row__body">' +
        '<a class="notif-row__title" href="' + esc(n.destino) + '"' +
          ' data-action="abrir" data-value="' + esc(n.id) + '">' + esc(n.titulo) + '</a>' +
        (n.mensagem ? '<div class="notif-row__text">' + esc(n.mensagem) + '</div>' : '') +
        '<div class="notif-row__meta">' +
          esc(n.rotuloTipo) + ' · ' + esc(App.format.dataHora(n.quando)) +
          (n.arquivadaEm ? ' · arquivada' : '') +
        '</div>' +
      '</div>' +
      '<div class="notif-row__actions">' +
        (n.lida ? '' : ui.Button({ rotulo: 'Marcar lida', tamanho: 'sm', variante: 'ghost',
                                   acao: 'marcar-lida', valor: n.id })) +
        (n.arquivadaEm ? '' : ui.Button({ rotulo: 'Arquivar', tamanho: 'sm', variante: 'ghost',
                                          acao: 'arquivar', valor: n.id })) +
      '</div>' +
    '</li>';
  }

  function desenhar() {
    var ui = App.components.ui;
    var enums = App.domain.enums;

    var lista = resultado.itens.length
      ? '<ul class="notif-list">' + resultado.itens.map(linha).join('') + '</ul>'
      : ui.EmptyState({
          icone: '🔕',
          titulo: 'Nada por aqui',
          texto: 'Prazos, audiências, tarefas e publicações geram avisos conforme as ' +
                 'regras de alerta do escritório.',
          acao: ui.Button({ rotulo: 'Ver regras de alerta', href: '#/configuracoes' })
        });

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Notificações</h1>' +
          '<p class="page-header__subtitle">' +
            resultado.total + ' no total · ' + resultado.naoLidas + ' não lida(s)' +
          '</p>' +
        '</div>' +
        '<div class="page-header__actions">' +
          (resultado.naoLidas
            ? ui.Button({ rotulo: 'Marcar todas como lidas', acao: 'marcar-todas' })
            : '') +
        '</div>' +
      '</div>' +

      App.components.FilterBar({
        campos: [
          { tipo: 'select', nome: 'tipo', rotulo: 'Tipo',
            opcoes: enums.opcoes(enums.TIPOS_NOTIFICACAO, filtros.tipo, 'Todos os tipos') },
          { tipo: 'checkbox', nome: 'apenasNaoLidas', rotulo: 'Só não lidas',
            valor: filtros.apenasNaoLidas },
          { tipo: 'checkbox', nome: 'incluirArquivadas', rotulo: 'Incluir arquivadas',
            valor: filtros.incluirArquivadas }
        ],
        totalAtivos: App.selectors.filtrosAtivos(filtros, [])
      }) +

      ui.Card({ conteudo: lista, semPadding: true });
  }

  function ligarEventos() {
    App.components.FilterBar.mount(container, {
      aoMudar: function (nome, valor) {
        filtros[nome] = valor;
        carregar();
      },
      aoLimpar: function () {
        filtros = { apenasNaoLidas: false, tipo: '', incluirArquivadas: false };
        carregar();
      }
    });

    App.dom.delegate(container, 'click', '[data-action="marcar-lida"]', function (evento, alvo) {
      App.services.notificacaoService.marcarLida(alvo.getAttribute('data-value'))
        .then(function () {
          App.layout.AppShell.atualizarNotificacoes();
          carregar();
        });
    });

    App.dom.delegate(container, 'click', '[data-action="arquivar"]', function (evento, alvo) {
      App.services.notificacaoService.arquivar(alvo.getAttribute('data-value'))
        .then(function () {
          App.layout.AppShell.atualizarNotificacoes();
          carregar();
        });
    });

    App.dom.delegate(container, 'click', '[data-action="marcar-todas"]', function () {
      App.services.notificacaoService.marcarTodasLidas(usuario().id).then(function (r) {
        App.components.Toast.sucesso('Notificações lidas',
          r.marcadas + ' ' + App.format.plural(r.marcadas, 'aviso') + ' marcado(s).');
        App.layout.AppShell.atualizarNotificacoes();
        carregar();
      });
    });

    App.dom.delegate(container, 'click', '[data-action="abrir"]', function (evento, alvo) {
      App.services.notificacaoService.marcarLida(alvo.getAttribute('data-value'))
        .then(function () { App.layout.AppShell.atualizarNotificacoes(); })
        .catch(function () { /* a navegação segue de qualquer jeito */ });
    });
  }

  App.pages.NotificacoesPage = { render: render };
})(window.App = window.App || {});
