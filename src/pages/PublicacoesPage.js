/* ==========================================================================
   pages/PublicacoesPage.js — fila de triagem do diário

   Layout de duas colunas, como caixa de e-mail: a fila à esquerda, o texto
   integral e a sugestão à direita. É a forma que o trabalho tem — ler o ato
   e decidir — e qualquer outra obrigaria a ir e voltar entre telas.

   A sugestão do classificador aparece SEMPRE com os termos que a
   sustentaram e o grau de confiança. O sistema não decide sozinho: ele
   mostra por que sugeriu, e a triagem continua sendo do advogado.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var resultado = null;
  var selecionada = null;
  var filtros = { status: 'nova', busca: '' };
  var sincronizando = false;

  function esc(v) { return App.dom.esc(v); }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 8 });
    ligarEventos();
    carregar();
  }

  function carregar() {
    App.services.publicacaoService.listar(filtros).then(function (r) {
      resultado = r;
      var aindaExiste = r.itens.some(function (p) { return p.id === selecionada; });
      if (!aindaExiste) selecionada = r.itens.length ? r.itens[0].id : null;
      desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Erro ao carregar as publicações', texto: erro.message
      });
    });
  }

  function atual() {
    return (resultado.itens || []).filter(function (p) { return p.id === selecionada; })[0] || null;
  }

  // --- Fila -------------------------------------------------------------------

  function itemFila(pub) {
    var ativa = pub.id === selecionada;
    var sugestao = pub.sugestao;
    var enums = App.domain.enums;

    var etiqueta = !sugestao.abrePrazo
      ? '<span class="pub__tag pub__tag--neutro">sem prazo</span>'
      : '<span class="pub__tag pub__tag--' + esc(sugestao.confianca) + '">' +
          esc(sugestao.tipoPrazoId
            ? enums.rotulo(enums.TIPOS_PRAZO, sugestao.tipoPrazoId)
            : 'não identificado') +
        '</span>';

    // Primeira linha útil do texto: o cabeçalho da vara identifica o ato.
    var previa = String(pub.textoIntegral).split('\n')
      .filter(function (l) { return l.trim(); })[0] || '';

    return '<button type="button" class="pub__item' + (ativa ? ' pub__item--active' : '') + '"' +
             ' data-action="selecionar-pub" data-value="' + esc(pub.id) + '">' +
             '<span class="pub__item-topo">' +
               '<span class="pub__diario">' + esc(pub.diario) + '</span>' +
               '<span class="pub__data">' + esc(App.format.dataCurta(pub.dataDisponibilizacao)) + '</span>' +
             '</span>' +
             '<span class="pub__previa">' + esc(App.format.truncar(previa, 64)) + '</span>' +
             '<span class="pub__item-baixo">' +
               etiqueta +
               (pub.processoNumero
                 ? '<span class="pub__vinculo">✓ vinculada</span>'
                 : '<span class="pub__vinculo pub__vinculo--sem">sem processo</span>') +
             '</span>' +
           '</button>';
  }

  // --- Painel de leitura -------------------------------------------------------

  function painelSugestao(pub) {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var s = pub.sugestao;
    var analise = pub.analise;

    var rotuloConfianca = {
      alta: 'Confiança alta', media: 'Confiança média',
      baixa: 'Confiança baixa', nenhuma: 'Não identificado'
    }[s.confianca];

    if (!s.abrePrazo) {
      return ui.Card({
        titulo: 'Leitura do ato',
        conteudo:
          '<p class="u-sm">Este texto <strong>não parece abrir prazo</strong>' +
          (s.motivoSemPrazo
            ? ' — expressão encontrada: <code>' + esc(s.motivoSemPrazo) + '</code>.' : '.') +
          '</p>' +
          '<p class="u-xs u-subtle">Se abrir, gere o prazo manualmente pelo botão abaixo.</p>'
      });
    }

    var termos = (s.termos || []).map(function (t) {
      return '<code class="pub__termo">' + esc(t) + '</code>';
    }).join(' ');

    return ui.Card({
      titulo: 'Leitura do ato',
      subtitulo: rotuloConfianca,
      conteudo:
        '<dl class="def-list">' +
          '<div><dt class="def-list__term">Ato sugerido</dt>' +
            '<dd class="def-list__desc">' +
              esc(s.tipoPrazoId ? enums.rotulo(enums.TIPOS_PRAZO, s.tipoPrazoId) : '—') +
            '</dd></div>' +
          '<div><dt class="def-list__term">Prazo</dt>' +
            '<dd class="def-list__desc">' + (s.dias || '—') + ' dias ' +
              esc(s.tipoContagem === 'uteis' ? 'úteis' : 'corridos') +
              (s.emDobro ? ' <strong>(em dobro)</strong>' : '') +
            '</dd></div>' +
          (analise.prazoNoTexto
            ? '<div><dt class="def-list__term">Dito no texto</dt>' +
              '<dd class="def-list__desc">"' + esc(analise.prazoNoTexto.trecho) + '"</dd></div>'
            : '') +
          (s.alternativa
            ? '<div><dt class="def-list__term">Alternativa</dt>' +
              '<dd class="def-list__desc">' +
                esc(enums.rotulo(enums.TIPOS_PRAZO, s.alternativa)) + '</dd></div>'
            : '') +
        '</dl>' +
        (termos
          ? '<div class="pub__termos"><span class="u-xs u-subtle">Termos encontrados:</span> ' +
            termos + '</div>'
          : '') +
        App.components.SeloSimulado({
          forma: 'linha',
          oque: 'a leitura é feita por dicionário de termos, não por modelo de linguagem.',
          naFase3: 'a mesma leitura, reforçada por modelo — o dicionário continua sendo o piso.'
        })
    });
  }

  function painelVinculo(pub) {
    var ui = App.components.ui;

    if (pub.processo) {
      return ui.Card({
        titulo: 'Processo vinculado',
        conteudo:
          '<a class="u-bold" href="#/processos/' + esc(pub.processo.id) + '">' +
            esc(pub.processo.numeroCnj) + '</a>' +
          '<div class="u-sm u-muted">' + esc(pub.processo.assunto) + '</div>' +
          '<div class="u-xs u-subtle">' + esc(pub.processo.vara) + ' · ' +
            esc(pub.processo.comarca) + '</div>'
      });
    }

    var achado = pub.numeroCnjDetectado
      ? App.services.publicacaoService.processoPorCnj(pub.numeroCnjDetectado)
      : null;

    return ui.Card({
      titulo: 'Sem processo vinculado',
      conteudo:
        (pub.numeroCnjDetectado
          ? '<p class="u-sm">Número detectado no texto: <strong>' +
              esc(pub.numeroCnjDetectado) + '</strong></p>'
          : '<p class="u-sm">Nenhum número CNJ válido foi encontrado no texto.</p>') +
        (achado
          ? '<p class="u-sm">Corresponde a um processo do escritório.</p>' +
            ui.Button({ rotulo: 'Vincular a este processo', variante: 'primary',
                        acao: 'vincular-pub', valor: achado.id })
          : '<p class="u-xs u-subtle">O número não corresponde a nenhum processo cadastrado. ' +
            'Você pode cadastrá-lo a partir desta publicação.</p>' +
            ui.Button({ rotulo: 'Cadastrar processo', acao: 'cadastrar-do-pub' }))
    });
  }

  function painelLeitura() {
    var pub = atual();
    if (!pub) {
      return App.components.ui.EmptyState({
        icone: '📰', titulo: 'Selecione uma publicação'
      });
    }

    var ui = App.components.ui;
    var podeTriar = App.services.sessaoService.pode('publicacoes.triar');
    var jaGerou = !!pub.prazoGeradoId;

    var acoes = '<div class="pub__acoes">' +
      ui.Button({
        rotulo: jaGerou ? 'Prazo já gerado' : 'Gerar prazo',
        variante: 'primary', icone: '⏱',
        acao: 'gerar-prazo',
        desabilitado: !podeTriar || jaGerou || !pub.processoId,
        titulo: !pub.processoId ? 'Vincule a um processo antes' : ''
      }) +
      // F2.8: a mesma leitura do classificador, apresentada em frases.
      ui.Button({ rotulo: 'Explicar', icone: '💬', acao: 'explicar-pub' }) +
      ui.Button({ rotulo: 'Descartar', variante: 'ghost', acao: 'descartar-pub',
                  desabilitado: !podeTriar || pub.status === 'descartada' }) +
      '</div>' +
      '<div id="pub-explicacao"></div>';

    return '<div class="pub__leitura">' +
      '<div class="pub__cabecalho">' +
        '<div>' +
          '<h2 class="pub__titulo">' + esc(pub.diario) + '</h2>' +
          '<div class="u-xs u-subtle">' +
            esc(pub.caderno) + ' · pág. ' + esc(pub.pagina) + ' · disponibilizado em ' +
            esc(App.format.data(pub.dataDisponibilizacao)) +
          '</div>' +
        '</div>' +
        ui.BadgeEnum(App.domain.enums.STATUS_PUBLICACAO, pub.status) +
      '</div>' +

      acoes +

      '<pre class="pub__texto">' + esc(pub.textoIntegral) + '</pre>' +

      painelVinculo(pub) +
      painelSugestao(pub) +

      (jaGerou
        ? ui.Card({ conteudo:
            '<p class="u-sm">Esta publicação gerou o prazo e o andamento do processo. ' +
            '<a href="#/processos/' + esc(pub.processoId) + '">Abrir o processo</a>.</p>' })
        : '') +
    '</div>';
  }

  // --- Desenho -----------------------------------------------------------------

  function desenhar() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var resumo = App.services.publicacaoService.resumo();
    var ultima = App.services.sincronizacaoService.ultima();

    var fila = resultado.itens.length
      ? '<div class="pub__lista">' + resultado.itens.map(itemFila).join('') + '</div>'
      : ui.EmptyState({
          icone: '✓', titulo: 'Fila vazia',
          texto: 'Nenhuma publicação neste filtro.'
        });

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Publicações</h1>' +
          '<p class="page-header__subtitle">' +
            resumo.pendentes + ' aguardando ação · ' + resumo.total + ' no total' +
            (ultima && ultima.concluidaEm
              ? ' · última sincronização ' + App.format.dataHora(ultima.concluidaEm)
              : '') +
          '</p>' +
        '</div>' +
        '<div class="page-header__actions">' +
          ui.Button({ rotulo: 'Vincular por CNJ', acao: 'vincular-lote' }) +
          ui.Button({
            rotulo: sincronizando ? 'Sincronizando…' : 'Sincronizar agora',
            variante: 'primary', icone: '↻', acao: 'sincronizar',
            desabilitado: sincronizando
          }) +
        '</div>' +
      '</div>' +

      ui.Tabs({
        ativa: filtros.status || 'todas',
        acao: 'filtrar-status',
        abas: [
          { id: 'nova', label: 'Novas', contador: resumo.novas || null },
          { id: 'vinculada', label: 'Vinculadas', contador: resumo.vinculadas || null },
          { id: 'sem_vinculo', label: 'Sem processo', contador: resumo.semVinculo || null },
          { id: 'triada', label: 'Triadas', contador: resumo.triadas || null },
          { id: 'descartada', label: 'Descartadas', contador: resumo.descartadas || null },
          { id: 'todas', label: 'Todas' }
        ]
      }) +

      '<div class="filter-bar">' +
        '<input class="input" type="search" data-filtro="busca" value="' + esc(filtros.busca) + '"' +
          ' placeholder="Buscar no texto da publicação ou por número…">' +
      '</div>' +

      '<div class="pub">' + fila + painelLeitura() + '</div>';
  }

  // --- Ações -------------------------------------------------------------------

  function sincronizar() {
    if (sincronizando) return;
    sincronizando = true;
    desenhar();

    App.services.sincronizacaoService.sincronizar().then(function (r) {
      sincronizando = false;
      App.components.Toast.sucesso('Sincronização concluída',
        r.novas + ' nova(s) · ' + r.duplicadas + ' duplicada(s) descartada(s).');
      carregar();
    }).catch(function (erro) {
      sincronizando = false;
      App.components.Toast.erro('Falha na sincronização', erro.message);
      desenhar();
    });
  }

  function abrirGerarPrazo() {
    var pub = atual();
    if (!pub) return;

    var ui = App.components.ui;
    var enums = App.domain.enums;
    var s = pub.sugestao;
    var usuarios = App.services.db.get('usuarios').map(function (u) {
      return { id: u.id, label: u.nome };
    });

    App.components.Modal.abrir({
      titulo: 'Gerar prazo a partir da publicação',
      conteudo:
        '<p class="u-sm u-muted">O motor conta a partir da disponibilização no diário ' +
        '(' + App.format.data(pub.dataDisponibilizacao) + '), aplicando o art. 224 §2º ' +
        'e a contagem em dias úteis do art. 219.</p>' +
        '<form id="form-gerar-prazo">' +
          '<div class="form-grid">' +
            ui.Field({ nome: 'tipoPrazoId', rotulo: 'Tipo de prazo', tipo: 'select',
                       largura: 6,
                       opcoes: enums.opcoes(enums.TIPOS_PRAZO, s.tipoPrazoId || 'custom') }) +
            ui.Field({ nome: 'dias', rotulo: 'Dias', tipo: 'number', largura: 3,
                       valor: s.dias || 15 }) +
            ui.Field({ nome: 'tipoContagem', rotulo: 'Contagem', tipo: 'select', largura: 3,
                       opcoes: enums.opcoes([
                         { id: 'uteis', label: 'Dias úteis' },
                         { id: 'corridos', label: 'Dias corridos' }
                       ], s.tipoContagem) }) +
            ui.Field({ nome: 'responsavelId', rotulo: 'Responsável', tipo: 'select', largura: 6,
                       opcoes: enums.opcoes(usuarios,
                         pub.processo ? pub.processo.responsavelId : '') }) +
            ui.Field({ nome: 'diasAntecedencia', rotulo: 'Prazo interno (dias antes)',
                       tipo: 'number', largura: 6, valor: 3 }) +
          '</div>' +
          ui.Field({ nome: 'dobro', tipo: 'checkbox',
                     rotulo: 'Prazo em dobro (art. 229)', valor: !!s.emDobro }) +
        '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Gerar prazo', variante: 'primary', acao: 'gerar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'gerar') return;
        var dados = App.dom.formToObject(App.dom.qs('#form-gerar-prazo', corpo));
        dados.dias = parseInt(dados.dias, 10);
        dados.diasAntecedencia = parseInt(dados.diasAntecedencia, 10);

        App.services.publicacaoService.gerarPrazo(pub.id, dados).then(function (r) {
          fecharModal();
          App.components.Toast.sucesso('Prazo criado',
            r.prazo.titulo + ' — data fatal em ' + App.format.data(r.prazo.dataFatal) + '.');
          App.layout.AppShell.atualizarNotificacoes();
          carregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível gerar o prazo', erro.message);
        });
      }
    });
  }

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="selecionar-pub"]',
      function (evento, alvo) {
        selecionada = alvo.getAttribute('data-value');
        desenhar();
      });

    App.dom.delegate(container, 'click', '[data-action="filtrar-status"]',
      function (evento, alvo) {
        var valor = alvo.getAttribute('data-value');
        filtros.status = valor === 'todas' ? '' : valor;
        carregar();
      });

    App.dom.delegate(container, 'input', 'input[data-filtro="busca"]',
      App.dom.debounce(function (evento, alvo) {
        filtros.busca = alvo.value;
        carregar();
      }, 280));

    App.dom.delegate(container, 'click', '[data-action="sincronizar"]', sincronizar);

    App.dom.delegate(container, 'click', '[data-action="vincular-lote"]', function () {
      App.services.publicacaoService.vincularAutomaticamente().then(function (r) {
        App.components.Toast.sucesso('Vínculo automático',
          r.vinculadas + ' vinculada(s) por número CNJ · ' +
          r.semVinculo + ' sem processo correspondente.');
        carregar();
      });
    });

    App.dom.delegate(container, 'click', '[data-action="vincular-pub"]',
      function (evento, alvo) {
        App.services.publicacaoService.vincular(selecionada, alvo.getAttribute('data-value'))
          .then(function () {
            App.components.Toast.sucesso('Publicação vinculada');
            carregar();
          });
      });

    App.dom.delegate(container, 'click', '[data-action="gerar-prazo"]', abrirGerarPrazo);

    App.dom.delegate(container, 'click', '[data-action="explicar-pub"]', function () {
      var alvo = App.dom.qs('#pub-explicacao', container);
      if (!alvo || !selecionada) return;

      alvo.innerHTML = '<p class="u-sm u-subtle">Lendo o texto…</p>';

      App.services.iaService.resumirPublicacao({ publicacaoId: selecionada })
        .then(function (r) {
          alvo.innerHTML =
            '<div class="ia-resposta">' +
              '<p class="ia__texto">' + esc(r.texto) + '</p>' +
              '<p class="u-xs u-subtle">' + esc(r.aviso) + '</p>' +
            '</div>';
        })
        .catch(function (erro) {
          alvo.innerHTML = '<p class="ia__alerta">' + esc(erro.message) + '</p>';
        });
    });

    App.dom.delegate(container, 'click', '[data-action="descartar-pub"]', function () {
      App.services.publicacaoService.descartar(selecionada, 'Descartada na triagem.')
        .then(function () {
          App.components.Toast.sucesso('Publicação descartada');
          carregar();
        });
    });

    App.dom.delegate(container, 'click', '[data-action="cadastrar-do-pub"]', function () {
      var pub = atual();
      if (!pub) return;
      // O formulário de processo lê o número do hash e já abre preenchido.
      App.router.ir('#/processos/novo?cnj=' +
        encodeURIComponent(pub.numeroCnjDetectado || '') + '&publicacaoId=' + pub.id);
    });
  }

  App.pages.PublicacoesPage = { render: render };
})(window.App = window.App || {});
