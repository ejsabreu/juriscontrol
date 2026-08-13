/* ==========================================================================
   components/Stepper.js — fluxo de várias etapas

   Usado onde uma operação só faz sentido inteira: converter um lead em
   cliente + contrato + processo (F2.6), emitir boleto (F2.5), importar
   processos em massa (F2.10).

   O componente desenha o trilho e os botões; QUEM decide se pode avançar é
   a página, pelo callback `podeAvancar`. Estado nenhum mora aqui — a etapa
   atual chega por props, como no React.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  var esc = null;
  function e(v) {
    if (!esc) esc = App.dom.esc;
    return esc(v);
  }

  /**
   * @param {object} p
   * @param {Array}  p.etapas   [{ id, label, descricao? }]
   * @param {number} p.atual    índice da etapa corrente (0-based)
   * @param {string} p.conteudo HTML do corpo da etapa atual
   * @param {string} p.rotuloConcluir  texto do botão da última etapa
   * @param {boolean} p.avancarDesabilitado
   * @param {boolean} p.ocupado  trava os botões durante uma gravação
   */
  function Stepper(props) {
    var p = props || {};
    var etapas = p.etapas || [];
    var atual = Math.max(0, Math.min(p.atual || 0, etapas.length - 1));
    var ui = App.components.ui;

    var trilho = '<ol class="stepper__track">';
    etapas.forEach(function (etapa, i) {
      var estado = i < atual ? 'concluida' : (i === atual ? 'atual' : 'futura');
      trilho += '<li class="stepper__step stepper__step--' + estado + '"' +
                  (i === atual ? ' aria-current="step"' : '') + '>' +
                  '<span class="stepper__bullet" aria-hidden="true">' +
                    (i < atual ? '✓' : (i + 1)) +
                  '</span>' +
                  '<span class="stepper__labels">' +
                    '<span class="stepper__label">' + e(etapa.label) + '</span>' +
                    (etapa.descricao
                      ? '<span class="stepper__desc">' + e(etapa.descricao) + '</span>' : '') +
                  '</span>' +
                '</li>';
    });
    trilho += '</ol>';

    var ultima = atual === etapas.length - 1;
    var acoes = '<div class="stepper__actions">' +
      ui.Button({
        rotulo: 'Voltar',
        acao: 'stepper-voltar',
        variante: 'ghost',
        desabilitado: atual === 0 || !!p.ocupado
      }) +
      ui.Button({
        rotulo: p.ocupado
          ? 'Gravando…'
          : (ultima ? (p.rotuloConcluir || 'Concluir') : 'Avançar'),
        acao: ultima ? 'stepper-concluir' : 'stepper-avancar',
        variante: 'primary',
        desabilitado: !!p.avancarDesabilitado || !!p.ocupado
      }) +
      '</div>';

    return '<div class="stepper' + (p.classe ? ' ' + p.classe : '') + '"' +
             (p.id ? ' id="' + e(p.id) + '"' : '') + '>' +
             trilho +
             '<div class="stepper__body">' + (p.conteudo || '') + '</div>' +
             acoes +
           '</div>';
  }

  /**
   * @param {object} handlers  { aoAvancar, aoVoltar, aoConcluir }
   *
   * Prefixo `ao`, como todo o resto do projeto (`aoMover`, `aoMudar`,
   * `aoOrdenar`). A primeira versão usava `on*`, herdado do JSX, e a
   * divergência custou um handler que nunca disparava.
   */
  Stepper.mount = function (root, handlers) {
    if (!root) return function () {};
    var h = handlers || {};

    var offs = [
      App.dom.delegate(root, 'click', '[data-action="stepper-avancar"]', function () {
        if (h.aoAvancar) h.aoAvancar();
      }),
      App.dom.delegate(root, 'click', '[data-action="stepper-voltar"]', function () {
        if (h.aoVoltar) h.aoVoltar();
      }),
      App.dom.delegate(root, 'click', '[data-action="stepper-concluir"]', function () {
        if (h.aoConcluir) h.aoConcluir();
      })
    ];

    return function desmontar() {
      offs.forEach(function (off) { off(); });
    };
  };

  App.components.Stepper = Stepper;
})(window.App = window.App || {});
