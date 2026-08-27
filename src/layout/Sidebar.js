/* ==========================================================================
   layout/Sidebar.js — navegação principal
   ========================================================================== */

(function (App) {
  'use strict';

  App.layout = App.layout || {};

  function esc(v) { return App.dom.esc(v); }

  /* O item guarda a CHAVE do ícone, não o desenho. Os desenhos moram em
     `components/icones.js`, com o porquê de cada traço; ficam lá, e não aqui,
     desde que o sino passou a usar os MESMOS. Guardar a chave mantém `ITENS`
     como dado — dá para ler, testar e comparar sem carregar SVG junto.

     No menu eles saem a 15px (ver `.nav-item__icon svg`). */

  /* `permissao` é o id de enums.RECURSOS_PERMISSAO exigido para o item
     aparecer. Item sem `permissao` é visível a quem tem sessão. As seções
     somem sozinhas quando todos os itens delas somem — um cabeçalho
     "Administração" sobre lugar nenhum seria pior que menu nenhum. */
  var ITENS = [
    { secao: 'Acompanhamento' },
    { rota: '#/',            icone: 'casa', rotulo: 'Meu painel', chave: 'painel' },
    { rota: '#/escritorio',  icone: 'painel', rotulo: 'Escritório', chave: 'dashboard',
      permissao: 'escritorio.ver' },
    { rota: '#/processos', icone: 'balanca', rotulo: 'Processos',  chave: 'processos',
      permissao: 'processos.ver' },
    { rota: '#/agenda',    icone: 'agenda', rotulo: 'Agenda',     chave: 'agenda' },
    { rota: '#/tarefas',   icone: 'checklist', rotulo: 'Tarefas',    chave: 'tarefas' },
    { rota: '#/publicacoes', icone: 'jornal', rotulo: 'Publicações', chave: 'publicacoes',
      permissao: 'publicacoes.triar' },
    { secao: 'Cadastros' },
    { rota: '#/crm',       icone: 'busca-pessoa', rotulo: 'Prospecção', chave: 'crm',
      permissao: 'crm.ver' },
    { rota: '#/clientes',  icone: 'pessoa', rotulo: 'Clientes',   chave: 'clientes' },
    { secao: 'Financeiro' },
    { rota: '#/financeiro', icone: 'cifrao', rotulo: 'Financeiro', chave: 'financeiro',
      permissao: 'financeiro.ver' },
    { rota: '#/timesheet',  icone: 'relogio', rotulo: 'Timesheet',  chave: 'timesheet' },
    { secao: 'Análise' },
    { rota: '#/relatorios', icone: 'relatorio', rotulo: 'Relatórios', chave: 'relatorios',
      permissao: 'relatorios.ver' },
    { secao: 'Ferramentas' },
    { rota: '#/simulador', icone: 'cronometro', rotulo: 'Simulador de prazo', chave: 'simulador' },
    { rota: '#/modelos',   icone: 'peca', rotulo: 'Modelos de peça', chave: 'modelos',
      permissao: 'documentos.editar' },
    /* Integrações fica em Ferramentas, e não em Administração: quem cuida
       dos monitoramentos do diário é quem tria publicação, e o advogado tem
       essa permissão. Sob Administração, ele veria uma seção inteira com um
       item só — e "Administração" prometeria mais do que entregaria. */
    { rota: '#/integracoes', icone: 'integracoes', rotulo: 'Integrações', chave: 'integracoes',
      permissao: 'publicacoes.triar' },
    { secao: 'Administração' },
    { rota: '#/configuracoes', icone: 'engrenagem', rotulo: 'Configurações', chave: 'configuracoes',
      permissao: 'configuracoes' },
    { rota: '#/auditoria',     icone: 'auditoria', rotulo: 'Auditoria',    chave: 'auditoria',
      permissao: 'auditoria' },
    { rota: '#/privacidade',   icone: 'cadeado', rotulo: 'Privacidade',  chave: 'privacidade',
      permissao: 'configuracoes' },
    { rota: '#/caixa-de-saida', icone: 'envelope', rotulo: 'Caixa de saída', chave: 'caixa-de-saida',
      permissao: 'configuracoes' }
  ];

  /** Remove itens sem permissão e as seções que ficaram vazias. */
  function itensVisiveis(usuario) {
    var pode = App.domain.permissoes.pode;

    var permitidos = ITENS.filter(function (item) {
      if (item.secao) return true;
      return !item.permissao || pode(usuario, item.permissao);
    });

    return permitidos.filter(function (item, i) {
      if (!item.secao) return true;
      var proximo = permitidos[i + 1];
      return !!proximo && !proximo.secao;
    });
  }

  /**
   * @param {Object} props
   * @param {string} props.rotaAtual
   * @param {boolean} props.recolhida  menu na tira de ícones, em qualquer largura
   * @param {Array}  [props.secoesAbertas]  rótulos das seções abertas
   * @param {Object} props.usuario  define quais itens aparecem
   * @param {boolean} [props.animarExpansao]  este desenho é o de uma expansão
   */
  function Sidebar(props) {
    var p = props || {};

    /* A classe existe por UM quadro: quem a pede é só o AppShell, e só quando
       o menu acabou de ser expandido de propósito. É ela que libera a animação
       de entrada dos rótulos — sem ela, todo redesenho do menu (troca de rota,
       volta do sino) reanimaria os rótulos, e o menu piscava sozinho. */
    var html = '<aside class="sidebar' +
                 (p.recolhida ? ' sidebar--recolhida' : '') +
                 (!p.recolhida && p.animarExpansao ? ' sidebar--expandindo' : '') + '">';

    /* Recolhido, o rótulo sai do lado do ícone e vira `title` — é o que
       devolve o nome do item a quem parou o ponteiro em cima. O `aria-label`
       fica sempre, porque leitor de tela não enxerga largura de menu: para
       ele o item precisa ter nome nos dois estados. */
    var titulo = p.recolhida ? 'Expandir menu' : 'Recolher menu';

    html += '<div class="sidebar__brand">' +
              '<span class="sidebar__logo" aria-hidden="true">JC</span>' +
              '<div class="sidebar__identidade">' +
                '<div class="sidebar__name">JurisControl</div>' +
                '<div class="sidebar__tagline">Controle de processos</div>' +
              '</div>' +
              '<button type="button" class="sidebar__toggle"' +
                ' data-action="alternar-menu"' +
                ' aria-expanded="' + (p.recolhida ? 'false' : 'true') + '"' +
                ' title="' + titulo + '" aria-label="' + titulo + '">' +
                App.icones.REGISTRO.menu +
              '</button>' +
            '</div>';

    html += '<nav class="sidebar__nav" aria-label="Navegação principal">';

    /* Seções dobráveis. O padrão é FECHADO: só abre o que está na lista.

       Recolhido, o menu é uma tira de ícones e os rótulos de seção somem —
       então dobrar não pode valer ali: os itens sumiriam sem nada visível
       para trazê-los de volta. Nesse estado tudo conta como aberto, e não
       porque a preferência tenha sido perdida: ela volta inteira ao expandir. */
    var abertas = p.secoesAbertas || [];
    var grupoAberto = false;

    var visiveis = itensVisiveis(p.usuario);

    /* Qual item ATIVO cada seção guarda. Dobrada, a seção some com a cápsula
       do item aberto e leva junto o "você está aqui" — então ela mesma passa
       a carregar o ícone da tela em que se está.

       Precisa de uma passada antes do desenho: quando o título da seção é
       escrito, os itens dela ainda não foram percorridos. */
    var ativoDaSecao = {};
    var secaoCorrente = null;

    visiveis.forEach(function (item) {
      if (item.secao) { secaoCorrente = item.secao; return; }
      if (secaoCorrente && item.chave === p.rotaAtual) {
        ativoDaSecao[secaoCorrente] = item;
      }
    });

    function fecharGrupo() {
      if (grupoAberto) { html += '</div></div>'; grupoAberto = false; }
    }

    visiveis.forEach(function (item) {
      if (item.secao) {
        fecharGrupo();

        var dobrada = !p.recolhida && abertas.indexOf(item.secao) === -1;
        var atual = ativoDaSecao[item.secao];

        /* O ícone é escrito SEMPRE que a seção guarda a tela atual, e quem
           decide se ele aparece é o CSS, pelo estado de dobrada. Tem de ser
           assim porque o clique não repinta o menu — ele só troca classes,
           para a abertura poder ser animada. Se o ícone dependesse do
           desenho, ele só surgiria na próxima troca de rota. */
        html += '<button type="button" class="sidebar__section' +
                  (dobrada ? ' sidebar__section--dobrada' : '') +
                  (atual ? ' sidebar__section--tem-atual' : '') + '"' +
                  ' data-action="alternar-secao" data-value="' + esc(item.secao) + '"' +
                  ' aria-expanded="' + (dobrada ? 'false' : 'true') + '"' +
                  (atual ? ' aria-label="' + esc(item.secao) + ' — ' +
                           esc(atual.rotulo) + '"' : '') + '>' +
                  '<span class="sidebar__section-label">' + esc(item.secao) + '</span>' +
                  (atual
                    ? '<span class="sidebar__section-atual" aria-hidden="true"' +
                      ' title="' + esc(atual.rotulo) + '">' +
                        App.icones.de(atual.icone) + '</span>'
                    : '') +
                  '<span class="sidebar__section-seta" aria-hidden="true"></span>' +
                '</button>';

        /* Duas camadas: a de fora anima a altura (de `0fr` a `1fr`), a de
           dentro segura os itens e corta o que sobra enquanto encolhe.
           `display: none` não anima — por isso não se usa `u-hidden` aqui. */
        html += '<div class="sidebar__grupo' +
                  (dobrada ? ' sidebar__grupo--dobrado' : '') + '">' +
                '<div class="sidebar__grupo-interno">';
        grupoAberto = true;
        return;
      }

      var ativo = p.rotaAtual === item.chave;

      /* Sem contador no item, de propósito. O número no menu competia com a
         central de notificações dizendo a mesma coisa duas vezes — e pior, sem
         dizer o que era: "3" ao lado de Agenda não conta qual prazo, nem se dá
         para resolver hoje. O sino conta isso por extenso, e a própria tela
         conta melhor ainda ao ser aberta. */
      html += '<a class="nav-item' + (ativo ? ' nav-item--active' : '') + '"' +
                ' href="' + item.rota + '"' + (ativo ? ' aria-current="page"' : '') +
                ' aria-label="' + esc(item.rotulo) + '"' +
                (p.recolhida ? ' title="' + esc(item.rotulo) + '"' : '') + '>' +
                '<span class="nav-item__icon" aria-hidden="true">' +
                  App.icones.de(item.icone) + '</span>' +
                '<span class="nav-item__rotulo">' + esc(item.rotulo) + '</span>' +
              '</a>';
    });

    fecharGrupo();
    html += '</nav>';

    html += '<div class="sidebar__footer">' +
              'Protótipo · dados fictícios' +
            '</div>';

    return html + '</aside>';
  }

  Sidebar.ITENS = ITENS;
  Sidebar.itensVisiveis = itensVisiveis;

  App.layout.Sidebar = Sidebar;
})(window.App = window.App || {});
