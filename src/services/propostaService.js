/* ==========================================================================
   services/propostaService.js — proposta de honorários

   A proposta é a ponte entre o funil e o financeiro: o que se ofereceu ao
   cliente é o que vira contrato quando ele aceita. Guardar as duas coisas
   separadas, sem ligação, é como o escritório perde a rastreabilidade do
   desconto que deu.

   A proposta EXPIRA. Uma proposta de 2023 aberta no funil não é
   oportunidade — é ruído, e `situacao()` a trata como expirada na leitura,
   sem depender de job noturno (mesma decisão de F2.5 para os títulos).

   O texto sai de um modelo embutido. Em F2.7, quando existir a biblioteca
   de modelos de peças, ele passa a vir de lá — a assinatura de `gerarTexto`
   já está pronta para isso.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  /** Situação real hoje: a gravada pode ter envelhecido. */
  function situacao(proposta, hoje) {
    var referencia = hoje || App.domain.prazos.hojeISO();
    if (proposta.status === 'aceita' || proposta.status === 'recusada' ||
        proposta.status === 'rascunho') {
      return proposta.status;
    }
    if (proposta.validadeAte && proposta.validadeAte < referencia) return 'expirada';
    return proposta.status;
  }

  function enriquecer(p, ctx) {
    var contexto = ctx || { leads: db().get('leads') };
    var lead = contexto.leads.filter(function (l) { return l.id === p.leadId; })[0] || null;
    var atual = situacao(p);

    return Object.assign({}, p, {
      lead: lead,
      leadNome: lead ? lead.nome : '—',
      situacao: atual,
      expirada: atual === 'expirada',
      rotuloStatus: App.domain.enums.rotulo(App.domain.enums.STATUS_PROPOSTA, atual),
      rotuloModalidade: App.domain.enums.rotulo(
        App.domain.enums.MODALIDADES_HONORARIO, p.honorarios && p.honorarios.modalidade)
    });
  }

  function listar(f) {
    return http().requisicao(function () {
      var filtros = f || {};
      var contexto = { leads: db().get('leads') };

      return db().get('propostas')
        .map(function (p) { return enriquecer(p, contexto); })
        .filter(function (p) {
          if (filtros.leadId && p.leadId !== filtros.leadId) return false;
          if (filtros.status && p.situacao !== filtros.status) return false;
          return true;
        })
        .sort(function (a, b) { return a.criadoEm < b.criadoEm ? 1 : -1; });
    });
  }

  function proximoNumero() {
    var ano = new Date().getFullYear();
    var doAno = db().getTodos('propostas').filter(function (p) {
      return String(p.numero || '').indexOf('/' + ano) !== -1;
    });
    return String(doAno.length + 1).padStart(3, '0') + '/' + ano;
  }

  function criar(dados) {
    return http().requisicao(function () {
      var lead = db().find('leads', dados.leadId);
      if (!lead) throw http().ErroApi('Lead não encontrado.', 404);

      var honorarios = dados.honorarios || {};
      if (!App.domain.enums.achar(App.domain.enums.MODALIDADES_HONORARIO,
                                  honorarios.modalidade)) {
        throw http().ErroApi('Modalidade de honorário inválida.', 400);
      }

      var hoje = App.domain.prazos.hojeISO();
      var validade = dados.validadeAte;
      if (!validade) {
        var d = App.format.parseISO(hoje);
        d.setDate(d.getDate() + (dados.validadeDias || 15));
        validade = App.format.toISO(d);
      }

      var proposta = db().insert('propostas', {
        leadId: lead.id,
        numero: proximoNumero(),
        dataEnvio: null,
        validadeAte: validade,
        escopo: dados.escopo || '',
        honorarios: {
          modalidade: honorarios.modalidade,
          valorFixoCentavos: Math.round(honorarios.valorFixoCentavos || 0),
          percentualExito: Number(honorarios.percentualExito) || 0,
          valorHoraCentavos: Math.round(honorarios.valorHoraCentavos || 0),
          numParcelas: Math.max(1, parseInt(honorarios.numParcelas, 10) || 1)
        },
        status: 'rascunho',
        documentoId: null,
        motivoRecusa: null
      }, 'PRP');

      return enriquecer(proposta);
    });
  }

  /**
   * Marca como enviada e move o lead para a etapa de proposta — a proposta
   * enviada É o fato que muda a etapa, e obrigar o usuário a arrastar o
   * card depois só cria a chance de esquecer.
   */
  function enviar(id) {
    return http().requisicao(function () {
      var p = db().find('propostas', id);
      if (!p) throw http().ErroApi('Proposta não encontrada.', 404);
      if (p.status !== 'rascunho') throw http().ErroApi('Esta proposta já foi enviada.', 409);

      var hoje = App.domain.prazos.hojeISO();
      var atualizada = db().update('propostas', id, { status: 'enviada', dataEnvio: hoje });

      var lead = db().find('leads', p.leadId);
      if (lead && lead.etapa !== 'ganho' && lead.etapa !== 'perdido' &&
          lead.etapa !== 'negociacao') {
        db().update('leads', lead.id, { etapa: 'proposta' });
      }

      db().insert('interacoes', {
        leadId: p.leadId, pessoaId: null, processoId: null,
        tipo: 'email',
        quando: new Date().toISOString(),
        duracaoMin: 0,
        resumo: 'Proposta ' + p.numero + ' enviada',
        usuarioId: (App.store.getState().usuarioAtual || {}).id || null,
        proximoPasso: 'Aguardar retorno até ' + App.format.data(p.validadeAte)
      }, 'INT');

      return enriquecer(atualizada);
    });
  }

  function recusar(id, motivo) {
    return http().requisicao(function () {
      var texto = String(motivo || '').trim();
      if (texto.length < 5) throw http().ErroApi('Descreva o motivo da recusa.', 400);

      var atualizada = db().update('propostas', id, {
        status: 'recusada', motivoRecusa: texto
      });
      if (!atualizada) throw http().ErroApi('Proposta não encontrada.', 404);
      return enriquecer(atualizada);
    });
  }

  /**
   * Texto da proposta.
   *
   * Modelo embutido por enquanto. Em F2.7 passa a vir da biblioteca de
   * modelos de peças, com as mesmas variáveis — e esta assinatura não muda.
   */
  function gerarTexto(id) {
    return http().requisicao(function () {
      var p = db().find('propostas', id);
      if (!p) throw http().ErroApi('Proposta não encontrada.', 404);

      var lead = db().find('leads', p.leadId) || {};
      var enums = App.domain.enums;
      var h = p.honorarios || {};
      var esc = App.dom.esc;

      var condicoes = [];
      if (h.valorFixoCentavos) {
        condicoes.push('Honorários de ' + App.format.moeda(h.valorFixoCentavos) +
          ' (' + App.moeda.extenso(h.valorFixoCentavos) + ')' +
          (h.numParcelas > 1 ? ', em ' + h.numParcelas + ' parcelas iguais' : ', à vista'));
      }
      if (h.percentualExito) {
        condicoes.push('Honorários de êxito de ' + h.percentualExito +
          '% sobre o proveito econômico obtido');
      }
      if (h.valorHoraCentavos) {
        condicoes.push('Honorários por hora trabalhada, a ' +
          App.format.moeda(h.valorHoraCentavos) + ' a hora');
      }

      var html =
        '<h1>Proposta de honorários n. ' + esc(p.numero) + '</h1>' +
        '<p><strong>Interessado:</strong> ' + esc(lead.nome || '') + '<br>' +
        '<strong>Área:</strong> ' + esc(enums.rotulo(enums.AREAS, lead.areaId)) + '<br>' +
        '<strong>Validade desta proposta:</strong> ' +
          esc(App.format.data(p.validadeAte)) + '</p>' +
        '<h2>Objeto</h2>' +
        '<p>' + esc(p.escopo || lead.resumoCaso || '') + '</p>' +
        '<h2>Honorários</h2>' +
        '<ul>' + condicoes.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') +
        '</ul>' +
        '<h2>Despesas</h2>' +
        '<p>Custas processuais, diligências e demais despesas correm por conta do ' +
        'contratante, mediante prestação de contas.</p>' +
        '<p style="margin-top:2em">' + esc(App.format.dataExtenso(App.domain.prazos.hojeISO())) +
        '</p>';

      return { proposta: enriquecer(p), html: html };
    });
  }

  App.services.propostaService = {
    listar: listar,
    criar: criar,
    enviar: enviar,
    recusar: recusar,
    gerarTexto: gerarTexto,
    situacao: situacao,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
