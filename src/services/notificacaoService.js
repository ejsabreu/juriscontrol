/* ==========================================================================
   services/notificacaoService.js — central de notificações

   Persiste o que `domain/alertas.js` decide. A divisão é proposital: a regra
   de "o que deveria estar avisado hoje" é pura e testável sem banco; aqui só
   se grava, lê e marca como lida.

   MIGRAÇÃO:
       sincronizar() → o servidor avalia em cron e o cliente só faz GET
       listar()      → GET  /api/notificacoes
       marcarLida()  → PATCH /api/notificacoes/:id
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function estadoParaAvaliacao() {
    return {
      prazos: db().get('prazos'),
      compromissos: db().get('compromissos'),
      tarefas: db().get('tarefas'),
      publicacoes: db().get('publicacoes'),
      lancamentos: db().get('lancamentos'),
      leads: db().get('leads'),
      usuarios: db().get('usuarios'),
      regrasAlerta: db().get('regrasAlerta')
    };
  }

  /**
   * Avalia as regras e grava só o que ainda não existe.
   *
   * SÍNCRONO de propósito: roda no bootstrap e a cada 5 minutos, sem tela
   * esperando. Na fase 3 isto vira um job no servidor e o cliente some da
   * jogada — por isso não passa por `http.requisicao`.
   *
   * @returns {{ geradas: number, avaliadas: number }}
   */
  function sincronizar(hoje) {
    var desejadas = App.domain.alertas.avaliar(estadoParaAvaliacao(), hoje);
    var existentes = db().getTodos('notificacoes');
    var novas = App.domain.alertas.novidades(desejadas, existentes);

    novas.forEach(function (n) {
      var gravada = db().insert('notificacoes', {
        chave: n.chave,
        usuarioId: n.usuarioId,
        tipo: n.tipo,
        gravidade: n.gravidade,
        titulo: n.titulo,
        mensagem: n.mensagem,
        entidadeColecao: n.entidadeColecao,
        entidadeId: n.entidadeId,
        processoId: n.processoId || null,
        quando: new Date().toISOString(),
        lidaEm: null,
        arquivadaEm: null
      }, 'NTF');

      // Canal 'email' vira item na caixa de saída simulada.
      if ((n.canais || []).indexOf('email') !== -1 && App.services.emailService) {
        App.services.emailService.enfileirar(gravada);
      }
    });

    return { geradas: novas.length, avaliadas: desejadas.length };
  }

  /* Link para onde a notificação leva — a razão de ela existir.

     Do mais específico para o mais geral: o processo é o melhor destino que
     existe, porque o prazo, o compromisso e a tarefa moram dentro dele. Sem
     processo, cai na tela do módulo — a Agenda para o que tem data, a lista
     para o resto.

     Não há mais fundo de poço para '#/notificacoes': aquela tela foi removida,
     e um aviso que levasse a ela agora levaria a lugar nenhum. Por isso a
     tabela abaixo cobre TODA coleção que gera aviso; se um gatilho novo
     aparecer sem entrada aqui, o destino cai na Agenda em vez de quebrar. */
  var TELA_DA_COLECAO = {
    publicacoes:  '#/publicacoes',
    lancamentos:  '#/financeiro',
    prazos:       '#/agenda',
    compromissos: '#/agenda',
    tarefas:      '#/tarefas',
    leads:        '#/crm'
  };

  function destinoDe(n) {
    if (n.processoId) return '#/processos/' + n.processoId;
    if (n.entidadeColecao === 'leads' && n.entidadeId) return '#/crm/' + n.entidadeId;
    return TELA_DA_COLECAO[n.entidadeColecao] || '#/agenda';
  }

  function enriquecer(n) {
    var tipo = App.domain.enums.achar(App.domain.enums.TIPOS_NOTIFICACAO, n.tipo);
    return Object.assign({}, n, {
      // A CHAVE do ícone, não o desenho: quem resolve é a tela, com
      // `App.icones.de()`. Um service devolvendo SVG seria a camada de dados
      // decidindo aparência — e a chave ainda tem a vantagem de estourar na
      // cara de quem esquecer de resolvê-la, em vez de sumir em silêncio.
      iconeChave: tipo ? tipo.iconeChave : 'ponto',
      rotuloTipo: tipo ? tipo.label : n.tipo,
      lida: !!n.lidaEm,
      destino: destinoDe(n)
    });
  }

  /**
   * @param {object} f  usuarioId, apenasNaoLidas, tipo, gravidade,
   *                    incluirArquivadas, pagina, porPagina
   */
  function listar(f) {
    return http().requisicao(function () {
      var filtros = f || {};

      var lista = db().get('notificacoes')
        .filter(function (n) {
          if (filtros.usuarioId && n.usuarioId !== filtros.usuarioId) return false;
          if (!filtros.incluirArquivadas && n.arquivadaEm) return false;
          if (filtros.apenasNaoLidas && n.lidaEm) return false;
          if (filtros.tipo && n.tipo !== filtros.tipo) return false;
          if (filtros.gravidade && n.gravidade !== filtros.gravidade) return false;
          return true;
        })
        .map(enriquecer)
        .sort(function (a, b) { return a.quando < b.quando ? 1 : -1; });

      var total = lista.length;
      var pagina = filtros.pagina || 1;
      var porPagina = filtros.porPagina || total || 1;
      var inicio = (pagina - 1) * porPagina;

      return {
        itens: filtros.porPagina ? lista.slice(inicio, inicio + porPagina) : lista,
        total: total,
        naoLidas: lista.filter(function (n) { return !n.lidaEm; }).length,
        pagina: pagina,
        totalPaginas: Math.max(1, Math.ceil(total / porPagina))
      };
    });
  }

  /**
   * Contador do sino. SÍNCRONO — a casca o consulta a cada re-render e uma
   * Promise aqui faria o número piscar a cada troca de rota.
   */
  function contarNaoLidas(usuarioId) {
    return db().get('notificacoes').filter(function (n) {
      return n.usuarioId === usuarioId && !n.lidaEm && !n.arquivadaEm;
    }).length;
  }

  function marcarLida(id) {
    return http().requisicao(function () {
      var n = db().update('notificacoes', id, { lidaEm: new Date().toISOString() });
      if (!n) throw http().ErroApi('Notificação não encontrada.', 404);
      return enriquecer(n);
    });
  }

  function marcarTodasLidas(usuarioId) {
    return http().requisicao(function () {
      var agora = new Date().toISOString();
      var quantas = 0;

      db().get('notificacoes').forEach(function (n) {
        if (n.usuarioId !== usuarioId || n.lidaEm) return;
        db().update('notificacoes', n.id, { lidaEm: agora });
        quantas++;
      });

      return { marcadas: quantas };
    });
  }

  /**
   * O "apagar" da lixeira do sino.
   *
   * Na tela o aviso some para sempre — não há mais onde ver arquivados. No
   * banco ele fica: `arquivadaEm` preenchido, registro intacto. É a regra de
   * soft delete do projeto, e aqui ela não é só princípio — é o que impede o
   * avaliador de recriar o aviso na sincronização seguinte. Ele decide o que é
   * novo comparando CHAVES contra `getTodos()`, que enxerga o arquivado; se o
   * registro sumisse de verdade, o mesmo prazo vencido voltaria em cinco
   * minutos e a lixeira pareceria não funcionar.
   */
  function arquivar(id) {
    return http().requisicao(function () {
      var agora = new Date().toISOString();
      var n = db().update('notificacoes', id, { arquivadaEm: agora, lidaEm: agora });
      if (!n) throw http().ErroApi('Notificação não encontrada.', 404);
      return enriquecer(n);
    });
  }

  App.services.notificacaoService = {
    sincronizar: sincronizar,
    listar: listar,
    contarNaoLidas: contarNaoLidas,
    marcarLida: marcarLida,
    marcarTodasLidas: marcarTodasLidas,
    arquivar: arquivar,
    destinoDe: destinoDe
  };
})(window.App = window.App || {});
