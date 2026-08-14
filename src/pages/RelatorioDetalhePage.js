/* ==========================================================================
   pages/RelatorioDetalhePage.js — tela genérica de relatório

   UMA tela para os dez relatórios. Ela não sabe o que está desenhando: lê o
   contrato devolvido por `domain/indicadores.js` (título, gráfico, tabela,
   totais, nota) e monta. Acrescentar um relatório novo é acrescentar uma
   função ao domínio — nenhuma linha aqui muda.

   O período vai para o HASH da rota. Assim o relatório filtrado pode ser
   copiado e mandado para o sócio, que abre exatamente o mesmo recorte —
   um link que perde o filtro é um link que gera discussão sobre número.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var relatorioId = null;
  var relatorio = null;
  var carregando = false;
  var erro = null;
  var filtros = null;
  var desmontarGrafico = null;

  function esc(v) { return App.dom.esc(v); }

  function render(elemento, params, query) {
    container = elemento;
    relatorioId = params.id;
    relatorio = null;
    erro = null;

    var q = query || {};
    filtros = {
      predefinicao: q.predefinicao || (q.de ? null : '12m'),
      de: q.de || null,
      ate: q.ate || null,
      areaId: q.areaId || '',
      responsavelId: q.responsavelId || ''
    };

    if (filtros.predefinicao && !filtros.de) {
      var faixa = App.components.DateRangePicker.resolver(filtros.predefinicao);
      if (faixa) { filtros.de = faixa.de; filtros.ate = faixa.ate; }
    }

    container.innerHTML = App.components.ui.Skeleton({ linhas: 8 });
    ligarEventos();
    carregar();
  }

  function destroy() {
    if (desmontarGrafico) { desmontarGrafico(); desmontarGrafico = null; }
  }

  function carregar() {
    carregando = true;
    App.services.relatorioService.gerar(relatorioId, filtros).then(function (r) {
      relatorio = r;
      carregando = false;
      desenhar();
    }).catch(function (e) {
      erro = e;
      carregando = false;
      desenhar();
    });
  }

  /**
   * O filtro vive no hash — o link carrega o recorte junto, e o relatório
   * filtrado pode ser mandado ao sócio sem virar discussão sobre número.
   *
   * `replaceState` é usado porque NÃO dispara `hashchange`: o relatório já
   * está desenhado, e recarregar por causa do próprio filtro seria trabalho
   * repetido. Só que ele LANÇA sob `file://` em vários navegadores — e abrir
   * com duplo clique é decisão do projeto desde a fase 1. Então a falha é
   * absorvida: perde-se o link compartilhável, nunca a tela.
   */
  function atualizarHash() {
    var partes = [];
    if (filtros.predefinicao) partes.push('predefinicao=' + filtros.predefinicao);
    if (filtros.de) partes.push('de=' + filtros.de);
    if (filtros.ate) partes.push('ate=' + filtros.ate);
    if (filtros.areaId) partes.push('areaId=' + filtros.areaId);
    if (filtros.responsavelId) partes.push('responsavelId=' + filtros.responsavelId);

    var novo = '#/relatorios/' + relatorioId + (partes.length ? '?' + partes.join('&') : '');
    if (window.location.hash === novo) return;
    if (!window.history || !window.history.replaceState) return;

    try {
      window.history.replaceState(null, '', novo);
    } catch (e) {
      // Sob file:// o navegador recusa reescrever a URL. Sem consequência
      // para o relatório: o filtro está aplicado, só não vai no endereço.
      console.info('[relatorio] O navegador não permitiu atualizar o endereço:', e.message);
    }
  }

  // --- Peças ---------------------------------------------------------------------

  function barraFiltros() {
    var enums = App.domain.enums;
    var podeEscolherResponsavel = App.services.sessaoService.pode('relatorios.todos');

    var usuarios = App.services.db.get('usuarios')
      .filter(function (u) { return u.perfil !== 'financeiro'; })
      .map(function (u) { return { id: u.id, label: u.nome }; });

    return '<div class="rel-filtros">' +
      App.components.DateRangePicker({
        valor: filtros, acao: 'periodo'
      }) +
      '<div class="rel-filtros__extra">' +
        '<label class="daterange__field"><span>Área</span>' +
          '<select class="select select--sm" data-filtro="areaId">' +
            enums.opcoes(enums.AREAS, filtros.areaId, 'Todas as áreas') +
          '</select></label>' +
        (podeEscolherResponsavel
          ? '<label class="daterange__field"><span>Responsável</span>' +
              '<select class="select select--sm" data-filtro="responsavelId">' +
                enums.opcoes(usuarios, filtros.responsavelId, 'Todos') +
              '</select></label>'
          : '') +
      '</div>' +
    '</div>';
  }

  function totais() {
    if (!relatorio.totais || !relatorio.totais.length) return '';

    return '<div class="grid grid--kpi">' +
      relatorio.totais.map(function (t) {
        return App.components.ui.Kpi({
          rotulo: t.rotulo, valor: t.valor, cor: t.cor
        });
      }).join('') +
    '</div>';
  }

  /** Monta o gráfico a partir da configuração devolvida pelo domínio. */
  function grafico() {
    var g = relatorio.grafico;
    if (!g) return '';

    var Chart = App.components.Chart;
    var conteudo;

    if (g.tipo === 'donut') {
      conteudo = Chart.Donut({
        fatias: g.fatias, formatarValor: g.formatarValor,
        valorCentral: g.valorCentral, rotuloCentral: g.rotuloCentral,
        paleta: g.paleta
      });
    } else if (g.tipo === 'linha') {
      conteudo = Chart.Linha({
        categorias: g.categorias, series: g.series,
        formatarValor: g.formatarValor, area: g.area, altura: 260
      });
    } else {
      conteudo = Chart.Barras({
        categorias: g.categorias, series: g.series,
        formatarValor: g.formatarValor, paleta: g.paleta,
        orientacao: g.orientacao, empilhado: g.empilhado,
        altura: g.orientacao === 'barra'
          ? Math.max(200, g.categorias.length * 34 + 50) : 280
      });
    }

    return App.components.ui.Card({ conteudo: conteudo });
  }

  function tabela() {
    var t = relatorio.tabela;
    if (!t || !t.linhas.length) return '';

    var cabecalho = t.colunas.map(function (c) {
      return '<th' + (c.alinhamento === 'direita' ? ' class="u-right"' : '') + '>' +
             esc(c.titulo) + '</th>';
    }).join('');

    var corpo = t.linhas.map(function (linha) {
      return '<tr>' + t.colunas.map(function (c) {
        var bruto = linha[c.campo];
        var texto = c.formatar ? c.formatar(bruto, linha) : bruto;
        var classe = c.alinhamento === 'direita' ? ' class="u-right u-tabular"' : '';
        return '<td' + classe + '>' + esc(texto === undefined || texto === null ? '—' : texto) +
               '</td>';
      }).join('') + '</tr>';
    }).join('');

    return App.components.ui.Card({
      titulo: 'Detalhamento',
      subtitulo: t.linhas.length + ' linha(s)',
      conteudo: '<div class="table-wrap"><table class="table"><thead><tr>' +
                cabecalho + '</tr></thead><tbody>' + corpo + '</tbody></table></div>',
      semPadding: true
    });
  }

  function desenhar() {
    var ui = App.components.ui;
    if (desmontarGrafico) { desmontarGrafico(); desmontarGrafico = null; }

    if (erro) {
      container.innerHTML =
        '<div class="breadcrumb"><a href="#/relatorios">Relatórios</a></div>' +
        ui.EmptyState({
          icone: erro.codigo === 403 ? '🔒' : '⚠',
          titulo: erro.codigo === 403 ? 'Sem acesso a este relatório' : 'Erro ao gerar',
          texto: erro.message,
          acao: ui.Button({ rotulo: 'Voltar ao catálogo', variante: 'primary',
                            href: '#/relatorios' })
        });
      return;
    }

    if (carregando || !relatorio) {
      container.innerHTML = ui.Skeleton({ linhas: 8 });
      return;
    }

    var corpo = relatorio.vazio
      ? ui.EmptyState({ icone: '📭', titulo: 'Sem dados no recorte', texto: relatorio.nota })
      : totais() +
        '<div class="page-section">' + grafico() + '</div>' +
        '<div class="page-section">' + tabela() + '</div>';

    container.innerHTML =
      '<div class="breadcrumb">' +
        '<a href="#/relatorios">Relatórios</a>' +
        '<span class="breadcrumb__sep">/</span>' +
        '<span>' + esc(relatorio.titulo) + '</span>' +
      '</div>' +

      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">' + relatorio.icone + ' ' +
            esc(relatorio.titulo) + '</h1>' +
          '<p class="page-header__subtitle">' + esc(relatorio.subtitulo || '') +
            ' · ' + esc(App.components.DateRangePicker.descrever(filtros)) + '</p>' +
        '</div>' +
        '<div class="page-header__actions">' +
          ui.Button({ rotulo: 'Exportar CSV', icone: '↓', acao: 'exportar-csv',
                      desabilitado: relatorio.vazio }) +
          ui.Button({ rotulo: 'Imprimir', icone: '🖨', acao: 'imprimir-relatorio',
                      desabilitado: relatorio.vazio }) +
        '</div>' +
      '</div>' +

      /* Quem tem escopo próprio precisa saber ANTES de ler o número: um
         total que parece do escritório e é do usuário gera decisão errada. */
      (relatorio.escopoProprio
        ? '<p class="rel-escopo">Este relatório mostra apenas os seus números' +
          (relatorio.escopoNome ? ' (' + esc(relatorio.escopoNome) + ')' : '') +
          ' — seu perfil não tem acesso aos da equipe.</p>'
        : '') +

      barraFiltros() +
      corpo +

      (relatorio.nota && !relatorio.vazio
        ? '<p class="rel-nota">' + esc(relatorio.nota) + '</p>' : '');

    if (!relatorio.vazio) desmontarGrafico = App.components.Chart.mount(container);
    atualizarHash();
  }

  // --- Ações ---------------------------------------------------------------------

  function imprimir() {
    var t = relatorio.tabela;
    if (!t) return;

    var cabecalho = t.colunas.map(function (c) {
      return '<th>' + esc(c.titulo) + '</th>';
    }).join('');

    var corpo = t.linhas.map(function (linha) {
      return '<tr>' + t.colunas.map(function (c) {
        var texto = c.formatar ? c.formatar(linha[c.campo], linha) : linha[c.campo];
        return '<td>' + esc(texto === undefined || texto === null ? '—' : texto) + '</td>';
      }).join('') + '</tr>';
    }).join('');

    var totaisHtml = (relatorio.totais || []).map(function (x) {
      return '<li><strong>' + esc(x.rotulo) + ':</strong> ' + esc(x.valor) + '</li>';
    }).join('');

    App.exportar.imprimir({
      nome: 'relatorio-' + relatorio.id,
      modo: 'rico',
      conteudo:
        '<h1>' + esc(relatorio.titulo) + '</h1>' +
        '<p>' + esc(relatorio.subtitulo || '') + ' — ' +
          esc(App.components.DateRangePicker.descrever(filtros)) + '</p>' +
        (totaisHtml ? '<ul>' + totaisHtml + '</ul>' : '') +
        '<table border="1" cellspacing="0" cellpadding="4"><thead><tr>' +
          cabecalho + '</tr></thead><tbody>' + corpo + '</tbody></table>' +
        (relatorio.nota ? '<p><em>' + esc(relatorio.nota) + '</em></p>' : '') +
        '<p><small>Gerado em ' + esc(App.format.dataHora(new Date().toISOString())) +
          ' — JurisControl (protótipo, dados fictícios)</small></p>'
    });
  }

  function ligarEventos() {
    App.components.DateRangePicker.mount(container, {
      acao: 'periodo',
      valor: filtros,
      onChange: function (novo) {
        filtros.predefinicao = novo.predefinicao;
        filtros.de = novo.de;
        filtros.ate = novo.ate;
        carregar();
      }
    });

    App.dom.delegate(container, 'change', 'select[data-filtro]', function (evento, campo) {
      filtros[campo.getAttribute('data-filtro')] = campo.value;
      carregar();
    });

    App.dom.delegate(container, 'click', '[data-action="exportar-csv"]', function () {
      App.services.relatorioService.exportarCsv(relatorio).then(function () {
        App.components.Toast.sucesso('Relatório exportado',
          relatorio.tabela.linhas.length + ' linha(s) em CSV.');
      });
    });

    App.dom.delegate(container, 'click', '[data-action="imprimir-relatorio"]', imprimir);
  }

  App.pages.RelatorioDetalhePage = { render: render, destroy: destroy };
})(window.App = window.App || {});
