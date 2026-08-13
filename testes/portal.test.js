/* Verificação de F2.3 — portal do cliente e link compartilhado.

   O foco é o que NÃO pode vazar: item não marcado como visível, processo em
   segredo de justiça, link revogado ou expirado, e dado de gestão interna
   (provisão, risco, valor da causa) na tela de quem recebeu o link. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');

function criarStorage() {
  const mapa = new Map();
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k)
  };
}

const janela = {
  localStorage: criarStorage(),
  location: { href: 'https://ejsabreu.github.io/juriscontrol/index.html#/processos' }
};

const sandbox = {
  window: janela, console,
  Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, Error, Map, Set,
  setTimeout, clearTimeout, isNaN, parseInt, parseFloat, isFinite, Uint8Array
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const ARQUIVOS = [
  'src/utils/dom.js', 'src/utils/format.js', 'src/utils/moeda.js',
  'src/utils/csv.js', 'src/utils/token.js',
  'src/domain/enums.js', 'src/domain/feriados.js', 'src/domain/prazos.js',
  'src/domain/cnj.js', 'src/domain/validators.js', 'src/domain/permissoes.js',
  'src/domain/alertas.js',
  'data/seed.js',
  'src/store/store.js',
  'src/services/http.js', 'src/services/db.js',
  'src/services/sessaoService.js', 'src/services/auditoriaService.js',
  'src/services/compartilhamentoService.js'
];

for (const arquivo of ARQUIVOS) {
  const codigo = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
  try {
    vm.runInContext(codigo, sandbox, { filename: arquivo });
  } catch (e) {
    console.error(`✕ FALHA AO CARREGAR ${arquivo}:`, e.message);
    process.exit(1);
  }
}

const App = sandbox.window.App;
let falhas = 0, testes = 0;

function ok(descricao, condicao, detalhe) {
  testes++;
  if (condicao) console.log(`  ✓ ${descricao}`);
  else { falhas++; console.log(`  ✕ ${descricao}${detalhe !== undefined ? ' → ' + detalhe : ''}`); }
}
function secao(t) { console.log(`\n${t}`); }

App.services.http.config.ativarLatencia = false;

(async function () {
  const db = App.services.db;
  const svc = App.services.compartilhamentoService;
  const sessao = App.services.sessaoService;

  db.init(true);
  App.services.auditoriaService.iniciar();

  const usuarios = db.get('usuarios');
  const advogado = usuarios.filter(u => u.perfil === 'advogado')[0];
  const estagiario = usuarios.filter(u => u.perfil === 'estagiario')[0];
  await sessao.entrar(advogado.id);

  /* Dois processos DISTINTOS e sem segredo: um para o fluxo feliz, outro
     para virar segredo de justiça no meio da suíte. Pegar por índice fixo
     faria os dois coincidirem quando o primeiro já nascesse em segredo.

     O primeiro precisa ter andamento VISÍVEL e OCULTO ao mesmo tempo — sem
     isso o filtro de visibilidade passaria no teste sem nunca filtrar nada,
     que é justamente o que este módulo não pode deixar acontecer. */
  const andamentos = db.get('andamentos');
  function contarAndamentos(processoId, visivel) {
    return andamentos.filter(a => a.processoId === processoId &&
                                  a.visivelCliente === visivel).length;
  }

  const abertos = db.get('processos').filter(p => !p.segredoJustica);
  const processo = abertos.filter(p => contarAndamentos(p.id, true) > 0 &&
                                       contarAndamentos(p.id, false) > 0)[0] || abertos[0];
  const secreto = abertos.filter(p => p.id !== processo.id)[0];

  // ===================== TOKEN =====================
  secao('Token autocontido');

  const t = svc.montarToken('PRO-00007', { andamentos: true, documentos: false,
                                           prazos: true, compromissos: false },
                            '2026-12-31', 'a7Bc9dEf12');
  ok('o token tem cinco partes', t.split('.').length === 5, t);

  const lido = svc.decodificar(t);
  ok('decodifica o processo', lido.processoId === 'PRO-00007');
  ok('decodifica o escopo',
     lido.escopo.andamentos === true && lido.escopo.documentos === false &&
     lido.escopo.prazos === true && lido.escopo.compromissos === false,
     JSON.stringify(lido.escopo));
  ok('decodifica a validade', lido.expiraEm === '2026-12-31', lido.expiraEm);
  ok('a soma de verificação confere', lido.integro === true);

  const adulterado = t.replace('PRO-00007', 'PRO-00008');
  ok('token adulterado é detectado', svc.decodificar(adulterado).integro === false);
  ok('token truncado é rejeitado', svc.decodificar('PRO-1.1100') === null);
  ok('token vazio é rejeitado', svc.decodificar('') === null);
  ok('token com data inválida é rejeitado',
     svc.decodificar('PRO-1.1111.abc.nonce.hash') === null);

  ok('a URL usa o hash da própria página',
     svc.montarUrl('XYZ') === 'https://ejsabreu.github.io/juriscontrol/index.html#/portal/XYZ',
     svc.montarUrl('XYZ'));

  // ===================== CRIAÇÃO =====================
  secao('Geração do link');

  const link = await svc.criar({ processoId: processo.id, validadeDias: 30 });
  ok('o link é criado com token', !!link.token);
  ok('o link traz a URL pronta para copiar', link.url.indexOf('#/portal/') !== -1);
  ok('nasce sem acessos', link.totalAcessos === 0);
  ok('nasce sem revogação', link.revogadoEm === null);
  ok('a validade padrão é de 30 dias',
     App.domain.prazos.diasCorridosEntre(App.domain.prazos.hojeISO(), link.expiraEm) === 30,
     link.expiraEm);
  ok('o token do registro decodifica para o mesmo processo',
     svc.decodificar(link.token).processoId === processo.id);
  ok('a geração fica na trilha de auditoria',
     db.get('logsAuditoria').some(l => l.acao === 'compartilhar' &&
                                       l.entidadeId === processo.id));

  let escopoVazio = false;
  try {
    await svc.criar({ processoId: processo.id, escopo: {
      andamentos: false, documentos: false, prazos: false, compromissos: false } });
  } catch (e) { escopoVazio = e.codigo === 400; }
  ok('escopo totalmente vazio é recusado', escopoVazio);

  let inexistente = false;
  try { await svc.criar({ processoId: 'PRO-NAO-EXISTE' }); }
  catch (e) { inexistente = e.codigo === 404; }
  ok('processo inexistente é recusado', inexistente);

  // Segredo de justiça não vai para portal nenhum.
  db.update('processos', secreto.id, { segredoJustica: true, responsavelId: advogado.id });
  let bloqueado = false;
  try { await svc.criar({ processoId: secreto.id }); }
  catch (e) { bloqueado = e.codigo === 409; }
  ok('processo em segredo de justiça NÃO pode ser compartilhado', bloqueado);

  await sessao.entrar(estagiario.id);
  let semPermissao = false;
  try { await svc.criar({ processoId: processo.id }); }
  catch (e) { semPermissao = e.codigo === 403; }
  ok('estagiário não gera link (perfil sem o recurso)', semPermissao);
  await sessao.entrar(advogado.id);

  // ===================== ABERTURA =====================
  secao('Abertura do portal');

  const portal = await svc.abrir(link.token);
  ok('o portal abre com token válido', portal.ok === true, JSON.stringify(portal.motivo));
  ok('traz a capa do processo', portal.processo.numeroCnj === processo.numeroCnj);
  ok('traz o nome do cliente e do responsável',
     !!portal.processo.clienteNome && !!portal.processo.responsavelNome);

  /* O teste que mais importa do módulo: o que NÃO pode aparecer. */
  const camposProibidos = ['valorCausa', 'valorProvisao', 'risco', 'equipeIds',
                           'segredoJustica', 'tags', 'numeroInterno', 'responsavelId',
                           'clienteId'];
  ok('a capa NÃO expõe dados de gestão interna',
     camposProibidos.every(c => portal.processo[c] === undefined),
     camposProibidos.filter(c => portal.processo[c] !== undefined).join(', '));

  const todosAndamentos = db.get('andamentos').filter(a => a.processoId === processo.id);
  const visiveis = todosAndamentos.filter(a => a.visivelCliente === true);
  ok('só andamentos marcados como visíveis aparecem',
     portal.andamentos.length === visiveis.length,
     portal.andamentos.length + ' de ' + todosAndamentos.length);
  ok('há andamento oculto no processo (o filtro é exercitado de verdade)',
     todosAndamentos.length > visiveis.length,
     todosAndamentos.length + ' total, ' + visiveis.length + ' visíveis');
  ok('nenhuma nota interna vaza',
     !portal.andamentos.some(a => a.tipo === 'nota_interna') ||
     visiveis.some(a => a.tipo === 'nota_interna'));
  ok('o andamento no portal não carrega o id do autor',
     portal.andamentos.every(a => a.autorId === undefined));

  const docsVisiveis = db.get('documentos')
    .filter(d => d.processoId === processo.id && d.visivelCliente === true);
  ok('só documentos liberados aparecem',
     portal.documentos.length === docsVisiveis.length,
     portal.documentos.length + ' vs ' + docsVisiveis.length);
  ok('o documento no portal não expõe pasta nem quem enviou',
     portal.documentos.every(d => d.pastaId === undefined && d.uploadPorId === undefined));

  ok('o prazo no portal vira só título e data-limite',
     portal.prazos.every(pz => pz.responsavelId === undefined &&
                               pz.dataInterna === undefined &&
                               pz.semaforo === undefined));
  ok('prazo não marcado como visível não aparece',
     portal.prazos.every(pz =>
       db.find('prazos', pz.id).visivelCliente === true));

  ok('a abertura contou o acesso',
     (await svc.listarDoProcesso(processo.id)).filter(l => l.id === link.id)[0]
       .totalAcessos === 1);
  ok('o acesso ficou registrado',
     (await svc.acessosDe(link.id)).some(a => a.sucesso === true));

  // ===================== ESCOPO =====================
  secao('Escopo do link');

  const soAndamentos = await svc.criar({
    processoId: processo.id,
    escopo: { andamentos: true, documentos: false, prazos: false, compromissos: false }
  });
  const restrito = await svc.abrir(soAndamentos.token);
  ok('escopo restrito ainda abre', restrito.ok === true);
  ok('seção fora do escopo vem vazia',
     restrito.documentos.length === 0 && restrito.prazos.length === 0 &&
     restrito.compromissos.length === 0);
  ok('a seção do escopo continua povoada ou vazia por dados, não por bug',
     restrito.andamentos.length === portal.andamentos.length);

  // ===================== RECUSAS =====================
  secao('Link inválido, expirado e revogado');

  const invalido = await svc.abrir('token-que-nao-existe');
  ok('token inválido não abre', invalido.ok === false);
  ok('a recusa não diz o motivo ao visitante', invalido.motivo === 'invalido');
  ok('a tentativa falha fica registrada',
     db.get('acessosPortal').some(a => a.sucesso === false));

  const expirado = svc.montarToken(processo.id,
    { andamentos: true, documentos: true, prazos: true, compromissos: true },
    '2020-01-01', 'nonceVelho');
  const rExpirado = await svc.abrir(expirado);
  ok('token expirado não abre', rExpirado.ok === false);
  ok('expirado e inválido têm a MESMA resposta (não vaza que o processo existe)',
     rExpirado.motivo === invalido.motivo);

  await svc.revogar(link.id);
  const rRevogado = await svc.abrir(link.token);
  ok('link revogado não abre mais', rRevogado.ok === false);
  ok('revogado tem a mesma resposta dos demais', rRevogado.motivo === 'invalido');
  ok('a revogação fica na trilha de auditoria',
     db.get('logsAuditoria').some(l => l.resumo === 'Link do portal revogado'));
  ok('o histórico de acessos sobrevive à revogação',
     (await svc.acessosDe(link.id)).length > 0);

  const tokenSecreto = svc.montarToken(secreto.id,
    { andamentos: true, documentos: true, prazos: true, compromissos: true },
    '2030-01-01', 'nonceSecreto');
  const rSecreto = await svc.abrir(tokenSecreto);
  ok('token forjado para processo em segredo NÃO abre', rSecreto.ok === false);

  const rAdulterado = await svc.abrir(adulterado);
  ok('token adulterado não abre', rAdulterado.ok === false);

  // ===================== SEM REGISTRO LOCAL =====================
  secao('Link aberto em outro navegador (sem registro local)');

  /* É o caso do GitHub Pages: quem recebe o link não tem o registro no
     localStorage. O token precisa bastar — senão o compartilhamento não
     compartilha nada. */
  const tokenAvulso = svc.montarToken(processo.id,
    { andamentos: true, documentos: true, prazos: false, compromissos: false },
    '2030-01-01', 'nonceAvulso');
  const avulso = await svc.abrir(tokenAvulso);
  ok('link sem registro local ainda abre', avulso.ok === true);
  ok('o portal sinaliza que não há registro local', avulso.registrado === false);
  ok('o escopo do token é respeitado sem o registro',
     avulso.prazos.length === 0 && avulso.andamentos.length > 0);
  ok('o filtro de visibilidade continua valendo',
     avulso.andamentos.length === visiveis.length);
  ok('link COM registro local é sinalizado como registrado',
     (await svc.abrir(soAndamentos.token)).registrado === true);

  // ===================== LISTAGEM =====================
  secao('Gestão dos links');

  const lista = await svc.listarDoProcesso(processo.id);
  ok('lista os links do processo', lista.length >= 2, String(lista.length));
  ok('marca o revogado como inválido', lista.filter(l => l.id === link.id)[0].valido === false);
  ok('marca o vigente como válido',
     lista.filter(l => l.id === soAndamentos.id)[0].valido === true);
  ok('o link revogado continua ATIVO no banco (soft delete é outra coisa)',
     lista.filter(l => l.id === link.id)[0].ativo !== false);
  ok('cada link traz a URL pronta', lista.every(l => l.url.indexOf('#/portal/') !== -1));
  ok('cada link traz quem gerou', lista.every(l => !!l.criadoPor));
  ok('a lista vem da mais recente para a mais antiga',
     lista.length < 2 || lista[0].criadoEm >= lista[1].criadoEm);
  ok('link de outro processo não aparece',
     lista.every(l => l.processoId === processo.id));

  console.log(`\n${'─'.repeat(56)}`);
  console.log(`${testes - falhas}/${testes} verificações passaram`);
  if (falhas) { console.log(`${falhas} FALHA(S)`); process.exit(1); }
})().catch(function (erro) {
  console.error('\n✕ ERRO NÃO TRATADO NA SUÍTE:', erro && (erro.stack || erro.message));
  process.exit(1);
});
