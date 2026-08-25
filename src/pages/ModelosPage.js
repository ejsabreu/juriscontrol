/* ==========================================================================
   pages/ModelosPage.js — biblioteca de modelos de peça

   Lista à esquerda, prévia à direita. A prévia mostra o modelo COM as
   variáveis destacadas — o autor precisa ver onde elas caem no texto para
   saber se a peça vai sair coerente.

   O painel de variáveis lista o catálogo do sistema e marca o que este
   modelo usa. Sem catálogo à vista, quem escreve o modelo inventa nomes que
   nunca serão resolvidos, e o campo aparece vazio no protocolo.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var modelos = [];
  var selecionado = null;
  var filtros = { busca: '', tipo: '' };

  function esc(v) { return App.dom.esc(v); }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });
    ligarEventos();
    carregar(true);
  }

  function carregar(completo) {
    App.services.modeloPecaService.listar(filtros).then(function (lista) {
      modelos = lista;
      if (!lista.some(function (m) { return m.id === selecionado; })) {
        selecionado = lista.length ? lista[0].id : null;
      }
      if (completo || !atualizarMiolo()) desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Erro ao carregar os modelos', texto: erro.message
      });
    });
  }

  function atual() {
    return modelos.filter(function (m) { return m.id === selecionado; })[0] || null;
  }

  function itemLista(m) {
    var ativo = m.id === selecionado;
    return '<button type="button" class="mod__item' + (ativo ? ' mod__item--active' : '') + '"' +
             ' data-action="selecionar-modelo" data-value="' + esc(m.id) + '">' +
             '<span class="mod__nome">' + esc(m.nome) + '</span>' +
             '<span class="mod__meta">' + esc(m.areaLabel) + ' · ' +
               m.totalVariaveis + ' variável(is)' +
               (m.desconhecidas.length
                 ? ' · <span class="mod__aviso">' + m.desconhecidas.length +
                   ' desconhecida(s)</span>'
                 : '') +
             '</span>' +
           '</button>';
  }

  function painelVariaveis(modelo) {
    var ui = App.components.ui;
    var catalogo = App.domain.modelos.CATALOGO;
    var usadas = modelo.variaveis;

    var grupos = {};
    catalogo.forEach(function (v) { (grupos[v.grupo] = grupos[v.grupo] || []).push(v); });

    var html = Object.keys(grupos).map(function (grupo) {
      var itens = grupos[grupo].map(function (v) {
        var usada = usadas.indexOf(v.chave) !== -1;
        return '<li class="var' + (usada ? ' var--usada' : '') + '"' +
                 ' title="' + esc(v.descricao) + '">' +
                 '<code>{{' + esc(v.chave) + '}}</code>' +
                 (usada ? '<span class="var__marca">no modelo</span>' : '') +
               '</li>';
      }).join('');

      return '<div class="var-grupo">' +
               '<h5 class="var-grupo__titulo">' + esc(grupo) + '</h5>' +
               '<ul class="var-lista">' + itens + '</ul>' +
             '</div>';
    }).join('');

    var alerta = modelo.desconhecidas.length
      ? '<p class="mod__alerta">⚠ Este modelo usa ' +
        modelo.desconhecidas.map(function (v) {
          return '<code>{{' + esc(v) + '}}</code>';
        }).join(', ') +
        ' — o sistema não sabe preencher, e o campo sairá em branco.</p>'
      : '';

    return ui.Card({
      titulo: 'Variáveis',
      subtitulo: usadas.length + ' usada(s) neste modelo',
      conteudo: alerta + html,
      semPadding: false
    });
  }

  function previa() {
    var modelo = atual();
    var ui = App.components.ui;

    if (!modelo) {
      return ui.EmptyState({ icone: '📄', titulo: 'Selecione um modelo' });
    }

    /* A prévia destaca as variáveis no lugar em que caem — é o que permite
       ver se o texto continua coerente depois de preenchido. */
    var comDestaque = esc(modelo.conteudoHtml)
      .replace(/\{\{\s*([a-zA-Z0-9_.]+)[^}]*\}\}/g,
               '<span class="var-marca">{{$1}}</span>');

    return '<div class="mod__previa">' +
      '<div class="mod__cabecalho">' +
        '<div>' +
          '<h2 class="mod__titulo">' + esc(modelo.nome) + '</h2>' +
          '<div class="u-xs u-subtle">' +
            esc(App.domain.enums.rotulo(App.domain.enums.CATEGORIAS_DOCUMENTO,
                                        modelo.categoria)) +
            ' · ' + esc(modelo.areaLabel) + '</div>' +
        '</div>' +
        '<div class="u-row" style="gap:var(--space-2)">' +
          ui.Button({ rotulo: 'Usar em um processo', variante: 'primary',
                      acao: 'usar-modelo' }) +
          ui.Button({ rotulo: 'Excluir', variante: 'ghost', acao: 'excluir-modelo' }) +
        '</div>' +
      '</div>' +

      ui.Card({
        titulo: 'Texto do modelo',
        conteudo: '<pre class="mod__texto">' + comDestaque + '</pre>',
        semPadding: false
      }) +

      '<div class="page-section">' + painelVariaveis(modelo) + '</div>' +
    '</div>';
  }

  /* Só o miolo muda a cada busca. Cabeçalho e barra de filtros ficam de pé,
     e com eles o campo, o cursor e o foco de quem está digitando — sem isso
     a tela pisca a cada tecla e o `<input>` é destruído debaixo dos dedos. */
  function miolo() {
    var ui = App.components.ui;
    var lista = modelos.length
      ? '<div class="mod__lista">' + modelos.map(itemLista).join('') + '</div>'
      : ui.EmptyState({ icone: '📚', titulo: 'Nenhum modelo neste filtro' });
    return lista + previa();
  }

  function textoContagem() {
    return modelos.length + ' modelo(s) · as variáveis são preenchidas com os dados ' +
           'do processo ao gerar o documento';
  }

  function atualizarMiolo() {
    return App.components.FilterBar.trocarMiolo(container, miolo(), {
      contagem: textoContagem(),
      totalAtivos: App.selectors.filtrosAtivos(filtros, [])
    });
  }

  function desenhar() {
    var ui = App.components.ui;
    var enums = App.domain.enums;

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Modelos de peça</h1>' +
          '<p class="page-header__subtitle">' + textoContagem() + '</p>' +
        '</div>' +
        '<div class="page-header__actions">' +
          ui.Button({ rotulo: 'Novo modelo', variante: 'primary', icone: '+',
                      acao: 'novo-modelo' }) +
        '</div>' +
      '</div>' +

      App.components.FilterBar({
        campos: [
          { tipo: 'busca', nome: 'busca', valor: filtros.busca,
            placeholder: 'Buscar modelo…' },
          { tipo: 'select', nome: 'tipo', rotulo: 'Tipo',
            opcoes: enums.opcoes([
              { id: 'peticao', label: 'Petição' },
              { id: 'contrato', label: 'Contrato' },
              { id: 'procuracao', label: 'Procuração' },
              { id: 'notificacao', label: 'Notificação' },
              { id: 'proposta', label: 'Proposta' }
            ], filtros.tipo, 'Todos os tipos') }
        ],
        totalAtivos: App.selectors.filtrosAtivos(filtros, [])
      }) +

      '<div class="mod" data-miolo>' + miolo() + '</div>';
  }

  // --- Ações --------------------------------------------------------------------

  function abrirUsarModelo() {
    var modelo = atual();
    if (!modelo) return;

    var ui = App.components.ui;
    var processos = App.services.db.get('processos')
      .filter(function (p) { return p.status === 'ativo'; })
      .map(function (p) {
        return { id: p.id, label: p.numeroInterno + ' — ' + p.assunto };
      });

    if (!processos.length) {
      App.components.Toast.aviso('Nenhum processo ativo',
        'O modelo é preenchido com os dados de um processo.');
      return;
    }

    App.components.Modal.abrir({
      titulo: 'Gerar documento a partir de "' + modelo.nome + '"',
      conteudo:
        '<form id="form-usar-modelo">' +
          ui.Field({ nome: 'processoId', rotulo: 'Processo', tipo: 'select',
                     obrigatorio: true,
                     opcoes: App.domain.enums.opcoes(processos, processos[0].id),
                     dica: 'As variáveis são preenchidas com os dados deste processo.' }) +
          ui.Field({ nome: 'nome', rotulo: 'Nome do documento', valor: modelo.nome }) +
        '</form>' +
        '<div id="previa-preenchimento"></div>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Gerar documento', variante: 'primary', acao: 'gerar' }
      ],
      aoAbrir: function (corpo) {
        function atualizarPrevia() {
          var d = App.dom.formToObject(App.dom.qs('#form-usar-modelo', corpo));
          if (!d.processoId) return;

          App.services.modeloPecaService.previa(modelo.id, d.processoId)
            .then(function (r) {
              var alvo = App.dom.qs('#previa-preenchimento', corpo);
              if (!alvo) return;

              alvo.innerHTML =
                '<div class="preench">' +
                  '<div class="preench__linha">' +
                    '<span class="preench__ok">✓ ' + r.resolvidas.length +
                      ' preenchida(s)</span>' +
                    (r.pendentes.length
                      ? '<span class="preench__pendente">⚠ ' + r.pendentes.length +
                        ' sem valor</span>'
                      : '') +
                  '</div>' +
                  (r.pendentes.length
                    ? '<p class="u-xs u-subtle">Sem valor no processo: ' +
                      r.pendentes.map(function (v) {
                        return '<code>' + App.dom.esc(v) + '</code>';
                      }).join(', ') +
                      '. Elas ficam <strong>destacadas no documento</strong> para você ' +
                      'completar — nunca apagadas em silêncio.</p>'
                    : '<p class="u-xs u-subtle">Todas as variáveis foram resolvidas.</p>') +
                '</div>';
            });
        }

        App.dom.delegate(corpo, 'change', 'select[name="processoId"]', atualizarPrevia);
        atualizarPrevia();
      },
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'gerar') return;
        var d = App.dom.formToObject(App.dom.qs('#form-usar-modelo', corpo));

        App.services.modeloPecaService.gerarDocumento({
          modeloId: modelo.id,
          processoId: d.processoId,
          nome: d.nome
        }).then(function (r) {
          fecharModal();
          App.components.Toast.sucesso('Documento criado',
            r.pendentes.length
              ? r.pendentes.length + ' variável(is) ficaram destacadas para completar.'
              : 'Todas as variáveis foram preenchidas.');
          App.router.ir('#/documentos/' + r.documento.id + '/editar');
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível gerar', erro.message);
        });
      }
    });
  }

  function abrirNovoModelo() {
    var ui = App.components.ui;
    var enums = App.domain.enums;

    App.components.Modal.abrir({
      titulo: 'Novo modelo de peça',
      conteudo:
        '<form id="form-modelo">' +
          ui.Field({ nome: 'nome', rotulo: 'Nome do modelo', obrigatorio: true }) +
          '<div class="form-grid">' +
            ui.Field({ nome: 'tipo', rotulo: 'Tipo', tipo: 'select', largura: 6,
                       opcoes: enums.opcoes([
                         { id: 'peticao', label: 'Petição' },
                         { id: 'contrato', label: 'Contrato' },
                         { id: 'procuracao', label: 'Procuração' },
                         { id: 'notificacao', label: 'Notificação' },
                         { id: 'proposta', label: 'Proposta' }
                       ], 'peticao') }) +
            ui.Field({ nome: 'areaId', rotulo: 'Área', tipo: 'select', largura: 6,
                       opcoes: enums.opcoes(enums.AREAS, '', 'Todas as áreas') }) +
          '</div>' +
          ui.Field({ nome: 'conteudoHtml', rotulo: 'Texto do modelo', tipo: 'textarea',
                     linhas: 10, obrigatorio: true,
                     dica: 'Use {{cliente.nome}}, {{processo.numeroCnj}} e as demais ' +
                           'variáveis do catálogo. Filtros: |maiuscula, |minuscula, |titulo.' }) +
        '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Criar modelo', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'salvar') return;
        var d = App.dom.formToObject(App.dom.qs('#form-modelo', corpo));

        // Avisa ANTES de salvar sobre variável que o sistema não conhece.
        var desconhecidas = App.domain.modelos.variaveisDesconhecidas(d.conteudoHtml);
        if (desconhecidas.length) {
          App.components.Toast.aviso('Variável desconhecida',
            desconhecidas.join(', ') + ' — o campo sairá em branco ao gerar.');
        }

        App.services.modeloPecaService.criar(d).then(function (m) {
          fecharModal();
          selecionado = m.id;
          App.components.Toast.sucesso('Modelo criado', m.nome);
          carregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível criar', erro.message);
        });
      }
    });
  }

  function ligarEventos() {
    App.components.FilterBar.mount(container, {
      aoMudar: function (nome, valor) { filtros[nome] = valor; carregar(); },
      aoLimpar: function () { filtros = { busca: '', tipo: '' }; carregar(); }
    });

    App.dom.delegate(container, 'click', '[data-action="selecionar-modelo"]',
      function (evento, alvo) {
        selecionado = alvo.getAttribute('data-value');
        desenhar();
      });

    App.dom.delegate(container, 'click', '[data-action="usar-modelo"]', abrirUsarModelo);
    App.dom.delegate(container, 'click', '[data-action="novo-modelo"]', abrirNovoModelo);

    App.dom.delegate(container, 'click', '[data-action="excluir-modelo"]', function () {
      var modelo = atual();
      if (!modelo) return;

      App.components.Modal.confirmar({
        titulo: 'Excluir modelo',
        mensagem: 'O modelo "' + modelo.nome + '" sai da biblioteca.',
        detalhe: 'Documentos já gerados a partir dele não são afetados.',
        rotuloConfirmar: 'Excluir',
        variante: 'danger'
      }).then(function (confirmado) {
        if (!confirmado) return;
        App.services.modeloPecaService.remover(modelo.id).then(function () {
          selecionado = null;
          App.components.Toast.sucesso('Modelo excluído');
          carregar();
        });
      });
    });
  }

  App.pages.ModelosPage = { render: render };
})(window.App = window.App || {});
