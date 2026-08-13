/* ==========================================================================
   pages/PortalClientePage.js — o processo visto pelo cliente

   Rota PÚBLICA e SEM CASCA. Não há sidebar, topbar, busca global nem menu:
   de dentro do portal não se alcança nenhuma tela do sistema, e isso é
   estrutural, não uma questão de esconder links.

   Tudo é somente leitura. O filtro do que aparece é feito no service, não
   aqui — a tela nunca recebe o que não pode mostrar.

   Link inválido, expirado ou revogado cai todo na MESMA tela, com a mesma
   mensagem: distinguir os casos já contaria ao visitante que o processo
   existe.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var dados = null;

  function esc(v) { return App.dom.esc(v); }

  function render(elemento, params) {
    container = elemento;
    container.innerHTML = '<div class="portal"><div class="portal__card">' +
      App.components.ui.Skeleton({ linhas: 5 }) + '</div></div>';

    App.services.compartilhamentoService.abrir(params.token).then(function (r) {
      dados = r;
      if (!r.ok) desenharInvalido();
      else desenhar();
    }).catch(function () {
      desenharInvalido();
    });
  }

  function desenharInvalido() {
    document.title = 'Link indisponível · JurisControl';

    container.innerHTML =
      '<div class="portal portal--centro">' +
        '<div class="portal__card portal__card--estreito">' +
          '<div class="portal__logo" aria-hidden="true">JC</div>' +
          '<h1 class="portal__titulo">Link indisponível</h1>' +
          '<p class="portal__texto">' +
            'Este link de acompanhamento não está mais válido. Ele pode ter expirado ' +
            'ou sido substituído por outro.' +
          '</p>' +
          '<p class="portal__texto u-subtle">' +
            'Entre em contato com o escritório para receber um link atualizado.' +
          '</p>' +
        '</div>' +
      '</div>';
  }

  // --- Seções ----------------------------------------------------------------

  function capa() {
    var enums = App.domain.enums;
    var p = dados.processo;

    function item(rotulo, valor) {
      return '<div class="portal__dado">' +
               '<dt>' + esc(rotulo) + '</dt>' +
               '<dd>' + (valor || '—') + '</dd>' +
             '</div>';
    }

    return '<section class="portal__bloco">' +
      '<div class="portal__capa">' +
        '<div>' +
          '<div class="portal__numero">' + esc(p.numeroCnj) + '</div>' +
          '<h1 class="portal__titulo">' + esc(p.assunto) + '</h1>' +
        '</div>' +
        App.components.ui.Badge({
          rotulo: enums.rotulo(enums.FASES, p.faseId),
          cor: enums.cor(enums.FASES, p.faseId),
          ponto: true
        }) +
      '</div>' +
      '<dl class="portal__dados">' +
        item('Cliente', esc(p.clienteNome)) +
        item('Classe', esc(p.classeProcessual)) +
        item('Área', esc(enums.rotulo(enums.AREAS, p.areaId))) +
        item('Tribunal', esc(enums.rotulo(enums.TRIBUNAIS, p.tribunalId))) +
        item('Vara', esc(p.vara)) +
        item('Comarca', esc(p.comarca)) +
        item('Distribuído em', esc(App.format.data(p.dataDistribuicao))) +
        item('Advogado responsável', esc(p.responsavelNome)) +
      '</dl>' +
    '</section>';
  }

  function secaoCompromissos() {
    if (!dados.escopo.compromissos) return '';
    if (!dados.compromissos.length) return '';

    var enums = App.domain.enums;

    var itens = dados.compromissos.map(function (cp) {
      var tipo = enums.achar(enums.TIPOS_COMPROMISSO, cp.tipo);
      return '<li class="portal__agenda-item">' +
               '<span class="portal__agenda-icone" aria-hidden="true">' +
                 (tipo ? tipo.icone : '📅') + '</span>' +
               '<div>' +
                 '<div class="portal__agenda-titulo">' + esc(cp.titulo) + '</div>' +
                 '<div class="portal__agenda-quando">' +
                   esc(App.format.dataHora(cp.dataHora)) +
                   (cp.local ? ' · ' + esc(cp.local) : '') +
                 '</div>' +
               '</div>' +
             '</li>';
    }).join('');

    return '<section class="portal__bloco">' +
             '<h2 class="portal__secao">Próximos compromissos</h2>' +
             '<ul class="portal__agenda">' + itens + '</ul>' +
           '</section>';
  }

  function secaoPrazos() {
    if (!dados.escopo.prazos) return '';
    if (!dados.prazos.length) return '';

    /* Sem semáforo, sem dias restantes, sem responsável: para o cliente o
       prazo é uma data-limite, não um indicador de gestão do escritório. */
    var itens = dados.prazos.map(function (pz) {
      return '<li class="portal__prazo">' +
               '<span class="portal__prazo-titulo">' + esc(pz.titulo) + '</span>' +
               '<span class="portal__prazo-data">até ' +
                 esc(App.format.data(pz.dataFatal)) + '</span>' +
             '</li>';
    }).join('');

    return '<section class="portal__bloco">' +
             '<h2 class="portal__secao">Aguardando manifestação</h2>' +
             '<ul class="portal__prazos">' + itens + '</ul>' +
           '</section>';
  }

  function secaoAndamentos() {
    if (!dados.escopo.andamentos) return '';

    if (!dados.andamentos.length) {
      return '<section class="portal__bloco">' +
               '<h2 class="portal__secao">Andamentos</h2>' +
               '<p class="portal__texto u-subtle">Nenhum andamento publicado até o momento.</p>' +
             '</section>';
    }

    var enums = App.domain.enums;

    var itens = dados.andamentos.map(function (a) {
      var tipo = enums.achar(enums.TIPOS_ANDAMENTO, a.tipo);
      return '<li class="portal__evento">' +
               '<div class="portal__evento-marca" style="background:' +
                 (tipo ? tipo.cor : 'var(--color-border-strong)') + '"></div>' +
               '<div class="portal__evento-corpo">' +
                 '<div class="portal__evento-data">' + esc(App.format.data(a.data)) + '</div>' +
                 '<div class="portal__evento-titulo">' + esc(a.titulo) + '</div>' +
                 (a.descricao
                   ? '<p class="portal__evento-texto">' + esc(a.descricao) + '</p>' : '') +
               '</div>' +
             '</li>';
    }).join('');

    return '<section class="portal__bloco">' +
             '<h2 class="portal__secao">Andamentos</h2>' +
             '<ol class="portal__linha-tempo">' + itens + '</ol>' +
           '</section>';
  }

  function secaoDocumentos() {
    if (!dados.escopo.documentos) return '';
    if (!dados.documentos.length) return '';

    var enums = App.domain.enums;

    var itens = dados.documentos.map(function (d) {
      return '<li class="portal__doc">' +
               '<span class="portal__doc-icone" aria-hidden="true">📄</span>' +
               '<div class="portal__doc-corpo">' +
                 '<div class="portal__doc-nome">' + esc(d.nome) + '</div>' +
                 '<div class="portal__doc-meta">' +
                   esc(enums.rotulo(enums.CATEGORIAS_DOCUMENTO, d.categoria)) +
                   ' · ' + esc(App.format.data(d.uploadEm)) +
                   (d.tamanho ? ' · ' + esc(App.format.bytes(d.tamanho)) : '') +
                 '</div>' +
               '</div>' +
             '</li>';
    }).join('');

    return '<section class="portal__bloco">' +
             '<h2 class="portal__secao">Documentos</h2>' +
             '<ul class="portal__docs">' + itens + '</ul>' +
             '<p class="portal__nota">' +
               'Para receber a cópia de um documento, fale com o escritório.' +
             '</p>' +
           '</section>';
  }

  function desenhar() {
    var p = dados.processo;
    document.title = 'Acompanhamento · ' + p.numeroCnj;

    container.innerHTML =
      '<div class="portal">' +

        '<header class="portal__topo">' +
          '<div class="portal__marca">' +
            '<span class="portal__logo" aria-hidden="true">JC</span>' +
            '<div>' +
              '<div class="portal__escritorio">JurisControl</div>' +
              '<div class="portal__subtitulo">Acompanhamento processual</div>' +
            '</div>' +
          '</div>' +
          '<div class="portal__validade">' +
            'Link válido até ' + esc(App.format.data(dados.expiraEm)) +
          '</div>' +
        '</header>' +

        '<main class="portal__conteudo">' +
          capa() +
          secaoCompromissos() +
          secaoPrazos() +
          secaoAndamentos() +
          secaoDocumentos() +

          '<footer class="portal__rodape">' +
            '<p>Esta página é somente para acompanhamento e não substitui a ' +
            'consulta processual oficial no site do tribunal.</p>' +
            App.components.SeloSimulado({
              forma: 'linha',
              oque: 'protótipo de demonstração — os dados deste processo são fictícios.',
              naFase3: 'portal servido pelo backend, com os dados reais do escritório.'
            }) +
          '</footer>' +
        '</main>' +

      '</div>';
  }

  App.pages.PortalClientePage = { render: render };
})(window.App = window.App || {});
