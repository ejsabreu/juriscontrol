/* ==========================================================================
   services/clienteService.js
       listar(filtros) → GET /api/pessoas?ehCliente=true
       obter(id)       → GET /api/pessoas/:id

   "Cliente" não é uma tabela: é o papel de uma Pessoa (ehCliente = true).
   Assim uma parte contrária pode virar cliente sem duplicação de cadastro.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function enriquecer(pessoa, processos) {
    var lista = processos || db().get('processos');
    var meus = lista.filter(function (p) { return p.clienteId === pessoa.id; });

    return Object.assign({}, pessoa, {
      totalProcessos: meus.length,
      processosAtivos: meus.filter(function (p) { return p.status === 'ativo'; }).length,
      valorEnvolvido: meus.reduce(function (soma, p) { return soma + (p.valorCausa || 0); }, 0)
    });
  }

  /* Mesma forma do `COMPARADORES` de processoService: cada um ordena
     CRESCENTE, e a direção é aplicada depois, invertendo. Comparador que já
     devolve descendente — como o antigo `b.total - a.total` daqui — não
     compõe com um botão de direção: clicar no cabeçalho inverteria o sentido
     de umas colunas e não de outras. */
  var COMPARADORES = {
    nome:            function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); },
    tipo:            function (a, b) { return a.tipo.localeCompare(b.tipo); },
    documento:       function (a, b) {
      return String(a.documento).replace(/\D/g, '')
        .localeCompare(String(b.documento).replace(/\D/g, ''));
    },
    cidade:          function (a, b) {
      return (a.endereco.cidade + a.endereco.uf)
        .localeCompare(b.endereco.cidade + b.endereco.uf, 'pt-BR');
    },
    totalProcessos:  function (a, b) { return a.totalProcessos - b.totalProcessos; },
    valorEnvolvido:  function (a, b) { return a.valorEnvolvido - b.valorEnvolvido; }
  };

  /**
   * @param {Object} [filtros] busca, tipo, uf, apenasComProcessoAtivo,
   *                           incluirNaoClientes, ordenarPor, direcao,
   *                           pagina, porPagina
   */
  function listar(filtros) {
    return http().requisicao(function () {
      var f = filtros || {};
      var processos = db().get('processos');

      var lista = db().get('pessoas')
        .filter(function (p) { return f.incluirNaoClientes ? true : p.ehCliente; })
        .map(function (p) { return enriquecer(p, processos); });

      lista = lista.filter(function (p) {
        if (f.tipo && p.tipo !== f.tipo) return false;
        if (f.uf && p.endereco.uf !== f.uf) return false;
        if (f.apenasComProcessoAtivo && p.processosAtivos === 0) return false;

        if (f.busca) {
          var termo = String(f.busca).toLowerCase().trim();
          var alvo = [p.nome, p.nomeFantasia, p.email, p.endereco.cidade].join(' ').toLowerCase();
          var docDigitos = String(p.documento).replace(/\D/g, '');
          var termoDigitos = termo.replace(/\D/g, '');
          var achouPorDoc = termoDigitos.length >= 3 && docDigitos.indexOf(termoDigitos) !== -1;
          if (alvo.indexOf(termo) === -1 && !achouPorDoc) return false;
        }
        return true;
      });

      var comparador = COMPARADORES[f.ordenarPor || 'nome'];
      if (comparador) {
        lista.sort(comparador);
        if (f.direcao === 'desc') lista.reverse();
      }

      var total = lista.length;
      var pagina = f.pagina || 1;
      var porPagina = f.porPagina || total || 1;
      var inicio = (pagina - 1) * porPagina;

      return {
        itens: f.porPagina ? lista.slice(inicio, inicio + porPagina) : lista,
        total: total,
        pagina: pagina,
        porPagina: porPagina,
        totalPaginas: Math.max(1, Math.ceil(total / porPagina))
      };
    });
  }

  function obter(id) {
    return http().requisicao(function () {
      var pessoa = db().find('pessoas', id);
      if (!pessoa) throw http().ErroApi('Cliente não encontrado.', 404);

      var todosProcessos = db().get('processos');
      var usuarios = db().get('usuarios');
      var prazos = db().get('prazos');

      var meusProcessos = todosProcessos
        .filter(function (p) { return p.clienteId === id; })
        .map(function (p) {
          return App.services.processoService.enriquecer(p, {
            pessoas: [pessoa], usuarios: usuarios, prazos: prazos
          });
        })
        .sort(function (a, b) { return a.dataDistribuicao < b.dataDistribuicao ? 1 : -1; });

      var documentos = db().where('documentos', function (d) { return d.clienteId === id; });

      return Object.assign(enriquecer(pessoa, todosProcessos), {
        processos: meusProcessos,
        documentos: documentos
      });
    });
  }

  function criar(dados) {
    return http().requisicao(function () {
      return enriquecer(db().insert('pessoas', Object.assign({
        tipo: 'PF',
        ehCliente: true,
        endereco: {},
        observacoes: ''
      }, dados), 'PES'));
    });
  }

  function atualizar(id, alteracoes) {
    return http().requisicao(function () {
      var atualizado = db().update('pessoas', id, alteracoes);
      if (!atualizado) throw http().ErroApi('Cliente não encontrado.', 404);
      return enriquecer(atualizado);
    });
  }

  function remover(id) {
    return http().requisicao(function () {
      var vinculados = db().get('processos').filter(function (p) { return p.clienteId === id; });
      if (vinculados.length) {
        throw http().ErroApi(
          'Não é possível excluir: há ' + vinculados.length + ' processo(s) vinculado(s).', 409);
      }
      db().remove('pessoas', id);
      return { id: id };
    });
  }

  App.services.clienteService = {
    listar: listar,
    obter: obter,
    criar: criar,
    atualizar: atualizar,
    remover: remover
  };
})(window.App = window.App || {});
