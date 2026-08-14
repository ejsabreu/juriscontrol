/* ==========================================================================
   domain/indicadores.js — os números do escritório

   Uma função por relatório. Cada uma recebe COLEÇÕES e devolve uma
   estrutura pronta para a tela: título, gráfico, tabela e totais. Nenhuma
   consulta ao store, nenhum DOM, nenhum service — é o módulo mais fácil de
   testar do projeto inteiro, e é de propósito: relatório errado é pior que
   relatório nenhum, porque decisão é tomada em cima dele.

   CONTRATO DE RETORNO — a tela de relatório é genérica e dirigida por ele:

     {
       titulo, subtitulo,
       grafico: { tipo, categorias, series, formatarValor, paleta, orientacao },
       tabela:  { colunas: [{ campo, titulo, formatar, alinhamento }], linhas },
       totais:  [{ rotulo, valor, cor }],
       vazio:   boolean,
       nota:    string
     }

   REGRA DE COR: identidade (advogado, área, tipo) usa a paleta categórica;
   ordem que É significado (fase do processo, faixa de aging, etapa do
   funil) usa a rampa ordinal de um matiz só, para o leitor ver a ordem na
   própria cor. Nunca dois eixos de valor — `Chart.js` nem oferece.
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  function enums() { return App.domain.enums; }
  function prazos() { return App.domain.prazos; }
  function fin()    { return App.domain.financeiro; }

  function moeda(c) { return App.format.moeda(c); }
  function moedaCompacta(c) { return App.format.moedaCompacta(c); }
  function numero(v) { return App.format.numero(v); }

  /** Filtra por período usando o campo de data que o relatório indicar. */
  function noPeriodo(lista, campo, periodo) {
    var p = periodo || {};
    return (lista || []).filter(function (item) {
      var data = String(item[campo] || '').slice(0, 10);
      if (!data) return false;
      if (p.de && data < p.de) return false;
      if (p.ate && data > p.ate) return false;
      return true;
    });
  }

  function vazio(titulo, subtitulo, nota) {
    return {
      titulo: titulo, subtitulo: subtitulo, vazio: true,
      grafico: null, tabela: null, totais: [],
      nota: nota || 'Nenhum dado no período selecionado.'
    };
  }

  function rotuloMes(competencia) {
    var partes = String(competencia).split('-');
    var i = parseInt(partes[1], 10) - 1;
    return (App.format.MESES_ABREV[i] || '?') + '/' + partes[0].slice(2);
  }

  // ===================== 1. PRODUTIVIDADE POR ADVOGADO =====================

  /**
   * Quem entregou o quê no período.
   *
   * Conta prazos CUMPRIDOS (não os criados) e tarefas CONCLUÍDAS: o que
   * mede produtividade é a entrega, não o volume que caiu na mesa.
   */
  function produtividade(dados) {
    var d = dados || {};
    var periodo = d.periodo || {};
    var usuarios = (d.usuarios || []).filter(function (u) {
      return u.perfil === 'socio' || u.perfil === 'advogado' || u.perfil === 'estagiario';
    });
    if (!usuarios.length) return vazio('Produtividade por advogado');

    var cumpridos = noPeriodo(
      (d.prazos || []).filter(function (p) { return p.status === 'cumprido'; }),
      'dataCumprimento', periodo);
    var perdidos = noPeriodo(
      (d.prazos || []).filter(function (p) { return p.status === 'perdido'; }),
      'perdidoEm', periodo);
    var tarefas = noPeriodo(
      (d.tarefas || []).filter(function (t) { return t.status === 'concluida'; }),
      'concluidoEm', periodo);
    var apontamentos = noPeriodo(d.apontamentos || [], 'data', periodo);

    var linhas = usuarios.map(function (u) {
      var meus = cumpridos.filter(function (p) { return p.responsavelId === u.id; });
      var minhasTarefas = tarefas.filter(function (t) { return t.responsavelId === u.id; });
      var minhasHoras = apontamentos.filter(function (a) { return a.usuarioId === u.id; });
      var meusPerdidos = perdidos.filter(function (p) { return p.responsavelId === u.id; });

      var minutos = minhasHoras.reduce(function (s, a) { return s + (a.minutos || 0); }, 0);

      return {
        usuarioId: u.id,
        nome: u.nome,
        perfil: enums().rotulo(enums().PERFIS, u.perfil),
        prazosCumpridos: meus.length,
        prazosPerdidos: meusPerdidos.length,
        tarefas: minhasTarefas.length,
        minutos: minutos,
        horas: Math.round(minutos / 60 * 10) / 10
      };
    }).filter(function (l) {
      // Quem não entregou nada no período não vira linha em branco.
      return l.prazosCumpridos || l.tarefas || l.minutos || l.prazosPerdidos;
    }).sort(function (a, b) { return b.prazosCumpridos - a.prazosCumpridos; });

    if (!linhas.length) return vazio('Produtividade por advogado');

    return {
      titulo: 'Produtividade por advogado',
      subtitulo: 'prazos cumpridos, tarefas concluídas e horas apontadas',
      vazio: false,
      grafico: {
        tipo: 'barras',
        orientacao: 'barra',
        categorias: linhas.map(function (l) { return l.nome; }),
        series: [
          { id: 'prazos', label: 'Prazos cumpridos',
            valores: linhas.map(function (l) { return l.prazosCumpridos; }) },
          { id: 'tarefas', label: 'Tarefas concluídas',
            valores: linhas.map(function (l) { return l.tarefas; }) }
        ],
        formatarValor: numero
      },
      tabela: {
        colunas: [
          { campo: 'nome', titulo: 'Profissional' },
          { campo: 'perfil', titulo: 'Perfil' },
          { campo: 'prazosCumpridos', titulo: 'Prazos cumpridos', alinhamento: 'direita' },
          { campo: 'prazosPerdidos', titulo: 'Perdidos', alinhamento: 'direita' },
          { campo: 'tarefas', titulo: 'Tarefas', alinhamento: 'direita' },
          { campo: 'horas', titulo: 'Horas', alinhamento: 'direita',
            formatar: function (v) { return v + 'h'; } }
        ],
        linhas: linhas
      },
      totais: [
        { rotulo: 'Prazos cumpridos', valor: numero(cumpridos.length) },
        { rotulo: 'Tarefas concluídas', valor: numero(tarefas.length) },
        { rotulo: 'Horas apontadas',
          valor: Math.round(apontamentos.reduce(function (s, a) {
            return s + (a.minutos || 0);
          }, 0) / 60) + 'h' }
      ],
      nota: 'Conta o que foi ENTREGUE no período — prazo cumprido e tarefa concluída —, ' +
            'não o volume que caiu na mesa.'
    };
  }

  // ===================== 2. PRAZOS =====================

  /**
   * Cumpridos no prazo × cumpridos em cima × perdidos.
   *
   * "No prazo" aqui significa cumprido até a DATA INTERNA (a folga do
   * escritório), não até a fatal. Cumprir na data fatal é cumprir — mas é
   * também o sinal de que o processo está sendo tocado no limite.
   */
  function desempenhoPrazos(dados) {
    var d = dados || {};
    var todos = noPeriodo(d.prazos || [], 'dataFatal', d.periodo);
    if (!todos.length) return vazio('Desempenho em prazos');

    var cumpridos = todos.filter(function (p) { return p.status === 'cumprido'; });
    var perdidos = todos.filter(function (p) { return p.status === 'perdido'; });
    var abertos = todos.filter(function (p) {
      return p.status === 'pendente' || p.status === 'em_andamento';
    });

    var comFolga = cumpridos.filter(function (p) {
      return p.dataInterna && p.dataCumprimento && p.dataCumprimento <= p.dataInterna;
    });
    var noLimite = cumpridos.length - comFolga.length;

    var porMes = {};
    cumpridos.concat(perdidos).forEach(function (p) {
      var mes = String(p.dataFatal || '').slice(0, 7);
      if (!mes) return;
      if (!porMes[mes]) porMes[mes] = { cumpridos: 0, perdidos: 0 };
      if (p.status === 'cumprido') porMes[mes].cumpridos++;
      else porMes[mes].perdidos++;
    });

    var meses = Object.keys(porMes).sort();

    return {
      titulo: 'Desempenho em prazos',
      subtitulo: 'cumpridos com folga, no limite e perdidos',
      vazio: false,
      grafico: {
        tipo: 'barras',
        empilhado: true,
        categorias: meses.map(rotuloMes),
        series: [
          { id: 'cumpridos', label: 'Cumpridos',
            valores: meses.map(function (m) { return porMes[m].cumpridos; }) },
          { id: 'perdidos', label: 'Perdidos',
            valores: meses.map(function (m) { return porMes[m].perdidos; }) }
        ],
        formatarValor: numero
      },
      tabela: {
        colunas: [
          { campo: 'situacao', titulo: 'Situação' },
          { campo: 'quantidade', titulo: 'Quantidade', alinhamento: 'direita' },
          { campo: 'percentual', titulo: '%', alinhamento: 'direita',
            formatar: function (v) { return v + '%'; } }
        ],
        linhas: [
          { situacao: 'Cumpridos com folga', quantidade: comFolga.length,
            percentual: pct(comFolga.length, todos.length) },
          { situacao: 'Cumpridos no limite', quantidade: noLimite,
            percentual: pct(noLimite, todos.length) },
          { situacao: 'Perdidos', quantidade: perdidos.length,
            percentual: pct(perdidos.length, todos.length) },
          { situacao: 'Ainda em aberto', quantidade: abertos.length,
            percentual: pct(abertos.length, todos.length) }
        ]
      },
      totais: [
        { rotulo: 'Prazos no período', valor: numero(todos.length) },
        { rotulo: 'Cumpridos', valor: numero(cumpridos.length),
          cor: 'var(--color-success)' },
        { rotulo: 'Perdidos', valor: numero(perdidos.length),
          cor: perdidos.length ? 'var(--color-danger)' : undefined }
      ],
      nota: '"Com folga" significa cumprido até a data interna do escritório. Cumprir na ' +
            'data fatal é cumprir — mas é sinal de processo tocado no limite.'
    };
  }

  function pct(parte, total) {
    if (!total) return 0;
    return Math.round((parte / total) * 1000) / 10;
  }

  // ===================== 3. CONTINGÊNCIA =====================

  /**
   * Provisão por risco — o relatório que o cliente corporativo exige.
   *
   * Sai quase de graça porque `valorProvisao` e `risco` estão no modelo
   * desde a fase 1 (seção 14 do PLANEJAMENTO) e nunca tinham sido usados.
   */
  function contingencia(dados) {
    var d = dados || {};
    var processos = (d.processos || []).filter(function (p) {
      return p.status === 'ativo' || p.status === 'suspenso';
    });
    if (!processos.length) return vazio('Contingência');

    var porRisco = enums().RISCOS.map(function (r) {
      var doRisco = processos.filter(function (p) { return p.risco === r.id; });
      return {
        riscoId: r.id,
        risco: r.label,
        descricao: r.descricao,
        quantidade: doRisco.length,
        provisao: doRisco.reduce(function (s, p) {
          return s + Math.round(p.valorProvisao || 0);
        }, 0),
        valorCausa: doRisco.reduce(function (s, p) {
          return s + Math.round(p.valorCausa || 0);
        }, 0)
      };
    });

    var totalProvisao = porRisco.reduce(function (s, r) { return s + r.provisao; }, 0);

    var porArea = {};
    processos.forEach(function (p) {
      var chave = p.areaId || 'outro';
      porArea[chave] = (porArea[chave] || 0) + Math.round(p.valorProvisao || 0);
    });
    var areas = Object.keys(porArea).filter(function (a) { return porArea[a] > 0; });

    return {
      titulo: 'Contingência',
      subtitulo: 'provisão por grau de risco',
      vazio: false,
      grafico: {
        tipo: 'donut',
        fatias: areas.map(function (a) {
          return { id: a, label: enums().rotulo(enums().AREAS, a), valor: porArea[a] };
        }),
        formatarValor: moedaCompacta,
        valorCentral: moedaCompacta(totalProvisao),
        rotuloCentral: 'provisionado'
      },
      tabela: {
        colunas: [
          { campo: 'risco', titulo: 'Risco' },
          { campo: 'descricao', titulo: 'Tratamento contábil' },
          { campo: 'quantidade', titulo: 'Processos', alinhamento: 'direita' },
          { campo: 'valorCausa', titulo: 'Valor da causa', alinhamento: 'direita',
            formatar: moeda },
          { campo: 'provisao', titulo: 'Provisão', alinhamento: 'direita', formatar: moeda }
        ],
        linhas: porRisco
      },
      totais: [
        { rotulo: 'Provisionado', valor: moeda(totalProvisao) },
        { rotulo: 'Perda provável',
          valor: moeda(porRisco.filter(function (r) {
            return r.riscoId === 'provavel';
          })[0].provisao),
          cor: 'var(--color-danger)' },
        { rotulo: 'Processos avaliados', valor: numero(processos.length) }
      ],
      nota: 'Perda PROVÁVEL exige provisão contábil; POSSÍVEL vai em nota explicativa; ' +
            'REMOTA não é divulgada. É a classificação que a auditoria pede.'
    };
  }

  // ===================== 4. CARTEIRA E TEMPO POR FASE =====================

  function carteira(dados) {
    var d = dados || {};
    var processos = (d.processos || []).filter(function (p) { return p.status === 'ativo'; });
    if (!processos.length) return vazio('Carteira de processos');

    var hoje = d.hoje || prazos().hojeISO();

    /* Fase é ORDINAL — a ordem do rito é o significado —, então a rampa de
       um matiz só mostra o avanço na própria cor. */
    var porFase = enums().FASES.map(function (f) {
      var daFase = processos.filter(function (p) { return p.faseId === f.id; });

      var idades = daFase
        .filter(function (p) { return p.dataDistribuicao; })
        .map(function (p) {
          return prazos().diasCorridosEntre(p.dataDistribuicao, hoje);
        });

      var media = idades.length
        ? Math.round(idades.reduce(function (s, v) { return s + v; }, 0) / idades.length)
        : 0;

      return {
        faseId: f.id,
        fase: f.label,
        quantidade: daFase.length,
        valorCausa: daFase.reduce(function (s, p) {
          return s + Math.round(p.valorCausa || 0);
        }, 0),
        idadeMedia: media
      };
    });

    return {
      titulo: 'Carteira de processos',
      subtitulo: 'distribuição por fase e idade média',
      vazio: false,
      grafico: {
        tipo: 'barras',
        paleta: 'ordinal',
        categorias: porFase.map(function (f) { return f.fase; }),
        series: [{ id: 'qtd', label: 'Processos',
                   valores: porFase.map(function (f) { return f.quantidade; }) }],
        formatarValor: numero
      },
      tabela: {
        colunas: [
          { campo: 'fase', titulo: 'Fase' },
          { campo: 'quantidade', titulo: 'Processos', alinhamento: 'direita' },
          { campo: 'valorCausa', titulo: 'Valor da causa', alinhamento: 'direita',
            formatar: moeda },
          { campo: 'idadeMedia', titulo: 'Idade média', alinhamento: 'direita',
            formatar: function (v) { return v ? v + ' dias' : '—'; } }
        ],
        linhas: porFase
      },
      totais: [
        { rotulo: 'Processos ativos', valor: numero(processos.length) },
        { rotulo: 'Valor da carteira',
          valor: moeda(processos.reduce(function (s, p) {
            return s + Math.round(p.valorCausa || 0);
          }, 0)) }
      ],
      nota: 'Idade média conta desde a distribuição — mede há quanto tempo o processo ' +
            'está em curso, não há quanto tempo está nesta fase.'
    };
  }

  // ===================== 5. TAXA DE ÊXITO =====================

  function taxaExito(dados) {
    var d = dados || {};
    var encerrados = (d.processos || []).filter(function (p) {
      return p.status === 'encerrado' || p.status === 'arquivado';
    });
    if (!encerrados.length) {
      return vazio('Taxa de êxito', 'por área',
        'Nenhum processo encerrado — a taxa de êxito precisa de casos concluídos.');
    }

    var porArea = enums().AREAS.map(function (a) {
      var daArea = encerrados.filter(function (p) { return p.areaId === a.id; });
      /* Sem campo de desfecho no modelo, o risco final é o que se tem: um
         processo encerrado marcado como perda REMOTA terminou bem. É uma
         aproximação, e a nota do relatório diz isso. */
      var bons = daArea.filter(function (p) { return p.risco === 'remoto'; }).length;

      return {
        areaId: a.id,
        area: a.label,
        encerrados: daArea.length,
        favoraveis: bons,
        taxa: pct(bons, daArea.length)
      };
    }).filter(function (l) { return l.encerrados > 0; })
      .sort(function (a, b) { return b.taxa - a.taxa; });

    if (!porArea.length) return vazio('Taxa de êxito', 'por área');

    var totalBons = porArea.reduce(function (s, a) { return s + a.favoraveis; }, 0);

    return {
      titulo: 'Taxa de êxito',
      subtitulo: 'por área do direito',
      vazio: false,
      grafico: {
        tipo: 'barras',
        orientacao: 'barra',
        categorias: porArea.map(function (a) { return a.area; }),
        series: [{ id: 'taxa', label: 'Taxa de êxito',
                   valores: porArea.map(function (a) { return a.taxa; }) }],
        formatarValor: function (v) { return v + '%'; }
      },
      tabela: {
        colunas: [
          { campo: 'area', titulo: 'Área' },
          { campo: 'encerrados', titulo: 'Encerrados', alinhamento: 'direita' },
          { campo: 'favoraveis', titulo: 'Favoráveis', alinhamento: 'direita' },
          { campo: 'taxa', titulo: 'Taxa', alinhamento: 'direita',
            formatar: function (v) { return v + '%'; } }
        ],
        linhas: porArea
      },
      totais: [
        { rotulo: 'Processos encerrados', valor: numero(encerrados.length) },
        { rotulo: 'Taxa geral', valor: pct(totalBons, encerrados.length) + '%' }
      ],
      nota: 'APROXIMAÇÃO: o modelo não tem campo de desfecho, então "favorável" é ' +
            'inferido do risco final (perda remota). Um campo próprio daria um número ' +
            'mais honesto.'
    };
  }

  // ===================== 6. FATURAMENTO =====================

  function faturamento(dados) {
    var d = dados || {};
    var lancamentos = (d.lancamentos || []).filter(function (l) {
      return l.status !== 'cancelado';
    });
    if (!lancamentos.length) return vazio('Faturamento');

    var periodo = d.periodo || {};
    var de = periodo.de || fin().somarMeses(prazos().hojeISO(), -11);
    var ate = periodo.ate || prazos().hojeISO();

    var fluxo = fin().fluxoCaixa(lancamentos, de, ate, 'caixa');

    var recebido = fluxo.totais.entradas;
    var pago = fluxo.totais.saidas;

    var linhas = fluxo.meses.map(function (m, i) {
      return {
        mes: rotuloMes(m),
        entradas: fluxo.entradas[i],
        saidas: fluxo.saidas[i],
        saldo: fluxo.saldo[i]
      };
    });

    return {
      titulo: 'Faturamento',
      subtitulo: 'regime de caixa — o que entrou e saiu de fato',
      vazio: false,
      grafico: {
        tipo: 'barras',
        categorias: fluxo.meses.map(rotuloMes),
        series: [
          { id: 'entradas', label: 'Entradas', valores: fluxo.entradas },
          { id: 'saidas', label: 'Saídas', valores: fluxo.saidas }
        ],
        formatarValor: moedaCompacta
      },
      tabela: {
        colunas: [
          { campo: 'mes', titulo: 'Mês' },
          { campo: 'entradas', titulo: 'Entradas', alinhamento: 'direita', formatar: moeda },
          { campo: 'saidas', titulo: 'Saídas', alinhamento: 'direita', formatar: moeda },
          { campo: 'saldo', titulo: 'Saldo', alinhamento: 'direita', formatar: moeda }
        ],
        linhas: linhas
      },
      totais: [
        { rotulo: 'Recebido', valor: moeda(recebido), cor: 'var(--color-success)' },
        { rotulo: 'Pago', valor: moeda(pago), cor: 'var(--color-warning)' },
        { rotulo: 'Resultado', valor: moeda(recebido - pago),
          cor: recebido - pago >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }
      ],
      nota: 'Regime de CAIXA: só o que foi efetivamente pago. Responde "quanto entrou", ' +
            'não "quanto faturamos".'
    };
  }

  // ===================== 7. INADIMPLÊNCIA E AGING =====================

  function inadimplencia(dados) {
    var d = dados || {};
    var lancamentos = d.lancamentos || [];
    var hoje = d.hoje || prazos().hojeISO();

    var faixas = fin().aging(lancamentos, hoje);
    var total = faixas.reduce(function (s, f) { return s + f.valorCentavos; }, 0);
    if (!total) return vazio('Inadimplência', 'aging de recebíveis');

    var emAtraso = faixas
      .filter(function (f) { return f.id !== 'a_vencer'; })
      .reduce(function (s, f) { return s + f.valorCentavos; }, 0);

    // Piores pagadores: quem concentra o atraso.
    var porCliente = {};
    lancamentos.forEach(function (l) {
      if (l.tipo !== 'receita' || l.status === 'pago' || l.status === 'cancelado') return;
      if (!l.dataVencimento || l.dataVencimento >= hoje) return;
      var chave = l.clienteId || 'sem';
      porCliente[chave] = (porCliente[chave] || 0) + Math.round(l.valorCentavos || 0);
    });

    var pessoas = d.pessoas || [];
    var devedores = Object.keys(porCliente).map(function (id) {
      var p = pessoas.filter(function (x) { return x.id === id; })[0];
      return {
        cliente: p ? p.nome : 'Sem cliente vinculado',
        valor: porCliente[id],
        participacao: pct(porCliente[id], emAtraso)
      };
    }).sort(function (a, b) { return b.valor - a.valor; }).slice(0, 10);

    return {
      titulo: 'Inadimplência',
      subtitulo: 'aging de recebíveis e maiores devedores',
      vazio: false,
      grafico: {
        tipo: 'barras',
        // Faixa de aging é ORDINAL: a gravidade cresce na própria cor.
        paleta: 'ordinal',
        orientacao: 'barra',
        categorias: faixas.map(function (f) { return f.label; }),
        series: [{ id: 'valor', label: 'Em aberto',
                   valores: faixas.map(function (f) { return f.valorCentavos; }) }],
        formatarValor: moedaCompacta
      },
      tabela: {
        colunas: [
          { campo: 'cliente', titulo: 'Cliente' },
          { campo: 'valor', titulo: 'Em atraso', alinhamento: 'direita', formatar: moeda },
          { campo: 'participacao', titulo: '% do total', alinhamento: 'direita',
            formatar: function (v) { return v + '%'; } }
        ],
        linhas: devedores
      },
      totais: [
        { rotulo: 'Em atraso', valor: moeda(emAtraso), cor: 'var(--color-danger)' },
        { rotulo: 'A vencer',
          valor: moeda(faixas.filter(function (f) {
            return f.id === 'a_vencer';
          })[0].valorCentavos) },
        { rotulo: 'Índice', valor: pct(emAtraso, total) + '%' }
      ],
      nota: 'Concentração importa tanto quanto o total: dez clientes devendo pouco é ' +
            'gestão; um cliente devendo tudo é risco.'
    };
  }

  // ===================== 8. RENTABILIDADE POR PROCESSO =====================

  function rentabilidade(dados) {
    var d = dados || {};
    var processos = d.processos || [];
    var lancamentos = d.lancamentos || [];
    var apontamentos = d.apontamentos || [];
    var contratos = d.contratos || [];
    if (!processos.length) return vazio('Rentabilidade por processo');

    var linhas = processos.map(function (p) {
      var contrato = contratos.filter(function (c) { return c.processoId === p.id; })[0];

      var resultado = fin().rentabilidade({
        lancamentos: lancamentos.filter(function (l) { return l.processoId === p.id; }),
        apontamentos: apontamentos.filter(function (a) { return a.processoId === p.id; }),
        valorHoraCentavos: (contrato && contrato.valorHoraCentavos) || 25000
      });

      return {
        processoId: p.id,
        numero: p.numeroInterno || p.numeroCnj,
        assunto: p.assunto,
        receita: resultado.receitaCentavos,
        custo: resultado.custoTotalCentavos,
        horas: Math.round(resultado.minutos / 60 * 10) / 10,
        resultado: resultado.resultadoCentavos,
        margem: resultado.margemPct
      };
    }).filter(function (l) { return l.receita > 0 || l.custo > 0; })
      .sort(function (a, b) { return b.resultado - a.resultado; });

    if (!linhas.length) return vazio('Rentabilidade por processo');

    var deficitarios = linhas.filter(function (l) { return l.resultado < 0; });
    var melhores = linhas.slice(0, 12);

    return {
      titulo: 'Rentabilidade por processo',
      subtitulo: 'receita menos despesas e horas apontadas',
      vazio: false,
      grafico: {
        tipo: 'barras',
        orientacao: 'barra',
        categorias: melhores.map(function (l) { return l.numero; }),
        series: [{ id: 'resultado', label: 'Resultado',
                   valores: melhores.map(function (l) { return l.resultado; }) }],
        formatarValor: moedaCompacta
      },
      tabela: {
        colunas: [
          { campo: 'numero', titulo: 'Processo' },
          { campo: 'assunto', titulo: 'Assunto' },
          { campo: 'receita', titulo: 'Receita', alinhamento: 'direita', formatar: moeda },
          { campo: 'custo', titulo: 'Custo', alinhamento: 'direita', formatar: moeda },
          { campo: 'horas', titulo: 'Horas', alinhamento: 'direita',
            formatar: function (v) { return v + 'h'; } },
          { campo: 'resultado', titulo: 'Resultado', alinhamento: 'direita', formatar: moeda },
          { campo: 'margem', titulo: 'Margem', alinhamento: 'direita',
            formatar: function (v) { return v + '%'; } }
        ],
        linhas: linhas
      },
      totais: [
        { rotulo: 'Processos avaliados', valor: numero(linhas.length) },
        { rotulo: 'Deficitários', valor: numero(deficitarios.length),
          cor: deficitarios.length ? 'var(--color-danger)' : undefined },
        { rotulo: 'Resultado somado',
          valor: moeda(linhas.reduce(function (s, l) { return s + l.resultado; }, 0)) }
      ],
      nota: 'O custo inclui as HORAS apontadas ao valor-hora do contrato (ou à referência ' +
            'do escritório). Sem esse custo, todo processo pareceria lucrativo.'
    };
  }

  // ===================== 9. FUNIL DE CONVERSÃO =====================

  function funil(dados) {
    var d = dados || {};
    var leads = d.leads || [];
    if (!leads.length) return vazio('Funil de conversão');

    var porEtapa = enums().ETAPAS_FUNIL.map(function (e) {
      var daEtapa = leads.filter(function (l) { return l.etapa === e.id; });
      return {
        etapaId: e.id,
        etapa: e.label,
        quantidade: daEtapa.length,
        valor: daEtapa.reduce(function (s, l) {
          return s + Math.round(l.valorEstimadoCentavos || 0);
        }, 0)
      };
    });

    var ganhos = porEtapa.filter(function (e) { return e.etapaId === 'ganho'; })[0];
    var perdidos = porEtapa.filter(function (e) { return e.etapaId === 'perdido'; })[0];
    var fechados = ganhos.quantidade + perdidos.quantidade;

    // Por que se perde: é o que o relatório de funil existe para responder.
    var motivos = {};
    leads.filter(function (l) { return l.etapa === 'perdido' && l.motivoPerda; })
      .forEach(function (l) {
        motivos[l.motivoPerda] = (motivos[l.motivoPerda] || 0) + 1;
      });

    var porOrigem = {};
    leads.forEach(function (l) {
      var chave = l.origem || 'outro';
      if (!porOrigem[chave]) porOrigem[chave] = { total: 0, ganhos: 0 };
      porOrigem[chave].total++;
      if (l.etapa === 'ganho') porOrigem[chave].ganhos++;
    });

    var origens = Object.keys(porOrigem).map(function (o) {
      return {
        origem: enums().rotulo(enums().ORIGENS_LEAD, o),
        total: porOrigem[o].total,
        ganhos: porOrigem[o].ganhos,
        conversao: pct(porOrigem[o].ganhos, porOrigem[o].total)
      };
    }).sort(function (a, b) { return b.total - a.total; });

    return {
      titulo: 'Funil de conversão',
      subtitulo: 'etapas, origem e motivos de perda',
      vazio: false,
      grafico: {
        tipo: 'barras',
        // Etapa do funil é ORDINAL — a ordem É o significado.
        paleta: 'ordinal',
        orientacao: 'barra',
        categorias: porEtapa.map(function (e) { return e.etapa; }),
        series: [{ id: 'qtd', label: 'Interessados',
                   valores: porEtapa.map(function (e) { return e.quantidade; }) }],
        formatarValor: numero
      },
      tabela: {
        colunas: [
          { campo: 'origem', titulo: 'Origem' },
          { campo: 'total', titulo: 'Interessados', alinhamento: 'direita' },
          { campo: 'ganhos', titulo: 'Fechados', alinhamento: 'direita' },
          { campo: 'conversao', titulo: 'Conversão', alinhamento: 'direita',
            formatar: function (v) { return v + '%'; } }
        ],
        linhas: origens
      },
      totais: [
        { rotulo: 'No funil', valor: numero(leads.length) },
        { rotulo: 'Taxa de conversão', valor: pct(ganhos.quantidade, fechados) + '%',
          cor: 'var(--color-success)' },
        { rotulo: 'Principal motivo de perda',
          valor: Object.keys(motivos).sort(function (a, b) {
            return motivos[b] - motivos[a];
          })[0] || '—' }
      ],
      nota: 'A taxa considera só o que já FECHOU (ganho ou perdido) — incluir o que está ' +
            'em andamento derrubaria o número sem nada ter dado errado.'
    };
  }

  // ===================== 10. PUBLICAÇÕES =====================

  function publicacoes(dados) {
    var d = dados || {};
    var lista = noPeriodo(d.publicacoes || [], 'dataDisponibilizacao', d.periodo);
    if (!lista.length) return vazio('Publicações capturadas');

    var porStatus = enums().STATUS_PUBLICACAO.map(function (s) {
      var doStatus = lista.filter(function (p) { return p.status === s.id; });
      return { statusId: s.id, status: s.label, quantidade: doStatus.length };
    });

    var triadas = lista.filter(function (p) { return p.triadaEm; });
    var tempos = triadas.map(function (p) {
      return prazos().diasCorridosEntre(p.dataDisponibilizacao,
                                        String(p.triadaEm).slice(0, 10));
    }).filter(function (t) { return t >= 0; });

    var tempoMedio = tempos.length
      ? Math.round(tempos.reduce(function (s, t) { return s + t; }, 0) / tempos.length * 10) / 10
      : 0;

    var geraramPrazo = lista.filter(function (p) { return p.prazoGeradoId; }).length;

    var porMes = {};
    lista.forEach(function (p) {
      var mes = String(p.dataDisponibilizacao || '').slice(0, 7);
      if (mes) porMes[mes] = (porMes[mes] || 0) + 1;
    });
    var meses = Object.keys(porMes).sort();

    return {
      titulo: 'Publicações capturadas',
      subtitulo: 'volume, triagem e prazos gerados',
      vazio: false,
      grafico: {
        tipo: 'linha',
        categorias: meses.map(rotuloMes),
        series: [{ id: 'vol', label: 'Publicações',
                   valores: meses.map(function (m) { return porMes[m]; }) }],
        formatarValor: numero,
        area: true
      },
      tabela: {
        colunas: [
          { campo: 'status', titulo: 'Situação' },
          { campo: 'quantidade', titulo: 'Quantidade', alinhamento: 'direita' }
        ],
        linhas: porStatus
      },
      totais: [
        { rotulo: 'Capturadas', valor: numero(lista.length) },
        { rotulo: 'Viraram prazo', valor: numero(geraramPrazo) },
        { rotulo: 'Tempo médio de triagem',
          valor: tempoMedio + ' dia(s)',
          cor: tempoMedio > 3 ? 'var(--color-warning)' : 'var(--color-success)' }
      ],
      nota: 'Tempo de triagem é o intervalo entre a disponibilização no diário e a ' +
            'decisão do escritório. Acima de três dias, o prazo já começou a correr.'
    };
  }

  // ===================== CATÁLOGO =====================

  /* O catálogo é a fonte única: a tela de relatórios se desenha a partir
     dele, e acrescentar um relatório é acrescentar uma linha aqui.

     `permissao` e `escopoProprio` fazem o filtro de acesso: advogado vê os
     próprios números; financeiro vê os financeiros. */
  var CATALOGO = [
    { id: 'produtividade', nome: 'Produtividade por advogado', grupo: 'Equipe',
      icone: '👥', calcular: produtividade,
      permissao: 'relatorios.ver', escopoProprio: true,
      descricao: 'Prazos cumpridos, tarefas concluídas e horas apontadas.' },

    { id: 'prazos', nome: 'Desempenho em prazos', grupo: 'Processos',
      icone: '⏱', calcular: desempenhoPrazos,
      permissao: 'relatorios.ver', escopoProprio: true,
      descricao: 'Cumpridos com folga, no limite e perdidos.' },

    { id: 'carteira', nome: 'Carteira de processos', grupo: 'Processos',
      icone: '⚖', calcular: carteira, permissao: 'relatorios.ver',
      descricao: 'Distribuição por fase e idade média.' },

    { id: 'contingencia', nome: 'Contingência', grupo: 'Processos',
      icone: '🛡', calcular: contingencia, permissao: 'relatorios.todos',
      descricao: 'Provisão por grau de risco — o relatório que a auditoria pede.' },

    { id: 'exito', nome: 'Taxa de êxito', grupo: 'Processos',
      icone: '🎯', calcular: taxaExito, permissao: 'relatorios.ver',
      descricao: 'Desfecho dos processos encerrados, por área.' },

    { id: 'faturamento', nome: 'Faturamento', grupo: 'Financeiro',
      icone: '💰', calcular: faturamento, permissao: 'financeiro.ver',
      descricao: 'Entradas e saídas mês a mês, em regime de caixa.' },

    { id: 'inadimplencia', nome: 'Inadimplência', grupo: 'Financeiro',
      icone: '⚠', calcular: inadimplencia, permissao: 'financeiro.ver',
      descricao: 'Aging de recebíveis e concentração por cliente.' },

    { id: 'rentabilidade', nome: 'Rentabilidade por processo', grupo: 'Financeiro',
      icone: '📈', calcular: rentabilidade, permissao: 'financeiro.ver',
      descricao: 'Receita menos despesas e horas — quais processos dão lucro.' },

    { id: 'funil', nome: 'Funil de conversão', grupo: 'Prospecção',
      icone: '🤝', calcular: funil, permissao: 'crm.ver',
      descricao: 'Etapas, origem dos interessados e motivos de perda.' },

    { id: 'publicacoes', nome: 'Publicações capturadas', grupo: 'Captura',
      icone: '📰', calcular: publicacoes, permissao: 'publicacoes.triar',
      descricao: 'Volume, tempo de triagem e prazos gerados.' }
  ];

  function achar(id) {
    return CATALOGO.filter(function (r) { return r.id === id; })[0] || null;
  }

  App.domain.indicadores = {
    CATALOGO: CATALOGO,
    achar: achar,
    pct: pct,
    noPeriodo: noPeriodo,
    rotuloMes: rotuloMes,
    produtividade: produtividade,
    desempenhoPrazos: desempenhoPrazos,
    contingencia: contingencia,
    carteira: carteira,
    taxaExito: taxaExito,
    faturamento: faturamento,
    inadimplencia: inadimplencia,
    rentabilidade: rentabilidade,
    funil: funil,
    publicacoes: publicacoes
  };
})(window.App = window.App || {});
