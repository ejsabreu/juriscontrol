/* ==========================================================================
   pages/ConfiguracoesPage.js — administração

   Duas abas em F2.1: usuários e a matriz de permissões.

   A matriz é exibida como GRADE, e não como texto, de propósito: o valor de
   uma tela de permissões é enxergar a linha inteira de um perfil e a coluna
   inteira de um recurso ao mesmo tempo. É também a prova visível de que
   `domain/permissoes.js` está aplicado — a grade é lida da mesma fonte que o
   sistema consulta, não de uma cópia.

   F2.10 acrescenta aqui: escritório, feriados locais, tipos de prazo,
   integrações e preferências.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var aba = 'usuarios';
  var usuarios = [];

  function esc(v) { return App.dom.esc(v); }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });
    ligarEventos();
    carregar();
  }

  var regras = [];

  function carregar() {
    usuarios = App.services.db.getTodos('usuarios');
    regras = App.services.regraAlertaService.vigentes();
    desenhar();
  }

  // --- Aba: alertas (F2.2) ---------------------------------------------------

  var ROTULO_GATILHO = {
    prazo: 'Prazos processuais',
    compromisso: 'Audiências e compromissos',
    tarefa: 'Tarefas',
    publicacao: 'Publicações do diário',
    financeiro: 'Títulos a vencer',
    follow_up: 'Follow-up de leads'
  };

  /* Prazo conta em dias ÚTEIS (art. 219 do CPC, o mesmo motor do sistema);
     o resto conta em dias corridos. Dizer isso na tela evita a pergunta. */
  var UNIDADE = {
    prazo: 'dias úteis',
    compromisso: 'dias corridos',
    tarefa: 'dias corridos',
    publicacao: 'dias corridos',
    financeiro: 'dias corridos',
    follow_up: 'dias corridos'
  };

  var ANTECEDENCIAS = [10, 7, 5, 3, 2, 1, 0];

  function linhaRegra(regra) {
    var marcados = regra.antecedenciaDias || [];

    var dias = ANTECEDENCIAS.map(function (d) {
      var ativo = marcados.indexOf(d) !== -1;
      return '<label class="chip-check' + (ativo ? ' chip-check--on' : '') + '">' +
               '<input type="checkbox" data-action="antecedencia"' +
                 ' data-gatilho="' + esc(regra.gatilho) + '" data-dia="' + d + '"' +
                 (ativo ? ' checked' : '') + '>' +
               '<span>' + (d === 0 ? 'no dia' : 'D−' + d) + '</span>' +
             '</label>';
    }).join('');

    var canais = ['app', 'email'].map(function (c) {
      var ativo = (regra.canais || []).indexOf(c) !== -1;
      return '<label class="chip-check' + (ativo ? ' chip-check--on' : '') + '">' +
               '<input type="checkbox" data-action="canal"' +
                 ' data-gatilho="' + esc(regra.gatilho) + '" data-canal="' + c + '"' +
                 (ativo ? ' checked' : '') + '>' +
               '<span>' + (c === 'app' ? 'no sino' : 'e-mail') + '</span>' +
             '</label>';
    }).join('');

    return '<tr>' +
      '<td>' +
        '<div class="u-bold">' + esc(ROTULO_GATILHO[regra.gatilho] || regra.gatilho) + '</div>' +
        '<div class="u-xs u-subtle">contagem em ' + esc(UNIDADE[regra.gatilho] || 'dias') + '</div>' +
      '</td>' +
      '<td><div class="chip-row">' + dias + '</div></td>' +
      '<td><div class="chip-row">' + canais + '</div></td>' +
      '<td class="u-right">' +
        '<label class="checkbox"><input type="checkbox" data-action="regra-ativa"' +
          ' data-gatilho="' + esc(regra.gatilho) + '"' +
          (regra.ativo !== false ? ' checked' : '') + '><span>ativa</span></label>' +
      '</td>' +
    '</tr>';
  }

  function abaAlertas() {
    var ui = App.components.ui;
    var exige = App.services.regraAlertaService.exigeDuplaConferencia();
    var usandoPadrao = regras.length > 0 && regras[0].padrao;

    return ui.Card({
      titulo: 'Regras de alerta',
      subtitulo: usandoPadrao ? 'usando os padrões do sistema' : 'personalizadas',
      acoes: usandoPadrao ? '' : ui.Button({
        rotulo: 'Restaurar padrões', tamanho: 'sm', variante: 'ghost', acao: 'restaurar-regras'
      }),
      conteudo:
        '<p class="u-sm u-muted">Quando cada aviso é disparado e por onde ele sai. ' +
        'O avaliador roda ao abrir o sistema e a cada 5 minutos; repetir a avaliação ' +
        'no mesmo dia não gera aviso duplicado.</p>' +
        '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Gatilho</th><th>Antecedência</th><th>Canais</th><th class="u-right">Situação</th>' +
        '</tr></thead><tbody>' + regras.map(linhaRegra).join('') + '</tbody></table></div>' +

        App.components.SeloSimulado({
          forma: 'linha',
          oque: 'o canal "e-mail" não envia nada — as mensagens vão para a caixa de saída.',
          naFase3: 'envio real por SMTP, com o mesmo gatilho e o mesmo texto.'
        }) +

        '<h4 class="u-sm u-bold" style="margin-top:var(--space-5)">Dupla conferência de prazo</h4>' +
        '<p class="u-sm u-muted">Com a trava ligada, todo prazo baixado fica marcado como ' +
        '<em>aguardando conferência</em> até que <strong>outra pessoa</strong> confirme. ' +
        'É o que o seguro de responsabilidade civil do escritório costuma exigir — e o ' +
        'sistema recusa a conferência de quem executou a baixa, não apenas esconde o botão.</p>' +
        '<label class="checkbox" style="margin-top:var(--space-2)">' +
          '<input type="checkbox" data-action="dupla-conferencia"' + (exige ? ' checked' : '') + '>' +
          '<span>Exigir conferência de um segundo usuário</span>' +
        '</label>'
    });
  }

  // --- Aba: usuários ---------------------------------------------------------

  function linhaUsuario(usuario) {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var permissoes = App.domain.permissoes;
    var inativo = usuario.ativo === false;
    var eu = App.services.sessaoService.atual();
    var souEu = eu && eu.id === usuario.id;

    var recursos = permissoes.recursosDe(usuario.perfil);
    var total = recursos.indexOf('*') !== -1
      ? enums.RECURSOS_PERMISSAO.length : recursos.length;

    return '<tr' + (inativo ? ' class="u-dim"' : '') + '>' +
      '<td>' +
        '<div class="u-row" style="gap:var(--space-2)">' +
          ui.Avatar({ usuario: usuario, tamanho: 'sm' }) +
          '<div>' +
            '<div class="u-bold">' + esc(usuario.nome) +
              (souEu ? ' <span class="u-xs u-subtle">(você)</span>' : '') + '</div>' +
            '<div class="u-xs u-subtle">' + esc(usuario.email || '—') + '</div>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td>' +
        '<select class="select select--sm" data-action="mudar-perfil" data-value="' +
          esc(usuario.id) + '"' + (souEu ? ' disabled title="Não é possível mudar o próprio perfil"' : '') + '>' +
          enums.opcoes(enums.PERFIS, usuario.perfil) +
        '</select>' +
      '</td>' +
      '<td class="u-sm">' +
        (usuario.oab ? 'OAB/' + esc(usuario.oab.uf) + ' ' + esc(usuario.oab.numero) : '—') +
      '</td>' +
      '<td class="u-sm u-tabular">' + total + ' / ' + enums.RECURSOS_PERMISSAO.length + '</td>' +
      '<td>' +
        (inativo ? ui.Badge({ rotulo: 'Inativo', variante: 'neutral' })
                 : ui.Badge({ rotulo: 'Ativo', variante: 'success' })) +
      '</td>' +
      '<td class="u-right">' +
        ui.Button({
          rotulo: inativo ? 'Reativar' : 'Desativar',
          tamanho: 'sm', variante: 'ghost',
          acao: inativo ? 'reativar' : 'desativar',
          valor: usuario.id,
          desabilitado: souEu,
          titulo: souEu ? 'Não é possível desativar a si mesmo' : ''
        }) +
      '</td>' +
    '</tr>';
  }

  function abaUsuarios() {
    var ui = App.components.ui;

    return ui.Card({
      titulo: 'Usuários do escritório',
      subtitulo: usuarios.length + ' cadastrado(s)',
      conteudo:
        '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Usuário</th><th>Perfil</th><th>OAB</th><th>Permissões</th>' +
          '<th>Situação</th><th></th>' +
        '</tr></thead><tbody>' + usuarios.map(linhaUsuario).join('') + '</tbody></table></div>',
      semPadding: true
    });
  }

  // --- Aba: perfis e permissões ---------------------------------------------

  function abaPermissoes() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var permissoes = App.domain.permissoes;
    var perfis = enums.PERFIS;

    // Agrupa por `grupo` para a grade não virar uma lista de 17 linhas soltas.
    var grupos = {};
    enums.RECURSOS_PERMISSAO.forEach(function (r) {
      (grupos[r.grupo] = grupos[r.grupo] || []).push(r);
    });

    var corpo = '';
    Object.keys(grupos).forEach(function (grupo) {
      corpo += '<tr class="perm__group"><th colspan="' + (perfis.length + 1) + '">' +
                 esc(grupo) + '</th></tr>';

      grupos[grupo].forEach(function (recurso) {
        corpo += '<tr><td class="perm__resource">' + esc(recurso.label) +
                 '<code class="perm__id">' + esc(recurso.id) + '</code></td>';

        perfis.forEach(function (perfil) {
          var tem = permissoes.pode({ perfil: perfil.id }, recurso.id);
          corpo += '<td class="perm__cell">' +
                     '<span class="perm__mark perm__mark--' + (tem ? 'sim' : 'nao') + '"' +
                       ' title="' + esc(perfil.label + (tem ? ': permitido' : ': negado')) + '">' +
                       (tem ? '✔' : '·') +
                     '</span>' +
                   '</td>';
        });
        corpo += '</tr>';
      });
    });

    var cabecalho = '<tr><th>Recurso</th>' +
      perfis.map(function (p) {
        return '<th class="perm__profile">' + esc(p.label) + '</th>';
      }).join('') + '</tr>';

    return ui.Card({
      titulo: 'Matriz de permissões',
      subtitulo: 'somente leitura neste protótipo',
      conteudo:
        '<p class="u-sm u-muted">A grade é lida de <code>domain/permissoes.js</code> — ' +
        'a mesma fonte que o sistema consulta para esconder menu, bloquear rota e ' +
        'filtrar processo em segredo de justiça. Não é uma cópia da documentação.</p>' +
        App.components.SeloSimulado({
          forma: 'linha',
          oque: 'a checagem roda apenas no navegador, porque não existe servidor.',
          naFase3: 'a mesma matriz aplicada no servidor — permissão conferida só no ' +
                   'cliente não é permissão.'
        }) +
        '<div class="table-wrap"><table class="table perm"><thead>' + cabecalho +
        '</thead><tbody>' + corpo + '</tbody></table></div>' +
        '<h4 class="u-sm u-bold" style="margin-top:var(--space-5)">Segredo de justiça</h4>' +
        '<p class="u-sm u-muted">Independe da grade: o processo em segredo aparece para ' +
        'quem tem <code>processos.segredo</code> (administrador e sócio) <strong>ou</strong> ' +
        'para quem é o responsável ou está na equipe dele. É a regra do processo, não a ' +
        'do cargo — por isso a checagem mora no service e não na tela.</p>',
      semPadding: false
    });
  }

  function desenhar() {
    var ui = App.components.ui;

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Configurações</h1>' +
          '<p class="page-header__subtitle">Usuários, perfis e controle de acesso</p>' +
        '</div>' +
      '</div>' +
      ui.Tabs({
        ativa: aba,
        abas: [
          { id: 'usuarios', label: 'Usuários', contador: usuarios.length },
          { id: 'permissoes', label: 'Perfis e permissões' },
          { id: 'alertas', label: 'Alertas e prazos' }
        ]
      }) +
      '<div class="page-section">' +
        (aba === 'usuarios' ? abaUsuarios()
         : aba === 'permissoes' ? abaPermissoes()
         : abaAlertas()) +
      '</div>';
  }

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="trocar-aba"]', function (evento, alvo) {
      aba = alvo.getAttribute('data-value');
      desenhar();
    });

    App.dom.delegate(container, 'change', '[data-action="mudar-perfil"]',
      function (evento, alvo) {
        var id = alvo.getAttribute('data-value');
        var perfil = alvo.value;
        App.services.db.update('usuarios', id, { perfil: perfil });
        App.components.Toast.sucesso('Perfil alterado',
          'As permissões passam a valer na próxima tela aberta.');
        carregar();
      });

    App.dom.delegate(container, 'click', '[data-action="desativar"]', function (evento, alvo) {
      var id = alvo.getAttribute('data-value');
      App.components.Modal.confirmar({
        titulo: 'Desativar usuário',
        mensagem: 'O usuário deixa de aparecer na tela de entrada e nas atribuições.',
        detalhe: 'Nada é apagado — os registros feitos por ele permanecem, inclusive na ' +
                 'trilha de auditoria.',
        rotuloConfirmar: 'Desativar',
        variante: 'danger'
      }).then(function (confirmado) {
        if (!confirmado) return;
        App.services.db.remove('usuarios', id);
        App.components.Toast.sucesso('Usuário desativado');
        carregar();
      });
    });

    App.dom.delegate(container, 'click', '[data-action="reativar"]', function (evento, alvo) {
      App.services.db.update('usuarios', alvo.getAttribute('data-value'), { ativo: true });
      App.components.Toast.sucesso('Usuário reativado');
      carregar();
    });

    // --- Alertas (F2.2) ---
    function regraDe(gatilho) {
      return regras.filter(function (r) { return r.gatilho === gatilho; })[0];
    }

    App.dom.delegate(container, 'change', '[data-action="antecedencia"]',
      function (evento, alvo) {
        var gatilho = alvo.getAttribute('data-gatilho');
        var dia = parseInt(alvo.getAttribute('data-dia'), 10);
        var regra = regraDe(gatilho);
        if (!regra) return;

        var lista = (regra.antecedenciaDias || []).slice();
        var i = lista.indexOf(dia);
        if (alvo.checked && i === -1) lista.push(dia);
        if (!alvo.checked && i !== -1) lista.splice(i, 1);
        lista.sort(function (a, b) { return b - a; });

        App.services.regraAlertaService.salvar(gatilho, { antecedenciaDias: lista })
          .then(carregar);
      });

    App.dom.delegate(container, 'change', '[data-action="canal"]', function (evento, alvo) {
      var gatilho = alvo.getAttribute('data-gatilho');
      var canal = alvo.getAttribute('data-canal');
      var regra = regraDe(gatilho);
      if (!regra) return;

      var lista = (regra.canais || []).slice();
      var i = lista.indexOf(canal);
      if (alvo.checked && i === -1) lista.push(canal);
      if (!alvo.checked && i !== -1) lista.splice(i, 1);

      App.services.regraAlertaService.salvar(gatilho, { canais: lista }).then(carregar);
    });

    App.dom.delegate(container, 'change', '[data-action="regra-ativa"]', function (evento, alvo) {
      App.services.regraAlertaService
        .salvar(alvo.getAttribute('data-gatilho'), { ativo: alvo.checked })
        .then(carregar);
    });

    App.dom.delegate(container, 'click', '[data-action="restaurar-regras"]', function () {
      App.services.regraAlertaService.restaurarPadrao().then(function () {
        App.components.Toast.sucesso('Regras restauradas', 'Os padrões do sistema voltaram a valer.');
        carregar();
      });
    });

    App.dom.delegate(container, 'change', '[data-action="dupla-conferencia"]',
      function (evento, alvo) {
        App.services.regraAlertaService.definirDuplaConferencia(alvo.checked).then(function () {
          App.components.Toast.sucesso(
            alvo.checked ? 'Dupla conferência exigida' : 'Dupla conferência desligada',
            alvo.checked
              ? 'Prazos baixados passam a aguardar confirmação de outra pessoa.'
              : 'Prazos baixados ficam cumpridos sem conferência.');
          carregar();
        });
      });
  }

  App.pages.ConfiguracoesPage = { render: render };
})(window.App = window.App || {});
