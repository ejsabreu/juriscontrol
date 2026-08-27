/* ==========================================================================
   services/leadService.js — funil de prospecção

   Até aqui, um cliente só existia DEPOIS de virar processo. Este módulo é o
   antes: quem procurou o escritório, o que foi conversado, o que foi
   proposto e por que fechou ou não.

   A CONVERSÃO é o ponto do módulo. Lead ganho vira pessoa (cliente),
   contrato de honorários e, opcionalmente, processo — numa passagem só, com
   os dados que já foram digitados. Refazer tudo à mão é onde a informação
   se perde e o funil deixa de refletir a realidade.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function enriquecer(lead, ctx) {
    var contexto = ctx || {
      usuarios: db().get('usuarios'),
      interacoes: db().get('interacoes'),
      propostas: db().get('propostas')
    };
    var hoje = App.domain.prazos.hojeISO();
    var enums = App.domain.enums;

    var etapa = enums.achar(enums.ETAPAS_FUNIL, lead.etapa);
    var responsavel = contexto.usuarios.filter(function (u) {
      return u.id === lead.responsavelId;
    })[0] || null;

    var doLead = contexto.interacoes.filter(function (i) { return i.leadId === lead.id; });
    var ultima = doLead.sort(function (a, b) { return a.quando < b.quando ? 1 : -1; })[0] || null;

    var propostas = contexto.propostas.filter(function (p) { return p.leadId === lead.id; });

    /* A probabilidade da ETAPA é a régua do escritório; a do lead, quando
       preenchida, é a leitura de quem está conduzindo. A do lead manda. */
    var probabilidade = lead.probabilidade !== null && lead.probabilidade !== undefined
      ? lead.probabilidade
      : (etapa ? etapa.probabilidade : 0);

    return Object.assign({}, lead, {
      etapaLabel: etapa ? etapa.label : lead.etapa,
      etapaCor: etapa ? etapa.cor : null,
      probabilidade: probabilidade,
      // Valor ponderado: é o que o funil soma para dizer quanto vale a
      // carteira de prospecção. Somar o valor cheio de tudo seria fantasia.
      valorPonderadoCentavos: Math.round((lead.valorEstimadoCentavos || 0) * probabilidade / 100),
      responsavel: responsavel,
      responsavelNome: responsavel ? responsavel.nome : '—',
      totalInteracoes: doLead.length,
      ultimaInteracao: ultima,
      diasSemContato: ultima
        ? App.domain.prazos.diasCorridosEntre(String(ultima.quando).slice(0, 10), hoje)
        : null,
      followUpAtrasado: !!lead.proximoContatoEm && lead.proximoContatoEm < hoje &&
                        lead.etapa !== 'ganho' && lead.etapa !== 'perdido',
      propostas: propostas,
      rotuloOrigem: enums.rotulo(enums.ORIGENS_LEAD, lead.origem)
    });
  }

  function listar(f) {
    return http().requisicao(function () {
      var filtros = f || {};
      var contexto = {
        usuarios: db().get('usuarios'),
        interacoes: db().get('interacoes'),
        propostas: db().get('propostas')
      };

      return db().get('leads')
        .map(function (l) { return enriquecer(l, contexto); })
        .filter(function (l) {
          if (filtros.etapa && l.etapa !== filtros.etapa) return false;
          if (filtros.origem && l.origem !== filtros.origem) return false;
          if (filtros.responsavelId && l.responsavelId !== filtros.responsavelId) return false;
          if (filtros.areaId && l.areaId !== filtros.areaId) return false;
          if (filtros.apenasAtrasados && !l.followUpAtrasado) return false;
          if (filtros.excluirEncerrados && (l.etapa === 'ganho' || l.etapa === 'perdido')) {
            return false;
          }

          if (filtros.busca) {
            var termo = String(filtros.busca).toLowerCase();
            var alvo = (l.nome + ' ' + (l.resumoCaso || '') + ' ' +
                        ((l.contato && l.contato.email) || '')).toLowerCase();
            if (alvo.indexOf(termo) === -1) return false;
          }
          return true;
        })
        .sort(function (a, b) {
          // Follow-up atrasado sobe: é o que exige ação hoje.
          if (a.followUpAtrasado !== b.followUpAtrasado) return a.followUpAtrasado ? -1 : 1;
          return b.valorEstimadoCentavos - a.valorEstimadoCentavos;
        });
    });
  }

  function obter(id) {
    return http().requisicao(function () {
      var lead = db().find('leads', id);
      if (!lead) throw http().ErroApi('Lead não encontrado.', 404);

      var interacoes = db().where('interacoes', function (i) { return i.leadId === id; })
        .map(function (i) {
          return Object.assign({}, i, { usuario: db().find('usuarios', i.usuarioId) });
        })
        .sort(function (a, b) { return a.quando < b.quando ? 1 : -1; });

      var propostas = db().where('propostas', function (p) { return p.leadId === id; })
        .sort(function (a, b) { return a.criadoEm < b.criadoEm ? 1 : -1; });

      return Object.assign(enriquecer(lead), {
        interacoes: interacoes,
        propostas: propostas
      });
    });
  }

  function criar(dados) {
    return http().requisicao(function () {
      var nome = String(dados.nome || '').trim();
      if (!nome) throw http().ErroApi('Informe o nome do interessado.', 400);

      var usuario = App.store.getState().usuarioAtual;

      return enriquecer(db().insert('leads', {
        nome: nome,
        pessoaId: null,
        contato: {
          telefone: (dados.contato && dados.contato.telefone) || dados.telefone || '',
          email: (dados.contato && dados.contato.email) || dados.email || ''
        },
        origem: dados.origem || 'outro',
        indicadoPorId: dados.indicadoPorId || null,
        areaId: dados.areaId || 'civel',
        resumoCaso: dados.resumoCaso || '',
        etapa: dados.etapa || 'novo',
        valorEstimadoCentavos: Math.round(dados.valorEstimadoCentavos || 0),
        probabilidade: dados.probabilidade !== undefined ? dados.probabilidade : null,
        responsavelId: dados.responsavelId || (usuario ? usuario.id : null),
        proximoContatoEm: dados.proximoContatoEm || null,
        motivoPerda: null,
        convertidoEm: null
      }, 'LED'));
    });
  }

  function atualizar(id, alteracoes) {
    return http().requisicao(function () {
      var atualizado = db().update('leads', id, alteracoes);
      if (!atualizado) throw http().ErroApi('Lead não encontrado.', 404);
      return enriquecer(atualizado);
    });
  }

  /**
   * Move o lead de etapa — é o que o arrastar do funil chama.
   *
   * Marcar como PERDIDO exige motivo. Um funil cheio de "perdido" sem
   * justificativa não ensina nada; com o motivo, vira o relatório que diz
   * se o escritório perde por preço, por prazo ou por não ter respondido.
   */
  function mudarEtapa(id, etapa, dados) {
    return http().requisicao(function () {
      var lead = db().find('leads', id);
      if (!lead) throw http().ErroApi('Lead não encontrado.', 404);

      var destino = App.domain.enums.achar(App.domain.enums.ETAPAS_FUNIL, etapa);
      if (!destino) throw http().ErroApi('Etapa desconhecida: ' + etapa, 400);

      var d = dados || {};

      if (etapa === 'perdido') {
        var motivo = String(d.motivoPerda || '').trim();
        if (motivo.length < 5) {
          throw http().ErroApi('Descreva o motivo da perda.', 400);
        }
      }

      if (etapa === 'ganho' && !lead.pessoaId) {
        // Ganhar sem converter deixaria um cliente que não existe em lugar
        // nenhum; a tela chama `converter()`, que faz o caminho completo.
        throw http().ErroApi(
          'Para marcar como ganho, use a conversão — ela cria o cliente e o contrato.', 409);
      }

      var alteracoes = { etapa: etapa };
      if (etapa === 'perdido') {
        alteracoes.motivoPerda = String(d.motivoPerda).trim();
        alteracoes.proximoContatoEm = null;
      }
      if (d.probabilidade !== undefined) alteracoes.probabilidade = d.probabilidade;

      var atualizado = db().update('leads', id, alteracoes);

      db().insert('interacoes', {
        leadId: id, pessoaId: null, processoId: null,
        tipo: 'nota',
        quando: new Date().toISOString(),
        duracaoMin: 0,
        resumo: 'Etapa alterada para ' + destino.label +
                (alteracoes.motivoPerda ? ' — ' + alteracoes.motivoPerda : ''),
        usuarioId: (App.store.getState().usuarioAtual || {}).id || null,
        proximoPasso: null
      }, 'INT');

      return enriquecer(atualizado);
    });
  }

  /**
   * CONVERSÃO — lead ganho vira cliente, contrato e (opcional) processo.
   *
   * Tudo numa transação lógica: se o contrato falhar, o cliente recém-criado
   * fica órfão, e por isso a pessoa só é criada depois das validações.
   *
   * @param {object} dados { pessoa?, contrato, processo? }
   */
  function converter(id, dados) {
    return http().requisicao(function () {
      var lead = db().find('leads', id);
      if (!lead) throw http().ErroApi('Lead não encontrado.', 404);
      if (lead.convertidoEm) throw http().ErroApi('Este lead já foi convertido.', 409);

      var d = dados || {};
      var dadosPessoa = d.pessoa || {};
      var dadosContrato = d.contrato || {};

      // Cliente existente ou novo.
      var pessoaId = d.pessoaId || lead.pessoaId || null;

      if (!pessoaId) {
        var documento = String(dadosPessoa.documento || '').replace(/\D/g, '');
        if (documento) {
          var valido = documento.length === 11
            ? App.domain.validators.cpf(documento).valido
            : App.domain.validators.cnpj(documento).valido;
          if (!valido) throw http().ErroApi('CPF/CNPJ inválido.', 400);

          // Cliente já cadastrado com o mesmo documento não vira duplicata.
          var existente = db().get('pessoas').filter(function (p) {
            return String(p.documento || '').replace(/\D/g, '') === documento;
          })[0];
          if (existente) pessoaId = existente.id;
        }
      }

      if (!pessoaId) {
        var pessoa = db().insert('pessoas', {
          nome: dadosPessoa.nome || lead.nome,
          tipo: dadosPessoa.tipo || 'PF',
          documento: dadosPessoa.documento || '',
          email: dadosPessoa.email || (lead.contato && lead.contato.email) || '',
          telefone: dadosPessoa.telefone || (lead.contato && lead.contato.telefone) || '',
          endereco: dadosPessoa.endereco || null,
          ehCliente: true,
          observacoes: lead.resumoCaso || ''
        }, 'PES');
        pessoaId = pessoa.id;
      } else {
        db().update('pessoas', pessoaId, { ehCliente: true });
      }

      // Processo, quando pedido — antes do contrato, para vinculá-lo.
      var processoId = null;
      if (d.processo && d.processo.criar) {
        var proc = db().insert('processos', {
          numeroCnj: d.processo.numeroCnj || '',
          numeroInterno: d.processo.numeroInterno ||
            ('ADV-' + new Date().getFullYear() + '-' +
             String(db().get('processos').length + 1).padStart(4, '0')),
          tipo: 'judicial',
          clienteId: pessoaId,
          papelCliente: d.processo.papelCliente || 'autor',
          areaId: lead.areaId || 'civel',
          classeProcessual: d.processo.classeProcessual || '',
          assunto: d.processo.assunto || lead.resumoCaso || lead.nome,
          tribunalId: d.processo.tribunalId || 'tjsp',
          comarca: d.processo.comarca || '',
          vara: d.processo.vara || '',
          instancia: 1,
          faseId: 'distribuicao',
          status: 'ativo',
          segredoJustica: false,
          dataDistribuicao: App.domain.prazos.hojeISO(),
          valorCausa: Math.round(d.processo.valorCausa || lead.valorEstimadoCentavos || 0),
          valorProvisao: 0,
          risco: 'possivel',
          responsavelId: lead.responsavelId,
          equipeIds: [],
          processoPaiId: null,
          tags: []
        }, 'PRO');
        processoId = proc.id;
      }

      // Contrato de honorários.
      var contrato = null;
      if (dadosContrato.modalidade) {
        var parcelas = App.domain.financeiro.gerarParcelas({
          valorFixoCentavos: Math.round(dadosContrato.valorFixoCentavos || 0),
          numParcelas: Math.max(1, parseInt(dadosContrato.numParcelas, 10) || 1),
          diaVencimento: dadosContrato.diaVencimento || null,
          dataInicio: App.domain.prazos.hojeISO()
        });

        contrato = db().insert('contratos', {
          clienteId: pessoaId,
          processoId: processoId,
          modalidade: dadosContrato.modalidade,
          descricao: dadosContrato.descricao || ('Honorários — ' + lead.nome),
          valorFixoCentavos: Math.round(dadosContrato.valorFixoCentavos || 0),
          percentualExito: Number(dadosContrato.percentualExito) || 0,
          valorHoraCentavos: Math.round(dadosContrato.valorHoraCentavos || 0),
          valorMensalCentavos: 0,
          numParcelas: Math.max(1, parseInt(dadosContrato.numParcelas, 10) || 1),
          diaVencimento: dadosContrato.diaVencimento || null,
          dataInicio: App.domain.prazos.hojeISO(),
          dataFim: null,
          status: 'ativo'
        }, 'CTR');

        parcelas.forEach(function (p) {
          db().insert('lancamentos', {
            tipo: 'receita', origem: 'honorario',
            contratoId: contrato.id, processoId: processoId, clienteId: pessoaId,
            descricao: 'Honorários ' + p.numero + '/' + p.de,
            valorCentavos: p.valorCentavos,
            valorPagoCentavos: 0,
            dataCompetencia: p.dataCompetencia,
            dataVencimento: p.dataVencimento,
            dataPagamento: null,
            status: 'previsto',
            reembolsavel: false, boletoId: null,
            parcela: { n: p.numero, de: p.de }
          }, 'LAN');
        });
      }

      var atualizado = db().update('leads', id, {
        etapa: 'ganho',
        pessoaId: pessoaId,
        convertidoEm: new Date().toISOString(),
        proximoContatoEm: null
      });

      // Proposta aceita fecha junto — o funil não pode deixar proposta
      // pendurada num lead já ganho.
      db().where('propostas', function (p) {
        return p.leadId === id && p.status === 'enviada';
      }).forEach(function (p) {
        db().update('propostas', p.id, { status: 'aceita' });
      });

      App.services.auditoriaService.registrar({
        acao: 'criar', colecao: 'leads', entidadeId: id,
        resumo: 'Lead convertido em cliente: ' + lead.nome
      });

      return {
        lead: enriquecer(atualizado),
        pessoaId: pessoaId,
        contratoId: contrato ? contrato.id : null,
        processoId: processoId,
        parcelasGeradas: contrato ? contrato.numParcelas : 0
      };
    });
  }

  /** Indicadores do funil — alimentam os cartões e o relatório de F2.9. */
  function resumo() {
    var leads = db().get('leads');
    var enums = App.domain.enums;
    var hoje = App.domain.prazos.hojeISO();

    var porEtapa = {};
    enums.ETAPAS_FUNIL.forEach(function (e) {
      porEtapa[e.id] = { quantidade: 0, valorCentavos: 0, ponderadoCentavos: 0 };
    });

    var atrasados = 0;

    leads.forEach(function (l) {
      var alvo = porEtapa[l.etapa];
      if (!alvo) return;
      var etapa = enums.achar(enums.ETAPAS_FUNIL, l.etapa);
      var prob = l.probabilidade !== null && l.probabilidade !== undefined
        ? l.probabilidade : (etapa ? etapa.probabilidade : 0);

      alvo.quantidade++;
      alvo.valorCentavos += Math.round(l.valorEstimadoCentavos || 0);
      alvo.ponderadoCentavos += Math.round((l.valorEstimadoCentavos || 0) * prob / 100);

      if (l.proximoContatoEm && l.proximoContatoEm < hoje &&
          l.etapa !== 'ganho' && l.etapa !== 'perdido') atrasados++;
    });

    var ganhos = porEtapa.ganho.quantidade;
    var perdidos = porEtapa.perdido.quantidade;
    var fechados = ganhos + perdidos;

    var emAndamento = enums.ETAPAS_FUNIL
      .filter(function (e) { return e.id !== 'ganho' && e.id !== 'perdido'; })
      .reduce(function (soma, e) { return soma + porEtapa[e.id].ponderadoCentavos; }, 0);

    return {
      total: leads.length,
      porEtapa: porEtapa,
      followUpAtrasado: atrasados,
      ganhos: ganhos,
      perdidos: perdidos,
      // Só faz sentido sobre o que já FECHOU: incluir o que está em
      // andamento faria a taxa despencar sem que nada tivesse dado errado.
      taxaConversaoPct: fechados > 0 ? Math.round((ganhos / fechados) * 1000) / 10 : 0,
      pipelinePonderadoCentavos: emAndamento
    };
  }

  App.services.leadService = {
    listar: listar,
    obter: obter,
    criar: criar,
    atualizar: atualizar,
    mudarEtapa: mudarEtapa,
    converter: converter,
    resumo: resumo,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
