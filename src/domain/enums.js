/* ==========================================================================
   domain/enums.js — vocabulário do domínio
   Fonte única da verdade para rótulos, cores e ordem de exibição.
   Migra para o React sem nenhuma alteração.
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  /** Fases do rito processual — a ordem define as colunas do kanban. */
  var FASES = [
    { id: 'distribuicao', label: 'Distribuição', cor: '#7f9dbf', descricao: 'Ação protocolada, aguardando análise' },
    { id: 'citacao',      label: 'Citação',      cor: '#4f74a0', descricao: 'Aguardando citação da parte contrária' },
    { id: 'instrucao',    label: 'Instrução',    cor: '#2d5580', descricao: 'Produção de provas, audiências e perícias' },
    { id: 'sentenca',     label: 'Sentença',     cor: '#b8873f', descricao: 'Concluso para julgamento ou sentenciado' },
    { id: 'recurso',      label: 'Recurso',      cor: '#c05621', descricao: 'Em grau recursal' },
    { id: 'execucao',     label: 'Execução',     cor: '#2f855a', descricao: 'Cumprimento de sentença' },
    { id: 'arquivado',    label: 'Arquivado',    cor: '#8b98a9', descricao: 'Baixado definitivamente' }
  ];

  var AREAS = [
    { id: 'civel',        label: 'Cível',        cor: '#2d5580' },
    { id: 'trabalhista',  label: 'Trabalhista',  cor: '#b45309' },
    { id: 'tributario',   label: 'Tributário',   cor: '#2f855a' },
    { id: 'consumidor',   label: 'Consumidor',   cor: '#2b6cb0' },
    { id: 'familia',      label: 'Família',      cor: '#8b5cf6' },
    { id: 'previdenciario', label: 'Previdenciário', cor: '#0891b2' },
    { id: 'penal',        label: 'Penal',        cor: '#c53030' },
    { id: 'empresarial',  label: 'Empresarial',  cor: '#96692c' }
  ];

  var STATUS_PROCESSO = [
    { id: 'ativo',     label: 'Ativo',     variante: 'success' },
    { id: 'suspenso',  label: 'Suspenso',  variante: 'warning' },
    { id: 'arquivado', label: 'Arquivado', variante: 'neutral' },
    { id: 'encerrado', label: 'Encerrado', variante: 'neutral' }
  ];

  var PAPEIS_CLIENTE = [
    { id: 'autor',      label: 'Autor',      polo: 'ativo' },
    { id: 'reu',        label: 'Réu',        polo: 'passivo' },
    { id: 'exequente',  label: 'Exequente',  polo: 'ativo' },
    { id: 'executado',  label: 'Executado',  polo: 'passivo' },
    { id: 'terceiro',   label: 'Terceiro interessado', polo: 'terceiro' }
  ];

  var TIPOS_PARTICIPACAO = [
    { id: 'autor',              label: 'Autor' },
    { id: 'reu',                label: 'Réu' },
    { id: 'advogado_contrario', label: 'Advogado da parte contrária' },
    { id: 'assistente',         label: 'Assistente' },
    { id: 'testemunha',         label: 'Testemunha' },
    { id: 'perito',             label: 'Perito' }
  ];

  var RISCOS = [
    { id: 'provavel', label: 'Provável', variante: 'danger',  descricao: 'Perda provável — exige provisão contábil' },
    { id: 'possivel', label: 'Possível', variante: 'warning', descricao: 'Perda possível — divulgação em nota explicativa' },
    { id: 'remoto',   label: 'Remoto',   variante: 'success', descricao: 'Perda remota — sem provisão' }
  ];

  var TIPOS_ANDAMENTO = [
    { id: 'movimentacao', label: 'Movimentação', cor: '#7f9dbf', icone: '↻' },
    { id: 'peticao',      label: 'Petição',      cor: '#2d5580', icone: '✎' },
    { id: 'despacho',     label: 'Despacho',     cor: '#4f74a0', icone: '§' },
    { id: 'decisao',      label: 'Decisão',      cor: '#b8873f', icone: '⚖' },
    { id: 'sentenca',     label: 'Sentença',     cor: '#c05621', icone: '★' },
    { id: 'publicacao',   label: 'Publicação',   cor: '#2b6cb0', icone: '◧' },
    { id: 'nota_interna', label: 'Nota interna', cor: '#8b98a9', icone: '✱' }
  ];

  var STATUS_PRAZO = [
    { id: 'pendente',     label: 'Pendente',     variante: 'primary' },
    { id: 'em_andamento', label: 'Em andamento', variante: 'primary' },
    { id: 'cumprido',     label: 'Cumprido',     variante: 'success' },
    { id: 'prorrogado',   label: 'Prorrogado',   variante: 'warning' },
    { id: 'perdido',      label: 'Perdido',      variante: 'danger' },
    { id: 'cancelado',    label: 'Cancelado',    variante: 'neutral' }
  ];

  var PRIORIDADES = [
    { id: 'baixa',   label: 'Baixa',   variante: 'neutral', peso: 1 },
    { id: 'media',   label: 'Média',   variante: 'primary', peso: 2 },
    { id: 'alta',    label: 'Alta',    variante: 'warning', peso: 3 },
    { id: 'critica', label: 'Crítica', variante: 'danger',  peso: 4 }
  ];

  var TIPOS_COMPROMISSO = [
    { id: 'audiencia',   label: 'Audiência',   cor: '#c53030', icone: '⚖' },
    { id: 'pericia',     label: 'Perícia',     cor: '#b45309', icone: '🔬' },
    { id: 'sustentacao', label: 'Sustentação oral', cor: '#8b5cf6', icone: '🎙' },
    { id: 'reuniao',     label: 'Reunião',     cor: '#2b6cb0', icone: '👥' },
    { id: 'diligencia',  label: 'Diligência',  cor: '#2f855a', icone: '📍' }
  ];

  var STATUS_TAREFA = [
    { id: 'a_fazer',     label: 'A fazer',     cor: '#7f9dbf' },
    { id: 'em_andamento',label: 'Em andamento',cor: '#2d5580' },
    { id: 'em_revisao',  label: 'Em revisão',  cor: '#b8873f' },
    { id: 'concluida',   label: 'Concluída',   cor: '#2f855a' }
  ];

  var CATEGORIAS_DOCUMENTO = [
    { id: 'inicial',      label: 'Petição inicial' },
    { id: 'contestacao',  label: 'Contestação' },
    { id: 'procuracao',   label: 'Procuração' },
    { id: 'contrato',     label: 'Contrato de honorários' },
    { id: 'sentenca',     label: 'Sentença' },
    { id: 'recurso',      label: 'Recurso' },
    { id: 'documento_pessoal', label: 'Documento pessoal' },
    { id: 'comprovante',  label: 'Comprovante' },
    { id: 'laudo',        label: 'Laudo pericial' },
    { id: 'outro',        label: 'Outro' }
  ];

  /* Formatos oferecidos ao CRIAR um documento em branco — o mesmo conjunto
     do Google Docs, menos os que só fazem sentido como exportação (.pdf e
     .epub não se editam).

     `modo` casa com DocumentViewer.modoEdicao(): decide se o editor abre em
     texto puro ou em texto formatado. `geraArquivo` diz se o protótipo sabe
     produzir o binário desse formato de verdade — .docx e .odt são ZIP com
     XML dentro e não são gerados sem biblioteca; a tela avisa isso em vez
     de entregar um arquivo com a extensão errada. */
  var FORMATOS_DOCUMENTO = [
    { id: 'docx', label: 'Documento do Word (.docx)', modo: 'rico',  geraArquivo: false },
    { id: 'odt',  label: 'Documento OpenDocument (.odt)', modo: 'rico', geraArquivo: false },
    { id: 'rtf',  label: 'Rich Text Format (.rtf)', modo: 'rico',  geraArquivo: true },
    { id: 'html', label: 'Página da web (.html)',   modo: 'texto', geraArquivo: true },
    { id: 'txt',  label: 'Texto sem formatação (.txt)', modo: 'texto', geraArquivo: true },
    { id: 'md',   label: 'Markdown (.md)',          modo: 'texto', geraArquivo: true }
  ];

  var PERFIS = [
    { id: 'admin',      label: 'Administrador' },
    { id: 'socio',      label: 'Sócio' },
    { id: 'advogado',   label: 'Advogado' },
    { id: 'estagiario', label: 'Estagiário' },
    { id: 'financeiro', label: 'Financeiro' }
  ];

  var INSTANCIAS = [
    { id: 1, label: '1ª instância' },
    { id: 2, label: '2ª instância' },
    { id: 'superior', label: 'Tribunal superior' }
  ];

  var TRIBUNAIS = [
    { id: 'tjsp',  label: 'TJSP',  nome: 'Tribunal de Justiça de São Paulo',      segmento: 8, codigo: 26, uf: 'SP' },
    { id: 'tjrj',  label: 'TJRJ',  nome: 'Tribunal de Justiça do Rio de Janeiro', segmento: 8, codigo: 19, uf: 'RJ' },
    { id: 'tjmg',  label: 'TJMG',  nome: 'Tribunal de Justiça de Minas Gerais',   segmento: 8, codigo: 13, uf: 'MG' },
    { id: 'tjpr',  label: 'TJPR',  nome: 'Tribunal de Justiça do Paraná',         segmento: 8, codigo: 16, uf: 'PR' },
    { id: 'trt2',  label: 'TRT-2', nome: 'Tribunal Regional do Trabalho 2ª Região', segmento: 5, codigo: 2, uf: 'SP' },
    { id: 'trt15', label: 'TRT-15',nome: 'Tribunal Regional do Trabalho 15ª Região', segmento: 5, codigo: 15, uf: 'SP' },
    { id: 'trf3',  label: 'TRF-3', nome: 'Tribunal Regional Federal 3ª Região',   segmento: 4, codigo: 3, uf: 'SP' }
  ];

  var TIPOS_PRAZO = [
    { id: 'contestacao',   label: 'Contestação',              dias: 15, contagem: 'uteis' },
    { id: 'recurso_ape',   label: 'Apelação',                 dias: 15, contagem: 'uteis' },
    { id: 'agravo',        label: 'Agravo de instrumento',    dias: 15, contagem: 'uteis' },
    { id: 'embargos',      label: 'Embargos de declaração',   dias: 5,  contagem: 'uteis' },
    { id: 'reptreplica',   label: 'Réplica',                  dias: 15, contagem: 'uteis' },
    { id: 'manifestacao',  label: 'Manifestação',             dias: 5,  contagem: 'uteis' },
    { id: 'alegacoes',     label: 'Alegações finais',         dias: 15, contagem: 'uteis' },
    { id: 'cumprimento',   label: 'Cumprimento voluntário',   dias: 15, contagem: 'uteis' },
    { id: 'impugnacao',    label: 'Impugnação ao cumprimento',dias: 15, contagem: 'uteis' },
    { id: 'contrarrazoes', label: 'Contrarrazões',            dias: 15, contagem: 'uteis' },
    { id: 'custom',        label: 'Outro (personalizado)',    dias: 15, contagem: 'uteis' }
  ];

  /* ======================================================================
     FASE 2 — vocabulário dos módulos novos.

     Declarado aqui, junto do resto, porque enum é vocabulário do domínio e
     não do módulo: o relatório de F2.9 lê `STATUS_LANCAMENTO` sem conhecer
     o financeiro, e o filtro de auditoria lê `ACOES_AUDITORIA` sem conhecer
     o db. Fonte única continua sendo fonte única.
     ====================================================================== */

  // --- F2.5 Financeiro ---------------------------------------------------
  var MODALIDADES_HONORARIO = [
    { id: 'fixo',   label: 'Valor fixo',        descricao: 'Valor fechado, à vista ou parcelado' },
    { id: 'exito',  label: 'Êxito',             descricao: 'Percentual sobre o proveito econômico' },
    { id: 'hora',   label: 'Por hora',          descricao: 'Faturado pelo timesheet' },
    { id: 'mensal', label: 'Mensal (partido)',  descricao: 'Assessoria recorrente' },
    { id: 'misto',  label: 'Fixo + êxito',      descricao: 'Entrada fixa mais percentual no fim' }
  ];

  var STATUS_LANCAMENTO = [
    { id: 'previsto',  label: 'Previsto',  variante: 'neutral' },
    { id: 'em_aberto', label: 'Em aberto', variante: 'primary' },
    { id: 'parcial',   label: 'Parcial',   variante: 'warning' },
    { id: 'pago',      label: 'Pago',      variante: 'success' },
    { id: 'atrasado',  label: 'Atrasado',  variante: 'danger'  },
    { id: 'cancelado', label: 'Cancelado', variante: 'neutral' }
  ];

  var ORIGENS_LANCAMENTO = [
    { id: 'honorario',          label: 'Honorário contratual', tipo: 'receita' },
    { id: 'exito',              label: 'Honorário de êxito',   tipo: 'receita' },
    { id: 'custa',              label: 'Custa processual',     tipo: 'despesa' },
    { id: 'reembolso',          label: 'Despesa reembolsável', tipo: 'despesa' },
    { id: 'repasse',            label: 'Repasse',              tipo: 'despesa' },
    { id: 'despesa_escritorio', label: 'Despesa do escritório',tipo: 'despesa' }
  ];

  var STATUS_BOLETO = [
    { id: 'emitido',   label: 'Emitido',   variante: 'primary' },
    { id: 'pago',      label: 'Pago',      variante: 'success' },
    { id: 'vencido',   label: 'Vencido',   variante: 'danger'  },
    { id: 'cancelado', label: 'Cancelado', variante: 'neutral' }
  ];

  // --- F2.6 CRM ----------------------------------------------------------
  /* Ordinal, não categórico: a ordem É o significado (define as colunas do
     funil e a taxa de conversão entre etapas). */
  var ETAPAS_FUNIL = [
    { id: 'novo',       label: 'Novo',        cor: '#7f9dbf', probabilidade: 10 },
    { id: 'contato',    label: 'Em contato',  cor: '#4f74a0', probabilidade: 25 },
    { id: 'reuniao',    label: 'Reunião',     cor: '#2d5580', probabilidade: 45 },
    { id: 'proposta',   label: 'Proposta',    cor: '#b8873f', probabilidade: 65 },
    { id: 'negociacao', label: 'Negociação',  cor: '#c05621', probabilidade: 80 },
    { id: 'ganho',      label: 'Ganho',       cor: '#2f855a', probabilidade: 100 },
    { id: 'perdido',    label: 'Perdido',     cor: '#8b98a9', probabilidade: 0 }
  ];

  var ORIGENS_LEAD = [
    { id: 'indicacao', label: 'Indicação' },
    { id: 'site',      label: 'Site' },
    { id: 'redes',     label: 'Redes sociais' },
    { id: 'evento',    label: 'Evento' },
    { id: 'retorno',   label: 'Cliente que retornou' },
    { id: 'outro',     label: 'Outro' }
  ];

  var TIPOS_INTERACAO = [
    { id: 'ligacao',  label: 'Ligação',   icone: '📞' },
    { id: 'email',    label: 'E-mail',    icone: '✉' },
    { id: 'reuniao',  label: 'Reunião',   icone: '👥' },
    { id: 'whatsapp', label: 'WhatsApp',  icone: '💬' },
    { id: 'visita',   label: 'Visita',    icone: '📍' },
    { id: 'nota',     label: 'Nota',      icone: '✱' }
  ];

  var STATUS_PROPOSTA = [
    { id: 'rascunho', label: 'Rascunho', variante: 'neutral' },
    { id: 'enviada',  label: 'Enviada',  variante: 'primary' },
    { id: 'aceita',   label: 'Aceita',   variante: 'success' },
    { id: 'recusada', label: 'Recusada', variante: 'danger'  },
    { id: 'expirada', label: 'Expirada', variante: 'warning' }
  ];

  // --- F2.4 Publicações --------------------------------------------------
  var STATUS_PUBLICACAO = [
    { id: 'nova',        label: 'Nova',            variante: 'primary' },
    { id: 'vinculada',   label: 'Vinculada',       variante: 'primary' },
    { id: 'triada',      label: 'Triada',          variante: 'success' },
    { id: 'sem_vinculo', label: 'Sem vínculo',     variante: 'warning' },
    { id: 'descartada',  label: 'Descartada',      variante: 'neutral' }
  ];

  var TIPOS_MONITORAMENTO = [
    { id: 'oab',      label: 'Número de OAB' },
    { id: 'nome',     label: 'Nome da parte' },
    { id: 'cnpj',     label: 'CNPJ do cliente' },
    { id: 'processo', label: 'Processo específico' }
  ];

  // --- F2.2 Notificações -------------------------------------------------
  var TIPOS_NOTIFICACAO = [
    { id: 'prazo_proximo',   label: 'Prazo se aproximando', icone: '⏱', gravidade: 'atencao' },
    { id: 'prazo_hoje',      label: 'Prazo vence hoje',     icone: '⏰', gravidade: 'critica' },
    { id: 'prazo_vencido',   label: 'Prazo vencido',        icone: '🔴', gravidade: 'critica' },
    { id: 'compromisso',     label: 'Compromisso próximo',  icone: '📅', gravidade: 'atencao' },
    { id: 'tarefa_atrasada', label: 'Tarefa atrasada',      icone: '☑', gravidade: 'atencao' },
    { id: 'publicacao_nova', label: 'Publicação nova',      icone: '📰', gravidade: 'info' },
    { id: 'financeiro',      label: 'Financeiro',           icone: '💰', gravidade: 'info' },
    { id: 'follow_up',       label: 'Follow-up de lead',    icone: '🤝', gravidade: 'info' },
    { id: 'digest',          label: 'Resumo do dia',        icone: '📋', gravidade: 'info' }
  ];

  var GRAVIDADES = [
    { id: 'info',    label: 'Informativo', variante: 'primary' },
    { id: 'atencao', label: 'Atenção',     variante: 'warning' },
    { id: 'critica', label: 'Crítica',     variante: 'danger'  }
  ];

  // --- F2.1 Segurança e LGPD ---------------------------------------------
  var ACOES_AUDITORIA = [
    { id: 'criar',      label: 'Criação',     variante: 'success' },
    { id: 'atualizar',  label: 'Alteração',   variante: 'primary' },
    { id: 'remover',    label: 'Exclusão',    variante: 'danger'  },
    { id: 'consultar',  label: 'Consulta',    variante: 'neutral' },
    { id: 'exportar',   label: 'Exportação',  variante: 'warning' },
    { id: 'compartilhar', label: 'Compartilhamento', variante: 'warning' },
    { id: 'entrar',     label: 'Acesso',      variante: 'neutral' }
  ];

  var TIPOS_SOLICITACAO_TITULAR = [
    { id: 'acesso',       label: 'Acesso aos dados',   prazoDias: 15 },
    { id: 'correcao',     label: 'Correção',           prazoDias: 15 },
    { id: 'eliminacao',   label: 'Eliminação',         prazoDias: 15 },
    { id: 'portabilidade',label: 'Portabilidade',      prazoDias: 15 }
  ];

  var BASES_LEGAIS = [
    { id: 'consentimento',   label: 'Consentimento do titular' },
    { id: 'contrato',        label: 'Execução de contrato' },
    { id: 'obrigacao_legal', label: 'Obrigação legal ou regulatória' },
    { id: 'exercicio_direito', label: 'Exercício regular de direito em processo' }
  ];

  /* Recursos da matriz de permissões (F2.1). O `label` aparece na tela de
     perfis; o `id` é o que `permissoes.pode()` recebe. */
  var RECURSOS_PERMISSAO = [
    { id: 'processos.ver',       label: 'Ver processos',            grupo: 'Processos' },
    { id: 'processos.editar',    label: 'Criar e editar processos', grupo: 'Processos' },
    { id: 'processos.segredo',   label: 'Ver processos em segredo de justiça', grupo: 'Processos' },
    { id: 'prazos.baixar',       label: 'Baixar prazos',            grupo: 'Prazos' },
    { id: 'prazos.conferir',     label: 'Conferir prazo de outro',  grupo: 'Prazos' },
    { id: 'documentos.editar',   label: 'Editar documentos',        grupo: 'Documentos' },
    { id: 'documentos.excluir',  label: 'Excluir documentos',       grupo: 'Documentos' },
    { id: 'financeiro.ver',      label: 'Ver o financeiro',         grupo: 'Financeiro' },
    { id: 'financeiro.lancar',   label: 'Lançar e baixar títulos',  grupo: 'Financeiro' },
    { id: 'crm.ver',             label: 'Ver o CRM',                grupo: 'CRM' },
    { id: 'relatorios.ver',      label: 'Ver relatórios',           grupo: 'Relatórios' },
    { id: 'relatorios.todos',    label: 'Ver números de toda a equipe', grupo: 'Relatórios' },
    { id: 'portal.compartilhar', label: 'Compartilhar com cliente', grupo: 'Portal' },
    { id: 'publicacoes.triar',   label: 'Triar publicações',        grupo: 'Publicações' },
    { id: 'configuracoes',       label: 'Configurações do sistema',  grupo: 'Administração' },
    { id: 'auditoria',           label: 'Trilha de auditoria',       grupo: 'Administração' },
    { id: 'usuarios',            label: 'Gerenciar usuários',        grupo: 'Administração' }
  ];

  /** Busca genérica em qualquer lista de enum. */
  function achar(lista, id) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i];
    }
    return null;
  }

  function rotulo(lista, id, fallback) {
    var item = achar(lista, id);
    return item ? item.label : (fallback !== undefined ? fallback : id || '—');
  }

  function cor(lista, id, fallback) {
    var item = achar(lista, id);
    return (item && item.cor) || fallback || 'var(--color-border-strong)';
  }

  /** Converte um enum em <option>s. */
  function opcoes(lista, selecionado, placeholder) {
    var html = placeholder ? '<option value="">' + placeholder + '</option>' : '';
    lista.forEach(function (item) {
      var sel = String(item.id) === String(selecionado) ? ' selected' : '';
      html += '<option value="' + item.id + '"' + sel + '>' + item.label + '</option>';
    });
    return html;
  }

  App.domain.enums = {
    FASES: FASES,
    AREAS: AREAS,
    STATUS_PROCESSO: STATUS_PROCESSO,
    PAPEIS_CLIENTE: PAPEIS_CLIENTE,
    TIPOS_PARTICIPACAO: TIPOS_PARTICIPACAO,
    RISCOS: RISCOS,
    TIPOS_ANDAMENTO: TIPOS_ANDAMENTO,
    STATUS_PRAZO: STATUS_PRAZO,
    PRIORIDADES: PRIORIDADES,
    TIPOS_COMPROMISSO: TIPOS_COMPROMISSO,
    STATUS_TAREFA: STATUS_TAREFA,
    CATEGORIAS_DOCUMENTO: CATEGORIAS_DOCUMENTO,
    FORMATOS_DOCUMENTO: FORMATOS_DOCUMENTO,
    PERFIS: PERFIS,
    INSTANCIAS: INSTANCIAS,
    TRIBUNAIS: TRIBUNAIS,
    TIPOS_PRAZO: TIPOS_PRAZO,

    // Fase 2
    MODALIDADES_HONORARIO: MODALIDADES_HONORARIO,
    STATUS_LANCAMENTO: STATUS_LANCAMENTO,
    ORIGENS_LANCAMENTO: ORIGENS_LANCAMENTO,
    STATUS_BOLETO: STATUS_BOLETO,
    ETAPAS_FUNIL: ETAPAS_FUNIL,
    ORIGENS_LEAD: ORIGENS_LEAD,
    TIPOS_INTERACAO: TIPOS_INTERACAO,
    STATUS_PROPOSTA: STATUS_PROPOSTA,
    STATUS_PUBLICACAO: STATUS_PUBLICACAO,
    TIPOS_MONITORAMENTO: TIPOS_MONITORAMENTO,
    TIPOS_NOTIFICACAO: TIPOS_NOTIFICACAO,
    GRAVIDADES: GRAVIDADES,
    ACOES_AUDITORIA: ACOES_AUDITORIA,
    TIPOS_SOLICITACAO_TITULAR: TIPOS_SOLICITACAO_TITULAR,
    BASES_LEGAIS: BASES_LEGAIS,
    RECURSOS_PERMISSAO: RECURSOS_PERMISSAO,

    achar: achar,
    rotulo: rotulo,
    cor: cor,
    opcoes: opcoes
  };
})(window.App = window.App || {});
