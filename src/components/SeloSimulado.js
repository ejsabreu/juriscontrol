/* ==========================================================================
   components/SeloSimulado.js — a etiqueta da Regra 1 da fase 2

   Cinco dos nove módulos da fase 2 dependem de coisas que não existem sem
   servidor: consulta ao DJe, registro de boleto, envio de e-mail, modelo de
   linguagem, certificado digital. A postura do projeto — a mesma da aba de
   Documentos, onde o binário não é persistido e a tela diz isso — é que
   nada finja ser real.

   Este componente é como essa postura vira regra: toda superfície simulada
   declara O QUE é falso e O QUE entra no lugar na fase 3.

   Três formas, do mais barulhento ao mais discreto:
     Faixa  — no topo da tela inteira (a tela toda é simulada)
     Linha  — dentro de um card ou modal (parte da tela é simulada)
     Ponto  — junto de um botão (a AÇÃO é simulada)
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  var esc = null;
  function e(v) {
    if (!esc) esc = App.dom.esc;
    return esc(v);
  }

  function textoFase3(naFase3) {
    return naFase3 ? '<span class="selo__fase3">Na fase 3: ' + e(naFase3) + '</span>' : '';
  }

  /**
   * @param {object} p
   * @param {string} p.oque     o que é simulado — obrigatório, em uma frase
   * @param {string} p.naFase3  o que entra no lugar quando houver backend
   * @param {string} p.forma    'faixa' (padrão) | 'linha' | 'ponto'
   * @param {string} p.detalhe  parágrafo opcional, só na forma 'faixa'
   */
  function SeloSimulado(props) {
    var p = props || {};
    var forma = p.forma || 'faixa';

    if (!p.oque) return '';   // selo sem conteúdo é pior que selo nenhum

    if (forma === 'ponto') {
      return '<span class="selo selo--ponto" title="' +
               e('Simulado: ' + p.oque + (p.naFase3 ? ' · Na fase 3: ' + p.naFase3 : '')) +
             '">simulado</span>';
    }

    if (forma === 'linha') {
      return '<p class="selo selo--linha">' +
               '<span class="selo__icone" aria-hidden="true">◐</span>' +
               '<span><strong>Simulado:</strong> ' + e(p.oque) + ' ' + textoFase3(p.naFase3) + '</span>' +
             '</p>';
    }

    return '<aside class="selo selo--faixa" role="note">' +
             '<span class="selo__icone" aria-hidden="true">◐</span>' +
             '<div class="selo__corpo">' +
               '<strong class="selo__titulo">Recurso simulado</strong>' +
               '<p class="selo__texto">' + e(p.oque) + '</p>' +
               (p.detalhe ? '<p class="selo__detalhe">' + e(p.detalhe) + '</p>' : '') +
               textoFase3(p.naFase3) +
             '</div>' +
           '</aside>';
  }

  App.components.SeloSimulado = SeloSimulado;
})(window.App = window.App || {});
