# JurisControl — Planejamento da Fase 2

Companheiro de [PLANEJAMENTO.md](PLANEJAMENTO.md). Aquele documento descreve o que
existe; este descreve o que falta para o protótipo cobrir **todos** os pilares de um
software jurídico de mercado — inclusive os que dependem de backend, que entram como
**simulação declarada**.

As convenções da fase 1 continuam valendo sem exceção: IIFE registrando em `window.App`,
services `async` mesmo sem rede, soft delete em tudo, dinheiro em centavos inteiros, datas
em ISO `YYYY-MM-DD`, um nó de conteúdo novo por rota, `ligarEventos()` só no `render()`.

---

## 0. As três regras da simulação

O protótipo já tinha uma postura sobre isso na aba de documentos ("o binário não é
persistido — é a mentira mínima necessária"). A fase 2 transforma essa postura em regra,
porque agora 5 dos 9 módulos dependem de coisas que não existem sem servidor.

**Regra 1 — nada finge ser real.** Todo recurso simulado exibe o selo de simulação na
própria tela, dizendo o que é falso e o que entra no lugar na fase 3. Componente novo:
`ui.SeloSimulado({ oque, naFase3 })`.

**Regra 2 — a simulação mora num lugar só.** Tudo que na fase 3 vira chamada de rede fica
sob `src/services/simulado/`, com a **assinatura final já correta**. Trocar por `fetch` é
apagar o corpo, não redesenhar a chamada.

```js
// services/simulado/iaService.js — HOJE
async function gerarPeca(p) { await http.delay(1200); return montarPorTemplate(p); }

// services/iaService.js — FASE 3
async function gerarPeca(p) { return http.post('/api/ia/peca', p); }
```

**Regra 3 — a lógica que pode ser real, é real.** Cálculo de honorário de êxito, dígito
verificador de boleto, aging de recebíveis, classificação de publicação por palavra-chave,
matriz de permissões, contagem de prazo de alerta — tudo isso é matemática e regra, não
depende de servidor, e vai para `src/domain/` como código puro e testado. Só o
*transporte* é simulado.

---

## 1. Ordem de execução

A ordem abaixo é de **dependência**, não de valor. Segurança vem cedo porque replumba
todas as telas existentes; relatórios vêm por último porque consomem os dados de todos os
outros módulos.

| # | Módulo | Depende de | Peso |
|---|--------|-----------|------|
| **F2.0** | Fundações (banco v3, enums, auditoria, selo, gráficos) ✅ | — | P |
| **F2.1** | Segurança, perfis e LGPD ✅ | F2.0 | G |
| **F2.2** | Alertas e notificações ✅ | F2.0 | M |
| **F2.3** | Portal do cliente e link compartilhado ✅ | F2.0, F2.1 | M |
| **F2.4** | Publicações e integração com tribunais | F2.0, F2.2 | G |
| **F2.5** | Módulo financeiro | F2.0, F2.1 | G |
| **F2.6** | CRM e prospecção | F2.0, F2.5 | M |
| **F2.7** | Documentos avançados (modelos, busca, assinatura) | F2.0 | M |
| **F2.8** | Assistente (IA) | F2.4, F2.7 | M |
| **F2.9** | Relatórios e BI | F2.2, F2.5, F2.6 | M |
| **F2.10** | Administração e complementos | F2.1 | M |

**Atalho possível:** se a prioridade for demonstrar valor rápido, **F2.3 (portal)** pode
saltar para logo depois de F2.0 — ele só precisa de permissões rudimentares, e os campos
`visivelCliente` já existem em documentos, andamentos e prazos.

---

## F2.0 — Fundações ✅ concluída

Sem isso, cada módulo seguinte reinventaria a mesma peça.

### O que entra

**Banco v3.** `db.js` sobe `CHAVE` de `jurisctrl.db.v2` para `jurisctrl.db.v3`, o que
descarta o banco antigo e regenera o seed (o protótipo não tem migração — decisão da fase 1).
Coleções novas registradas de uma vez, mesmo que vazias até o módulo chegar:

```
publicacoes · monitoramentos · sincronizacoes
contratos · lancamentos · boletos · repasses · apontamentos
leads · interacoes · propostas
notificacoes · regrasAlerta · caixaSaida
linksCompartilhados · acessosPortal
logsAuditoria · consentimentos · solicitacoesTitular
modelosPeca · assinaturas · acessosDocumento
feriadosEscritorio · configuracoes
```

**Auditoria por baixo.** `db.js` ganha um gancho: toda escrita passa por
`registrarAuditoria(colecao, acao, antes, depois)`. Fica desligado por padrão e é ativado
em F2.1 — mas o ponto de entrada nasce agora, senão vira retrofit em 12 services.

**Enums novos** em `domain/enums.js`, seguindo o formato existente
(`{ id, label, cor|variante }`): `MODALIDADES_HONORARIO`, `STATUS_LANCAMENTO`,
`ORIGENS_LANCAMENTO`, `ETAPAS_FUNIL`, `ORIGENS_LEAD`, `TIPOS_INTERACAO`,
`STATUS_PUBLICACAO`, `TIPOS_MONITORAMENTO`, `TIPOS_NOTIFICACAO`, `ACOES_AUDITORIA`,
`TIPOS_SOLICITACAO_TITULAR`, `RECURSOS_PERMISSAO`.

**Utilitários:**
- `utils/moeda.js` — centavos ⇄ string, soma, percentual, extenso. Nunca `float`
  (decisão arquitetural 7 da fase 1).
- `utils/csv.js` — gera e **lê** CSV (a leitura é para a importação em massa de F2.10).
- `utils/token.js` — gera token opaco de compartilhamento e hash simples para
  anonimização.

**Componentes base novos:**
- `components/SeloSimulado.js` — a etiqueta da Regra 1.
- `components/Chart.js` — SVG puro, sem biblioteca: barras, linhas, donut e sparkline.
  Cores vindas de `tokens.css`, legendas acessíveis, `<title>` em cada série. Usado por
  F2.5, F2.9 e pelo dashboard.
- `components/Stepper.js` — fluxos de várias etapas (conversão de lead, emissão de boleto).
- `components/DateRangePicker.js` — período, usado por todo relatório.

### Passos — todos executados

1. ✅ `CHAVE` em `jurisctrl.db.v3`, 24 coleções da fase 2 declaradas vazias
2. ✅ `db.configurarAuditoria(fn)` — gancho plugável, nasce desligado, e uma
   auditoria com defeito **não derruba** a operação auditada (há teste para isso)
3. ✅ 16 enums novos em `domain/enums.js`
4. ✅ `utils/moeda.js`, `utils/csv.js`, `utils/token.js`
5. ✅ `SeloSimulado`, `Chart`, `Stepper`, `DateRangePicker` + tokens e CSS
6. ✅ Scripts registrados em `index.html`
7. ✅ `testes/fundacoes.test.js` — 206 verificações, sem jsdom

### Medição do teto de armazenamento

Feita com `db.diagnostico()`, que ficou no código como ferramenta permanente:

```
ocupação atual: 0,52 MB de 5 MB (10,4%)
maiores coleções: andamentos 177 KB · pessoas 68 KB · prazos 64 KB
```

**Conclusão: há folga.** A fase 1 usa um décimo do teto, então o seed
financeiro pode entrar com os 18 meses previstos em F2.5 sem redução. O
`diagnostico()` volta a ser rodado ao fim de F2.5 e de F2.9, que são os dois
módulos que mais geram registro.

### Decisões tomadas durante a implementação

- **A paleta de gráfico é validada, não escolhida.** Os 8 slots categóricos em
  `tokens.css` passaram por simulação de protanopia e deuteranopia contra as
  superfícies reais do sistema (`#ffffff` e `#17212f`): pior par adjacente
  ΔE 9,1 no claro e 8,4 no escuro; em visão normal, 19,6 e 19,3. A **ordem** dos
  slots é o mecanismo de segurança — por isso `Chart.js` atribui em sequência e
  **dobra a 9ª série em "Outros"** em vez de ciclar cores.
- **Não existe segundo eixo Y.** Não é convenção: não há prop para isso, e há um
  teste que falha se alguém acrescentar uma. Duas medidas de escalas diferentes
  viram dois gráficos.
- **A visão de tabela do gráfico é obrigatória.** Três slots ficam abaixo de 3:1
  de contraste no tema claro, e a regra é que isso exige um canal de alívio.
  Além de acessibilidade, é o que o advogado quer: o número.
- **`ratear()` fecha a conta.** Parcelamento distribui o resto nas primeiras
  parcelas; o teste percorre ~700 combinações conferindo que a soma bate. É a
  base do gerador de parcelas de F2.5.
- **Máscara de CPF na convenção brasileira** (`***.456.789-**`) — a primeira
  versão escondia o miolo e mostrava o verificador, que é o contrário do que se
  usa e do que o titular reconhece.

---

## F2.1 — Segurança, perfis e LGPD ✅ concluída

Hoje `Usuario.perfil` é um rótulo na topbar e `segredoJustica` é um campo que não restringe
nada. Este módulo transforma campos mortos em comportamento.

### Real × simulado

| Real | Simulado |
|------|----------|
| Matriz de permissões e sua aplicação em toda a UI | Autenticação (seleção de usuário, sem senha) |
| Regra de segredo de justiça | "Criptografia em repouso" (indicador, não cifra) |
| Trilha de auditoria completa | Backup automático (botão que baixa JSON) |
| Exportação e anonimização de dados do titular | Envio de e-mail ao titular |

### Modelo

```js
// Sessao (só em memória + store, não persiste)
{ usuarioId, iniciadaEm, expiraEm, perfil, permissoes: [] }

// LogAuditoria
{ id, quando, usuarioId, acao, colecao, entidadeId,
  antes, depois, origem: 'ui'|'sistema'|'portal', ip }

// ConsentimentoLGPD
{ id, pessoaId, finalidade, base: 'consentimento'|'contrato'|'obrigacao_legal',
  concedidoEm, revogadoEm, textoVersao }

// SolicitacaoTitular
{ id, pessoaId, tipo: 'acesso'|'correcao'|'eliminacao'|'portabilidade',
  solicitadoEm, prazoAtendimento, status, respondidoEm, respostaTexto, arquivoGeradoId }
```

### Domínio — `domain/permissoes.js` (puro, testável)

```js
pode(usuario, 'financeiro.ver')            // matriz perfil × recurso × ação
podeVerProcesso(usuario, processo)         // segredo de justiça: equipe + responsável + admin
filtrarPorPermissao(usuario, lista, tipo)  // devolve só o que o usuário pode ver
nivelDocumento(usuario, documento)         // 'editar' | 'ver' | 'negado'
```

Matriz inicial:

| Recurso | admin | socio | advogado | estagiario | financeiro |
|---------|:---:|:---:|:---:|:---:|:---:|
| processos.ver / editar | ✔✔ | ✔✔ | ✔✔ | ✔✖ | ✔✖ |
| processos.segredo | ✔ | ✔ | equipe | ✖ | ✖ |
| financeiro.ver / lançar | ✔✔ | ✔✔ | ✖✖ | ✖✖ | ✔✔ |
| relatorios.ver | ✔ | ✔ | próprios | ✖ | financeiros |
| configuracoes / auditoria | ✔ | ✖ | ✖ | ✖ | ✖ |
| portal.compartilhar | ✔ | ✔ | ✔ | ✖ | ✖ |

### Telas

| Rota | Tela |
|------|------|
| `#/entrar` | Seleção de usuário — **sem casca**, com o selo dizendo que não há senha |
| `#/configuracoes/usuarios` | Usuários, perfis, OAB, ativar/desativar |
| `#/auditoria` | Trilha filtrável por usuário, período, coleção e ação; diff antes/depois |
| `#/privacidade` | Consentimentos, solicitações de titular, política de retenção |

### Passos — todos executados

1. ✅ `domain/permissoes.js` — matriz pura, com teste que trava a divergência entre ela
   e `enums.RECURSOS_PERMISSAO` (a tela de perfis lê da mesma fonte que o sistema aplica)
2. ✅ `sessaoService.js` + `LoginPage.js` (rota pública e **sem casca**)
3. ✅ `auditoriaService.js` plugado no gancho de F2.0
4. ✅ `pode()` aplicado na `Sidebar` e — **decisão diferente da planejada** — no
   **roteador**, não no `AppShell` (ver abaixo)
5. ✅ `podeVerProcesso` dentro de `processoService`: lista, detalhe **e estatísticas**
6. ✅ `AuditoriaPage` com o diff campo a campo e exportação CSV
7. ✅ `PrivacidadePage` — dossiê, portabilidade JSON/CSV, anonimização, consentimentos,
   solicitações com o prazo do art. 18
8. ✅ Backup e restauração em JSON, com validação do arquivo
9. ✅ `ConfiguracoesPage` — usuários e a matriz em grade *(não estava no plano; sem ela,
   `PERFIS` continuaria sendo um enum que ninguém vê)*
10. ✅ `testes/seguranca.test.js` — 125 verificações, sem jsdom, mais a guarda de acesso
    exercitada de ponta a ponta em `telas.test.js`

### Decisões tomadas durante a implementação

- **A guarda de rota mora no roteador, não no `AppShell`.** O plano dizia AppShell; ao
  implementar ficou claro que a decisão de entrar ou desviar precisa acontecer **antes**
  de a página ser instanciada, e o roteador é quem sabe disso. O roteador continua
  genérico: `App.router.definirGuarda(fn)` recebe a regra de fora, e quem a escreve é o
  `main.js`. `registrar()` ganhou `{ permissao, publica, semCasca }`.
- **Rota "sem casca" nasceu aqui e serve a F2.3.** A entrada esvazia os slots da sidebar
  e da topbar de verdade, não os esconde por CSS — a topbar traz busca global e troca de
  tema, e nada disso pode existir para quem ainda não entrou. O portal do cliente vai
  reusar o mesmo mecanismo.
- **Recusa de processo em segredo é 404, não 403.** Responder "sem permissão" já revelaria
  que o processo existe. Para quem não pode vê-lo, ele não existe.
- **"Eliminar" é anonimizar, e a tela diz isso.** O art. 18, VI convive com o art. 16, III
  (guarda para exercício regular de direito em processo) e com a decisão nº 2 do projeto.
  Um processo não pode perder a identificação da parte; prometer um DELETE que seria
  ilegal cumprir é pior que explicar a regra.
- **A trilha guarda o diff, não o objeto inteiro.** Antes/depois completos estourariam o
  localStorage em poucas centenas de edições — e o diff é exatamente o que a tela mostra.
- **Duas barreiras contra recursão na auditoria**: a coleção `logsAuditoria` é ignorada
  pelo gancho e há trava de reentrância. Gravar o log é uma escrita; sem isso, a primeira
  alteração viraria laço infinito.

### Dois defeitos encontrados pelos testes

**1. O seed não tinha administrador.** Os perfis do seed iam de sócio a financeiro, sem
`admin`. Com as telas de Configurações, Auditoria e Privacidade restritas ao
administrador, elas seriam **inalcançáveis no protótipo real**. O seed passou a ter 9
usuários, com um administrador, e há teste travando os cinco perfis povoados.

**2. `db.init()` regenerava o banco a cada chamada.** Quatro telas chamam `db.init()`
defensivamente ao renderizar. Sem storage — o caso comum sob `file://` — `carregar()`
devolve `null` e o seed inteiro era **regerado**, descartando tudo o que existia em
memória. O bug é da fase 1 e passou despercebido porque o seed é determinístico:
regenerar produzia dados idênticos. A trilha de auditoria, que nasce em tempo de execução
e não no seed, foi o primeiro dado a sumir de forma visível. `init()` agora é idempotente,
e há teste para isso.

### Limite novo, registrado

Sob `file://` o `localStorage` costuma estar indisponível, e nesse caso **a sessão não
sobrevive ao recarregamento** — é preciso entrar de novo a cada F5. O banco já tinha
fallback em memória; a sessão herda a mesma limitação.

---

## F2.2 — Alertas e notificações ✅ concluída

O motor de prazo é o melhor pedaço do protótipo e hoje ele não avisa ninguém.

### Real × simulado

| Real | Simulado |
|------|----------|
| Cálculo de quais alertas existem hoje (dias úteis, via `domain/prazos.js`) | Envio de e-mail / push |
| Central de notificações in-app | Agendamento em servidor (roda no bootstrap e a cada 5 min) |
| Dupla conferência de prazo | |

### Modelo

```js
// RegraAlerta
{ id, usuarioId,                      // null = regra do escritório
  gatilho: 'prazo'|'compromisso'|'tarefa'|'publicacao'|'financeiro',
  antecedenciaDias: [5, 3, 1, 0],     // em dias ÚTEIS para prazo, corridos para o resto
  canais: ['app', 'email'], horaEnvio, ativo }

// Notificacao
{ id, usuarioId, tipo, titulo, mensagem, entidadeColecao, entidadeId,
  gravidade: 'info'|'atencao'|'critica', quando, lidaEm, arquivadaEm }

// CaixaSaida  (o e-mail que teria sido enviado)
{ id, para, assunto, corpoHtml, geradaEm, notificacaoIds: [], status: 'simulada' }
```

### Domínio — `domain/alertas.js`

Função pura `avaliar(estado, hoje)` → lista de notificações que **deveriam** existir.
Idempotente: rodar duas vezes no mesmo dia não duplica. Reusa `prazos.diasUteisEntre`.

### Mudanças no que já existe

- `Prazo` ganha `conferidoPorId`, `conferidoEm`, `motivoPerda`
- Baixar prazo passa a exigir conferência de um segundo usuário quando a regra do
  escritório estiver ligada; marcar `perdido` exige `motivoPerda` preenchido
- `Topbar` ganha o sino com badge e o painel `NotificationCenter.js`

### Passos — todos executados

1. ✅ `domain/alertas.js` — puro, com a data injetável (nenhum teste depende do relógio)
2. ✅ `notificacaoService.js`, `regraAlertaService.js`, `simulado/emailService.js`
3. ✅ `NotificationCenter.js` no `Topbar`
4. ✅ Avaliação no bootstrap, **a cada troca de rota** e a cada 5 min
5. ✅ `#/notificacoes` e a aba **Alertas e prazos** em `#/configuracoes`
6. ✅ `#/caixa-de-saida` com a prévia do e-mail renderizada
7. ✅ Dupla conferência e motivo de perda no `PrazoCard` e no `ProcessoDetalhePage`
8. ✅ Resumo do dia, gerado a partir das 8h
9. ✅ `testes/alertas.test.js` — 88 verificações, mais as telas em `telas.test.js`

### Decisões tomadas durante a implementação

- **A idempotência vem da CHAVE, não de um controle de "já rodei hoje".** Cada aviso
  carrega `tipo:entidade:marco`, e o marco é o que distingue "faltam 5 dias" de "faltam
  3 dias" no mesmo prazo. Onde a repetição diária É desejada — prazo vencido, resumo do
  dia — o marco vira a data. Assim o avaliador pode rodar quantas vezes quiser.
- **Duas unidades de contagem, e a tela diz qual é qual.** Prazo processual conta em dias
  **úteis**, pelo mesmo motor do art. 219; compromisso, tarefa e financeiro contam em dias
  **corridos** — audiência não adia por cair no sábado.
- **Os gatilhos de F2.4, F2.5 e F2.6 já estão escritos** e ficam quietos enquanto as
  coleções estiverem vazias. Publicação nova, título a vencer e follow-up de lead vão
  funcionar assim que os módulos donos existirem, sem tocar em `alertas.js`.
- **Publicação nova gera UM aviso por dia para o lote**, não um por publicação: trinta
  avisos idênticos no sino equivalem a nenhum.
- **A dupla conferência é uma trava, não um botão escondido.** `prazoService.conferir()`
  recusa com 409 quem executou a baixa e com 403 quem não tem o recurso. `cumprir()` passou
  a gravar `cumpridoPorId` — sem isso não haveria como saber quem não pode conferir.
- **O resumo do dia só é gerado a partir das 8h.** Antes disso ele estaria incompleto, e um
  resumo incompleto é pior que resumo nenhum.
- **`regraAlertaService.salvar()` materializa TODAS as regras na primeira gravação.** Salvar
  só a alterada deixaria o escritório com uma regra sua e cinco inexistentes, e
  `alertas.regraDe()` não acharia as demais.

### Um defeito encontrado pelos testes

**O sino nascia vazio.** `AppShell.montar()` roda antes do login — não há usuário, e a
sincronização não gerava nada. Depois disso, nada reavaliava: o sino só se atualizaria de
5 em 5 minutos ou ao ser clicado. A avaliação passou a rodar também **a cada troca de
rota**, o que é barato justamente porque `sincronizar()` é idempotente.

### Observação de custo

As suítes de interface ficaram mais lentas (o conjunto passou de ~2 min), porque agora
cada navegação em jsdom dispara uma avaliação de alertas. É o preço de exercitar o
caminho real; se incomodar, o gancho de rota pode ganhar um intervalo mínimo.

---

## F2.3 — Portal do cliente e link compartilhado ✅ concluída

Metade já existe: `visivelCliente` é editável em documentos, andamentos e prazos. Falta o
outro lado do link.

### Real × simulado

| Real | Simulado |
|------|----------|
| Geração e revogação de token, validade, escopo | O link só abre **na mesma máquina** — sem servidor, o banco é o `localStorage` local |
| Filtro por `visivelCliente` e por escopo | Envio do link por e-mail/WhatsApp (vai para a caixa de saída) |
| Registro de acesso | Senha do portal (compara em claro, não há hash real) |

A limitação do link fora da máquina é declarada no próprio modal de compartilhamento, e não
no rodapé — o usuário precisa saber antes de mandar o link para o cliente.

### Modelo

```js
// LinkCompartilhado
{ id, processoId, token, criadoPorId, criadoEm, expiraEm, revogadoEm,
  senha,                                  // opcional
  escopo: { andamentos, documentos, prazos, compromissos, financeiro },  // booleans
  totalAcessos, ultimoAcessoEm }

// AcessoPortal
{ id, linkId, quando, sucesso, motivoFalha }
```

### Telas

| Rota | Tela |
|------|------|
| `#/portal/:token` | **Sem sidebar e sem topbar** — cabeçalho próprio com a marca do escritório |
| `#/processos/:id` → aba **Compartilhamento** | Links ativos, criar, revogar, ver acessos |

O portal mostra: capa do processo (número, vara, fase, responsável — nunca valor de
provisão nem risco), linha do tempo só com `visivelCliente`, documentos visíveis com
download, próximos compromissos, e prazos apenas como "aguardando manifestação até X".
Sem nada editável. Nenhuma rota do sistema é alcançável de dentro dele.

**Bloqueios:** processo em segredo de justiça não pode ser compartilhado; token expirado,
revogado ou de processo arquivado cai numa tela de link inválido que não revela se o
processo existe.

### Passos — todos executados

1. ✅ `compartilhamentoService.js` (criar, decodificar, abrir, revogar, registrar acesso)
2. ✅ Rota `#/portal/:token` pública e sem casca, usando o mecanismo criado em F2.1
3. ✅ `PortalClientePage.js` + `assets/css/portal.css`
4. ✅ Modal de compartilhamento com escopo e validade — **sem senha**, ver abaixo
5. ✅ Aba **Compartilhamento** no processo, com acessos e revogação
6. ✅ **"Revisar visibilidade"** em vez de ação em massa cega, ver abaixo
7. ✅ `testes/portal.test.js` — 62 verificações, mais o fluxo completo em `telas.test.js`
   (gerar link → abrir o portal pelo link → conferir o que não aparece → revogar)

### Duas decisões que mudaram em relação ao plano

**1. O token passou a ser autocontido.** O plano previa token opaco, com o servidor
consultando a tabela de links. Só que o protótipo está publicado no GitHub Pages e o
"banco" é o `localStorage` de cada navegador: um token opaco produziria um link que **só
abre na máquina de quem gerou** — um recurso de compartilhamento que não compartilha. O
token virou `processo.escopo.validade.nonce.verificação`, a mesma forma de um JWT, e o
portal se monta sozinho em qualquer navegador contra o seed determinístico.

O que se perde, e está escrito no código e no modal:
- o token revela o id interno do processo (o opaco não revelaria);
- a soma de verificação **não é assinatura** — sem servidor não há segredo para assinar.
  Ela detecta link truncado, não falsificação. Na fase 3 vira HMAC conferido no servidor;
- revogação só vale onde existe o registro local. É o problema real de JWT, resolvido na
  fase 3 com lista de revogação no servidor.

**2. Não há senha de portal.** O plano previa o campo. Ao implementar ficou claro que uma
senha conferida no cliente, com o banco visível no mesmo navegador, não protege nada —
seria teatro. A proteção honesta possível é o token longo e a validade curta.

**3. "Revisar visibilidade" no lugar da ação em massa.** O plano pedia "marcar todos como
visíveis". Um botão desses é perigoso num processo que tem nota interna, estratégia e
documento sigiloso. A tela mostra andamento por andamento, documento por documento, com o
que já está exposto — a ação em massa acontece com a lista à vista, e grava a cada clique.

### Decisões de conteúdo

- **A capa do portal é deliberadamente reduzida.** Sem valor da causa, provisão, risco,
  equipe interna, tags ou número interno. A provisão, em especial, seria constrangedora na
  tela do cliente. Há teste conferindo que nenhum desses campos sai do service.
- **O prazo vira "aguardando manifestação até X"** — sem semáforo, dias restantes,
  responsável ou prazo interno. Para o cliente é uma data-limite, não um indicador de
  gestão do escritório.
- **Link inválido, expirado e revogado caem todos na MESMA tela.** Distinguir os casos já
  contaria ao visitante que o processo existe.
- **O filtro de visibilidade mora no service.** Se ficasse na tela, bastaria um `desenhar()`
  novo para vazar.
- **O advogado logado consegue abrir o portal** para conferir exatamente o que o cliente vê
  — a guarda deixa a rota pública passar mesmo com sessão ativa.

### Ajuste no seed

Os prazos não tinham `visivelCliente`, então a seção do portal nasceria sempre vazia.
O campo entrou no seed (60% visíveis), junto dos campos de conferência de F2.2.

---

## F2.4 — Publicações e integração com tribunais

O ciclo que justifica o sistema inteiro: publicação no diário → prazo calculado → tarefa
atribuída. O motor da ponta final já existe; falta a ponta inicial.

### Real × simulado

| Real | Simulado |
|------|----------|
| Triagem, vínculo por número CNJ, geração de prazo pelo motor CPC | Consulta ao DJe / Datajud / PJe / e-SAJ |
| Classificação do texto por palavra-chave → tipo e dias de prazo | "Sincronizar agora" gera publicações do gerador determinístico |
| Detecção de publicação duplicada | Certificado digital A1/A3 |

### Modelo

```js
// Publicacao
{ id, tribunalId, diario, caderno, dataDisponibilizacao, pagina,
  textoIntegral, numeroCnjDetectado, processoId,
  monitoramentoId,
  status: 'nova'|'vinculada'|'triada'|'descartada'|'sem_vinculo',
  sugestao: { tipoPrazoId, dias, confianca, termosEncontrados: [] },
  prazoGeradoId, andamentoGeradoId, triadaPorId, triadaEm, hashConteudo }

// Monitoramento
{ id, tipo: 'oab'|'nome'|'cnpj'|'processo', valor, uf,
  tribunais: [], usuarioId, ativo, ultimaSincronizacaoEm }

// Sincronizacao
{ id, iniciadaEm, concluidaEm, tribunais: [], encontradas, novas,
  duplicadas, status, mensagemErro }
```

### Domínio — `domain/classificador.js` (puro)

```js
classificar(texto)   // → { tipoPrazoId, dias, confianca, termos }
extrairCnj(texto)    // → número CNJ validado por domain/cnj.js
extrairPrazoTexto()  // "no prazo de 15 (quinze) dias" → 15
extrairPartes(texto) // nomes em caixa alta e "advogado(a):"
```

Dicionário de termos por tipo de prazo ("intime-se para contestar" → contestação/15,
"embargos de declaração" → 5, "manifeste-se sobre o laudo" → manifestação/5…). Regra pura,
testável, e é o alicerce honesto do que F2.8 chama de assistente.

### Fluxo da triagem

```
publicação nova
   ├── CNJ detectado e processo existe → vincula automaticamente
   ├── CNJ detectado sem processo      → oferece "cadastrar processo a partir da publicação"
   └── sem CNJ                         → busca por nome da parte, ou triagem manual
                     ↓
        classificador sugere tipo e dias
                     ↓
   "Gerar prazo"  → prazos.calcular({ dataDisponibilizacao, dias, tipoContagem })
                  → cria Prazo com andamentoOrigemId preenchido
                  → cria Andamento tipo 'publicacao' com o texto integral
                  → notifica o responsável (F2.2)
```

`dataDisponibilizacao` já é exatamente o campo de entrada do motor de prazos da fase 1 —
o encaixe é direto, sem adaptador.

### Telas

| Rota | Tela |
|------|------|
| `#/publicacoes` | Fila de triagem: não lidas, vinculadas, descartadas. Texto integral ao lado |
| `#/publicacoes/:id` | Detalhe com o texto, a sugestão e as ações |
| `#/integracoes` | Monitoramentos (OAB, nome, CNPJ), tribunais, histórico e status de sincronização |

### Passos

1. `domain/classificador.js` + testes com textos reais de publicação
2. Gerador de publicações no `seed.js` (textos verossímeis por tipo de prazo)
3. `publicacaoService.js`, `monitoramentoService.js`, `simulado/sincronizacaoService.js`
   (latência, progresso, falha ocasional)
4. `PublicacoesPage.js` — fila, filtros, leitura, ações em massa
5. Vínculo automático por CNJ + deduplicação por `hashConteudo`
6. Ação "gerar prazo" ligando classificador → motor → prazo → andamento → notificação
7. "Cadastrar processo a partir da publicação" pré-preenchendo o `ProcessoFormPage`
8. `IntegracoesPage.js` com o selo e a lista de integrações previstas para a fase 3
9. Badge de publicações não triadas na sidebar
10. Testes: classificação, extração de CNJ, deduplicação, prazo gerado com data correta

---

## F2.5 — Módulo financeiro

Nada existe hoje. O perfil `financeiro` está em `PERFIS` e não leva a lugar nenhum.

### Real × simulado

| Real | Simulado |
|------|----------|
| Todo o cálculo: êxito, parcelamento, juros/multa, aging, fluxo de caixa, rentabilidade | Registro do boleto no banco |
| Dígito verificador e linha digitável FEBRABAN (matemática correta, banco fictício) | Conciliação bancária / retorno CNAB |
| Timesheet e faturamento por hora | Emissão de NF-e |
| PDF do boleto (pelo diálogo de impressão, como já faz `exportar.js`) | Gateway de pagamento |

### Modelo

```js
// ContratoHonorarios
{ id, clienteId, processoId,            // processoId null = contrato guarda-chuva
  modalidade: 'fixo'|'exito'|'hora'|'mensal'|'misto',
  valorFixoCentavos, percentualExito, valorHoraCentavos, valorMensalCentavos,
  numParcelas, diaVencimento, dataInicio, dataFim,
  reajuste: { indice, periodicidade },
  status: 'ativo'|'encerrado'|'inadimplente'|'cancelado', documentoId }

// Lancamento
{ id, tipo: 'receita'|'despesa',
  origem: 'honorario'|'exito'|'custa'|'reembolso'|'repasse'|'despesa_escritorio',
  contratoId, processoId, clienteId, descricao,
  valorCentavos, valorPagoCentavos,
  dataCompetencia, dataVencimento, dataPagamento,
  status: 'previsto'|'em_aberto'|'pago'|'parcial'|'atrasado'|'cancelado',
  formaPagamento, reembolsavel, comprovanteDocumentoId, boletoId, parcela: { n, de } }

// Boleto
{ id, lancamentoId, nossoNumero, linhaDigitavel, codigoBarras,
  dataVencimento, valorCentavos, juros, multa,
  status: 'emitido'|'pago'|'vencido'|'cancelado', emitidoEm, pagoEm }

// Repasse
{ id, lancamentoOrigemId, beneficiarioId, tipo: 'correspondente'|'parceiro'|'socio',
  percentual, valorCentavos, dataPrevista, dataPagamento, status }

// ApontamentoHora
{ id, processoId, tarefaId, usuarioId, data, minutos, descricao,
  faturavel, valorHoraCentavos, lancamentoId, aprovadoPorId }
```

### Domínio — `domain/financeiro.js` (puro)

```js
gerarParcelas(contrato)              // → lançamentos previstos, com vencimento em dia útil
calcularExito(contrato, valorGanho)  // percentual sobre o proveito econômico
jurosMulta(lancamento, hoje)         // 2% multa + 1% a.m. pro rata die (configurável)
aging(lancamentos, hoje)             // 0–30 / 31–60 / 61–90 / 90+
fluxoCaixa(lancamentos, de, ate)     // regime de caixa e de competência, série mensal
rentabilidade(processo)              // honorários − horas − despesas
```

E `domain/boleto.js`: nosso número, DV por módulo 11, código de barras de 44 posições e
linha digitável de 47 — **formato FEBRABAN correto**, banco fictício (código 999). A regra é
real e testável; só não existe banco que o receba.

### Telas

| Rota | Tela |
|------|------|
| `#/financeiro` | Fluxo de caixa (gráfico), KPIs, aging, inadimplência |
| `#/financeiro/receber` · `/pagar` | Listas filtráveis, baixa individual e em lote |
| `#/financeiro/contratos` · `/contratos/novo` · `/:id` | Contratos de honorários |
| `#/financeiro/repasses` | Repasses a correspondentes e sócios |
| `#/timesheet` | Apontamento de horas — semanal, com cronômetro |
| aba **Financeiro** no processo e no cliente | Contrato, lançamentos, despesas, rentabilidade |

### Passos

1. `utils/moeda.js` já veio de F2.0 — verificar cobertura de testes
2. `domain/financeiro.js` + `domain/boleto.js` com testes (DV do boleto é o teste-âncora)
3. Seed financeiro: contratos para ~60% dos processos, 18 meses de lançamentos com
   inadimplência realista
4. `contratoService`, `lancamentoService`, `boletoService`, `repasseService`,
   `timesheetService`
5. `FinanceiroPage.js` com as abas e o gráfico de fluxo de caixa
6. `ContratoFormPage.js` com geração automática das parcelas ao salvar
7. Emissão de boleto: modal → linha digitável → PDF por impressão → selo de simulação
8. `TimesheetPage.js` + botão de cronômetro na tarefa e no processo
9. Abas financeiras no processo e no cliente
10. Permissões: perfil `advogado` não vê o financeiro do escritório, só o do processo dele
11. Testes: parcelas, êxito, juros, aging, DV do boleto, rentabilidade

---

## F2.6 — CRM e prospecção

Hoje um cliente só existe **depois** de virar processo. Falta o antes.

### Real × simulado

| Real | Simulado |
|------|----------|
| Funil, conversão lead → cliente → contrato → processo | Integração com e-mail e WhatsApp |
| Histórico de interações e agenda de follow-up | Captura de lead pelo site |
| Proposta gerada a partir de modelo (usa F2.7) | Assinatura eletrônica da proposta |

### Modelo

```js
// Lead
{ id, nome, pessoaId,                    // preenchido quando vira cliente
  contato: { telefone, email },
  origem: 'indicacao'|'site'|'redes'|'evento'|'retorno'|'outro',
  indicadoPorId, areaId, resumoCaso,
  etapa: 'novo'|'contato'|'reuniao'|'proposta'|'negociacao'|'ganho'|'perdido',
  valorEstimadoCentavos, probabilidade, responsavelId,
  proximoContatoEm, motivoPerda, convertidoEm }

// Interacao
{ id, leadId, pessoaId, processoId,
  tipo: 'ligacao'|'email'|'reuniao'|'whatsapp'|'visita'|'nota',
  quando, duracaoMin, resumo, usuarioId, proximoPasso }

// Proposta
{ id, leadId, numero, dataEnvio, validadeAte, escopo,
  honorarios: { modalidade, valorFixoCentavos, percentualExito, valorHoraCentavos },
  status: 'rascunho'|'enviada'|'aceita'|'recusada'|'expirada',
  documentoId, motivoRecusa }
```

### Telas

| Rota | Tela |
|------|------|
| `#/crm` | Funil em kanban — **reusa `KanbanBoard.js` sem alteração**, arrastar muda a etapa |
| `#/crm/:id` | Lead: dados, interações, propostas, ações |
| aba **Interações** no cliente | Histórico unificado (lead + cliente) |

### Conversão (o fluxo que dá sentido ao módulo)

`Stepper` de 4 etapas: **Lead ganho → Pessoa (cliente) → Contrato de honorários (F2.5) →
Processo (opcional)**. Uma passagem só, com os dados já preenchidos do lead e da proposta
aceita. Marcar `perdido` exige `motivoPerda` (alimenta o relatório de F2.9).

### Passos

1. `leadService`, `interacaoService`, `propostaService`
2. Seed: 30 leads espalhados nas etapas, ~90 interações, 12 propostas
3. `CrmPage.js` sobre o `KanbanBoard` existente
4. `LeadDetalhePage.js` com timeline de interações
5. Proposta a partir de modelo (depende de F2.7) → PDF por impressão
6. `Stepper` de conversão
7. Aba de interações no cliente e registro rápido a partir do processo
8. Follow-up vencido gera notificação (F2.2)
9. Testes: transição de etapa, conversão íntegra, proposta expirada

---

## F2.7 — Documentos avançados

O explorador, o visor e o editor já são fortes. Falta o que transforma o editor em
ferramenta de trabalho.

### Real × simulado

| Real | Simulado |
|------|----------|
| Modelos com variáveis substituídas por dados do processo | Assinatura digital ICP-Brasil |
| Busca full-text no conteúdo editado | OCR de PDF/imagem (índice vem do seed) |
| Log de visualização e download | Carimbo do tempo |

### Modelo

```js
// ModeloPeca
{ id, nome, categoria, areaId, tipo: 'peticao'|'contrato'|'procuracao'|'notificacao'|'proposta',
  conteudoHtml, variaveis: [], criadoPorId, publico }

// Assinatura
{ id, documentoId, signatarioId, tipo: 'eletronica_simulada',
  assinadoEm, hash, certificado, valida }

// AcessoDocumento
{ id, documentoId, usuarioId, linkCompartilhadoId, acao: 'ver'|'baixar'|'editar', quando }
```

### Variáveis do modelo

`{{cliente.nome}}` · `{{cliente.cpfCnpj}}` · `{{processo.numeroCnj}}` · `{{processo.vara}}`
· `{{processo.comarca}}` · `{{processo.valorCausa}}` · `{{parte.contraria}}` ·
`{{advogado.nome}}` · `{{advogado.oab}}` · `{{data.extenso}}` · `{{honorarios.valor}}`

`domain/modelos.js`: `listarVariaveis(html)`, `preencher(html, contexto)`,
`variaveisNaoResolvidas(html, contexto)` — o editor destaca em amarelo o que não foi
preenchido em vez de deixar `{{...}}` cru no documento final.

### Passos

1. `domain/modelos.js` + testes
2. `modeloPecaService.js` e seed com ~15 modelos por área
3. `#/modelos` — biblioteca com prévia
4. "Novo a partir de modelo" ao lado de "Novo documento em branco"
5. Painel de variáveis no `DocumentEditor` (lista, valor, destaque do não resolvido)
6. Busca full-text: índice invertido em `conteudoService`, resultado na busca global
7. Assinatura simulada: modal, hash do conteúdo, selo visível no visor e no PDF
8. `AcessoDocumento` gravado no visor, no download e no portal (F2.3)
9. Testes: preenchimento, variável faltante, busca, log de acesso

---

## F2.8 — Assistente (IA)

Sem backend não há modelo de linguagem. A postura aqui é a mesma dos documentos: entregar
de verdade o que é regra, simular o que é rede — e dizer qual é qual, na cara.

### Camada A — real, determinística (`domain/assistente.js`)

Isto **funciona de verdade**, é puro e testável:

- **Classificação de publicação** → tipo e dias de prazo (reusa `domain/classificador.js`)
- **Extração de entidades** do texto: CNJ, datas, valores, prazos, nomes de partes
- **Resumo estruturado do processo**: da timeline sai "distribuído em X, contestado em Y,
  atualmente em instrução, 3 prazos cumpridos, 1 perdido, próxima audiência em Z"
- **Próxima ação sugerida** por fase, status e prazos em aberto
- **Detecção de duplicidade** de processo (CNJ) e de cliente (CPF/CNPJ, nome aproximado)
- **Risco sugerido** por área + fase + histórico de desfechos do próprio seed
- **Revisão de peça**: prazos citados que não batem com o cadastro, valores divergentes,
  variáveis de modelo não substituídas, número CNJ inválido no corpo do texto

### Camada B — simulada (`services/simulado/iaService.js`)

Assinatura **idêntica à de um cliente de API real**, para a fase 3 ser troca de corpo:

```js
async function gerarPeca({ tipo, processoId, instrucoes, modeloId })
async function resumirPublicacao({ publicacaoId })
async function sugerirDesfecho({ processoId })
async function perguntar({ processoId, pergunta })
```

Hoje o corpo monta o texto a partir de **modelo (F2.7) + dados reais do processo**, com
latência e escrita token a token no editor. O painel diz, sem rodeio: *"Texto montado por
modelo e regras locais. Não há modelo de linguagem neste protótipo — na fase 3 esta mesma
chamada vira `POST /api/ia/peca`."*

### Telas

- Painel **Assistente** no `ProcessoDetalhePage`: resumo, próximas ações, alertas de
  inconsistência, risco sugerido
- **"Gerar minuta"** no editor → tipo de peça → instruções → texto preenchido com o
  processo
- **"Explicar publicação"** na triagem de F2.4: resumo em linguagem simples + prazo sugerido
- **Assistente de busca** na topbar: "prazos do Dr. Silva vencendo esta semana" resolvido
  por gramática de intenções (regra, não modelo)

### Passos

1. `domain/assistente.js` (resumo, próxima ação, duplicidade, risco) + testes
2. Revisor de peça sobre `domain/modelos.js` e `domain/cnj.js`
3. `simulado/iaService.js` com as 4 assinaturas e latência
4. Painel Assistente no processo
5. "Gerar minuta" no editor com escrita progressiva
6. "Explicar publicação" na triagem
7. Gramática de intenções da busca (5 a 8 padrões, com fallback para busca textual)
8. Selo de simulação em **toda** superfície do assistente
9. Testes: resumo, próxima ação, duplicidade, revisor, intenções da busca

---

## F2.9 — Relatórios e BI

Nenhuma entidade nova. Tudo é derivação — e por isso quase tudo já está a um passo dos
`selectors.js` existentes.

### Catálogo

| Relatório | Fonte | Corte |
|-----------|-------|-------|
| Produtividade por advogado | prazos, tarefas, apontamentos | período, equipe |
| Prazos: cumpridos × perdidos × no prazo | prazos | mês, responsável, área |
| **Contingência** (provisão por risco) | `valorProvisao`, `risco` | área, cliente, fase |
| Carteira e tempo médio por fase | processos, andamentos | área, tribunal |
| Taxa de êxito | processos encerrados | área, advogado |
| Faturamento e inadimplência | lançamentos | competência, cliente |
| Aging de recebíveis | lançamentos | faixa, cliente |
| Rentabilidade por processo | contratos, horas, despesas | cliente, área |
| Funil de conversão | leads, propostas | origem, responsável |
| Publicações: volume e tempo de triagem | publicações | tribunal, usuário |

O de **contingência** é o que o cliente corporativo exige e o modelo da fase 1 já previa
(seção 14 do `PLANEJAMENTO.md`) — sai praticamente de graça.

### Domínio — `domain/indicadores.js`

Funções puras que recebem coleções e devolvem séries prontas para o `Chart`. Nenhuma
consulta ao store, nenhum DOM. É o módulo mais fácil de testar do projeto inteiro.

### Telas

| Rota | Tela |
|------|------|
| `#/relatorios` | Catálogo em cartões, agrupado por tema |
| `#/relatorios/:chave` | Filtros (`DateRangePicker`, área, responsável) + gráfico + tabela |

Toda tela exporta **CSV** (`utils/csv.js`) e **PDF** (impressão, com `@media print` já
usada pelo `exportar.js`). O dashboard ganha links "ver relatório completo" nos cartões.

### Passos

1. `domain/indicadores.js` — uma função por relatório, com teste cada
2. `RelatoriosPage.js` (catálogo) e `RelatorioDetalhePage.js` (genérica, dirigida por
   configuração de relatório)
3. Ligar `Chart.js` — ao implementar, seguir o guia de visualização de dados para paleta,
   eixos e acessibilidade; cores vêm de `tokens.css`
4. Filtros e persistência do filtro no hash (`?de=&ate=&area=`)
5. Exportação CSV e impressão
6. Permissões: `advogado` vê só os próprios números; `financeiro` só os financeiros
7. Links do dashboard para os relatórios
8. Testes: cada indicador com dados controlados, período vazio, divisão por zero

---

## F2.10 — Administração e complementos

Os buracos que não estavam na lista original mas que qualquer escritório cobra na primeira
semana de uso.

| Item | Por quê |
|------|---------|
| `#/configuracoes` — usuários, perfis, escritório | Não existe nenhuma tela de administração |
| **Feriados do escritório** | O motor calcula os nacionais; ponto facultativo de comarca é manual |
| Tipos de prazo e categorias personalizáveis | Hoje `TIPOS_PRAZO` é constante em código |
| **Importação em massa (CSV)** | Ninguém migra 400 processos digitando |
| **Processos vinculados / apensos** | `processoPaiId` está no modelo e é sempre `null` |
| **Busca global ampliada** | Hoje só alcança processos e clientes |
| Backup e restauração | Botão de exportar/importar o banco em JSON |
| Preferências por usuário | Tela inicial, colunas da tabela, densidade |

### Passos

1. `#/configuracoes` com abas (escritório, usuários, prazos, feriados, alertas, integrações)
2. `feriadoEscritorioService` + injeção no `domain/feriados.js` (a função pura passa a
   aceitar uma lista extra — sem quebrar a assinatura atual)
3. Importação CSV com prévia, validação linha a linha (CNJ, CPF/CNPJ) e relatório de erros
4. Vínculo de processos: campo `processoPaiId` no formulário, árvore de apensos no detalhe
5. Busca global sobre andamentos, documentos, prazos, publicações e leads
6. Backup/restauração em JSON
7. Preferências por usuário
8. Testes: importação com linha inválida, árvore de apensos, busca por tipo

---

## 2. Arquivos novos — mapa consolidado

```
assets/css/
  portal.css                      F2.3
  print.css                       F2.5, F2.9

src/domain/                       ⭐ tudo puro, migra sem alteração
  permissoes.js                   F2.1
  alertas.js                      F2.2
  classificador.js                F2.4
  financeiro.js  boleto.js        F2.5
  modelos.js                      F2.7
  assistente.js                   F2.8
  indicadores.js                  F2.9

src/services/
  sessaoService.js  auditoriaService.js  privacidadeService.js       F2.1
  notificacaoService.js  regraAlertaService.js                        F2.2
  compartilhamentoService.js                                          F2.3
  publicacaoService.js  monitoramentoService.js                       F2.4
  contratoService.js  lancamentoService.js  boletoService.js
  repasseService.js  timesheetService.js                              F2.5
  leadService.js  interacaoService.js  propostaService.js             F2.6
  modeloPecaService.js  assinaturaService.js                          F2.7
  simulado/
    emailService.js               F2.2   → SMTP / provedor de push
    sincronizacaoService.js       F2.4   → Datajud, PJe, e-SAJ, Projudi
    gatewayService.js             F2.5   → registro de boleto / PIX
    iaService.js                  F2.8   → POST /api/ia/*

src/components/
  SeloSimulado.js  Chart.js  Stepper.js  DateRangePicker.js           F2.0
  NotificationCenter.js                                               F2.2
  FunilBoard.js (fino sobre KanbanBoard)                              F2.6
  VariaveisPanel.js                                                   F2.7
  AssistentePanel.js                                                  F2.8

src/pages/                        ~22 páginas novas (ver cada módulo)

testes/
  permissoes.test.js  alertas.test.js  classificador.test.js
  financeiro.test.js  boleto.test.js  modelos.test.js
  assistente.test.js  indicadores.test.js  portal.test.js
  crm.test.js  integracao-fase2.test.js
```

**`index.html`** cresce para ~90 scripts. Ao passar de 60, o bloco ganha subcomentários por
módulo — a ordem continua sendo conveniência de leitura, não exigência (nenhum arquivo
depende de outro em tempo de definição).

---

## 3. Limites conhecidos e assumidos

Registrados aqui para não serem redescobertos como defeito no meio da implementação:

1. ~~**O link do portal não sai da máquina.**~~ **Resolvido em F2.3** com token
   autocontido: o link abre em qualquer navegador. O que continua valendo é que a soma de
   verificação **não é assinatura**, e que a revogação só surte efeito onde existe o
   registro local.
2. **Não há autenticação.** Trocar de usuário é escolher da lista. As permissões são
   aplicadas de verdade, mas a identidade não é provada — e a checagem roda só no
   navegador. Permissão conferida apenas no cliente não é permissão; na fase 3 a mesma
   matriz roda no servidor. Sob `file://`, a sessão também não sobrevive ao F5.
3. **Não há modelo de linguagem.** O assistente é regra e modelo de texto. A assinatura da
   chamada já é a da fase 3.
4. **Boleto não é registrado em banco.** A linha digitável é matematicamente válida no
   formato FEBRABAN; o banco 999 não existe.
5. **Assinatura digital é simulada.** Hash do conteúdo, sem ICP-Brasil, sem carimbo do tempo.
6. **`localStorage` tem teto de ~5 MB.** ~~Pode apertar com 9 módulos.~~ **Medido em
   F2.0: 0,52 MB (10,4%).** Há folga; o seed financeiro entra com os 18 meses previstos.
   `db.diagnostico()` ficou no código para remedir ao fim de F2.5 e F2.9.
7. **Sem migração de banco.** Subir a versão da chave descarta os dados. Continua sendo a
   decisão da fase 1, e o backup em JSON de F2.1 é a válvula de escape.

---

## 4. Como cada módulo é dado por pronto

Um módulo só fecha quando:

- a lógica que **pode** ser real está em `src/domain/`, pura, com teste;
- os services têm a **assinatura final** (`listar`/`obter`/`criar`/`atualizar`/`remover`),
  mesmo que o corpo leia do `localStorage`;
- toda superfície simulada exibe o `SeloSimulado`;
- as permissões de F2.1 são aplicadas nas telas e nos services do módulo;
- há suíte em `testes/` e `npm test` passa inteiro;
- `README.md` ganha a linha da tela nova na tabela de rotas.
