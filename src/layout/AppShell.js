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
     mesma natureza de `badges`. */
  var notificacoes = [];
  var naoLidas = 0;
  var notificacoesAbertas = false;

  /* O degrau do menu, pela MESMA consulta que o CSS usa.

     Ler `window.innerWidth` uma vez na abertura parecia bastar, e não bastava:
     quem estreita a janela — ou gira o telefone — cruza os 900px sem recarregar
     a página. O CSS acompanha na hora, o estado não acompanhava, e o menu
     continuava expandido numa largura onde ele cobre a tela inteira.

     `matchMedia` é o que avisa quando a resposta muda. O `innerWidth` fica de
     reserva para ambiente sem ele — o jsdom dos testes, por exemplo, que monta
     DOM mas não implementa consulta de mídia. */
  var CONSULTA_ESTREITO =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 900px)')
      : null;

  function telaEstreita() {
    return CONSULTA_ESTREITO ? CONSULTA_ESTREITO.matches : window.innerWidth <= 900;
  }

  /* No estreito o menu nasce recolhido; no largo, aberto. Roda na montagem e a
     cada travessia do degrau — e a travessia REDEFINE mesmo que a pessoa tenha
     mexido no botão antes, porque a escolha feita numa largura não vale para a
     outra: expandido no desktop é uma coluna ao lado do conteúdo, e expandido
     no celular é uma cortina por cima dele. */
  function aplicarPadraoDoMenu() {
    App.store.setState({ sidebarRecolhida: telaEstreita() });
  }

  function observarDegrau() {
    if (!CONSULTA_ESTREITO) return;

    function aoCruzar() {
      aplicarPadraoDoMenu();
      renderizarCasca();
    }

    // `addListener` é o nome antigo; Safari só ganhou `addEventListener`
    // nesta interface em 2020, e o protótipo abre em navegador de escritório.
    if (CONSULTA_ESTREITO.addEventListener) CONSULTA_ESTREITO.addEventListener('change', aoCruzar);
    else if (CONSULTA_ESTREITO.addListener) CONSULTA_ESTREITO.addListener(aoCruzar);
  }

  function montar(elementoRaiz) {
    raiz = elementoRaiz;

    raiz.innerHTML =
      '<div class="app">' +
        '<div id="slot-sidebar"></div>' +
        '<div id="slot-topbar"></div>' +
        '<main class="main" id="conteudo" tabindex="-1"></main>' +
      '</div>';

    aplicarPadraoDoMenu();   // antes do primeiro render, para não piscar
    renderizarCasca();
    ligarEventos();
    observarDegrau();
    atualizarBadges();
    atualizarNotificacoes();
  }

  function renderizarCasca() {
    var estado = App.store.getState();
    var app = raiz && raiz.querySelector('.app');
    if (app) {
      app.className = 'app' +
        (cascaVisivel ? '' : ' app--nu') +
        // A largura da coluna é da GRADE, não da sidebar: estreitar só o
        // <aside> deixaria a coluna larga e um vão vazio ao lado dele.
        (cascaVisivel && estado.sidebarRecolhida ? ' app--menu-recolhido' : '');
    }

    if (!cascaVisivel) {
      App.dom.render('#slot-sidebar', '');
      App.dom.render('#slot-topbar', '');
      return;
    }

    App.dom.render('#slot-sidebar', App.layout.Sidebar({
      rotaAtual: estado.rota && estado.rota.chave,
      badges: badges,
      recolhida: estado.sidebarRecolhida,
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
    /* Um botão só, um estado só, nos dois degraus — e nada de salvar: o menu
       começa recolhido a cada abertura (ver o padrão em store.js). Expandir
       vale para esta sessão. */
    App.dom.delegate(raiz, 'click', '[data-action="alternar-menu"]', function () {
      App.store.setState({ sidebarRecolhida: !App.store.getState().sidebarRecolhida });
      renderizarCasca();
    });

    /* Clique fora recolhe — só no estreito, e só quando está expandido.

       No estreito o menu expandido é uma cortina por cima do conteúdo, e
       cortina que só fecha pelo próprio botão prende quem tocou nela por
       engano. No largo ele é uma coluna ao lado do conteúdo, e não estorva
       nada: recolher a cada clique na tela seria roubar a escolha de quem
       deixou o menu aberto de propósito.

       O `closest('.sidebar')` é o que preserva o ☰: ele mora DENTRO do menu,
       então o clique nele nunca é "fora" e o botão segue expandindo e
       recolhendo normalmente. Vale também depois do render que troca o nó — o
       alvo desconectado ainda tem a `<aside>` antiga na sua linhagem. */
    document.addEventListener('click', function (evento) {
      if (!telaEstreita()) return;
      if (App.store.getState().sidebarRecolhida) return;
      if (evento.target.closest && evento.target.closest('.sidebar')) return;

      App.store.setState({ sidebarRecolhida: true });
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

    /* Em telas pequenas o menu expandido é sobreposição: ele fica por cima da
       tela para onde o clique acabou de levar. Navegar recolhe. */
    App.dom.delegate(raiz, 'click', '.sidebar .nav-item', function () {
      if (telaEstreita() && !App.store.getState().sidebarRecolhida) {
        App.store.setState({ sidebarRecolhida: true });
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
