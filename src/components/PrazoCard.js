/* ==========================================================================
   components/PrazoCard.js — linha de prazo com contagem regressiva
   Usado no dashboard, na agenda e na aba Prazos do processo.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  /**
   * @param {Object}  props
   * @param {Object}  props.prazo      já avaliado (semaforo, diasRestantes)
   * @param {boolean} [props.mostrarProcesso]
   * @param {boolean} [props.acoes]    exibe botão de baixa
   */
  function PrazoCard(props) {
    var p = props || {};
    var prazo = p.prazo;
    var ui = App.components.ui;
    var fmt = App.format;

    var encerrado = prazo.status === 'cumprido' || prazo.status === 'cancelado';
    var semaforo = encerrado ? 'cumprido' : prazo.semaforo;

    // Bloco da contagem regressiva
    var numero, rotuloNumero;
    if (encerrado) {
      numero = '✓';
      rotuloNumero = 'baixado';
    } else if (prazo.status === 'perdido') {
      numero = '✕';
      rotuloNumero = 'perdido';
    } else if (prazo.diasRestantes === null || prazo.diasRestantes === undefined) {
      numero = '—';
      rotuloNumero = '';
    } else if (prazo.diasRestantes < 0) {
      numero = Math.abs(prazo.diasRestantes);
      rotuloNumero = 'em atraso';
    } else if (prazo.diasRestantes === 0) {
      numero = 'HOJE';
      rotuloNumero = 'vence';
    } else {
      numero = prazo.diasRestantes;
      rotuloNumero = fmt.plural(prazo.diasRestantes, 'dia útil', 'dias úteis');
    }

    var tamanhoNumero = String(numero).length > 3 ? 'font-size:var(--text-sm)' : '';

    var subtitulo = [];
    if (p.mostrarProcesso !== false && prazo.processoInterno) {
      subtitulo.push(prazo.processoInterno);
    }
    if (prazo.clienteNome && prazo.clienteNome !== '—') subtitulo.push(prazo.clienteNome);
    subtitulo.push('fatal ' + fmt.data(prazo.dataFatal));

    var acoes = '';
    if (p.acoes && !encerrado && prazo.status !== 'perdido') {
      acoes = ui.Button({
        rotulo: 'Baixar',
        variante: 'secondary',
        tamanho: 'sm',
        acao: 'cumprir-prazo',
        valor: prazo.id,
        titulo: 'Marcar prazo como cumprido'
      });

      // Registrar a perda é ação deliberada e discreta — nunca ao lado de
      // "Baixar" com o mesmo peso visual.
      if (prazo.semaforo === 'vencido') {
        acoes += ui.Button({
          rotulo: 'Perdido',
          variante: 'ghost',
          tamanho: 'sm',
          acao: 'marcar-perdido',
          valor: prazo.id,
          titulo: 'Registrar a perda do prazo com justificativa'
        });
      }
    }

    /* Dupla conferência (F2.2): cumprido e ainda não conferido é um estado
       intermediário, e o cartão precisa dizer isso — senão o segundo
       advogado não tem como saber que a fila existe. */
    if (p.acoes && encerrado && prazo.status === 'cumprido' && !prazo.conferidoEm) {
      acoes += ui.Button({
        rotulo: 'Conferir',
        variante: 'primary',
        tamanho: 'sm',
        acao: 'conferir-prazo',
        valor: prazo.id,
        titulo: 'Conferir a baixa (precisa ser outra pessoa)'
      });
    }

    var selo = '';
    if (prazo.status === 'cumprido') {
      selo = prazo.conferidoEm
        ? ui.Badge({ rotulo: 'Conferido', variante: 'success',
                     titulo: 'Conferido em ' + fmt.dataHora(prazo.conferidoEm) })
        : ui.Badge({ rotulo: 'Aguarda conferência', variante: 'warning' });
    } else if (prazo.status === 'perdido' && prazo.motivoPerda) {
      selo = ui.Badge({ rotulo: 'Motivo registrado', variante: 'danger',
                        titulo: prazo.motivoPerda });
    }

    var href = prazo.processoId ? '#/processos/' + prazo.processoId : null;

    return '<div class="prazo-card prazo-card--' + semaforo + '" data-id="' + esc(prazo.id) + '">' +
             '<div class="prazo-card__countdown">' +
               '<div class="prazo-card__days" style="' + tamanhoNumero + '">' + esc(numero) + '</div>' +
               '<div class="prazo-card__days-label">' + esc(rotuloNumero) + '</div>' +
             '</div>' +
             '<div class="prazo-card__body">' +
               '<div class="prazo-card__title">' +
                 (href
                   ? '<a href="' + esc(href) + '" title="' + esc(prazo.titulo) + '">' + esc(prazo.titulo) + '</a>'
                   : '<span title="' + esc(prazo.titulo) + '">' + esc(prazo.titulo) + '</span>') +
               '</div>' +
               '<div class="prazo-card__sub"><span title="' + esc(subtitulo.join(' · ')) + '">' +
                 esc(subtitulo.join(' · ')) + (selo ? ' ' + selo : '') + '</span></div>' +
             '</div>' +
             '<div class="prazo-card__actions">' +
               acoes +
               (prazo.responsavel ? ui.Avatar({ usuario: prazo.responsavel, tamanho: 'sm' }) : '') +
             '</div>' +
           '</div>';
  }

  /** Lista de prazos com estado vazio próprio. */
  function PrazoList(props) {
    var p = props || {};
    var prazos = p.prazos || [];

    if (!prazos.length) {
      return App.components.ui.EmptyState({
        icone: p.icone || '✓',
        titulo: p.tituloVazio || 'Nenhum prazo aqui',
        texto: p.textoVazio || 'Nada pendente para os filtros aplicados.'
      });
    }

    return prazos.map(function (prazo) {
      return PrazoCard({
        prazo: prazo,
        mostrarProcesso: p.mostrarProcesso,
        acoes: p.acoes
      });
    }).join('');
  }

  App.components.PrazoCard = PrazoCard;
  App.components.PrazoList = PrazoList;
})(window.App = window.App || {});
