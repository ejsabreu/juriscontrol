/* ==========================================================================
   layout/AppShell.js — casca da aplicação

   Renderiza sidebar e topbar UMA VEZ; a troca de rota substitui apenas o
   conteúdo de <main>. No React isto é o layout de rota do react-router
   (elemento pai com <Outlet />).
   ========================================================================== */

(function (App) {
  'use strict';

  App.layout = App.layout || {};

  var raiz = null;
  var badges = {
    prazosCriticos: 0, tarefasAtrasadas: 0,
    publicacoesPendentes: 0, followUpAtrasado: 0
  };

  /* Rotas "nuas" — entrada (F2.1) e portal do cliente (F2.3) — se renderizam
     sem sidebar nem topbar. Os slots são esvaziados de verdade, não só
     escondidos por CSS: a topbar traz busca global e troca de tema, e nada
     disso pode existir numa tela para quem ainda não entrou no sistema. */
  var cascaVisivel = true;

  /* Estado do sino. Mora aqui, e não no store, porque é estado de casca —
     mesma natureza de `badges` e `sidebarAberta`. */
  var notificacoes = [];
  var naoLidas = 0;
  var notificacoesAbertas = false;

  function montar(elementoRaiz) {
    raiz = elementoRaiz;

    raiz.innerHTML =
      '<div class="app">' +
        '<div id="slot-sidebar"></div>' +
        '<div id="slot-topbar"></div>' +
        '<main class="main" id="conteudo" tabindex="-1"></main>' +
      '</div>';

    renderizarCasca();
    ligarEventos();
    atualizarBadges();
    atualizarNotificacoes();
  }

  function renderizarCasca() {
    var estado = App.store.getState();
    var app = raiz && raiz.querySelector('.app');
    if (app) app.className = 'app' + (cascaVisivel ? '' : ' app--nu');

    if (!cascaVisivel) {
      App.dom.render('#slot-sidebar', '');
      App.dom.render('#slot-topbar', '');
      return;
    }

    App.dom.render('#slot-sidebar', App.layout.Sidebar({
      rotaAtual: estado.rota && estado.rota.chave,
      badges: badges,
      aberta: estado.sidebarAberta,
      usuario: estado.usuarioAtual      // F2.1: o menu esconde o que o perfil não acessa
    }));

    App.dom.render('#slot-topbar', App.layout.Topbar({
      usuario: estado.usuarioAtual,
      tema: estado.tema,
      prazosCriticos: badges.prazosCriticos,
      notificacoes: notificacoes,
      naoLidas: naoLidas,
      notificacoesAbertas: notificacoesAbertas
    }));

    App.layout.Topbar.mount(document);
  }

  /**
   * Roda o avaliador de alertas e recarrega o sino.
   *
   * O `sincronizar()` é idempotente por construção (ver `domain/alertas.js`),
   * então chamá-lo a cada troca de rota não gera aviso repetido.
   */
  function atualizarNotificacoes() {
    var usuario = App.store.getState().usuarioAtual;
    if (!usuario) {
      notificacoes = [];
      naoLidas = 0;
      return Promise.resolve();
    }

    App.services.notificacaoService.sincronizar();

    return App.services.notificacaoService
      .listar({ usuarioId: usuario.id, porPagina: 20 })
      .then(function (r) {
        notificacoes = r.itens;
        naoLidas = r.naoLidas;
        renderizarCasca();
      })
      .catch(function (erro) {
        console.warn('[shell] Falha ao carregar notificações:', erro.message);
      });
  }

  function ligarEventos() {
    App.dom.delegate(raiz, 'click', '[data-action="alternar-sidebar"]', function () {
      App.store.setState({ sidebarAberta: !App.store.getState().sidebarAberta });
      renderizarCasca();
    });

    App.dom.delegate(raiz, 'click', '[data-action="alternar-tema"]', function () {
      var novo = App.store.getState().tema === 'dark' ? 'light' : 'dark';
      App.store.setState({ tema: novo });
      aplicarTema(novo);
      App.preferencias.salvar();
      renderizarCasca();
    });

    App.dom.delegate(raiz, 'click', '[data-action="ir-prazos"]', function () {
      window.location.hash = '#/agenda';
    });

    App.dom.delegate(raiz, 'click', '[data-action="sair"]', function () {
      App.services.sessaoService.sair().then(function () {
        App.router.ir('#/entrar');
      });
    });

    // --- Central de notificações (F2.2) ---
    App.dom.delegate(raiz, 'click', '[data-action="alternar-notificacoes"]', function (evento) {
      evento.stopPropagation();
      notificacoesAbertas = !notificacoesAbertas;
      if (notificacoesAbertas) atualizarNotificacoes();
      else renderizarCasca();
    });

    App.dom.delegate(raiz, 'click', '[data-action="marcar-todas-lidas"]', function (evento) {
      evento.stopPropagation();
      var usuario = App.store.getState().usuarioAtual;
      if (!usuario) return;
      App.services.notificacaoService.marcarTodasLidas(usuario.id)
        .then(atualizarNotificacoes);
    });

    App.dom.delegate(raiz, 'click', '[data-action="abrir-notificacao"]', function (evento, alvo) {
      // O href leva à origem do aviso; marcar como lida é efeito colateral,
      // e não pode atrapalhar a navegação se falhar.
      notificacoesAbertas = false;
      App.services.notificacaoService.marcarLida(alvo.getAttribute('data-value'))
        .then(atualizarNotificacoes)
        .catch(function () { renderizarCasca(); });
    });

    // Clique fora fecha o painel — sem isso ele fica preso aberto.
    document.addEventListener('click', function (evento) {
      if (!notificacoesAbertas) return;
      if (evento.target.closest('.topbar__notif')) return;
      notificacoesAbertas = false;
      renderizarCasca();
    });

    App.dom.delegate(raiz, 'click', '[data-action="restaurar-dados"]', function () {
      App.components.Modal.confirmar({
        titulo: 'Restaurar dados fictícios',
        mensagem: 'Todas as alterações feitas no protótipo serão descartadas.',
        detalhe: 'O conjunto de dados original será regerado. Esta ação não pode ser desfeita.',
        rotuloConfirmar: 'Restaurar',
        variante: 'danger'
      }).then(function (confirmado) {
        if (!confirmado) return;
        App.services.db.reset();
        App.components.Toast.sucesso('Dados restaurados', 'O conjunto fictício original foi regerado.');
        atualizarBadges();
        App.router.recarregar();
      });
    });

    // Em telas pequenas, navegar fecha a gaveta.
    App.dom.delegate(raiz, 'click', '.sidebar .nav-item', function () {
      if (window.innerWidth <= 900 && App.store.getState().sidebarAberta) {
        App.store.setState({ sidebarAberta: false });
        renderizarCasca();
      }
    });
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
  }

  /** Recalcula os contadores da sidebar e do sino. */
  function atualizarBadges() {
    return Promise.all([
      App.services.prazoService.resumo(),
      App.services.tarefaService.resumo()
    ]).then(function (resultados) {
      badges = {
        prazosCriticos: resultados[0].contagem.critico + resultados[0].contagem.vencido,
        tarefasAtrasadas: resultados[1].atrasadas,
        // Síncronos: os resumos são contagens locais, sem ida ao "servidor".
        publicacoesPendentes: App.services.publicacaoService.resumo().pendentes,
        followUpAtrasado: App.services.leadService.resumo().followUpAtrasado
      };
      renderizarCasca();
      return badges;
    }).catch(function (erro) {
      console.warn('[shell] Falha ao atualizar contadores:', erro.message);
    });
  }

  function conteudo() {
    return document.getElementById('conteudo');
  }

  /**
   * Substitui o <main> por um elemento novo e vazio.
   *
   * As páginas ligam seus listeners por DELEGAÇÃO no container. Como o
   * container é o mesmo nó em todas as rotas, sem esta troca os listeners
   * de uma tela continuariam ativos na seguinte — arrastar um card no
   * kanban de Tarefas dispararia também o handler do kanban de Processos.
   * Descartar o nó descarta junto todos os listeners presos a ele.
   */
  function trocarConteudo() {
    var antigo = conteudo();
    if (!antigo) return null;

    var novo = document.createElement('main');
    novo.className = 'main';
    novo.id = 'conteudo';
    novo.setAttribute('tabindex', '-1');

    antigo.parentNode.replaceChild(novo, antigo);
    return novo;
  }

  /**
   * Chamado pelo router a cada troca de rota. Devolve o container limpo.
   * @param {object} [rota]  quando `rota.semCasca`, renderiza sem shell
   */
  function aoTrocarRota(rota) {
    cascaVisivel = !(rota && rota.semCasca);
    notificacoesAbertas = false;      // trocar de tela fecha o painel do sino
    renderizarCasca();

    /* Reavalia os alertas a cada rota. O `montar()` roda antes do login,
       quando ainda não há usuário — sem este gancho, o sino só se
       atualizaria de 5 em 5 minutos ou ao ser clicado. É barato porque
       `sincronizar()` é idempotente: só grava o que ainda não existe. */
    if (cascaVisivel) atualizarNotificacoes();

    window.scrollTo(0, 0);
    return trocarConteudo();
  }

  App.layout.AppShell = {
    montar: montar,
    conteudo: conteudo,
    trocarConteudo: trocarConteudo,
    renderizarCasca: renderizarCasca,
    aplicarTema: aplicarTema,
    atualizarBadges: atualizarBadges,
    atualizarNotificacoes: atualizarNotificacoes,
    aoTrocarRota: aoTrocarRota
  };
})(window.App = window.App || {});
