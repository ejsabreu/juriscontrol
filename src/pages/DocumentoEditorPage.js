/* ==========================================================================
   pages/DocumentoEditorPage.js — rota #/documentos/:id/editar

   A aba onde se escreve. Ver um documento nunca tira o usuário do sistema
   (o visor é um modal); EDITAR abre aba nova de propósito — é trabalho
   longo, e o advogado quer o processo aberto ao lado enquanto redige.

   O que esta página faz que o visor não faz:
     - carrega o conteúdo do conteudoService (não do binário: a aba nova
       nasce sem ele);
     - salva sozinho, como o Docs, ~1,2s depois da última tecla;
     - cada gravação atualiza tamanhoBytes/editadoEm no registro, para a
       lista de documentos do processo contar a verdade;
     - "Nova versão" congela o texto atual em v+1, encadeado pelo
       documentoPaiId — o histórico que o documentoService já sabia fazer.

   A aba do processo é avisada pelo evento 'storage' (ver conteudoService).
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var documento = null;
  var modo = 'texto';
  var editor = null;          // alça devolvida por DocumentEditor.mount
  var salvarComAtraso = null;
  var pendente = false;       // há tecla digitada ainda não gravada
  var avisoDeSaida = null;

  function conteudos()  { return App.services.conteudoService; }
  function documentos() { return App.services.documentoService; }

  function render(elemento, params) {
    container = elemento;
    documento = null;
    editor = null;
    pendente = false;

    container.innerHTML = App.components.ui.Skeleton({ linhas: 10 });
    ligarEventos();   // delegação no container: uma vez por rota, como as demais
    carregar(params.id);
  }

  function carregar(id) {
    documentos().listar({}).then(function (resultado) {
      var achado = resultado.itens.filter(function (d) { return d.id === id; })[0];

      if (!achado) return semSaida('Documento não encontrado',
        'O documento ' + id + ' não existe ou foi excluído.', null);

      documento = achado;
      modo = App.components.DocumentViewer.modoEdicao(achado);

      if (!modo) {
        return semSaida('Este formato não se edita no navegador',
          '“' + achado.nome + '” é ' + String(achado.extensao || '').toUpperCase() +
          '. O editor interno trabalha com texto (.txt, .md, .csv, .json…) e com ' +
          'documentos de texto formatado (.doc, .docx, .odt, .rtf).', achado.processoId);
      }

      desenhar();
    }).catch(function (erro) {
      semSaida('Não foi possível abrir o editor', erro.message, null);
    });
  }

  /** Beco sem saída — sempre com o caminho de volta para o processo. */
  function semSaida(titulo, texto, processoId) {
    container.innerHTML = App.components.ui.EmptyState({
      icone: '✎',
      titulo: titulo,
      texto: texto,
      acao: App.components.ui.Button({
        rotulo: processoId ? 'Voltar ao processo' : 'Ir para os processos',
        variante: 'primary',
        href: processoId ? '#/processos/' + processoId : '#/processos'
      })
    });
  }

  /**
   * Os avisos honestos do topo do editor.
   *
   * 1. Modo rico: um .docx é ZIP com XML dentro. Sem biblioteca, o navegador
   *    não lê nem escreve esse formato — em vez de fingir que abriu o Word,
   *    o editor diz o que é.
   * 2. Sem localStorage: dá para escrever, mas nada sobrevive ao reload nem
   *    chega a outra aba. É melhor avisar antes que depois.
   */
  function aviso(salvo) {
    var partes = [];

    var extensao = App.dom.esc(String(documento.extensao || '').toUpperCase());
    var formato = App.domain.enums.achar(App.domain.enums.FORMATOS_DOCUMENTO,
      String(documento.extensao || '').toLowerCase());
    var geraArquivo = !formato || formato.geraArquivo !== false;

    if (documento.criadoNoEditor) {
      // Documento que nasceu aqui: nunca houve binário para "não ler". O que
      // interessa dizer é em que formato ele sai.
      if (!geraArquivo) {
        partes.push('<strong>Sobre o formato ' + extensao + ':</strong> ele é a identidade ' +
          'deste documento no sistema, mas o protótipo não monta o arquivo (é um pacote ZIP). ' +
          'Em <strong>Baixar como</strong> o texto sai em .rtf, .html, .txt, .md ou PDF — ' +
          'o .rtf abre no Word com a formatação preservada.');
      }
    } else if (modo === 'rico') {
      var temBinario = App.services.arquivoService.tem(documento.id);
      partes.push('<strong>Sobre editar ' + extensao + ':</strong> ' +
        'o protótipo não lê o conteúdo binário deste formato — ' +
        (salvo
          ? 'o texto abaixo é o que já foi escrito aqui dentro. '
          : 'você está começando um texto novo. ') +
        'O que for escrito passa a ser a versão editável do registro no sistema. ' +
        (temBinario
          ? 'O arquivo original continua intacto e disponível para download na aba Documentos.'
          : 'O arquivo original existiria no storage do backend e não é alterado.'));
    }

    if (!conteudos().suportado()) {
      partes.push('<strong>Armazenamento local indisponível:</strong> este navegador ' +
        'bloqueou o storage, então o texto vive só enquanto esta aba estiver aberta. ' +
        'Baixe o resultado antes de sair.');
    }

    return partes.join('<br><br>');
  }

  function desenhar() {
    // Redesenhar sem soltar o editor anterior deixaria dois Ctrl+S vivos no
    // document — o mount() prende listeners fora do container.
    if (editor) editor.destruir();

    var salvo = conteudos().ler(documento.id);
    var props = {
      documento: documento,
      modo: modo,
      conteudo: salvo ? salvo.conteudo : '',
      aviso: aviso(salvo),
      podeFechar: !!window.opener
    };

    container.innerHTML = App.components.DocumentEditor(props);
    document.title = documento.nome + ' · JurisControl';

    var raiz = App.dom.qs('[data-editor-doc]', container);
    editor = App.components.DocumentEditor.mount(raiz, props, {
      aoAlterar: aoAlterar,
      aoSalvar: function () { salvar({ manual: true }); }
    });

    salvarComAtraso = App.dom.debounce(function () { salvar({}); }, 1200);

    if (salvo && salvo.atualizadoEm) {
      editor.status('Salvo às ' + App.format.hora(salvo.atualizadoEm), 'salvo');
    } else {
      editor.status(salvo ? 'Salvo' : 'Documento em branco — comece a escrever');
    }

    ligarAvisoDeSaida();
    editor.focar();
  }

  // --- Salvamento -----------------------------------------------------------

  function aoAlterar() {
    pendente = true;
    editor.status('Editando…', 'editando');
    salvarComAtraso();
  }

  /**
   * Grava o conteúdo e atualiza os metadados do documento.
   * @param {Object} opcoes  { manual } — manual só muda a mensagem
   * @returns {Promise<boolean>}
   */
  function salvar(opcoes) {
    var o = opcoes || {};

    if (!editor || !documento) return Promise.resolve(false);
    if (!pendente && !o.manual) return Promise.resolve(true);

    var conteudo = editor.ler();
    editor.status('Salvando…', 'salvando');

    var usuario = App.store.getState().usuarioAtual;
    var resultado = conteudos().salvar(documento.id, {
      modo: modo,
      conteudo: conteudo,
      atualizadoPorId: usuario ? usuario.id : null
    });

    if (!resultado.ok) {
      pendente = true;
      editor.status('Não foi possível salvar', 'erro');
      avisarFalha(resultado);
      return Promise.resolve(false);
    }

    pendente = false;

    // O tamanho do documento passa a ser o do texto: a lista da aba
    // Documentos mostraria "12 KB" de um arquivo que já tem outro tamanho.
    return documentos().atualizar(documento.id, {
      tamanhoBytes: resultado.registro.bytes,
      editadoEm: resultado.registro.atualizadoEm,
      editadoPorId: resultado.registro.atualizadoPorId
    }).then(function (atualizado) {
      documento = atualizado;
      editor.status('Salvo às ' + App.format.hora(resultado.registro.atualizadoEm), 'salvo');
      if (o.manual) App.components.Toast.sucesso('Documento salvo', documento.nome);
      return true;
    }).catch(function (erro) {
      // O texto está gravado; só os metadados falharam. Dizer isso é mais
      // útil que um "erro ao salvar" que faria o usuário reescrever tudo.
      editor.status('Texto salvo, ficha desatualizada', 'erro');
      App.components.Toast.aviso('O texto foi salvo', 'Mas a ficha do documento não: ' + erro.message);
      return true;
    });
  }

  function avisarFalha(resultado) {
    if (resultado.motivo === 'tamanho') {
      App.components.Toast.erro('Documento grande demais',
        'O limite é ' + App.format.bytes(conteudos().LIMITE_BYTES) +
        ' por documento e o texto atual tem ' + App.format.bytes(resultado.bytes) +
        '. Nada foi gravado — copie o texto antes de fechar a aba.');
      return;
    }
    App.components.Toast.erro('Sem espaço no armazenamento local',
      'O navegador recusou a gravação. Libere espaço (ou restaure os dados ' +
      'fictícios) antes de continuar — copie o texto antes de fechar a aba.');
  }

  /** Congela o texto atual como v+1, encadeada pelo documentoPaiId. */
  function salvarComoNovaVersao() {
    salvar({}).then(function (ok) {
      if (!ok) return;

      return documentos().novaVersao(documento.id, {}).then(function (nova) {
        var copia = conteudos().copiar(documento.id, nova.id);
        if (!copia.ok) {
          App.components.Toast.erro('Versão criada sem o texto',
            'A v' + nova.versao + ' foi registrada, mas o conteúdo não coube no ' +
            'armazenamento local.');
          return;
        }

        App.components.Toast.sucesso('Versão v' + nova.versao + ' criada',
          'A anterior continua no histórico do documento.');

        // Segue editando a versão nova — é o que o usuário espera depois de
        // "salvar como".
        App.router.ir('/documentos/' + nova.id + '/editar');
      });
    }).catch(function (erro) {
      App.components.Toast.erro('Não foi possível criar a versão', erro.message);
    });
  }

  /**
   * Baixa o que está escrito AGORA, no formato escolhido no menu — nunca o
   * binário original, que já estaria desatualizado.
   */
  function exportar(formatoId) {
    var Toast = App.components.Toast;

    // Salva antes: baixar uma versão diferente da que ficou gravada seria a
    // pior surpresa possível.
    salvar({}).then(function () {
      return App.exportar.baixar(formatoId, {
        nome: documento.nome,
        modo: modo,
        conteudo: editor.ler()
      });
    }).then(function (resultado) {
      if (resultado.impressao) {
        if (resultado.ok) {
          Toast.info('Diálogo de impressão aberto',
            'Escolha “Salvar como PDF” no destino para gerar o arquivo.');
        } else {
          Toast.erro('O navegador não permitiu abrir a impressão');
        }
        return;
      }

      if (!resultado.ok) return Toast.erro('Não foi possível baixar');
      Toast.sucesso('Download iniciado', resultado.nome);
    });
  }

  // --- Eventos --------------------------------------------------------------

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="salvar-agora"]', function () {
      salvar({ manual: true });
    });

    App.dom.delegate(container, 'click', '[data-action="salvar-versao"]', salvarComoNovaVersao);

    App.dom.delegate(container, 'click', '[data-action="exportar"]', function (evento, botao) {
      var menu = App.dom.qs('[data-menu-exportar]', container);
      if (menu) menu.open = false;
      exportar(botao.dataset.value);
    });

    App.dom.delegate(container, 'click', '[data-action="voltar-processo"]', function () {
      salvar({}).then(function () {
        App.router.ir('/processos/' + documento.processoId);
      });
    });

    App.dom.delegate(container, 'click', '[data-action="fechar-aba"]', function () {
      salvar({}).then(function () { window.close(); });
    });
  }

  /* Rede de segurança: o autosave é rápido, mas fechar a aba 300ms depois de
     digitar ainda é possível. O aviso só aparece com gravação pendente. */
  function ligarAvisoDeSaida() {
    soltarAvisoDeSaida();
    avisoDeSaida = function (evento) {
      if (!pendente) return;
      salvar({});                     // síncrono até o localStorage
      evento.preventDefault();
      evento.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', avisoDeSaida);
  }

  function soltarAvisoDeSaida() {
    if (!avisoDeSaida) return;
    window.removeEventListener('beforeunload', avisoDeSaida);
    avisoDeSaida = null;
  }

  /** Chamado pelo router ao sair da rota — não deixa nada digitado para trás. */
  function destroy() {
    if (pendente) salvar({});
    if (editor) editor.destruir();
    editor = null;
    soltarAvisoDeSaida();
  }

  App.pages.DocumentoEditorPage = { render: render, destroy: destroy };
})(window.App = window.App || {});
