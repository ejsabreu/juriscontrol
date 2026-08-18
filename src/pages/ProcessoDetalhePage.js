/* ==========================================================================
   pages/ProcessoDetalhePage.js — ficha completa do processo
   Abas: Dados · Partes · Andamentos · Prazos · Documentos · Tarefas
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var processo = null;
  var abaAtiva = 'dados';
  var verTodosAndamentos = false;
  var pastaAtual = null;        // pasta aberta na aba Documentos (null = raiz)
  var pararDeObservar = null;   // assinatura do conteúdo editado em outra aba

  function esc(v) { return App.dom.esc(v); }

  function render(elemento, params) {
    container = elemento;
    abaAtiva = 'dados';
    verTodosAndamentos = false;
    pastaAtual = null;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 8 });
    ligarEventos();   // delegação no container: uma vez por rota
    observarEdicoes();
    carregar(params.id);
  }

  /**
   * O editor abre em outra aba e grava no localStorage; esta aba fica com a
   * lista velha na tela. O evento 'storage' avisa, e a lista se atualiza
   * sozinha — sem F5 e sem o usuário descobrir depois que estava vendo o
   * tamanho errado.
   */
  function observarEdicoes() {
    soltarObservador();
    pararDeObservar = App.services.conteudoService.observar(function () {
      if (!processo) return;
      App.components.Toast.info('Documento atualizado em outra aba',
        'A lista de documentos foi recarregada.');
      carregar(processo.id);
    });
  }

  function soltarObservador() {
    if (!pararDeObservar) return;
    pararDeObservar();
    pararDeObservar = null;
  }

  /** Chamado pelo router ao sair da rota. */
  function destroy() {
    soltarObservador();
  }

  function carregar(id) {
    // Os links do portal (F2.3) entram no mesmo carregamento: o contador da
    // aba depende deles.
    App.services.processoService.obter(id)
      .then(function (p) {
        processo = p;
        // A análise do assistente é do processo anterior — descartar aqui
        // evita mostrar o resumo de um processo na tela de outro.
        analiseIa = null;
        carregandoIa = false;
        // Mesmo motivo para o financeiro: os números são do processo anterior.
        financeiro = null;
        carregandoFinanceiro = false;
        return carregarLinks();
      })
      .catch(function (erro) {
        processo = null;
        container.innerHTML = App.components.ui.EmptyState({
          icone: '⚠',
          titulo: 'Processo não encontrado',
          texto: erro.message,
          acao: App.components.ui.Button({
            rotulo: 'Voltar para a lista', variante: 'primary', href: '#/processos'
          })
        });
      })
      // O desenho fica DEPOIS do catch, e não dentro do encadeamento acima,
      // para que uma falha de renderização não vire um enganoso "processo
      // não encontrado" — o erro real apareceria mascarado.
      .then(function () {
        if (processo) desenhar();
      });
  }

  // --- Cabeçalho ------------------------------------------------------------

  function heroi() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var fmt = App.format;

    var fase = enums.achar(enums.FASES, processo.faseId);
    var area = enums.achar(enums.AREAS, processo.areaId);
    var status = enums.achar(enums.STATUS_PROCESSO, processo.status);
    var risco = enums.achar(enums.RISCOS, processo.risco);
    var papel = enums.achar(enums.PAPEIS_CLIENTE, processo.papelCliente);

    var prazo = processo.prazoProximo;

    return '<div class="card">' +
      '<div class="processo-hero">' +
        '<div class="processo-hero__main">' +
          '<div class="processo-hero__number u-mono">' + esc(processo.numeroCnj) + '</div>' +
          '<div class="u-sm u-muted" style="margin-top:2px">' +
            esc(processo.numeroInterno) + ' · ' + esc(processo.classeProcessual) +
          '</div>' +
          '<div class="processo-hero__badges">' +
            (fase   ? ui.Badge({ rotulo: fase.label, cor: fase.cor, ponto: true }) : '') +
            (area   ? ui.Badge({ rotulo: area.label, cor: area.cor }) : '') +
            (status ? ui.Badge({ rotulo: status.label, variante: status.variante }) : '') +
            (risco  ? ui.Badge({ rotulo: 'Risco ' + risco.label.toLowerCase(),
                                 variante: risco.variante, titulo: risco.descricao }) : '') +
            (processo.segredoJustica
              ? ui.Badge({ rotulo: '🔒 Segredo de justiça', variante: 'dark' }) : '') +
            (processo.tags || []).map(function (tag) {
              return ui.Badge({ rotulo: tag, variante: 'accent' });
            }).join('') +
          '</div>' +
        '</div>' +

        '<div class="processo-hero__stats">' +
          '<div>' +
            '<div class="processo-hero__stat-label">Cliente</div>' +
            '<div class="processo-hero__stat-value">' +
              '<a href="#/clientes/' + esc(processo.clienteId) + '">' +
                esc(fmt.truncar(processo.clienteNome, 26)) + '</a>' +
            '</div>' +
            '<div class="u-xs u-subtle">' + esc(papel ? 'na posição de ' + papel.label.toLowerCase() : '') + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="processo-hero__stat-label">Valor da causa</div>' +
            '<div class="processo-hero__stat-value">' + esc(fmt.moeda(processo.valorCausa)) + '</div>' +
            (processo.valorProvisao
              ? '<div class="u-xs u-subtle">provisão ' + esc(fmt.moeda(processo.valorProvisao)) + '</div>'
              : '') +
          '</div>' +
          '<div>' +
            '<div class="processo-hero__stat-label">Próximo prazo</div>' +
            '<div class="processo-hero__stat-value">' +
              (prazo
                ? ui.PrazoChip({ semaforo: prazo.semaforo, diasRestantes: prazo.diasRestantes })
                : '<span class="u-sm u-subtle">Nenhum em aberto</span>') +
            '</div>' +
            (prazo ? '<div class="u-xs u-subtle">' + esc(prazo.titulo) + ' · ' +
                     esc(fmt.data(prazo.dataFatal)) + '</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function cabecalho() {
    var ui = App.components.ui;
    return '<div class="breadcrumb">' +
             '<a href="#/processos">Processos</a>' +
             '<span class="breadcrumb__sep">/</span>' +
             '<span>' + esc(processo.numeroInterno) + '</span>' +
           '</div>' +
           '<div class="page-header">' +
             '<div>' +
               '<h1 class="page-header__title">' + esc(processo.assunto) + '</h1>' +
               '<p class="page-header__subtitle">' +
                 esc(processo.vara + ' · ' + processo.comarca + ' · ' +
                     App.domain.enums.rotulo(App.domain.enums.TRIBUNAIS, processo.tribunalId)) +
               '</p>' +
             '</div>' +
             '<div class="page-header__actions">' +
               ui.Button({ rotulo: 'Novo prazo', variante: 'secondary', icone: '⏱', acao: 'novo-prazo' }) +
               ui.Button({ rotulo: 'Novo andamento', variante: 'secondary', icone: '+', acao: 'novo-andamento' }) +
               ui.Button({ rotulo: 'Editar', variante: 'primary', icone: '✎',
                           href: '#/processos/' + processo.id + '/editar' }) +
             '</div>' +
           '</div>';
  }

  // --- Abas -----------------------------------------------------------------

  function abas() {
    var abertos = processo.prazos.filter(function (pz) {
      return pz.status === 'pendente' || pz.status === 'em_andamento';
    }).length;

    return App.components.ui.Tabs({
      ativa: abaAtiva,
      abas: [
        { id: 'dados',      label: 'Dados' },
        { id: 'partes',     label: 'Partes',      contador: processo.partes.length },
        { id: 'andamentos', label: 'Andamentos',  contador: processo.andamentos.length },
        { id: 'prazos',     label: 'Prazos',      contador: abertos },
        { id: 'documentos', label: 'Documentos',  contador: processo.documentos.length },
        { id: 'tarefas',    label: 'Tarefas',     contador: processo.tarefas.length },
        { id: 'financeiro', label: 'Financeiro' },
        { id: 'portal',     label: 'Compartilhamento',
          contador: linksAtivos.length || null },
        { id: 'assistente', label: 'Assistente' }
      ]
    });
  }

  function painelDados() {
    var enums = App.domain.enums;
    var fmt = App.format;
    var cnj = App.domain.cnj.parsear(processo.numeroCnj);

    function item(termo, descricao) {
      return '<div>' +
               '<div class="def-list__term">' + esc(termo) + '</div>' +
               '<div class="def-list__desc">' + (descricao || '—') + '</div>' +
             '</div>';
    }

    return '<div class="tab-panel">' +
      '<div class="def-list">' +
        item('Número CNJ', '<span class="u-mono">' + esc(processo.numeroCnj) + '</span>') +
        item('Número interno', esc(processo.numeroInterno)) +
        item('Classe processual', esc(processo.classeProcessual)) +
        item('Assunto', esc(processo.assunto)) +
        item('Tribunal', esc(enums.rotulo(enums.TRIBUNAIS, processo.tribunalId))) +
        item('Comarca', esc(processo.comarca)) +
        item('Vara', esc(processo.vara)) +
        item('Magistrado', esc(processo.juiz)) +
        item('Instância', esc(enums.rotulo(enums.INSTANCIAS, processo.instancia))) +
        item('Distribuição', esc(fmt.data(processo.dataDistribuicao)) +
             ' <span class="u-xs u-subtle">(' + esc(fmt.dataRelativa(processo.dataDistribuicao)) + ')</span>') +
        item('Valor da causa', esc(fmt.moeda(processo.valorCausa))) +
        item('Provisão de risco', esc(fmt.moeda(processo.valorProvisao))) +
        item('Responsável',
             App.components.ui.Avatar({ usuario: processo.responsavel, tamanho: 'sm' }) +
             ' <span style="vertical-align:middle">' + esc(processo.responsavelNome) + '</span>') +
        item('Equipe', processo.equipe.length
             ? App.components.ui.AvatarGroup({ usuarios: processo.equipe, max: 5 })
             : '<span class="u-subtle">—</span>') +
      '</div>' +

      '<div class="divider"></div>' +

      blocoVinculados() +

      '<div class="divider"></div>' +

      '<h4 style="margin-bottom:var(--space-3)">Decomposição do número CNJ</h4>' +
      (cnj
        ? '<div class="cnj-preview">' +
            campoCnj('Sequencial', cnj.sequencial) +
            campoCnj('Dígito verificador', cnj.dv) +
            campoCnj('Ano', cnj.ano) +
            campoCnj('Segmento', cnj.segmento + ' — ' + cnj.segmentoNome) +
            campoCnj('Tribunal', cnj.tribunal) +
            campoCnj('Origem', cnj.origem) +
          '</div>'
        : '<p class="u-sm u-muted">Número fora do padrão CNJ.</p>') +
    '</div>';
  }

  /* PROCESSOS VINCULADOS (F2.10)
     Cautelar, execução, embargos e apenso são processos separados na
     numeração e um só caso na prática. Quem abre um precisa enxergar os
     outros — senão o prazo é conferido no processo errado.

     O que não aparece aqui: vínculo com processo em segredo de justiça que
     o usuário não pode ver. O service já filtrou; a tela não sabe que
     existe, que é o comportamento certo. */
  function blocoVinculados() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var pai = processo.processoPai;
    var apensos = processo.apensos || [];

    function linha(p, papel) {
      return '<a class="vinculo" href="#/processos/' + esc(p.id) + '">' +
        '<span class="vinculo__papel">' + esc(papel) + '</span>' +
        '<span class="vinculo__num u-mono">' + esc(p.numeroCnj || p.numeroInterno) + '</span>' +
        '<span class="vinculo__assunto">' + esc(p.assunto) + '</span>' +
        ui.BadgeEnum(enums.STATUS_PROCESSO, p.status) +
      '</a>';
    }

    var corpo;
    if (!pai && !apensos.length) {
      corpo = '<p class="u-sm u-muted">Nenhum processo vinculado. Use o vínculo para ' +
              'cautelar, execução, embargos e apensos — eles continuam com numeração ' +
              'própria, mas passam a ser vistos juntos.</p>';
    } else {
      corpo = '<div class="vinculo-lista">' +
        (pai ? linha(pai, 'principal') : '') +
        apensos.map(function (p) { return linha(p, 'apenso'); }).join('') +
      '</div>';
    }

    return '<div class="u-row" style="align-items:baseline">' +
             '<h4 style="margin-bottom:var(--space-3)">Processos vinculados' +
               (apensos.length ? ' <span class="u-subtle u-sm">(' + apensos.length +
                                 ' apenso(s))</span>' : '') +
             '</h4>' +
             '<span class="u-spacer"></span>' +
             (App.domain.permissoes.podeEditarProcesso(
                App.services.sessaoService.atual(), processo)
               ? ui.Button({ rotulo: pai ? 'Alterar vínculo' : 'Vincular a um processo',
                             tamanho: 'sm', variante: 'ghost', acao: 'vincular-processo' })
               : '') +
           '</div>' + corpo;
  }

  function campoCnj(rotulo, valor) {
    return '<div>' +
             '<div class="cnj-preview__item-label">' + esc(rotulo) + '</div>' +
             '<div class="cnj-preview__item-value">' + esc(valor) + '</div>' +
           '</div>';
  }

  function painelPartes() {
    var enums = App.domain.enums;
    var ui = App.components.ui;

    if (!processo.partes.length) {
      return '<div class="tab-panel">' + ui.EmptyState({
        icone: '👥', titulo: 'Nenhuma parte cadastrada'
      }) + '</div>';
    }

    var poloRotulo = { ativo: 'Polo ativo', passivo: 'Polo passivo', terceiro: 'Terceiros' };
    var porPolo = App.selectors.agrupar(processo.partes, 'polo');

    var html = '<div class="tab-panel tab-panel--flush">';

    ['ativo', 'passivo', 'terceiro'].forEach(function (polo) {
      var partes = porPolo[polo];
      if (!partes || !partes.length) return;

      html += '<div class="fieldset__legend" style="padding:var(--space-3) var(--space-4);margin:0">' +
                esc(poloRotulo[polo]) +
              '</div>';

      partes.forEach(function (parte) {
        var pessoa = parte.pessoa || {};
        var tipo = enums.achar(enums.TIPOS_PARTICIPACAO, parte.tipoParticipacao);
        var ehCliente = pessoa.id === processo.clienteId;

        html += '<div class="parte-item">' +
                  ui.Avatar({ nome: pessoa.nome, cor: ehCliente ? 'var(--color-primary-600)'
                                                                : 'var(--color-text-subtle)' }) +
                  '<div style="flex:1;min-width:0">' +
                    '<div class="u-bold u-truncate">' +
                      (ehCliente
                        ? '<a href="#/clientes/' + esc(pessoa.id) + '">' + esc(pessoa.nome) + '</a>'
                        : esc(pessoa.nome)) +
                    '</div>' +
                    '<div class="u-xs u-subtle">' +
                      esc(pessoa.tipo === 'PJ' ? 'CNPJ ' : 'CPF ') +
                      esc(App.format.documento(pessoa.documento)) +
                    '</div>' +
                  '</div>' +
                  (ehCliente ? ui.Badge({ rotulo: 'Nosso cliente', variante: 'primary' }) : '') +
                  (tipo ? ui.Badge({ rotulo: tipo.label, variante: 'neutral' }) : '') +
                '</div>';
      });
    });

    return html + '</div>';
  }

  function painelAndamentos() {
    return '<div class="tab-panel">' +
      App.components.Timeline({
        andamentos: processo.andamentos,
        limite: verTodosAndamentos ? null : 8
      }) +
    '</div>';
  }

  function painelPrazos() {
    var ui = App.components.ui;
    var abertos = processo.prazos.filter(function (pz) {
      return pz.status === 'pendente' || pz.status === 'em_andamento';
    });
    var encerrados = processo.prazos.filter(function (pz) {
      return pz.status !== 'pendente' && pz.status !== 'em_andamento';
    });

    var html = '<div class="tab-panel tab-panel--flush">';

    html += '<div class="fieldset__legend" style="padding:var(--space-3) var(--space-4);margin:0">' +
              'Em aberto (' + abertos.length + ')</div>';
    html += App.components.PrazoList({
      prazos: abertos,
      acoes: true,
      mostrarProcesso: false,
      tituloVazio: 'Nenhum prazo em aberto',
      textoVazio: 'Cadastre um prazo pelo botão “Novo prazo”.'
    });

    if (encerrados.length) {
      html += '<div class="fieldset__legend" style="padding:var(--space-3) var(--space-4);margin:0">' +
                'Histórico (' + encerrados.length + ')</div>';
      html += App.components.PrazoList({ prazos: encerrados, mostrarProcesso: false });
    }

    return html + '</div>';
  }

  // --- Documentos e pastas --------------------------------------------------

  function pastas() {
    return processo.pastasDocumento || [];
  }

  /** A pasta aberta pode ter sido excluída em outra ação — cai para a raiz. */
  function pastaAtualValida() {
    if (!pastaAtual) return null;
    var existe = pastas().filter(function (p) { return p.id === pastaAtual; })[0];
    return existe ? pastaAtual : null;
  }

  function painelDocumentos() {
    pastaAtual = pastaAtualValida();

    var servico = App.services.pastaDocumentoService;

    return '<div class="tab-panel tab-panel--flush">' +
      App.components.DocumentExplorer({
        pastas: servico.resumir(pastas(), processo.documentos),
        documentos: processo.documentos,
        pastaAtual: pastaAtual,
        caminho: servico.caminhoDe(pastas(), pastaAtual)
      }) +
    '</div>';
  }

  function painelTarefas() {
    var ui = App.components.ui;
    var fmt = App.format;
    var enums = App.domain.enums;

    if (!processo.tarefas.length) {
      return '<div class="tab-panel">' + ui.EmptyState({
        icone: '☑', titulo: 'Nenhuma tarefa vinculada',
        acao: ui.Button({ rotulo: 'Ir para o quadro de tarefas', variante: 'secondary', href: '#/tarefas' })
      }) + '</div>';
    }

    var html = '<div class="tab-panel tab-panel--flush">';
    processo.tarefas.forEach(function (tarefa) {
      var status = enums.achar(enums.STATUS_TAREFA, tarefa.status);
      var prioridade = enums.achar(enums.PRIORIDADES, tarefa.prioridade);
      var atrasada = tarefa.status !== 'concluida' && tarefa.dataVencimento < App.domain.prazos.hojeISO();

      html += '<div class="doc-item">' +
                ui.Avatar({ usuario: tarefa.responsavel, tamanho: 'sm' }) +
                '<div style="flex:1;min-width:0">' +
                  '<div class="u-sm u-bold u-truncate">' + esc(tarefa.titulo) + '</div>' +
                  '<div class="u-xs u-subtle">Vence em ' + esc(fmt.data(tarefa.dataVencimento)) + '</div>' +
                '</div>' +
                (atrasada ? ui.Badge({ rotulo: 'Atrasada', variante: 'danger' }) : '') +
                (prioridade ? ui.Badge({ rotulo: prioridade.label, variante: prioridade.variante }) : '') +
                (status ? ui.Badge({ rotulo: status.label, cor: status.cor, ponto: true }) : '') +
              '</div>';
    });

    return html + '</div>';
  }

  // --- Aba Compartilhamento (F2.3) -------------------------------------------

  var links = [];
  var linksAtivos = [];

  function carregarLinks() {
    if (!processo) return Promise.resolve();
    return App.services.compartilhamentoService.listarDoProcesso(processo.id)
      .then(function (lista) {
        links = lista;
        linksAtivos = lista.filter(function (l) { return l.valido; });
      })
      .catch(function () { links = []; linksAtivos = []; });
  }

  function linhaLink(link) {
    var ui = App.components.ui;
    var situacao = link.revogadoEm ? ui.Badge({ rotulo: 'Revogado', variante: 'neutral' })
                 : link.expirado   ? ui.Badge({ rotulo: 'Expirado', variante: 'warning' })
                                   : ui.Badge({ rotulo: 'Ativo', variante: 'success' });

    var secoes = App.services.compartilhamentoService.CHAVES_ESCOPO
      .filter(function (c) { return link.escopo[c]; })
      .join(', ');

    return '<tr>' +
      '<td>' +
        '<div class="u-row" style="gap:var(--space-2)">' +
          '<input class="input input--sm u-mono" style="flex:1;min-width:0" readonly' +
            ' value="' + esc(link.url) + '" data-link-url="' + esc(link.id) + '">' +
          App.components.ui.Button({
            rotulo: 'Copiar', tamanho: 'sm', acao: 'copiar-link', valor: link.id
          }) +
        '</div>' +
        '<div class="u-xs u-subtle" style="margin-top:2px">' + esc(secoes) + '</div>' +
      '</td>' +
      '<td class="u-sm">' + esc(App.format.data(link.expiraEm)) + '</td>' +
      '<td class="u-sm u-tabular">' + (link.totalAcessos || 0) +
        (link.ultimoAcessoEm
          ? '<div class="u-xs u-subtle">último ' + esc(App.format.dataHora(link.ultimoAcessoEm)) + '</div>'
          : '') +
      '</td>' +
      '<td>' + situacao + '</td>' +
      '<td class="u-right">' +
        (link.revogadoEm || link.expirado ? '' : ui.Button({
          rotulo: 'Revogar', tamanho: 'sm', variante: 'ghost',
          acao: 'revogar-link', valor: link.id
        })) +
      '</td>' +
    '</tr>';
  }

  function painelPortal() {
    var ui = App.components.ui;
    var podeCompartilhar = App.services.sessaoService.pode('portal.compartilhar');

    if (processo.segredoJustica) {
      return '<div class="tab-panel">' +
        ui.EmptyState({
          icone: '🔒',
          titulo: 'Processo em segredo de justiça',
          texto: 'Processo em segredo não pode ser compartilhado por link. ' +
                 'É a regra do processo, não uma preferência do escritório.'
        }) +
      '</div>';
    }

    var visiveis = {
      andamentos: processo.andamentos.filter(function (a) { return a.visivelCliente; }).length,
      documentos: processo.documentos.filter(function (d) { return d.visivelCliente; }).length,
      prazos: processo.prazos.filter(function (pz) { return pz.visivelCliente; }).length
    };

    var tabela = links.length
      ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Link</th><th>Validade</th><th>Acessos</th><th>Situação</th><th></th>' +
        '</tr></thead><tbody>' + links.map(linhaLink).join('') + '</tbody></table></div>'
      : ui.EmptyState({
          icone: '🔗',
          titulo: 'Nenhum link gerado',
          texto: 'Gere um link para o cliente acompanhar o processo sem precisar ligar.'
        });

    return '<div class="tab-panel">' +
      '<div class="u-row" style="justify-content:space-between;margin-bottom:var(--space-4)">' +
        '<div>' +
          '<h3 class="u-bold">Acompanhamento pelo cliente</h3>' +
          '<p class="u-sm u-muted" style="margin:2px 0 0">' +
            'O portal mostra apenas o que estiver marcado como visível ao cliente: ' +
            visiveis.andamentos + ' andamento(s), ' + visiveis.documentos +
            ' documento(s) e ' + visiveis.prazos + ' prazo(s).' +
          '</p>' +
        '</div>' +
        '<div class="u-row" style="gap:var(--space-2)">' +
          ui.Button({ rotulo: 'Revisar visibilidade', acao: 'revisar-visibilidade' }) +
          ui.Button({
            rotulo: 'Gerar link', variante: 'primary', icone: '🔗', acao: 'novo-link',
            desabilitado: !podeCompartilhar,
            titulo: podeCompartilhar ? '' : 'Seu perfil não compartilha processo com cliente'
          }) +
        '</div>' +
      '</div>' +
      tabela +
      '<p class="u-xs u-subtle" style="margin-top:var(--space-4)">' +
        'O que o cliente NÃO vê: valor da causa, provisão, risco, equipe interna, ' +
        'notas internas e qualquer prazo ou documento não marcado como visível.' +
      '</p>' +
    '</div>';
  }

  // --- Aba Assistente (F2.8) --------------------------------------------------

  var analiseIa = null;
  var carregandoIa = false;

  function painelAssistente() {
    /* A análise é buscada na primeira vez que a aba abre, e não junto do
       processo: quem não usa o assistente não paga por ele. */
    if (!analiseIa && !carregandoIa) {
      carregandoIa = true;
      App.services.iaService.analisarProcesso(processo.id).then(function (r) {
        analiseIa = r;
        carregandoIa = false;
        if (abaAtiva === 'assistente') desenhar();
      }).catch(function () {
        carregandoIa = false;
      });
    }

    return '<div class="tab-panel">' +
      App.components.AssistentePanel({
        analise: analiseIa,
        carregando: carregandoIa
      }) +
    '</div>';
  }

  // --- Aba Financeiro (F2.10, adiada de F2.5) ---------------------------------

  var financeiro = null;
  var carregandoFinanceiro = false;

  /* O financeiro do escritório já existia em #/financeiro, mas ali ele é
     visto por competência e por cliente. Quem está DENTRO do processo tem
     outra pergunta: este caso se paga? Por isso a aba mostra rentabilidade
     — receita menos despesas menos o custo das horas apontadas — e não um
     extrato. */
  function painelFinanceiro() {
    var ui = App.components.ui;
    var fmt = App.format;

    if (!financeiro && !carregandoFinanceiro) {
      carregandoFinanceiro = true;
      Promise.all([
        App.services.lancamentoService.rentabilidadeDoProcesso(processo.id),
        App.services.lancamentoService.listar({ processoId: processo.id })
      ]).then(function (r) {
        financeiro = { rentabilidade: r[0], lancamentos: r[1].itens };
        carregandoFinanceiro = false;
        if (abaAtiva === 'financeiro') desenhar();
      }).catch(function () {
        carregandoFinanceiro = false;
      });
    }

    if (!financeiro) {
      return '<div class="tab-panel">' + ui.Skeleton({ linhas: 5 }) + '</div>';
    }

    var r = financeiro.rentabilidade;
    var positivo = r.resultadoCentavos >= 0;

    var linhas = financeiro.lancamentos.map(function (l) {
      return '<tr>' +
        '<td class="u-tabular u-sm">' + esc(fmt.data(l.dataVencimento)) + '</td>' +
        '<td>' + esc(l.descricao) + '</td>' +
        '<td>' + ui.BadgeEnum(App.domain.enums.ORIGENS_LANCAMENTO, l.origem) + '</td>' +
        '<td class="u-right u-tabular' + (l.tipo === 'receita' ? '' : ' u-muted') + '">' +
          (l.tipo === 'receita' ? '' : '−') + esc(fmt.moeda(l.valorCentavos)) +
        '</td>' +
        '<td>' + ui.BadgeEnum(App.domain.enums.STATUS_LANCAMENTO, l.situacao) + '</td>' +
      '</tr>';
    }).join('');

    return '<div class="tab-panel">' +
      '<div class="grid grid--kpi">' +
        ui.Kpi({ rotulo: 'Receita', valor: fmt.moeda(r.receitaCentavos), icone: '↑',
                 cor: 'var(--color-success)' }) +
        ui.Kpi({ rotulo: 'Despesas', valor: fmt.moeda(r.despesaCentavos), icone: '↓',
                 cor: 'var(--color-warning)' }) +
        ui.Kpi({ rotulo: 'Custo das horas', valor: fmt.moeda(r.custoHorasCentavos),
                 icone: '⏱', dica: Math.round(r.minutos / 60) + 'h apontadas',
                 cor: 'var(--color-info)' }) +
        ui.Kpi({ rotulo: 'Resultado', valor: fmt.moeda(r.resultadoCentavos),
                 icone: positivo ? '✔' : '✕',
                 cor: positivo ? 'var(--color-success)' : 'var(--color-danger)' }) +
      '</div>' +

      '<p class="u-sm u-muted">O custo das horas usa o valor-hora do contrato deste ' +
      'processo' + (r.contrato ? '' : ' — como não há contrato vinculado, aplica-se a ' +
      'referência do escritório') + '. Sem esse custo, todo processo pareceria lucrativo.</p>' +

      (linhas
        ? '<div class="table-wrap"><table class="table"><thead><tr>' +
            '<th>Vencimento</th><th>Descrição</th><th>Origem</th>' +
            '<th class="u-right">Valor</th><th>Situação</th>' +
          '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
        : ui.EmptyState({
            icone: '💰', titulo: 'Nenhum lançamento neste processo',
            texto: 'Honorários, custas e reembolsos lançados aqui entram na rentabilidade.',
            acao: ui.Button({ rotulo: 'Abrir o financeiro', variante: 'secondary',
                              href: '#/financeiro' })
          })) +
    '</div>';
  }

  var PAINEIS = {
    dados: painelDados,
    partes: painelPartes,
    andamentos: painelAndamentos,
    prazos: painelPrazos,
    documentos: painelDocumentos,
    tarefas: painelTarefas,
    financeiro: painelFinanceiro,
    portal: painelPortal,
    assistente: painelAssistente
  };

  function desenhar() {
    container.innerHTML =
      cabecalho() +
      heroi() +
      '<div class="card" style="margin-top:var(--space-4)">' +
        abas() +
        (PAINEIS[abaAtiva] || painelDados)() +
      '</div>';
  }

  // --- Interações -----------------------------------------------------------

  function ligarEventos() {
    var Modal = App.components.Modal;
    var Toast = App.components.Toast;

    App.dom.delegate(container, 'click', '[data-action="trocar-aba"]', function (evento, botao) {
      abaAtiva = botao.dataset.value;
      desenhar();
    });

    App.dom.delegate(container, 'click', '[data-action="ver-todos-andamentos"]', function () {
      verTodosAndamentos = true;
      desenhar();
    });

    App.dom.delegate(container, 'click', '[data-action="vincular-processo"]', abrirVinculo);

    App.dom.delegate(container, 'click', '[data-action="cumprir-prazo"]', function (evento, botao) {
      App.services.prazoService.cumprir(botao.dataset.value).then(function (prazo) {
        var exigeConferencia = App.services.regraAlertaService.exigeDuplaConferencia();
        Toast.sucesso('Prazo baixado', exigeConferencia
          ? prazo.titulo + ' — aguardando conferência de outra pessoa.'
          : prazo.titulo + ' marcado como cumprido.');
        carregar(processo.id);
      }).catch(function (erro) {
        Toast.erro('Não foi possível baixar o prazo', erro.message);
      });
    });

    App.dom.delegate(container, 'click', '[data-action="conferir-prazo"]', function (evento, botao) {
      App.services.prazoService.conferir(botao.dataset.value).then(function (prazo) {
        Toast.sucesso('Prazo conferido', prazo.titulo + ' teve a baixa confirmada.');
        carregar(processo.id);
      }).catch(function (erro) {
        Toast.erro('Não foi possível conferir', erro.message);
      });
    });

    App.dom.delegate(container, 'click', '[data-action="marcar-perdido"]', function (evento, botao) {
      abrirMotivoPerda(botao.dataset.value);
    });

    App.dom.delegate(container, 'click', '[data-action="novo-andamento"]', abrirNovoAndamento);
    App.dom.delegate(container, 'click', '[data-action="novo-prazo"]', abrirNovoPrazo);

    // --- Compartilhamento com o cliente (F2.3) ---
    App.dom.delegate(container, 'click', '[data-action="novo-link"]', abrirNovoLink);
    App.dom.delegate(container, 'click', '[data-action="revisar-visibilidade"]',
                     abrirRevisaoVisibilidade);

    App.dom.delegate(container, 'click', '[data-action="copiar-link"]', function (evento, botao) {
      var campo = App.dom.qs('[data-link-url="' + botao.dataset.value + '"]', container);
      if (!campo) return;
      copiarTexto(campo.value, campo);
    });

    App.dom.delegate(container, 'click', '[data-action="revogar-link"]', function (evento, botao) {
      App.components.Modal.confirmar({
        titulo: 'Revogar link',
        mensagem: 'Quem tiver o link deixa de conseguir abrir o acompanhamento.',
        detalhe: 'O histórico de acessos é preservado. Você pode gerar um link novo depois.',
        rotuloConfirmar: 'Revogar',
        variante: 'danger'
      }).then(function (confirmado) {
        if (!confirmado) return;
        App.services.compartilhamentoService.revogar(botao.dataset.value).then(function () {
          Toast.sucesso('Link revogado');
          carregarLinks().then(desenhar);
        });
      });
    });

    ligarEventosDocumentos();
  }

  // --- Interações da aba Documentos -----------------------------------------

  /** Recarrega o processo mantendo a aba e a pasta abertas. */
  function recarregar() {
    carregar(processo.id);
  }

  function acharPasta(id) {
    return pastas().filter(function (p) { return p.id === id; })[0] || null;
  }

  function ligarEventosDocumentos() {
    var Toast = App.components.Toast;
    var servicoPasta = App.services.pastaDocumentoService;

    App.dom.delegate(container, 'click', '[data-action="abrir-pasta"]', function (evento, alvo) {
      pastaAtual = alvo.dataset.value || null;
      desenhar();
    });

    App.dom.delegate(container, 'click', '[data-action="nova-pasta"]', function (evento, botao) {
      abrirNovaPasta(botao.dataset.value || null);
    });

    App.dom.delegate(container, 'click', '[data-action="renomear-pasta"]', function (evento, botao) {
      abrirRenomearPasta(botao.dataset.value);
    });

    App.dom.delegate(container, 'click', '[data-action="mover-pasta"]', function (evento, botao) {
      abrirMover('pasta', botao.dataset.value);
    });

    App.dom.delegate(container, 'click', '[data-action="mover-documento"]', function (evento, botao) {
      abrirMover('documento', botao.dataset.value);
    });

    App.dom.delegate(container, 'click', '[data-action="enviar-documentos"]', function (evento, botao) {
      abrirEnvio(botao.dataset.value || null);
    });

    App.dom.delegate(container, 'click', '[data-action="novo-documento"]', function (evento, botao) {
      abrirNovoDocumento(botao.dataset.value || null);
    });

    App.dom.delegate(container, 'click', '[data-action="documento-de-modelo"]',
      function (evento, botao) {
        abrirDocumentoDeModelo(botao.dataset.value || null);
      });

    // --- Assistente (F2.8) ---
    App.dom.delegate(container, 'click', '[data-action="ia-perguntar"]', function () {
      var campo = App.dom.qs('#ia-pergunta', container);
      var alvo = App.dom.qs('#ia-resposta', container);
      if (!campo || !alvo || !campo.value.trim()) return;

      alvo.innerHTML = '<p class="ia__texto u-subtle">Consultando as regras…</p>';

      App.services.iaService.perguntar({
        processoId: processo.id, pergunta: campo.value
      }).then(function (r) {
        alvo.innerHTML =
          '<div class="ia-resposta' + (r.respondeu ? '' : ' ia-resposta--nao-sei') + '">' +
            '<p class="ia__texto">' + esc(r.resposta) + '</p>' +
            '<p class="u-xs u-subtle">' + esc(r.aviso) + '</p>' +
          '</div>';
      }).catch(function (erro) {
        alvo.innerHTML = '<p class="ia__alerta">' + esc(erro.message) + '</p>';
      });
    });

    App.dom.delegate(container, 'keydown', '#ia-pergunta', function (evento) {
      if (evento.key !== 'Enter') return;
      var botao = App.dom.qs('[data-action="ia-perguntar"]', container);
      if (botao) botao.click();
    });

    App.dom.delegate(container, 'click', '[data-action="abrir-documento"]', function (evento, botao) {
      abrirDocumento(botao.dataset.value);
    });

    App.dom.delegate(container, 'click', '[data-action="baixar-documento"]', function (evento, botao) {
      baixarDocumento(botao.dataset.value);
    });

    App.dom.delegate(container, 'click', '[data-action="editar-documento"]', function (evento, botao) {
      abrirEditor(botao.dataset.value);
    });

    App.dom.delegate(container, 'click', '[data-action="excluir-pasta"]', function (evento, botao) {
      var pasta = acharPasta(botao.dataset.value);
      if (!pasta) return;

      App.components.Modal.confirmar({
        titulo: 'Excluir pasta',
        mensagem: 'Excluir a pasta “' + pasta.nome + '”?',
        detalhe: 'Os documentos e subpastas que estão dentro dela sobem um nível — nada é apagado.',
        rotuloConfirmar: 'Excluir pasta',
        variante: 'danger'
      }).then(function (confirmou) {
        if (!confirmou) return;

        servicoPasta.remover(pasta.id).then(function (resultado) {
          if (pastaAtual === pasta.id) pastaAtual = resultado.paiId;
          Toast.sucesso('Pasta excluída', resultado.documentosRealocados
            ? resultado.documentosRealocados + ' ' +
              App.format.plural(resultado.documentosRealocados, 'documento') + ' realocado(s).'
            : 'Nenhum documento foi perdido.');
          recarregar();
        }).catch(function (erro) {
          Toast.erro('Não foi possível excluir a pasta', erro.message);
        });
      });
    });

    // Drag & drop: documento ou pasta arrastados sobre uma pasta de destino.
    App.components.DocumentExplorer.mount(container, {
      aoMoverDocumento: function (documentoId, pastaDestinoId) {
        App.services.documentoService.mover(documentoId, pastaDestinoId).then(function (doc) {
          var destino = acharPasta(pastaDestinoId);
          Toast.sucesso('Documento movido',
            doc.nome + ' → ' + (destino ? destino.nome : 'raiz dos documentos'));
          recarregar();
        }).catch(function (erro) {
          Toast.erro('Não foi possível mover o documento', erro.message);
          recarregar();   // devolve a linha ao lugar de origem
        });
      },
      aoMoverPasta: function (pastaId, pastaDestinoId) {
        servicoPasta.mover(pastaId, pastaDestinoId).then(function (pasta) {
          var destino = acharPasta(pastaDestinoId);
          Toast.sucesso('Pasta movida',
            pasta.nome + ' → ' + (destino ? destino.nome : 'raiz dos documentos'));
          recarregar();
        }).catch(function (erro) {
          Toast.erro('Não foi possível mover a pasta', erro.message);
          recarregar();
        });
      },
      // Arquivo arrastado do computador: sobe direto na pasta sob o cursor,
      // com os padrões do escritório (categoria "outro", interno). Quem quer
      // escolher categoria e visibilidade usa "Enviar documentos".
      aoSoltarArquivos: function (arquivos, pastaDestinoId) {
        enviarArquivos(arquivos, pastaDestinoId, {
          categoria: 'outro',
          visivelCliente: false
        });
      }
    });
  }

  function acharDocumento(id) {
    return processo.documentos.filter(function (d) { return d.id === id; })[0] || null;
  }

  /** Documento + nome da pasta — o formato que o visor e a ficha esperam. */
  function documentoComPasta(doc) {
    var pasta = doc.pastaId ? acharPasta(doc.pastaId) : null;
    return Object.assign({}, doc, { pastaNome: pasta ? pasta.nome : null });
  }

  /**
   * Download do documento. Sempre entrega ALGO, e nunca conteúdo falso:
   *   - editado no editor interno → o texto editado (é a versão mais nova);
   *   - enviado nesta sessão → o arquivo real, com o nome original;
   *   - sem binário (todo documento do seed) → a ficha em .txt, com nome
   *     próprio, para ninguém confundir com o documento de verdade.
   */
  function baixarDocumento(documentoId) {
    var arquivos = App.services.arquivoService;
    var doc = acharDocumento(documentoId);
    if (!doc) {
      App.components.Toast.erro('Documento não encontrado');
      return;
    }

    // O texto editado tem precedência: baixar o binário antigo depois de
    // uma edição entregaria a versão errada.
    var conteudos = App.services.conteudoService;
    var editado = conteudos.ler(documentoId);
    if (conteudos.temTexto(editado)) return baixarEditado(doc, editado);

    // Nasceu no sistema e ninguém escreveu: baixar a ficha de um documento em
    // branco não ajuda ninguém — o que falta é escrever.
    if (doc.criadoNoEditor) {
      App.components.Toast.aviso('Documento em branco',
        '“' + doc.nome + '” foi criado no sistema e ainda não tem conteúdo. ' +
        'Abra o editor para escrever antes de baixar.');
      return;
    }

    if (arquivos.tem(documentoId)) {
      // A URL da sessão, quando existe, evita criar (e revogar) outra.
      var origem = arquivos.url(documentoId) || arquivos.arquivo(documentoId);

      App.dom.baixar(doc.nome, origem).then(function (ok) {
        if (ok) {
          App.components.Toast.sucesso('Download iniciado', doc.nome);
        } else {
          App.components.Toast.erro('Não foi possível baixar',
            'O navegador recusou preparar o arquivo.');
        }
      });
      return;
    }

    var nomeFicha = String(doc.nome).replace(/\.[^.]+$/, '') + ' — ficha.txt';
    var texto = App.components.DocumentViewer.fichaTexto(documentoComPasta(doc));

    App.dom.baixar(nomeFicha,
      'data:text/plain;charset=utf-8,' + encodeURIComponent(texto)
    ).then(function (ok) {
      if (!ok) {
        App.components.Toast.erro('Não foi possível baixar');
        return;
      }
      App.components.Toast.aviso('Sem arquivo para baixar',
        'O protótipo não guarda o binário deste documento — baixamos a ficha ' +
        'dele em .txt. Documentos enviados na sessão baixam o arquivo real.');
    });
  }

  /**
   * Documento com texto editado: baixa o que foi escrito, no formato do
   * próprio documento quando o protótipo sabe gerá-lo. Não sabendo (.docx,
   * .odt: pacotes ZIP), cai no .rtf, que abre no Word com a formatação
   * preservada — em vez de um arquivo com extensão mentirosa. O menu do
   * editor oferece a lista completa.
   */
  function baixarEditado(doc, editado) {
    var ehRico = editado.modo === 'rico';
    var extensao = String(doc.extensao || '').toLowerCase();

    var sabeGerar = App.exportar.FORMATOS.filter(function (f) {
      return f.extensao === extensao && f.id !== 'pdf';
    })[0];

    var formato = sabeGerar ? sabeGerar.id : (ehRico ? 'rtf' : 'txt');

    App.exportar.baixar(formato, {
      nome: doc.nome,
      modo: editado.modo,
      conteudo: editado.conteudo
    }).then(function (resultado) {
      if (!resultado.ok) {
        App.components.Toast.erro('Não foi possível baixar');
        return;
      }

      if (sabeGerar) {
        App.components.Toast.sucesso('Download iniciado',
          resultado.nome + ' · versão editada no sistema');
        return;
      }

      App.components.Toast.info('Baixado o texto editado, em .rtf',
        'O protótipo não monta um ' + extensao.toUpperCase() + ' de verdade; ' +
        'o RTF abre no Word com a formatação. O editor oferece outros formatos.');
    });
  }

  /**
   * Editor do documento — em ABA NOVA, de propósito.
   *
   * Ver não tira o usuário do sistema (o visor é modal), mas escrever é
   * trabalho longo: a aba separada deixa o processo aberto ao lado.
   *
   * O detalhe que manda no desenho: a aba nova nasce com o arquivoService
   * VAZIO — o binário não atravessa. Por isso o texto é gravado no
   * conteudoService ANTES de abrir, e é de lá que o editor lê.
   */
  function abrirEditor(documentoId, documentoJaCarregado) {
    var Toast = App.components.Toast;
    var conteudos = App.services.conteudoService;

    // O documento recém-criado ainda não está na lista da tela (recarregar()
    // é assíncrono) — por isso quem cria passa o registro adiante.
    var doc = documentoJaCarregado || acharDocumento(documentoId);
    if (!doc) return Toast.erro('Documento não encontrado');

    var modo = App.components.DocumentViewer.modoEdicao(doc);
    if (!modo) {
      return Toast.aviso('Este formato não se edita no navegador',
        String(doc.extensao || '').toUpperCase() + ' não abre no editor interno. ' +
        'Ele trabalha com texto (.txt, .md, .csv, .json…) e com documentos ' +
        'de texto formatado (.doc, .docx, .odt, .rtf).');
    }

    prepararConteudo(doc, modo).then(function (pronto) {
      if (!pronto) return;

      var caminho = '#/documentos/' + documentoId + '/editar';

      // Sem localStorage o texto não chega à outra aba: melhor editar aqui.
      if (!conteudos.suportado()) {
        Toast.info('Editando nesta aba',
          'O navegador bloqueou o armazenamento local, então o editor não ' +
          'pode abrir em aba separada.');
        App.router.ir(caminho);
        return;
      }

      var base = window.location.href.split('#')[0];
      var aba = null;
      try {
        aba = window.open(base + caminho, '_blank');
      } catch (e) {
        aba = null;
      }

      if (!aba) {
        // Bloqueador de pop-up. Não vale perder o clique do usuário.
        Toast.aviso('O navegador bloqueou a nova aba', 'Abrindo o editor aqui mesmo.');
        App.router.ir(caminho);
        return;
      }

      Toast.info('Editor aberto em outra aba', doc.nome);
    });
  }

  /**
   * Garante que o texto do documento existe no conteudoService antes de a
   * outra aba tentar lê-lo.
   * @returns {Promise<boolean>} false = deu errado e o usuário já foi avisado
   */
  function prepararConteudo(doc, modo) {
    var conteudos = App.services.conteudoService;
    var arquivos = App.services.arquivoService;

    if (conteudos.tem(doc.id)) return Promise.resolve(true);

    var arquivo = modo === 'texto' ? arquivos.arquivo(doc.id) : null;

    return lerTexto(arquivo).then(function (texto) {
      var usuario = App.store.getState().usuarioAtual;
      var resultado = conteudos.salvar(doc.id, {
        modo: modo,
        conteudo: texto || '',
        atualizadoPorId: usuario ? usuario.id : null
      });

      if (!resultado.ok) {
        App.components.Toast.erro('Não foi possível preparar a edição',
          resultado.motivo === 'tamanho'
            ? 'O arquivo tem ' + App.format.bytes(resultado.bytes) + ' de texto e o ' +
              'editor do protótipo trabalha com até ' +
              App.format.bytes(conteudos.LIMITE_BYTES) + '.'
            : 'O armazenamento local do navegador está cheio.');
        return false;
      }
      return true;
    });
  }

  /** FileReader em forma de promessa — resolve '' quando não há arquivo. */
  function lerTexto(arquivo) {
    if (!arquivo || typeof window.FileReader === 'undefined') return Promise.resolve('');

    return new Promise(function (resolve) {
      var leitor = new window.FileReader();
      leitor.onload = function () { resolve(String(leitor.result || '')); };
      leitor.onerror = function () { resolve(''); };
      leitor.readAsText(arquivo);
    });
  }

  /**
   * Visor do documento — SEMPRE disponível e SEMPRE dentro do sistema.
   * Sem nova aba: prévia (do texto editado, ou do binário da sessão) e ficha
   * de metadados no corpo de um modal. Só o botão "Editar" abre outra aba.
   */
  function abrirDocumento(documentoId) {
    var arquivos = App.services.arquivoService;
    var Visor = App.components.DocumentViewer;

    var doc = acharDocumento(documentoId);
    if (!doc) {
      App.components.Toast.erro('Documento não encontrado');
      return;
    }

    var temBinario = arquivos.tem(documentoId);
    var props = {
      documento: documentoComPasta(doc),
      arquivo: arquivos.arquivo(documentoId),
      url: temBinario ? arquivos.url(documentoId) : null,
      tipoPrevia: Visor.tipoPrevia(doc, temBinario)
    };

    var modoEdicao = Visor.modoEdicao(doc);

    // F2.7: abrir o documento É um acesso, e fica registrado.
    App.services.assinaturaService.registrarAcesso(documentoId, 'ver');

    var acoes = [
      { rotulo: 'Baixar', variante: 'secondary', acao: 'baixar' },
      { rotulo: 'Mover', variante: 'secondary', acao: 'mover' },
      { rotulo: 'Revisar', variante: 'secondary', acao: 'revisar' },
      { rotulo: 'Assinar', variante: 'secondary', acao: 'assinar' }
    ];

    // O botão só existe onde a edição é possível — nada de oferecer e falhar.
    if (modoEdicao) {
      acoes.push({ rotulo: 'Editar', variante: 'secondary', acao: 'editar' });
    }
    acoes.push({ rotulo: 'Fechar', variante: 'primary', acao: 'fechar', fechar: true });

    App.components.Modal.abrir({
      titulo: doc.nome,
      tamanho: 'lg',
      conteudo: Visor(props) + '<div id="painel-assinaturas"></div>',
      acoes: acoes,
      aoAbrir: function (corpo) {
        Visor.mount(corpo, props);
        desenharAssinaturas(documentoId, corpo);
      },
      aoAcao: function (acao, corpo, fechar) {
        // Baixar não fecha: o usuário costuma querer continuar olhando.
        if (acao === 'baixar') baixarDocumento(documentoId);
        // abrirMover() abre outro modal — o Modal fecha o anterior sozinho.
        if (acao === 'mover') abrirMover('documento', documentoId);
        // Editar leva para outra aba: deixar o modal aberto atrás não faz
        // sentido — o usuário volta para o processo, não para o visor.
        if (acao === 'editar') { fechar(); abrirEditor(documentoId); }
        if (acao === 'assinar') assinarDocumento(documentoId, corpo);
        if (acao === 'revisar') revisarDocumento(documentoId, corpo);
      }
    });
  }

  /**
   * Revisão da peça antes do protocolo (F2.8).
   *
   * Cada achado é um erro que já aconteceu em escritório de verdade:
   * variável não substituída, marcador de rascunho esquecido, CNJ inválido
   * no corpo, prazo citado que não bate com o cadastrado.
   */
  function revisarDocumento(documentoId, corpo) {
    var alvo = App.dom.qs('#painel-assinaturas', corpo);
    if (!alvo) return;

    alvo.innerHTML = '<p class="u-sm u-subtle">Conferindo a peça contra o cadastro…</p>';

    App.services.iaService.revisarDocumento(documentoId).then(function (r) {
      if (r.semTexto) {
        alvo.innerHTML = '<div class="ia-resposta"><p class="ia__texto">' +
          esc(r.aviso) + '</p></div>';
        return;
      }

      if (!r.achados.length) {
        alvo.innerHTML =
          '<div class="ia-resposta">' +
            '<p class="ia__texto">✓ Nenhum problema encontrado na conferência.</p>' +
            '<p class="u-xs u-subtle">' + esc(r.aviso) + '</p>' +
          '</div>';
        return;
      }

      var itens = r.achados.map(function (a) {
        return '<li class="revisao revisao--' + esc(a.gravidade) + '">' +
          '<div class="revisao__mensagem">' + esc(a.mensagem) + '</div>' +
          '<div class="revisao__detalhe">' + esc(a.detalhe) + '</div>' +
        '</li>';
      }).join('');

      alvo.innerHTML =
        '<div class="doc-rodape">' +
          '<div class="doc-rodape__bloco" style="grid-column:1/-1">' +
            '<h5 class="doc-rodape__titulo">Revisão da peça</h5>' +
            (r.criticos
              ? '<p class="ia__alerta">' + r.criticos +
                ' problema(s) crítico(s) — não protocole assim.</p>'
              : '') +
            '<ul class="revisao-list">' + itens + '</ul>' +
            '<p class="u-xs u-subtle">' + esc(r.aviso) + '</p>' +
          '</div>' +
        '</div>';
    }).catch(function (erro) {
      alvo.innerHTML = '<p class="ia__alerta">' + esc(erro.message) + '</p>';
    });
  }

  /**
   * Gera documento a partir de modelo, dentro do processo (F2.7).
   *
   * A prévia da contagem aparece ANTES de criar: quantas variáveis o
   * processo resolve e quantas ficarão pendentes. Descobrir isso depois, no
   * editor, é descobrir tarde.
   */
  function abrirDocumentoDeModelo(pastaId) {
    var ui = App.components.ui;

    App.services.modeloPecaService.listar({}).then(function (lista) {
      if (!lista.length) {
        App.components.Toast.aviso('Nenhum modelo cadastrado',
          'Crie modelos em Modelos de peça.');
        return;
      }

      var opcoes = lista.map(function (m) {
        return { id: m.id, label: m.nome + ' (' + m.totalVariaveis + ' variáveis)' };
      });

      App.components.Modal.abrir({
        titulo: 'Novo documento a partir de modelo',
        conteudo:
          '<form id="form-doc-modelo">' +
            ui.Field({ nome: 'modeloId', rotulo: 'Modelo', tipo: 'select',
                       opcoes: App.domain.enums.opcoes(opcoes, opcoes[0].id) }) +
            ui.Field({ nome: 'nome', rotulo: 'Nome do documento',
                       valor: lista[0].nome }) +
          '</form>' +
          '<div id="previa-modelo"></div>',
        acoes: [
          { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
          { rotulo: 'Gerar', variante: 'primary', acao: 'gerar' }
        ],
        aoAbrir: function (corpo) {
          function atualizar() {
            var d = App.dom.formToObject(App.dom.qs('#form-doc-modelo', corpo));
            App.services.modeloPecaService.previa(d.modeloId, processo.id)
              .then(function (r) {
                var alvo = App.dom.qs('#previa-modelo', corpo);
                if (!alvo) return;
                alvo.innerHTML =
                  '<div class="preench">' +
                    '<div class="preench__linha">' +
                      '<span class="preench__ok">✓ ' + r.resolvidas.length +
                        ' preenchida(s) com os dados deste processo</span>' +
                      (r.pendentes.length
                        ? '<span class="preench__pendente">⚠ ' + r.pendentes.length +
                          ' sem valor</span>' : '') +
                    '</div>' +
                    (r.pendentes.length
                      ? '<p class="u-xs u-subtle">' +
                        r.pendentes.map(function (v) {
                          return '<code>' + esc(v) + '</code>';
                        }).join(', ') +
                        ' ficarão destacadas no documento para você completar.</p>'
                      : '') +
                  '</div>';
              });
          }

          App.dom.delegate(corpo, 'change', 'select[name="modeloId"]', function (e, campo) {
            var m = lista.filter(function (x) { return x.id === campo.value; })[0];
            var nome = App.dom.qs('input[name="nome"]', corpo);
            if (m && nome) nome.value = m.nome;
            atualizar();
          });
          atualizar();
        },
        aoAcao: function (acao, corpo, fecharModal) {
          if (acao !== 'gerar') return;
          var d = App.dom.formToObject(App.dom.qs('#form-doc-modelo', corpo));

          App.services.modeloPecaService.gerarDocumento({
            modeloId: d.modeloId,
            processoId: processo.id,
            pastaId: pastaId,
            nome: d.nome
          }).then(function (r) {
            fecharModal();
            App.components.Toast.sucesso('Documento gerado',
              r.pendentes.length
                ? r.pendentes.length + ' variável(is) destacadas para completar.'
                : 'Todas as variáveis foram preenchidas.');
            abrirEditor(r.documento.id);
          }).catch(function (erro) {
            App.components.Toast.erro('Não foi possível gerar', erro.message);
          });
        }
      });
    });
  }

  /** Painel de assinaturas e trilha de acesso, no rodapé do visor (F2.7). */
  function desenharAssinaturas(documentoId, corpo) {
    var alvo = App.dom.qs('#painel-assinaturas', corpo);
    if (!alvo) return;

    Promise.all([
      App.services.assinaturaService.conferir(documentoId),
      App.services.assinaturaService.acessos(documentoId)
    ]).then(function (r) {
      var conferencia = r[0];
      var acessos = r[1];

      var listaAssinaturas = conferencia.assinaturas.map(function (a) {
        return '<li class="assin' + (a.integra ? '' : ' assin--quebrada') + '">' +
          '<span class="assin__icone" aria-hidden="true">' +
            (a.integra ? '✓' : '⚠') + '</span>' +
          '<div>' +
            '<div class="u-sm u-bold">' + esc(a.signatarioNome) + '</div>' +
            '<div class="u-xs u-subtle">' + esc(App.format.dataHora(a.assinadoEm)) +
              ' · versão ' + a.versaoDocumento +
              ' · <code>' + esc(a.hash) + '</code></div>' +
            (a.integra
              ? ''
              : '<div class="u-xs" style="color:var(--color-danger)">' +
                'O documento foi ALTERADO depois desta assinatura.</div>') +
          '</div>' +
        '</li>';
      }).join('');

      var resumo = App.services.assinaturaService.resumoAcessos(documentoId);

      alvo.innerHTML =
        '<div class="doc-rodape">' +
          '<div class="doc-rodape__bloco">' +
            '<h5 class="doc-rodape__titulo">Assinaturas</h5>' +
            (conferencia.total
              ? '<ul class="assin-list">' + listaAssinaturas + '</ul>' +
                (conferencia.alterado
                  ? '<p class="u-xs" style="color:var(--color-danger)">' +
                    conferencia.quebradas + ' assinatura(s) não conferem com o texto atual.</p>'
                  : '')
              : '<p class="u-xs u-subtle">Nenhuma assinatura.</p>') +
            App.components.SeloSimulado({
              forma: 'linha',
              oque: 'não há ICP-Brasil nem carimbo do tempo. O que é real é o HASH: ' +
                    'se o texto mudar, a conferência acusa.',
              naFase3: 'assinatura com certificado A1/A3 e carimbo do tempo.'
            }) +
          '</div>' +
          '<div class="doc-rodape__bloco">' +
            '<h5 class="doc-rodape__titulo">Quem acessou</h5>' +
            '<p class="u-xs u-subtle">' +
              resumo.visualizacoes + ' visualização(ões) · ' +
              resumo.downloads + ' download(s) · ' +
              resumo.edicoes + ' edição(ões)' +
              (resumo.peloPortal ? ' · ' + resumo.peloPortal + ' pelo portal' : '') +
            '</p>' +
            (acessos.length
              ? '<ul class="acesso-list">' + acessos.slice(0, 6).map(function (a) {
                  return '<li><span>' + esc(a.usuarioNome) + '</span>' +
                         '<span class="u-xs u-subtle">' + esc(a.acao) + ' · ' +
                         esc(App.format.dataHora(a.quando)) + '</span></li>';
                }).join('') + '</ul>'
              : '') +
          '</div>' +
        '</div>';
    });
  }

  function assinarDocumento(documentoId, corpo) {
    App.services.assinaturaService.assinar(documentoId).then(function (a) {
      App.components.Toast.sucesso('Documento assinado',
        'Hash registrado: ' + a.hash);
      desenharAssinaturas(documentoId, corpo);
    }).catch(function (erro) {
      App.components.Toast.erro('Não foi possível assinar', erro.message);
    });
  }

  // --- Envio de documentos (upload simulado) --------------------------------

  /** Descrição do arquivo para o service — que não conhece o objeto File. */
  function descrever(arquivo) {
    return {
      nome: arquivo.name,
      tamanhoBytes: arquivo.size || 0,
      tipoMime: arquivo.type || null
    };
  }

  /**
   * Envia os arquivos e guarda o binário da sessão. Único caminho de envio:
   * serve tanto ao modal quanto ao arrasto de arquivos do computador.
   * @param {Array}    arquivos  objetos File
   * @param {Function} [aoProgresso]
   */
  function enviarArquivos(arquivos, pastaId, opcoes, aoProgresso) {
    var o = opcoes || {};

    return App.services.documentoService.enviar({
      processoId: processo.id,
      clienteId: processo.clienteId,
      pastaId: pastaId || null,
      categoria: o.categoria || 'outro',
      visivelCliente: !!o.visivelCliente,
      uploadPorId: App.store.getState().usuarioAtual.id,
      arquivos: arquivos.map(descrever)
    }, aoProgresso).then(function (criados) {
      // Mesma ordem dos arquivos enviados — é o contrato de enviar().
      criados.forEach(function (doc, indice) {
        App.services.arquivoService.guardar(doc.id, arquivos[indice]);
      });

      var destino = acharPasta(pastaId);
      App.components.Toast.sucesso(
        criados.length + ' ' + App.format.plural(criados.length, 'documento') + ' enviado(s)',
        'Em ' + (destino ? destino.nome : 'raiz dos documentos') +
        ' · o arquivo em si não é persistido no protótipo.');

      abaAtiva = 'documentos';
      recarregar();
      return criados;
    }).catch(function (erro) {
      App.components.Toast.erro('Falha no envio', erro.message);
      throw erro;
    });
  }

  /**
   * NOVO DOCUMENTO — o caminho oposto ao envio: não há arquivo nenhum, o
   * documento nasce em branco e vai direto para o editor, como o "documento
   * em branco" do Docs.
   *
   * O formato escolhido aqui é a identidade do documento no sistema e decide
   * em que modo o editor abre (texto puro ou formatado).
   */
  function abrirNovoDocumento(pastaId) {
    var ui = App.components.ui;
    var enums = App.domain.enums;

    var destinos = App.services.pastaDocumentoService.opcoesDestino(processo.id, null);
    var opcoesDestino = '<option value=""' + (pastaId ? '' : ' selected') + '>' +
                        'Raiz dos documentos</option>';
    destinos.forEach(function (opcao) {
      opcoesDestino += '<option value="' + esc(opcao.id) + '"' +
                       (opcao.id === pastaId ? ' selected' : '') + '>' +
                       esc(opcao.label) + '</option>';
    });

    App.components.Modal.abrir({
      titulo: 'Novo documento',
      conteudo: '<form id="form-novo-documento" class="form-grid">' +
        ui.Field({ nome: 'nome', rotulo: 'Nome do documento', obrigatorio: true,
                   placeholder: 'Ex.: Parecer sobre a contestação',
                   dica: 'A extensão vem do formato escolhido — não precisa digitar.' }) +
        ui.Field({ nome: 'formato', rotulo: 'Formato', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(enums.FORMATOS_DOCUMENTO, 'docx'),
                   dica: 'Word e OpenDocument abrem no editor de texto formatado.' }) +
        ui.Field({ nome: 'categoria', rotulo: 'Categoria', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(enums.CATEGORIAS_DOCUMENTO, 'outro') }) +
        ui.Field({ nome: 'pastaId', rotulo: 'Pasta de destino', tipo: 'select',
                   opcoes: opcoesDestino }) +
        ui.Field({ nome: 'visivelCliente', rotulo: 'Visível para o cliente no portal',
                   tipo: 'checkbox',
                   dica: 'O padrão é interno — documento de processo não vaza por descuido' }) +
        '<p class="u-xs u-subtle" id="novo-documento-nota"></p>' +
      '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Criar e escrever', variante: 'primary', acao: 'salvar' }
      ],
      aoAbrir: function (corpo) {
        var form = App.dom.qs('#form-novo-documento', corpo);
        var nota = App.dom.qs('#novo-documento-nota', corpo);

        /* A nota muda com o formato: quem escolhe .docx precisa saber, antes
           de escrever, que o download sai em .rtf ou .pdf. */
        function atualizarNota() {
          var formato = App.domain.enums.achar(App.domain.enums.FORMATOS_DOCUMENTO,
            form.elements.formato.value);
          if (!formato) { nota.innerHTML = ''; return; }

          nota.innerHTML = formato.geraArquivo
            ? 'O download entrega um <strong>.' + esc(formato.id) +
              '</strong> de verdade, gerado pelo sistema.'
            : '<strong>Atenção:</strong> o protótipo edita e guarda o texto, mas não ' +
              'monta o arquivo <strong>.' + esc(formato.id) + '</strong> (é um pacote ZIP). ' +
              'O download sai em .rtf, .html ou PDF — todos abrem no Word.';
        }

        form.addEventListener('change', atualizarNota);
        atualizarNota();
      },
      aoAcao: function (acao, corpo, fechar) {
        if (acao !== 'salvar') return;

        var dados = App.dom.formToObject(App.dom.qs('#form-novo-documento', corpo));
        if (!String(dados.nome || '').trim()) {
          App.components.Toast.aviso('Dê um nome ao documento.');
          return;
        }

        var botao = corpo.parentNode.querySelector('.modal__footer [data-action="salvar"]');
        if (botao) botao.disabled = true;

        App.services.documentoService.criarEmBranco({
          processoId: processo.id,
          clienteId: processo.clienteId,
          pastaId: dados.pastaId || null,
          nome: dados.nome,
          formato: dados.formato,
          categoria: dados.categoria,
          visivelCliente: dados.visivelCliente,
          uploadPorId: App.store.getState().usuarioAtual.id
        }).then(function (criado) {
          fechar();
          App.components.Toast.sucesso('Documento criado', criado.nome);

          abaAtiva = 'documentos';
          pastaAtual = criado.pastaId || null;
          recarregar();

          // Criar sem escrever não serve para nada: abre o editor na sequência.
          abrirEditor(criado.id, criado);
        }).catch(function (erro) {
          if (botao) botao.disabled = false;
          App.components.Toast.erro('Não foi possível criar o documento', erro.message);
        });
      }
    });
  }

  function abrirEnvio(pastaId) {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var servicoDoc = App.services.documentoService;

    var destinos = App.services.pastaDocumentoService.opcoesDestino(processo.id, null);
    var opcoesDestino = '<option value=""' + (pastaId ? '' : ' selected') + '>' +
                        'Raiz dos documentos</option>';
    destinos.forEach(function (opcao) {
      opcoesDestino += '<option value="' + esc(opcao.id) + '"' +
                       (opcao.id === pastaId ? ' selected' : '') + '>' +
                       esc(opcao.label) + '</option>';
    });

    App.components.Modal.abrir({
      titulo: 'Enviar documentos',
      conteudo: '<form id="form-envio" class="form-grid">' +
        ui.Field({ nome: 'arquivos', rotulo: 'Arquivos', tipo: 'file',
                   atributos: ' multiple', obrigatorio: true,
                   dica: 'Até ' + App.format.bytes(servicoDoc.LIMITE_UPLOAD_BYTES) +
                         ' por arquivo. Vários de uma vez.' }) +
        '<div class="field" id="envio-lista"></div>' +
        ui.Field({ nome: 'pastaId', rotulo: 'Pasta de destino', tipo: 'select',
                   largura: 6, opcoes: opcoesDestino }) +
        ui.Field({ nome: 'categoria', rotulo: 'Categoria', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(enums.CATEGORIAS_DOCUMENTO, 'outro') }) +
        ui.Field({ nome: 'visivelCliente', rotulo: 'Visível para o cliente no portal',
                   tipo: 'checkbox',
                   dica: 'O padrão é interno — documento de processo não vaza por descuido' }) +
        '<div class="field" id="envio-progresso"></div>' +
      '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Enviar', variante: 'primary', acao: 'salvar' }
      ],
      aoAbrir: function (corpo) {
        var campo = App.dom.qs('#form-envio [name="arquivos"]', corpo);
        var lista = App.dom.qs('#envio-lista', corpo);

        // Prévia da seleção: o usuário confere nome e tamanho antes de enviar.
        campo.addEventListener('change', function () {
          var arquivos = Array.prototype.slice.call(campo.files || []);
          if (!arquivos.length) { lista.innerHTML = ''; return; }

          var html = '<div class="envio-lista">';
          arquivos.forEach(function (arquivo) {
            var excede = (arquivo.size || 0) > servicoDoc.LIMITE_UPLOAD_BYTES;
            html += '<div class="envio-lista__item' +
                      (excede ? ' envio-lista__item--erro' : '') + '">' +
                      '<span class="doc-item__icon">' +
                        esc(servicoDoc.extensaoDe(arquivo.name)) + '</span>' +
                      '<div style="flex:1;min-width:0">' +
                        '<div class="u-sm u-truncate">' + esc(arquivo.name) + '</div>' +
                        '<div class="u-xs u-subtle">' + esc(App.format.bytes(arquivo.size)) +
                          (excede ? ' · acima do limite' : '') +
                        '</div>' +
                      '</div>' +
                    '</div>';
          });
          lista.innerHTML = html + '</div>';
        });
      },
      aoAcao: function (acao, corpo, fechar) {
        if (acao !== 'salvar') return;

        var form = App.dom.qs('#form-envio', corpo);
        var campo = App.dom.qs('[name="arquivos"]', form);
        var arquivos = Array.prototype.slice.call(campo.files || []);

        if (!arquivos.length) {
          App.components.Toast.aviso('Selecione ao menos um arquivo.');
          return;
        }

        var dados = App.dom.formToObject(form);
        var progresso = App.dom.qs('#envio-progresso', corpo);
        var botao = corpo.parentNode.querySelector('.modal__footer [data-action="salvar"]');

        // Trava o botão: um clique duplo não pode virar dois envios.
        if (botao) botao.disabled = true;

        enviarArquivos(arquivos, dados.pastaId || null, {
          categoria: dados.categoria,
          visivelCliente: dados.visivelCliente
        }, function (percentual) {
          progresso.innerHTML =
            '<div class="u-xs u-subtle" style="margin-bottom:var(--space-1)">' +
              'Enviando… ' + percentual + '%</div>' +
            App.components.ui.Progress({ percentual: percentual });
        }).then(function () {
          fechar();
        }).catch(function () {
          if (botao) botao.disabled = false;
          progresso.innerHTML = '';
        });
      }
    });
  }

  /* Vincular a um processo principal (F2.10).
     A lista de candidatos vem do próprio `listar`, que já aplica segredo de
     justiça — não montamos a lista a partir do banco cru. */
  function abrirVinculo() {
    var ui = App.components.ui;

    App.services.processoService.listar({ porPagina: 0 }).then(function (r) {
      var candidatos = r.itens.filter(function (p) {
        // Fora: ele mesmo e os que já são apensos dele (viraria ciclo).
        return p.id !== processo.id && p.processoPaiId !== processo.id;
      });

      var opcoes = '<option value="">— nenhum (processo independente) —</option>' +
        candidatos.map(function (p) {
          return '<option value="' + esc(p.id) + '"' +
                 (processo.processoPaiId === p.id ? ' selected' : '') + '>' +
                 esc((p.numeroCnj || p.numeroInterno) + ' — ' + p.assunto) +
                 '</option>';
        }).join('');

      App.components.Modal.abrir({
        titulo: 'Vincular processo',
        conteudo: '<form id="form-vinculo" class="form-grid">' +
          '<p class="u-sm u-muted">Escolha o processo <strong>principal</strong>. Este ' +
          'passa a constar como apenso dele, e os dois aparecem juntos nas duas telas. ' +
          'A numeração de cada um continua a mesma.</p>' +
          ui.Field({ nome: 'processoPaiId', rotulo: 'Processo principal', tipo: 'select',
                     opcoes: opcoes }) +
        '</form>',
        acoes: [
          { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
          { rotulo: 'Salvar vínculo', variante: 'primary', acao: 'salvar' }
        ],
        aoAcao: function (acao, corpo, fechar) {
          if (acao !== 'salvar') return;

          var dados = App.dom.formToObject(App.dom.qs('#form-vinculo', corpo));
          App.services.processoService.vincular(processo.id, dados.processoPaiId || null)
            .then(function () {
              fechar();
              App.components.Toast.sucesso(
                dados.processoPaiId ? 'Processo vinculado' : 'Vínculo desfeito');
              recarregar();
            })
            .catch(function (erro) {
              App.components.Toast.erro('Não foi possível vincular', erro.message);
            });
        }
      });
    });
  }

  function abrirNovaPasta(paiId) {
    var ui = App.components.ui;
    var pai = paiId ? acharPasta(paiId) : null;

    App.components.Modal.abrir({
      titulo: 'Nova pasta',
      conteudo: '<form id="form-pasta" class="form-grid">' +
        ui.Field({ nome: 'nome', rotulo: 'Nome da pasta', obrigatorio: true,
                   placeholder: 'Ex.: Petições protocoladas',
                   dica: pai ? 'Será criada dentro de “' + pai.nome + '”'
                             : 'Será criada na raiz dos documentos do processo' }) +
      '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Criar pasta', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fechar) {
        if (acao !== 'salvar') return;

        var dados = App.dom.formToObject(App.dom.qs('#form-pasta', corpo));
        if (!dados.nome || !dados.nome.trim()) {
          App.components.Toast.aviso('Informe o nome da pasta.');
          return;
        }

        App.services.pastaDocumentoService.criar({
          processoId: processo.id,
          nome: dados.nome,
          paiId: paiId || null,
          criadoPorId: App.store.getState().usuarioAtual.id
        }).then(function (pasta) {
          fechar();
          App.components.Toast.sucesso('Pasta criada', pasta.nome);
          recarregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível criar a pasta', erro.message);
        });
      }
    });
  }

  function abrirRenomearPasta(pastaId) {
    var pasta = acharPasta(pastaId);
    if (!pasta) return;

    App.components.Modal.abrir({
      titulo: 'Renomear pasta',
      conteudo: '<form id="form-pasta" class="form-grid">' +
        App.components.ui.Field({ nome: 'nome', rotulo: 'Nome da pasta',
                                  valor: pasta.nome, obrigatorio: true }) +
      '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Salvar', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fechar) {
        if (acao !== 'salvar') return;

        var dados = App.dom.formToObject(App.dom.qs('#form-pasta', corpo));
        App.services.pastaDocumentoService.renomear(pasta.id, dados.nome).then(function () {
          fechar();
          App.components.Toast.sucesso('Pasta renomeada');
          recarregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível renomear', erro.message);
        });
      }
    });
  }

  /**
   * Alternativa acessível ao arrasto: escolher o destino por <select>.
   * Arrastar é o caminho rápido; nem todo usuário (nem todo dispositivo) o tem.
   * @param {'documento'|'pasta'} tipo
   */
  function abrirMover(tipo, id) {
    var ehPasta = tipo === 'pasta';
    var alvo = ehPasta
      ? acharPasta(id)
      : processo.documentos.filter(function (d) { return d.id === id; })[0];

    if (!alvo) return;

    // Uma pasta não pode ser movida para dentro da própria descendência.
    var destinos = App.services.pastaDocumentoService.opcoesDestino(
      processo.id, ehPasta ? id : null);

    var atual = ehPasta ? (alvo.paiId || '') : (alvo.pastaId || '');
    var opcoes = '<option value=""' + (atual ? '' : ' selected') + '>' +
                 'Raiz dos documentos</option>';

    destinos.forEach(function (opcao) {
      opcoes += '<option value="' + esc(opcao.id) + '"' +
                (opcao.id === atual ? ' selected' : '') + '>' +
                esc(opcao.label) + '</option>';
    });

    App.components.Modal.abrir({
      titulo: ehPasta ? 'Mover pasta' : 'Mover documento',
      conteudo: '<form id="form-mover" class="form-grid">' +
        '<p class="u-sm u-muted">' + esc(alvo.nome) + '</p>' +
        App.components.ui.Field({ nome: 'destino', rotulo: 'Pasta de destino',
                                  tipo: 'select', opcoes: opcoes }) +
      '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Mover', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fechar) {
        if (acao !== 'salvar') return;

        var dados = App.dom.formToObject(App.dom.qs('#form-mover', corpo));
        var destino = dados.destino || null;

        var promessa = ehPasta
          ? App.services.pastaDocumentoService.mover(id, destino)
          : App.services.documentoService.mover(id, destino);

        promessa.then(function () {
          fechar();
          App.components.Toast.sucesso(ehPasta ? 'Pasta movida' : 'Documento movido');
          recarregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível mover', erro.message);
        });
      }
    });
  }

  function abrirNovoAndamento() {
    var ui = App.components.ui;
    var enums = App.domain.enums;

    App.components.Modal.abrir({
      titulo: 'Registrar andamento',
      conteudo: '<form id="form-andamento" class="form-grid">' +
        ui.Field({ nome: 'data', rotulo: 'Data', tipo: 'date',
                   valor: App.domain.prazos.hojeISO(), largura: 6, obrigatorio: true }) +
        ui.Field({ nome: 'tipo', rotulo: 'Tipo', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(enums.TIPOS_ANDAMENTO, 'movimentacao') }) +
        ui.Field({ nome: 'titulo', rotulo: 'Título', placeholder: 'Ex.: Juntada de petição',
                   obrigatorio: true }) +
        ui.Field({ nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', linhas: 3 }) +
        ui.Field({ nome: 'visivelCliente', rotulo: 'Visível para o cliente no portal',
                   tipo: 'checkbox', valor: true }) +
      '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Registrar', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fechar) {
        if (acao !== 'salvar') return;

        var dados = App.dom.formToObject(App.dom.qs('#form-andamento', corpo));
        if (!dados.titulo || !dados.titulo.trim()) {
          App.components.Toast.aviso('Informe o título do andamento.');
          return;
        }

        App.services.andamentoService.criar({
          processoId: processo.id,
          data: dados.data,
          tipo: dados.tipo,
          titulo: dados.titulo.trim(),
          descricao: dados.descricao,
          visivelCliente: dados.visivelCliente,
          autorId: App.store.getState().usuarioAtual.id,
          origem: 'manual'
        }).then(function () {
          fechar();
          App.components.Toast.sucesso('Andamento registrado');
          abaAtiva = 'andamentos';
          carregar(processo.id);
        }).catch(function (erro) {
          App.components.Toast.erro('Erro ao registrar', erro.message);
        });
      }
    });
  }

  /**
   * Formulário de prazo com PRÉVIA AO VIVO do cálculo: o advogado vê a data
   * fatal e a memória do art. 224 antes de salvar.
   */
  /**
   * Copia texto sem depender do Clipboard API — que exige contexto seguro e
   * não existe sob `file://`, justamente onde este protótipo roda.
   */
  function copiarTexto(texto, campo) {
    function porSelecao() {
      try {
        campo.removeAttribute('readonly');
        campo.select();
        campo.setSelectionRange(0, 99999);
        var ok = document.execCommand && document.execCommand('copy');
        campo.setAttribute('readonly', 'readonly');
        return ok;
      } catch (e) {
        return false;
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () {
        App.components.Toast.sucesso('Link copiado');
      }).catch(function () {
        if (porSelecao()) App.components.Toast.sucesso('Link copiado');
        else App.components.Toast.aviso('Copie manualmente', 'Selecione o link e use Ctrl+C.');
      });
      return;
    }

    if (porSelecao()) App.components.Toast.sucesso('Link copiado');
    else App.components.Toast.aviso('Copie manualmente', 'Selecione o link e use Ctrl+C.');
  }

  /**
   * Revisão da visibilidade, em um lugar só.
   *
   * A alternativa seria um botão "liberar tudo para o cliente", e ele seria
   * perigoso: o processo tem nota interna, estratégia e documento que não
   * pode sair. Aqui o advogado VÊ item a item o que está exposto antes de
   * mandar o link — a ação em massa acontece com a lista à vista.
   */
  function abrirRevisaoVisibilidade() {
    var enums = App.domain.enums;

    function grupo(titulo, itens, colecao, rotuloDe, subDe) {
      if (!itens.length) {
        return '<h4 class="u-sm u-bold" style="margin-top:var(--space-4)">' + esc(titulo) + '</h4>' +
               '<p class="u-xs u-subtle">Nada nesta seção.</p>';
      }

      var linhas = itens.map(function (it) {
        return '<label class="visib__linha">' +
                 '<input type="checkbox" data-action="visib" data-colecao="' + colecao + '"' +
                   ' data-id="' + esc(it.id) + '"' + (it.visivelCliente ? ' checked' : '') + '>' +
                 '<span class="visib__corpo">' +
                   '<span class="visib__titulo">' + esc(rotuloDe(it)) + '</span>' +
                   '<span class="visib__sub">' + esc(subDe(it)) + '</span>' +
                 '</span>' +
               '</label>';
      }).join('');

      return '<h4 class="u-sm u-bold" style="margin-top:var(--space-4)">' + esc(titulo) +
               ' <span class="u-xs u-subtle">(' +
               itens.filter(function (i) { return i.visivelCliente; }).length +
               ' de ' + itens.length + ' visíveis)</span></h4>' +
             '<div class="visib">' + linhas + '</div>';
    }

    App.components.Modal.abrir({
      titulo: 'O que o cliente enxerga',
      conteudo:
        '<p class="u-sm u-muted">Marque o que pode aparecer no portal. Nota interna, ' +
        'estratégia e documento sigiloso devem ficar desmarcados.</p>' +

        grupo('Andamentos', processo.andamentos, 'andamentos',
              function (a) { return a.titulo; },
              function (a) {
                return App.format.data(a.data) + ' · ' +
                       enums.rotulo(enums.TIPOS_ANDAMENTO, a.tipo);
              }) +

        grupo('Documentos', processo.documentos, 'documentos',
              function (d) { return d.nome; },
              function (d) { return enums.rotulo(enums.CATEGORIAS_DOCUMENTO, d.categoria); }) +

        grupo('Prazos', processo.prazos.filter(function (pz) {
                return pz.status === 'pendente' || pz.status === 'em_andamento';
              }), 'prazos',
              function (pz) { return pz.titulo; },
              function (pz) { return 'até ' + App.format.data(pz.dataFatal); }),

      acoes: [
        { rotulo: 'Fechar', variante: 'primary', acao: 'fechar', fechar: true }
      ],
      aoAbrir: function (corpo) {
        // Grava a cada clique: a lista pode ser longa, e obrigar a confirmar
        // no fim faria perder tudo em um fechamento acidental.
        App.dom.delegate(corpo, 'change', '[data-action="visib"]', function (evento, campo) {
          var colecao = campo.getAttribute('data-colecao');
          var id = campo.getAttribute('data-id');
          App.services.db.update(colecao, id, { visivelCliente: campo.checked });

          var item = (processo[colecao] || []).filter(function (x) { return x.id === id; })[0];
          if (item) item.visivelCliente = campo.checked;
        });
      },
      aoFechar: function () {
        carregar(processo.id);
      }
    });
  }

  /** Geração do link do portal. */
  function abrirNovoLink() {
    var ui = App.components.ui;
    var svc = App.services.compartilhamentoService;

    var rotulos = {
      andamentos: 'Andamentos publicados',
      documentos: 'Documentos liberados',
      prazos: 'Prazos aguardando manifestação',
      compromissos: 'Próximas audiências'
    };

    var camposEscopo = svc.CHAVES_ESCOPO.map(function (chave) {
      return ui.Field({
        nome: chave, tipo: 'checkbox', rotulo: rotulos[chave], valor: true
      });
    }).join('');

    App.components.Modal.abrir({
      titulo: 'Compartilhar com o cliente',
      conteudo:
        '<form id="form-link">' +
          '<p class="u-sm u-muted">O que o cliente vai ver:</p>' +
          camposEscopo +
          ui.Field({
            nome: 'validadeDias', rotulo: 'Validade do link', tipo: 'select',
            opcoes: App.domain.enums.opcoes([
              { id: '7',  label: '7 dias' },
              { id: '30', label: '30 dias' },
              { id: '90', label: '90 dias' }
            ], String(svc.VALIDADE_PADRAO_DIAS))
          }) +
        '</form>' +
        App.components.SeloSimulado({
          forma: 'linha',
          oque: 'o link carrega os dados do compartilhamento e abre em qualquer ' +
                'navegador, mas a soma de verificação NÃO é assinatura — sem servidor ' +
                'não há segredo para assinar.',
          naFase3: 'token assinado com HMAC e conferido no servidor, com lista de revogação.'
        }),
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Gerar link', variante: 'primary', acao: 'gerar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'gerar') return;
        var dados = App.dom.formToObject(App.dom.qs('#form-link', corpo));

        var escopo = {};
        svc.CHAVES_ESCOPO.forEach(function (c) { escopo[c] = !!dados[c]; });

        svc.criar({
          processoId: processo.id,
          escopo: escopo,
          validadeDias: parseInt(dados.validadeDias, 10)
        }).then(function (link) {
          fecharModal();
          App.components.Toast.sucesso('Link gerado',
            'Válido até ' + App.format.data(link.expiraEm) + '.');
          abaAtiva = 'portal';
          carregarLinks().then(desenhar);
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível gerar o link', erro.message);
        });
      }
    });
  }

  /**
   * Registro da perda de um prazo.
   *
   * O motivo é obrigatório e o service recusa texto curto. É o evento mais
   * grave do sistema: sem a justificativa gravada no momento, ninguém
   * reconstrói depois o que aconteceu — e é justamente essa reconstrução que
   * o escritório precisa ter em mãos.
   */
  function abrirMotivoPerda(prazoId) {
    var prazo = (processo.prazos || []).filter(function (pz) { return pz.id === prazoId; })[0];
    var ui = App.components.ui;

    App.components.Modal.abrir({
      titulo: 'Registrar prazo perdido',
      conteudo:
        '<p class="u-sm u-muted">' +
          App.dom.esc(prazo ? prazo.titulo : '') +
          (prazo ? ' · data fatal era ' + App.format.data(prazo.dataFatal) : '') +
        '</p>' +
        '<form id="form-perda">' +
          ui.Field({
            nome: 'motivo', rotulo: 'O que aconteceu', tipo: 'textarea', linhas: 4,
            obrigatorio: true,
            placeholder: 'Descreva o ocorrido e as providências tomadas…',
            dica: 'Mínimo de 10 caracteres. O texto vai para a timeline do processo.'
          }) +
        '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Registrar perda', variante: 'danger', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'salvar') return;
        var dados = App.dom.formToObject(App.dom.qs('#form-perda', corpo));

        App.services.prazoService.marcarPerdido(prazoId, dados.motivo).then(function () {
          fecharModal();
          App.components.Toast.aviso('Prazo registrado como perdido',
            'O motivo ficou na timeline do processo.');
          carregar(processo.id);
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível registrar', erro.message);
        });
      }
    });
  }

  function abrirNovoPrazo() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var usuarios = App.services.db.get('usuarios').filter(function (u) {
      return u.perfil === 'socio' || u.perfil === 'advogado';
    });

    App.components.Modal.abrir({
      titulo: 'Novo prazo',
      tamanho: 'lg',
      conteudo: '<form id="form-prazo" class="form-grid">' +
        ui.Field({ nome: 'tipoPrazoId', rotulo: 'Tipo de prazo', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(enums.TIPOS_PRAZO, 'contestacao'),
                   dica: 'Preenche automaticamente os dias e a forma de contagem' }) +
        ui.Field({ nome: 'titulo', rotulo: 'Título', largura: 6, valor: 'Contestação', obrigatorio: true }) +
        ui.Field({ nome: 'dataDisponibilizacao', rotulo: 'Disponibilização no DJe', tipo: 'date',
                   largura: 4, valor: App.domain.prazos.hojeISO(), obrigatorio: true,
                   dica: 'A publicação é o 1º dia útil seguinte' }) +
        ui.Field({ nome: 'quantidadeDias', rotulo: 'Prazo (dias)', tipo: 'number',
                   largura: 4, valor: 15, obrigatorio: true }) +
        ui.Field({ nome: 'tipoContagem', rotulo: 'Contagem', tipo: 'select', largura: 4,
                   opcoes: enums.opcoes([
                     { id: 'uteis', label: 'Dias úteis (art. 219)' },
                     { id: 'corridos', label: 'Dias corridos' }
                   ], 'uteis') }) +
        ui.Field({ nome: 'diasAntecedencia', rotulo: 'Antecedência interna (dias úteis)',
                   tipo: 'number', largura: 4, valor: 3,
                   dica: 'Folga de segurança do escritório' }) +
        ui.Field({ nome: 'responsavelId', rotulo: 'Responsável', tipo: 'select', largura: 4,
                   opcoes: enums.opcoes(
                     usuarios.map(function (u) { return { id: u.id, label: u.nome }; }),
                     processo.responsavelId) }) +
        ui.Field({ nome: 'prioridade', rotulo: 'Prioridade', tipo: 'select', largura: 4,
                   opcoes: enums.opcoes(enums.PRIORIDADES, 'media') }) +
        ui.Field({ nome: 'dobro', rotulo: 'Prazo em dobro (art. 229 — litisconsortes com procuradores distintos)',
                   tipo: 'checkbox' }) +
        '<div class="field" id="previa-prazo"></div>' +
      '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Criar prazo', variante: 'primary', acao: 'salvar' }
      ],
      aoAbrir: function (corpo) {
        var form = App.dom.qs('#form-prazo', corpo);
        var previa = App.dom.qs('#previa-prazo', corpo);

        function atualizarPrevia() {
          var dados = App.dom.formToObject(form);
          var calculo = App.services.prazoService.simular({
            dataDisponibilizacao: dados.dataDisponibilizacao,
            dias: Number(dados.quantidadeDias),
            tipoContagem: dados.tipoContagem,
            diasAntecedencia: Number(dados.diasAntecedencia),
            dobro: dados.dobro
          });

          previa.innerHTML = calculo
            ? App.pages.SimuladorPage.renderResultado(calculo)
            : '<p class="u-sm u-muted">Preencha a data e a quantidade de dias para ver o cálculo.</p>';
        }

        // Escolher o tipo preenche dias, contagem e título.
        form.addEventListener('change', function (evento) {
          if (evento.target.name === 'tipoPrazoId') {
            var tipo = enums.achar(enums.TIPOS_PRAZO, evento.target.value);
            if (tipo) {
              form.elements.quantidadeDias.value = tipo.dias;
              form.elements.tipoContagem.value = tipo.contagem;
              if (tipo.id !== 'custom') form.elements.titulo.value = tipo.label;
            }
          }
          atualizarPrevia();
        });

        form.addEventListener('input', App.dom.debounce(atualizarPrevia, 200));
        atualizarPrevia();
      },
      aoAcao: function (acao, corpo, fechar) {
        if (acao !== 'salvar') return;

        var dados = App.dom.formToObject(App.dom.qs('#form-prazo', corpo));
        if (!dados.titulo || !dados.dataDisponibilizacao || !dados.quantidadeDias) {
          App.components.Toast.aviso('Preencha título, data e quantidade de dias.');
          return;
        }

        App.services.prazoService.criar({
          processoId: processo.id,
          titulo: dados.titulo.trim(),
          tipoPrazoId: dados.tipoPrazoId,
          dataDisponibilizacao: dados.dataDisponibilizacao,
          quantidadeDias: Number(dados.quantidadeDias),
          tipoContagem: dados.tipoContagem,
          diasAntecedencia: Number(dados.diasAntecedencia),
          dobro: dados.dobro,
          responsavelId: dados.responsavelId,
          prioridade: dados.prioridade
        }).then(function (prazo) {
          fechar();
          App.components.Toast.sucesso('Prazo criado',
            'Data fatal: ' + App.format.data(prazo.dataFatal));
          abaAtiva = 'prazos';
          carregar(processo.id);
        }).catch(function (erro) {
          App.components.Toast.erro('Erro ao criar o prazo', erro.message);
        });
      }
    });
  }

  App.pages.ProcessoDetalhePage = { render: render, destroy: destroy };
})(window.App = window.App || {});
