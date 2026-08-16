/* ==========================================================================
   store/store.js — estado central da aplicação

   MIGRAÇÃO: esta é a mesma forma de Context + useReducer, Zustand ou
   Redux Toolkit. As telas nunca leem o DOM para saber o estado — só o store.

   Regra: componente NÃO acessa o store diretamente. A página lê o estado,
   passa por props e recebe callbacks. É o "lifting state up" do React.
   ========================================================================== */

(function (App) {
  'use strict';

  function criarStore(estadoInicial) {
    var estado = Object.assign({}, estadoInicial);
    var ouvintes = [];

    function getState() {
      return estado;
    }

    /**
     * Mescla alterações no estado e notifica os inscritos.
     * @param {Object|Function} alteracoes  objeto parcial ou (estado) => parcial
     */
    function setState(alteracoes) {
      var parcial = typeof alteracoes === 'function' ? alteracoes(estado) : alteracoes;
      if (!parcial) return estado;

      var anterior = estado;
      estado = Object.assign({}, estado, parcial);

      var mudou = Object.keys(parcial).some(function (chave) {
        return anterior[chave] !== estado[chave];
      });
      if (mudou) notificar(anterior);

      return estado;
    }

    function notificar(anterior) {
      ouvintes.slice().forEach(function (ouvinte) {
        try {
          ouvinte(estado, anterior);
        } catch (erro) {
          console.error('[store] Erro em ouvinte:', erro);
        }
      });
    }

    /** @returns {Function} função para cancelar a inscrição */
    function subscribe(ouvinte) {
      ouvintes.push(ouvinte);
      return function unsubscribe() {
        var i = ouvintes.indexOf(ouvinte);
        if (i !== -1) ouvintes.splice(i, 1);
      };
    }

    /** Inscreve-se em uma fatia — só dispara quando aquele valor muda. */
    function subscribeTo(seletor, ouvinte) {
      var valorAnterior = seletor(estado);
      return subscribe(function (novo) {
        var valorNovo = seletor(novo);
        if (valorNovo !== valorAnterior) {
          var antigo = valorAnterior;
          valorAnterior = valorNovo;
          ouvinte(valorNovo, antigo);
        }
      });
    }

    function reset(novoEstado) {
      var anterior = estado;
      estado = Object.assign({}, estadoInicial, novoEstado || {});
      notificar(anterior);
    }

    return {
      getState: getState,
      setState: setState,
      subscribe: subscribe,
      subscribeTo: subscribeTo,
      reset: reset
    };
  }

  // --- Estado inicial da aplicação ------------------------------------------
  var store = criarStore({
    usuarioAtual: null,
    rota: null,

    // Preferências de UI persistidas entre navegações
    tema: 'light',

    /* Valor de partida do desktop. Quem decide de verdade é o AppShell, na
       montagem e a cada vez que a janela cruza os 900px — o padrão depende da
       largura, e largura não é assunto do store. */
    sidebarRecolhida: false,

    // Filtros da tela de Processos — sobrevivem à troca tabela ⇄ kanban
    processosFiltros: {
      busca: '',
      status: '',
      faseId: '',
      areaId: '',
      responsavelId: '',
      risco: '',
      ordenarPor: 'dataDistribuicao',
      direcao: 'desc',
      pagina: 1,
      porPagina: 15
    },
    processosVisao: 'tabela',        // 'tabela' | 'kanban'
    processosAgruparPor: 'faseId',   // 'faseId' | 'responsavelId' | 'areaId'

    agendaMes: null,                 // ISO do 1º dia do mês exibido
    agendaFiltros: { responsavelId: '', tipo: '', apenasAbertos: true },

    tarefasFiltros: { busca: '', responsavelId: '', prioridade: '' },
    clientesFiltros: { busca: '', tipo: '', ordenarPor: 'nome', pagina: 1, porPagina: 12 },

    carregando: false,
    erro: null
  });

  // Persistência das preferências (tema e visão) entre recarregamentos.
  var CHAVE_PREFS = 'jurisctrl.prefs.v1';

  function carregarPreferencias() {
    try {
      var bruto = window.localStorage.getItem(CHAVE_PREFS);
      if (bruto) store.setState(JSON.parse(bruto));
    } catch (e) { /* storage indisponível — segue com o padrão */ }
  }

  function salvarPreferencias() {
    try {
      var s = store.getState();
      window.localStorage.setItem(CHAVE_PREFS, JSON.stringify({
        tema: s.tema,
        // `sidebarRecolhida` NÃO entra aqui: o menu começa recolhido a cada
        // abertura, por decisão de projeto. Gravar o estado faria a segunda
        // sessão abrir expandida.
        processosVisao: s.processosVisao,
        processosAgruparPor: s.processosAgruparPor
      }));
    } catch (e) { /* storage indisponível — preferência vale só na sessão */ }
  }

  App.store = store;
  App.criarStore = criarStore;
  App.preferencias = {
    carregar: carregarPreferencias,
    salvar: salvarPreferencias
  };
})(window.App = window.App || {});
