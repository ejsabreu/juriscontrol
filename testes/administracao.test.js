/* Verificação de F2.10 — administração, feriados locais, importação em massa
   e processos vinculados.

   Os dois testes que mais importam:

   1. FERIADO LOCAL MUDA O PRAZO. Cadastrar um dia sem expediente só serve se
      a contagem passar a pular esse dia. Se o cadastro existir e o motor
      ignorar, o sistema mostra uma data errada com toda a confiança — e o
      prazo vence antes do que a tela diz.

   2. A IMPORTAÇÃO NÃO GRAVA PELA METADE. A conferência roda no arquivo
      inteiro antes de qualquer escrita. Um erro na linha 40 não pode deixar
      39 registros gravados e ninguém sabendo se recomeça ou continua. */

const { criarAmbiente, criarPlacar } = require('./ambiente');

const { App } = criarAmbiente();
const { ok, secao, encerrar } = criarPlacar();

(async function () {
  const db = App.services.db;
  const cfg = App.services.configuracaoService;
  const importacao = App.services.importacaoService;
  const processoService = App.services.processoService;
  const prazos = App.domain.prazos;
  const feriados = App.domain.feriados;

  db.init(true);
  App.services.auditoriaService.iniciar();

  const admin = db.get('usuarios').filter(u => u.perfil === 'admin')[0];
  await App.services.sessaoService.entrar(admin.id);

  // ===================== ESCRITÓRIO =====================
  secao('Dados do escritório');

  const padrao = cfg.escritorio();
  ok('há um escritório mesmo sem nada cadastrado', !!padrao.nome);

  const salvo = await cfg.salvarEscritorio({ nome: 'Duarte & Campos Advogados' });
  ok('o nome é salvo', salvo.nome === 'Duarte & Campos Advogados');
  ok('o salvo é o que se lê depois',
     cfg.escritorio().nome === 'Duarte & Campos Advogados');

  /* Campos não informados não podem sumir: um formulário parcial que apaga
     o resto é perda silenciosa de dado. */
  await cfg.salvarEscritorio({ telefone: '1133224455' });
  ok('salvar um campo não apaga os outros',
     cfg.escritorio().nome === 'Duarte & Campos Advogados' &&
     cfg.escritorio().telefone === '1133224455');

  let recusou = false;
  try { await cfg.salvarEscritorio({ cnpj: '11111111111111' }); }
  catch (e) { recusou = e.codigo === 400; }
  ok('CNPJ inválido é recusado pelo dígito verificador', recusou);

  recusou = false;
  try { await cfg.salvarEscritorio({ nome: '   ' }); }
  catch (e) { recusou = e.codigo === 400; }
  ok('escritório sem nome é recusado', recusou);

  // ===================== FERIADOS LOCAIS =====================
  secao('Feriados locais e a contagem de prazo');

  const iso = App.format.toISO;

  /* Escolhe uma quarta-feira contável (fora de fim de semana, feriado e
     recesso do art. 220), para o teste não depender de qual data o
     calendário deste ano em particular trouxe. */
  function quartaContavel() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    for (let i = 0; i < 120; i++) {
      if (d.getDay() === 3 && prazos.ehDiaContavel(iso(d))) return iso(d);
      d.setDate(d.getDate() + 1);
    }
    return null;
  }

  const alvo = quartaContavel();
  ok('achou uma quarta-feira contável para o teste', !!alvo, String(alvo));

  // 3 dias úteis ANTES do alvo — `somarDiasUteis` conta a própria data como
  // dia 1, então somar 4 a partir daqui cai exatamente no alvo.
  const inicio = iso(prazos.subtrairDiasUteis(alvo, 3));
  const antes = iso(prazos.somarDiasUteis(inicio, 4));

  ok('sem feriado local, a contagem cai no dia escolhido', antes === alvo,
     inicio + ' + 4 = ' + antes + ', esperado ' + alvo);

  await cfg.criarFeriado({ data: alvo, nome: 'Aniversário da comarca',
                           comarca: 'São Paulo' });

  ok('o feriado foi gravado',
     db.get('feriadosEscritorio').filter(f => f.data === alvo).length === 1);
  ok('o motor passou a reconhecer a data como feriado',
     !!feriados.ehFeriado(alvo), 'ehFeriado devolveu nulo');
  ok('a data deixou de ser dia útil', !prazos.ehDiaUtil(alvo));

  const depois = iso(prazos.somarDiasUteis(inicio, 4));
  ok('a contagem PULOU o feriado e caiu depois dele', depois > antes,
     antes + ' → ' + depois);

  ok('o feriado local aparece no calendário do período',
     feriados.emPeriodo(alvo, alvo).some(f => f.abrangencia === 'local'));

  /* O nome oficial do feriado nacional vale mais que o rótulo local: se as
     duas datas coincidirem, quem manda é o nacional. */
  const natal = String(new Date().getFullYear() + 1) + '-12-25';
  await cfg.criarFeriado({ data: natal, nome: 'Recesso do escritório' });
  ok('feriado local NÃO sobrescreve o nome do nacional',
     feriados.ehFeriado(natal).nome === 'Natal',
     feriados.ehFeriado(natal).nome);

  let repetiu = false;
  try { await cfg.criarFeriado({ data: alvo, nome: 'Outro', comarca: 'São Paulo' }); }
  catch (e) { repetiu = e.codigo === 409; }
  ok('não aceita dois feriados na mesma data e comarca', repetiu);

  let dataRuim = false;
  try { await cfg.criarFeriado({ data: '25/12/2027', nome: 'Natal' }); }
  catch (e) { dataRuim = e.codigo === 400; }
  ok('recusa data fora do formato ISO', dataRuim);

  /* O motor guarda a própria cópia dos feriados em memória. Restaurar um
     backup troca o banco inteiro — se ninguém reinjetar, a contagem segue
     usando o calendário de ANTES da restauração, e ninguém percebe. */
  secao('Feriados sobrevivem à restauração de backup');

  // Mesma estrutura que `baixarBackup` serializa — ele grava um arquivo e
  // não devolve o conteúdo, então montamos o pacote aqui.
  const textoBackup = JSON.stringify({
    geradoEm: new Date().toISOString(),
    versao: db.CHAVE,
    dados: db.getTodosOsDados()
  });

  await cfg.removerFeriado(
    db.get('feriadosEscritorio').filter(f => f.data === alvo)[0].id);
  ok('removido o feriado, a data volta a ser dia útil', prazos.ehDiaUtil(alvo));

  await App.services.privacidadeService.restaurarBackup(textoBackup);
  ok('restaurado o backup, o feriado volta a valer no MOTOR',
     !prazos.ehDiaUtil(alvo), 'o motor continuou com o calendário antigo');

  await cfg.removerFeriado(
    db.get('feriadosEscritorio').filter(f => f.data === alvo)[0].id);
  ok('a data volta a ser útil depois da limpeza', prazos.ehDiaUtil(alvo));

  // ===================== TIPOS DE PRAZO =====================
  secao('Tipos de prazo do escritório');

  const totalPadrao = App.domain.enums.TIPOS_PRAZO.length;
  ok('parte-se dos tipos do CPC', cfg.tiposPrazo().length === totalPadrao);

  const novoTipo = await cfg.criarTipoPrazo({ label: 'Manifestação sobre laudo', dias: 15 });
  ok('o tipo criado entra na lista', cfg.tiposPrazo().length === totalPadrao + 1);
  ok('o tipo criado é marcado como do escritório', novoTipo.doEscritorio === true);
  ok('a contagem padrão é em dias úteis', novoTipo.contagem === 'uteis');

  let duplicado = false;
  try { await cfg.criarTipoPrazo({ label: 'Manifestação sobre laudo', dias: 10 }); }
  catch (e) { duplicado = e.codigo === 409; }
  ok('não aceita dois tipos com o mesmo nome', duplicado);

  let semDias = false;
  try { await cfg.criarTipoPrazo({ label: 'Sem prazo' }); }
  catch (e) { semDias = e.codigo === 400; }
  ok('tipo sem quantidade de dias é recusado', semDias);

  /* Remover um tipo do CPC deixaria prazos JÁ GRAVADOS apontando para nada.
     A recusa é o comportamento correto, não uma limitação. */
  let protegido = false;
  try { await cfg.removerTipoPrazo(App.domain.enums.TIPOS_PRAZO[0].id); }
  catch (e) { protegido = e.codigo === 409; }
  ok('tipo padrão do sistema não pode ser removido', protegido);

  await cfg.removerTipoPrazo(novoTipo.id);
  ok('tipo do escritório pode ser removido', cfg.tiposPrazo().length === totalPadrao);

  // ===================== PREFERÊNCIAS =====================
  secao('Preferências por usuário');

  const outro = db.get('usuarios').filter(u => u.id !== admin.id)[0];

  await cfg.salvarPreferencias(admin.id, { telaInicial: '#/agenda' });
  ok('a preferência é salva', cfg.preferencias(admin.id).telaInicial === '#/agenda');
  ok('a preferência de um usuário NÃO vaza para outro',
     cfg.preferencias(outro.id).telaInicial === '#/');
  ok('campos não informados mantêm o padrão',
     cfg.preferencias(admin.id).itensPorPagina === 15);

  // ===================== IMPORTAÇÃO POR CSV =====================
  secao('Importação em massa — conferência');

  const cabecalhoClientes = 'nome;cpfCnpj;tipo;email;telefone;cidade;uf';

  const csvBom =
    cabecalhoClientes + '\n' +
    'Aurora Tecidos Ltda;19131243000197;PJ;contato@aurora.com.br;1133445566;Santos;SP\n' +
    'Belmiro Tavares Rocha;52998224725;PF;belmiro@exemplo.com;11988776655;São Paulo;SP';

  const bom = await importacao.conferir('clientes', csvBom);
  ok('as duas linhas são válidas', bom.validas.length === 2, String(bom.validas.length));
  ok('não há erros', bom.erros.length === 0);
  ok('a importação é autorizada', bom.podeImportar === true);

  /* Um arquivo com erro na segunda linha não pode gravar a primeira: a
     conferência é do arquivo inteiro, antes de qualquer escrita. */
  const antesDaConferencia = db.get('pessoas').length;
  const csvMisto =
    cabecalhoClientes + '\n' +
    'Cecília Nunes Prado;11144477735;PF;cecilia@exemplo.com;11955443322;Campinas;SP\n' +
    'Documento Errado Ltda;99999999999999;PJ;x@x.com;1130000000;Bauru;SP\n' +
    ';52998224725;PF;sem.nome@exemplo.com;11900000000;Osasco;SP';

  const misto = await importacao.conferir('clientes', csvMisto);
  ok('CONFERIR NÃO GRAVA NADA', db.get('pessoas').length === antesDaConferencia,
     antesDaConferencia + ' → ' + db.get('pessoas').length);
  ok('o CNPJ inválido é apontado',
     misto.erros.some(e => e.campo === 'cpfCnpj' && /CNPJ/.test(e.motivo)));
  ok('o nome vazio é apontado',
     misto.erros.some(e => e.campo === 'nome' && /obrigat/.test(e.motivo)));
  ok('o erro aponta o NÚMERO DA LINHA do arquivo',
     misto.erros.every(e => typeof e.linha === 'number' && e.linha >= 2));
  ok('a linha 3 é a do CNPJ inválido',
     misto.erros.some(e => e.linha === 3 && e.campo === 'cpfCnpj'));
  ok('a linha boa continua importável', misto.validas.length === 1);

  const semColuna = await importacao.conferir('clientes', 'email;telefone\nx@x.com;119');
  ok('coluna obrigatória ausente é detectada',
     semColuna.colunasFaltando.indexOf('nome') !== -1);
  ok('sem a coluna obrigatória, a importação é bloqueada',
     semColuna.podeImportar === false);

  const comExtra = await importacao.conferir('clientes',
    cabecalhoClientes + ';observacao\nZilda Moraes;11144477735;PF;z@x.com;119;Jundiaí;SP;nota');
  ok('coluna desconhecida é avisada, não fatal',
     comExtra.colunasIgnoradas.indexOf('observacao') !== -1 &&
     comExtra.podeImportar === true);

  let vazio = false;
  try { await importacao.conferir('clientes', ''); }
  catch (e) { vazio = e.codigo === 400; }
  ok('arquivo vazio é recusado', vazio);

  let layoutRuim = false;
  try { await importacao.conferir('inexistente', csvBom); }
  catch (e) { layoutRuim = e.codigo === 400; }
  ok('layout desconhecido é recusado', layoutRuim);

  secao('Importação em massa — gravação');

  const antesClientes = db.get('pessoas').length;
  const resultado = await importacao.importar('clientes', bom);
  ok('os dois clientes foram criados', resultado.criados === 2, String(resultado.criados));
  ok('o banco cresceu exatamente isso',
     db.get('pessoas').length === antesClientes + 2);
  ok('o importado é marcado como cliente',
     db.get('pessoas').filter(p => p.nome === 'Aurora Tecidos Ltda')[0].ehCliente === true);
  ok('o CPF/CNPJ é gravado só com dígitos',
     db.get('pessoas').filter(p => p.nome === 'Aurora Tecidos Ltda')[0].cpfCnpj ===
     '19131243000197');
  ok('a importação deixa rastro na auditoria',
     db.get('logsAuditoria').some(l => /Importação por CSV/.test(l.resumo || '')));

  /* Reimportar o MESMO arquivo não pode duplicar o cadastro: quem repete o
     envio por engano precisa terminar com dois registros, não quatro. */
  const reconferido = await importacao.conferir('clientes', csvBom);
  ok('a reconferência avisa que já existem', reconferido.avisos.length === 2,
     String(reconferido.avisos.length));

  const depoisDeRepetir = db.get('pessoas').length;
  const repetida = await importacao.importar('clientes', reconferido);
  ok('reimportar não cria nada', repetida.criados === 0 && repetida.pulados === 2);
  ok('o banco não cresceu na reimportação',
     db.get('pessoas').length === depoisDeRepetir);

  let semConferencia = false;
  try { await importacao.importar('clientes', null); }
  catch (e) { semConferencia = e.codigo === 409; }
  ok('importar sem conferir é recusado', semConferencia);

  secao('Importação de processos');

  const csvProcessos =
    'numeroCnj;clienteCpfCnpj;clienteNome;areaId;assunto;tribunalId;comarca;vara;valorCausa\n' +
    ';52998224725;Belmiro Tavares Rocha;civel;Ação de cobrança;tjsp;Santos;2ª Vara Cível;15000,00\n' +
    '0000001-11.2023-8.26.0100;11144477735;Cliente Novo Importado;civel;Indenização;tjsp;' +
    'São Paulo;1ª Vara Cível;abc';

  const proc = await importacao.conferir('processos', csvProcessos);
  ok('o CNJ com dígito verificador errado é apontado',
     proc.erros.some(e => e.campo === 'numeroCnj'));
  ok('valor não numérico é apontado — não vira R$ 0,00 calado',
     proc.erros.some(e => e.campo === 'valorCausa'));
  ok('a linha sem CNJ é aceita — nem todo processo tem número ainda',
     proc.validas.length === 1);

  const antesProcessos = db.get('processos').length;
  const rProc = await importacao.importar('processos', proc);
  ok('o processo foi criado', rProc.criados === 1);
  ok('o banco de processos cresceu 1',
     db.get('processos').length === antesProcessos + 1);

  const importado = db.get('processos')[db.get('processos').length - 1];
  ok('o processo importado apontou para o cliente JÁ EXISTENTE',
     db.get('pessoas').filter(p => p.id === importado.clienteId)[0].nome ===
     'Belmiro Tavares Rocha');
  ok('o valor da causa foi convertido para centavos',
     importado.valorCausa === 1500000, String(importado.valorCausa));
  ok('o importado é marcado com a etiqueta',
     (importado.tags || []).indexOf('importado') !== -1);

  const modeloCampos = importacao.LAYOUTS.processos.campos.map(c => c.campo);
  ok('o layout de processos declara o cliente',
     modeloCampos.indexOf('clienteNome') !== -1);

  // ===================== PROCESSOS VINCULADOS =====================
  secao('Processos vinculados (apensos)');

  const visiveis = db.get('processos').filter(p => !p.segredoJustica);
  const principal = visiveis[0];
  const apenso = visiveis[1];

  await processoService.vincular(apenso.id, principal.id);

  const detalhePrincipal = await processoService.obter(principal.id);
  ok('o principal lista o apenso',
     detalhePrincipal.apensos.some(a => a.id === apenso.id));

  const detalheApenso = await processoService.obter(apenso.id);
  ok('o apenso aponta para o principal',
     detalheApenso.processoPai && detalheApenso.processoPai.id === principal.id);
  ok('o apenso não lista a si mesmo', detalheApenso.apensos.length === 0);

  /* A checagem de ciclo não é preciosismo: A → B → A faria a árvore de
     apensos recorrer para sempre e travar o navegador. */
  let ciclo = false;
  try { await processoService.vincular(principal.id, apenso.id); }
  catch (e) { ciclo = e.codigo === 409; }
  ok('vínculo que criaria CICLO é recusado', ciclo);

  let euMesmo = false;
  try { await processoService.vincular(principal.id, principal.id); }
  catch (e) { euMesmo = e.codigo === 400; }
  ok('processo não pode ser apenso de si mesmo', euMesmo);

  await processoService.vincular(apenso.id, null);
  ok('o vínculo pode ser desfeito',
     (await processoService.obter(apenso.id)).processoPai === null);
  ok('desfeito o vínculo, o principal não lista mais o apenso',
     (await processoService.obter(principal.id)).apensos.length === 0);

  secao('Segredo de justiça no vínculo');

  /* O vínculo NÃO pode virar uma porta lateral: um processo em segredo que
     esteja apenso a outro não aparece para quem não pode vê-lo. É a mesma
     regra do resto do sistema, aplicada na camada de dados. */
  const secreto = db.get('processos').filter(p => p.segredoJustica)[0];
  ok('o seed tem processo em segredo para o teste', !!secreto);

  const socio = db.get('usuarios').filter(u => u.perfil === 'socio')[0];
  await App.services.sessaoService.entrar(socio.id);
  await processoService.vincular(secreto.id, principal.id);

  const estagiario = db.get('usuarios').filter(u =>
    u.perfil === 'estagiario' || u.perfil === 'financeiro')[0];
  await App.services.sessaoService.entrar(estagiario.id);

  const semSegredo = await processoService.obter(principal.id);
  ok('quem não vê o processo em segredo NÃO o vê como apenso',
     !semSegredo.apensos.some(a => a.id === secreto.id),
     JSON.stringify(semSegredo.apensos.map(a => a.id)));

  await App.services.sessaoService.entrar(socio.id);
  const comSegredo = await processoService.obter(principal.id);
  ok('quem tem permissão continua enxergando o apenso em segredo',
     comSegredo.apensos.some(a => a.id === secreto.id));

  encerrar();
})();
