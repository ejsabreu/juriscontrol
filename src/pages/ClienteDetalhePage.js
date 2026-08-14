/* ==========================================================================
   pages/ClienteDetalhePage.js — ficha do cliente e seus processos
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var cliente = null;
  var interacoes = [];
  var titulos = null;      // null = ainda não buscado; [] = buscado e vazio

  function esc(v) { return App.dom.esc(v); }

  function render(elemento, params) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });
    titulos = null;        // os títulos em memória são do cliente anterior
    ligarEventos();

    App.services.clienteService.obter(params.id).then(function (c) {
      cliente = c;
      /* F2.6: o histórico do cliente começa ANTES de ele ser cliente — o
         serviço traz junto as interações do lead que virou esta pessoa.
         F2.10: os títulos entram no MESMO carregamento, e não em uma busca
         disparada pelo cartão. Buscar depois custaria uma segunda
         renderização da ficha inteira a cada abertura. */
      return Promise.all([
        App.services.interacaoService.listar({ pessoaId: c.id }),
        App.services.lancamentoService.listar({ clienteId: c.id })
      ]);
    }).then(function (r) {
      interacoes = r[0];
      titulos = r[1].itens;
      desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠',
        titulo: 'Cliente não encontrado',
        texto: erro.message,
        acao: App.components.ui.Button({ rotulo: 'Voltar', variante: 'primary', href: '#/clientes' })
      });
    });
  }

  function heroi() {
    var ui = App.components.ui;
    var fmt = App.format;
    var end = cliente.endereco || {};

    var enderecoCompleto = [
      end.logradouro && end.numero ? end.logradouro + ', ' + end.numero : end.logradouro,
      end.complemento, end.bairro,
      end.cidade && end.uf ? end.cidade + '/' + end.uf : end.cidade,
      end.cep ? 'CEP ' + fmt.cep(end.cep) : ''
    ].filter(Boolean).join(' · ');

    return '<div class="card">' +
      '<div class="cliente-hero">' +
        ui.Avatar({
          nome: cliente.nome,
          cor: cliente.tipo === 'PJ' ? 'var(--color-accent-500)' : 'var(--color-primary-500)',
          tamanho: 'lg'
        }).replace('class="avatar avatar--lg"', 'class="avatar avatar--lg cliente-hero__avatar"') +
        '<div style="flex:1;min-width:0">' +
          '<h2>' + esc(cliente.nome) + '</h2>' +
          '<div class="u-sm u-muted">' +
            esc(cliente.tipo === 'PJ' ? 'CNPJ ' : 'CPF ') + esc(fmt.documento(cliente.documento)) +
            (cliente.origem ? ' · origem: ' + esc(cliente.origem) : '') +
          '</div>' +
        '</div>' +
        ui.Badge({
          rotulo: cliente.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física',
          variante: cliente.tipo === 'PJ' ? 'accent' : 'primary'
        }) +
      '</div>' +

      '<div class="card__body" style="border-top:1px solid var(--color-border)">' +
        '<div class="def-list">' +
          item('E-mail', cliente.email ? '<a href="mailto:' + esc(cliente.email) + '">' +
                                          esc(cliente.email) + '</a>' : '—') +
          item('Telefone', esc(fmt.telefone(cliente.telefone))) +
          item('Celular', esc(fmt.telefone(cliente.celular))) +
          item('Endereço', esc(enderecoCompleto || '—')) +
          (cliente.dataNascimento
            ? item('Nascimento', esc(fmt.data(cliente.dataNascimento))) : '') +
          item('Cadastro', esc(fmt.data(String(cliente.criadoEm).slice(0, 10)))) +
        '</div>' +
      '</div>' +
    '</div>';

    function item(termo, valor) {
      return '<div>' +
               '<div class="def-list__term">' + esc(termo) + '</div>' +
               '<div class="def-list__desc">' + valor + '</div>' +
             '</div>';
    }
  }

  function kpis() {
    var ui = App.components.ui;
    var fmt = App.format;

    var comPrazoCritico = cliente.processos.filter(function (p) {
      return p.prazoProximo &&
             (p.prazoProximo.semaforo === 'critico' || p.prazoProximo.semaforo === 'vencido');
    }).length;

    return '<div class="grid grid--kpi" style="margin-top:var(--space-4)">' +
      ui.Kpi({ rotulo: 'Processos', valor: cliente.totalProcessos, icone: '⚖',
               dica: cliente.processosAtivos + ' ativos', cor: 'var(--color-primary-500)' }) +
      ui.Kpi({ rotulo: 'Valor envolvido', valor: fmt.moedaCompacta(cliente.valorEnvolvido),
               icone: '₣', cor: 'var(--color-accent-500)' }) +
      ui.Kpi({ rotulo: 'Prazos em risco', valor: comPrazoCritico, icone: '⏱',
               cor: comPrazoCritico ? 'var(--color-prazo-critico)' : 'var(--color-prazo-ok)' }) +
      ui.Kpi({ rotulo: 'Documentos', valor: cliente.documentos.length, icone: '📄',
               cor: 'var(--color-text-subtle)' }) +
    '</div>';
  }

  function tabelaProcessos() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var fmt = App.format;

    var tabela = App.components.DataTable({
      itens: cliente.processos,
      hrefDe: function (p) { return '#/processos/' + p.id; },
      vazio: ui.EmptyState({
        icone: '⚖',
        titulo: 'Nenhum processo vinculado',
        acao: ui.Button({ rotulo: 'Cadastrar processo', variante: 'primary', href: '#/processos/novo' })
      }),
      colunas: [
        {
          chave: 'numeroInterno', titulo: 'Processo', ordenavel: false,
          render: function (p) {
            return '<div class="table__cell-strong">' + esc(p.numeroInterno) + '</div>' +
                   '<div class="u-xs u-subtle u-mono">' + esc(p.numeroCnj) + '</div>';
          }
        },
        {
          chave: 'assunto', titulo: 'Assunto', ordenavel: false,
          render: function (p) {
            return '<div class="u-truncate">' + esc(p.assunto) + '</div>' +
                   '<div class="u-xs u-subtle">' + esc(p.vara + ' · ' + p.comarca) + '</div>';
          }
        },
        {
          chave: 'faseId', titulo: 'Fase', ordenavel: false,
          render: function (p) {
            var fase = enums.achar(enums.FASES, p.faseId);
            return ui.Badge({ rotulo: fase ? fase.label : p.faseId, cor: fase ? fase.cor : null, ponto: true });
          }
        },
        {
          chave: 'prazo', titulo: 'Próximo prazo', ordenavel: false,
          render: function (p) {
            if (!p.prazoProximo) return '<span class="u-xs u-subtle">—</span>';
            return ui.PrazoChip({
              semaforo: p.prazoProximo.semaforo,
              diasRestantes: p.prazoProximo.diasRestantes,
              titulo: p.prazoProximo.titulo
            });
          }
        },
        {
          chave: 'valorCausa', titulo: 'Valor', alinhamento: 'right', ordenavel: false,
          render: function (p) { return esc(fmt.moeda(p.valorCausa)); }
        }
      ]
    });

    return ui.Card({
      titulo: 'Processos do cliente',
      subtitulo: cliente.totalProcessos + ' no total',
      acoes: ui.Button({
        rotulo: 'Ver na lista', variante: 'ghost', tamanho: 'sm',
        href: '#/processos?clienteId=' + cliente.id
      }),
      semPadding: true,
      conteudo: tabela,
      classe: 'dashboard__section'
    });
  }

  function desenhar() {
    container.innerHTML =
      '<div class="breadcrumb">' +
        '<a href="#/clientes">Clientes</a>' +
        '<span class="breadcrumb__sep">/</span>' +
        '<span>' + esc(App.format.truncar(cliente.nome, 40)) + '</span>' +
      '</div>' +
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">' + esc(cliente.nome) + '</h1>' +
          '<p class="page-header__subtitle">Ficha do cliente e carteira de processos</p>' +
        '</div>' +
        '<div class="page-header__actions">' +
          App.components.ui.Button({
            rotulo: 'Novo processo', variante: 'primary', icone: '+', href: '#/processos/novo'
          }) +
        '</div>' +
      '</div>' +
      heroi() +
      kpis() +
      tabelaProcessos() +
      cardFinanceiro() +
      cardInteracoes();

    App.components.DataTable.mount(container, {});
  }

  /* Situação financeira do cliente (F2.10, adiada de F2.5).
     A pergunta que se faz antes de ligar para o cliente é "ele está em dia?".
     Responder isso exigia abrir o financeiro e filtrar — agora está na ficha. */
  function cardFinanceiro() {
    var ui = App.components.ui;
    var fmt = App.format;

    var receitas = (titulos || []).filter(function (l) { return l.tipo === 'receita'; });
    var soma = function (lista) {
      return lista.reduce(function (s, l) { return s + Math.round(l.valorCentavos || 0); }, 0);
    };

    var atrasados = receitas.filter(function (l) { return l.situacao === 'atrasado'; });
    var abertos = receitas.filter(function (l) { return l.situacao === 'em_aberto'; });
    var pagos = receitas.filter(function (l) { return l.situacao === 'pago'; });

    var linhas = receitas
      .filter(function (l) { return l.situacao !== 'pago'; })
      .slice(0, 10)
      .map(function (l) {
        return '<tr>' +
          '<td class="u-tabular u-sm">' + esc(fmt.data(l.dataVencimento)) + '</td>' +
          '<td>' + esc(l.descricao) + '</td>' +
          '<td class="u-right u-tabular">' + esc(fmt.moeda(l.valorCentavos)) + '</td>' +
          '<td>' + ui.BadgeEnum(App.domain.enums.STATUS_LANCAMENTO, l.situacao) + '</td>' +
        '</tr>';
      }).join('');

    return ui.Card({
      titulo: 'Financeiro',
      subtitulo: receitas.length + ' título(s) de honorários',
      acoes: ui.Button({ rotulo: 'Ver no financeiro', tamanho: 'sm', variante: 'ghost',
                         href: '#/financeiro' }),
      conteudo:
        '<div class="grid grid--kpi">' +
          ui.Kpi({ rotulo: 'Recebido', valor: fmt.moeda(soma(pagos)), icone: '✔',
                   cor: 'var(--color-success)' }) +
          ui.Kpi({ rotulo: 'A receber', valor: fmt.moeda(soma(abertos)), icone: '◷',
                   cor: 'var(--color-info)' }) +
          ui.Kpi({ rotulo: 'Em atraso', valor: fmt.moeda(soma(atrasados)), icone: '⚠',
                   dica: atrasados.length ? atrasados.length + ' título(s)' : 'nenhum',
                   cor: atrasados.length ? 'var(--color-danger)'
                                         : 'var(--color-text-subtle)' }) +
        '</div>' +
        (linhas
          ? '<div class="table-wrap"><table class="table"><thead><tr>' +
              '<th>Vencimento</th><th>Descrição</th>' +
              '<th class="u-right">Valor</th><th>Situação</th>' +
            '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
          : '<p class="u-sm u-muted">Nenhum título em aberto — o cliente está em dia.</p>')
    });
  }

  /** Histórico de contato (F2.6) — inclui o que veio da fase de prospecção. */
  function cardInteracoes() {
    var ui = App.components.ui;

    if (!interacoes.length) {
      return ui.Card({
        titulo: 'Histórico de contato',
        acoes: ui.Button({ rotulo: 'Registrar', tamanho: 'sm', acao: 'nova-interacao-cliente' }),
        conteudo: '<p class="u-sm u-muted">Nenhum contato registrado com este cliente.</p>',
        classe: 'dashboard__section'
      });
    }

    var itens = interacoes.slice(0, 20).map(function (i) {
      return '<li class="inter">' +
        '<span class="inter__icone" aria-hidden="true">' + i.icone + '</span>' +
        '<div class="inter__corpo">' +
          '<div class="inter__topo">' +
            '<strong>' + esc(i.rotuloTipo) + '</strong>' +
            '<span class="u-xs u-subtle">' + esc(App.format.dataHora(i.quando)) +
              (i.leadId ? ' · prospecção' : '') + '</span>' +
          '</div>' +
          '<p class="inter__resumo">' + esc(i.resumo || '') + '</p>' +
          '<div class="u-xs u-subtle">' +
            esc((i.usuario && i.usuario.nome) || '') + '</div>' +
        '</div>' +
      '</li>';
    }).join('');

    return ui.Card({
      titulo: 'Histórico de contato',
      subtitulo: interacoes.length + ' registro(s)',
      acoes: ui.Button({ rotulo: 'Registrar', tamanho: 'sm', acao: 'nova-interacao-cliente' }),
      conteudo: '<ul class="inter-list">' + itens + '</ul>',
      semPadding: false,
      classe: 'dashboard__section'
    });
  }

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="nova-interacao-cliente"]', function () {
      var ui = App.components.ui;
      var enums = App.domain.enums;

      App.components.Modal.abrir({
        titulo: 'Registrar contato',
        conteudo:
          '<form id="form-inter-cliente">' +
            '<div class="form-grid">' +
              ui.Field({ nome: 'tipo', rotulo: 'Tipo', tipo: 'select', largura: 6,
                         opcoes: enums.opcoes(enums.TIPOS_INTERACAO, 'ligacao') }) +
              ui.Field({ nome: 'duracaoMin', rotulo: 'Duração (min)', tipo: 'number',
                         largura: 6, valor: 15 }) +
            '</div>' +
            ui.Field({ nome: 'resumo', rotulo: 'O que foi conversado', tipo: 'textarea',
                       linhas: 3, obrigatorio: true }) +
            ui.Field({ nome: 'proximoPasso', rotulo: 'Próximo passo' }) +
          '</form>',
        acoes: [
          { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
          { rotulo: 'Registrar', variante: 'primary', acao: 'salvar' }
        ],
        aoAcao: function (acao, corpo, fecharModal) {
          if (acao !== 'salvar') return;
          var d = App.dom.formToObject(App.dom.qs('#form-inter-cliente', corpo));

          App.services.interacaoService.criar({
            pessoaId: cliente.id,
            tipo: d.tipo,
            duracaoMin: parseInt(d.duracaoMin, 10) || 0,
            resumo: d.resumo,
            proximoPasso: d.proximoPasso || null
          }).then(function () {
            fecharModal();
            App.components.Toast.sucesso('Contato registrado');
            render(container, { id: cliente.id });
          }).catch(function (erro) {
            App.components.Toast.erro('Não foi possível registrar', erro.message);
          });
        }
      });
    });
  }

  App.pages.ClienteDetalhePage = { render: render };
})(window.App = window.App || {});
