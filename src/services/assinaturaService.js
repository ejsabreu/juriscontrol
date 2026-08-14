/* ==========================================================================
   services/assinaturaService.js — assinatura e trilha de acesso ao documento

   SIMULADO, e a tela diz com todas as letras: não há ICP-Brasil, não há
   certificado A1 ou A3, não há carimbo do tempo. Assinatura digital de
   verdade exige chave privada em token ou HSM — coisa que não existe em
   navegador sem servidor.

   O QUE É REAL, e por isso vale existir:
     · o HASH do conteúdo no momento da assinatura. Se o texto for alterado
       depois, `conferir()` acusa — que é exatamente a propriedade que uma
       assinatura entrega. Falta o que prova QUEM assinou, não o que prova
       que o texto não mudou.
     · a TRILHA DE ACESSO: quem viu, quem baixou, quem editou, e quando.
       Isso não depende de criptografia nenhuma e é o que o escritório
       precisa quando um documento sigiloso aparece onde não devia.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  /** Hash do conteúdo atual do documento — a base da conferência. */
  function hashDoConteudo(documentoId) {
    var conteudo = App.services.conteudoService.ler(documentoId);
    var documento = db().find('documentos', documentoId);

    /* Documento sem texto (só metadado, ou binário que o protótipo não
       persiste) é assinado pela ficha: nome, versão e tamanho. É o que há —
       e dizer isso é melhor que assinar uma string vazia como se fosse o
       arquivo. */
    var base = conteudo && conteudo.conteudo
      ? conteudo.conteudo
      : [documento && documento.nome, documento && documento.versao,
         documento && documento.tamanhoBytes].join('|');

    return {
      hash: App.token.hashLongo(base),
      sobreConteudo: !!(conteudo && conteudo.conteudo),
      bytes: base.length
    };
  }

  function enriquecer(a) {
    var signatario = a.signatarioId ? db().find('usuarios', a.signatarioId) : null;
    var conferencia = hashDoConteudo(a.documentoId);

    return Object.assign({}, a, {
      signatario: signatario,
      signatarioNome: signatario ? signatario.nome : '—',
      // A verificação é feita NA LEITURA: o documento pode ter sido editado
      // depois de assinado, e é justamente isso que precisa aparecer.
      integra: conferencia.hash === a.hash,
      hashAtual: conferencia.hash
    });
  }

  function listar(documentoId) {
    return http().requisicao(function () {
      return db().where('assinaturas', function (a) {
        return !documentoId || a.documentoId === documentoId;
      })
        .map(enriquecer)
        .sort(function (a, b) { return a.assinadoEm < b.assinadoEm ? 1 : -1; });
    });
  }

  function assinar(documentoId, opcoes) {
    return http().requisicao(function () {
      var documento = db().find('documentos', documentoId);
      if (!documento) throw http().ErroApi('Documento não encontrado.', 404);

      var usuario = App.store.getState().usuarioAtual;
      if (!usuario) throw http().ErroApi('É preciso estar autenticado para assinar.', 401);

      var jaAssinou = db().where('assinaturas', function (a) {
        return a.documentoId === documentoId && a.signatarioId === usuario.id;
      })[0];
      if (jaAssinou) {
        throw http().ErroApi('Você já assinou este documento.', 409);
      }

      var conferencia = hashDoConteudo(documentoId);

      var assinatura = db().insert('assinaturas', {
        documentoId: documentoId,
        signatarioId: usuario.id,
        tipo: 'eletronica_simulada',
        assinadoEm: new Date().toISOString(),
        hash: conferencia.hash,
        sobreConteudo: conferencia.sobreConteudo,
        versaoDocumento: documento.versao,
        certificado: null,
        observacao: (opcoes || {}).observacao || null
      }, 'ASS');

      App.services.auditoriaService.registrar({
        acao: 'criar',
        colecao: 'assinaturas',
        entidadeId: assinatura.id,
        resumo: 'Documento assinado: ' + documento.nome
      });

      return enriquecer(assinatura);
    });
  }

  /**
   * Confere as assinaturas de um documento.
   * Assinatura cujo hash não bate com o conteúdo atual é sinalizada como
   * QUEBRADA — o documento foi alterado depois de assinado.
   */
  function conferir(documentoId) {
    return http().requisicao(function () {
      var assinaturas = db().where('assinaturas', function (a) {
        return a.documentoId === documentoId;
      }).map(enriquecer);

      var quebradas = assinaturas.filter(function (a) { return !a.integra; });

      return {
        total: assinaturas.length,
        integras: assinaturas.length - quebradas.length,
        quebradas: quebradas.length,
        alterado: quebradas.length > 0,
        assinaturas: assinaturas
      };
    });
  }

  // --- Trilha de acesso ao documento ---------------------------------------------

  /**
   * Registra quem tocou no documento. Síncrono e silencioso: é efeito
   * colateral de abrir ou baixar, e não pode atrasar nem quebrar a ação
   * principal se falhar.
   *
   * @param {string} acao  'ver' | 'baixar' | 'editar'
   */
  function registrarAcesso(documentoId, acao, extras) {
    try {
      var usuario = App.store.getState().usuarioAtual;
      var e = extras || {};

      db().insert('acessosDocumento', {
        documentoId: documentoId,
        usuarioId: usuario ? usuario.id : null,
        linkCompartilhadoId: e.linkCompartilhadoId || null,
        acao: acao || 'ver',
        quando: new Date().toISOString(),
        origem: e.origem || (usuario ? 'sistema' : 'portal')
      }, 'ACD');
    } catch (erro) {
      console.warn('[assinatura] Falha ao registrar acesso:', erro.message);
    }
  }

  function acessos(documentoId) {
    return http().requisicao(function () {
      var usuarios = db().get('usuarios');

      return db().where('acessosDocumento', function (a) {
        return a.documentoId === documentoId;
      })
        .map(function (a) {
          var u = usuarios.filter(function (x) { return x.id === a.usuarioId; })[0];
          return Object.assign({}, a, {
            usuario: u,
            usuarioNome: u ? u.nome : (a.origem === 'portal' ? 'Cliente (portal)' : '—')
          });
        })
        .sort(function (a, b) { return a.quando < b.quando ? 1 : -1; });
    });
  }

  /** Contadores para a linha do explorador e o rodapé do visor. */
  function resumoAcessos(documentoId) {
    var todos = db().where('acessosDocumento', function (a) {
      return a.documentoId === documentoId;
    });

    function contar(acao) {
      return todos.filter(function (a) { return a.acao === acao; }).length;
    }

    return {
      total: todos.length,
      visualizacoes: contar('ver'),
      downloads: contar('baixar'),
      edicoes: contar('editar'),
      peloPortal: todos.filter(function (a) { return a.origem === 'portal'; }).length,
      ultimo: todos.sort(function (a, b) { return a.quando < b.quando ? 1 : -1; })[0] || null
    };
  }

  App.services.assinaturaService = {
    assinar: assinar,
    listar: listar,
    conferir: conferir,
    registrarAcesso: registrarAcesso,
    acessos: acessos,
    resumoAcessos: resumoAcessos,
    hashDoConteudo: hashDoConteudo
  };
})(window.App = window.App || {});
