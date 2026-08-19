/* ==========================================================================
   components/Calendar.js — calendário mensal da agenda

   Mostra o calendário FORENSE, não o civil: fim de semana, feriado e
   recesso aparecem sombreados, porque são os dias em que o prazo não corre.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  var SIGLAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var MAX_EVENTOS_POR_DIA = 3;

  /**
   * @param {Object} props
   * @param {string} props.mes            ISO de qualquer dia do mês exibido
   * @param {Object} props.eventosPorDia  { 'YYYY-MM-DD': [evento] }
   */
  function Calendar(props) {
    var p = props || {};
    var prazos = App.domain.prazos;
    var feriados = App.domain.feriados;
    var fmt = App.format;
    var ui = App.components.ui;

    var referencia = prazos.paraDate(p.mes || prazos.hojeISO());
    var ano = referencia.getFullYear();
    var mes = referencia.getMonth();
    var hoje = prazos.hojeISO();

    var primeiroDia = new Date(ano, mes, 1);
    var inicioGrade = new Date(ano, mes, 1 - primeiroDia.getDay());   // recua até domingo

    var html = '<div class="calendar">';

    // --- Cabeçalho de navegação ---
    html += '<div class="calendar__header">' +
              '<span class="calendar__month">' + esc(fmt.MESES[mes] + ' de ' + ano) + '</span>' +
              App.components.ui.Button({
                icone: '‹', variante: 'secondary', tamanho: 'sm',
                apenasIcone: true, acao: 'mes-anterior', titulo: 'Mês anterior'
              }) +
              App.components.ui.Button({
                rotulo: 'Hoje', variante: 'secondary', tamanho: 'sm', acao: 'mes-hoje'
              }) +
              App.components.ui.Button({
                icone: '›', variante: 'secondary', tamanho: 'sm',
                apenasIcone: true, acao: 'mes-proximo', titulo: 'Próximo mês'
              }) +
              '<span class="u-spacer"></span>' +
              '<span class="calendar__legend u-xs u-subtle">Dias sombreados não contam prazo</span>' +
            '</div>';

    // --- Grade (telas largas) ---
    html += '<div class="calendar__grid">';
    SIGLAS_SEMANA.forEach(function (sigla) {
      html += '<div class="calendar__weekday">' + sigla + '</div>';
    });

    /* --- Agenda (telas estreitas) ---
       Um grid de 7 colunas fica ilegível em ~50px de largura por dia — o
       CSS troca a grade por esta lista abaixo de 720px (ver components.css).
       É só o que tem prazo ou compromisso, na ordem do mês: a grade mostra
       o mês inteiro porque tem espaço para isso, a lista mostra só o que
       importa porque não tem. */
    var agenda = '';
    var agendaTemDia = false;

    var cursor = new Date(inicioGrade.getTime());

    // 6 semanas cobrem qualquer disposição de mês.
    for (var celula = 0; celula < 42; celula++) {
      var iso = prazos.paraISO(cursor);
      var doMes = cursor.getMonth() === mes;
      var feriado = feriados.ehFeriado(iso);
      var recesso = feriados.estaEmRecesso(cursor);
      var contavel = prazos.ehDiaContavel(cursor);
      var eventos = (p.eventosPorDia && p.eventosPorDia[iso]) || [];

      var classes = ['calendar__day'];
      if (!doMes) classes.push('calendar__day--outside');
      if (!contavel) classes.push('calendar__day--nonworking');
      if (feriado) classes.push('calendar__day--holiday');
      if (iso === hoje) classes.push('calendar__day--today');

      html += '<div class="' + classes.join(' ') + '" data-dia="' + iso + '">' +
                '<span class="calendar__day-number">' + cursor.getDate() + '</span>';

      if (feriado) {
        html += '<span class="calendar__holiday-label" title="' + esc(feriado.nome) + '">' +
                  esc(fmt.truncar(feriado.nome, 16)) + '</span>';
      } else if (recesso && doMes) {
        html += '<span class="calendar__holiday-label" title="Recesso forense — art. 220 do CPC">recesso</span>';
      }

      eventos.slice(0, MAX_EVENTOS_POR_DIA).forEach(function (evento) {
        var modificador = evento.categoria === 'prazo'
          ? (evento.semaforo || 'ok')
          : 'compromisso';

        html += '<button type="button" class="calendar__event calendar__event--' + modificador + '"' +
                  ' data-action="ver-evento" data-id="' + esc(evento.id) + '"' +
                  ' title="' + esc((evento.hora ? evento.hora + ' — ' : '') +
                                   evento.titulo + (evento.subtitulo ? ' · ' + evento.subtitulo : '')) + '">' +
                  (evento.hora ? '<strong>' + esc(evento.hora) + '</strong> ' : '') +
                  esc(fmt.truncar(evento.titulo, 22)) +
                '</button>';
      });

      if (eventos.length > MAX_EVENTOS_POR_DIA) {
        html += '<span class="calendar__more">+' + (eventos.length - MAX_EVENTOS_POR_DIA) + ' mais</span>';
      }

      html += '</div>';

      if (doMes && eventos.length) {
        agendaTemDia = true;

        var classesAgenda = ['calendar__agenda-dia'];
        if (iso === hoje) classesAgenda.push('calendar__agenda-dia--today');

        agenda += '<div class="' + classesAgenda.join(' ') + '" data-dia="' + iso + '">' +
          '<div class="calendar__agenda-data">' +
            '<span class="calendar__agenda-dow">' + SIGLAS_SEMANA[cursor.getDay()] + '</span>' +
            '<span class="calendar__agenda-num">' + cursor.getDate() + '</span>' +
          '</div>' +
          '<div class="calendar__agenda-eventos">';

        eventos.forEach(function (evento) {
          var modificadorAgenda = evento.categoria === 'prazo'
            ? (evento.semaforo || 'ok')
            : 'compromisso';

          agenda += '<button type="button" class="calendar__event calendar__event--' + modificadorAgenda + '"' +
                      ' data-action="ver-evento" data-id="' + esc(evento.id) + '">' +
                      (evento.hora ? '<strong>' + esc(evento.hora) + '</strong> ' : '') +
                      esc(evento.titulo) +
                      (evento.subtitulo
                        ? ' <span class="calendar__event-sub">· ' + esc(evento.subtitulo) + '</span>'
                        : '') +
                    '</button>';
        });

        agenda += '</div></div>';
      }

      cursor = prazos.addDias(cursor, 1);
    }

    html += '</div>'; // fecha calendar__grid

    html += '<div class="calendar__agenda">' +
              (agendaTemDia ? agenda : ui.EmptyState({
                icone: '🗓', titulo: 'Nada neste mês',
                texto: 'Nenhum prazo ou compromisso no período exibido.'
              })) +
            '</div>';

    html += '</div>'; // fecha .calendar
    return html;
  }

  App.components.Calendar = Calendar;
})(window.App = window.App || {});
