/* ==========================================================================
   services/pastaDocumentoService.js — pastas da aba Documentos

       listar(filtros)      → GET    /api/pastas-documento?processoId=...
       criar(dados)         → POST   /api/pastas-documento
       renomear(id, nome)   → PATCH  /api/pastas-documento/:id
       mover(id, paiId)     → PATCH  /api/pastas-documento/:id
       remover(id)          → DELETE /api/pastas-documento/:id

   A pasta é apenas uma etiqueta hierárquica: o documento continua ligado ao
   processo por processoId e ganha pastaId (null = raiz). Assim nenhuma
   consulta existente muda de resultado por causa das pastas.

   Regra do projeto: nada se perde. remover() faz soft delete da pasta e
   PROMOVE o conteúdo (subpastas e documentos) para a pasta-mãe.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  var LIMITE_NOME = 60;

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function pastasDoProcesso(processoId) {
    return db().where('pastasDocumento', function (p) { return p.processoId === processoId; });
  }

  function normalizar(nome) {
    return String(nome || '').trim().replace(/\s+/g, ' ');
  }

  /**
   * Chave de comparação de nomes: sem caixa, sem acento e sem pontuação
   * ("Petições" = "peticoes"). O NFD separa o acento da letra e o filtro
   * ASCII descarta o acento solto.
   */
  function chaveNome(valor) {
    var limpo = normalizar(valor).toLowerCase();
    if (limpo.normalize) limpo = limpo.normalize('NFD');
    return limpo.replace(/[^a-z0-9 ]/g, '');
  }

  /** Duas pastas irmãs não podem ter o mesmo nome. */
  function mesmoNome(a, b) {
    return chaveNome(a) === chaveNome(b);
  }

  function validarNome(nome) {
    var limpo = normalizar(nome);
    if (!limpo) throw http().ErroApi('Informe o nome da pasta.', 422);
    if (limpo.length > LIMITE_NOME) {
      throw http().ErroApi('O nome da pasta deve ter no máximo ' + LIMITE_NOME + ' caracteres.', 422);
    }
    return limpo;
  }

  function garantirNomeLivre(lista, nome, paiId, ignorarId) {
    var conflito = lista.filter(function (p) {
      return (p.paiId || null) === (paiId || null) && p.id !== ignorarId && mesmoNome(p.nome, nome);
    })[0];

    if (conflito) {
      throw http().ErroApi('Já existe uma pasta chamada “' + conflito.nome + '” neste nível.', 409);
    }
  }

  /** Ids da pasta e de tudo abaixo dela — base da checagem de ciclo. */
  function idsDaSubarvore(lista, raizId) {
    var ids = [raizId];
    var fronteira = [raizId];

    while (fronteira.length) {
      var atual = fronteira.pop();
      lista.forEach(function (p) {
        if (p.paiId === atual && ids.indexOf(p.id) === -1) {
          ids.push(p.id);
          fronteira.push(p.id);
        }
      });
    }
    return ids;
  }

  /** Do ancestral mais alto até a própria pasta — alimenta o breadcrumb. */
  function caminhoDe(lista, pastaId) {
    var porId = {};
    lista.forEach(function (p) { porId[p.id] = p; });

    var caminho = [];
    var atual = porId[pastaId];
    var guarda = 0;

    while (atual && guarda++ < 50) {
      caminho.unshift(atual);
      atual = atual.paiId ? porId[atual.paiId] : null;
    }
    return caminho;
  }

  /**
   * Contagem própria e acumulada de cada pasta. A acumulada é o que o
   * advogado espera ver na linha da pasta fechada ("tem 4 arquivos aí").
   *
   * Função PURA, exportada como resumir(): a tela de detalhe do processo já
   * recebe pastas e documentos em obter() e chama isto sem nova requisição.
   */
  function enriquecerLista(pastas, documentos) {
    var diretos = {};
    pastas.forEach(function (p) { diretos[p.id] = { docs: 0, subpastas: 0 }; });

    documentos.forEach(function (d) {
      if (d.pastaId && diretos[d.pastaId]) diretos[d.pastaId].docs++;
    });
    pastas.forEach(function (p) {
      if (p.paiId && diretos[p.paiId]) diretos[p.paiId].subpastas++;
    });

    return pastas.map(function (pasta) {
      var subarvore = idsDaSubarvore(pastas, pasta.id);
      var totalDocs = documentos.filter(function (d) {
        return d.pastaId && subarvore.indexOf(d.pastaId) !== -1;
      }).length;

      return Object.assign({}, pasta, {
        totalDocumentos: diretos[pasta.id].docs,
        totalSubpastas: diretos[pasta.id].subpastas,
        totalDocumentosRecursivo: totalDocs,
        caminho: caminhoDe(pastas, pasta.id).map(function (p) { return p.nome; }).join(' / ')
      });
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
  }

  function listar(filtros) {
    return http().requisicao(function () {
      var f = filtros || {};
      if (!f.processoId) throw http().ErroApi('processoId é obrigatório.', 422);

      var pastas = pastasDoProcesso(f.processoId);
      var documentos = db().where('documentos', function (d) {
        return d.processoId === f.processoId;
      });

      var lista = enriquecerLista(pastas, documentos);
      if (f.paiId !== undefined) {
        lista = lista.filter(function (p) { return (p.paiId || null) === (f.paiId || null); });
      }

      return { itens: lista, total: lista.length };
    });
  }

  function criar(dados) {
    return http().requisicao(function () {
      var d = dados || {};
      if (!d.processoId) throw http().ErroApi('processoId é obrigatório.', 422);

      var nome = validarNome(d.nome);
      var lista = pastasDoProcesso(d.processoId);
      var paiId = d.paiId || null;

      if (paiId && !lista.filter(function (p) { return p.id === paiId; })[0]) {
        throw http().ErroApi('Pasta de destino não encontrada.', 404);
      }
      garantirNomeLivre(lista, nome, paiId, null);

      return db().insert('pastasDocumento', {
        processoId: d.processoId,
        nome: nome,
        paiId: paiId,
        criadoPorId: d.criadoPorId || null
      }, 'PST');
    });
  }

  function renomear(id, nome) {
    return http().requisicao(function () {
      var pasta = db().find('pastasDocumento', id);
      if (!pasta) throw http().ErroApi('Pasta não encontrada.', 404);

      var limpo = validarNome(nome);
      garantirNomeLivre(pastasDoProcesso(pasta.processoId), limpo, pasta.paiId, id);

      return db().update('pastasDocumento', id, { nome: limpo });
    });
  }

  /** @param {string|null} paiId  null move a pasta para a raiz do processo. */
  function mover(id, paiId) {
    return http().requisicao(function () {
      var pasta = db().find('pastasDocumento', id);
      if (!pasta) throw http().ErroApi('Pasta não encontrada.', 404);

      var destino = paiId || null;
      if (destino === (pasta.paiId || null)) return pasta;   // já está lá
      if (destino === id) throw http().ErroApi('Uma pasta não pode conter a si mesma.', 422);

      var lista = pastasDoProcesso(pasta.processoId);

      if (destino) {
        var pai = lista.filter(function (p) { return p.id === destino; })[0];
        if (!pai) throw http().ErroApi('Pasta de destino não encontrada.', 404);
        // Mover para dentro da própria descendência criaria um ciclo.
        if (idsDaSubarvore(lista, id).indexOf(destino) !== -1) {
          throw http().ErroApi('Não é possível mover uma pasta para dentro dela mesma.', 422);
        }
      }

      garantirNomeLivre(lista, pasta.nome, destino, id);
      return db().update('pastasDocumento', id, { paiId: destino });
    });
  }

  /**
   * Soft delete da pasta. O conteúdo direto sobe um nível — documento de
   * processo não desaparece porque alguém apagou a pasta errada.
   */
  function remover(id) {
    return http().requisicao(function () {
      var pasta = db().find('pastasDocumento', id);
      if (!pasta) throw http().ErroApi('Pasta não encontrada.', 404);

      var destino = pasta.paiId || null;

      var subpastas = db().where('pastasDocumento', function (p) { return p.paiId === id; });
      subpastas.forEach(function (sub) {
        db().update('pastasDocumento', sub.id, { paiId: destino });
      });

      var documentos = db().where('documentos', function (d) { return d.pastaId === id; });
      documentos.forEach(function (doc) {
        db().update('documentos', doc.id, { pastaId: destino });
      });

      db().remove('pastasDocumento', id);

      return {
        id: id,
        paiId: destino,
        documentosRealocados: documentos.length,
        subpastasRealocadas: subpastas.length
      };
    });
  }

  /**
   * Árvore achatada e indentada — usada nos <select> de "mover para".
   * Aceita ignorarId para não oferecer a própria pasta (nem sua descendência)
   * como destino de si mesma.
   */
  function opcoesDestino(processoId, ignorarId) {
    var lista = pastasDoProcesso(processoId);
    var proibidos = ignorarId ? idsDaSubarvore(lista, ignorarId) : [];
    var resultado = [];

    function descer(paiId, nivel) {
      lista.filter(function (p) { return (p.paiId || null) === (paiId || null); })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); })
        .forEach(function (p) {
          if (proibidos.indexOf(p.id) !== -1) return;
          resultado.push({ id: p.id, label: '— '.repeat(nivel) + p.nome, nivel: nivel });
          descer(p.id, nivel + 1);
        });
    }

    descer(null, 0);
    return resultado;
  }

  App.services.pastaDocumentoService = {
    listar: listar,
    resumir: enriquecerLista,
    criar: criar,
    renomear: renomear,
    mover: mover,
    remover: remover,
    opcoesDestino: opcoesDestino,
    caminhoDe: caminhoDe,
    idsDaSubarvore: idsDaSubarvore
  };
})(window.App = window.App || {});
