/* ==========================================================================
   pages/ClienteFormPage.js — edição do cadastro do cliente

   O cadastro nascia num modal e não tinha volta: quem errava um dígito do
   CEP, ou precisava acrescentar o telefone que o cliente deu depois, não
   tinha por onde. `clienteService.atualizar` existia desde a fase 1 e nunca
   havia sido chamado por ninguém.

   Tela e não modal: são dezoito campos, e no celular um modal com dezoito
   campos vira uma coluna rolando dentro de outra coluna rolando.

   Os campos vêm de `components/ClienteForm` — os mesmos do cadastro, pelo
   mesmo código.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var cliente = null;

  function esc(v) { return App.dom.esc(v); }

  function render(elemento, params) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 8 });

    App.services.clienteService.obter(params.id).then(function (c) {
      cliente = c;
      desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠',
        titulo: 'Cliente não encontrado',
        texto: erro.message,
        acao: App.components.ui.Button({ rotulo: 'Voltar', variante: 'primary',
                                         href: '#/clientes' })
      });
    });
  }

  function desenhar() {
    var ui = App.components.ui;
    var voltar = '#/clientes/' + cliente.id;

    container.innerHTML =
      '<div class="breadcrumb">' +
        '<a href="#/clientes">Clientes</a>' +
        '<span class="breadcrumb__sep">/</span>' +
        '<a href="' + esc(voltar) + '">' +
          esc(App.format.truncar(cliente.nome, 40)) + '</a>' +
        '<span class="breadcrumb__sep">/</span><span>Editar</span>' +
      '</div>' +

      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Editar cliente</h1>' +
          '<p class="page-header__subtitle">Alterando ' + esc(cliente.nome) + '</p>' +
        '</div>' +
      '</div>' +

      /* O formulário É o cartão, como no de processo: assim o rodapé com os
         botões gruda embaixo (`position: sticky`) sem sair de dentro do
         `<form>` — botão de submit fora do formulário não submete nada. */
      '<form id="' + App.components.ClienteForm.ID + '" class="card form-page" novalidate>' +
        '<div class="card__body">' +
          App.components.ClienteForm({ cliente: cliente }) +
        '</div>' +
        '<div class="form-actions">' +
          ui.Button({ rotulo: 'Cancelar', variante: 'secondary', href: voltar }) +
          ui.Button({ rotulo: 'Salvar alterações', variante: 'primary',
                      tipo: 'submit', id: 'btn-salvar' }) +
        '</div>' +
      '</form>';

    ligarEventos();
  }

  function ligarEventos() {
    App.components.ClienteForm.mount(container);

    var form = App.dom.qs('#' + App.components.ClienteForm.ID, container);
    form.addEventListener('submit', function (evento) {
      evento.preventDefault();
      salvar();
    });
  }

  function salvar() {
    var leitura = App.components.ClienteForm.ler(container);

    if (!leitura.valido) {
      /* Marcar em vez de redesenhar: o que a pessoa digitou continua na
         tela, e o foco vai para o primeiro campo com problema. */
      App.components.ClienteForm.marcarErros(container, leitura.erros);
      App.components.Toast.aviso('Verifique os campos destacados', leitura.primeiroErro);
      return;
    }

    var botao = App.dom.qs('#btn-salvar', container);
    if (botao) botao.disabled = true;

    App.services.clienteService.atualizar(cliente.id, leitura.dados)
      .then(function (salvo) {
        App.components.Toast.sucesso('Cliente atualizado', salvo.nome);
        App.router.ir('#/clientes/' + salvo.id);
      })
      .catch(function (erro) {
        if (botao) botao.disabled = false;
        App.components.Toast.erro('Não foi possível salvar', erro.message);
      });
  }

  App.pages.ClienteFormPage = { render: render };
})(window.App = window.App || {});
