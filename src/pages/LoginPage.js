/* ==========================================================================
   pages/LoginPage.js — entrada no sistema

   Rota SEM CASCA: sem sidebar e sem topbar. É a primeira das duas telas do
   sistema que se renderizam fora do shell (a outra é o portal do cliente,
   em F2.3).

   O selo aqui não é formalidade: escolher um usuário de uma lista não é
   autenticação, e quem estiver demonstrando o protótipo precisa saber
   disso antes de tirar conclusão sobre segurança. O que vem DEPOIS da
   escolha — a matriz de permissões — esse é real.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var usuarios = [];
  var selecionado = null;
  var entrando = false;

  function esc(v) { return App.dom.esc(v); }

  function render(elemento) {
    container = elemento;

    /* O módulo é um singleton, mas a TELA é remontada a cada visita — e sair
       do sistema traz o usuário de volta para cá. A `entrando` do login
       anterior ficou ligada (o sucesso navega para dentro do sistema e nunca
       a desliga), então sem zerar aqui a tela renasce com o botão em
       "Entrando…" e desabilitado, e a guarda de `entrar()` recusa o clique:
       só o F5 destravava. Montagem zera estado de montagem. */
    usuarios = [];
    selecionado = null;
    entrando = false;

    container.innerHTML = App.components.ui.Skeleton({ linhas: 4 });
    ligarEventos();
    carregar();
  }

  function carregar() {
    App.services.sessaoService.listarUsuarios().then(function (lista) {
      usuarios = lista;
      selecionado = lista[0] ? lista[0].id : null;
      desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Não foi possível carregar os usuários', texto: erro.message
      });
    });
  }

  function cartaoUsuario(usuario) {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var ativo = usuario.id === selecionado;
    var recursos = App.domain.permissoes.recursosDe(usuario.perfil);
    var totalRecursos = recursos.indexOf('*') !== -1
      ? enums.RECURSOS_PERMISSAO.length
      : recursos.length;

    return '<button type="button" class="login__user' + (ativo ? ' login__user--active' : '') + '"' +
             ' data-action="selecionar-usuario" data-value="' + esc(usuario.id) + '"' +
             ' aria-pressed="' + ativo + '">' +
             ui.Avatar({ usuario: usuario, tamanho: 'lg' }) +
             '<span class="login__user-info">' +
               '<span class="login__user-name">' + esc(usuario.nome) + '</span>' +
               '<span class="login__user-role">' +
                 esc(enums.rotulo(enums.PERFIS, usuario.perfil)) +
                 (usuario.oab ? ' · OAB/' + esc(usuario.oab.uf) + ' ' + esc(usuario.oab.numero) : '') +
               '</span>' +
               '<span class="login__user-perms">' + totalRecursos + ' de ' +
                 enums.RECURSOS_PERMISSAO.length + ' permissões</span>' +
             '</span>' +
           '</button>';
  }

  function desenhar() {
    var ui = App.components.ui;

    container.innerHTML =
      '<div class="login">' +
        '<div class="login__card">' +

          '<div class="login__brand">' +
            '<span class="login__logo" aria-hidden="true">JC</span>' +
            '<div>' +
              '<h1 class="login__title">JurisControl</h1>' +
              '<p class="login__tagline">Controle de processos judiciais</p>' +
            '</div>' +
          '</div>' +

          App.components.SeloSimulado({
            oque: 'Não há autenticação: entrar é escolher um usuário da lista, sem senha.',
            detalhe: 'O que vem depois é real — cada perfil enxerga e faz apenas o que a ' +
                     'matriz de permissões autoriza, inclusive nos processos em segredo de justiça.',
            naFase3: 'e-mail e senha contra POST /api/sessao, com token de sessão assinado.'
          }) +

          '<p class="login__hint">Escolha o perfil para explorar o sistema com as permissões dele:</p>' +

          '<div class="login__users">' +
            usuarios.map(cartaoUsuario).join('') +
          '</div>' +

          '<div class="login__actions">' +
            ui.Button({
              rotulo: entrando ? 'Entrando…' : 'Entrar',
              variante: 'primary',
              bloco: true,
              acao: 'entrar',
              desabilitado: !selecionado || entrando
            }) +
          '</div>' +

          // O selo acima fala da autenticação; este aviso fala dos DADOS.
          // São coisas diferentes, e quem recebe o link público precisa das
          // duas antes de confundir o protótipo com um sistema em produção.
          '<p class="login__aviso">' +
            'Protótipo de demonstração. Clientes, processos, prazos e documentos são ' +
            'fictícios, e tudo o que você alterar fica apenas no seu navegador.' +
          '</p>' +

        '</div>' +
      '</div>';
  }

  /* Trocar o usuário escolhido NÃO redesenha a tela. `innerHTML` destrói e
     recria tudo, e com isso o navegador manda a rolagem de volta para o topo
     e apaga o foco do botão que acabou de ser clicado — num celular, onde a
     lista de usuários não cabe inteira, o clique no último cartão jogava a
     tela para cima. Só o que muda de estado é atualizado no lugar. */
  function atualizarSelecao() {
    var cartoes = container.querySelectorAll('[data-action="selecionar-usuario"]');
    for (var i = 0; i < cartoes.length; i++) {
      var ativo = cartoes[i].getAttribute('data-value') === selecionado;
      cartoes[i].classList.toggle('login__user--active', ativo);
      cartoes[i].setAttribute('aria-pressed', ativo);
    }

    var botao = container.querySelector('[data-action="entrar"]');
    if (botao) botao.disabled = !selecionado || entrando;
  }

  function entrar() {
    if (!selecionado || entrando) return;
    entrando = true;
    desenhar();

    App.services.sessaoService.entrar(selecionado).then(function (r) {
      App.components.Toast.sucesso('Bem-vindo(a)',
        r.usuario.nome + ' · ' +
        App.domain.enums.rotulo(App.domain.enums.PERFIS, r.usuario.perfil));
      App.router.ir('#/');
    }).catch(function (erro) {
      entrando = false;
      desenhar();
      App.components.Toast.erro('Não foi possível entrar', erro.message);
    });
  }

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="selecionar-usuario"]',
      function (evento, alvo) {
        selecionado = alvo.getAttribute('data-value');
        atualizarSelecao();
      });

    App.dom.delegate(container, 'click', '[data-action="entrar"]', entrar);

    // Enter entra direto — a tela tem uma decisão só.
    App.dom.delegate(container, 'keydown', '.login', function (evento) {
      if (evento.key === 'Enter') entrar();
    });
  }

  App.pages.LoginPage = { render: render };
})(window.App = window.App || {});
