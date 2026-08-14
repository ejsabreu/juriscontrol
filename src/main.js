/* ==========================================================================
   main.js — bootstrap da aplicação

   Ordem: banco → auditoria → preferências → sessão → tema → casca → rotas →
   guarda → router.
   No React o equivalente é o ReactDOM.createRoot(...).render(<App/>) com os
   providers em volta e as rotas declaradas no <Routes>.
   ========================================================================== */

(function (App) {
  'use strict';

  function registrarRotas() {
    var R = App.router;
    var P = App.pages;

    // Única rota pública e sem casca em F2.1 (o portal do cliente, em F2.3,
    // será a segunda).
    // As duas rotas públicas e sem casca do sistema.
    R.registrar('/entrar',                 'entrar',    P.LoginPage,            'Entrar',
                { publica: true, semCasca: true });
    R.registrar('/portal/:token',          'portal',    P.PortalClientePage,    'Acompanhamento',
                { publica: true, semCasca: true });

    R.registrar('/',                       'dashboard', P.DashboardPage,        'Dashboard');
    R.registrar('/processos',              'processos', P.ProcessosListPage,    'Processos',
                { permissao: 'processos.ver' });
    R.registrar('/processos/novo',         'processos', P.ProcessoFormPage,     'Novo processo',
                { permissao: 'processos.editar' });
    R.registrar('/processos/:id/editar',   'processos', P.ProcessoFormPage,     'Editar processo',
                { permissao: 'processos.editar' });
    R.registrar('/processos/:id',          'processos', P.ProcessoDetalhePage,  'Processo',
                { permissao: 'processos.ver' });
    R.registrar('/agenda',                 'agenda',    P.AgendaPage,           'Agenda');
    R.registrar('/tarefas',                'tarefas',   P.TarefasPage,          'Tarefas');
    R.registrar('/clientes',               'clientes',  P.ClientesPage,         'Clientes');
    R.registrar('/clientes/:id',           'clientes',  P.ClienteDetalhePage,   'Cliente');
    // Aba própria: é para onde o botão "Editar" do visor de documento leva.
    R.registrar('/documentos/:id/editar',  'processos', P.DocumentoEditorPage,  'Editar documento',
                { permissao: 'documentos.editar' });
    R.registrar('/simulador',              'simulador', P.SimuladorPage,        'Simulador de prazo');

    // Modelos de peça (F2.7)
    R.registrar('/modelos',                'modelos',   P.ModelosPage,          'Modelos de peça',
                { permissao: 'documentos.editar' });

    // CRM e prospecção (F2.6)
    R.registrar('/crm',                    'crm',        P.CrmPage,            'Prospecção',
                { permissao: 'crm.ver' });
    R.registrar('/crm/:id',                'crm',        P.LeadDetalhePage,    'Interessado',
                { permissao: 'crm.ver' });

    // Financeiro (F2.5)
    R.registrar('/financeiro',             'financeiro', P.FinanceiroPage,     'Financeiro',
                { permissao: 'financeiro.ver' });
    R.registrar('/financeiro/contratos/novo', 'financeiro', P.ContratoFormPage, 'Novo contrato',
                { permissao: 'financeiro.lancar' });
    R.registrar('/timesheet',              'timesheet',  P.TimesheetPage,      'Timesheet');

    // Publicações e captura (F2.4)
    R.registrar('/publicacoes',            'publicacoes',  P.PublicacoesPage,   'Publicações',
                { permissao: 'publicacoes.triar' });
    R.registrar('/integracoes',            'integracoes',  P.IntegracoesPage,   'Integrações',
                { permissao: 'publicacoes.triar' });

    // Notificações (F2.2)
    R.registrar('/notificacoes',           'notificacoes',  P.NotificacoesPage,  'Notificações');
    R.registrar('/caixa-de-saida',         'caixa-de-saida', P.CaixaSaidaPage,   'Caixa de saída',
                { permissao: 'configuracoes' });

    // Administração (F2.1)
    R.registrar('/configuracoes',          'configuracoes', P.ConfiguracoesPage, 'Configurações',
                { permissao: 'configuracoes' });
    R.registrar('/auditoria',              'auditoria',     P.AuditoriaPage,     'Auditoria',
                { permissao: 'auditoria' });
    R.registrar('/privacidade',            'privacidade',   P.PrivacidadePage,   'Privacidade',
                { permissao: 'configuracoes' });
  }

  /**
   * Guarda de acesso. Roda antes de a página ser instanciada, e é o único
   * lugar do sistema que decide entrar ou desviar — espalhar essa decisão
   * pelas telas garantiria esquecer uma.
   */
  function instalarGuarda() {
    App.router.definirGuarda(function (rota) {
      var sessao = App.services.sessaoService;
      var logado = sessao.ativa();

      if (rota.publica) {
        /* Quem já entrou não fica preso na tela de entrada. O portal é
           exceção: um advogado logado precisa poder conferir o link que
           acabou de mandar ao cliente, e ver exatamente o que ele vê. */
        return logado && rota.chave === 'entrar' ? '#/' : null;
      }

      if (!logado) return '#/entrar';

      if (rota.permissao && !sessao.pode(rota.permissao)) {
        App.components.Toast.erro('Acesso negado',
          'Seu perfil não tem permissão para abrir esta tela.');
        return '#/';
      }

      return null;
    });
  }

  function iniciar() {
    var raiz = document.getElementById('app');

    try {
      // 1. Banco: carrega do storage ou gera o seed determinístico.
      var dados = App.services.db.init();

      // 2. Auditoria DEPOIS do seed e ANTES de qualquer escrita da aplicação:
      //    ligá-la antes encheria a trilha com a geração dos dados fictícios.
      App.services.auditoriaService.iniciar();

      //    O índice de busca (F2.7) é invalidado a cada escrita — sem isso,
      //    a busca mostraria resultado obsoleto logo depois de salvar.
      App.services.db.observarEscrita(App.services.buscaService.invalidar);

      // 3. Preferências persistidas (tema e visão do kanban).
      App.preferencias.carregar();

      // 4. Sessão gravada, se houver. Sem ela, a guarda manda para /entrar.
      App.services.sessaoService.restaurar();

      // 5. Tema antes de pintar, para não haver flash de cor errada.
      App.layout.AppShell.aplicarTema(App.store.getState().tema);

      // 6. Casca, rotas e guarda de acesso.
      App.layout.AppShell.montar(raiz);
      registrarRotas();
      instalarGuarda();
      App.router.iniciar();

      // 7. Avaliador de alertas (F2.2). Idempotente por construção, então
      //    reavaliar a cada 5 minutos não gera aviso repetido — e sem o
      //    intervalo o sino só se atualizaria ao trocar de rota.
      window.setInterval(function () {
        if (App.services.sessaoService.ativa()) {
          App.layout.AppShell.atualizarNotificacoes();
        }
      }, 5 * 60 * 1000);

      var usuario = App.services.sessaoService.atual();
      console.info('[JurisControl] Protótipo iniciado —',
        dados.processos.length, 'processos,',
        dados.prazos.length, 'prazos,',
        dados.pessoas.length, 'pessoas.',
        usuario ? 'Sessão: ' + usuario.nome + ' (' + usuario.perfil + ')' : 'Sem sessão.');

    } catch (erro) {
      console.error('[JurisControl] Falha na inicialização:', erro);
      raiz.innerHTML =
        '<div style="max-width:560px;margin:15vh auto;padding:2rem;font-family:sans-serif">' +
          '<h1 style="font-size:1.25rem;margin-bottom:.5rem">Não foi possível iniciar o protótipo</h1>' +
          '<p style="color:#5c6b7f;margin-bottom:1rem">' + App.dom.esc(erro.message) + '</p>' +
          '<pre style="background:#f4f6f9;padding:1rem;border-radius:6px;overflow:auto;' +
            'font-size:.75rem;white-space:pre-wrap">' + App.dom.esc(erro.stack || '') + '</pre>' +
        '</div>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window.App = window.App || {});
