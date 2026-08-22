/* ==========================================================================
   services/acessoService.js
       liberados()               → ids que o usuário da sessão já abriu
       liberar(dados)            → POST /api/acessos-urgencia
       historico(filtros)        → GET  /api/acessos-urgencia

   ACESSO DE URGÊNCIA — a válvula do segredo de justiça.

   O sistema esconde processo sigiloso de quem não atua nele, e isso está
   certo. Mas escritório tem plantão: prazo vence hoje, o responsável está
   em audiência no interior, e alguém precisa peticionar. Sem válvula, a
   regra correta vira prazo perdido — que é o dano caro.

   A troca é deliberada: em vez de barrar, REGISTRA. Quem abriu, quando, e
   por quê. Acesso auditado inibe curiosidade sem travar quem precisa
   trabalhar, e a trilha existe justamente para a pergunta que vem depois
   ("por que você abriu o divórcio da cliente do Marcos?").

   DUAS COISAS QUE ESTE MÓDULO NÃO FAZ, de propósito:

   1. Não revela que o processo existe. A liberação parte do NÚMERO, que a
      pessoa já tinha de outra fonte — o colega que ligou, o cliente, a
      intimação. `processoService.obter()` devolve 404 e não 403 para
      esconder a existência do sigiloso, e uma tela que oferecesse "pedir
      acesso" a partir da navegação desfaria isso na hora.

   2. Não dá poder de escrita. A liberação entra em `podeVerProcesso` como
      último caminho e não é passada para editar, vincular nem
      compartilhar. Quem chega por aqui lê. Para atuar de verdade, o
      responsável inclui a pessoa na equipe do processo.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function usuarioDaSessao() {
    return App.store.getState().usuarioAtual;
  }

  /** Motivo curto demais não é motivo — é clique para tirar a caixa da frente. */
  var MINIMO_MOTIVO = 15;

  /* Validade padrão, em dias corridos, quando o processo não define a sua.
     Sete dias cobrem o caso que motiva a liberação — um prazo que vence
     nesta semana — sem virar acesso permanente por esquecimento. */
  var DIAS_PADRAO = 7;

  /** Dias de validade que ESTE processo concede. Zero significa sem acesso. */
  function diasDe(processo) {
    var d = processo && processo.diasAcessoUrgencia;
    return (d === 0 || d) ? Number(d) : DIAS_PADRAO;
  }

  /**
   * Quando a liberação deixa de valer. Dias CORRIDOS, e não úteis: o relógio
   * do sigilo não para no fim de semana só porque o fórum parou.
   */
  function venceEm(liberacao, processo) {
    var motor = App.domain.prazos;
    /* `addDias` recebe e devolve `Date`; a comparação aqui é entre ISO. */
    return motor.paraISO(motor.addDias(
      motor.paraDate(String(liberacao.quando).slice(0, 10)), diasDe(processo)));
  }

  function vigente(liberacao, processo, hoje) {
    return venceEm(liberacao, processo) >= (hoje || App.domain.prazos.hojeISO());
  }

  /**
   * Ids de processo que o usuário da sessão já liberou.
   *
   * Síncrono, e não `async` como o resto do módulo: isto é lido DENTRO da
   * checagem de permissão de outros serviços, que já rodam dentro de uma
   * `requisicao()`. Devolver Promise aqui obrigaria cada um deles a virar
   * uma cadeia de dois passos por causa de uma leitura local.
   */
  function liberados(usuarioId) {
    var uid = usuarioId || (usuarioDaSessao() || {}).id;
    if (!uid) return [];

    /* Lê os processos SEM filtro de permissão de propósito: a validade é do
       processo liberado, e consultá-la pela via normal seria perguntar se
       posso ver o processo usando a resposta que ainda estou calculando. */
    var porId = {};
    db().get('processos').forEach(function (p) { porId[p.id] = p; });
    var hoje = App.domain.prazos.hojeISO();

    return db().get('liberacoesAcesso')
      .filter(function (l) {
        if (l.usuarioId !== uid) return false;
        if (l.encerradaEm) return false;
        return vigente(l, porId[l.processoId], hoje);
      })
      .map(function (l) { return l.processoId; });
  }

  /** Devolve o acesso antes da hora. O registro fica; só perde a vigência. */
  function encerrar(id) {
    return http().requisicao(function () {
      var liberacao = db().find('liberacoesAcesso', id);
      if (!liberacao) throw http().ErroApi('Liberação não encontrada.', 404);

      var usuario = usuarioDaSessao();
      if (!usuario || liberacao.usuarioId !== usuario.id) {
        throw http().ErroApi('Só quem abriu o acesso pode encerrá-lo.', 403);
      }
      if (liberacao.encerradaEm) return liberacao;

      return db().update('liberacoesAcesso', id, {
        encerradaEm: new Date().toISOString()
      });
    });
  }

  /**
   * Registra o acesso de urgência a um processo, pelo número.
   *
   * @param {Object} dados  { numero, motivo }
   */
  function liberar(dados) {
    return http().requisicao(function () {
      var d = dados || {};
      var usuario = usuarioDaSessao();

      if (!App.domain.permissoes.pode(usuario, 'processos.ver')) {
        throw http().ErroApi('Seu perfil não acessa processos.', 403);
      }

      var motivo = String(d.motivo || '').trim();
      if (motivo.length < MINIMO_MOTIVO) {
        throw http().ErroApi(
          'Descreva o motivo do acesso em pelo menos ' + MINIMO_MOTIVO + ' caracteres.', 400);
      }

      var procurado = String(d.numero || '').replace(/\D/g, '');
      var interno = String(d.numero || '').trim().toUpperCase();
      if (!procurado && !interno) {
        throw http().ErroApi('Informe o número do processo.', 400);
      }

      var processo = db().get('processos').filter(function (p) {
        return (procurado && String(p.numeroCnj || '').replace(/\D/g, '') === procurado) ||
               (interno && String(p.numeroInterno || '').toUpperCase() === interno);
      })[0];

      /* Mesma resposta para "não existe" e para "existe e você já podia
         ver": nos dois casos não há nada a liberar, e diferenciar as
         mensagens transformaria este formulário num detector de processo
         sigiloso — exatamente o que o 404 de `obter()` evita. */
      if (!processo || App.domain.permissoes.podeVerProcesso(usuario, processo)) {
        throw http().ErroApi(
          'Nenhum processo com este número precisa de liberação. ' +
          'Confira o número, ou abra a lista de processos.', 404);
      }

      /* Processo pode fechar a válvula: zero dia = sem acesso de urgência.
         Mesma mensagem do não-encontrado, de novo para não confirmar que o
         número existe. */
      if (diasDe(processo) <= 0) {
        throw http().ErroApi(
          'Nenhum processo com este número precisa de liberação. ' +
          'Confira o número, ou abra a lista de processos.', 404);
      }

      /* Só reaproveita liberação que ainda vale. Uma vencida tem que virar
         registro novo: a trilha precisa mostrar que a pessoa voltou, e com
         que motivo desta vez. */
      var jaLiberado = db().get('liberacoesAcesso').filter(function (l) {
        return l.usuarioId === usuario.id && l.processoId === processo.id &&
               !l.encerradaEm && vigente(l, processo);
      })[0];
      if (jaLiberado) return Object.assign({}, jaLiberado, { processo: processo });

      var registro = db().insert('liberacoesAcesso', {
        usuarioId: usuario.id,
        processoId: processo.id,
        motivo: motivo,
        quando: new Date().toISOString()
      }, 'LIB');

      /* A linha na trilha é o produto deste módulo — a liberação em si é só
         o efeito colateral que permite a leitura. */
      App.services.auditoriaService.registrar({
        acao: 'consultar',
        colecao: 'processos',
        entidadeId: processo.id,
        resumo: 'Acesso de urgência a processo em segredo de justiça · ' +
                processo.numeroInterno + ' — ' + motivo
      });

      return Object.assign({}, registro, { processo: processo });
    });
  }

  /**
   * Trilha das liberações, mais recentes primeiro.
   * @param {Object} [filtros] usuarioId, processoId
   */
  function historico(filtros) {
    return http().requisicao(function () {
      var f = filtros || {};
      var usuarios = db().get('usuarios');
      var processos = db().get('processos');
      var hoje = App.domain.prazos.hojeISO();

      return db().get('liberacoesAcesso')
        .filter(function (l) {
          if (f.usuarioId && l.usuarioId !== f.usuarioId) return false;
          if (f.processoId && l.processoId !== f.processoId) return false;
          return true;
        })
        .map(function (l) {
          var processo = processos.filter(function (p) { return p.id === l.processoId; })[0] || null;
          var vence = venceEm(l, processo);
          return Object.assign({}, l, {
            usuario: usuarios.filter(function (u) { return u.id === l.usuarioId; })[0] || null,
            processo: processo,
            venceEm: vence,
            diasRestantes: App.domain.prazos.diasCorridosEntre(hoje, vence),
            vigente: !l.encerradaEm && vigente(l, processo, hoje)
          });
        })
        .sort(function (a, b) { return a.quando < b.quando ? 1 : -1; });
    });
  }

  App.services.acessoService = {
    MINIMO_MOTIVO: MINIMO_MOTIVO,
    DIAS_PADRAO: DIAS_PADRAO,
    diasDe: diasDe,
    liberados: liberados,
    liberar: liberar,
    encerrar: encerrar,
    historico: historico
  };
})(window.App = window.App || {});
