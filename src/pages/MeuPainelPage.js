/* ==========================================================================
   pages/MeuPainelPage.js — a tela inicial

   O dashboard responde "como está o escritório". Esta responde "o que é
   meu". São telas separadas de propósito: quem chega de manhã, ou abre o
   celular no corredor do fórum, tem uma pergunta só — o que eu preciso
   fazer hoje. Número de carteira, provisão e distribuição por fase não
   respondem isso e ficam onde já estavam.

   Quais blocos aparecem é decisão de `painelService`, por perfil. Esta
   página desenha o que vier e não conhece a regra.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var painel = null;

  function esc(v) { return App.dom.esc(v); }

  function cabecalho() {
    var agora = new Date();
    var saudacao = agora.getHours() < 12 ? 'Bom dia'
                 : agora.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
    var usuario = App.store.getState().usuarioAtual || {};
    var primeiroNome = String(usuario.nome || '').split(' ')[0];

    return '<div class="page-header">' +
             '<div>' +
               '<h1 class="page-header__title">' +
                 esc(saudacao + (primeiroNome ? ', ' + primeiroNome : '')) + '</h1>' +
               '<p class="page-header__subtitle">' +
                 esc(App.format.diaSemana(App.domain.prazos.hojeISO()) + ', ' +
                     App.format.dataExtenso(App.domain.prazos.hojeISO())) +
               '</p>' +
             '</div>' +
           '</div>';
  }

  /* Uma linha de resumo por bloco, no topo. É o que se lê de relance com o
     celular na mão — o detalhe vem abaixo, para quem parou para olhar. */
  function tira() {
    var ui = App.components.ui;
    var itens = '';

    if (painel.prazos) {
      var criticos = painel.prazos.criticosMeus.length;
      itens += ui.Kpi({
        rotulo: 'Meus prazos críticos', icone: App.icones.de('agenda'),
        corIcone: 'var(--color-danger-soft)',
        valor: criticos,
        dica: painel.prazos.vencendoHoje + ' vencendo hoje · ' +
              painel.prazos.meus.length + ' em aberto no meu nome',
        href: '#/agenda'
      });
    }

    if (painel.tarefas) {
      itens += ui.Kpi({
        rotulo: 'Minhas tarefas atrasadas', icone: App.icones.de('checklist'),
        corIcone: 'var(--color-danger-soft)',
        valor: painel.tarefas.atrasadas.length,
        dica: painel.tarefas.meus.length + ' no meu nome · ' +
              painel.tarefas.daEquipe.length + ' da equipe',
        href: '#/tarefas'
      });
    }

    if (painel.compromissos) {
      itens += ui.Kpi({
        rotulo: 'Compromissos na semana', icone: App.icones.de('agenda'),
        valor: painel.compromissos.meus.length,
        dica: painel.compromissos.hoje + ' hoje',
        href: '#/agenda'
      });
    }

    if (painel.financeiro) {
      itens += ui.Kpi({
        rotulo: 'Em atraso', icone: App.icones.de('alerta'),
        corIcone: 'var(--color-danger-soft)',
        valor: App.format.moedaCompacta(painel.financeiro.atrasadoCentavos),
        dica: painel.financeiro.atrasados + ' ' +
              App.format.plural(painel.financeiro.atrasados, 'lançamento'),
        href: '#/financeiro'
      });
      itens += ui.Kpi({
        rotulo: 'Vence em 7 dias', icone: App.icones.de('agenda'),
        valor: App.format.moedaCompacta(painel.financeiro.vencemCentavos),
        dica: painel.financeiro.vencemNaSemana + ' a vencer',
        href: '#/financeiro'
      });
    }

    return itens ? '<div class="grid grid--kpi dashboard__kpis">' + itens + '</div>' : '';
  }

  /* "No meu nome" e "da minha equipe" são conjuntos DISJUNTOS — o serviço
     garante isso — então dá para mostrar os dois sem que ninguém some
     errado. A separação é o que faz a tela servir ao estagiário, que tem
     tudo na segunda faixa e nada na primeira. */
  function comAbas(chave, meus, daEquipe, desenhar, vazio) {
    var html = '';

    if (meus.length) {
      html += desenhar(meus);
    } else {
      html += '<div class="painel__vazio">' + esc(vazio) + '</div>';
    }

    if (daEquipe.length) {
      html += '<div class="painel__divisor">' +
                'Da minha equipe · ' + daEquipe.length +
                ' <span class="u-subtle">(processos em que atuo, no nome de outra pessoa)</span>' +
              '</div>' +
              desenhar(daEquipe);
    }

    return html;
  }

  function blocoPrazos() {
    var ui = App.components.ui;
    var p = painel.prazos;

    function lista(itens) {
      return App.components.PrazoList({
        prazos: itens.slice(0, 8),
        acoes: p.podeBaixar,
        icone: '✓',
        tituloVazio: 'Nenhum prazo',
        textoVazio: ''
      });
    }

    return ui.Card({
      titulo: 'Prazos sob minha responsabilidade',
      subtitulo: p.criticosMeus.length
        ? p.criticosMeus.length + ' em risco'
        : (p.meus.length ? 'nenhum em risco' : ''),
      acoes: ui.Button({ rotulo: 'Ver agenda', variante: 'ghost', tamanho: 'sm', href: '#/agenda' }),
      semPadding: true,
      conteudo: '<div class="dash-list">' +
        comAbas('prazos', p.meus, p.daEquipe, lista,
                'Nenhum prazo em aberto no seu nome.') +
      '</div>'
    });
  }

  function blocoTarefas() {
    var ui = App.components.ui;
    var t = painel.tarefas;

    function lista(itens) {
      return itens.slice(0, 8).map(function (tarefa) {
        var atrasada = tarefa.dataVencimento < painel.hoje;
        return '<a class="painel-item" href="#/tarefas">' +
                 '<span class="painel-item__marca' +
                   (atrasada ? ' painel-item__marca--critica' : '') + '"></span>' +
                 '<span class="painel-item__corpo">' +
                   '<span class="u-sm u-bold u-truncate">' + esc(tarefa.titulo) + '</span>' +
                   '<span class="u-xs u-muted u-truncate">' +
                     esc((tarefa.processoNumero || '—') + ' · ' +
                         (atrasada ? 'venceu ' : 'vence ') +
                         App.format.data(tarefa.dataVencimento)) +
                   '</span>' +
                 '</span>' +
               '</a>';
      }).join('');
    }

    return ui.Card({
      titulo: 'Minhas tarefas',
      subtitulo: t.atrasadas.length ? t.atrasadas.length + ' atrasadas' : '',
      acoes: ui.Button({ rotulo: 'Ver tarefas', variante: 'ghost', tamanho: 'sm', href: '#/tarefas' }),
      semPadding: true,
      conteudo: '<div class="dash-list">' +
        comAbas('tarefas', t.meus, t.daEquipe, lista,
                'Nenhuma tarefa aberta no seu nome.') +
      '</div>'
    });
  }

  function blocoCompromissos() {
    var ui = App.components.ui;
    var c = painel.compromissos;
    var fmt = App.format;

    function lista(itens) {
      return itens.map(function (cp) {
        var dia = String(cp.dataHora).slice(0, 10);
        var d = App.domain.prazos.paraDate(dia);
        return '<a class="compromisso-item" href="' +
                 (cp.processo ? '#/processos/' + cp.processo.id : '#/agenda') + '">' +
                 '<div class="compromisso-item__date">' +
                   '<div class="compromisso-item__day">' + d.getDate() + '</div>' +
                   '<div class="compromisso-item__month">' + fmt.MESES_ABREV[d.getMonth()] + '</div>' +
                 '</div>' +
                 '<div style="flex:1;min-width:0">' +
                   '<div class="u-sm u-bold u-truncate">' + esc(cp.titulo) + '</div>' +
                   '<div class="u-xs u-muted u-truncate">' +
                     esc(fmt.hora(cp.dataHora) + ' · ' + cp.local) +
                   '</div>' +
                 '</div>' +
               '</a>';
      }).join('');
    }

    return ui.Card({
      titulo: 'Meus próximos 7 dias',
      acoes: ui.Button({ rotulo: 'Agenda', variante: 'ghost', tamanho: 'sm', href: '#/agenda' }),
      semPadding: true,
      conteudo: '<div class="dash-list">' +
        comAbas('compromissos', c.meus, c.daEquipe, lista,
                'Nenhum compromisso marcado para esta semana.') +
      '</div>'
    });
  }

  function blocoFinanceiro() {
    var ui = App.components.ui;
    var f = painel.financeiro;

    var linhas = f.proximos.map(function (l) {
      return '<a class="painel-item" href="#/financeiro">' +
               '<span class="painel-item__marca"></span>' +
               '<span class="painel-item__corpo">' +
                 '<span class="u-sm u-bold u-truncate">' + esc(l.descricao || 'Lançamento') + '</span>' +
                 '<span class="u-xs u-muted u-truncate">' +
                   esc(App.format.moeda(l.valorCentavos) + ' · vence ' +
                       App.format.data(l.dataVencimento)) +
                 '</span>' +
               '</span>' +
             '</a>';
    }).join('');

    return ui.Card({
      titulo: 'A vencer nesta semana',
      acoes: ui.Button({ rotulo: 'Financeiro', variante: 'ghost', tamanho: 'sm', href: '#/financeiro' }),
      semPadding: true,
      conteudo: '<div class="dash-list">' +
        (linhas || '<div class="painel__vazio">Nada vencendo nos próximos 7 dias.</div>') +
      '</div>'
    });
  }

  /* Os acessos de urgência ficam na SUA tela, e não escondidos na auditoria:
     quem abriu o processo sigiloso de um colega deve esbarrar nisso todo
     dia, com o próprio motivo escrito ao lado e o prazo correndo. */
  function blocoAcessos() {
    var ui = App.components.ui;
    if (!painel.acessos || !painel.acessos.length) return '';

    var linhas = painel.acessos.map(function (a) {
      var urgente = a.diasRestantes <= 1;
      return '<div class="painel-item painel-item--bloco">' +
               '<span class="painel-item__marca' +
                 (urgente ? ' painel-item__marca--critica' : '') + '"></span>' +
               '<span class="painel-item__corpo">' +
                 '<span class="u-sm u-bold u-truncate">' +
                   esc(a.processo ? a.processo.numeroInterno : 'Processo') +
                   ' · ' + esc(a.processo ? a.processo.assunto : '') +
                 '</span>' +
                 '<span class="u-xs u-muted">' + esc(a.motivo) + '</span>' +
                 '<span class="u-xs u-subtle">' +
                   (a.diasRestantes <= 0 ? 'expira hoje'
                     : 'expira em ' + a.diasRestantes + ' ' +
                       App.format.plural(a.diasRestantes, 'dia')) +
                 '</span>' +
               '</span>' +
               '<span class="painel-item__acoes">' +
                 ui.Button({ rotulo: 'Abrir', variante: 'ghost', tamanho: 'sm',
                             href: a.processo ? '#/processos/' + a.processo.id : '#/processos' }) +
                 ui.Button({ rotulo: 'Encerrar', variante: 'ghost', tamanho: 'sm',
                             acao: 'encerrar-acesso', valor: a.id }) +
               '</span>' +
             '</div>';
    }).join('');

    return ui.Card({
      titulo: 'Acessos de urgência abertos',
      subtitulo: painel.acessos.length + ' em vigor · registrados na auditoria',
      semPadding: true,
      conteudo: '<div class="dash-list">' + linhas + '</div>'
    });
  }

  var DESENHO = {
    prazos: blocoPrazos,
    tarefas: blocoTarefas,
    compromissos: blocoCompromissos,
    financeiro: blocoFinanceiro,
    acessos: blocoAcessos
  };

  function desenhar() {
    var corpo = painel.blocos
      .map(function (chave) { return DESENHO[chave] ? DESENHO[chave]() : ''; })
      .filter(Boolean)
      .join('');

    container.innerHTML =
      cabecalho() +
      tira() +
      '<div class="painel-blocos dashboard__section">' + corpo + '</div>';
  }

  function carregar() {
    App.services.painelService.meuPainel().then(function (dados) {
      painel = dados;
      desenhar();
    }).catch(function (erro) {
      container.innerHTML = cabecalho() + App.components.ui.EmptyState({
        icone: '⚠',
        titulo: 'Não foi possível carregar o painel',
        texto: erro.message
      });
    });
  }

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="cumprir-prazo"]', function (evento, botao) {
      evento.preventDefault();
      App.services.prazoService.cumprir(botao.dataset.value).then(function (prazo) {
        App.components.Toast.sucesso('Prazo baixado', prazo.titulo + ' marcado como cumprido.');
        carregar();
      }).catch(function (erro) {
        App.components.Toast.erro('Não foi possível baixar o prazo', erro.message);
      });
    });

    App.dom.delegate(container, 'click', '[data-action="encerrar-acesso"]', function (evento, botao) {
      evento.preventDefault();
      App.services.acessoService.encerrar(botao.dataset.value).then(function () {
        App.components.Toast.sucesso('Acesso encerrado',
          'O processo volta a ficar fora da sua visão.');
        carregar();
      }).catch(function (erro) {
        App.components.Toast.erro('Não foi possível encerrar', erro.message);
      });
    });
  }

  App.pages.MeuPainelPage = {
    render: function (raiz) {
      container = raiz;
      container.innerHTML = cabecalho() + App.components.ui.SkeletonCards(3);
      ligarEventos();
      carregar();
    }
  };
})(window.App = window.App || {});
