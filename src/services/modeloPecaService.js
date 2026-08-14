/* ==========================================================================
   services/modeloPecaService.js — biblioteca de modelos de peça

   Guarda o modelo, monta o contexto a partir do processo e cria o documento
   já preenchido dentro dele. O preenchimento em si é `domain/modelos.js`.

   Um documento gerado a partir de modelo nasce no editor com as variáveis
   resolvidas e as pendentes DESTACADAS — nunca com `{{...}}` cru nem com o
   campo apagado em silêncio.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function enriquecer(m) {
    var enums = App.domain.enums;
    var variaveis = App.domain.modelos.listarVariaveis(m.conteudoHtml);

    return Object.assign({}, m, {
      variaveis: variaveis,
      totalVariaveis: variaveis.length,
      desconhecidas: App.domain.modelos.variaveisDesconhecidas(m.conteudoHtml),
      areaLabel: m.areaId ? enums.rotulo(enums.AREAS, m.areaId) : 'Todas as áreas',
      autor: m.criadoPorId ? db().find('usuarios', m.criadoPorId) : null
    });
  }

  function listar(f) {
    return http().requisicao(function () {
      var filtros = f || {};

      return db().get('modelosPeca')
        .map(enriquecer)
        .filter(function (m) {
          if (filtros.tipo && m.tipo !== filtros.tipo) return false;
          if (filtros.areaId && m.areaId && m.areaId !== filtros.areaId) return false;
          if (filtros.busca) {
            var termo = String(filtros.busca).toLowerCase();
            var alvo = (m.nome + ' ' + (m.categoria || '')).toLowerCase();
            if (alvo.indexOf(termo) === -1) return false;
          }
          return true;
        })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    });
  }

  function obter(id) {
    return http().requisicao(function () {
      var m = db().find('modelosPeca', id);
      if (!m) throw http().ErroApi('Modelo não encontrado.', 404);
      return enriquecer(m);
    });
  }

  function criar(dados) {
    return http().requisicao(function () {
      var nome = String(dados.nome || '').trim();
      if (!nome) throw http().ErroApi('Dê um nome ao modelo.', 400);
      if (!String(dados.conteudoHtml || '').trim()) {
        throw http().ErroApi('O modelo não pode ficar vazio.', 400);
      }

      var usuario = App.store.getState().usuarioAtual;

      return enriquecer(db().insert('modelosPeca', {
        nome: nome,
        categoria: dados.categoria || 'outro',
        areaId: dados.areaId || null,
        tipo: dados.tipo || 'peticao',
        conteudoHtml: dados.conteudoHtml,
        criadoPorId: usuario ? usuario.id : null,
        publico: dados.publico !== false
      }, 'MOD'));
    });
  }

  function atualizar(id, alteracoes) {
    return http().requisicao(function () {
      var atualizado = db().update('modelosPeca', id, alteracoes);
      if (!atualizado) throw http().ErroApi('Modelo não encontrado.', 404);
      return enriquecer(atualizado);
    });
  }

  function remover(id) {
    return http().requisicao(function () {
      if (!db().remove('modelosPeca', id)) {
        throw http().ErroApi('Modelo não encontrado.', 404);
      }
      return { id: id };
    });
  }

  /**
   * Contexto de preenchimento a partir de um processo.
   * Reúne processo, cliente, responsável, parte contrária e contrato — é o
   * que as variáveis do catálogo sabem consumir.
   */
  function contextoDoProcesso(processoId) {
    var processo = db().find('processos', processoId);
    if (!processo) return App.domain.modelos.montarContexto({});

    var cliente = processo.clienteId ? db().find('pessoas', processo.clienteId) : null;
    var advogado = processo.responsavelId ? db().find('usuarios', processo.responsavelId) : null;
    var contrato = db().where('contratos', function (c) {
      return c.processoId === processoId;
    })[0] || null;

    // Parte contrária: o primeiro do polo oposto ao do cliente.
    var poloCliente = App.domain.enums.achar(
      App.domain.enums.PAPEIS_CLIENTE, processo.papelCliente);
    var partes = db().where('partesProcesso', function (p) {
      return p.processoId === processoId;
    });
    var contraria = partes.filter(function (p) {
      return poloCliente && p.polo && p.polo !== poloCliente.polo;
    })[0];
    var pessoaContraria = contraria ? db().find('pessoas', contraria.pessoaId) : null;

    return App.domain.modelos.montarContexto({
      processo: processo,
      cliente: cliente,
      advogado: advogado,
      contrato: contrato,
      parteContraria: pessoaContraria ? pessoaContraria.nome : ''
    });
  }

  /** Prévia do preenchimento — o que a tela mostra antes de criar. */
  function previa(modeloId, processoId) {
    return http().requisicao(function () {
      var modelo = db().find('modelosPeca', modeloId);
      if (!modelo) throw http().ErroApi('Modelo não encontrado.', 404);

      var contexto = contextoDoProcesso(processoId);
      var resultado = App.domain.modelos.preencher(modelo.conteudoHtml, contexto);

      return {
        modelo: enriquecer(modelo),
        contexto: contexto,
        html: resultado.html,
        resolvidas: resultado.resolvidas,
        pendentes: resultado.pendentes
      };
    });
  }

  /**
   * Cria o documento no processo, já preenchido.
   *
   * O documento nasce como `.html` em modo rico — é o formato que o editor
   * de texto formatado da fase 1 abre, e o que preserva a formatação da
   * peça. Exportar para `.rtf` (que abre no Word) continua disponível.
   */
  function gerarDocumento(dados) {
    var d = dados || {};

    return previa(d.modeloId, d.processoId).then(function (r) {
      return App.services.documentoService.criarEmBranco({
        processoId: d.processoId,
        pastaId: d.pastaId || null,
        nome: d.nome || r.modelo.nome,
        formato: 'html',
        categoria: d.categoria || r.modelo.categoria || 'outro',
        uploadPorId: (App.store.getState().usuarioAtual || {}).id || null,
        visivelCliente: false
      }).then(function (documento) {
        App.services.conteudoService.salvar(documento.id, {
          modo: 'rico',
          conteudo: r.html,
          atualizadoPorId: (App.store.getState().usuarioAtual || {}).id || null
        });

        App.services.auditoriaService.registrar({
          acao: 'criar',
          colecao: 'documentos',
          entidadeId: documento.id,
          resumo: 'Documento gerado a partir do modelo "' + r.modelo.nome + '"'
        });

        return {
          documento: documento,
          pendentes: r.pendentes,
          resolvidas: r.resolvidas
        };
      });
    });
  }

  App.services.modeloPecaService = {
    listar: listar,
    obter: obter,
    criar: criar,
    atualizar: atualizar,
    remover: remover,
    previa: previa,
    gerarDocumento: gerarDocumento,
    contextoDoProcesso: contextoDoProcesso,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
