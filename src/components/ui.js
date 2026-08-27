/* ==========================================================================
   components/ui.js — primitivas de UI

   CONTRATO DO PROJETO (espelha a assinatura de um componente React):
   - a função recebe UM objeto de props e devolve string de HTML;
   - não acessa o store, não chama service — recebe dados e callbacks;
   - efeitos colaterais (listeners) ficam em Componente.mount(root, props).

   Migração: `function Badge(props) { return \`...\` }` vira
             `function Badge(props) { return <span .../> }`.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  var esc = null;
  function e(v) {
    if (!esc) esc = App.dom.esc;
    return esc(v);
  }

  // --- Button ---------------------------------------------------------------
  function Button(props) {
    var p = props || {};
    var classes = ['btn', 'btn--' + (p.variante || 'secondary')];
    if (p.tamanho === 'sm') classes.push('btn--sm');
    if (p.apenasIcone) classes.push('btn--icon');
    if (p.bloco) classes.push('btn--block');
    if (p.classe) classes.push(p.classe);

    var atributos = [
      'class="' + classes.join(' ') + '"',
      p.id ? 'id="' + e(p.id) + '"' : '',
      p.acao ? 'data-action="' + e(p.acao) + '"' : '',
      p.valor !== undefined ? 'data-value="' + e(p.valor) + '"' : '',
      p.desabilitado ? 'disabled' : '',
      p.titulo ? 'title="' + e(p.titulo) + '"' : '',
      p.tipo ? 'type="' + e(p.tipo) + '"' : 'type="button"'
    ].filter(Boolean).join(' ');

    var conteudo = (p.icone ? '<span class="btn__icon" aria-hidden="true">' + p.icone + '</span>' : '') +
                   (p.rotulo ? '<span>' + e(p.rotulo) + '</span>' : '');

    if (p.href) {
      return '<a class="' + classes.join(' ') + '" href="' + e(p.href) + '"' +
             (p.titulo ? ' title="' + e(p.titulo) + '"' : '') + '>' + conteudo + '</a>';
    }

    return '<button ' + atributos + '>' + conteudo + '</button>';
  }

  // --- Badge ----------------------------------------------------------------
  function Badge(props) {
    var p = props || {};
    var classes = ['badge', 'badge--' + (p.variante || 'neutral')];
    if (p.classe) classes.push(p.classe);

    var estilo = p.cor ? ' style="background:' + p.cor + '22; color:' + p.cor + '"' : '';
    var ponto = p.ponto ? '<span class="badge__dot"' +
                (p.cor ? ' style="background:' + p.cor + '"' : '') + '></span>' : '';

    return '<span class="' + classes.join(' ') + '"' + estilo +
           (p.titulo ? ' title="' + e(p.titulo) + '"' : '') + '>' +
           ponto + e(p.rotulo) + '</span>';
  }

  /** Badge derivado de um enum — evita repetir achar()+rotulo() nas telas. */
  function BadgeEnum(lista, id, opcoes) {
    var item = App.domain.enums.achar(lista, id);
    if (!item) return Badge({ rotulo: id || '—' });
    return Badge(Object.assign({
      rotulo: item.label,
      variante: item.variante || 'neutral',
      cor: item.variante ? null : item.cor,
      ponto: !!item.cor && !item.variante
    }, opcoes || {}));
  }

  // --- Avatar ---------------------------------------------------------------
  function Avatar(props) {
    var p = props || {};
    var usuario = p.usuario || {};
    var iniciais = usuario.iniciais || App.format.iniciais(usuario.nome || p.nome);
    var cor = usuario.cor || p.cor || 'var(--color-primary-500)';
    var classes = ['avatar'];
    if (p.tamanho) classes.push('avatar--' + p.tamanho);

    return '<span class="' + classes.join(' ') + '" style="background:' + cor + '" title="' +
           e(usuario.nome || p.nome || '') + '">' + e(iniciais) + '</span>';
  }

  function AvatarGroup(props) {
    var p = props || {};
    var usuarios = p.usuarios || [];
    var max = p.max || 3;
    var visiveis = usuarios.slice(0, max);
    var restantes = usuarios.length - visiveis.length;

    var html = '<span class="avatar-group">';
    visiveis.forEach(function (u) {
      html += Avatar({ usuario: u, tamanho: p.tamanho || 'sm' });
    });
    if (restantes > 0) {
      html += Avatar({ nome: '+' + restantes, cor: 'var(--color-text-subtle)', tamanho: p.tamanho || 'sm' });
    }
    return html + '</span>';
  }

  // --- Card -----------------------------------------------------------------
  function Card(props) {
    var p = props || {};
    var cabecalho = '';

    if (p.titulo || p.acoes) {
      cabecalho = '<div class="card__header">' +
        (p.titulo ? '<h3 class="card__title">' + e(p.titulo) + '</h3>' : '') +
        (p.subtitulo ? '<span class="u-sm u-muted">' + e(p.subtitulo) + '</span>' : '') +
        (p.acoes ? '<div class="card__actions">' + p.acoes + '</div>' : '') +
        '</div>';
    }

    return '<section class="card' + (p.classe ? ' ' + p.classe : '') + '"' +
           (p.id ? ' id="' + e(p.id) + '"' : '') + '>' +
           cabecalho +
           '<div class="card__body' + (p.semPadding ? ' card__body--flush' : '') + '">' +
             (p.conteudo || '') +
           '</div>' +
           (p.rodape ? '<div class="card__footer">' + p.rodape + '</div>' : '') +
           '</section>';
  }

  // --- KPI ------------------------------------------------------------------
  function Kpi(props) {
    var p = props || {};
    var tag = p.href ? 'a' : 'div';
    var atributoHref = p.href ? ' href="' + e(p.href) + '"' : '';

    return '<' + tag + ' class="kpi"' + atributoHref +
           ' style="--kpi-accent:' + (p.cor || 'var(--color-primary-400)') + '">' +
             '<div class="kpi__label">' +
               (p.icone
                 ? '<span class="kpi__icon" aria-hidden="true"' +
                   // Cor opcional so do desenho. O SVG pinta com
                   // `currentColor`, entao mexer no `color` do span basta —
                   // e o mesmo caminho que o sino usa para o prazo vencido.
                   (p.corIcone ? ' style="color:' + e(p.corIcone) + '"' : '') +
                   '>' + p.icone + '</span>'
                 : '') +
               e(p.rotulo) +
             '</div>' +
             '<div class="kpi__value">' + e(p.valor) + '</div>' +
             (p.dica ? '<div class="kpi__hint">' + e(p.dica) + '</div>' : '') +
           '</' + tag + '>';
  }

  // --- EmptyState -----------------------------------------------------------
  function EmptyState(props) {
    var p = props || {};
    return '<div class="empty-state">' +
             '<div class="empty-state__icon" aria-hidden="true">' + (p.icone || '📭') + '</div>' +
             '<div class="empty-state__title">' + e(p.titulo || 'Nada por aqui') + '</div>' +
             (p.texto ? '<p class="empty-state__text">' + e(p.texto) + '</p>' : '') +
             (p.acao ? '<div class="empty-state__action">' + p.acao + '</div>' : '') +
           '</div>';
  }

  // --- Skeleton -------------------------------------------------------------
  function Skeleton(props) {
    var p = props || {};
    var linhas = p.linhas || 3;
    var html = '<div class="skeleton-group">';
    if (p.titulo !== false) html += '<div class="skeleton skeleton--title"></div>';
    for (var i = 0; i < linhas; i++) {
      var largura = 100 - (i % 3) * 14;
      html += '<div class="skeleton skeleton--text" style="width:' + largura + '%"></div>';
    }
    return html + '</div>';
  }

  function SkeletonCards(quantidade) {
    var html = '<div class="grid grid--kpi">';
    for (var i = 0; i < (quantidade || 4); i++) {
      html += '<div class="skeleton skeleton--card"></div>';
    }
    return html + '</div>';
  }

  // --- Progress -------------------------------------------------------------
  function Progress(props) {
    var p = props || {};
    var pct = Math.max(0, Math.min(100, p.percentual || 0));
    return '<div class="progress" role="progressbar" aria-valuenow="' + Math.round(pct) + '"' +
           ' aria-valuemin="0" aria-valuemax="100">' +
             '<div class="progress__bar" style="width:' + pct + '%;' +
             (p.cor ? '--progress-color:' + p.cor : '') + '"></div>' +
           '</div>';
  }

  // --- StackedBar -----------------------------------------------------------
  function StackedBar(props) {
    var p = props || {};
    var segmentos = p.segmentos || [];

    var barra = '<div class="stacked-bar">';
    segmentos.forEach(function (s) {
      if (s.percentual <= 0) return;
      barra += '<div class="stacked-bar__seg" style="width:' + s.percentual + '%;background:' +
               s.cor + '" title="' + e(s.label + ': ' + s.valor) + '"></div>';
    });
    barra += '</div>';

    if (p.legenda === false) return barra;

    var legenda = '<div class="legend">';
    segmentos.forEach(function (s) {
      if (!s.valor) return;
      legenda += '<span class="legend__item">' +
                   '<span class="legend__swatch" style="background:' + s.cor + '"></span>' +
                   e(s.label) + ' <strong>' + s.valor + '</strong>' +
                 '</span>';
    });
    legenda += '</div>';

    return barra + legenda;
  }

  // --- PrazoChip ------------------------------------------------------------
  /** Semáforo compacto — o elemento mais repetido do sistema. */
  function PrazoChip(props) {
    var p = props || {};
    var sem = p.semaforo || 'ok';
    var texto;

    if (sem === 'cumprido') {
      texto = 'Cumprido';
    } else if (p.diasRestantes === null || p.diasRestantes === undefined) {
      texto = App.domain.prazos.ROTULOS_SEMAFORO[sem] || sem;
    } else if (p.diasRestantes < 0) {
      texto = Math.abs(p.diasRestantes) + 'd em atraso';
    } else if (p.diasRestantes === 0) {
      texto = 'Vence hoje';
    } else {
      texto = p.diasRestantes + ' ' + App.format.plural(p.diasRestantes, 'dia útil', 'dias úteis');
    }

    return '<span class="prazo-chip prazo-chip--' + sem + '"' +
           (p.titulo ? ' title="' + e(p.titulo) + '"' : '') + '>' +
           e(texto) + '</span>';
  }

  // --- Field ----------------------------------------------------------------
  function Field(props) {
    var p = props || {};
    var classes = ['field'];
    if (p.largura) classes.push('field--' + p.largura);
    if (p.erro) classes.push('field--invalid');
    if (p.valido) classes.push('field--valid');

    var idCampo = p.id || p.nome;
    var comum = 'id="' + e(idCampo) + '" name="' + e(p.nome) + '"' +
                (p.desabilitado ? ' disabled' : '') +
                (p.placeholder ? ' placeholder="' + e(p.placeholder) + '"' : '') +
                (p.obrigatorio ? ' required' : '') +
                (p.atributos || '');

    var controle;
    if (p.tipo === 'combo') {
      /* Mesmo gesto do filtro da lista — escolher um entre poucos valores
         conhecidos — e por isso a mesma roupa. O `<label for>` aponta para o
         gatilho, que é um `<button>` de verdade; quem carrega o `name` que o
         `formToObject` lê é o input escondido dentro do combo. */
      controle = App.components.Combo({
        nome: p.nome, rotulo: p.rotulo, opcoes: p.opcoes,
        campo: true, id: idCampo, desabilitado: p.desabilitado
      });
    } else if (p.tipo === 'select') {
      controle = '<select class="select" ' + comum + '>' + (p.opcoes || '') + '</select>';
    } else if (p.tipo === 'textarea') {
      controle = '<textarea class="textarea" ' + comum + ' rows="' + (p.linhas || 3) + '">' +
                 e(p.valor || '') + '</textarea>';
    } else if (p.tipo === 'checkboxes') {
      /* Escolha multipla como grupo de caixas, e nao <select multiple>: o
         select multiplo exige arrastar ou segurar Ctrl, gesto que nao existe
         no celular — e metade do uso deste sistema e no celular. */
      return '<div class="' + classes.join(' ') + '">' +
               '<span class="field__label">' + e(p.rotulo) + '</span>' +
               '<div class="checkbox-grupo" role="group" aria-label="' + e(p.rotulo) + '">' +
                 (p.itens || []).map(function (item) {
                   return '<label class="checkbox">' +
                            '<input type="checkbox" name="' + e(p.nome) + '"' +
                              ' value="' + e(item.id) + '"' +
                              (item.marcado ? ' checked' : '') +
                              (p.desabilitado ? ' disabled' : '') + '>' +
                            '<span>' + e(item.label) + '</span>' +
                          '</label>';
                 }).join('') +
               '</div>' +
               (p.dica ? '<div class="field__hint">' + e(p.dica) + '</div>' : '') +
             '</div>';
    } else if (p.tipo === 'checkbox') {
      return '<div class="' + classes.join(' ') + '">' +
               '<label class="checkbox">' +
                 '<input type="checkbox" ' + comum + (p.valor ? ' checked' : '') + '>' +
                 '<span>' + e(p.rotulo) + '</span>' +
               '</label>' +
               (p.dica ? '<div class="field__hint">' + e(p.dica) + '</div>' : '') +
             '</div>';
    } else {
      controle = '<input class="input" type="' + (p.tipo || 'text') + '" ' + comum +
                 ' value="' + e(p.valor === null || p.valor === undefined ? '' : p.valor) + '">';
    }

    return '<div class="' + classes.join(' ') + '">' +
             '<label class="field__label" for="' + e(idCampo) + '">' + e(p.rotulo) +
               (p.obrigatorio ? '<span class="field__required">*</span>' : '') +
             '</label>' +
             controle +
             (p.erro ? '<div class="field__error" data-erro-de="' + e(p.nome) + '">' + e(p.erro) + '</div>'
                     : '<div class="field__error u-hidden" data-erro-de="' + e(p.nome) + '"></div>') +
             (p.dica ? '<div class="field__hint">' + e(p.dica) + '</div>' : '') +
           '</div>';
  }

  // --- Tabs -----------------------------------------------------------------
  function Tabs(props) {
    var p = props || {};
    var html = '<div class="tabs" role="tablist">';

    (p.abas || []).forEach(function (aba) {
      var ativa = aba.id === p.ativa;
      html += '<button class="tabs__tab' + (ativa ? ' tabs__tab--active' : '') + '"' +
              ' role="tab" aria-selected="' + ativa + '"' +
              ' data-action="' + (p.acao || 'trocar-aba') + '" data-value="' + e(aba.id) + '">' +
                e(aba.label) +
                (aba.contador !== undefined && aba.contador !== null
                  ? '<span class="tabs__count">' + aba.contador + '</span>' : '') +
              '</button>';
    });

    return html + '</div>';
  }

  // --- ViewToggle -----------------------------------------------------------
  function ViewToggle(props) {
    var p = props || {};
    var html = '<div class="view-toggle" role="group" aria-label="' + e(p.rotulo || 'Visualização') + '">';

    (p.opcoes || []).forEach(function (op) {
      var ativa = op.id === p.ativa;
      html += '<button class="view-toggle__btn' + (ativa ? ' view-toggle__btn--active' : '') + '"' +
              ' data-action="' + (p.acao || 'trocar-visao') + '" data-value="' + e(op.id) + '"' +
              ' aria-pressed="' + ativa + '" title="' + e(op.titulo || op.label) + '">' +
                (op.icone ? '<span aria-hidden="true">' + op.icone + '</span>' : '') +
                '<span>' + e(op.label) + '</span>' +
              '</button>';
    });

    return html + '</div>';
  }

  // --- Pagination -----------------------------------------------------------
  /* Faixa em vez de numeração.

     A fileira de páginas numeradas respondia à pergunta errada. Quem está
     numa tabela de trabalho quer saber ONDE ESTÁ e QUANTO FALTA — "1 a 15 de
     40 registros" — e andar um passo por vez. Escolher a página 7 de cabeça é
     gesto raro, e custava uma fileira de botões que crescia com o resultado e
     era a primeira coisa a estourar no telefone.

     O seletor de quantidade é o MESMO `.combo` da barra de filtros, de
     propósito: é o mesmo gesto — escolher um entre poucos valores conhecidos
     —, e duas roupas diferentes para o mesmo gesto na mesma tela é o que faz
     uma das duas parecer defeito. Ele também vem de graça com o clique fora,
     o teclado e o `listbox` que a barra já resolveu.

     Quem escuta o combo é `FilterBar.mount`, ligado por delegação no
     container da página — a paginação mora dentro dele, então o filtro
     `porPagina` chega no mesmo `aoMudar` dos outros. */
  var TAMANHOS_DE_PAGINA = [10, 15, 25, 50, 100];

  function comboTamanho(porPagina) {
    var tamanhos = TAMANHOS_DE_PAGINA.slice();

    /* A tela pode paginar fora da escala — a auditoria vai de 30 em 30. Sem
       isto o valor em uso não teria opção na lista, e o combo exibiria o
       primeiro tamanho como se fosse o escolhido. */
    if (tamanhos.indexOf(porPagina) === -1) {
      tamanhos.push(porPagina);
      tamanhos.sort(function (a, b) { return a - b; });
    }

    return App.components.Combo({
      nome: 'porPagina',
      rotulo: 'Itens por página',
      numerico: true,
      opcoes: tamanhos.map(function (n) {
        return '<option value="' + n + '"' + (n === porPagina ? ' selected' : '') + '>' +
               n + ' por página</option>';
      }).join('')
    });
  }

  /**
   * @param {Object} p  { pagina, totalPaginas, total, porPagina, singular }
   *                    `singular` nomeia o que está sendo contado
   *                    ("registro" por padrão; "evento" na auditoria).
   */
  function Pagination(p) {
    var props = p || {};
    var pagina = props.pagina || 1;
    var totalPaginas = props.totalPaginas || 1;
    var total = props.total || 0;
    var porPagina = Number(props.porPagina) || 0;
    var nome = App.format.plural(total, props.singular || 'registro');

    var inicio = (pagina - 1) * porPagina + 1;
    var fim = Math.min(pagina * porPagina, total);

    /* Sem `porPagina` a tela não pagina de verdade (o kanban, o painel): aí a
       faixa não existe e só o total faz sentido. */
    var info = !total ? 'Nenhum ' + (props.singular || 'registro')
             : porPagina ? inicio + ' a ' + fim + ' de ' + total + ' ' + nome
             : total + ' ' + nome;

    var html = '<div class="pagination">' +
      '<div class="pagination__nav">' +
        '<button class="pagination__btn" data-action="pagina" data-value="' + (pagina - 1) + '"' +
          (pagina <= 1 ? ' disabled' : '') + ' aria-label="Página anterior">‹</button>' +
        /* `aria-live`: quem navega pelo teclado troca de página sem que nada
           mais mude na tela — a faixa é o único aviso de que algo aconteceu. */
        '<span class="pagination__info" aria-live="polite">' + e(info) + '</span>' +
        '<button class="pagination__btn" data-action="pagina" data-value="' + (pagina + 1) + '"' +
          (pagina >= totalPaginas ? ' disabled' : '') + ' aria-label="Próxima página">›</button>' +
      '</div>';

    if (porPagina) html += comboTamanho(porPagina);

    return html + '</div>';
  }

  // Os ícones desenhados moram em `components/icones.js` — moldura, registro
  // e o porquê de cada traço.

  App.components.ui = {
    Button: Button,
    Badge: Badge,
    BadgeEnum: BadgeEnum,
    Avatar: Avatar,
    AvatarGroup: AvatarGroup,
    Card: Card,
    Kpi: Kpi,
    EmptyState: EmptyState,
    Skeleton: Skeleton,
    SkeletonCards: SkeletonCards,
    Progress: Progress,
    StackedBar: StackedBar,
    PrazoChip: PrazoChip,
    Field: Field,
    Tabs: Tabs,
    ViewToggle: ViewToggle,
    Pagination: Pagination
  };
})(window.App = window.App || {});
