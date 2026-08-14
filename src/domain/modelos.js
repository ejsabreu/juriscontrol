/* ==========================================================================
   domain/modelos.js — modelos de peça com variáveis

   O recurso nº 1 pedido por advogado, e o que transforma o editor da fase 1
   em ferramenta de trabalho: escrever a mesma petição pela quadragésima vez
   trocando nome, número e vara é onde o erro de copiar-e-colar nasce.

   LÓGICA PURA. Recebe o HTML do modelo e um contexto; devolve o texto
   preenchido e — igualmente importante — a lista do que NÃO foi resolvido.

   A DECISÃO CENTRAL: variável sem valor NÃO é apagada nem deixada como
   `{{cliente.nome}}` no meio da petição. Ela vira uma marca visível que o
   editor destaca e que a exportação recusa em silêncio. Documento com
   `{{...}}` cru protocolado é constrangimento; documento com o campo
   apagado é pior, porque ninguém percebe.
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  /* Sintaxe: {{caminho}} ou {{caminho|filtro}}.
     O caminho é pontuado (`cliente.nome`) e resolvido no contexto. */
  var EXPRESSAO = /\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|\s*([a-zA-Z]+)\s*)?\}\}/g;

  var MARCA_ABERTA = '<span class="var-pendente" data-var="';
  var MARCA_FECHADA = '</span>';

  /* Catálogo das variáveis que o sistema sabe preencher. É o que a tela
     mostra ao autor do modelo — sem catálogo, ele inventa nomes que nunca
     serão resolvidos. */
  var CATALOGO = [
    { grupo: 'Cliente', chave: 'cliente.nome',        descricao: 'Nome ou razão social' },
    { grupo: 'Cliente', chave: 'cliente.cpfCnpj',     descricao: 'CPF ou CNPJ formatado' },
    { grupo: 'Cliente', chave: 'cliente.email',       descricao: 'E-mail' },
    { grupo: 'Cliente', chave: 'cliente.telefone',    descricao: 'Telefone' },
    { grupo: 'Cliente', chave: 'cliente.endereco',    descricao: 'Endereço completo' },

    { grupo: 'Processo', chave: 'processo.numeroCnj',  descricao: 'Número CNJ' },
    { grupo: 'Processo', chave: 'processo.numeroInterno', descricao: 'Pasta do escritório' },
    { grupo: 'Processo', chave: 'processo.classe',     descricao: 'Classe processual' },
    { grupo: 'Processo', chave: 'processo.assunto',    descricao: 'Assunto' },
    { grupo: 'Processo', chave: 'processo.vara',       descricao: 'Vara' },
    { grupo: 'Processo', chave: 'processo.comarca',    descricao: 'Comarca' },
    { grupo: 'Processo', chave: 'processo.tribunal',   descricao: 'Tribunal' },
    { grupo: 'Processo', chave: 'processo.valorCausa', descricao: 'Valor da causa' },
    { grupo: 'Processo', chave: 'processo.area',       descricao: 'Área do direito' },

    { grupo: 'Partes', chave: 'parte.contraria',       descricao: 'Nome da parte contrária' },
    { grupo: 'Partes', chave: 'parte.polo',            descricao: 'Polo do cliente' },

    { grupo: 'Advogado', chave: 'advogado.nome',       descricao: 'Responsável pelo processo' },
    { grupo: 'Advogado', chave: 'advogado.oab',        descricao: 'OAB do responsável' },

    { grupo: 'Escritório', chave: 'escritorio.nome',   descricao: 'Nome do escritório' },

    { grupo: 'Data', chave: 'data.hoje',               descricao: 'Data de hoje (dd/mm/aaaa)' },
    { grupo: 'Data', chave: 'data.extenso',            descricao: 'Data por extenso' },
    { grupo: 'Data', chave: 'data.ano',                descricao: 'Ano corrente' },

    { grupo: 'Honorários', chave: 'honorarios.valor',  descricao: 'Valor do contrato' },
    { grupo: 'Honorários', chave: 'honorarios.extenso', descricao: 'Valor por extenso' },
    { grupo: 'Honorários', chave: 'honorarios.exito',  descricao: 'Percentual de êxito' }
  ];

  var FILTROS = {
    maiuscula: function (v) { return String(v).toUpperCase(); },
    minuscula: function (v) { return String(v).toLowerCase(); },
    // "MARIA DA SILVA" → "Maria da Silva": preposição fica minúscula, como
    // em petição bem escrita.
    titulo: function (v) {
      var minusculas = ['de', 'da', 'do', 'das', 'dos', 'e'];
      return String(v).toLowerCase().split(/\s+/).map(function (p, i) {
        if (i > 0 && minusculas.indexOf(p) !== -1) return p;
        return p.charAt(0).toUpperCase() + p.slice(1);
      }).join(' ');
    }
  };

  /** Resolve 'cliente.nome' dentro do objeto de contexto. */
  function resolver(contexto, caminho) {
    var partes = String(caminho).split('.');
    var atual = contexto;

    for (var i = 0; i < partes.length; i++) {
      if (atual === null || atual === undefined) return undefined;
      atual = atual[partes[i]];
    }
    return atual;
  }

  function vazio(valor) {
    return valor === null || valor === undefined || String(valor).trim() === '';
  }

  /** Variáveis citadas no modelo, sem repetição e na ordem de aparição. */
  function listarVariaveis(html) {
    var texto = String(html || '');
    var achadas = [];
    var m;

    EXPRESSAO.lastIndex = 0;
    while ((m = EXPRESSAO.exec(texto)) !== null) {
      if (achadas.indexOf(m[1]) === -1) achadas.push(m[1]);
    }
    return achadas;
  }

  /**
   * Preenche o modelo.
   *
   * @param {string} html
   * @param {object} contexto
   * @param {object} [opcoes]  { marcarPendentes: true }
   * @returns {{ html, resolvidas, pendentes, total }}
   */
  function preencher(html, contexto, opcoes) {
    var op = opcoes || {};
    var marcar = op.marcarPendentes !== false;
    var ctx = contexto || {};

    var resolvidas = [];
    var pendentes = [];

    EXPRESSAO.lastIndex = 0;
    var saida = String(html || '').replace(EXPRESSAO, function (inteiro, caminho, filtro) {
      var valor = resolver(ctx, caminho);

      if (vazio(valor)) {
        if (pendentes.indexOf(caminho) === -1) pendentes.push(caminho);
        /* A marca é visível de propósito. Apagar em silêncio produziria uma
           petição com lacuna que ninguém nota; deixar `{{...}}` cru produz
           uma que envergonha no protocolo. */
        return marcar
          ? MARCA_ABERTA + App.dom.esc(caminho) + '">[' + App.dom.esc(caminho) + ']' +
            MARCA_FECHADA
          : '';
      }

      if (resolvidas.indexOf(caminho) === -1) resolvidas.push(caminho);

      var texto = String(valor);
      if (filtro && FILTROS[filtro]) texto = FILTROS[filtro](texto);
      return texto;
    });

    return {
      html: saida,
      resolvidas: resolvidas,
      pendentes: pendentes,
      total: resolvidas.length + pendentes.length
    };
  }

  /** Só o que ficou sem valor — usado pelo aviso antes de exportar. */
  function variaveisNaoResolvidas(html, contexto) {
    return preencher(html, contexto, { marcarPendentes: false }).pendentes;
  }

  /** Verdadeiro se o texto ainda tem marcas pendentes ou chaves cruas. */
  function temPendencias(html) {
    var texto = String(html || '');
    EXPRESSAO.lastIndex = 0;
    return EXPRESSAO.test(texto) || texto.indexOf('var-pendente') !== -1;
  }

  /**
   * Monta o contexto a partir dos registros do sistema.
   *
   * É a única função aqui que conhece o formato das entidades — de
   * propósito: concentrar a tradução num lugar só evita que cada tela
   * invente o próprio nome de variável.
   */
  function montarContexto(dados) {
    var d = dados || {};
    var processo = d.processo || {};
    var cliente = d.cliente || {};
    var advogado = d.advogado || {};
    var contrato = d.contrato || {};
    var enums = App.domain.enums;
    var fmt = App.format;
    var hoje = d.hoje || App.domain.prazos.hojeISO();

    var endereco = cliente.endereco || {};
    var enderecoCompleto = [
      endereco.logradouro && endereco.numero
        ? endereco.logradouro + ', ' + endereco.numero : endereco.logradouro,
      endereco.bairro,
      endereco.cidade && endereco.uf ? endereco.cidade + '/' + endereco.uf : endereco.cidade,
      endereco.cep ? 'CEP ' + fmt.cep(endereco.cep) : ''
    ].filter(Boolean).join(', ');

    return {
      cliente: {
        nome: cliente.nome || '',
        cpfCnpj: cliente.cpfCnpj ? fmt.documento(cliente.cpfCnpj) : '',
        email: cliente.email || '',
        telefone: cliente.telefone ? fmt.telefone(cliente.telefone) : '',
        endereco: enderecoCompleto
      },
      processo: {
        numeroCnj: processo.numeroCnj || '',
        numeroInterno: processo.numeroInterno || '',
        classe: processo.classeProcessual || '',
        assunto: processo.assunto || '',
        vara: processo.vara || '',
        comarca: processo.comarca || '',
        tribunal: processo.tribunalId
          ? enums.rotulo(enums.TRIBUNAIS, processo.tribunalId) : '',
        valorCausa: processo.valorCausa ? fmt.moeda(processo.valorCausa) : '',
        area: processo.areaId ? enums.rotulo(enums.AREAS, processo.areaId) : ''
      },
      parte: {
        contraria: d.parteContraria || '',
        polo: processo.papelCliente
          ? enums.rotulo(enums.PAPEIS_CLIENTE, processo.papelCliente) : ''
      },
      advogado: {
        nome: advogado.nome || '',
        oab: advogado.oab ? 'OAB/' + advogado.oab.uf + ' ' + advogado.oab.numero : ''
      },
      escritorio: {
        nome: d.escritorio || 'JurisControl Sociedade de Advogados'
      },
      data: {
        hoje: fmt.data(hoje),
        extenso: fmt.dataExtenso(hoje),
        ano: String(hoje).slice(0, 4)
      },
      honorarios: {
        valor: contrato.valorFixoCentavos ? fmt.moeda(contrato.valorFixoCentavos) : '',
        extenso: contrato.valorFixoCentavos
          ? App.moeda.extenso(contrato.valorFixoCentavos) : '',
        exito: contrato.percentualExito ? contrato.percentualExito + '%' : ''
      }
    };
  }

  /** Variável citada no modelo que o sistema não sabe preencher. */
  function variaveisDesconhecidas(html) {
    var conhecidas = CATALOGO.map(function (v) { return v.chave; });
    return listarVariaveis(html).filter(function (v) {
      return conhecidas.indexOf(v) === -1;
    });
  }

  App.domain.modelos = {
    CATALOGO: CATALOGO,
    FILTROS: FILTROS,
    listarVariaveis: listarVariaveis,
    preencher: preencher,
    variaveisNaoResolvidas: variaveisNaoResolvidas,
    variaveisDesconhecidas: variaveisDesconhecidas,
    temPendencias: temPendencias,
    montarContexto: montarContexto,
    resolver: resolver
  };
})(window.App = window.App || {});
