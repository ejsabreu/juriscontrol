/* ==========================================================================
   components/ClienteForm.js — os campos do cliente, em um lugar só

   Cadastro (modal da lista) e edição (tela própria) pedem exatamente os
   mesmos dados. Enquanto eram dois formulários escritos à mão, um deles
   ficava para trás: foi assim que a ficha passou a exibir endereço,
   telefone fixo, nascimento e origem que nenhum formulário coletava.

   Aqui ficam os CAMPOS, as máscaras, a regra de quais campos valem para
   cada tipo de pessoa e a leitura validada. Quem decide o que fazer com o
   resultado — criar ou atualizar, fechar modal ou navegar — é a página.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  var ID = 'form-cliente';

  /* Campos que só existem para um dos tipos. Empresa não tem RG nem data de
     nascimento; pessoa física não tem nome fantasia. */
  var SO_PJ = ['nomeFantasia'];
  var SO_PF = ['rg', 'dataNascimento'];

  /* `form-grid--capsula`: os campos deste formulário usam o feitio da caixa
     de busca da barra de filtros — cápsula preenchida, sem contorno em
     repouso —, para combinar com os combos, que já vieram de lá. */
  function secao(titulo, campos) {
    return '<fieldset class="fieldset">' +
             '<legend class="fieldset__legend">' + titulo + '</legend>' +
             '<div class="form-grid form-grid--capsula">' + campos + '</div>' +
           '</fieldset>';
  }

  /**
   * Devolve os CAMPOS, sem a tag `<form>` — quem envolve é a página, porque
   * o modal quer um formulário nu e a tela de edição quer um formulário que
   * também é o cartão, com rodapé fixo. O `id` das duas é `ClienteForm.ID`,
   * que é onde `mount` e `ler` vão procurar.
   *
   * @param {Object} [props]
   * @param {Object} [props.cliente] valores iniciais; vazio no cadastro
   * @param {Object} [props.erros]   { campo: mensagem } — destaca ao redesenhar
   */
  function ClienteForm(props) {
    var p = props || {};
    var c = p.cliente || {};
    var erros = p.erros || {};
    var end = c.endereco || {};
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var validators = App.domain.validators;

    return secao('Identificação',
        ui.Field({ nome: 'tipo', rotulo: 'Tipo de pessoa', tipo: 'combo', largura: 4,
                   opcoes: enums.opcoes([
                     { id: 'PF', label: 'Pessoa física' },
                     { id: 'PJ', label: 'Pessoa jurídica' }
                   ], c.tipo || 'PF') }) +
        ui.Field({ nome: 'nome', rotulo: 'Nome / Razão social', largura: 8, obrigatorio: true,
                   valor: c.nome, erro: erros.nome }) +
        ui.Field({ nome: 'documento', rotulo: 'CPF / CNPJ', largura: 4, obrigatorio: true,
                   valor: c.documento, erro: erros.documento,
                   placeholder: '000.000.000-00', atributos: ' inputmode="numeric"' }) +
        /* Os três abaixo aparecem e somem conforme o tipo — ver `aplicarTipo`. */
        ui.Field({ nome: 'nomeFantasia', rotulo: 'Nome fantasia', largura: 4,
                   valor: c.nomeFantasia, dica: 'Como a empresa é conhecida' }) +
        ui.Field({ nome: 'rg', rotulo: 'RG', largura: 4, valor: c.rg }) +
        ui.Field({ nome: 'dataNascimento', rotulo: 'Nascimento', tipo: 'date', largura: 4,
                   valor: c.dataNascimento })) +

      secao('Contato',
        ui.Field({ nome: 'email', rotulo: 'E-mail', tipo: 'email', largura: 4,
                   valor: c.email, erro: erros.email }) +
        ui.Field({ nome: 'celular', rotulo: 'Celular', largura: 4, valor: c.celular,
                   erro: erros.celular,
                   placeholder: '(11) 90000-0000', atributos: ' inputmode="numeric"' }) +
        ui.Field({ nome: 'telefone', rotulo: 'Telefone fixo', largura: 4, valor: c.telefone,
                   erro: erros.telefone,
                   placeholder: '(11) 3000-0000', atributos: ' inputmode="numeric"' })) +

      secao('Endereço',
        ui.Field({ nome: 'cep', rotulo: 'CEP', largura: 3, valor: end.cep, erro: erros.cep,
                   placeholder: '00000-000', atributos: ' inputmode="numeric"' }) +
        ui.Field({ nome: 'logradouro', rotulo: 'Logradouro', largura: 6,
                   valor: end.logradouro }) +
        ui.Field({ nome: 'numero', rotulo: 'Número', largura: 3, valor: end.numero }) +
        ui.Field({ nome: 'complemento', rotulo: 'Complemento', largura: 4,
                   valor: end.complemento }) +
        ui.Field({ nome: 'bairro', rotulo: 'Bairro', largura: 8, valor: end.bairro }) +
        ui.Field({ nome: 'cidade', rotulo: 'Cidade', largura: 8, valor: end.cidade }) +
        ui.Field({ nome: 'uf', rotulo: 'UF', tipo: 'combo', largura: 4,
                   opcoes: enums.opcoes(
                     validators.UFS.map(function (uf) { return { id: uf, label: uf }; }),
                     end.uf || 'SP') })) +

      secao('Relacionamento',
        ui.Field({ nome: 'origem', rotulo: 'Como chegou até o escritório', tipo: 'combo',
                   largura: 4,
                   opcoes: enums.opcoes(enums.ORIGENS_CLIENTE, c.origem, 'Não informado') }) +
        ui.Field({ nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', linhas: 3,
                   valor: c.observacoes,
                   dica: 'O que a equipe precisa saber antes de ligar' }));
  }

  /**
   * Liga máscaras e a troca de campos por tipo.
   * @param {Element} raiz  o que CONTÉM o formulário (corpo do modal ou página)
   */
  ClienteForm.mount = function (raiz) {
    /* Tipo, UF e origem são combos, não `<select>` nativos: mesmo gesto do
       filtro da lista, mesma roupa. Quem lê o valor continua lendo um campo
       com `name` — o input escondido que o combo carrega. */
    App.components.Combo.mount(raiz);

    var campo = function (nome) { return App.dom.qs('[name="' + nome + '"]', raiz); };
    var campoTipo = campo('tipo');
    var campoDoc = campo('documento');
    if (!campoTipo || !campoDoc) return;

    App.mask.aplicar(campoDoc, App.mask.documento);
    App.mask.aplicar(campo('celular'), App.mask.telefone);
    App.mask.aplicar(campo('telefone'), App.mask.telefone);
    App.mask.aplicar(campo('cep'), App.mask.cep);

    /* Some o `.field` inteiro, e não só o controle: rótulo órfão pairando
       sobre nada é pior do que o campo que não se aplica. */
    function mostrar(nome, visivel) {
      var alvo = campo(nome);
      if (alvo) alvo.closest('.field').classList.toggle('u-hidden', !visivel);
    }

    function aplicarTipo() {
      var pj = campoTipo.value === 'PJ';
      campoDoc.placeholder = pj ? '00.000.000/0000-00' : '000.000.000-00';
      SO_PJ.forEach(function (n) { mostrar(n, pj); });
      SO_PF.forEach(function (n) { mostrar(n, !pj); });
    }

    campoTipo.addEventListener('change', aplicarTipo);
    aplicarTipo();
  };

  /**
   * Pinta os erros nos campos: destaca o `.field` e escreve a mensagem na
   * caixa que `ui.Field` já deixa pronta embaixo de cada um.
   *
   * Marcar no lugar de redesenhar é o que preserva o que a pessoa acabou de
   * digitar — e o foco, que vai para o primeiro campo com problema.
   */
  ClienteForm.marcarErros = function (raiz, erros) {
    App.dom.qsa('.field--invalid', raiz).forEach(function (campo) {
      campo.classList.remove('field--invalid');
    });
    App.dom.qsa('[data-erro-de]', raiz).forEach(function (caixa) {
      caixa.classList.add('u-hidden');
      caixa.textContent = '';
    });

    var primeiro = null;
    Object.keys(erros || {}).forEach(function (nome) {
      var campo = App.dom.qs('[name="' + nome + '"]', raiz);
      var caixa = App.dom.qs('[data-erro-de="' + nome + '"]', raiz);
      if (campo) {
        campo.closest('.field').classList.add('field--invalid');
        if (!primeiro) primeiro = campo;
      }
      if (caixa) {
        caixa.textContent = erros[nome];
        caixa.classList.remove('u-hidden');
      }
    });

    if (primeiro && primeiro.focus) primeiro.focus();
  };

  /**
   * Lê e valida.
   * @returns {{valido: boolean, erros: Object, primeiroErro: string, dados: Object}}
   *          `dados` só vem quando válido, já pronto para `criar`/`atualizar`.
   */
  ClienteForm.ler = function (raiz) {
    var v = App.domain.validators;
    var form = App.dom.qs('#' + ID, raiz);
    var d = App.dom.formToObject(form);
    var pj = d.tipo === 'PJ';

    var validacao = v.validarFormulario(d, {
      nome: function (valor) { return v.obrigatorio(valor, 'Nome'); },
      documento: function (valor) { return v.documento(valor, d.tipo); },
      /* Contato e CEP são opcionais — mas preenchidos errado, não. Os
         validadores de telefone e CEP já deixam vazio passar; o de e-mail
         exige valor, então a folga fica aqui. */
      email: function (valor) { return valor ? v.email(valor) : v.ok(); },
      celular: function (valor) { return v.telefone(valor); },
      telefone: function (valor) { return v.telefone(valor); },
      cep: function (valor) { return v.cep(valor); }
    });

    if (!validacao.valido) {
      return {
        valido: false,
        erros: validacao.erros,
        primeiroErro: validacao.erros[Object.keys(validacao.erros)[0]]
      };
    }

    var texto = function (valor) { return String(valor || '').trim(); };

    return {
      valido: true,
      erros: {},
      dados: {
        tipo: d.tipo,
        nome: texto(d.nome),
        /* O campo escondido continua no formulário e continua sendo lido:
           o tipo é quem decide o que vai para o registro. Sem isso, mudar
           PJ para PF deixaria o nome fantasia antigo pendurado. */
        nomeFantasia: pj ? texto(d.nomeFantasia) : '',
        documento: App.mask.so(d.documento),
        rg: pj ? '' : texto(d.rg),
        dataNascimento: !pj && d.dataNascimento ? d.dataNascimento : null,
        email: texto(d.email),
        telefone: App.mask.so(d.telefone),
        celular: App.mask.so(d.celular),
        origem: d.origem || '',
        observacoes: texto(d.observacoes),
        endereco: {
          cep: App.mask.so(d.cep),
          logradouro: texto(d.logradouro),
          numero: texto(d.numero),
          complemento: texto(d.complemento),
          bairro: texto(d.bairro),
          cidade: texto(d.cidade),
          uf: d.uf
        }
      }
    };
  };

  ClienteForm.ID = ID;

  App.components.ClienteForm = ClienteForm;
})(window.App = window.App || {});
