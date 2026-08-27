/* ==========================================================================
   pages/AgendaPage.js — calendário forense + lista de prazos e compromissos
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var mesAtual = null;
  var eventos = null;
  var usuarios = [];

  /* Troca de mês por arrastar o dedo — só no calendário, e só um gesto
     bem horizontal: abaixo do limiar, ou mais vertical que horizontal, é
     rolagem normal da lista, não navegação. Sem tocar em touchmove nem
     em preventDefault — a rolagem vertical nunca fica em risco de travar
     por causa disso, porque só medimos onde o toque começou e onde
     terminou. */
  var LIMIAR_SWIPE_PX = 60;
  var toqueInicio = null;

  /* Arrastar prazo ou compromisso para outro dia (grade do calendário,
     telas largas) — mesmo padrão de KanbanBoard.mount: estado em módulo,
     não só `dataTransfer`, porque nem todo navegador devolve o payload
     no `drop` do mesmo jeito. */
  var itemArrastado = null;   // { id, elemento }

  function esc(v) { return App.dom.esc(v); }
  function filtros() { return App.store.getState().agendaFiltros; }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 8 });

    App.services.db.init();
    usuarios = App.services.db.get('usuarios').filter(function (u) {
      return u.perfil === 'socio' || u.perfil === 'advogado';
    });

    if (!mesAtual) mesAtual = primeiroDiaDoMes(App.domain.prazos.hojeISO());
    ligarEventos();   // delegação no container: uma vez por rota
    carregar();
  }

  function primeiroDiaDoMes(iso) {
    return iso.slice(0, 8) + '01';
  }

  function limitesDoMes() {
    var prazos = App.domain.prazos;
    var referencia = prazos.paraDate(mesAtual);

    // A grade do calendário mostra dias vizinhos ao mês — o intervalo
    // precisa cobri-los, senão eventos das bordas somem.
    var inicio = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
    inicio = prazos.addDias(inicio, -inicio.getDay() - 1);
    var fim = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
    fim = prazos.addDias(fim, 14);

    return { de: prazos.paraISO(inicio), ate: prazos.paraISO(fim) };
  }

  /** @param {boolean} [voltarAoCalendario]  troca de mês: o alvo do scroll
      depende da altura da coluna lateral do mês NOVO (varia com a
      quantidade de vencidos/próximos), então só dá pra calcular depois do
      redesenho — nunca antes, com a altura do mês que está saindo. */
  function carregar(voltarAoCalendario) {
    var limites = limitesDoMes();

    App.services.agendaService.porDia(limites.de, limites.ate, filtros())
      .then(function (resultado) {
        eventos = resultado;
        desenhar();
        if (voltarAoCalendario) voltarParaCalendario();
      })
      .catch(function (erro) {
        container.innerHTML = App.components.ui.EmptyState({
          icone: '⚠', titulo: 'Erro ao carregar a agenda', texto: erro.message
        });
      });
  }

  function cabecalho() {
    var totalPrazos = eventos.itens.filter(function (e) { return e.categoria === 'prazo'; }).length;
    var totalCompromissos = eventos.total - totalPrazos;

    return '<div class="page-header">' +
             '<div>' +
               '<h1 class="page-header__title">Agenda</h1>' +
               '<p class="page-header__subtitle">' +
                 totalPrazos + ' ' + App.format.plural(totalPrazos, 'prazo') + ' e ' +
                 totalCompromissos + ' ' + App.format.plural(totalCompromissos, 'compromisso') +
                 ' no período exibido' +
               '</p>' +
             '</div>' +
           '</div>';
  }

  function barraFiltros() {
    var enums = App.domain.enums;
    var f = filtros();

    return App.components.FilterBar({
      campos: [
        { tipo: 'select', nome: 'responsavelId', rotulo: 'Responsável',
          opcoes: enums.opcoes(
            usuarios.map(function (u) { return { id: u.id, label: u.nome }; }),
            f.responsavelId, 'Todos os responsáveis') },
        { tipo: 'select', nome: 'tipo', rotulo: 'Tipo de evento',
          opcoes: enums.opcoes([
            { id: 'prazo', label: 'Somente prazos' },
            { id: 'compromisso', label: 'Somente compromissos' }
          ], f.tipo, 'Prazos e compromissos') },
        { tipo: 'toggle', nome: 'apenasAbertos', rotulo: 'Somente prazos em aberto',
          valor: f.apenasAbertos }
      ],
      totalAtivos: App.selectors.filtrosAtivos(f, ['apenasAbertos']),
      direita: App.components.ui.Button({
        rotulo: 'Novo compromisso', variante: 'secondary',
        icone: '+', acao: 'novo-compromisso'
      }) + App.components.ui.Button({
        rotulo: 'Simulador de prazo', variante: 'secondary',
        icone: App.icones.de('agenda'), href: '#/simulador'
      })
    });
  }

  /** Lista lateral: o que exige ação nos próximos dias. */
  function painelLateral() {
    var ui = App.components.ui;
    var hoje = App.domain.prazos.hojeISO();

    var prazosAbertos = eventos.itens.filter(function (ev) {
      return ev.categoria === 'prazo' &&
             (ev.status === 'pendente' || ev.status === 'em_andamento');
    });

    var vencidos = prazosAbertos.filter(function (ev) { return ev.data < hoje; });
    var proximos = prazosAbertos.filter(function (ev) { return ev.data >= hoje; }).slice(0, 12);

    function paraPrazoCard(ev) {
      return App.services.prazoService.enriquecer(ev.registro);
    }

    var html = '';

    if (vencidos.length) {
      html += ui.Card({
        titulo: 'Vencidos sem baixa',
        subtitulo: vencidos.length + ' item(s)',
        semPadding: true,
        classe: 'agenda-vencidos',
        conteudo: '<div class="agenda-lista-scroll">' +
          App.components.PrazoList({
            prazos: vencidos.map(paraPrazoCard),
            acoes: true
          }) +
        '</div>'
      });
    }

    html += ui.Card({
      titulo: 'Próximos prazos',
      semPadding: true,
      classe: 'agenda-proximos',
      conteudo: '<div class="agenda-lista-scroll">' +
        App.components.PrazoList({
          prazos: proximos.map(paraPrazoCard),
          acoes: true,
          icone: '✓',
          tituloVazio: 'Nenhum prazo à frente',
          textoVazio: 'Não há prazos em aberto no período exibido.'
        }) +
      '</div>'
    });

    return html;
  }

  function desenhar() {
    container.innerHTML =
      cabecalho() +
      barraFiltros() +
      '<div class="agenda-layout">' +
        '<div class="card">' +
          App.components.Calendar({ mes: mesAtual, eventosPorDia: eventos.mapa }) +
        '</div>' +
        '<div class="agenda-sidebar">' + painelLateral() + '</div>' +
      '</div>';
  }

  /** Volta pro calendário, não pro início da página — o cabeçalho da Agenda
      (título, contagem) não ajuda quem só quer ver o mês seguinte, e como a
      barra de filtros agora é sticky, ela continua visível de qualquer jeito.
      O alvo soma a altura da topbar com a da barra de filtros (as duas
      sticky, empilhadas) pra o topo do calendário não ficar por baixo delas. */
  function voltarParaCalendario() {
    var calendario = App.dom.qs('.calendar', container);
    if (!calendario) { window.scrollTo(0, 0); return; }

    var topbar = document.querySelector('.topbar');
    var barraFiltros = App.dom.qs('.filter-bar', container);
    var fixo = (topbar ? topbar.getBoundingClientRect().height : 0) +
               (barraFiltros ? barraFiltros.getBoundingClientRect().height : 0);

    var alvo = calendario.getBoundingClientRect().top + window.scrollY - fixo;
    window.scrollTo(0, Math.max(alvo, 0));
  }

  function mudarMes(delta) {
    var prazos = App.domain.prazos;
    var referencia = prazos.paraDate(mesAtual);
    mesAtual = prazos.paraISO(new Date(referencia.getFullYear(), referencia.getMonth() + delta, 1));
    carregar(true);
  }

  /** Solta um evento arrastado em outro dia. `eventos.itens` é o snapshot
      já carregado — o arrasto começa e termina sem sair da tela, então
      não há corrida com um `carregar()` no meio. Compromisso e prazo têm
      caminhos diferentes a partir daqui: só o segundo pede confirmação. */
  function moverEvento(id, novaData) {
    if (!novaData) return;

    var item = eventos.itens.filter(function (ev) { return ev.id === id; })[0];
    if (!item || item.data === novaData) return;   // soltou no mesmo dia

    if (item.categoria === 'compromisso') moverCompromisso(item, novaData);
    else if (item.categoria === 'prazo') confirmarMoverPrazo(item, novaData);
  }

  /** Compromisso não tem cálculo por trás — troca só a DATA, mantém a hora. */
  function moverCompromisso(item, novaData) {
    App.services.agendaService.atualizarCompromisso(item.id, {
      dataHora: novaData + 'T' + (item.hora || '00:00')
    }).then(function () {
      App.components.Toast.sucesso('Compromisso remarcado',
        item.titulo + ' — ' + App.format.dataExtenso(novaData));
      carregar();
    }).catch(function (erro) {
      App.components.Toast.erro('Não foi possível remarcar', erro.message);
    });
  }

  /** Prazo tem cálculo por trás (motor do CPC): arrastar sobrescreve a
      data fatal calculada por uma escolhida à mão, e isso é grave demais
      pra acontecer num solto de mouse sem aviso — um dia errado aqui é
      prazo perdido de verdade, não desorganização de agenda. */
  function confirmarMoverPrazo(item, novaData) {
    App.components.Modal.confirmar({
      titulo: 'Mover prazo manualmente?',
      mensagem: 'A data fatal de "' + item.titulo + '" foi calculada pelo motor de ' +
                'prazos do CPC. Movê-la para ' + App.format.dataExtenso(novaData) +
                ' substitui esse cálculo por uma data escolhida à mão.',
      detalhe: 'Confira o prazo processual antes de confirmar — a contagem original ' +
               'se perde e não volta sozinha se você arrastar de volta.',
      rotuloConfirmar: 'Mover mesmo assim',
      variante: 'danger'
    }).then(function (confirmado) {
      if (!confirmado) return;

      App.services.prazoService.atualizar(item.id, { dataFatal: novaData }).then(function () {
        App.components.Toast.sucesso('Prazo movido manualmente',
          item.titulo + ' — ' + App.format.dataExtenso(novaData));
        carregar();
      }).catch(function (erro) {
        App.components.Toast.erro('Não foi possível mover o prazo', erro.message);
      });
    });
  }

  function aoTocarInicio(evento) {
    var toque = evento.touches[0];
    toqueInicio = { x: toque.clientX, y: toque.clientY };
  }

  function aoTocarFim(evento) {
    if (!toqueInicio) return;

    var toque = evento.changedTouches[0];
    var deltaX = toque.clientX - toqueInicio.x;
    var deltaY = toque.clientY - toqueInicio.y;
    toqueInicio = null;

    // Horizontal de verdade: precisa vencer o limiar E ser mais deitado
    // que em pé, senão um scroll vertical com leve deriva lateral vira
    // troca de mês sem querer.
    if (Math.abs(deltaX) < LIMIAR_SWIPE_PX || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

    // Arrastar para a esquerda revela o que vem depois — mesma convenção
    // dos apps de calendário (Google Agenda, Apple Calendar).
    mudarMes(deltaX < 0 ? 1 : -1);
  }

  function ligarEventos() {
    App.components.FilterBar.mount(container, {
      aoMudar: function (nome, valor) {
        var alteracoes = {};
        alteracoes[nome] = valor;
        App.store.setState({ agendaFiltros: Object.assign({}, filtros(), alteracoes) });
        carregar();
      },
      aoLimpar: function () {
        App.store.setState({
          agendaFiltros: { responsavelId: '', tipo: '', apenasAbertos: true }
        });
        carregar();
      }
    });

    App.dom.delegate(container, 'click', '[data-action="mes-anterior"]', function () { mudarMes(-1); });
    App.dom.delegate(container, 'click', '[data-action="mes-proximo"]', function () { mudarMes(1); });
    App.dom.delegate(container, 'click', '[data-action="mes-hoje"]', function () {
      mesAtual = primeiroDiaDoMes(App.domain.prazos.hojeISO());
      carregar(true);
    });

    App.dom.delegate(container, 'touchstart', '.calendar', aoTocarInicio);
    App.dom.delegate(container, 'touchend', '.calendar', aoTocarFim);

    App.dom.delegate(container, 'dragstart', '.calendar__event[draggable="true"]', function (evento, botao) {
      itemArrastado = { id: botao.dataset.id, elemento: botao };
      botao.classList.add('calendar__event--dragging');

      if (evento.dataTransfer) {
        evento.dataTransfer.effectAllowed = 'move';
        // Alguns navegadores exigem algum payload para iniciar o arrasto.
        try { evento.dataTransfer.setData('text/plain', botao.dataset.id); } catch (e) { /* ignora */ }
      }
    });

    App.dom.delegate(container, 'dragend', '.calendar__event', function (evento, botao) {
      botao.classList.remove('calendar__event--dragging');
      App.dom.qsa('.calendar__day--dragover', container).forEach(function (dia) {
        dia.classList.remove('calendar__day--dragover');
      });
      itemArrastado = null;
    });

    App.dom.delegate(container, 'dragover', '.calendar__day', function (evento, dia) {
      if (!itemArrastado) return;
      evento.preventDefault();   // sem isso o navegador não permite o drop
      if (evento.dataTransfer) evento.dataTransfer.dropEffect = 'move';

      if (!dia.classList.contains('calendar__day--dragover')) {
        App.dom.qsa('.calendar__day--dragover', container).forEach(function (d) {
          d.classList.remove('calendar__day--dragover');
        });
        dia.classList.add('calendar__day--dragover');
      }
    });

    App.dom.delegate(container, 'dragleave', '.calendar__day', function (evento, dia) {
      // Só limpa quando o ponteiro sai de fato do dia, não ao cruzar filhos.
      if (dia.contains(evento.relatedTarget)) return;
      dia.classList.remove('calendar__day--dragover');
    });

    App.dom.delegate(container, 'drop', '.calendar__day', function (evento, dia) {
      evento.preventDefault();
      dia.classList.remove('calendar__day--dragover');
      if (!itemArrastado) return;

      var item = itemArrastado;
      itemArrastado = null;
      if (item.elemento) item.elemento.classList.remove('calendar__event--dragging');

      moverEvento(item.id, dia.dataset.dia);
    });

    App.dom.delegate(container, 'click', '[data-action="cumprir-prazo"]', function (evento, botao) {
      App.services.prazoService.cumprir(botao.dataset.value).then(function (prazo) {
        App.components.Toast.sucesso('Prazo baixado', prazo.titulo);
        carregar();
      }).catch(function (erro) {
        App.components.Toast.erro('Não foi possível baixar o prazo', erro.message);
      });
    });

    App.dom.delegate(container, 'click', '[data-action="ver-evento"]', function (evento, botao) {
      var item = eventos.itens.filter(function (ev) { return ev.id === botao.dataset.id; })[0];
      if (item) abrirResumoEvento(item);
    });

    App.dom.delegate(container, 'click', '[data-action="novo-compromisso"]', function () {
      abrirNovoCompromisso();
    });

    // Dia sem prazo nem compromisso: clicar oferece criar um dos dois já
    // com a data preenchida. Só existe na grade (só ela marca dia como
    // `--vago` — ver Calendar.js), então não interfere na lista de tela
    // estreita, que não tem essa classe pra selecionar.
    App.dom.delegate(container, 'click', '.calendar__day--vago', function (evento, dia) {
      abrirEscolhaNovoEvento(dia.dataset.dia);
    });
  }

  /** Modal de cadastro — compromisso avulso (reunião, diligência...), com ou
      sem processo vinculado. A agenda não fica limitada a prazo processual.
      @param {string} [dataInicial]  ISO — pré-preenche a data (padrão: hoje) */
  function abrirNovoCompromisso(dataInicial) {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var pessoas = App.services.db.get('pessoas');
    var processosAtivos = App.services.db.get('processos').filter(function (p) {
      return p.status === 'ativo';
    });

    var opcoesProcesso = processosAtivos.map(function (p) {
      var cliente = pessoas.filter(function (x) { return x.id === p.clienteId; })[0];
      return { id: p.id, label: p.numeroInterno + ' — ' + (cliente ? cliente.nome : '') };
    });

    App.components.Modal.abrir({
      titulo: 'Novo compromisso',
      conteudo: '<form id="form-compromisso" class="form-grid">' +
        ui.Field({ nome: 'titulo', rotulo: 'Título', obrigatorio: true,
                   placeholder: 'Ex.: Reunião com o cliente' }) +
        ui.Field({ nome: 'tipo', rotulo: 'Tipo', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(enums.TIPOS_COMPROMISSO, 'reuniao') }) +
        ui.Field({ nome: 'responsavelId', rotulo: 'Responsável', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(
                     usuarios.map(function (u) { return { id: u.id, label: u.nome }; }),
                     App.store.getState().usuarioAtual.id) }) +
        ui.Field({ nome: 'data', rotulo: 'Data', tipo: 'date', largura: 6, obrigatorio: true,
                   valor: dataInicial || App.domain.prazos.hojeISO() }) +
        ui.Field({ nome: 'hora', rotulo: 'Hora', tipo: 'time', largura: 6, obrigatorio: true,
                   valor: '09:00' }) +
        ui.Field({ nome: 'duracaoMin', rotulo: 'Duração (min)', tipo: 'number', largura: 6,
                   valor: 60 }) +
        ui.Field({ nome: 'processoId', rotulo: 'Processo vinculado', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(opcoesProcesso, '', 'Sem processo (uso interno)') }) +
        ui.Field({ nome: 'local', rotulo: 'Local',
                   placeholder: 'Ex.: Escritório, sala 2 · ou um link de videochamada' }) +
      '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Agendar', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'salvar') return;

        var d = App.dom.formToObject(App.dom.qs('#form-compromisso', corpo));
        if (!d.titulo || !d.titulo.trim()) {
          App.components.Toast.aviso('Informe o título do compromisso.');
          return;
        }
        if (!d.data || !d.hora) {
          App.components.Toast.aviso('Informe a data e a hora do compromisso.');
          return;
        }

        App.services.agendaService.criarCompromisso({
          processoId: d.processoId || null,
          tipo: d.tipo,
          titulo: d.titulo.trim(),
          dataHora: d.data + 'T' + d.hora,
          duracaoMin: Number(d.duracaoMin) || 60,
          local: d.local,
          responsavelId: d.responsavelId,
          participantesIds: [d.responsavelId]
        }).then(function () {
          fecharModal();
          App.components.Toast.sucesso('Compromisso agendado', d.titulo.trim());
          carregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível agendar', erro.message);
        });
      }
    });
  }

  /** Modal de cadastro — prazo processual. Ao contrário do compromisso, pede
      o processo (prazo sem processo não existe) e não fixa a data fatal: o
      dia clicado vira a DISPONIBILIZAÇÃO, e o motor do CPC calcula a fatal
      a partir dela — quem clicou num dia "querendo o prazo ali" só vê o
      resultado de verdade na prévia do próprio formulário, antes de salvar.
      @param {string} [dataInicial]  ISO — pré-preenche a disponibilização */
  function abrirNovoPrazo(dataInicial) {
    App.components.PrazoFormModal.abrir({
      dataDisponibilizacao: dataInicial,
      responsavelPadrao: App.store.getState().usuarioAtual.id,
      aoCriar: function () { carregar(); }
    });
  }

  /** Dia vago: pergunta o que entra ali antes de abrir o formulário certo. */
  function abrirEscolhaNovoEvento(dataIso) {
    var fmt = App.format;

    App.components.Modal.abrir({
      titulo: 'Novo em ' + fmt.dataExtenso(dataIso),
      conteudo:
        '<div class="escolha-evento">' +
          '<button type="button" class="escolha-evento__opcao" data-action="escolher-compromisso">' +
            '<span class="escolha-evento__icone" aria-hidden="true">' + App.icones.de('agenda') + '</span>' +
            '<span class="escolha-evento__texto">' +
              '<strong>Compromisso</strong>' +
              '<span class="u-sm u-muted">Reunião, audiência, diligência…</span>' +
            '</span>' +
          '</button>' +
          '<button type="button" class="escolha-evento__opcao" data-action="escolher-prazo">' +
            '<span class="escolha-evento__icone" aria-hidden="true">⏱</span>' +
            '<span class="escolha-evento__texto">' +
              '<strong>Prazo</strong>' +
              '<span class="u-sm u-muted">Data fatal calculada pelo motor do CPC</span>' +
            '</span>' +
          '</button>' +
        '</div>',
      acoes: [{ rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true }],
      aoAcao: function (acao, corpo, fechar) {
        if (acao === 'escolher-compromisso') { fechar(); abrirNovoCompromisso(dataIso); }
        else if (acao === 'escolher-prazo') { fechar(); abrirNovoPrazo(dataIso); }
      }
    });
  }

  /** Modal com o resumo do prazo/compromisso do dia — sem sair da agenda. */
  function abrirResumoEvento(item) {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var fmt = App.format;
    var conteudo;

    if (item.categoria === 'prazo') {
      conteudo = App.components.PrazoCard({
        prazo: App.services.prazoService.enriquecer(item.registro),
        acoes: false
      });
    } else {
      var tipo = enums.achar(enums.TIPOS_COMPROMISSO, item.tipoCompromisso);
      var linhas = [];

      if (tipo) linhas.push(['Tipo', ui.Badge({ rotulo: tipo.label, cor: tipo.cor })]);
      linhas.push(['Quando', esc(fmt.diaSemana(item.data)) + ', ' + esc(fmt.dataExtenso(item.data)) +
                              (item.hora ? ' · ' + esc(item.hora) : '')]);
      if (item.processoNumero) linhas.push(['Processo', esc(item.processoNumero)]);
      if (item.clienteNome) linhas.push(['Cliente', esc(item.clienteNome)]);
      if (item.subtitulo) linhas.push(['Local', esc(item.subtitulo)]);
      if (item.responsavel) linhas.push(['Responsável', esc(item.responsavel.nome)]);

      conteudo = '<dl class="def-list">' +
        linhas.map(function (par) {
          return '<div><dt class="def-list__term">' + par[0] + '</dt>' +
                   '<dd class="def-list__desc">' + par[1] + '</dd></div>';
        }).join('') +
      '</dl>';
    }

    var temProcesso = item.href && item.href !== '#/agenda';

    App.components.Modal.abrir({
      titulo: item.titulo,
      conteudo: conteudo,
      acoes: [{ rotulo: 'Fechar', variante: 'secondary', acao: 'fechar', fechar: true }]
        .concat(temProcesso
          ? [{ rotulo: 'Ver processo completo', variante: 'primary', acao: 'ver-processo', fechar: true }]
          : []),
      aoAcao: function (acao) {
        if (acao === 'ver-processo') window.location.hash = item.href;
      }
    });
  }

  App.pages.AgendaPage = { render: render };
})(window.App = window.App || {});
