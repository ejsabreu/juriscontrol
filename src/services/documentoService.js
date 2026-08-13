/* ==========================================================================
   services/documentoService.js
       listar(filtros)  → GET   /api/documentos?...
       criar(dados)     → POST  /api/documentos   (só metadados)
       enviar(dados)    → POST  /api/documentos   (multipart, com progresso)
       mover(id,pastaId)→ PATCH /api/documentos/:id

   O banco guarda apenas METADADOS. O envio é SIMULADO: os dados do arquivo
   (nome, tamanho, tipo) são reais, extraídos do <input type="file">, mas o
   binário não é persistido — fica em memória no arquivoService, só durante
   a sessão.

   Na migração, enviar() monta FormData, http().upload passa a ser XHR com
   upload.onprogress e o backend devolve a URL do arquivo.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  /* Teto por arquivo. Existe para a tela exercitar a recusa de upload — o
     valor real vem da configuração do backend na fase 2. */
  var LIMITE_UPLOAD_BYTES = 25 * 1024 * 1024;

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function enriquecer(documento, ctx) {
    var contexto = ctx || {
      usuarios: db().get('usuarios'),
      processos: db().get('processos')
    };

    var autor = contexto.usuarios.filter(function (u) { return u.id === documento.uploadPorId; })[0] || null;
    var processo = contexto.processos.filter(function (p) { return p.id === documento.processoId; })[0] || null;
    var editor = documento.editadoPorId
      ? (contexto.usuarios.filter(function (u) { return u.id === documento.editadoPorId; })[0] || null)
      : null;

    return Object.assign({}, documento, {
      uploadPor: autor,
      uploadPorNome: autor ? autor.nome : '—',
      editadoPor: editor,
      editadoPorNome: editor ? editor.nome : null,
      processo: processo,
      processoNumero: processo ? processo.numeroInterno : null,
      categoriaLabel: App.domain.enums.rotulo(
        App.domain.enums.CATEGORIAS_DOCUMENTO, documento.categoria, 'Outro')
    });
  }

  function listar(filtros) {
    return http().requisicao(function () {
      var f = filtros || {};
      var contexto = {
        usuarios: db().get('usuarios'),
        processos: db().get('processos')
      };

      var lista = db().get('documentos').map(function (d) { return enriquecer(d, contexto); });

      lista = lista.filter(function (d) {
        if (f.processoId && d.processoId !== f.processoId) return false;
        if (f.clienteId && d.clienteId !== f.clienteId) return false;
        if (f.categoria && d.categoria !== f.categoria) return false;
        // pastaId: null filtra a raiz — por isso a checagem é por undefined.
        if (f.pastaId !== undefined && (d.pastaId || null) !== (f.pastaId || null)) return false;
        if (f.apenasVisiveisCliente && !d.visivelCliente) return false;
        if (f.busca && d.nome.toLowerCase().indexOf(String(f.busca).toLowerCase()) === -1) return false;
        return true;
      });

      lista.sort(function (a, b) { return a.uploadEm < b.uploadEm ? 1 : -1; });

      return { itens: lista, total: lista.length };
    });
  }

  function criar(dados) {
    return http().requisicao(function () {
      return enriquecer(db().insert('documentos', Object.assign({
        categoria: 'outro',
        extensao: 'pdf',
        tamanhoBytes: 0,
        versao: 1,
        documentoPaiId: null,
        pastaId: null,
        visivelCliente: false,
        uploadEm: App.domain.prazos.hojeISO()
      }, dados), 'DOC'));
    });
  }

  /* Tipo MIME por formato — o que o navegador espera receber no download e
     o que o modoEdicao() do visor consulta quando a extensão não basta. */
  var MIMES = {
    txt:  'text/plain',
    md:   'text/markdown',
    html: 'text/html',
    rtf:  'application/rtf',
    odt:  'application/vnd.oasis.opendocument.text',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  /**
   * DOCUMENTO EM BRANCO — nasce sem arquivo, para ser escrito no editor.
   *
   * É o caminho oposto ao de enviar(): ali existe um binário e o sistema
   * guarda os metadados; aqui não existe binário nenhum e o conteúdo vai
   * viver no conteudoService desde o primeiro caractere.
   *
   * @param {Object} dados { processoId, clienteId, pastaId, nome, formato,
   *                         categoria, visivelCliente, uploadPorId }
   * @returns {Promise<Object>} o documento criado
   */
  function criarEmBranco(dados) {
    var d = dados || {};
    var nome = String(d.nome || '').trim();

    if (!d.processoId) {
      return Promise.reject(http().ErroApi('processoId é obrigatório.', 422));
    }
    if (!nome) {
      return Promise.reject(http().ErroApi('Dê um nome ao documento.', 422));
    }

    var formato = App.domain.enums.achar(App.domain.enums.FORMATOS_DOCUMENTO, d.formato);
    if (!formato) {
      return Promise.reject(http().ErroApi('Escolha um formato para o documento.', 422));
    }

    // O nome é do usuário; a extensão é do formato escolhido. Se ele digitou
    // "parecer.txt" e escolheu .docx, quem manda é o campo de formato.
    var base = nome.replace(new RegExp('\\.' + formato.id + '$', 'i'), '').trim() || nome;

    return http().requisicao(function () {
      if (d.pastaId) {
        var pasta = db().find('pastasDocumento', d.pastaId);
        if (!pasta) throw http().ErroApi('Pasta de destino não encontrada.', 404);
        if (pasta.processoId !== d.processoId) {
          throw http().ErroApi('A pasta pertence a outro processo.', 422);
        }
      }

      return enriquecer(db().insert('documentos', {
        processoId: d.processoId,
        clienteId: d.clienteId || null,
        pastaId: d.pastaId || null,
        nome: base + '.' + formato.id,
        categoria: d.categoria || 'outro',
        extensao: formato.id,
        tipoMime: MIMES[formato.id] || null,
        tamanhoBytes: 0,
        versao: 1,
        documentoPaiId: null,
        uploadPorId: d.uploadPorId || null,
        uploadEm: App.domain.prazos.hojeISO(),
        criadoNoEditor: true,          // nasceu aqui: nunca houve binário
        visivelCliente: !!d.visivelCliente
      }, 'DOC'));
    });
  }

  /** Extensão a partir do nome do arquivo — o que o ícone da linha mostra. */
  function extensaoDe(nome) {
    var partes = String(nome || '').split('.');
    if (partes.length < 2) return 'bin';
    return partes.pop().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  }

  /**
   * ENVIO (upload simulado) — POST /api/documentos multipart na versão real.
   *
   * Recebe descrições de arquivo já extraídas do <input type="file">, e não os
   * objetos File: o service não toca no DOM. O binário, quando existe, é
   * guardado pela tela no arquivoService.
   *
   * @param {Object}   dados
   * @param {Array}    dados.arquivos  [{ nome, tamanhoBytes, tipoMime }]
   * @param {Function} [aoProgresso]   recebe o percentual (0–100)
   * @returns {Promise<Array>} documentos criados, na ordem dos arquivos
   */
  function enviar(dados, aoProgresso) {
    var d = dados || {};
    var arquivos = d.arquivos || [];

    // Validação antes de "subir": ninguém espera a barra para saber que o
    // arquivo é grande demais.
    if (!d.processoId) {
      return Promise.reject(http().ErroApi('processoId é obrigatório.', 422));
    }
    if (!arquivos.length) {
      return Promise.reject(http().ErroApi('Selecione ao menos um arquivo.', 422));
    }

    var semNome = arquivos.filter(function (a) { return !a.nome || !String(a.nome).trim(); })[0];
    if (semNome) {
      return Promise.reject(http().ErroApi('Há arquivo sem nome na seleção.', 422));
    }

    var grande = arquivos.filter(function (a) {
      return (a.tamanhoBytes || 0) > LIMITE_UPLOAD_BYTES;
    })[0];
    if (grande) {
      return Promise.reject(http().ErroApi(
        '“' + grande.nome + '” tem ' + App.format.bytes(grande.tamanhoBytes) +
        ' e o limite por arquivo é ' + App.format.bytes(LIMITE_UPLOAD_BYTES) + '.', 413));
    }

    if (d.pastaId) {
      var pasta = db().find('pastasDocumento', d.pastaId);
      if (!pasta) return Promise.reject(http().ErroApi('Pasta de destino não encontrada.', 404));
      if (pasta.processoId !== d.processoId) {
        return Promise.reject(http().ErroApi('A pasta pertence a outro processo.', 422));
      }
    }

    return http().upload(function () {
      return arquivos.map(function (arquivo) {
        return enriquecer(db().insert('documentos', {
          processoId: d.processoId,
          clienteId: d.clienteId || null,
          pastaId: d.pastaId || null,
          nome: String(arquivo.nome).trim(),
          categoria: d.categoria || 'outro',
          extensao: extensaoDe(arquivo.nome),
          tipoMime: arquivo.tipoMime || null,
          tamanhoBytes: arquivo.tamanhoBytes || 0,
          versao: 1,
          documentoPaiId: null,
          uploadPorId: d.uploadPorId || null,
          uploadEm: App.domain.prazos.hojeISO(),
          visivelCliente: !!d.visivelCliente
        }, 'DOC'));
      });
    }, aoProgresso);
  }

  /**
   * Move o documento para uma pasta do MESMO processo (null = raiz).
   * É o destino do drag & drop da aba Documentos.
   */
  function mover(id, pastaId) {
    return http().requisicao(function () {
      var documento = db().find('documentos', id);
      if (!documento) throw http().ErroApi('Documento não encontrado.', 404);

      var destino = pastaId || null;
      if (destino) {
        var pasta = db().find('pastasDocumento', destino);
        if (!pasta) throw http().ErroApi('Pasta de destino não encontrada.', 404);
        if (pasta.processoId !== documento.processoId) {
          throw http().ErroApi('A pasta pertence a outro processo.', 422);
        }
      }

      return enriquecer(db().update('documentos', id, { pastaId: destino }));
    });
  }

  /** Nova versão: mantém o original e encadeia pelo documentoPaiId. */
  function novaVersao(documentoId, dados) {
    return http().requisicao(function () {
      var original = db().find('documentos', documentoId);
      if (!original) throw http().ErroApi('Documento não encontrado.', 404);

      var raiz = original.documentoPaiId || original.id;
      var versoes = db().get('documentos').filter(function (d) {
        return d.id === raiz || d.documentoPaiId === raiz;
      });

      return enriquecer(db().insert('documentos', Object.assign({}, original, dados, {
        id: undefined,
        documentoPaiId: raiz,
        versao: versoes.length + 1,
        uploadEm: App.domain.prazos.hojeISO()
      }), 'DOC'));
    });
  }

  function atualizar(id, alteracoes) {
    return http().requisicao(function () {
      var atualizado = db().update('documentos', id, alteracoes);
      if (!atualizado) throw http().ErroApi('Documento não encontrado.', 404);
      return enriquecer(atualizado);
    });
  }

  function remover(id) {
    return http().requisicao(function () {
      db().remove('documentos', id);
      return { id: id };
    });
  }

  App.services.documentoService = {
    LIMITE_UPLOAD_BYTES: LIMITE_UPLOAD_BYTES,
    MIMES: MIMES,
    listar: listar,
    criar: criar,
    criarEmBranco: criarEmBranco,
    enviar: enviar,
    mover: mover,
    novaVersao: novaVersao,
    atualizar: atualizar,
    remover: remover,
    extensaoDe: extensaoDe
  };
})(window.App = window.App || {});
