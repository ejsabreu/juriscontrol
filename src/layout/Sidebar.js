/* ==========================================================================
   layout/Sidebar.js — navegação principal
   ========================================================================== */

(function (App) {
  'use strict';

  App.layout = App.layout || {};

  function esc(v) { return App.dom.esc(v); }

  /* `permissao` é o id de enums.RECURSOS_PERMISSAO exigido para o item
     aparecer. Item sem `permissao` é visível a quem tem sessão. As seções
     somem sozinhas quando todos os itens delas somem — um cabeçalho
     "Administração" sobre lugar nenhum seria pior que menu nenhum. */
  var ITENS = [
    { secao: 'Acompanhamento' },
    { rota: '#/',          icone: '▤', rotulo: 'Dashboard',  chave: 'dashboard' },
    { rota: '#/processos', icone: '⚖', rotulo: 'Processos',  chave: 'processos',
      permissao: 'processos.ver' },
    { rota: '#/agenda',    icone: '▦', rotulo: 'Agenda',     chave: 'agenda',
      badge: 'prazosCriticos' },
    { rota: '#/tarefas',   icone: '☑', rotulo: 'Tarefas',    chave: 'tarefas',
      badge: 'tarefasAtrasadas' },
    { rota: '#/publicacoes', icone: '📰', rotulo: 'Publicações', chave: 'publicacoes',
      permissao: 'publicacoes.triar', badge: 'publicacoesPendentes' },
    { secao: 'Cadastros' },
    { rota: '#/crm',       icone: '🤝', rotulo: 'Prospecção', chave: 'crm',
      permissao: 'crm.ver', badge: 'followUpAtrasado' },
    { rota: '#/clientes',  icone: '👤', rotulo: 'Clientes',   chave: 'clientes' },
    { secao: 'Financeiro' },
    { rota: '#/financeiro', icone: '💰', rotulo: 'Financeiro', chave: 'financeiro',
      permissao: 'financeiro.ver' },
    { rota: '#/timesheet',  icone: '⏱', rotulo: 'Timesheet',  chave: 'timesheet' },
    { secao: 'Ferramentas' },
    { rota: '#/simulador', icone: '🗓', rotulo: 'Simulador de prazo', chave: 'simulador' },
    { rota: '#/modelos',   icone: '📋', rotulo: 'Modelos de peça', chave: 'modelos',
      permissao: 'documentos.editar' },
    /* Integrações fica em Ferramentas, e não em Administração: quem cuida
       dos monitoramentos do diário é quem tria publicação, e o advogado tem
       essa permissão. Sob Administração, ele veria uma seção inteira com um
       item só — e "Administração" prometeria mais do que entregaria. */
    { rota: '#/integracoes', icone: '🔌', rotulo: 'Integrações', chave: 'integracoes',
      permissao: 'publicacoes.triar' },
    { secao: 'Administração' },
    { rota: '#/configuracoes', icone: '⚙', rotulo: 'Configurações', chave: 'configuracoes',
      permissao: 'configuracoes' },
    { rota: '#/auditoria',     icone: '📋', rotulo: 'Auditoria',    chave: 'auditoria',
      permissao: 'auditoria' },
    { rota: '#/privacidade',   icone: '🔒', rotulo: 'Privacidade',  chave: 'privacidade',
      permissao: 'configuracoes' },
    { rota: '#/caixa-de-saida', icone: '✉', rotulo: 'Caixa de saída', chave: 'caixa-de-saida',
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
   * @param {Object} props.badges  { prazosCriticos, tarefasAtrasadas }
   * @param {boolean} props.aberta
   * @param {Object} props.usuario  define quais itens aparecem
   */
  function Sidebar(props) {
    var p = props || {};
    var badges = p.badges || {};

    var html = '<aside class="sidebar' + (p.aberta ? ' sidebar--open' : '') + '">';

    html += '<div class="sidebar__brand">' +
              '<span class="sidebar__logo" aria-hidden="true">JC</span>' +
              '<div>' +
                '<div class="sidebar__name">JurisControl</div>' +
                '<div class="sidebar__tagline">Controle de processos</div>' +
              '</div>' +
            '</div>';

    html += '<nav class="sidebar__nav" aria-label="Navegação principal">';

    itensVisiveis(p.usuario).forEach(function (item) {
      if (item.secao) {
        html += '<div class="sidebar__section-label">' + esc(item.secao) + '</div>';
        return;
      }

      var ativo = p.rotaAtual === item.chave;
      var contador = item.badge ? badges[item.badge] : 0;

      html += '<a class="nav-item' + (ativo ? ' nav-item--active' : '') + '"' +
                ' href="' + item.rota + '"' + (ativo ? ' aria-current="page"' : '') + '>' +
                '<span class="nav-item__icon" aria-hidden="true">' + item.icone + '</span>' +
                '<span>' + esc(item.rotulo) + '</span>' +
                (contador ? '<span class="nav-item__badge" title="' + contador +
                            ' item(ns) exigindo atenção">' + contador + '</span>' : '') +
              '</a>';
    });

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
