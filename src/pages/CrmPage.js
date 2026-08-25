/* ==========================================================================
   pages/CrmPage.js — funil de prospecção

   Reusa o MESMO `KanbanBoard` das telas de processos e tarefas, com outra
   configuração de colunas e outro card. Arrastar muda a etapa.

   O cabeçalho mostra o PIPELINE PONDERADO, e não a soma cheia dos leads:
   somar o valor integral de todo mundo que ligou uma vez daria um número
   grande e falso. Cada etapa tem uma probabilidade, e é ela que pondera.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var leads = [];
  var resumo = null;
  var filtros = { busca: '', responsavelId: '', origem: '', apenasAtrasados: false };
  var desmontarKanban = null;

  function esc(v) { return App.dom.esc(v); }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });
    ligarEventos();
    carregar(true);
  }

  function destroy() {
    if (desmontarKanban) { desmontarKanban(); desmontarKanban = null; }
  }

  function carregar(completo) {
    App.services.leadService.listar(filtros).then(function (lista) {
      leads = lista;
      resumo = App.services.leadService.resumo();
      /* Os KPIs e o subtítulo saem do `resumo`, que é do funil INTEIRO e não
         do filtro — por isso ficam fora do miolo e não precisam de acerto. */
      if (completo || !atualizarMiolo()) desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Erro ao carregar o funil', texto: erro.message
      });
    });
  }

  /** Card do lead — mesmo contrato de `TarefaCard`: (item, coluna) → HTML. */
  function LeadCard(lead) {
    var ui = App.components.ui;

    return '<article class="kanban-card lead-card' +
             (lead.followUpAtrasado ? ' lead-card--atrasado' : '') + '"' +
             ' draggable="true" data-id="' + esc(lead.id) + '">' +
      '<a class="kanban-card__title" href="#/crm/' + esc(lead.id) + '">' +
        esc(lead.nome) + '</a>' +
      '<div class="kanban-card__meta">' + esc(lead.resumoCaso || '') + '</div>' +
      '<div class="lead-card__valor">' +
        esc(App.format.moedaCompacta(lead.valorEstimadoCentavos)) +
        '<span class="lead-card__prob">' + lead.probabilidade + '%</span>' +
      '</div>' +
      '<div class="kanban-card__footer">' +
        (lead.responsavel ? ui.Avatar({ usuario: lead.responsavel, tamanho: 'sm' }) : '') +
        '<span class="u-xs u-subtle">' + esc(lead.rotuloOrigem) + '</span>' +
        (lead.followUpAtrasado
          ? '<span class="lead-card__alerta" title="Follow-up vencido">⏰</span>'
          : (lead.proximoContatoEm
              ? '<span class="u-xs u-subtle">' +
                esc(App.format.dataCurta(lead.proximoContatoEm)) + '</span>'
              : '')) +
      '</div>' +
    '</article>';
  }

  function colunas() {
    var enums = App.domain.enums;

    return enums.ETAPAS_FUNIL.map(function (etapa) {
      var doEtapa = leads.filter(function (l) { return l.etapa === etapa.id; });
      var soma = doEtapa.reduce(function (s, l) {
        return s + (l.valorEstimadoCentavos || 0);
      }, 0);

      return {
        id: etapa.id,
        label: etapa.label,
        cor: etapa.cor,
        descricao: etapa.probabilidade + '% de probabilidade',
        itens: doEtapa,
        total: doEtapa.length,
        rodape: soma ? App.format.moedaCompacta(soma) : ''
      };
    });
  }

  function kpis() {
    var ui = App.components.ui;

    return '<div class="grid grid--kpi">' +
      ui.Kpi({ rotulo: 'Pipeline ponderado',
               valor: App.format.moedaCompacta(resumo.pipelinePonderadoCentavos),
               icone: '📈', cor: 'var(--color-primary-400)',
               dica: 'Valor estimado × probabilidade da etapa' }) +
      ui.Kpi({ rotulo: 'Em andamento',
               valor: resumo.total - resumo.ganhos - resumo.perdidos,
               icone: '🤝' }) +
      ui.Kpi({ rotulo: 'Taxa de conversão', valor: resumo.taxaConversaoPct + '%',
               icone: '✓', cor: 'var(--color-success)',
               dica: resumo.ganhos + ' ganho(s) de ' +
                     (resumo.ganhos + resumo.perdidos) + ' fechado(s)' }) +
      ui.Kpi({ rotulo: 'Follow-up vencido', valor: resumo.followUpAtrasado,
               icone: '⏰',
               cor: resumo.followUpAtrasado
                 ? 'var(--color-danger)' : 'var(--color-text-subtle)' }) +
    '</div>';
  }

  /* Só o miolo muda a cada busca. Cabeçalho e barra de filtros ficam de pé,
     e com eles o campo, o cursor e o foco de quem está digitando — sem isso
     a tela pisca a cada tecla e o `<input>` é destruído debaixo dos dedos. */
  function miolo() {
    return App.components.KanbanBoard({
      colunas: colunas(),
      renderCard: LeadCard,
      arrastavel: true,
      vazio: 'Nenhum interessado'
    });
  }

  function atualizarMiolo() {
    /* O quadro é remontado a cada troca, então o listener de arrastar
       precisa ser desligado antes — senão sobra um por busca. */
    if (desmontarKanban) { desmontarKanban(); desmontarKanban = null; }
    return App.components.FilterBar.trocarMiolo(container, miolo(), {
      totalAtivos: App.selectors.filtrosAtivos(filtros, [])
    });
  }

  function desenhar() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    if (desmontarKanban) { desmontarKanban(); desmontarKanban = null; }

    var usuarios = App.services.db.get('usuarios').map(function (u) {
      return { id: u.id, label: u.nome };
    });

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Prospecção</h1>' +
          '<p class="page-header__subtitle">' +
            resumo.total + ' interessado(s) no funil · arraste o card para mudar de etapa' +
          '</p>' +
        '</div>' +
        '<div class="page-header__actions">' +
          ui.Button({ rotulo: 'Novo interessado', variante: 'primary', icone: '+',
                      acao: 'novo-lead' }) +
        '</div>' +
      '</div>' +

      kpis() +

      App.components.FilterBar({
        campos: [
          { tipo: 'busca', nome: 'busca', valor: filtros.busca,
            placeholder: 'Buscar por nome, caso ou e-mail…' },
          { tipo: 'select', nome: 'responsavelId', rotulo: 'Responsável',
            opcoes: enums.opcoes(usuarios, filtros.responsavelId, 'Todos') },
          { tipo: 'select', nome: 'origem', rotulo: 'Origem',
            opcoes: enums.opcoes(enums.ORIGENS_LEAD, filtros.origem, 'Todas as origens') },
          { tipo: 'checkbox', nome: 'apenasAtrasados', rotulo: 'Só follow-up vencido',
            valor: filtros.apenasAtrasados }
        ],
        totalAtivos: App.selectors.filtrosAtivos(filtros, [])
      }) +

      '<div data-miolo>' + miolo() + '</div>';

    desmontarKanban = App.components.KanbanBoard.mount(container, {
      aoMover: moverLead
    });
  }

  // --- Ações --------------------------------------------------------------------

  function moverLead(leadId, destino) {
    var lead = leads.filter(function (l) { return l.id === leadId; })[0];
    if (!lead || lead.etapa === destino) return;

    if (destino === 'perdido') { abrirMotivoPerda(leadId); return; }
    if (destino === 'ganho') { App.router.ir('#/crm/' + leadId + '?converter=1'); return; }

    App.services.leadService.mudarEtapa(leadId, destino, {}).then(function (l) {
      App.components.Toast.sucesso('Etapa alterada', l.nome + ' → ' + l.etapaLabel);
      carregar();
    }).catch(function (erro) {
      App.components.Toast.erro('Não foi possível mover', erro.message);
      carregar();
    });
  }

  function abrirMotivoPerda(leadId) {
    var ui = App.components.ui;

    App.components.Modal.abrir({
      titulo: 'Registrar perda',
      conteudo:
        '<p class="u-sm u-muted">Sem o motivo, o funil não ensina nada. Com ele, vira o ' +
        'relatório que diz se o escritório perde por preço, por prazo ou por não ter ' +
        'respondido a tempo.</p>' +
        '<form id="form-perda-lead">' +
          ui.Field({ nome: 'motivoPerda', rotulo: 'Por que não fechou', tipo: 'textarea',
                     linhas: 3, obrigatorio: true }) +
        '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Registrar perda', variante: 'danger', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'salvar') { carregar(); return; }
        var d = App.dom.formToObject(App.dom.qs('#form-perda-lead', corpo));

        App.services.leadService.mudarEtapa(leadId, 'perdido', d).then(function () {
          fecharModal();
          App.components.Toast.aviso('Perda registrada');
          carregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível registrar', erro.message);
        });
      },
      aoFechar: carregar
    });
  }

  function abrirNovoLead() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var usuarios = App.services.db.get('usuarios')
      .filter(function (u) { return u.perfil === 'socio' || u.perfil === 'advogado'; })
      .map(function (u) { return { id: u.id, label: u.nome }; });

    App.components.Modal.abrir({
      titulo: 'Novo interessado',
      conteudo:
        '<form id="form-lead">' +
          ui.Field({ nome: 'nome', rotulo: 'Nome', obrigatorio: true }) +
          '<div class="form-grid">' +
            ui.Field({ nome: 'telefone', rotulo: 'Telefone', largura: 6 }) +
            ui.Field({ nome: 'email', rotulo: 'E-mail', tipo: 'email', largura: 6 }) +
            ui.Field({ nome: 'origem', rotulo: 'Como chegou', tipo: 'select', largura: 6,
                       opcoes: enums.opcoes(enums.ORIGENS_LEAD, 'indicacao') }) +
            ui.Field({ nome: 'areaId', rotulo: 'Área', tipo: 'select', largura: 6,
                       opcoes: enums.opcoes(enums.AREAS, 'civel') }) +
            ui.Field({ nome: 'valorEstimado', rotulo: 'Valor estimado', largura: 6,
                       placeholder: 'R$ 0,00' }) +
            ui.Field({ nome: 'responsavelId', rotulo: 'Responsável', tipo: 'select',
                       largura: 6, opcoes: enums.opcoes(usuarios,
                         (App.store.getState().usuarioAtual || {}).id) }) +
          '</div>' +
          ui.Field({ nome: 'resumoCaso', rotulo: 'O caso', tipo: 'textarea', linhas: 3 }) +
          ui.Field({ nome: 'proximoContatoEm', rotulo: 'Retornar em', tipo: 'date',
                     dica: 'O sistema avisa quando a data passar.' }) +
        '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Cadastrar', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'salvar') return;
        var d = App.dom.formToObject(App.dom.qs('#form-lead', corpo));

        App.services.leadService.criar({
          nome: d.nome,
          telefone: d.telefone,
          email: d.email,
          origem: d.origem,
          areaId: d.areaId,
          resumoCaso: d.resumoCaso,
          valorEstimadoCentavos: App.moeda.deReais(d.valorEstimado),
          responsavelId: d.responsavelId,
          proximoContatoEm: d.proximoContatoEm || null
        }).then(function (l) {
          fecharModal();
          App.components.Toast.sucesso('Interessado cadastrado', l.nome);
          carregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível cadastrar', erro.message);
        });
      }
    });
  }

  function ligarEventos() {
    App.components.FilterBar.mount(container, {
      aoMudar: function (nome, valor) { filtros[nome] = valor; carregar(); },
      aoLimpar: function () {
        filtros = { busca: '', responsavelId: '', origem: '', apenasAtrasados: false };
        carregar();
      }
    });

    App.dom.delegate(container, 'click', '[data-action="novo-lead"]', abrirNovoLead);
  }

  App.pages.CrmPage = { render: render, destroy: destroy };
})(window.App = window.App || {});
