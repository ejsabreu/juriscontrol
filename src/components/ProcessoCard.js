/* ==========================================================================
   components/ProcessoCard.js — card do processo no kanban

   Decisão de conteúdo: o card mostra o SEMÁFORO DO PRÓXIMO PRAZO em posição
   de destaque. Sem isso o kanban vira um quadro bonito e inútil — a fase
   sozinha não diz o que precisa de ação hoje.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  /** Cor da borda esquerda: urgência do prazo, ou a cor da área se não houver prazo. */
  function corDeAcento(processo) {
    var prazo = processo.prazoProximo;
    if (prazo) {
      var mapa = {
        vencido: 'var(--color-prazo-vencido)',
        critico: 'var(--color-prazo-critico)',
        atencao: 'var(--color-prazo-atencao)',
        ok: 'var(--color-prazo-ok)'
      };
      if (mapa[prazo.semaforo]) return mapa[prazo.semaforo];
    }
    return App.domain.enums.cor(App.domain.enums.AREAS, processo.areaId);
  }

  function ProcessoCard(processo) {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var fmt = App.format;

    var papel = enums.achar(enums.PAPEIS_CLIENTE, processo.papelCliente);
    var area = enums.achar(enums.AREAS, processo.areaId);

    var marcadores = '';
    if (processo.segredoJustica) {
      marcadores += '<span title="Segredo de justiça" aria-label="Segredo de justiça">🔒</span>';
    }
    if (processo.risco === 'provavel') {
      marcadores += '<span title="Risco provável — exige provisão" aria-label="Risco provável">⚠</span>';
    }
    if (processo.status === 'suspenso') {
      marcadores += '<span title="Processo suspenso" aria-label="Suspenso">⏸</span>';
    }

    var prazo = processo.prazoProximo;
    var linhaPrazo = prazo
      ? ui.PrazoChip({
          semaforo: prazo.semaforo,
          diasRestantes: prazo.diasRestantes,
          titulo: prazo.titulo + ' — vence em ' + fmt.data(prazo.dataFatal)
        }) +
        (processo.totalPrazosPendentes > 1
          ? '<span class="u-xs u-subtle">+' + (processo.totalPrazosPendentes - 1) + '</span>'
          : '')
      : '<span class="u-xs u-subtle">Sem prazo aberto</span>';

    return '<a class="kanban-card" draggable="true"' +
             ' data-id="' + esc(processo.id) + '"' +
             ' href="#/processos/' + esc(processo.id) + '"' +
             ' style="--card-accent:' + corDeAcento(processo) + '">' +

             '<div class="kanban-card__top">' +
               '<span class="kanban-card__number">' + esc(processo.numeroInterno) + '</span>' +
               '<span class="u-spacer"></span>' +
               (marcadores ? '<span class="u-row u-xs">' + marcadores + '</span>' : '') +
             '</div>' +

             '<div class="kanban-card__title">' + esc(processo.clienteNome) + '</div>' +

             '<div class="kanban-card__meta">' +
               esc(fmt.truncar(processo.assunto, 52)) +
             '</div>' +

             '<div class="kanban-card__tags">' +
               ui.Badge({ rotulo: area ? area.label : processo.areaId, cor: area ? area.cor : null }) +
               (papel ? ui.Badge({ rotulo: papel.label, variante: 'neutral' }) : '') +
             '</div>' +

             '<div class="kanban-card__footer">' +
               ui.Avatar({ usuario: processo.responsavel, tamanho: 'sm' }) +
               '<span class="u-row" style="gap:var(--space-1)">' + linhaPrazo + '</span>' +
               '<span class="kanban-card__value">' + esc(fmt.moedaCompacta(processo.valorCausa)) + '</span>' +
             '</div>' +

           '</a>';
  }

  // --- Card de tarefa (mesmo quadro, outra configuração) ---------------------
  function TarefaCard(tarefa) {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var fmt = App.format;

    var prioridade = enums.achar(enums.PRIORIDADES, tarefa.prioridade);
    var corAcento = tarefa.atrasada
      ? 'var(--color-prazo-critico)'
      : (prioridade && prioridade.id === 'critica' ? 'var(--color-prazo-critico)'
                                                   : 'var(--color-border-strong)');

    var progresso = tarefa.progresso !== null && tarefa.progresso !== undefined
      ? '<div style="margin-bottom:var(--space-2)">' +
          ui.Progress({ percentual: tarefa.progresso }) +
          '<div class="u-xs u-subtle" style="margin-top:2px">' +
            tarefa.checklistFeitos + '/' + tarefa.checklistTotal + ' concluídos' +
          '</div>' +
        '</div>'
      : '';

    return '<article class="kanban-card" draggable="true"' +
             ' data-id="' + esc(tarefa.id) + '"' +
             ' style="--card-accent:' + corAcento + '">' +

             '<div class="kanban-card__title">' + esc(tarefa.titulo) + '</div>' +

             '<div class="kanban-card__meta">' +
               (tarefa.processoNumero
                 ? esc(tarefa.processoNumero) + ' · ' + esc(fmt.truncar(tarefa.clienteNome, 26))
                 : 'Sem processo vinculado') +
             '</div>' +

             progresso +

             '<div class="kanban-card__tags">' +
               (prioridade ? ui.Badge({ rotulo: prioridade.label, variante: prioridade.variante }) : '') +
               (tarefa.atrasada ? ui.Badge({ rotulo: 'Atrasada', variante: 'danger' }) : '') +
             '</div>' +

             '<div class="kanban-card__footer">' +
               ui.Avatar({ usuario: tarefa.responsavel, tamanho: 'sm' }) +
               '<span class="u-xs u-muted">' + esc(fmt.dataCurta(tarefa.dataVencimento)) + '</span>' +
               '<span class="kanban-card__value">' + esc(fmt.dataRelativa(tarefa.dataVencimento)) + '</span>' +
             '</div>' +

           '</article>';
  }

  App.components.ProcessoCard = ProcessoCard;
  App.components.TarefaCard = TarefaCard;
})(window.App = window.App || {});
