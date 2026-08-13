/* ==========================================================================
   pages/ClienteDetalhePage.js — ficha do cliente e seus processos
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var cliente = null;

  function esc(v) { return App.dom.esc(v); }

  function render(elemento, params) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });

    App.services.clienteService.obter(params.id).then(function (c) {
      cliente = c;
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
      tabelaProcessos();

    App.components.DataTable.mount(container, {});
  }

  App.pages.ClienteDetalhePage = { render: render };
})(window.App = window.App || {});
