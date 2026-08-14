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
  var aba = 'escritorio';
  var usuarios = [];
  var regras = [];
  var feriados = [];
  var tipos = [];
  var escritorio = {};
  var preferencias = {};

  /* Estado da importação: `conferencia` é o relatório devolvido pelo service
     e é o que autoriza a gravação. Enquanto for null, não há o que importar. */
  var layoutImportacao = 'processos';
  var conferencia = null;
  var conferindo = false;

  function esc(v) { return App.dom.esc(v); }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });
    ligarEventos();
    carregar();
  }

  function carregar() {
    var cfg = App.services.configuracaoService;
    var eu = App.services.sessaoService.atual();

    usuarios = App.services.db.getTodos('usuarios');
    regras = App.services.regraAlertaService.vigentes();
    feriados = cfg.feriadosLocais();
    tipos = cfg.tiposPrazo();
    escritorio = cfg.escritorio();
    preferencias = eu ? cfg.preferencias(eu.id) : {};
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
    }) + '<div class="page-section">' + cartaoTiposPrazo() + '</div>';
  }

  // --- Tipos de prazo (F2.10) ------------------------------------------------

  function cartaoTiposPrazo() {
    var ui = App.components.ui;

    var linhas = tipos.map(function (t) {
      return '<tr>' +
        '<td>' + esc(t.label) +
          (t.doEscritorio
            ? ' <span class="u-xs u-subtle">(do escritório)</span>'
            : '') + '</td>' +
        '<td class="u-tabular u-sm">' + t.dias + '</td>' +
        '<td class="u-sm">' + (t.contagem === 'corridos' ? 'dias corridos' : 'dias úteis') + '</td>' +
        '<td class="u-right">' +
          (t.doEscritorio
            ? ui.Button({ rotulo: 'Remover', tamanho: 'sm', variante: 'ghost',
                          acao: 'remover-tipo-prazo', valor: t.id })
            : '<span class="u-xs u-subtle">padrão do sistema</span>') +
        '</td>' +
      '</tr>';
    }).join('');

    return ui.Card({
      titulo: 'Tipos de prazo',
      subtitulo: tipos.length + ' disponível(is)',
      conteudo:
        '<p class="u-sm u-muted">Os padrões vêm do CPC e não podem ser removidos — há ' +
        'prazos gravados apontando para eles. Os que o escritório criar entram na mesma ' +
        'lista, com a mesma contagem.</p>' +
        '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Tipo</th><th>Dias</th><th>Contagem</th><th></th>' +
        '</tr></thead><tbody>' + linhas + '</tbody></table></div>' +

        '<h4 class="u-sm u-bold" style="margin-top:var(--space-5)">Criar tipo</h4>' +
        '<div class="form-grid" id="form-tipo-prazo">' +
          ui.Field({ nome: 'label', rotulo: 'Nome', obrigatorio: true,
                     placeholder: 'Manifestação sobre laudo' }) +
          ui.Field({ nome: 'dias', rotulo: 'Dias', tipo: 'number', obrigatorio: true,
                     valor: 15 }) +
          ui.Field({ nome: 'contagem', rotulo: 'Contagem', tipo: 'select',
                     opcoes: '<option value="uteis">dias úteis (art. 219 do CPC)</option>' +
                             '<option value="corridos">dias corridos</option>' }) +
        '</div>' +
        ui.Button({ rotulo: 'Adicionar tipo', variante: 'primary', acao: 'criar-tipo-prazo' })
    });
  }

  // --- Aba: escritório e preferências (F2.10) --------------------------------

  function abaEscritorio() {
    var ui = App.components.ui;
    var eu = App.services.sessaoService.atual();

    var dados = ui.Card({
      titulo: 'Dados do escritório',
      subtitulo: 'aparecem em contrato, proposta e boleto',
      acoes: ui.Button({ rotulo: 'Salvar', tamanho: 'sm', variante: 'primary',
                         acao: 'salvar-escritorio' }),
      conteudo:
        '<div class="form-grid" id="form-escritorio">' +
          ui.Field({ nome: 'nome', rotulo: 'Razão social', valor: escritorio.nome,
                     obrigatorio: true, largura: 'full' }) +
          ui.Field({ nome: 'cnpj', rotulo: 'CNPJ', valor: escritorio.cnpj,
                     placeholder: '00.000.000/0001-00',
                     dica: 'conferido pelo dígito verificador' }) +
          ui.Field({ nome: 'oab', rotulo: 'Registro OAB da sociedade',
                     valor: escritorio.oab, placeholder: 'OAB/SP 12.345' }) +
          ui.Field({ nome: 'email', rotulo: 'E-mail', tipo: 'email', valor: escritorio.email }) +
          ui.Field({ nome: 'telefone', rotulo: 'Telefone', valor: escritorio.telefone }) +
          ui.Field({ nome: 'endereco', rotulo: 'Endereço', valor: escritorio.endereco,
                     largura: 'full' }) +
        '</div>'
    });

    var minhas = ui.Card({
      titulo: 'Minhas preferências',
      subtitulo: eu ? esc(eu.nome) : '',
      acoes: ui.Button({ rotulo: 'Salvar', tamanho: 'sm', variante: 'secondary',
                         acao: 'salvar-preferencias' }),
      conteudo:
        '<p class="u-sm u-muted">Valem apenas para você — cada usuário tem as suas.</p>' +
        '<div class="form-grid" id="form-preferencias">' +
          ui.Field({ nome: 'telaInicial', rotulo: 'Abrir o sistema em', tipo: 'select',
                     opcoes: [
                       { v: '#/', r: 'Painel' },
                       { v: '#/processos', r: 'Processos' },
                       { v: '#/agenda', r: 'Agenda e prazos' },
                       { v: '#/tarefas', r: 'Tarefas' },
                       { v: '#/publicacoes', r: 'Publicações' }
                     ].map(function (o) {
                       return '<option value="' + o.v + '"' +
                              (preferencias.telaInicial === o.v ? ' selected' : '') +
                              '>' + o.r + '</option>';
                     }).join('') }) +
          ui.Field({ nome: 'itensPorPagina', rotulo: 'Itens por página', tipo: 'select',
                     opcoes: [10, 15, 25, 50].map(function (n) {
                       return '<option value="' + n + '"' +
                              (Number(preferencias.itensPorPagina) === n ? ' selected' : '') +
                              '>' + n + '</option>';
                     }).join('') }) +
        '</div>'
    });

    return dados + '<div class="page-section">' + minhas + '</div>';
  }

  // --- Aba: feriados locais (F2.10) ------------------------------------------

  function linhaFeriado(f) {
    var ui = App.components.ui;
    return '<tr>' +
      '<td class="u-tabular">' + esc(App.format.data(f.data)) + '</td>' +
      '<td>' + esc(f.nome) + '</td>' +
      '<td class="u-sm">' + esc(f.comarca || 'todo o escritório') + '</td>' +
      '<td class="u-right">' +
        ui.Button({ rotulo: 'Remover', tamanho: 'sm', variante: 'ghost',
                    acao: 'remover-feriado', valor: f.id }) +
      '</td>' +
    '</tr>';
  }

  function abaFeriados() {
    var ui = App.components.ui;

    var lista = feriados.length
      ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Data</th><th>Motivo</th><th>Comarca</th><th></th>' +
        '</tr></thead><tbody>' + feriados.map(linhaFeriado).join('') + '</tbody></table></div>'
      : ui.EmptyState({
          icone: '📅',
          titulo: 'Nenhum feriado local cadastrado',
          texto: 'Os nacionais e os forenses já são calculados — aqui entram só os que ' +
                 'dependem do foro.'
        });

    var cadastro = ui.Card({
      titulo: 'Cadastrar dia sem expediente',
      conteudo:
        '<div class="form-grid" id="form-feriado">' +
          ui.Field({ nome: 'data', rotulo: 'Data', tipo: 'date', obrigatorio: true }) +
          ui.Field({ nome: 'nome', rotulo: 'Motivo', obrigatorio: true,
                     placeholder: 'Ponto facultativo — aniversário da cidade' }) +
          ui.Field({ nome: 'comarca', rotulo: 'Comarca', placeholder: 'em branco = todas',
                     dica: 'informativo: o cálculo aplica a todos os prazos' }) +
        '</div>' +
        ui.Button({ rotulo: 'Adicionar', variante: 'primary', acao: 'criar-feriado' })
    });

    return ui.Card({
      titulo: 'Feriados locais',
      subtitulo: feriados.length + ' cadastrado(s)',
      conteudo:
        '<p class="u-sm u-muted">O motor de prazos calcula os feriados nacionais e os ' +
        'forenses a partir da Páscoa — esses não precisam ser digitados. Mas ' +
        '<strong>ponto facultativo de comarca, feriado municipal e suspensão de expediente ' +
        'por ato do tribunal</strong> não seguem regra nenhuma: só existem no calendário ' +
        'daquele foro. Sem cadastrá-los aqui, o sistema conta um dia útil que não houve ' +
        'e o prazo vence antes do que a tela mostra.</p>' +
        '<p class="u-sm u-muted">O que for cadastrado passa a valer imediatamente em toda ' +
        'contagem de prazo, no calendário e na conferência.</p>' +
        lista,
      semPadding: false
    }) + '<div class="page-section">' + cadastro + '</div>';
  }

  // --- Aba: importação por CSV (F2.10) ---------------------------------------

  function tabelaProblemas(titulo, itens) {
    if (!itens.length) return '';
    var linhas = itens.slice(0, 50).map(function (p) {
      return '<tr>' +
        '<td class="u-tabular u-sm">linha ' + p.linha + '</td>' +
        '<td class="u-sm"><code>' + esc(p.campo || '—') + '</code></td>' +
        '<td class="u-sm">' + esc(p.motivo) + '</td>' +
      '</tr>';
    }).join('');

    return '<h4 class="u-sm u-bold" style="margin-top:var(--space-5)">' + esc(titulo) +
             ' <span class="u-subtle">(' + itens.length + ')</span></h4>' +
           (itens.length > 50
             ? '<p class="u-xs u-subtle">mostrando as 50 primeiras</p>' : '') +
           '<div class="table-wrap"><table class="table table--compact"><tbody>' +
             linhas + '</tbody></table></div>';
  }

  function relatorioConferencia() {
    var ui = App.components.ui;
    var c = conferencia;
    if (!c) return '';

    var faltando = c.colunasFaltando.length
      ? '<p class="import-erro">O arquivo não tem a(s) coluna(s) ' +
          '<code>' + c.colunasFaltando.map(esc).join('</code>, <code>') + '</code>, ' +
          'que são obrigatórias. Nada pode ser importado até que sejam incluídas.</p>'
      : '';

    var ignoradas = c.colunasIgnoradas.length
      ? '<p class="u-xs u-subtle">Colunas do arquivo que o sistema não usa e vai ignorar: ' +
        c.colunasIgnoradas.map(esc).join(', ') + '.</p>'
      : '';

    return ui.Card({
      titulo: 'Conferência do arquivo',
      subtitulo: c.totalLinhas + ' linha(s) lida(s)',
      acoes: c.podeImportar
        ? ui.Button({ rotulo: 'Importar ' + (c.validas.length - c.avisos.length) +
                              ' registro(s)', variante: 'primary', tamanho: 'sm',
                      acao: 'confirmar-importacao' })
        : '',
      conteudo:
        faltando +
        '<div class="grid grid--kpi">' +
          ui.Kpi({ rotulo: 'Prontas para importar', icone: '✔',
                   valor: String(c.validas.length - c.avisos.length),
                   cor: 'var(--color-success)' }) +
          ui.Kpi({ rotulo: 'Já existem — serão puladas', icone: '⊘',
                   valor: String(c.avisos.length),
                   cor: c.avisos.length ? 'var(--color-warning)' : 'var(--color-text-subtle)' }) +
          ui.Kpi({ rotulo: 'Com erro', icone: '✕',
                   valor: String(c.erros.length),
                   cor: c.erros.length ? 'var(--color-danger)' : 'var(--color-text-subtle)' }) +
        '</div>' +
        ignoradas +
        '<p class="u-sm u-muted">Nada foi gravado ainda. A conferência roda no arquivo ' +
        'inteiro antes de qualquer gravação — uma importação que para no meio deixaria o ' +
        'banco num estado que ninguém sabe desfazer.</p>' +
        tabelaProblemas('Linhas com erro — corrija no arquivo e envie de novo', c.erros) +
        tabelaProblemas('Linhas que já existem no sistema', c.avisos)
    });
  }

  function abaImportacao() {
    var ui = App.components.ui;
    var layouts = App.services.importacaoService.LAYOUTS;

    var opcoes = Object.keys(layouts).map(function (id) {
      return '<option value="' + id + '"' +
             (layoutImportacao === id ? ' selected' : '') + '>' +
             esc(layouts[id].nome) + '</option>';
    }).join('');

    var layout = layouts[layoutImportacao];

    var colunas = layout.campos.map(function (c) {
      return '<tr><td><code>' + esc(c.campo) + '</code></td>' +
             '<td class="u-sm">' + esc(c.titulo) + '</td>' +
             '<td class="u-sm">' + (c.obrigatorio ? 'obrigatória' : 'opcional') + '</td></tr>';
    }).join('');

    return ui.Card({
      titulo: 'Importar em massa',
      subtitulo: 'arquivo CSV',
      acoes: ui.Button({ rotulo: 'Baixar modelo', tamanho: 'sm', variante: 'ghost',
                         acao: 'baixar-modelo' }),
      conteudo:
        '<p class="u-sm u-muted">Nenhum escritório migra a carteira digitando. Escolha o ' +
        'layout, envie o arquivo e confira o relatório <strong>antes</strong> de gravar.</p>' +

        '<div class="form-grid">' +
          ui.Field({ nome: 'layout', rotulo: 'O que está importando', tipo: 'select',
                     opcoes: opcoes,
                     atributos: ' data-action="trocar-layout"' }) +
          '<div class="field">' +
            '<label class="field__label" for="arquivo-csv">Arquivo CSV</label>' +
            '<input class="input" type="file" id="arquivo-csv" accept=".csv,text/csv"' +
              ' data-action="arquivo-csv">' +
            '<div class="field__hint">separador ; ou , — o sistema detecta sozinho</div>' +
          '</div>' +
        '</div>' +

        (conferindo ? '<p class="u-sm u-muted">Conferindo…</p>' : '') +

        '<h4 class="u-sm u-bold" style="margin-top:var(--space-5)">Colunas esperadas</h4>' +
        '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Coluna</th><th>Significado</th><th>Exigência</th>' +
        '</tr></thead><tbody>' + colunas + '</tbody></table></div>' +

        App.components.SeloSimulado({
          forma: 'linha',
          oque: 'a leitura acontece toda no navegador — o arquivo não sai da sua máquina.',
          naFase3: 'upload para o servidor, com a mesma conferência antes de gravar.'
        })
    }) + (conferencia ? '<div class="page-section">' + relatorioConferencia() + '</div>' : '');
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

  var ABAS = {
    escritorio: abaEscritorio,
    usuarios: abaUsuarios,
    permissoes: abaPermissoes,
    alertas: abaAlertas,
    feriados: abaFeriados,
    importacao: abaImportacao
  };

  function desenhar() {
    var ui = App.components.ui;
    var montar = ABAS[aba] || abaEscritorio;

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Configurações</h1>' +
          '<p class="page-header__subtitle">Escritório, usuários, calendário e carga de dados</p>' +
        '</div>' +
      '</div>' +
      ui.Tabs({
        ativa: aba,
        abas: [
          { id: 'escritorio', label: 'Escritório' },
          { id: 'usuarios', label: 'Usuários', contador: usuarios.length },
          { id: 'permissoes', label: 'Perfis e permissões' },
          { id: 'alertas', label: 'Alertas e prazos' },
          { id: 'feriados', label: 'Feriados locais', contador: feriados.length },
          { id: 'importacao', label: 'Importar dados' }
        ]
      }) +
      '<div class="page-section">' + montar() + '</div>';
  }

  /** Lê um bloco de campos como objeto — os formulários aqui são pequenos. */
  function lerFormulario(id) {
    var raiz = container.querySelector('#' + id);
    var dados = {};
    if (!raiz) return dados;

    raiz.querySelectorAll('input, select, textarea').forEach(function (campo) {
      if (!campo.name) return;
      dados[campo.name] = campo.type === 'checkbox' ? campo.checked : campo.value.trim();
    });
    return dados;
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

    // --- Escritório e preferências (F2.10) ---

    App.dom.delegate(container, 'click', '[data-action="salvar-escritorio"]', function () {
      App.services.configuracaoService.salvarEscritorio(lerFormulario('form-escritorio'))
        .then(function () {
          App.components.Toast.sucesso('Dados do escritório salvos');
          carregar();
        })
        .catch(function (erro) {
          App.components.Toast.erro('Não foi possível salvar', erro.message);
        });
    });

    App.dom.delegate(container, 'click', '[data-action="salvar-preferencias"]', function () {
      var eu = App.services.sessaoService.atual();
      if (!eu) return;

      App.services.configuracaoService
        .salvarPreferencias(eu.id, lerFormulario('form-preferencias'))
        .then(function () {
          App.components.Toast.sucesso('Preferências salvas');
          carregar();
        });
    });

    // --- Feriados locais (F2.10) ---

    App.dom.delegate(container, 'click', '[data-action="criar-feriado"]', function () {
      App.services.configuracaoService.criarFeriado(lerFormulario('form-feriado'))
        .then(function (f) {
          App.components.Toast.sucesso('Feriado cadastrado',
            App.format.data(f.data) + ' deixa de contar como dia útil a partir de agora.');
          carregar();
        })
        .catch(function (erro) {
          App.components.Toast.erro('Não foi possível cadastrar', erro.message);
        });
    });

    App.dom.delegate(container, 'click', '[data-action="remover-feriado"]',
      function (evento, alvo) {
        App.components.Modal.confirmar({
          titulo: 'Remover feriado local',
          mensagem: 'A data volta a contar como dia útil.',
          detalhe: 'Prazos já calculados não são recalculados sozinhos — confira os que ' +
                   'passam por esta data.',
          rotuloConfirmar: 'Remover',
          variante: 'danger'
        }).then(function (confirmado) {
          if (!confirmado) return;
          App.services.configuracaoService
            .removerFeriado(alvo.getAttribute('data-value'))
            .then(function () {
              App.components.Toast.sucesso('Feriado removido');
              carregar();
            });
        });
      });

    // --- Tipos de prazo (F2.10) ---

    App.dom.delegate(container, 'click', '[data-action="criar-tipo-prazo"]', function () {
      App.services.configuracaoService.criarTipoPrazo(lerFormulario('form-tipo-prazo'))
        .then(function () {
          App.components.Toast.sucesso('Tipo de prazo criado');
          carregar();
        })
        .catch(function (erro) {
          App.components.Toast.erro('Não foi possível criar', erro.message);
        });
    });

    App.dom.delegate(container, 'click', '[data-action="remover-tipo-prazo"]',
      function (evento, alvo) {
        App.services.configuracaoService.removerTipoPrazo(alvo.getAttribute('data-value'))
          .then(function () {
            App.components.Toast.sucesso('Tipo de prazo removido');
            carregar();
          })
          .catch(function (erro) {
            App.components.Toast.erro('Não foi possível remover', erro.message);
          });
      });

    // --- Importação por CSV (F2.10) ---

    App.dom.delegate(container, 'change', '[data-action="trocar-layout"]',
      function (evento, alvo) {
        layoutImportacao = alvo.value;
        conferencia = null;          // o relatório era do outro layout
        desenhar();
      });

    App.dom.delegate(container, 'change', '[data-action="arquivo-csv"]',
      function (evento, alvo) {
        var arquivo = alvo.files && alvo.files[0];
        if (!arquivo) return;

        var leitor = new FileReader();
        leitor.onload = function () {
          conferindo = false;
          App.services.importacaoService.conferir(layoutImportacao, String(leitor.result))
            .then(function (relatorio) {
              conferencia = relatorio;
              desenhar();
            })
            .catch(function (erro) {
              conferencia = null;
              desenhar();
              App.components.Toast.erro('Não foi possível ler o arquivo', erro.message);
            });
        };
        leitor.onerror = function () {
          conferindo = false;
          desenhar();
          App.components.Toast.erro('Não foi possível ler o arquivo');
        };

        conferindo = true;
        conferencia = null;    // o relatório anterior era de outro arquivo
        desenhar();
        leitor.readAsText(arquivo, 'utf-8');
      });

    App.dom.delegate(container, 'click', '[data-action="confirmar-importacao"]', function () {
      var pendente = conferencia;
      if (!pendente) return;

      App.components.Modal.confirmar({
        titulo: 'Importar ' + (pendente.validas.length - pendente.avisos.length) +
                ' registro(s)',
        mensagem: 'Os registros serão criados agora.',
        detalhe: 'As linhas com erro e as que já existem ficam de fora. Nada é sobrescrito.',
        rotuloConfirmar: 'Importar'
      }).then(function (confirmado) {
        if (!confirmado) return;

        App.services.importacaoService.importar(layoutImportacao, pendente)
          .then(function (r) {
            conferencia = null;
            App.components.Toast.sucesso(
              r.criados + ' registro(s) importado(s)',
              r.pulados ? r.pulados + ' já existia(m) e foi(ram) pulado(s).' : '');
            carregar();
          })
          .catch(function (erro) {
            App.components.Toast.erro('A importação falhou', erro.message);
          });
      });
    });

    App.dom.delegate(container, 'click', '[data-action="baixar-modelo"]', function () {
      App.services.importacaoService.baixarModelo(layoutImportacao);
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
