/* ==========================================================================
   services/simulado/emailService.js — envio de e-mail SIMULADO

   Regra 2 da fase 2: tudo o que vira chamada de rede na fase 3 mora sob
   `services/simulado/`, com a assinatura final já correta.

   Nada é enviado. A mensagem é MONTADA de verdade — assunto, corpo HTML,
   destinatário — e vai para a caixa de saída, onde pode ser lida. É a
   diferença entre "o protótipo não manda e-mail" e "o protótipo mostra
   exatamente o e-mail que mandaria": a segunda permite revisar o texto, o
   remetente e o gatilho antes de existir servidor.

   MIGRAÇÃO: `enviar()` vira POST /api/notificacoes/email (ou SES/SendGrid) e
   `caixaSaida` deixa de existir.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db() { return App.services.db; }

  var REMETENTE = 'nao-responda@juriscontrol.adv.br';

  function esc(v) { return App.dom.esc(v); }

  function usuario(id) {
    return db().find('usuarios', id);
  }

  /** Corpo HTML no formato de e-mail transacional — tabela e estilo inline. */
  function montarCorpo(notificacao, destinatario) {
    var cores = {
      critica: '#c53030',
      atencao: '#b45309',
      info: '#2b6cb0'
    };
    var cor = cores[notificacao.gravidade] || cores.info;

    return '' +
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;' +
        'background:#ffffff;border:1px solid #dde3ea;border-radius:8px;overflow:hidden">' +
        '<div style="background:#172d4a;padding:16px 20px;color:#fff">' +
          '<strong style="font-size:15px">JurisControl</strong>' +
          '<div style="font-size:11px;opacity:.75">Controle de processos judiciais</div>' +
        '</div>' +
        '<div style="padding:20px">' +
          '<p style="margin:0 0 12px;font-size:13px;color:#5c6b7f">' +
            'Olá, ' + esc((destinatario && destinatario.nome) || '') + '.' +
          '</p>' +
          '<div style="border-left:3px solid ' + cor + ';padding:8px 12px;background:#f8fafc">' +
            '<div style="font-size:14px;font-weight:600;color:#1a2433">' +
              esc(notificacao.titulo) + '</div>' +
            '<div style="font-size:12px;color:#5c6b7f;margin-top:4px">' +
              esc(notificacao.mensagem || '') + '</div>' +
          '</div>' +
          '<p style="margin:16px 0 0;font-size:12px;color:#8b98a9">' +
            'Este aviso foi gerado automaticamente pelas regras de alerta do escritório.' +
          '</p>' +
        '</div>' +
      '</div>';
  }

  function montarAssunto(notificacao) {
    var prefixo = notificacao.gravidade === 'critica' ? '[URGENTE] '
                : notificacao.gravidade === 'atencao' ? '[Atenção] '
                : '';
    return prefixo + notificacao.titulo;
  }

  /**
   * Enfileira o e-mail de uma notificação.
   * Assinatura da fase 3: `enviar({ para, assunto, corpoHtml })`.
   */
  function enfileirar(notificacao) {
    var destinatario = usuario(notificacao.usuarioId);
    if (!destinatario) return null;

    return db().insert('caixaSaida', {
      para: destinatario.email || (destinatario.nome + '@juriscontrol.adv.br'),
      paraNome: destinatario.nome,
      de: REMETENTE,
      assunto: montarAssunto(notificacao),
      corpoHtml: montarCorpo(notificacao, destinatario),
      gravidade: notificacao.gravidade,
      notificacaoIds: [notificacao.id],
      geradaEm: new Date().toISOString(),
      status: 'simulada'
    }, 'EML');
  }

  /**
   * Assinatura que a fase 3 vai implementar de verdade. Hoje só grava.
   * Existe agora para que nenhuma tela precise mudar depois.
   */
  function enviar(mensagem) {
    return App.services.http.requisicao(function () {
      return db().insert('caixaSaida', Object.assign({
        de: REMETENTE,
        geradaEm: new Date().toISOString(),
        status: 'simulada',
        notificacaoIds: []
      }, mensagem), 'EML');
    });
  }

  function listar(filtros) {
    return App.services.http.requisicao(function () {
      var f = filtros || {};
      return db().get('caixaSaida')
        .filter(function (m) {
          if (f.busca) {
            var termo = String(f.busca).toLowerCase();
            if ((m.assunto + ' ' + m.paraNome).toLowerCase().indexOf(termo) === -1) return false;
          }
          if (f.gravidade && m.gravidade !== f.gravidade) return false;
          return true;
        })
        .sort(function (a, b) { return a.geradaEm < b.geradaEm ? 1 : -1; });
    });
  }

  function limpar() {
    return App.services.http.requisicao(function () {
      var quantas = 0;
      db().get('caixaSaida').forEach(function (m) {
        db().remove('caixaSaida', m.id);
        quantas++;
      });
      return { removidas: quantas };
    });
  }

  App.services.emailService = {
    enfileirar: enfileirar,
    enviar: enviar,
    listar: listar,
    limpar: limpar,
    REMETENTE: REMETENTE
  };
})(window.App = window.App || {});
