/* ==========================================================================
   services/publicacaoService.js — fila de triagem do diário

   Fecha o ciclo do sistema: publicação → prazo → responsável avisado.

   O encaixe com a fase 1 é direto e não por acaso: `dataDisponibilizacao` da
   publicação é exatamente o campo de entrada de `domain/prazos.calcular()`.
   O motor já sabia contar a partir da disponibilização no DJe (art. 224 §2º);
   faltava quem lhe entregasse a data.

   MIGRAÇÃO:
       listar()      → GET  /api/publicacoes
       vincular()    → PATCH /api/publicacoes/:id
       gerarPrazo()  → POST /api/publicacoes/:id/prazo
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }
  function classificador() { return App.domain.classificador; }

  /** Junta a análise do texto ao registro — a tela mostra os dois lado a lado. */
  function enriquecer(pub, contexto) {
    var ctx = contexto || { processos: db().get('processos'), usuarios: db().get('usuarios') };

    var processo = pub.processoId
      ? ctx.processos.filter(function (p) { return p.id === pub.processoId; })[0] || null
      : null;

    var analise = classificador().analisar(pub.textoIntegral);

    return Object.assign({}, pub, {
      processo: processo,
      processoNumero: processo ? processo.numeroCnj : null,
      triadaPor: pub.triadaPorId
        ? ctx.usuarios.filter(function (u) { return u.id === pub.triadaPorId; })[0] || null
        : null,
      analise: analise,
      sugestao: analise.sugestao
    });
  }

  /**
   * Processo do escritório correspondente ao CNJ detectado no texto.
   * Devolve null quando o número não é de processo cadastrado — que é o caso
   * em que a tela oferece "cadastrar processo a partir da publicação".
   */
  function processoPorCnj(numeroCnj) {
    if (!numeroCnj) return null;
    var alvo = String(numeroCnj).replace(/\D/g, '');
    return db().get('processos').filter(function (p) {
      return String(p.numeroCnj).replace(/\D/g, '') === alvo;
    })[0] || null;
  }

  /**
   * @param {object} f  status, tribunalId, busca, processoId, semVinculo,
   *                    pagina, porPagina
   */
  function listar(f) {
    return http().requisicao(function () {
      var filtros = f || {};
      var contexto = { processos: db().get('processos'), usuarios: db().get('usuarios') };

      var lista = db().get('publicacoes')
        .map(function (p) { return enriquecer(p, contexto); })
        .filter(function (p) {
          if (filtros.status && p.status !== filtros.status) return false;
          if (filtros.tribunalId && p.tribunalId !== filtros.tribunalId) return false;
          if (filtros.processoId && p.processoId !== filtros.processoId) return false;
          if (filtros.semVinculo && p.processoId) return false;

          if (filtros.busca) {
            var termo = String(filtros.busca).toLowerCase();
            var alvo = (p.textoIntegral + ' ' + (p.numeroCnjDetectado || '') + ' ' +
                        (p.diario || '')).toLowerCase();
            if (alvo.indexOf(termo) === -1) return false;
          }
          return true;
        })
        .sort(function (a, b) {
          // Mais recente primeiro; a fila é lida de cima para baixo.
          if (a.dataDisponibilizacao !== b.dataDisponibilizacao) {
            return a.dataDisponibilizacao < b.dataDisponibilizacao ? 1 : -1;
          }
          return a.id < b.id ? -1 : 1;
        });

      var total = lista.length;
      var pagina = filtros.pagina || 1;
      var porPagina = filtros.porPagina || total || 1;
      var inicio = (pagina - 1) * porPagina;

      return {
        itens: filtros.porPagina ? lista.slice(inicio, inicio + porPagina) : lista,
        total: total,
        pagina: pagina,
        totalPaginas: Math.max(1, Math.ceil(total / porPagina))
      };
    });
  }

  function obter(id) {
    return http().requisicao(function () {
      var pub = db().find('publicacoes', id);
      if (!pub) throw http().ErroApi('Publicação não encontrada.', 404);
      return enriquecer(pub);
    });
  }

  /** Contadores da fila — alimentam as abas da tela e o aviso do sino. */
  function resumo() {
    var todas = db().get('publicacoes');
    function contar(status) {
      return todas.filter(function (p) { return p.status === status; }).length;
    }

    // Quem decide o que é pendente é o catálogo, não esta soma: o avaliador de
    // alertas lê a mesma marca, e é assim que a fila e o sino contam igual.
    var pendentes = App.domain.enums.statusPendentesPublicacao()
      .reduce(function (soma, status) { return soma + contar(status); }, 0);

    return {
      total: todas.length,
      novas: contar('nova'),
      vinculadas: contar('vinculada'),
      triadas: contar('triada'),
      semVinculo: contar('sem_vinculo'),
      descartadas: contar('descartada'),
      pendentes: pendentes
    };
  }

  function vincular(id, processoId) {
    return http().requisicao(function () {
      var pub = db().find('publicacoes', id);
      if (!pub) throw http().ErroApi('Publicação não encontrada.', 404);

      var processo = db().find('processos', processoId);
      if (!processo) throw http().ErroApi('Processo não encontrado.', 404);

      return enriquecer(db().update('publicacoes', id, {
        processoId: processoId,
        status: 'vinculada'
      }));
    });
  }

  function descartar(id, motivo) {
    return http().requisicao(function () {
      var usuario = App.store.getState().usuarioAtual;
      var atualizada = db().update('publicacoes', id, {
        status: 'descartada',
        motivoDescarte: motivo || null,
        triadaPorId: usuario ? usuario.id : null,
        triadaEm: new Date().toISOString()
      });
      if (!atualizada) throw http().ErroApi('Publicação não encontrada.', 404);
      return enriquecer(atualizada);
    });
  }

  function marcarSemVinculo(id) {
    return http().requisicao(function () {
      var atualizada = db().update('publicacoes', id, { status: 'sem_vinculo' });
      if (!atualizada) throw http().ErroApi('Publicação não encontrada.', 404);
      return enriquecer(atualizada);
    });
  }

  /**
   * O ato central do módulo: publicação vira PRAZO.
   *
   * Encadeia, nesta ordem:
   *   1. o motor de prazos calcula as datas a partir da disponibilização;
   *   2. nasce o Andamento do tipo 'publicacao' com o texto integral;
   *   3. nasce o Prazo, com `andamentoOrigemId` apontando para ele — a
   *      rastreabilidade que o modelo da fase 1 já previa e ninguém usava;
   *   4. a publicação é marcada como triada;
   *   5. o avaliador de alertas (F2.2) é acionado, e o responsável fica
   *      sabendo sem que ninguém precise avisar.
   *
   * @param {object} ajustes  { tipoPrazoId, dias, tipoContagem, dobro,
   *                            responsavelId, diasAntecedencia, visivelCliente }
   */
  function gerarPrazo(id, ajustes) {
    return http().requisicao(function () {
      var pub = db().find('publicacoes', id);
      if (!pub) throw http().ErroApi('Publicação não encontrada.', 404);
      if (!pub.processoId) {
        throw http().ErroApi('Vincule a publicação a um processo antes de gerar o prazo.', 409);
      }
      if (pub.prazoGeradoId) {
        throw http().ErroApi('Esta publicação já gerou prazo.', 409);
      }

      var processo = db().find('processos', pub.processoId);
      if (!processo) throw http().ErroApi('Processo não encontrado.', 404);

      var a = ajustes || {};
      var sugestao = classificador().classificar(pub.textoIntegral);

      var tipoPrazoId = a.tipoPrazoId || sugestao.tipoPrazoId || 'custom';
      var tipo = App.domain.enums.achar(App.domain.enums.TIPOS_PRAZO, tipoPrazoId);
      var dias = a.dias || sugestao.dias || (tipo ? tipo.dias : 15);

      var calculo = App.domain.prazos.calcular({
        dataDisponibilizacao: pub.dataDisponibilizacao,
        dias: dias,
        tipoContagem: a.tipoContagem || (tipo ? tipo.contagem : 'uteis'),
        diasAntecedencia: a.diasAntecedencia || 3,
        dobro: !!a.dobro || !!sugestao.emDobro
      });

      // O andamento nasce ANTES do prazo, porque o prazo aponta para ele.
      var andamento = db().insert('andamentos', {
        processoId: processo.id,
        data: calculo.dataPublicacao || pub.dataDisponibilizacao,
        tipo: 'publicacao',
        titulo: 'Publicação no ' + (pub.diario || 'diário oficial'),
        descricao: pub.textoIntegral,
        origem: 'publicacao',
        visivelCliente: a.visivelCliente !== undefined ? !!a.visivelCliente : true,
        autorId: a.responsavelId || processo.responsavelId,
        documentosIds: []
      }, 'AND');

      var prazo = db().insert('prazos', {
        processoId: processo.id,
        titulo: tipo ? tipo.label : 'Prazo',
        tipoPrazoId: tipoPrazoId,
        tipoContagem: calculo.tipoContagem,
        quantidadeDias: calculo.diasEfetivos,
        dataDisponibilizacao: calculo.dataDisponibilizacao,
        dataPublicacao: calculo.dataPublicacao,
        dataInicioContagem: calculo.dataInicioContagem,
        dataFatal: calculo.dataFatal,
        dataInterna: calculo.dataInterna,
        diasAntecedencia: calculo.diasAntecedencia,
        responsavelId: a.responsavelId || processo.responsavelId,
        prioridade: dias <= 5 ? 'alta' : 'media',
        status: 'pendente',
        dataCumprimento: null,
        observacoes: 'Gerado a partir de publicação do diário.',
        andamentoOrigemId: andamento.id,
        visivelCliente: false,
        conferidoPorId: null, conferidoEm: null,
        cumpridoPorId: null, motivoPerda: null
      }, 'PRZ');

      var usuario = App.store.getState().usuarioAtual;
      db().update('publicacoes', id, {
        status: 'triada',
        prazoGeradoId: prazo.id,
        andamentoGeradoId: andamento.id,
        triadaPorId: usuario ? usuario.id : null,
        triadaEm: new Date().toISOString()
      });

      // O responsável precisa saber hoje, não na próxima vez que abrir a tela.
      if (App.services.notificacaoService) {
        App.services.notificacaoService.sincronizar();
      }

      return {
        prazo: Object.assign({}, prazo, App.domain.prazos.avaliar(prazo)),
        andamento: andamento,
        calculo: calculo,
        publicacao: enriquecer(db().find('publicacoes', id))
      };
    });
  }

  /**
   * Vínculo automático por CNJ, aplicado em lote.
   * Publicação cujo número não bate com processo do escritório vira
   * `sem_vinculo` — e não fica escondida como se fosse ruído.
   */
  function vincularAutomaticamente() {
    return http().requisicao(function () {
      var vinculadas = 0;
      var semVinculo = 0;

      db().get('publicacoes').forEach(function (pub) {
        if (pub.status !== 'nova' || pub.processoId) return;

        var numero = pub.numeroCnjDetectado || classificador().extrairCnj(pub.textoIntegral);
        var processo = processoPorCnj(numero);

        if (processo) {
          db().update('publicacoes', pub.id, {
            processoId: processo.id,
            numeroCnjDetectado: numero,
            status: 'vinculada'
          });
          vinculadas++;
        } else {
          db().update('publicacoes', pub.id, {
            numeroCnjDetectado: numero,
            status: 'sem_vinculo'
          });
          semVinculo++;
        }
      });

      return { vinculadas: vinculadas, semVinculo: semVinculo };
    });
  }

  App.services.publicacaoService = {
    listar: listar,
    obter: obter,
    resumo: resumo,
    vincular: vincular,
    descartar: descartar,
    marcarSemVinculo: marcarSemVinculo,
    gerarPrazo: gerarPrazo,
    vincularAutomaticamente: vincularAutomaticamente,
    processoPorCnj: processoPorCnj,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
