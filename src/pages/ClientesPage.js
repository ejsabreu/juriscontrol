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
    carregar();
  }

  function carregar() {
    App.services.clienteService.listar(filtros()).then(function (r) {
      resultado = r;
      desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Erro ao carregar clientes', texto: erro.message
      });
    });
  }

  function cabecalho() {
    return '<div class="page-header">' +
             '<div>' +
               '<h1 class="page-header__title">Clientes</h1>' +
               '<p class="page-header__subtitle">' +
                 resultado.total + ' ' + App.format.plural(resultado.total, 'cliente') + ' cadastrado(s)' +
               '</p>' +
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
          ], f.tipo, 'Todos os tipos') },
        { tipo: 'select', nome: 'ordenarPor', rotulo: 'Ordenar por',
          opcoes: enums.opcoes([
            { id: 'nome', label: 'Nome (A–Z)' },
            { id: 'totalProcessos', label: 'Mais processos' },
            { id: 'valorEnvolvido', label: 'Maior valor envolvido' }
          ], f.ordenarPor) }
      ],
      totalAtivos: App.selectors.filtrosAtivos(f, ['ordenarPor', 'pagina', 'porPagina'])
    });
  }

  function cartaoCliente(cliente) {
    var ui = App.components.ui;
    var fmt = App.format;

    return '<a class="card" href="#/clientes/' + esc(cliente.id) + '"' +
             ' style="display:block;color:inherit;text-decoration:none">' +
             '<div class="card__body">' +
               '<div class="u-row" style="align-items:flex-start;gap:var(--space-3)">' +
                 ui.Avatar({
                   nome: cliente.nome, tamanho: 'lg',
                   cor: cliente.tipo === 'PJ' ? 'var(--color-accent-500)' : 'var(--color-primary-500)'
                 }) +
                 '<div style="flex:1;min-width:0">' +
                   '<div class="u-bold u-truncate">' + esc(cliente.nome) + '</div>' +
                   '<div class="u-xs u-subtle">' +
                     esc(cliente.tipo === 'PJ' ? 'CNPJ ' : 'CPF ') +
                     esc(fmt.documento(cliente.documento)) +
                   '</div>' +
                   '<div class="u-xs u-subtle u-truncate">' +
                     esc(cliente.endereco.cidade + '/' + cliente.endereco.uf) +
                   '</div>' +
                 '</div>' +
                 ui.Badge({ rotulo: cliente.tipo, variante: cliente.tipo === 'PJ' ? 'accent' : 'primary' }) +
               '</div>' +

               '<div class="divider" style="margin:var(--space-4) 0"></div>' +

               '<div class="u-row" style="gap:var(--space-5)">' +
                 '<div>' +
                   '<div class="def-list__term">Processos</div>' +
                   '<div class="u-bold">' + cliente.totalProcessos +
                     ' <span class="u-xs u-subtle">(' + cliente.processosAtivos + ' ativos)</span></div>' +
                 '</div>' +
                 '<div>' +
                   '<div class="def-list__term">Valor envolvido</div>' +
                   '<div class="u-bold">' + esc(fmt.moedaCompacta(cliente.valorEnvolvido)) + '</div>' +
                 '</div>' +
               '</div>' +
             '</div>' +
           '</a>';
  }

  function desenhar() {
    var ui = App.components.ui;

    var lista = resultado.itens.length
      ? '<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(290px,1fr))">' +
          resultado.itens.map(cartaoCliente).join('') +
        '</div>'
      : ui.EmptyState({
          icone: '👤',
          titulo: 'Nenhum cliente encontrado',
          texto: 'Ajuste a busca ou cadastre um novo cliente.',
          acao: ui.Button({ rotulo: 'Limpar filtros', variante: 'secondary', acao: 'limpar-filtros' })
        });

    var inicio = (resultado.pagina - 1) * resultado.porPagina + 1;
    var fim = Math.min(resultado.pagina * resultado.porPagina, resultado.total);

    container.innerHTML =
      cabecalho() +
      barraFiltros() +
      lista +
      '<div style="margin-top:var(--space-4)">' +
        ui.Pagination({
          pagina: resultado.pagina,
          totalPaginas: resultado.totalPaginas,
          total: resultado.total,
          info: resultado.total ? 'Exibindo ' + inicio + '–' + fim + ' de ' + resultado.total : ''
        }) +
      '</div>';
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
          clientesFiltros: { busca: '', tipo: '', ordenarPor: 'nome', pagina: 1, porPagina: 12 }
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
