/* ==========================================================================
   services/interacaoService.js — histórico de contato

   Ligação, reunião, e-mail, WhatsApp, visita. A mesma interação serve ao
   lead (antes de virar cliente) e à pessoa (depois) — por isso o registro
   tem `leadId` E `pessoaId`.

   Quando o lead é convertido, o histórico dele NÃO é reescrito: fica com o
   `leadId` original e passa a ser alcançável também pela pessoa. Reescrever
   apagaria a fronteira entre prospecção e atendimento, que é justamente o
   que o funil precisa saber.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function enriquecer(i, ctx) {
    var contexto = ctx || { usuarios: db().get('usuarios') };
    var enums = App.domain.enums;
    var tipo = enums.achar(enums.TIPOS_INTERACAO, i.tipo);

    return Object.assign({}, i, {
      usuario: contexto.usuarios.filter(function (u) { return u.id === i.usuarioId; })[0] || null,
      icone: tipo ? tipo.icone : '•',
      rotuloTipo: tipo ? tipo.label : i.tipo,
      data: String(i.quando).slice(0, 10)
    });
  }

  /**
   * @param {object} f  leadId, pessoaId, processoId, tipo, usuarioId, de, ate
   *
   * `pessoaId` traz também as interações do LEAD que virou aquela pessoa —
   * o histórico do cliente começa antes de ele ser cliente.
   */
  function listar(f) {
    return http().requisicao(function () {
      var filtros = f || {};
      var contexto = { usuarios: db().get('usuarios') };

      var leadsDaPessoa = filtros.pessoaId
        ? db().get('leads')
            .filter(function (l) { return l.pessoaId === filtros.pessoaId; })
            .map(function (l) { return l.id; })
        : [];

      return db().get('interacoes')
        .filter(function (i) {
          if (filtros.leadId && i.leadId !== filtros.leadId) return false;

          if (filtros.pessoaId) {
            var daPessoa = i.pessoaId === filtros.pessoaId;
            var doLeadDela = i.leadId && leadsDaPessoa.indexOf(i.leadId) !== -1;
            if (!daPessoa && !doLeadDela) return false;
          }

          if (filtros.processoId && i.processoId !== filtros.processoId) return false;
          if (filtros.tipo && i.tipo !== filtros.tipo) return false;
          if (filtros.usuarioId && i.usuarioId !== filtros.usuarioId) return false;
          if (filtros.de && String(i.quando).slice(0, 10) < filtros.de) return false;
          if (filtros.ate && String(i.quando).slice(0, 10) > filtros.ate) return false;
          return true;
        })
        .map(function (i) { return enriquecer(i, contexto); })
        .sort(function (a, b) { return a.quando < b.quando ? 1 : -1; });
    });
  }

  function criar(dados) {
    return http().requisicao(function () {
      if (!dados.leadId && !dados.pessoaId && !dados.processoId) {
        throw http().ErroApi('A interação precisa estar ligada a um lead, cliente ou processo.', 400);
      }

      var tipo = App.domain.enums.achar(App.domain.enums.TIPOS_INTERACAO, dados.tipo);
      if (!tipo) throw http().ErroApi('Tipo de interação inválido.', 400);

      var usuario = App.store.getState().usuarioAtual;

      var interacao = db().insert('interacoes', {
        leadId: dados.leadId || null,
        pessoaId: dados.pessoaId || null,
        processoId: dados.processoId || null,
        tipo: dados.tipo,
        quando: dados.quando || new Date().toISOString(),
        duracaoMin: Math.round(dados.duracaoMin || 0),
        resumo: dados.resumo || '',
        usuarioId: dados.usuarioId || (usuario ? usuario.id : null),
        proximoPasso: dados.proximoPasso || null
      }, 'INT');

      /* Registrar contato move o follow-up junto. Sem isso, o lead
         continuaria marcado como atrasado logo depois de ter sido atendido —
         e o alerta perderia a credibilidade. */
      if (dados.leadId && dados.proximoContatoEm !== undefined) {
        db().update('leads', dados.leadId, { proximoContatoEm: dados.proximoContatoEm });
      }

      return enriquecer(interacao);
    });
  }

  function remover(id) {
    return http().requisicao(function () {
      if (!db().remove('interacoes', id)) {
        throw http().ErroApi('Interação não encontrada.', 404);
      }
      return { id: id };
    });
  }

  App.services.interacaoService = {
    listar: listar,
    criar: criar,
    remover: remover,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
