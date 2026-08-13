/* ==========================================================================
   testes/executar.js — roda todas as suítes em sequência

       node testes/executar.js

   A suíte de domínio não tem dependência. As três de interface precisam de
   jsdom (npm install jsdom) — se ele não estiver instalado, elas são
   puladas com aviso e a de domínio roda normalmente.
   ========================================================================== */

const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  { arquivo: 'dominio.test.js',    titulo: 'Domínio (CNJ, prazos, feriados, seed)', precisaJsdom: false },
  { arquivo: 'fundacoes.test.js',  titulo: 'Fundações da fase 2 (moeda, CSV, token, gráficos, banco v3)', precisaJsdom: false },
  { arquivo: 'seguranca.test.js',  titulo: 'Segurança, auditoria e LGPD (F2.1)', precisaJsdom: false },
  { arquivo: 'alertas.test.js',    titulo: 'Alertas, notificações e dupla conferência (F2.2)', precisaJsdom: false },
  { arquivo: 'portal.test.js',     titulo: 'Portal do cliente e link compartilhado (F2.3)', precisaJsdom: false },
  { arquivo: 'publicacoes.test.js', titulo: 'Classificador, triagem e captura do diário (F2.4)', precisaJsdom: false },
  { arquivo: 'financeiro.test.js', titulo: 'Financeiro, boleto FEBRABAN e timesheet (F2.5)', precisaJsdom: false },
  { arquivo: 'crm.test.js',        titulo: 'Funil, propostas e conversão de lead (F2.6)', precisaJsdom: false },
  { arquivo: 'telas.test.js',      titulo: 'Telas e navegação',                     precisaJsdom: true },
  { arquivo: 'interacoes.test.js', titulo: 'Interações (drag & drop, modais)',      precisaJsdom: true },
  { arquivo: 'listeners.test.js',  titulo: 'Regressão de listeners',                precisaJsdom: true }
];

let temJsdom = true;
try {
  require.resolve('jsdom');
} catch (e) {
  temJsdom = false;
}

if (!temJsdom) {
  console.log('\n⚠  jsdom não encontrado — as suítes de interface serão puladas.');
  console.log('   Para rodá-las: npm install jsdom\n');
}

let falharam = 0;
let puladas = 0;

for (const suite of SUITES) {
  if (suite.precisaJsdom && !temJsdom) {
    console.log(`\n${'═'.repeat(60)}\n  ⊘ ${suite.titulo} (pulada)\n${'═'.repeat(60)}`);
    puladas++;
    continue;
  }

  console.log(`\n${'═'.repeat(60)}\n  ${suite.titulo}\n${'═'.repeat(60)}`);

  const resultado = spawnSync(process.execPath, [path.join(__dirname, suite.arquivo)], {
    stdio: 'inherit'
  });

  if (resultado.status !== 0) falharam++;
}

console.log(`\n${'═'.repeat(60)}`);
if (falharam) {
  console.log(`  ${falharam} suíte(s) com falha`);
  process.exit(1);
}
console.log(`  Todas as suítes passaram${puladas ? ` (${puladas} pulada[s])` : ''}`);
