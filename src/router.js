/* ==========================================================================
   router.js — roteamento por hash

   MIGRAÇÃO: as rotas abaixo têm exatamente a forma do react-router.
       '#/processos/:id'  →  <Route path="/processos/:id" element={<ProcessoDetalhePage/>} />
   Cada página expõe render(container, params) e, opcionalmente, destroy().
   ========================================================================== */

(function (App) {
  'use strict';

  var rotas = [];
  var rotaAtual = null;
  var paginaAtual = null;

  /**
   * Guarda de rota (F2.1). O roteador não conhece sessão nem permissão — quem
   * instala a regra é o `main.js`. Assim o roteador continua genérico e a
   * política de acesso fica num lugar só.
   *
   * @type {?function(rota, params): (string|null)}  devolve o hash de desvio
   */
  var guarda = null;

  function definirGuarda(fn) {
    guarda = typeof fn === 'function' ? fn : null;
  }

  /**
   * @param {string}   padrao  ex.: '/processos/:id'
   * @param {string}   chave   identifica o item ativo na sidebar
   * @param {Function} pagina  objeto com render(container, params)
   * @param {string}   titulo
   * @param {Object}   [opcoes] { permissao, publica, semCasca }
   *        permissao — id de enums.RECURSOS_PERMISSAO exigido para entrar
   *        publica   — dispensa sessão (entrada e, em F2.3, o portal)
   *        semCasca  — renderiza sem sidebar e sem topbar
   */
  function registrar(padrao, chave, pagina, titulo, opcoes) {
    var nomesParametros = [];
    var op = opcoes || {};

    var expressao = padrao
      .replace(/\/:([\w]+)/g, function (_, nome) {
        nomesParametros.push(nome);
        return '/([^/]+)';
      })
      .replace(/\//g, '\\/');

    rotas.push({
      padrao: padrao,
      chave: chave,
      pagina: pagina,
      titulo: titulo,
      permissao: op.permissao || null,
      publica: !!op.publica,
      semCasca: !!op.semCasca,
      regex: new RegExp('^' + expressao + '$'),
      nomesParametros: nomesParametros
    });
  }

  function caminhoAtual() {
    var hash = window.location.hash || '#/';
    return hash.replace(/^#/, '').split('?')[0] || '/';
  }

  function queryAtual() {
    var hash = window.location.hash || '';
    var pos = hash.indexOf('?');
    if (pos === -1) return {};

    var params = {};
    hash.slice(pos + 1).split('&').forEach(function (par) {
      var partes = par.split('=');
      if (partes[0]) params[decodeURIComponent(partes[0])] = decodeURIComponent(partes[1] || '');
    });
    return params;
  }

  function resolver(caminho) {
    for (var i = 0; i < rotas.length; i++) {
      var achado = rotas[i].regex.exec(caminho);
      if (!achado) continue;

      var params = {};
      rotas[i].nomesParametros.forEach(function (nome, indice) {
        params[nome] = decodeURIComponent(achado[indice + 1]);
      });

      return { rota: rotas[i], params: params };
    }
    return null;
  }

  function navegar() {
    var caminho = caminhoAtual();
    var resolvido = resolver(caminho);
    if (!App.layout.AppShell.conteudo()) return;

    // Desmonta a página anterior antes de trocar o conteúdo.
    if (paginaAtual && typeof paginaAtual.destroy === 'function') {
      try { paginaAtual.destroy(); } catch (erro) { console.error('[router] destroy:', erro); }
    }
    paginaAtual = null;

    if (!resolvido) {
      rotaAtual = { chave: null, caminho: caminho };
      App.store.setState({ rota: rotaAtual });
      // aoTrocarRota devolve um <main> novo — os listeners da tela anterior
      // morrem junto com o nó antigo.
      var containerVazio = App.layout.AppShell.aoTrocarRota();
      containerVazio.innerHTML = App.components.ui.EmptyState({
        icone: '🧭',
        titulo: 'Página não encontrada',
        texto: 'A rota "' + App.dom.esc(caminho) + '" não existe neste protótipo.',
        acao: App.components.ui.Button({ rotulo: 'Ir para o meu painel', variante: 'primary', href: '#/' })
      });
      return;
    }

    // Guarda de acesso ANTES de montar qualquer coisa: sem sessão ou sem
    // permissão, a página nem chega a ser instanciada.
    if (guarda) {
      var desvio = guarda(resolvido.rota, resolvido.params);
      if (desvio && desvio !== caminho) {
        window.location.hash = desvio.indexOf('#') === 0 ? desvio : '#' + desvio;
        return;
      }
    }

    rotaAtual = {
      chave: resolvido.rota.chave,
      caminho: caminho,
      params: resolvido.params,
      query: queryAtual(),
      semCasca: resolvido.rota.semCasca
    };

    App.store.setState({ rota: rotaAtual });
    document.title = (resolvido.rota.titulo ? resolvido.rota.titulo + ' · ' : '') + 'JurisControl';

    var container = App.layout.AppShell.aoTrocarRota(rotaAtual);

    paginaAtual = resolvido.rota.pagina;
    try {
      paginaAtual.render(container, resolvido.params, rotaAtual.query);
    } catch (erro) {
      console.error('[router] Erro ao renderizar a página:', erro);
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠',
        titulo: 'Erro ao carregar a tela',
        texto: erro.message
      });
    }
  }

  function iniciar() {
    window.addEventListener('hashchange', navegar);
    if (!window.location.hash) window.location.hash = '#/';
    navegar();
  }

  function ir(caminho) {
    window.location.hash = caminho.indexOf('#') === 0 ? caminho : '#' + caminho;
  }

  /** Re-renderiza a rota atual (após reset de dados, por exemplo). */
  function recarregar() {
    navegar();
  }

  App.router = {
    registrar: registrar,
    // Exposto para quem precisa saber se um caminho leva a algum lugar ANTES
    // de mandar alguém para lá — hoje, a verificação de que nenhum aviso do
    // sino aponta para rota inexistente.
    resolver: resolver,
    definirGuarda: definirGuarda,
    iniciar: iniciar,
    ir: ir,
    recarregar: recarregar,
    caminhoAtual: caminhoAtual,
    rotaAtual: function () { return rotaAtual; }
  };
})(window.App = window.App || {});
