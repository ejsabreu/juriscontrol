/* ==========================================================================
   pages/ClientesPage.js — lista de clientes
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var resultado = null;

  function esc(v) { return App.dom.esc(v); }
  function filtros() { return App.store.getState().clientesFiltros; }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });
    ligarEventos();   // delegação no container: uma vez por rota
    carregar(true);
  }

  /* `completo` só na entrada da rota; nas buscas seguintes troca-se a lista. */
  function carregar(completo) {
    App.services.clienteService.listar(filtros()).then(function (r) {
      resultado = r;
      if (completo || !atualizarMiolo()) desenharTudo();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Erro ao carregar clientes', texto: erro.message
      });
    });
  }

  function filtrosAtivos() {
    return App.selectors.filtrosAtivos(filtros(),
      ['ordenarPor', 'direcao', 'pagina', 'porPagina']);
  }

  function cabecalho() {
    return '<div class="page-header">' +
             '<div>' +
               '<h1 class="page-header__title">Clientes</h1>' +
             '</div>' +
             '<div class="page-header__actions">' +
               App.components.ui.Button({
                 rotulo: 'Novo cliente', variante: 'primary', icone: '+', acao: 'novo-cliente'
               }) +
             '</div>' +
           '</div>';
  }

  function barraFiltros() {
    var f = filtros();
    var enums = App.domain.enums;

    return App.components.FilterBar({
      campos: [
        { tipo: 'busca', nome: 'busca', valor: f.busca,
          placeholder: 'Buscar por nome, CPF/CNPJ ou e-mail…' },
        { tipo: 'select', nome: 'tipo', rotulo: 'Tipo',
          opcoes: enums.opcoes([
            { id: 'PF', label: 'Pessoa física' },
            { id: 'PJ', label: 'Pessoa jurídica' }
          ], f.tipo, 'Todos os tipos') }
      ],
      /* `ordenarPor` saiu da barra: quem ordena agora é o cabeçalho da
         tabela, como em Processos. Dois lugares mandando na mesma coisa é
         como um deles acaba mostrando o estado errado. */
      totalAtivos: filtrosAtivos()
    });
  }

  // --- Visão tabela ---------------------------------------------------------
  /* Mesma tabela de Processos: primeira coluna forte com o identificador e
     uma segunda linha discreta embaixo, badges para o que é categoria,
     número alinhado à direita. Cartão mostrava os mesmos seis campos em três
     vezes mais altura — e comparar dois clientes exigia rolar. */

  function colunasTabela() {
    var fmt = App.format;

    return [
      {
        chave: 'nome', titulo: 'Cliente', largura: '26%',
        render: function (c) {
          /* Só a razão social. O nome fantasia é um apelido comercial: some
             aqui e continua na ficha, onde há espaço para os dois. Numa
             lista, a linha que identifica juridicamente é a que serve para
             conferir com procuração e petição.

             Uma fonte só na tabela inteira: mesma família, mesmo tamanho,
             mesmo peso; o que ainda separa principal de secundário, nas
             outras colunas, é a COR. */
          return '<div class="u-truncate">' + esc(c.nome) + '</div>';
        }
      },
      {
        chave: 'tipo', titulo: 'Tipo',
        render: function (c) {
          /* Texto simples, e nao pastilha: PF/PJ e atributo do cadastro, nao
             estado que precise saltar da linha. Badge aqui competia com o
             nome do cliente pela atencao. */
          return '<span class="u-nowrap">' +
                   esc(c.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física') +
                 '</span>';
        }
      },
      {
        chave: 'documento', titulo: 'CPF / CNPJ',
        render: function (c) {
          return '<span class="u-nowrap">' + esc(fmt.documento(c.documento)) + '</span>';
        }
      },
      {
        chave: 'contato', titulo: 'Contato', ordenavel: false,
        render: function (c) {
          return '<div class="u-truncate">' + esc(c.email || '—') + '</div>' +
                 '<div class="u-subtle u-nowrap">' +
                   esc(fmt.telefone(c.celular || c.telefone)) + '</div>';
        }
      },
      {
        chave: 'cidade', titulo: 'Cidade',
        render: function (c) {
          return '<span class="u-truncate">' +
                   esc(c.endereco.cidade + '/' + c.endereco.uf) + '</span>';
        }
      },
      {
        chave: 'totalProcessos', titulo: 'Processos', alinhamento: 'right',
        render: function (c) {
          if (!c.totalProcessos) return '<span class="u-subtle">—</span>';
          return '<span class="u-nowrap">' + c.totalProcessos + '</span>' +
                 '<div class="u-subtle u-nowrap">' + c.processosAtivos + ' ativos</div>';
        }
      },
      {
        chave: 'valorEnvolvido', titulo: 'Valor envolvido', alinhamento: 'right',
        render: function (c) {
          return '<span class="u-nowrap">' + esc(fmt.moeda(c.valorEnvolvido)) + '</span>';
        }
      }
    ];
  }

  function listaDeClientes() {
    var f = filtros();
    var ui = App.components.ui;

    var tabela = App.components.DataTable({
      colunas: colunasTabela(),
      itens: resultado.itens,
      ordenarPor: f.ordenarPor,
      direcao: f.direcao,
      hrefDe: function (c) { return '#/clientes/' + c.id; },
      vazio: ui.EmptyState({
        /* O mesmo desenho do item Clientes no menu — o 👤 era outra
           figura para a mesma coisa. A cor não vem com ele: o ícone herda
           por `currentColor` a do estado vazio, apagada de propósito para
           não competir com a frase. */
        icone: App.icones.de('pessoa'),
        titulo: 'Nenhum cliente encontrado',
        texto: 'Nenhum cliente corresponde aos filtros aplicados.',
        acao: ui.Button({ rotulo: 'Limpar filtros', variante: 'secondary', acao: 'limpar-filtros' })
      })
    });

    return ui.Card({
      semPadding: true,
      conteudo: tabela,
      /* A faixa e o seletor de quantidade saem do próprio resultado — quem
         sabe montar "1 a 15 de 40 clientes" é a paginação, não a tela. */
      rodape: ui.Pagination({
        pagina: resultado.pagina,
        totalPaginas: resultado.totalPaginas,
        total: resultado.total,
        porPagina: resultado.porPagina,
        singular: 'cliente'
      })
    });
  }

  /* Desenho COMPLETO — só ao entrar na rota.

     A cada busca, refazer a tela inteira por `innerHTML` custa duas coisas
     visíveis: o campo de texto é destruído debaixo dos dedos de quem digita,
     e a tela pisca, porque cabeçalho, barra e tabela somem e voltam juntos a
     cada tecla.

     Então o que muda a cada busca é só o que realmente mudou: a lista e a
     contagem. A barra de filtros fica quieta no lugar — e com ela o campo,
     o cursor e o foco. */
  function desenharTudo() {
    container.innerHTML =
      cabecalho() +
      barraFiltros() +
      '<div data-miolo>' + listaDeClientes() + '</div>';
  }

  function atualizarMiolo() {
    /* Sem `contagem`: o cabeçalho não tem mais subtítulo. O total continua no
       rodapé da tabela ("Exibindo 1–15 de 40"), que é onde ele responde a
       pergunta de quem está lendo a lista — e que é redesenhado junto com o
       miolo, sem precisar de acerto à parte. */
    return App.components.FilterBar.trocarMiolo(container, listaDeClientes(), {
      totalAtivos: filtrosAtivos()
    });
  }

  function ligarEventos() {
    App.components.FilterBar.mount(container, {
      aoMudar: function (nome, valor) {
        var alteracoes = { pagina: 1 };
        alteracoes[nome] = valor;
        App.store.setState({ clientesFiltros: Object.assign({}, filtros(), alteracoes) });
        carregar();
      },
      aoLimpar: function () {
        /* `porPagina` sobrevive ao "limpar": não é filtro, é o tamanho da
           janela que a pessoa escolheu para ler a lista. Devolvê-lo a 15 aqui
           desfazia uma escolha que ninguém pediu para desfazer. */
        App.store.setState({
          clientesFiltros: { busca: '', tipo: '', ordenarPor: 'nome',
                             direcao: 'asc', pagina: 1,
                             porPagina: filtros().porPagina }
        });
        /* Completo: os campos da barra ficam FORA do miolo — trocar só o
           miolo limpava o filtro e deixava escrito o que estava neles. */
        carregar(true);
      }
    });

    App.components.DataTable.mount(container, {
      /* Clicar na linha abre o cadastro JÁ EDITÁVEL. Ir para a ficha e de lá
         clicar em "Editar" eram dois passos para a coisa mais comum de se
         fazer com um cliente: corrigir um telefone, completar o endereço.
         A ficha continua a um clique, pelo link dentro do próprio modal. */
      aoClicarLinha: function (id) { abrirEdicaoCliente(id); },
      aoOrdenar: function (chave) {
        var f = filtros();
        // Clicar de novo na mesma coluna inverte; coluna nova começa crescente.
        var direcao = f.ordenarPor === chave && f.direcao === 'asc' ? 'desc' : 'asc';
        App.store.setState({
          clientesFiltros: Object.assign({}, f,
            { ordenarPor: chave, direcao: direcao, pagina: 1 })
        });
        carregar();
      }
    });

    App.dom.delegate(container, 'click', '[data-action="pagina"]', function (evento, botao) {
      var pagina = Number(botao.dataset.value);
      if (pagina < 1 || pagina > resultado.totalPaginas) return;
      App.store.setState({ clientesFiltros: Object.assign({}, filtros(), { pagina: pagina }) });
      carregar();
    });

    App.dom.delegate(container, 'click', '[data-action="novo-cliente"]', abrirNovoCliente);
  }

  /* O cadastro cobre o que a ficha do cliente sabe mostrar.

     Enquanto ele pedia sete campos, a ficha desenhava linha de telefone
     fixo, endereço completo, nascimento e origem que ninguém tinha como
     preencher — e o endereço saía pela metade, só "São Paulo/SP", numa tela
     que existe para conferir com procuração.

     Os campos vivem em `components/ClienteForm`, junto com os da tela de
     edição. Dois formulários escritos à mão para os mesmos dados foi o que
     produziu a divergência acima. */
  function abrirNovoCliente() {
    abrirCadastro(null);
  }

  function abrirEdicaoCliente(id) {
    App.services.clienteService.obter(id).then(function (cliente) {
      abrirCadastro(cliente);
    }).catch(function (erro) {
      App.components.Toast.erro('Não foi possível abrir o cliente', erro.message);
    });
  }

  /** @param {Object|null} cliente  null cadastra; com `id`, edita. */
  function abrirCadastro(cliente) {
    var ClienteForm = App.components.ClienteForm;
    var edicao = !!(cliente && cliente.id);

    App.components.Modal.abrir({
      titulo: edicao ? 'Cadastro de ' + cliente.nome : 'Novo cliente',
      tamanho: 'lg',
      conteudo:
        /* O caminho para a ficha sai daqui: processos, financeiro e histórico
           de contato não cabem num modal, e sem este link eles ficariam sem
           porta de entrada a partir da lista. */
        (edicao
          ? '<p class="u-sm u-muted" style="margin-bottom:var(--space-4)">' +
              '<a href="#/clientes/' + esc(cliente.id) + '" data-action="ver-ficha">' +
                'Ver ficha completa</a>' +
              ' — processos, financeiro e histórico de contato.' +
            '</p>'
          : '') +
        '<form id="' + ClienteForm.ID + '" novalidate>' +
          ClienteForm({ cliente: cliente }) +
        '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: edicao ? 'Salvar alterações' : 'Cadastrar',
          variante: 'primary', acao: 'salvar' }
      ],
      aoAbrir: function (corpo) { ClienteForm.mount(corpo); },
      aoAcao: function (acao, corpo, fechar) {
        // O link navega sozinho; o modal é que precisa sair da frente.
        if (acao === 'ver-ficha') return fechar();
        if (acao !== 'salvar') return;

        var leitura = ClienteForm.ler(corpo);
        if (!leitura.valido) {
          ClienteForm.marcarErros(corpo, leitura.erros);
          App.components.Toast.aviso('Verifique os campos destacados', leitura.primeiroErro);
          return;
        }

        var operacao = edicao
          ? App.services.clienteService.atualizar(cliente.id, leitura.dados)
          : App.services.clienteService.criar(
              Object.assign({ ehCliente: true }, leitura.dados));

        operacao.then(function (salvo) {
          fechar();
          App.components.Toast.sucesso(
            edicao ? 'Cliente atualizado' : 'Cliente cadastrado', salvo.nome);
          carregar();
        }).catch(function (erro) {
          App.components.Toast.erro(
            edicao ? 'Erro ao salvar' : 'Erro ao cadastrar', erro.message);
        });
      }
    });
  }

  App.pages.ClientesPage = { render: render };
})(window.App = window.App || {});
