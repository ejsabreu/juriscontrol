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

  /* Rotas "nuas" — entrada (F2.1) e portal do cliente (F2.3) — se renderizam
     sem sidebar nem topbar. Os slots são esvaziados de verdade, não só
     escondidos por CSS: a topbar traz busca global e troca de tema, e nada
     disso pode existir numa tela para quem ainda não entrou no sistema. */
  var cascaVisivel = true;

  /* Estado do sino. Mora aqui, e não no store, porque é estado de casca: só a
     casca lê, e ele morre com ela. */
  var notificacoes = [];
  var naoLidas = 0;
  var notificacoesAbertas = false;

  /* Quando o próximo desenho do menu deve ser ANIMADO.

     A animação de entrada dos rótulos (`menu-entra`, em layout.css) dispara na
     criação do elemento — e o menu inteiro é recriado a cada desenho da casca.
     Sem esta trava, qualquer coisa que repinte a casca fazia o menu piscar:
     trocar de rota, trocar de tema, e principalmente a volta do sino, que roda
     sozinha de tempos em tempos. Voltar para a janela depois de um tempo em
     outro programa caía justamente nisso — os avisos se atualizavam e o menu
     dava um pulo sem que ninguém tivesse tocado nele.

     Quem levanta a bandeira é só quem EXPANDE o menu de propósito. Ela cai no
     desenho seguinte: a animação vale para aquele quadro, não para o estado. */
  var animarExpansao = false;

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
      // Cruzar para o largo abre o menu — e abrir o menu é o único caso em
      // que a entrada dos rótulos deve ser animada.
      definirMenuRecolhido(telaEstreita());
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
    atualizarNotificacoes();
  }

  /* As duas metades da casca se desenham SEPARADAS, e é de propósito.

     Menu e topbar não dependem um do outro: o menu muda quando a rota, o
     perfil ou o estado de recolhido mudam; a topbar muda quando o sino, o tema
     ou o usuário mudam. Redesenhar os dois juntos fazia o mais barulhento
     arrastar o outro — o sino se atualiza sozinho a cada cinco minutos, e
     junto com ele o menu inteiro era jogado fora e reconstruído.

     Quem precisa dos dois chama `renderizarCasca()`. Quem mexe só no sino
     chama `renderizarTopbar()`, e o menu nem fica sabendo. */
  function atualizarClasseDoApp() {
    var estado = App.store.getState();
    var app = raiz && raiz.querySelector('.app');
    if (!app) return;

    app.className = 'app' +
      (cascaVisivel ? '' : ' app--nu') +
      // A largura da coluna é da GRADE, não da sidebar: estreitar só o
      // <aside> deixaria a coluna larga e um vão vazio ao lado dele.
      (cascaVisivel && estado.sidebarRecolhida ? ' app--menu-recolhido' : '');
  }

  function renderizarSidebar() {
    atualizarClasseDoApp();

    if (!cascaVisivel) {
      App.dom.render('#slot-sidebar', '');
      return;
    }

    var estado = App.store.getState();

    /* Recolher e expandir REDESENHA o menu — os rótulos somem, os títulos de
       seção somem, o `title` de cada item aparece. E redesenhar um elemento
       zera a rolagem dele: quem estava no fim da lista, com o menu longo,
       voltava ao topo a cada clique no botão.

       Então a posição é guardada antes e devolvida depois. Vale para
       qualquer redesenho do menu, não só o do botão — trocar de rota
       também repinta o menu para marcar o item ativo. */
    var navAntes = document.querySelector('.sidebar__nav');
    var rolagem = navAntes ? navAntes.scrollTop : 0;

    App.dom.render('#slot-sidebar', App.layout.Sidebar({
      rotaAtual: estado.rota && estado.rota.chave,
      recolhida: estado.sidebarRecolhida,
      secoesAbertas: estado.sidebarSecoesAbertas,
      usuario: estado.usuarioAtual,     // F2.1: o menu esconde o que o perfil não acessa
      animarExpansao: animarExpansao
    }));

    animarExpansao = false;

    if (rolagem) {
      var navDepois = document.querySelector('.sidebar__nav');
      /* Só devolve o que ainda cabe: ao recolher, a lista fica mais curta —
         sem rótulos e sem títulos de seção — e pedir uma posição maior que a
         nova altura deixaria o menu no fim, e não onde estava. */
      if (navDepois) {
        navDepois.scrollTop = Math.min(
          rolagem, navDepois.scrollHeight - navDepois.clientHeight);
      }
    }
  }

  function renderizarTopbar() {
    atualizarClasseDoApp();

    if (!cascaVisivel) {
      App.dom.render('#slot-topbar', '');
      return;
    }

    var estado = App.store.getState();

    App.dom.render('#slot-topbar', App.layout.Topbar({
      usuario: estado.usuarioAtual,
      tema: estado.tema,
      notificacoes: notificacoes,
      naoLidas: naoLidas,
      notificacoesAbertas: notificacoesAbertas
    }));

    App.layout.Topbar.mount(document);
  }

  function renderizarCasca() {
    renderizarSidebar();
    renderizarTopbar();
  }

  /* Recolhe ou expande o menu — o único caminho para isso, de propósito.

     Concentrar aqui é o que garante que a animação de entrada só rode quando
     o menu de fato abriu. Mexer no store e chamar o desenho por fora voltaria
     a piscar em silêncio; ver `animarExpansao` lá em cima. */
  function definirMenuRecolhido(recolhida) {
    animarExpansao = !recolhida;
    App.store.setState({ sidebarRecolhida: recolhida });
    renderizarSidebar();
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

    /* Sem paginar: o painel reparte por categoria e mostra a lista inteira, e
       uma categoria pequena não pode se perder por ter caído depois da vigésima
       linha. São registros locais — não há ida ao servidor a economizar aqui. */
    return App.services.notificacaoService
      .listar({ usuarioId: usuario.id })
      .then(function (r) {
        notificacoes = r.itens;
        naoLidas = r.naoLidas;
        // SÓ a topbar: o sino não é assunto do menu, e arrastá-lo junto era o
        // que fazia o menu piscar a cada volta do avaliador de alertas.
        renderizarTopbar();
      })
      .catch(function (erro) {
        console.warn('[shell] Falha ao carregar notificações:', erro.message);
      });
  }

  function ligarEventos() {
    /* Abre e fecha uma seção do menu.

       Aqui NÃO se repinta a casca, ao contrário do botão de recolher. Um
       elemento recém-criado já nasce no estado final, e transição nenhuma
       acontece — para a abertura ser animada, é o mesmo nó que precisa mudar
       de classe. O store é atualizado do mesmo jeito, e é dele que sai o
       estado quando a casca for repintada por outro motivo (troca de rota,
       por exemplo). */
    App.dom.delegate(raiz, 'click', '[data-action="alternar-secao"]', function (evento, botao) {
      var secao = botao.dataset.value;
      var abertas = App.store.getState().sidebarSecoesAbertas || [];
      var i = abertas.indexOf(secao);
      var abrindo = i === -1;

      App.store.setState({
        sidebarSecoesAbertas: abrindo
          ? abertas.concat([secao])
          : abertas.slice(0, i).concat(abertas.slice(i + 1))
      });
      /* Grava na hora, e não ao sair: sob `file://` não existe "sair" — a
         aba é fechada e nenhum evento chega a tempo. Um item de preferência
         por clique é escrita barata o bastante para não valer adiar. */
      App.preferencias.salvar();

      botao.classList.toggle('sidebar__section--dobrada', !abrindo);
      botao.setAttribute('aria-expanded', abrindo ? 'true' : 'false');

      var grupo = botao.nextElementSibling;
      if (grupo) grupo.classList.toggle('sidebar__grupo--dobrado', !abrindo);
    });

    /* Um botão só, um estado só, nos dois degraus — e nada de salvar: o menu
       começa recolhido a cada abertura (ver o padrão em store.js). Expandir
       vale para esta sessão. */
    App.dom.delegate(raiz, 'click', '[data-action="alternar-menu"]', function () {
      definirMenuRecolhido(!App.store.getState().sidebarRecolhida);
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

      definirMenuRecolhido(true);
    });

    App.dom.delegate(raiz, 'click', '[data-action="alternar-tema"]', function () {
      var novo = App.store.getState().tema === 'dark' ? 'light' : 'dark';
      App.store.setState({ tema: novo });
      aplicarTema(novo);
      App.preferencias.salvar();
      // O tema mora no atributo do <html> e no ícone do botão; o menu não tem
      // uma linha de HTML que dependa dele. Repintá-lo era piscada de graça.
      renderizarTopbar();
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
      else renderizarTopbar();
    });

    App.dom.delegate(raiz, 'click', '[data-action="marcar-todas-lidas"]', function (evento) {
      evento.stopPropagation();
      var usuario = App.store.getState().usuarioAtual;
      if (!usuario) return;
      App.services.notificacaoService.marcarTodasLidas(usuario.id)
        .then(atualizarNotificacoes);
    });

    /* Apagar um aviso. Sem confirmação de propósito: o aviso é derivado — o
       prazo, a tarefa e a publicação continuam lá, e o pior que acontece é
       perder um lembrete de algo que a própria tela mostra. Um modal por
       lixeira clicada custaria mais do que o erro que evitaria.

       O `stopPropagation` guarda o painel: sem ele, o clique subiria até o
       fechamento por clique-fora e a gaveta sumiria a cada aviso apagado —
       justamente quando a pessoa está limpando vários. */
    App.dom.delegate(raiz, 'click', '[data-action="excluir-notificacao"]', function (evento, alvo) {
      evento.preventDefault();
      evento.stopPropagation();
      App.services.notificacaoService.arquivar(alvo.getAttribute('data-value'))
        .then(atualizarNotificacoes)
        .catch(function (erro) {
          App.components.Toast.erro('Não foi possível apagar o aviso', erro.message);
        });
    });

    App.dom.delegate(raiz, 'click', '[data-action="abrir-notificacao"]', function (evento, alvo) {
      // O href leva à origem do aviso; marcar como lida é efeito colateral,
      // e não pode atrapalhar a navegação se falhar.
      notificacoesAbertas = false;
      App.services.notificacaoService.marcarLida(alvo.getAttribute('data-value'))
        .then(atualizarNotificacoes)
        .catch(function () { renderizarTopbar(); });
    });

    // Clique fora fecha o painel — sem isso ele fica preso aberto.
    document.addEventListener('click', function (evento) {
      if (!notificacoesAbertas) return;
      if (evento.target.closest('.topbar__notif')) return;
      notificacoesAbertas = false;
      renderizarTopbar();
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
        App.router.recarregar();
      });
    });

    /* Em telas pequenas o menu expandido é sobreposição: ele fica por cima da
       tela para onde o clique acabou de levar. Navegar recolhe. */
    App.dom.delegate(raiz, 'click', '.sidebar .nav-item', function () {
      if (telaEstreita() && !App.store.getState().sidebarRecolhida) {
        definirMenuRecolhido(true);
      }
    });
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
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

  /* Toda troca de rota começa no topo.

     No desktop `scrollTo` sozinho bastava; no celular, não. Ali o menu
     expandido é uma sobreposição `absolute` que estica o documento para além
     da altura de `.app`, e o toque num item dispara três coisas encadeadas no
     mesmo instante: o menu recolhe (o documento encolhe de uma vez), o hash
     muda, a tela nova é montada (o documento cresce de novo). O `scrollTo`
     cai no meio dessa sequência, e a posição que ele grava é reajustada
     quando o layout assenta — a página abre no meio.

     Reafirmar no quadro seguinte resolve, porque aí a altura final já é
     conhecida. Só reafirma se algo de fato tirou a página do topo: quem já
     está em zero não é tocado, e uma rolagem deliberada de quem acabou de
     chegar na tela nova ainda não teve tempo de acontecer — é o quadro
     seguinte, uns 16ms. */
  function irParaOTopo() {
    window.scrollTo(0, 0);

    // O jsdom dos testes não implementa rAF em toda versão; sem ele, fica o
    // comportamento antigo, que já servia no desktop.
    if (typeof window.requestAnimationFrame !== 'function') return;

    window.requestAnimationFrame(function () {
      if (window.pageYOffset !== 0) window.scrollTo(0, 0);
    });
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

    irParaOTopo();
    return trocarConteudo();
  }

  App.layout.AppShell = {
    montar: montar,
    conteudo: conteudo,
    trocarConteudo: trocarConteudo,
    renderizarCasca: renderizarCasca,
    renderizarTopbar: renderizarTopbar,
    aplicarTema: aplicarTema,
    atualizarNotificacoes: atualizarNotificacoes,
    aoTrocarRota: aoTrocarRota
  };
})(window.App = window.App || {});
