/* ==========================================================================
   layout/Sidebar.js — navegação principal
   ========================================================================== */

(function (App) {
  'use strict';

  App.layout = App.layout || {};

  function esc(v) { return App.dom.esc(v); }

  /* --- Ícones desenhados ---------------------------------------------------

     COR — regra do projeto, não detalhe deste arquivo: ícone de menu NUNCA
     traz cor própria. Ele herda, por `currentColor`, a cor de quem o contém.
     É o que faz o ícone escurecer junto com o rótulo, clarear no hover e ficar
     branco no item ativo, sem uma linha de CSS para cada estado — o `color` do
     `.nav-item` muda uma vez e o ícone acompanha.

     É também o motivo de emoji não servir: 📰 e 📊 carregam paleta embutida na
     fonte, ignoram o `color` e continuam coloridos justamente onde todo o
     resto ficou branco. Quem for trocar os que ainda restam: desenhe aqui, não
     procure outro emoji.

     FORMA — grade de 24, exibidos a 15px (ver `.nav-item__icon svg`). Nesse
     tamanho cada traço a mais vira borrão, então os desenhos param no
     essencial de propósito: o que sobrevive a 15px é a silhueta, não o
     detalhe. */
  function icone(corpo) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
             corpo +
           '</svg>';
  }

  /* Jornal: folha da frente, aba de trás, título, foto e duas colunas. */
  var ICONE_JORNAL = icone(
    '<path d="M16.5 6.5H21V18a2.5 2.5 0 0 1-2.5 2.5h-2"/>' +
    '<path d="M2.5 3.5h14v17H5a2.5 2.5 0 0 1-2.5-2.5Z"/>' +
    '<path d="M5.5 7h8"/>' +
    '<path d="M5.5 10h4v4.5h-4z"/>' +
    '<path d="M11.5 10h2.5M11.5 12.25h2.5M11.5 14.5h2.5"/>' +
    '<path d="M5.5 17.5h8"/>'
  );

  /* Lupa com uma pessoa dentro: procurar quem ainda não é cliente.

     O desenho de origem apoia a lupa sobre uma mão aberta. A mão não veio: ela
     ocupa o terço de baixo, e abrir esse espaço encolheria a lente até a pessoa
     lá dentro sumir — perdendo justamente o que separa este ícone de uma busca
     qualquer. A lupa com alguém dentro já diz prospecção sozinha.

     A pessoa é grande em relação à lente de propósito, quase encostando na
     borda, como no original. Centrada e pequena ela viraria um respingo. */
  var ICONE_BUSCA_PESSOA = icone(
    '<circle cx="10" cy="9.5" r="6.5"/>' +
    '<circle cx="10" cy="7.4" r="1.6"/>' +
    '<path d="M6 14.3a4 4 0 0 1 8 0"/>' +
    '<path d="M14.9 14.4L20.5 20"/>'
  );

  /* A mesma pessoa do ícone acima, sem a lupa — cabeça e ombros na mesma
     proporção entre si, só que ocupando a grade inteira em vez da lente.

     O par é de propósito, e diz o que os dois módulos são: em Prospecção
     alguém ainda está sendo procurado; em Clientes já foi encontrado. Ícone
     de menu não precisa ser criativo, precisa ser distinguível — e duas telas
     parentes ficam mais claras parecidas do que diferentes. */
  var ICONE_PESSOA = icone(
    '<circle cx="12" cy="7.5" r="3.4"/>' +
    '<path d="M4.8 20.3a7.2 7.2 0 0 1 14.4 0"/>'
  );

  /* Folha com lista de verificação: três quadros, o primeiro marcado.

     O desenho de origem põe duas linhas de texto ao lado de cada quadro; ficou
     uma. Três fileiras é o que diz "lista" — cortar para duas descaracteriza —,
     então a economia teve de sair da largura, e não da altura.

     O visto passa do canto do quadro de propósito, como no original: dentro de
     um quadro de 2px ele não seria visto, e é ele que separa "tarefa" de
     "documento qualquer". */
  var ICONE_CHECKLIST = icone(
    '<path d="M15 2.5H6.5A2 2 0 0 0 4.5 4.5v15A2 2 0 0 0 6.5 21.5h11a2 2 0 0 0 2-2V7Z"/>' +
    '<path d="M15 2.5V5a2 2 0 0 0 2 2h2.5"/>' +
    '<path d="M6.8 7.8h3.4v3.4H6.8z"/>' +
    '<path d="M7.6 9.6l1.2 1.2 2.9-3.1"/>' +
    '<path d="M6.8 12.2h3.4v3.4H6.8z"/>' +
    '<path d="M6.8 16.6h3.4v3.4H6.8z"/>' +
    '<path d="M12.5 9.5h6M12.5 13.9h6M12.5 18.3h6"/>'
  );

  /* Calendário com relógio no canto.

     Aqui os dois objetos couberam, mas por um motivo específico: eles não se
     sobrepõem. No desenho de origem o relógio cobre o canto do calendário e é
     cercado por uma auréola branca, o que exige pintar o fundo — e fundo
     pintado é justamente o que este menu não pode ter, porque ele muda no
     hover e vira azul no item ativo. A saída é o calendário não chegar até
     ali: a moldura termina antes do canto e o relógio ocupa o espaço vago.

     Pelo mesmo motivo a segunda fileira tem dois pontos, e não três — o
     terceiro ficaria embaixo do relógio. O desenho de origem faz igual. */
  var ICONE_AGENDA = icone(
    '<path d="M19 11.5V6.5A2.5 2.5 0 0 0 16.5 4H4A2.5 2.5 0 0 0 1.5 6.5v9A2.5 2.5 0 0 0 4 18h7"/>' +
    '<path d="M1.5 8h17.5"/>' +
    '<path d="M4.75 11h1.5M8.75 11h1.5M12.75 11h1.5"/>' +
    '<path d="M4.75 14.5h1.5M8.75 14.5h1.5"/>' +
    '<circle cx="17.5" cy="17.5" r="5"/>' +
    '<path d="M17.5 14.75v2.75l1.75 1.75"/>'
  );

  /* Balança sobre a base. O desenho de origem trazia também um livro e um
     martelo cruzando o canto; a 15px eles não cabem — a balança sozinha já
     gasta a altura inteira da grade, e espremê-la para abrir espaço apagaria
     justamente os pratos, que são o que faz alguém reconhecer o símbolo. Ficou
     a balança, e do livro sobrou a base em que ela se apoia. */
  var ICONE_BALANCA = icone(
    '<circle cx="12" cy="5" r="1.3"/>' +
    '<path d="M4 5h6.7M13.3 5h6.7"/>' +
    '<path d="M12 6.3v13.2"/>' +
    '<path d="M6.5 20.5h11"/>' +
    '<path d="M5.5 5.6L2.5 12.5h6Z"/>' +
    '<path d="M18.5 5.6L15.5 12.5h6Z"/>'
  );

  /* As três barras. Não muda de desenho entre recolhido e expandido de
     propósito: é sempre o mesmo botão, no mesmo lugar, e o estado de quem
     aperta já está visível no menu inteiro ao lado. Seta que inverte serve
     quando o botão é a única pista do estado, que não é o caso. */
  var ICONE_MENU = icone(
    '<path d="M5 7.5h14M5 12h14M5 16.5h14"/>'
  );

  /* Cadeado: corpo, arco e segredo. É o mesmo desenho que o 🔒 já dizia — a
     troca aqui não é de símbolo, é de meio, para ele herdar a cor como os
     vizinhos em vez de trazer a sua.

     Quatro marcas, todas grandes: depois de tanto ícone no limite, este cabe
     com folga. */
  var ICONE_CADEADO = icone(
    '<rect x="4" y="10.5" width="16" height="11" rx="2.2"/>' +
    '<path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"/>' +
    '<circle cx="12" cy="15.5" r="1.5"/>' +
    '<path d="M12 17v2"/>'
  );

  /* Engrenagem: corpo, furo e oito dentes.

     Os dentes são riscos radiais, não os trapézios do original. É a mesma
     razão da engrenagem pequena da Auditoria, só que aqui há espaço para oito
     deles separados — e oito riscos regulares em volta de um círculo são
     inconfundíveis, enquanto oito trapézios de meio pixel viram uma borda
     serrilhada sem forma. */
  var ICONE_ENGRENAGEM = icone(
    '<circle cx="12" cy="12" r="6.6"/>' +
    '<circle cx="12" cy="12" r="3.2"/>' +
    '<path d="M18.6 12h2.8M12 18.6v2.8M5.4 12H2.6M12 5.4V2.6' +
             'M16.67 16.67l1.98 1.98M7.33 16.67l-1.98 1.98' +
             'M7.33 7.33L5.35 5.35M16.67 7.33l1.98-1.98"/>'
  );

  /* Lupa sobre um gráfico, com uma engrenagem no canto.

     Uma engrenagem, e não as duas do original: a de cima fica atrás da lente e
     some inteira em traço vazado. A de baixo virou anel tracejado em vez de
     dentes desenhados — a esse tamanho um dente tem meio pixel, e oito riscos
     em volta de um círculo dizem "engrenagem" melhor do que oito triângulos
     que viram sujeira.

     ATENÇÃO ao vizinho: Prospecção também é uma lupa. O que separa os dois é o
     que está DENTRO da lente, que é justamente o primeiro detalhe a se perder
     ao encolher. A engrenagem aqui não é enfeite — é o que diferencia a
     silhueta dos dois de longe. */
  var ICONE_AUDITORIA = icone(
    '<circle cx="12.5" cy="10.5" r="7"/>' +
    '<path d="M17.5 15.5L21 19"/>' +
    '<path d="M8 14.5h9"/>' +
    '<path d="M9.5 14.5v-3M12.5 14.5v-5M15.5 14.5v-3.5"/>' +
    '<path d="M8.5 8.5L11 6.2L13.5 8.2L16.5 5.2"/>' +
    '<circle cx="4.5" cy="18.5" r="3.3" stroke-dasharray="1.2 1.3"/>' +
    '<circle cx="4.5" cy="18.5" r="1.3"/>'
  );

  /* Duas telas ligadas por traço interrompido: um sistema falando com outro.

     O tracejado é o que diz "ligação entre sistemas" em vez de "duas telas", e
     é também a parte mais frágil aqui: a 15px cada arco tem uns 6px de
     comprimento, e sobra espaço para dois riscos. Por isso o `dasharray` é
     largo — poucos riscos grandes se leem, muitos pequenos viram uma linha
     cinza. Se nem assim aparecerem, o conserto é tirar o `stroke-dasharray`
     das duas linhas: a curva cheia diz quase o mesmo. */
  var ICONE_INTEGRACOES = icone(
    '<rect x="1.5" y="2" width="10" height="7.5" rx="1.7"/>' +
    '<path d="M6.5 9.5v1.5M4.7 11h3.6"/>' +
    '<rect x="12.5" y="12.5" width="10" height="7.5" rx="1.7"/>' +
    '<path d="M17.5 20v1.5M15.7 21.5h3.6"/>' +
    '<path d="M13 4.5A7 7 0 0 1 19.5 11" stroke-dasharray="3 2.6"/>' +
    '<path d="M5 13A7 7 0 0 0 11 19.5" stroke-dasharray="3 2.6"/>'
  );

  /* Folha escrita com a caneta ao lado.

     A caneta ficou FORA da folha, e não cruzando o canto como no original. Com
     desenho preenchido a caneta tapa o que está embaixo e a sobreposição se
     lê; em traço vazado os dois contornos apenas se cruzam, e a 15px um
     cruzamento vira um borrão bem no ponto que devia dizer "caneta".

     Como a folha teve de encolher para abrir esse espaço, ela ficou mais
     estreita que a de Tarefas — o que ajuda: as duas folhas não se confundem
     nem pela silhueta. */
  var ICONE_PECA = icone(
    '<path d="M10 2.5H4A2 2 0 0 0 2 4.5v15A2 2 0 0 0 4 21.5h7.5a2 2 0 0 0 2-2V6Z"/>' +
    '<path d="M10 2.5V4a2 2 0 0 0 2 2h1.5"/>' +
    '<path d="M4.5 8.5h7M4.5 11.5h7M4.5 14.5h7M4.5 17.5h4"/>' +
    '<path d="M14.2 21.2L14.2 18.4L20.35 4.7L22.45 5.7L16.3 19.3Z"/>' +
    '<path d="M14.2 18.4L16.3 19.3"/>'
  );

  /* Cronômetro correndo: mostrador, coroa, botão lateral e traços de
     velocidade à esquerda.

     Os traços não são enfeite — são o que separa "simular um prazo" de
     "marcar as horas". Sem eles sobra um cronômetro parado, que é o que o
     Timesheet já é. Por isso eles ficam largos e bem afastados do mostrador,
     em vez de discretos: precisam ser vistos primeiro que o resto.

     No desenho de origem os traços mordem o mostrador, cercados de branco. Em
     traço vazado a mordida não existe — eles simplesmente param antes da
     borda, e o efeito de movimento se mantém. */
  var ICONE_CRONOMETRO = icone(
    '<circle cx="14.5" cy="13.5" r="7"/>' +
    '<path d="M12.9 4.6h3.2v1.9h-3.2z"/>' +
    '<path d="M19.4 8.6L21.8 6.2"/>' +
    '<path d="M14.5 8.5v5L18 17"/>' +
    '<path d="M0.8 12h5.4M2.6 15.5h3.6M4.4 19h1.8"/>'
  );

  /* Folha com barras e seta de tendência. Três barras, e não as quatro do
     original, pela mesma aritmética dos outros: a quarta não caberia sem
     encostar nas vizinhas.

     A seta é o que distingue este do Dashboard, que também tem barras. Os dois
     só não se confundem porque um é retrato e o outro paisagem, e porque a
     seta sobe atravessando a folha inteira — por isso ela vai reta e larga,
     sem a dobra do desenho de origem, que a 15px não apareceria e ainda
     roubaria altura da subida. */
  var ICONE_RELATORIO = icone(
    '<path d="M6 2.5h11.5a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Z"/>' +
    '<path d="M6.5 18.5h11"/>' +
    '<path d="M8.2 18.5v-4M11.8 18.5v-6.5M15.4 18.5v-9"/>' +
    '<path d="M6.8 12.8L17 6.2"/>' +
    '<path d="M13.9 6.2H17v3.1"/>'
  );

  /* Painel: moldura com barra de título, lista à esquerda e barras à direita.
     São três linhas e três barras, e não as cinco e quatro do desenho de
     origem — a 15px, cinco linhas separadas por menos de dois pixels viram um
     retângulo cheio. */
  var ICONE_PAINEL = icone(
    '<path d="M2.5 3.5h19v17h-19z"/>' +
    '<path d="M2.5 8h19"/>' +
    '<path d="M5.5 11.5h4.5M5.5 14.5h4.5M5.5 17.5h4.5"/>' +
    '<path d="M12.5 17.5h6.5"/>' +
    '<path d="M13.5 17.5v-6M16 17.5v-4M18.5 17.5v-2"/>'
  );

  /* `permissao` é o id de enums.RECURSOS_PERMISSAO exigido para o item
     aparecer. Item sem `permissao` é visível a quem tem sessão. As seções
     somem sozinhas quando todos os itens delas somem — um cabeçalho
     "Administração" sobre lugar nenhum seria pior que menu nenhum. */
  var ITENS = [
    { secao: 'Acompanhamento' },
    { rota: '#/',          icone: ICONE_PAINEL, rotulo: 'Dashboard',  chave: 'dashboard' },
    { rota: '#/processos', icone: ICONE_BALANCA, rotulo: 'Processos',  chave: 'processos',
      permissao: 'processos.ver' },
    { rota: '#/agenda',    icone: ICONE_AGENDA, rotulo: 'Agenda',     chave: 'agenda',
      badge: 'prazosCriticos' },
    { rota: '#/tarefas',   icone: ICONE_CHECKLIST, rotulo: 'Tarefas',    chave: 'tarefas',
      badge: 'tarefasAtrasadas' },
    { rota: '#/publicacoes', icone: ICONE_JORNAL, rotulo: 'Publicações', chave: 'publicacoes',
      permissao: 'publicacoes.triar', badge: 'publicacoesPendentes' },
    { secao: 'Cadastros' },
    { rota: '#/crm',       icone: ICONE_BUSCA_PESSOA, rotulo: 'Prospecção', chave: 'crm',
      permissao: 'crm.ver', badge: 'followUpAtrasado' },
    { rota: '#/clientes',  icone: ICONE_PESSOA, rotulo: 'Clientes',   chave: 'clientes' },
    { secao: 'Financeiro' },
    { rota: '#/financeiro', icone: '$', rotulo: 'Financeiro', chave: 'financeiro',
      permissao: 'financeiro.ver' },
    { rota: '#/timesheet',  icone: '⏱', rotulo: 'Timesheet',  chave: 'timesheet' },
    { secao: 'Análise' },
    { rota: '#/relatorios', icone: ICONE_RELATORIO, rotulo: 'Relatórios', chave: 'relatorios',
      permissao: 'relatorios.ver' },
    { secao: 'Ferramentas' },
    { rota: '#/simulador', icone: ICONE_CRONOMETRO, rotulo: 'Simulador de prazo', chave: 'simulador' },
    { rota: '#/modelos',   icone: ICONE_PECA, rotulo: 'Modelos de peça', chave: 'modelos',
      permissao: 'documentos.editar' },
    /* Integrações fica em Ferramentas, e não em Administração: quem cuida
       dos monitoramentos do diário é quem tria publicação, e o advogado tem
       essa permissão. Sob Administração, ele veria uma seção inteira com um
       item só — e "Administração" prometeria mais do que entregaria. */
    { rota: '#/integracoes', icone: ICONE_INTEGRACOES, rotulo: 'Integrações', chave: 'integracoes',
      permissao: 'publicacoes.triar' },
    { secao: 'Administração' },
    { rota: '#/configuracoes', icone: ICONE_ENGRENAGEM, rotulo: 'Configurações', chave: 'configuracoes',
      permissao: 'configuracoes' },
    { rota: '#/auditoria',     icone: ICONE_AUDITORIA, rotulo: 'Auditoria',    chave: 'auditoria',
      permissao: 'auditoria' },
    { rota: '#/privacidade',   icone: ICONE_CADEADO, rotulo: 'Privacidade',  chave: 'privacidade',
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
   * @param {boolean} props.recolhida  menu na tira de ícones, em qualquer largura
   * @param {Object} props.usuario  define quais itens aparecem
   */
  function Sidebar(props) {
    var p = props || {};
    var badges = p.badges || {};

    var html = '<aside class="sidebar' +
                 (p.recolhida ? ' sidebar--recolhida' : '') + '">';

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
                ICONE_MENU +
              '</button>' +
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
                ' href="' + item.rota + '"' + (ativo ? ' aria-current="page"' : '') +
                ' aria-label="' + esc(item.rotulo) + '"' +
                (p.recolhida ? ' title="' + esc(item.rotulo) + '"' : '') + '>' +
                '<span class="nav-item__icon" aria-hidden="true">' + item.icone + '</span>' +
                '<span class="nav-item__rotulo">' + esc(item.rotulo) + '</span>' +
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
