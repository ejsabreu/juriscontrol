/* ==========================================================================
   components/AssistentePanel.js — o painel do assistente

   Regra de apresentação que atravessa o componente: TODA conclusão vem
   acompanhada do porquê. "Risco provável" sozinho é palpite; "risco
   provável porque 62% dos processos encerrados nesta área tiveram perda e
   há um prazo perdido aqui" é argumento — e o advogado pode discordar com
   base.

   Contrato do projeto: função pura que recebe props e devolve HTML.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  var ICONE_PRIORIDADE = { critica: '🔴', atencao: '🟠', info: '•' };

  function blocoResumo(resumo) {
    if (!resumo) return '';

    return '<div class="ia__bloco">' +
      '<h4 class="ia__titulo">Resumo do processo</h4>' +
      '<p class="ia__texto">' + esc(resumo.texto) + '</p>' +
      (resumo.diasSemMovimento !== null && resumo.diasSemMovimento > 90
        ? '<p class="ia__alerta">Sem movimentação há ' + resumo.diasSemMovimento +
          ' dias.</p>'
        : '') +
    '</div>';
  }

  function blocoAcoes(acoes) {
    if (!acoes || !acoes.length) {
      return '<div class="ia__bloco">' +
        '<h4 class="ia__titulo">Próximas ações</h4>' +
        '<p class="ia__texto u-subtle">Nada exigindo atenção agora.</p></div>';
    }

    var itens = acoes.map(function (a) {
      return '<li class="ia-acao ia-acao--' + esc(a.prioridade) + '">' +
        '<span class="ia-acao__icone" aria-hidden="true">' +
          (ICONE_PRIORIDADE[a.prioridade] || '•') + '</span>' +
        '<div>' +
          '<div class="ia-acao__titulo">' + esc(a.acao) + '</div>' +
          // O porquê não é decoração: é o que permite discordar.
          '<div class="ia-acao__porque">' + esc(a.porque) + '</div>' +
        '</div>' +
      '</li>';
    }).join('');

    return '<div class="ia__bloco">' +
      '<h4 class="ia__titulo">Próximas ações</h4>' +
      '<ul class="ia-acoes">' + itens + '</ul>' +
    '</div>';
  }

  function blocoRisco(risco, riscoCadastrado) {
    if (!risco) return '';
    var enums = App.domain.enums;

    if (risco.confianca === 'insuficiente') {
      return '<div class="ia__bloco">' +
        '<h4 class="ia__titulo">Risco sugerido</h4>' +
        '<p class="ia__texto u-subtle">Sem base para sugerir — ' +
          esc(risco.porque) + '.</p>' +
        '<p class="u-xs u-subtle">Preferimos dizer que não sabemos a chutar.</p>' +
      '</div>';
    }

    var sugerido = enums.achar(enums.RISCOS, risco.risco);
    var divergente = riscoCadastrado && riscoCadastrado !== risco.risco;

    return '<div class="ia__bloco">' +
      '<h4 class="ia__titulo">Risco sugerido</h4>' +
      '<div class="u-row" style="gap:var(--space-2)">' +
        App.components.ui.Badge({
          rotulo: sugerido ? sugerido.label : risco.risco,
          variante: sugerido ? sugerido.variante : 'neutral'
        }) +
        '<span class="u-xs u-subtle">confiança ' + esc(risco.confianca) +
          ' · base de ' + risco.baseHistorica + ' processo(s)</span>' +
      '</div>' +
      '<ul class="ia__razoes">' +
        risco.razoes.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') +
      '</ul>' +
      (divergente
        ? '<p class="ia__alerta">O risco cadastrado no processo é <strong>' +
          esc(enums.rotulo(enums.RISCOS, riscoCadastrado)) +
          '</strong> — diferente do sugerido.</p>'
        : '') +
    '</div>';
  }

  /**
   * @param {object} p
   * @param {object} p.analise    saída de iaService.analisarProcesso
   * @param {boolean} p.carregando
   */
  function AssistentePanel(props) {
    var p = props || {};

    if (p.carregando) {
      return '<div class="ia">' + App.components.ui.Skeleton({ linhas: 4 }) + '</div>';
    }
    if (!p.analise) return '';

    return '<div class="ia">' +
      blocoResumo(p.analise.resumo) +
      blocoAcoes(p.analise.acoes) +
      blocoRisco(p.analise.risco, p.analise.riscoCadastrado) +

      '<div class="ia__bloco">' +
        '<h4 class="ia__titulo">Perguntar sobre o processo</h4>' +
        '<div class="ia__pergunta">' +
          '<input class="input" id="ia-pergunta" type="text"' +
            ' placeholder="Ex.: qual o próximo prazo?">' +
          App.components.ui.Button({ rotulo: 'Perguntar', acao: 'ia-perguntar' }) +
        '</div>' +
        '<div id="ia-resposta"></div>' +
      '</div>' +

      App.components.SeloSimulado({
        oque: 'não há modelo de linguagem neste protótipo — o assistente é regra e ' +
              'dicionário, e diz quando não sabe.',
        detalhe: 'Cada conclusão vem com o porquê justamente para poder ser conferida. ' +
                 'É o oposto de uma resposta que soa convincente sem ser verificável.',
        naFase3: 'as mesmas chamadas (POST /api/ia/*) atendidas por um modelo, com estas ' +
                 'regras continuando como piso.'
      }) +
    '</div>';
  }

  App.components.AssistentePanel = AssistentePanel;
})(window.App = window.App || {});
