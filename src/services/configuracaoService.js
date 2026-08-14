/* ==========================================================================
   services/configuracaoService.js — o que o escritório personaliza

   Quatro coisas que estavam fixas no código e um escritório de verdade
   precisa mudar:

     · os dados do próprio escritório (nome, OAB, endereço) — que aparecem
       em contrato, proposta e boleto;
     · os FERIADOS LOCAIS: o motor calcula os nacionais a partir da Páscoa,
       mas ponto facultativo de comarca não tem regra que o derive. Sem
       cadastrá-los, o prazo é contado a mais — e prazo contado a mais é
       prazo perdido;
     · os tipos de prazo, que eram constante em `enums.js`;
     · as preferências de cada usuário.

   `configuracoes` é uma coleção chave/valor. Simples de propósito: cada
   opção nova é uma chave, não uma migração.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  var PADRAO_ESCRITORIO = {
    nome: 'JurisControl Sociedade de Advogados',
    cnpj: '',
    oab: '',
    email: 'contato@juriscontrol.adv.br',
    telefone: '',
    endereco: '',
    diasAntecedenciaPrazo: 3
  };

  // --- Chave/valor -----------------------------------------------------------

  function ler(chave, padrao) {
    var achada = db().get('configuracoes').filter(function (c) {
      return c.chave === chave;
    })[0];
    return achada ? achada.valor : padrao;
  }

  function gravar(chave, valor) {
    var achada = db().get('configuracoes').filter(function (c) {
      return c.chave === chave;
    })[0];

    if (achada) return db().update('configuracoes', achada.id, { valor: valor });
    return db().insert('configuracoes', { chave: chave, valor: valor }, 'CFG');
  }

  // --- Escritório ------------------------------------------------------------

  function escritorio() {
    return Object.assign({}, PADRAO_ESCRITORIO, ler('escritorio', {}) || {});
  }

  function salvarEscritorio(dados) {
    return http().requisicao(function () {
      var atual = escritorio();
      var novo = Object.assign({}, atual, dados || {});

      if (novo.cnpj) {
        var limpo = String(novo.cnpj).replace(/\D/g, '');
        if (limpo && !App.domain.validators.cnpj(limpo).valido) {
          throw http().ErroApi('CNPJ inválido.', 400);
        }
      }
      if (!String(novo.nome || '').trim()) {
        throw http().ErroApi('O escritório precisa de um nome.', 400);
      }

      gravar('escritorio', novo);
      return novo;
    });
  }

  // --- Feriados locais -------------------------------------------------------

  function feriadosLocais() {
    return db().get('feriadosEscritorio')
      .slice()
      .sort(function (a, b) { return a.data < b.data ? -1 : 1; });
  }

  /**
   * Injeta os feriados locais no motor de prazos.
   *
   * Chamado no bootstrap e depois de cada alteração. Sem isso, o cadastro
   * existiria e o cálculo continuaria ignorando — que é o tipo de bug que
   * só aparece na conferência do prazo, tarde demais.
   */
  function aplicarFeriados() {
    App.domain.feriados.definirLocais(feriadosLocais().map(function (f) {
      return { data: f.data, nome: f.nome, comarca: f.comarca, tribunalId: f.tribunalId };
    }));
  }

  function criarFeriado(dados) {
    return http().requisicao(function () {
      var data = String(dados.data || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        throw http().ErroApi('Informe uma data válida.', 400);
      }
      if (!String(dados.nome || '').trim()) {
        throw http().ErroApi('Dê um nome ao feriado.', 400);
      }

      var repetido = db().get('feriadosEscritorio').filter(function (f) {
        return f.data === data && (f.comarca || '') === (dados.comarca || '');
      })[0];
      if (repetido) throw http().ErroApi('Já existe feriado nesta data e comarca.', 409);

      var criado = db().insert('feriadosEscritorio', {
        data: data,
        nome: String(dados.nome).trim(),
        comarca: dados.comarca || null,
        tribunalId: dados.tribunalId || null,
        tipo: dados.tipo || 'ponto_facultativo'
      }, 'FER');

      aplicarFeriados();
      return criado;
    });
  }

  function removerFeriado(id) {
    return http().requisicao(function () {
      if (!db().remove('feriadosEscritorio', id)) {
        throw http().ErroApi('Feriado não encontrado.', 404);
      }
      aplicarFeriados();
      return { id: id };
    });
  }

  // --- Tipos de prazo --------------------------------------------------------

  /**
   * Tipos de prazo vigentes: os do enum mais os cadastrados pelo escritório.
   * O enum continua sendo o piso — remover um tipo de lá quebraria prazos
   * já gravados que apontam para ele.
   */
  function tiposPrazo() {
    var doEscritorio = ler('tiposPrazo', []) || [];
    return App.domain.enums.TIPOS_PRAZO.concat(doEscritorio);
  }

  function criarTipoPrazo(dados) {
    return http().requisicao(function () {
      var label = String(dados.label || '').trim();
      var dias = parseInt(dados.dias, 10);

      if (!label) throw http().ErroApi('Dê um nome ao tipo de prazo.', 400);
      if (!dias || dias < 1) throw http().ErroApi('Informe a quantidade de dias.', 400);

      var id = 'custom_' + App.domain.busca.normalizar(label).replace(/[^a-z0-9]+/g, '_');
      if (tiposPrazo().some(function (t) { return t.id === id; })) {
        throw http().ErroApi('Já existe tipo de prazo com este nome.', 409);
      }

      var lista = (ler('tiposPrazo', []) || []).concat([{
        id: id, label: label, dias: dias,
        contagem: dados.contagem === 'corridos' ? 'corridos' : 'uteis',
        doEscritorio: true
      }]);

      gravar('tiposPrazo', lista);
      return lista[lista.length - 1];
    });
  }

  function removerTipoPrazo(id) {
    return http().requisicao(function () {
      // Tipo do enum não sai: há prazos gravados apontando para ele.
      if (App.domain.enums.achar(App.domain.enums.TIPOS_PRAZO, id)) {
        throw http().ErroApi('Tipos padrão do sistema não podem ser removidos.', 409);
      }

      var emUso = db().get('prazos').filter(function (p) {
        return p.tipoPrazoId === id;
      }).length;
      if (emUso) {
        throw http().ErroApi(
          'Há ' + emUso + ' prazo(s) usando este tipo. Removê-lo deixaria o registro ' +
          'apontando para nada.', 409);
      }

      gravar('tiposPrazo', (ler('tiposPrazo', []) || []).filter(function (t) {
        return t.id !== id;
      }));
      return { id: id };
    });
  }

  // --- Preferências por usuário ----------------------------------------------

  function preferencias(usuarioId) {
    var todas = ler('preferencias', {}) || {};
    return Object.assign({
      telaInicial: '#/',
      densidade: 'normal',
      itensPorPagina: 15
    }, todas[usuarioId] || {});
  }

  function salvarPreferencias(usuarioId, dados) {
    return http().requisicao(function () {
      var todas = ler('preferencias', {}) || {};
      todas[usuarioId] = Object.assign(preferencias(usuarioId), dados || {});
      gravar('preferencias', todas);
      return todas[usuarioId];
    });
  }

  App.services.configuracaoService = {
    PADRAO_ESCRITORIO: PADRAO_ESCRITORIO,
    ler: ler,
    gravar: gravar,
    escritorio: escritorio,
    salvarEscritorio: salvarEscritorio,
    feriadosLocais: feriadosLocais,
    aplicarFeriados: aplicarFeriados,
    criarFeriado: criarFeriado,
    removerFeriado: removerFeriado,
    tiposPrazo: tiposPrazo,
    criarTipoPrazo: criarTipoPrazo,
    removerTipoPrazo: removerTipoPrazo,
    preferencias: preferencias,
    salvarPreferencias: salvarPreferencias
  };
})(window.App = window.App || {});
