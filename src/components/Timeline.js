/* ==========================================================================
   components/Timeline.js — linha do tempo de andamentos do processo
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  var ROTULO_ORIGEM = {
    manual: 'Lançamento manual',
    publicacao: 'Publicação (DJe)',
    tribunal: 'Captura do tribunal'
  };

  /**
   * @param {Object} props
   * @param {Array}  props.andamentos  ordenados do mais recente para o mais antigo
   * @param {number} [props.limite]
   */
  function Timeline(props) {
    var p = props || {};
    var andamentos = p.andamentos || [];
    var enums = App.domain.enums;
    var fmt = App.format;
    var ui = App.components.ui;

    if (!andamentos.length) {
      return ui.EmptyState({
        icone: '🕗',
        titulo: 'Nenhum andamento registrado',
        texto: 'Os andamentos aparecem aqui em ordem cronológica.'
      });
    }

    var lista = p.limite ? andamentos.slice(0, p.limite) : andamentos;
    var html = '<div class="timeline">';

    lista.forEach(function (andamento) {
      var tipo = enums.achar(enums.TIPOS_ANDAMENTO, andamento.tipo);
      var cor = tipo ? tipo.cor : 'var(--color-primary-400)';
      var interno = andamento.tipo === 'nota_interna';

      html += '<article class="timeline__item">' +
                '<span class="timeline__dot" style="--timeline-accent:' + cor + ';background:' + cor + '"></span>' +
                '<div class="timeline__date">' +
                  esc(fmt.data(andamento.data)) + ' · ' + esc(fmt.dataRelativa(andamento.data)) +
                '</div>' +
                '<h4 class="timeline__title">' +
                  (tipo ? '<span aria-hidden="true" style="color:' + cor + '">' + tipo.icone + '</span> ' : '') +
                  esc(andamento.titulo) +
                '</h4>' +
                (andamento.descricao
                  ? '<p class="timeline__desc">' + esc(andamento.descricao) + '</p>' : '') +
                '<div class="timeline__foot">' +
                  (tipo ? ui.Badge({ rotulo: tipo.label, cor: cor }) : '') +
                  (interno ? ui.Badge({ rotulo: 'Interno', variante: 'warning',
                                        titulo: 'Não é exibido ao cliente no portal' }) : '') +
                  '<span class="u-xs u-subtle">' +
                    esc(ROTULO_ORIGEM[andamento.origem] || andamento.origem) +
                    (andamento.autorNome ? ' · ' + esc(andamento.autorNome) : '') +
                  '</span>' +
                '</div>' +
              '</article>';
    });

    html += '</div>';

    if (p.limite && andamentos.length > p.limite) {
      html += '<div class="u-center" style="padding-top:var(--space-4)">' +
                ui.Button({
                  rotulo: 'Ver todos os ' + andamentos.length + ' andamentos',
                  variante: 'ghost',
                  tamanho: 'sm',
                  acao: 'ver-todos-andamentos'
                }) +
              '</div>';
    }

    return html;
  }

  App.components.Timeline = Timeline;
})(window.App = window.App || {});
