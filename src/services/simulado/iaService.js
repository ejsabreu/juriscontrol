/* ==========================================================================
   services/simulado/iaService.js — assistente SIMULADO

   NÃO HÁ MODELO DE LINGUAGEM AQUI. Nenhum. Sem servidor não há como chamar
   uma API, e fingir que há seria a pior mentira do protótipo — a única que
   o usuário não tem como conferir olhando a tela.

   O que este arquivo faz:
     · expõe a ASSINATURA que a fase 3 vai implementar de verdade;
     · monta o corpo da resposta a partir de `domain/assistente.js` (regra
       auditável) e dos modelos de peça de F2.7;
     · simula latência e escrita progressiva, para a tela exercitar o estado
       de "gerando" desde já.

   MIGRAÇÃO — troca de corpo, não de forma:
       gerarPeca(p)        → POST /api/ia/peca
       resumirPublicacao(p)→ POST /api/ia/publicacao
       sugerirDesfecho(p)  → POST /api/ia/desfecho
       perguntar(p)        → POST /api/ia/pergunta

   Toda resposta carrega `origem: 'regras-locais'`. Na fase 3 o campo vira
   `'modelo'`, e a tela pode dizer ao usuário de onde veio o texto — que é
   informação que ele merece ter.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }
  function assistente() { return App.domain.assistente; }

  var ORIGEM = 'regras-locais';

  /** Latência maior que a dos outros services: geração de texto demora. */
  function pensar(ms) {
    return App.services.http.delay(
      App.services.http.config.ativarLatencia ? (ms || 900) : 0);
  }

  function contextoDoProcesso(processoId) {
    var processo = db().find('processos', processoId);
    if (!processo) return null;

    return {
      processo: processo,
      cliente: processo.clienteId ? db().find('pessoas', processo.clienteId) : null,
      advogado: processo.responsavelId ? db().find('usuarios', processo.responsavelId) : null,
      andamentos: db().where('andamentos', function (a) {
        return a.processoId === processoId;
      }),
      prazos: db().where('prazos', function (p) { return p.processoId === processoId; }),
      compromissos: db().where('compromissos', function (c) {
        return c.processoId === processoId;
      }),
      documentos: db().where('documentos', function (d) { return d.processoId === processoId; }),
      historicoDaArea: db().where('processos', function (p) {
        return p.areaId === processo.areaId && p.id !== processoId;
      })
    };
  }

  /**
   * Painel do assistente no processo — resumo, próximas ações e risco.
   * Tudo vem da camada A; aqui só se junta e se declara a origem.
   */
  function analisarProcesso(processoId) {
    return http().requisicao(function () {
      var ctx = contextoDoProcesso(processoId);
      if (!ctx) throw http().ErroApi('Processo não encontrado.', 404);

      return {
        origem: ORIGEM,
        resumo: assistente().resumirProcesso(ctx),
        acoes: assistente().proximaAcao(ctx),
        risco: assistente().sugerirRisco(ctx),
        riscoCadastrado: ctx.processo.risco
      };
    });
  }

  /**
   * Gera a minuta de uma peça.
   *
   * O texto sai de um MODELO da biblioteca de F2.7, preenchido com os dados
   * do processo. Não há redação: há substituição de variáveis num texto que
   * um advogado escreveu. A tela diz isso.
   *
   * @param {object} p { processoId, modeloId, tipo, instrucoes }
   */
  function gerarPeca(p) {
    var dados = p || {};

    return pensar(1400).then(function () {
      return http().requisicao(function () {
        var processo = db().find('processos', dados.processoId);
        if (!processo) throw http().ErroApi('Processo não encontrado.', 404);

        var modelo = dados.modeloId
          ? db().find('modelosPeca', dados.modeloId)
          : escolherModelo(dados.tipo, processo.areaId);

        if (!modelo) {
          throw http().ErroApi(
            'Não há modelo de peça compatível na biblioteca. Cadastre um em Modelos.', 409);
        }

        var contexto = App.services.modeloPecaService.contextoDoProcesso(dados.processoId);
        var preenchido = App.domain.modelos.preencher(modelo.conteudoHtml, contexto);

        /* As instruções do usuário viram uma NOTA no topo, não texto
           redigido. Fingir que foram "compreendidas" seria exatamente a
           mentira que este arquivo existe para não contar. */
        var nota = dados.instrucoes
          ? '<p class="ia-nota"><em>Anotação do autor: ' +
            App.dom.esc(dados.instrucoes) + '</em></p>'
          : '';

        return {
          origem: ORIGEM,
          modelo: { id: modelo.id, nome: modelo.nome },
          html: nota + preenchido.html,
          resolvidas: preenchido.resolvidas,
          pendentes: preenchido.pendentes,
          aviso: 'Texto montado a partir do modelo "' + modelo.nome +
                 '" com os dados do processo. Não houve redação por modelo de linguagem.'
        };
      });
    });
  }

  /** Modelo mais adequado ao tipo pedido e à área do processo. */
  function escolherModelo(tipo, areaId) {
    var modelos = db().get('modelosPeca');

    var porTipoEArea = modelos.filter(function (m) {
      return (!tipo || m.tipo === tipo || m.categoria === tipo) && m.areaId === areaId;
    })[0];
    if (porTipoEArea) return porTipoEArea;

    var porTipo = modelos.filter(function (m) {
      return !tipo || m.tipo === tipo || m.categoria === tipo;
    })[0];
    return porTipo || null;
  }

  /**
   * Explica uma publicação do diário em linguagem direta.
   * A leitura vem do classificador de F2.4 — o mesmo dicionário que a fila
   * de triagem usa, só apresentado em frases.
   */
  function resumirPublicacao(p) {
    var dados = p || {};

    return pensar(700).then(function () {
      return http().requisicao(function () {
        var publicacao = db().find('publicacoes', dados.publicacaoId);
        if (!publicacao) throw http().ErroApi('Publicação não encontrada.', 404);

        var analise = App.domain.classificador.analisar(publicacao.textoIntegral);
        var sugestao = analise.sugestao;
        var enums = App.domain.enums;

        var frases = [];

        if (!sugestao.abrePrazo) {
          frases.push('Esta publicação NÃO parece abrir prazo.');
          if (sugestao.motivoSemPrazo) {
            frases.push('A expressão "' + sugestao.motivoSemPrazo +
                        '" indica ato de mero expediente.');
          }
        } else if (sugestao.tipoPrazoId) {
          var tipo = enums.achar(enums.TIPOS_PRAZO, sugestao.tipoPrazoId);
          frases.push('O ato exige ' + (tipo ? tipo.label.toLowerCase() : 'manifestação') +
                      ', com prazo de ' + sugestao.dias + ' dias ' +
                      (sugestao.tipoContagem === 'uteis' ? 'úteis' : 'corridos') + '.');
          if (sugestao.emDobro) frases.push('O texto menciona prazo em dobro (art. 229).');
          frases.push('A conclusão vem dos termos: ' + sugestao.termos.join(', ') + '.');
          frases.push('Confiança ' + sugestao.confianca + '.');
        } else {
          frases.push('Não foi possível identificar o ato a partir do texto.');
        }

        if (analise.numeroCnj) {
          var processo = App.services.publicacaoService.processoPorCnj(analise.numeroCnj);
          frases.push(processo
            ? 'O número ' + analise.numeroCnj + ' corresponde a processo do escritório.'
            : 'O número ' + analise.numeroCnj + ' não está cadastrado.');
        } else {
          frases.push('Nenhum número CNJ válido foi encontrado no texto.');
        }

        if (analise.advogados.length) {
          frases.push('Advogado(s) citado(s): ' +
            analise.advogados.map(function (a) { return a.nome; }).join(', ') + '.');
        }

        return {
          origem: ORIGEM,
          texto: frases.join(' '),
          frases: frases,
          analise: analise,
          aviso: 'Leitura feita por dicionário de termos, não por modelo de linguagem.'
        };
      });
    });
  }

  /**
   * Sugere o desfecho provável a partir do histórico do escritório.
   * Sem base suficiente, diz que não sabe — chutar seria pior.
   */
  function sugerirDesfecho(p) {
    var dados = p || {};

    return pensar(800).then(function () {
      return http().requisicao(function () {
        var ctx = contextoDoProcesso(dados.processoId);
        if (!ctx) throw http().ErroApi('Processo não encontrado.', 404);

        var risco = assistente().sugerirRisco(ctx);

        return {
          origem: ORIGEM,
          risco: risco,
          aviso: risco.confianca === 'insuficiente'
            ? 'Não há histórico suficiente nesta área para sugerir um desfecho.'
            : 'Heurística sobre o histórico do próprio escritório — não é previsão ' +
              'estatística nem jurisprudencial.'
        };
      });
    });
  }

  /**
   * Pergunta sobre o processo.
   *
   * Responde o que a REGRA sabe responder — prazo, fase, valor, documentos,
   * partes — e admite quando não sabe. Uma resposta inventada aqui seria
   * indistinguível de uma correta para quem pergunta, que é justamente o
   * risco que este arquivo se recusa a correr.
   */
  function perguntar(p) {
    var dados = p || {};
    var pergunta = String(dados.pergunta || '');

    return pensar(600).then(function () {
      return http().requisicao(function () {
        var ctx = contextoDoProcesso(dados.processoId);
        if (!ctx) throw http().ErroApi('Processo não encontrado.', 404);

        var resumo = assistente().resumirProcesso(ctx);
        var texto = App.domain.busca.normalizar(pergunta);

        function contem() {
          var termos = Array.prototype.slice.call(arguments);
          return termos.some(function (t) { return texto.indexOf(t) !== -1; });
        }

        /* FORA DO REPERTÓRIO, conferido ANTES de qualquer outra regra.
           Sem esta barreira, "qual a probabilidade de o STF mudar o
           entendimento sobre isso?" caía no ramo do resumo por conter a
           palavra "sobre" — e o assistente respondia com o histórico do
           processo, com toda a aparência de ter entendido a pergunta.
           Resposta confiante e errada é o pior desfecho possível aqui. */
        if (contem('jurisprud', 'stf', 'stj', 'entendimento', 'tese', 'sumula',
                   'probabilidade', 'chance', 'vou ganhar', 'vamos ganhar',
                   'prever', 'previsao', 'quanto tempo vai', 'quando termina',
                   'melhor estrategia', 'o que voce acha', 'opiniao')) {
          return responder(
            'Não sei responder isso. Análise de jurisprudência, previsão de resultado e ' +
            'estratégia dependem de um modelo de linguagem, que este protótipo não tem. ' +
            'Consigo falar sobre prazos, fase, valor da causa, audiências, documentos e partes.',
            false);
        }

        if (contem('prazo', 'vence', 'fatal')) {
          return responder(resumo.proximoPrazo
            ? 'O próximo prazo é "' + resumo.proximoPrazo.titulo + '", com data fatal em ' +
              App.format.data(resumo.proximoPrazo.dataFatal) + '. Há ' +
              resumo.prazosAbertos + ' prazo(s) em aberto.'
            : 'Não há prazo em aberto neste processo.');
        }

        if (contem('fase', 'situacao', 'status', 'andamento do processo')) {
          return responder('O processo está em ' +
            App.domain.enums.rotulo(App.domain.enums.FASES, ctx.processo.faseId).toLowerCase() +
            ', com ' + resumo.totalAndamentos + ' andamento(s)' +
            (resumo.diasSemMovimento !== null
              ? ' e sem movimentação há ' + resumo.diasSemMovimento + ' dia(s).' : '.'));
        }

        if (contem('valor', 'causa', 'quanto')) {
          return responder('O valor da causa é ' +
            App.format.moeda(ctx.processo.valorCausa) + '.');
        }

        if (contem('audiencia', 'compromisso', 'pericia')) {
          return responder(resumo.proximoCompromisso
            ? 'O próximo compromisso é ' + resumo.proximoCompromisso.titulo + ' em ' +
              App.format.dataHora(resumo.proximoCompromisso.dataHora) + '.'
            : 'Não há compromisso agendado.');
        }

        if (contem('documento', 'anexo', 'peca', 'procuracao')) {
          return responder('Há ' + resumo.totalDocumentos +
            ' documento(s) neste processo.');
        }

        if (contem('cliente', 'parte', 'autor', 'reu')) {
          return responder('O cliente é ' +
            (ctx.cliente ? ctx.cliente.nome : '—') + ', na posição de ' +
            App.domain.enums.rotulo(App.domain.enums.PAPEIS_CLIENTE,
                                    ctx.processo.papelCliente).toLowerCase() + '.');
        }

        /* "sobre" sozinho era gatilho e pegava pergunta demais — qualquer
           "o que você acha sobre X" virava resumo. Agora exige expressão
           que só aparece em pedido de resumo mesmo. */
        if (contem('resumo', 'resumir', 'historico', 'me conta', 'do que se trata',
                   'como esta o processo', 'situacao geral')) {
          return responder(resumo.texto);
        }

        /* Admitir que não sabe é a resposta mais valiosa deste arquivo. */
        return responder(
          'Não sei responder isso com as regras que tenho. Consigo falar sobre prazos, ' +
          'fase, valor da causa, audiências, documentos e partes.',
          false);
      });
    });

    function responder(texto, respondeu) {
      return {
        origem: ORIGEM,
        pergunta: pergunta,
        resposta: texto,
        respondeu: respondeu !== false,
        aviso: 'Resposta montada por regras sobre os dados do processo. Não há modelo ' +
               'de linguagem — quando a regra não cobre, o assistente diz que não sabe.'
      };
    }
  }

  /**
   * Revisa a peça antes do protocolo. Camada A pura, exposta pela mesma
   * fachada para a tela não precisar saber de onde vem.
   */
  function revisarDocumento(documentoId) {
    return http().requisicao(function () {
      var documento = db().find('documentos', documentoId);
      if (!documento) throw http().ErroApi('Documento não encontrado.', 404);

      var conteudo = App.services.conteudoService.ler(documentoId);
      if (!conteudo || !conteudo.conteudo) {
        return {
          origem: ORIGEM, achados: [], semTexto: true,
          aviso: 'Este documento não tem texto no sistema — nada a revisar.'
        };
      }

      var ctx = contextoDoProcesso(documento.processoId) || {};
      var achados = assistente().revisarPeca(conteudo.conteudo, ctx);

      return {
        origem: ORIGEM,
        achados: achados,
        criticos: achados.filter(function (a) { return a.gravidade === 'critica'; }).length,
        semTexto: false,
        aviso: 'Conferência por regras contra o cadastro do processo.'
      };
    });
  }

  App.services.iaService = {
    ORIGEM: ORIGEM,
    analisarProcesso: analisarProcesso,
    gerarPeca: gerarPeca,
    resumirPublicacao: resumirPublicacao,
    sugerirDesfecho: sugerirDesfecho,
    perguntar: perguntar,
    revisarDocumento: revisarDocumento
  };
})(window.App = window.App || {});
