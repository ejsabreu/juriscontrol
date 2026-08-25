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

  function textoContagem() {
    return resultado.total + ' ' +
           App.format.plural(resultado.total, 'cliente') + ' cadastrado(s)';
  }

  function filtrosAtivos() {
    return App.selectors.filtrosAtivos(filtros(),
      ['ordenarPor', 'direcao', 'pagina', 'porPagina']);
  }

  function cabecalho() {
    return '<div class="page-header">' +
             '<div>' +
               '<h1 class="page-header__title">Clientes</h1>' +
               '<p class="page-header__subtitle">' + esc(textoContagem()) + '</p>' +
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
        icone: '👤',
        titulo: 'Nenhum cliente encontrado',
        texto: 'Nenhum cliente corresponde aos filtros aplicados.',
        acao: ui.Button({ rotulo: 'Limpar filtros', variante: 'secondary', acao: 'limpar-filtros' })
      })
    });

    var inicio = (resultado.pagina - 1) * resultado.porPagina + 1;
    var fim = Math.min(resultado.pagina * resultado.porPagina, resultado.total);

    return ui.Card({
      semPadding: true,
      conteudo: tabela,
      rodape: ui.Pagination({
        pagina: resultado.pagina,
        totalPaginas: resultado.totalPaginas,
        total: resultado.total,
        info: resultado.total
          ? 'Exibindo ' + inicio + '–' + fim + ' de ' + resultado.total
          : 'Nenhum registro'
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
    return App.components.FilterBar.trocarMiolo(container, listaDeClientes(), {
      contagem: textoContagem(),
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
        App.store.setState({
          clientesFiltros: { busca: '', tipo: '', ordenarPor: 'nome',
                             direcao: 'asc', pagina: 1, porPagina: 15 }
        });
        carregar();
      }
    });

    App.components.DataTable.mount(container, {
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

  function abrirNovoCliente() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var validators = App.domain.validators;

    App.components.Modal.abrir({
      titulo: 'Novo cliente',
      tamanho: 'lg',
      conteudo: '<form id="form-cliente" class="form-grid">' +
        ui.Field({ nome: 'tipo', rotulo: 'Tipo de pessoa', tipo: 'select', largura: 4,
                   opcoes: enums.opcoes([
                     { id: 'PF', label: 'Pessoa física' },
                     { id: 'PJ', label: 'Pessoa jurídica' }
                   ], 'PF') }) +
        ui.Field({ nome: 'nome', rotulo: 'Nome / Razão social', largura: 8, obrigatorio: true }) +
        ui.Field({ nome: 'documento', rotulo: 'CPF / CNPJ', largura: 4, obrigatorio: true,
                   placeholder: '000.000.000-00', atributos: ' inputmode="numeric"' }) +
        ui.Field({ nome: 'email', rotulo: 'E-mail', tipo: 'email', largura: 4 }) +
        ui.Field({ nome: 'celular', rotulo: 'Celular', largura: 4,
                   placeholder: '(11) 90000-0000', atributos: ' inputmode="numeric"' }) +
        ui.Field({ nome: 'cidade', rotulo: 'Cidade', largura: 8 }) +
        ui.Field({ nome: 'uf', rotulo: 'UF', tipo: 'select', largura: 4,
                   opcoes: enums.opcoes(
                     validators.UFS.map(function (uf) { return { id: uf, label: uf }; }), 'SP') }) +
      '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Cadastrar', variante: 'primary', acao: 'salvar' }
      ],
      aoAbrir: function (corpo) {
        var campoDoc = App.dom.qs('[name="documento"]', corpo);
        var campoTipo = App.dom.qs('[name="tipo"]', corpo);
        var campoCelular = App.dom.qs('[name="celular"]', corpo);

        App.mask.aplicar(campoDoc, App.mask.documento);
        App.mask.aplicar(campoCelular, App.mask.telefone);

        campoTipo.addEventListener('change', function () {
          campoDoc.placeholder = campoTipo.value === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00';
        });
      },
      aoAcao: function (acao, corpo, fechar) {
        if (acao !== 'salvar') return;

        var dados = App.dom.formToObject(App.dom.qs('#form-cliente', corpo));

        var validacao = validators.validarFormulario(dados, {
          nome: function (v) { return validators.obrigatorio(v, 'Nome'); },
          documento: function (v) { return validators.documento(v, dados.tipo); }
        });

        if (!validacao.valido) {
          var primeiroErro = validacao.erros[Object.keys(validacao.erros)[0]];
          App.components.Toast.aviso('Dados inválidos', primeiroErro);
          return;
        }

        App.services.clienteService.criar({
          tipo: dados.tipo,
          nome: dados.nome.trim(),
          documento: App.mask.so(dados.documento),
          email: dados.email,
          celular: App.mask.so(dados.celular),
          telefone: '',
          ehCliente: true,
          endereco: { cidade: dados.cidade, uf: dados.uf, cep: '', logradouro: '',
                      numero: '', complemento: '', bairro: '' }
        }).then(function (cliente) {
          fechar();
          App.components.Toast.sucesso('Cliente cadastrado', cliente.nome);
          carregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Erro ao cadastrar', erro.message);
        });
      }
    });
  }

  App.pages.ClientesPage = { render: render };
})(window.App = window.App || {});
