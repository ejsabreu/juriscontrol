# Sistema de Controle de Processos Judiciais — Planejamento

> Protótipo em HTML + CSS + JavaScript puro, sem backend, estruturado para migração posterior a React.
> Perfil-alvo: escritório genérico (atende contencioso de massa, boutique e trabalhista/previdenciário).

---

## 1. Escopo do protótipo

### 1.1 Entra

| # | Tela | Objetivo |
|---|------|----------|
| 1 | **Dashboard** | Prazos críticos, audiências da semana, contadores por fase, alertas |
| 2 | **Processos — Lista** | Busca, filtros e **duas visualizações: tabela e kanban** |
| 3 | **Processos — Detalhe** | Abas: Dados · Partes · Andamentos · Prazos · Documentos · Tarefas |
| 4 | **Processos — Formulário** | Cadastro/edição com máscara e validação do número CNJ |
| 5 | **Agenda** | Calendário mensal + lista de prazos e compromissos |
| 6 | **Clientes** | Lista + detalhe com processos vinculados |
| 7 | **Tarefas** | Kanban por status com atribuição |

### 1.2 Visualização kanban de processos

A tela de processos alterna entre **tabela** (densidade, comparação, ordenação) e **kanban**
(acompanhamento visual do andamento da carteira). As duas compartilham a mesma barra de filtros
e o mesmo estado no store — trocar de visão nunca perde o filtro aplicado.

**Agrupamento selecionável** — a mesma carteira, lida por três recortes diferentes:

| Agrupar por | Colunas | Responde à pergunta |
|-------------|---------|---------------------|
| **Fase processual** (padrão) | Distribuição · Citação · Instrução · Sentença · Recurso · Execução · Arquivado | Onde cada processo está no rito? |
| **Responsável** | uma coluna por advogado | Como está distribuída a carga do time? |
| **Área do direito** | Cível · Trabalhista · Tributário · Família · Penal · Consumidor | Qual a composição da carteira? |

**Card do processo:**
- Número CNJ e número interno
- Cliente e polo (badge autor/réu)
- Avatar do responsável
- Valor da causa
- **Semáforo do prazo mais próximo** — a informação que faz o kanban valer a pena
- Ícones de segredo de justiça e de risco (provável/possível/remoto)

**Interações:**
- Arrastar card entre colunas → altera a fase (ou responsável/área, conforme o agrupamento) e registra andamento automático
- Cabeçalho da coluna: contador de processos + soma do valor da causa
- Clique no card → detalhe do processo
- Colunas vazias permanecem visíveis (mostram que a fase existe)

O componente `KanbanBoard` é **genérico** — recebe itens, definição de colunas e um renderizador de card.
É o mesmo componente usado pela tela de Tarefas, apenas com outra configuração.

### 1.2.1 Organização dos documentos em pastas

A aba **Documentos** do detalhe do processo é um explorador de arquivos: mostra
**um nível por vez** (pastas e documentos convivendo), com caminho navegável no
topo. Não é árvore expandida — a pasta de um processo tem poucas dezenas de itens
e o advogado navega por caminho ("Petições / Protocolados"), como já faz na pasta
física.

**Interações:**
- Arrastar documento sobre uma pasta → move o documento
- Arrastar pasta sobre outra pasta → aninha (a checagem de ciclo barra o absurdo)
- Soltar na linha "voltar" ou em uma migalha do caminho → tira o item do nível atual
- Botão **Mover** em cada linha → mesmo resultado por `<select>`, para quem não
  arrasta (teclado, leitor de tela, toque)
- Criar, renomear e excluir pasta pelo modal
- **Enviar documentos** (upload simulado) — pelo modal ou arrastando arquivos do
  computador para a pasta sob o cursor
- Clicar no documento → **visor em modal**, sem sair do sistema (§1.2.3)
- **Baixar** na linha ou no rodapé do visor (§1.2.4)

O componente `DocumentExplorer` segue o mesmo contrato do `KanbanBoard`: função pura
que devolve HTML + `mount(root, handlers)` que liga o drag & drop por delegação.
O realce do alvo distingue as duas naturezas de arrasto: **azul** para movimentação
interna, **âmbar** para arquivo vindo de fora do navegador.

### 1.2.2 Envio de documentos — o que é real e o que é simulado

Não há backend, então o envio é encenado — mas só onde precisa ser:

| Real | Simulado |
|------|----------|
| Nome, tamanho e tipo MIME lidos do `<input type="file">` | Transferência de bytes |
| Extensão derivada do nome | Barra de progresso (escada de percentuais com latência) |
| Validação de limite por arquivo (25 MB) e de pasta de destino | URL definitiva do arquivo |
| Metadados persistidos no banco do protótipo | Persistência do binário |

O binário fica em memória no `arquivoService` e **só durante a sessão**. Recarregar
a página mantém o registro e perde o arquivo — a alternativa (base64 no
`localStorage`) estouraria a cota de ~5 MB no primeiro PDF.

Na migração: `enviar()` monta `FormData`, `http.upload()` passa a ser
`XMLHttpRequest` com `upload.onprogress`, o backend devolve a URL e o
`arquivoService` desaparece. **Nenhuma tela muda** — a assinatura é a mesma.

### 1.2.3 Visor de documento — o usuário não sai do sistema

**Ver** um documento nunca leva para fora da aplicação: sem nova aba, sem download
obrigatório. (Editar leva, e de propósito — ver 1.2.5.) O `DocumentViewer` ocupa o
corpo de um Modal e tem duas metades:

| Metade | Conteúdo | Quando aparece |
|--------|----------|----------------|
| **Quadro** | prévia — `<img>` para imagem, `<iframe>` para PDF, `<pre>` para texto, HTML sanitizado para texto formatado | quando há binário na sessão **ou** texto editado no sistema |
| **Ficha** | nome, categoria, pasta, formato/MIME, tamanho, versão, quem enviou, quando, se foi editado, visibilidade no portal | **sempre** |

A ficha é a parte que nunca falha, e é útil por si — é a identidade do documento.
Quando não há binário (o caso de todo documento do seed), o quadro explica o porquê
em vez de simplesmente falhar. Quando o documento **já foi editado**, é o texto
editado que aparece, não o arquivo enviado: o visor mostra a versão mais nova, senão
alguém edita numa aba e continua vendo o conteúdo velho na outra.

O rodapé oferece **Baixar**, **Mover** e — nos formatos editáveis — **Editar**, para
as ações comuns não exigirem fechar e procurar a linha de novo. Baixar não fecha o
visor; editar fecha, porque o usuário volta para o processo, não para o visor.

Três formas de abrir, todas na mesma ação `abrir-documento`: clique no nome, no
ícone da extensão ou no botão **Abrir**.

### 1.2.4 Download — sempre entrega algo, nunca conteúdo falso

| Situação | O que baixa | Nome do arquivo |
|----------|-------------|-----------------|
| Enviado na sessão | o arquivo real | o nome original |
| Só metadados (todo documento do seed) | a **ficha em `.txt`** | `<nome> — ficha.txt` |

A segunda linha é uma decisão deliberada: gerar um PDF de mentira chamado
`procuracao-adv-2025-0002.pdf` seria pior que não baixar nada — alguém acabaria
tratando o arquivo como documento de verdade. A ficha resolve o mesmo objetivo
("clicar em baixar funciona") sem plantar um documento falso, e um toast avisa o
que aconteceu.

O helper é `App.dom.baixar(nome, BlobOuURL)`: cria um `<a download>`, clica e o
descarta. Usa a object URL que o `arquivoService` já mantém quando ela existe (nada
a revogar) e cai para `data:` URL via `FileReader` onde `createObjectURL` não existe
— é o caso do jsdom das suítes, que por isso conseguem testar o download de verdade.

Documento **editado** tem precedência sobre o binário: baixar entregaria a versão
antiga logo depois de alguém reescrever o texto.

### 1.2.5 Editor de documento — a única aba nova do sistema

Ver é consulta, escrever é trabalho. Por isso **Editar** abre `#/documentos/:id/editar`
em aba separada: o advogado redige com o processo aberto ao lado, e fechar o editor
não custa o contexto da tela de onde veio.

**Onde aparece.** Só onde a edição existe de verdade — `DocumentViewer.modoEdicao()`
decide, e quem não se encaixa não ganha botão nenhum (nada de oferecer e falhar):

| Modo | Formatos | Editor |
|------|----------|--------|
| `texto` | `.txt` `.md` `.csv` `.json` `.xml` `.log` `.html`, ou MIME `text/*` | `<textarea>` monoespaçada, Tab indenta |
| `rico` | `.doc` `.docx` `.odt` `.rtf` | `contenteditable` + barra (negrito, títulos, listas, citação) |
| — | PDF, imagem, qualquer outro | sem botão |

**O problema que define o desenho.** O binário vive em memória no `arquivoService`,
e uma aba nova nasce com esse cache vazio — o arquivo não atravessa. Por isso existe
o `conteudoService`: antes de abrir a aba, a tela do processo lê o `File` com
`FileReader` e grava o texto no `localStorage`, sob chave própria
(`jurisctrl.conteudo.v1`). A aba do editor lê de lá.

Chave separada do banco de propósito: o JSON do `db` é reescrito inteiro a cada
gravação, e subir a versão do schema descartaria o banco — levando junto o que o
usuário escreveu.

| Real | Simulado |
|------|----------|
| O texto digitado, persistido e versionado | Reescrever o binário original |
| Autosave (1,2 s de debounce), Ctrl+S, contagem de palavras | Colaboração e presença |
| `tamanhoBytes`, `editadoEm` e `editadoPorId` no registro | Conversão de/para `.docx` |
| Nova versão v+1 encadeada por `documentoPaiId` | Histórico com diff entre versões |

**Sobre `.doc`/`.docx`.** São ZIP com XML dentro; o navegador não os lê nem escreve
sem biblioteca, e o protótipo é zero-dependência rodando por `file://`. O editor abre
em modo rico sobre o conteúdo do **próprio sistema** e diz isso num banner: o binário
não é lido, o texto escrito passa a ser a versão editável do registro, e o arquivo
original continua intacto para download. Baixar o que foi escrito entrega `.html` —
gerar um `.docx` que na verdade é HTML seria a mesma mentira que a ficha `.txt` evita.

**Sanitização.** O modo rico é a única exceção ao `App.dom.esc()` que protege o resto
do sistema. A troca justa é uma whitelist em `conteudoService.sanitizarHtml()` —
parser do navegador dentro de um `<template>` inerte, tags e atributos fora da lista
descartados (o texto de dentro fica), aplicada **na gravação e na exibição**.

**Sincronia entre abas.** O editor grava; a aba do processo ouve o evento `storage`
via `conteudoService.observar()` e recarrega a lista sozinha. Sem isso, a tela de
origem seguiria mostrando o tamanho e a prévia antigos.

**Degrade.** Sem `localStorage` (navegador que bloqueia storage em `file://`, o caso
do jsdom das suítes) o texto não atravessaria para a outra aba: o sistema edita na
**mesma aba** e avisa. Pop-up bloqueado cai no mesmo caminho, para não perder o
clique do usuário.

Na migração: `conteudoService` desaparece junto com o `arquivoService` — o conteúdo
vira campo do backend e o editor faz `PATCH /api/documentos/:id/conteudo`. O
`execCommand` (deprecado, mas o único caminho sem dependência) vira TipTap ou Slate;
o resto do editor — autosave, versão, sincronia — não muda.

### 1.2.6 Documento em branco — criar sem enviar arquivo

O caminho oposto ao envio: não existe binário nenhum, o documento nasce vazio e vai
direto para o editor. É o “documento em branco” do Docs, e `documentoService.criarEmBranco()`
é o que o materializa — irmão de `enviar()`, com a mesma forma e sem `FormData`.

O **formato** escolhido na criação é a identidade do documento no sistema e decide em
que modo o editor abre. A lista é a do Docs, menos `.pdf` e `.epub`, que só existem
como exportação (não se editam):

| Formato | Editor | O sistema gera o arquivo? |
|---------|--------|---------------------------|
| `.docx` `.odt` | rico | **não** — pacotes ZIP |
| `.rtf` | rico | sim |
| `.html` `.txt` `.md` | texto | sim |

O modal diz isso **antes** de o usuário escrever, e o registro nasce com
`criadoNoEditor: true` — a marca que faz o visor dizer “documento em branco” em vez de
“o arquivo existiria no storage do backend”, que seria falso: arquivo nenhum existe.
Pelo mesmo motivo, baixar um documento em branco não gera arquivo, avisa que falta
escrever.

### 1.2.7 Exportação — o documento sai do sistema

`utils/exportar.js` converte o que está no editor. A régua é a mesma do resto do
projeto: só sai arquivo que o protótipo saiba montar de verdade.

| Formato | Como é produzido |
|---------|------------------|
| `.txt` | HTML → texto, um parágrafo por bloco, listas com marcador |
| `.md` | HTML → Markdown (`#`, `**`, `-`, `>`) |
| `.html` | documento completo e autossuficiente, sem CSS externo |
| `.rtf` | gerado byte a byte: negrito, itálico, títulos, listas, citação; não-ASCII vira `\uNNNN?` |
| **PDF** | `window.print()` num `<iframe>` fora da tela — “Salvar como PDF” do navegador |
| `.docx` `.odt` | **não são gerados**, e o menu explica por quê |

O RTF cobre a lacuna do `.docx` melhor do que um `.docx` falso cobriria: é formato de
texto puro, abre no Word com a formatação preservada e está na própria lista de export
do Google Docs. O PDF pelo diálogo de impressão é a mesma escolha: um gerador de PDF
escrito à mão daria um arquivo pior que o do navegador.

Na migração isto vira responsabilidade do backend (LibreOffice headless, pandoc) — e
aí `.docx` e `.odt` entram na lista sem asterisco.

### 1.3 Fica de fora (fase 2 — mas o modelo de dados já prevê)

- Financeiro (honorários, contas a receber, custas, repasses)
- Captura de publicações do DJe
- Portal do cliente
- Timesheet
- Relatórios gerenciais e exportação
- Integrações (Datajud/CNJ, PJe, e-SAJ, Google Calendar)

> **Fase 2 planejada.** Todos os itens acima — mais CRM, segurança/LGPD e assistente —
> estão detalhados em [PLANEJAMENTO-FASE2.md](PLANEJAMENTO-FASE2.md), com modelo de dados,
> telas, passos e a separação explícita entre o que é lógica real e o que é simulação
> declarada.

---

## 2. Modelo de dados

Todas as entidades têm `id`, `criadoEm`, `atualizadoEm` e `ativo` (soft delete — **nada é apagado de verdade**).

### 2.1 Pessoa

Entidade unificada: cliente, parte contrária e terceiro são o mesmo cadastro com papéis diferentes.
Evita duplicação e cobre o caso real de uma parte contrária virar cliente.

```js
{
  id, tipo: 'PF' | 'PJ',
  nome, nomeFantasia,
  documento,                    // CPF ou CNPJ
  rg, dataNascimento,
  email, telefone, celular,
  endereco: { cep, logradouro, numero, complemento, bairro, cidade, uf },
  ehCliente: boolean,
  origem, observacoes
}
```

### 2.2 Usuario

```js
{
  id, nome, email,
  oab: { numero, uf },
  perfil: 'admin' | 'socio' | 'advogado' | 'estagiario' | 'financeiro',
  iniciais, cor                 // avatar
}
```

### 2.3 Processo — entidade central

```js
{
  id,
  numeroCnj,                    // '0001234-71.2024.8.26.0100' — com DV validado
  numeroInterno,                // 'ADV-2024-0042' (pasta do escritório)
  tipo: 'judicial' | 'administrativo' | 'consultivo',

  clienteId,
  papelCliente: 'autor' | 'reu' | 'terceiro' | 'exequente' | 'executado',

  areaId,                       // civel, trabalhista, tributario, penal, familia...
  classeProcessual, assunto,

  tribunalId, comarca, vara, juiz,
  instancia: 1 | 2 | 'superior',

  faseId,                       // distribuicao → citacao → instrucao → sentenca → recurso → execucao → arquivado
  status: 'ativo' | 'suspenso' | 'arquivado' | 'encerrado',
  segredoJustica: boolean,      // restringe visualização

  dataDistribuicao, dataEncerramento,
  valorCausa, valorProvisao,
  risco: 'provavel' | 'possivel' | 'remoto',

  responsavelId, equipeIds: [],
  processoPaiId,                // apensos, recursos, incidentes
  tags: [], descricao
}
```

### 2.4 ParteProcesso (relação N:N)

```js
{
  id, processoId, pessoaId,
  polo: 'ativo' | 'passivo' | 'terceiro',
  tipoParticipacao: 'autor' | 'reu' | 'assistente' | 'testemunha' | 'perito' | 'advogado_contrario',
  principal: boolean
}
```

### 2.5 Andamento

```js
{
  id, processoId, data,
  tipo: 'movimentacao' | 'peticao' | 'decisao' | 'despacho' | 'sentenca' | 'publicacao' | 'nota_interna',
  titulo, descricao,
  origem: 'manual' | 'publicacao' | 'tribunal',
  visivelCliente: boolean,      // nota interna nunca vaza pro portal
  autorId, documentosIds: []
}
```

### 2.6 Prazo

```js
{
  id, processoId, titulo,
  tipoContagem: 'uteis' | 'corridos',
  quantidadeDias,

  dataDisponibilizacao,         // publicação no DJe
  dataPublicacao,               // CALCULADO: 1º dia útil após disponibilização
  dataInicioContagem,           // CALCULADO: 1º dia útil após publicação
  dataFatal,                    // CALCULADO
  diasAntecedencia,             // padrão 3
  dataInterna,                  // CALCULADO: dataFatal − diasAntecedencia (dias úteis)

  responsavelId,
  prioridade: 'baixa' | 'media' | 'alta' | 'critica',
  status: 'pendente' | 'em_andamento' | 'cumprido' | 'prorrogado' | 'perdido' | 'cancelado',
  dataCumprimento, observacoes,
  andamentoOrigemId
}
```

### 2.7 Compromisso

```js
{
  id, processoId,
  tipo: 'audiencia' | 'pericia' | 'reuniao' | 'sustentacao' | 'diligencia',
  titulo, dataHora, duracaoMin, local, endereco,
  participantesIds: [], responsavelId,
  status: 'agendado' | 'realizado' | 'cancelado' | 'adiado',
  observacoes
}
```

### 2.8 Documento

```js
{
  id, processoId, clienteId,
  pastaId,                      // null = raiz dos documentos do processo
  nome, categoria,              // inicial, contestacao, procuracao, sentenca, comprovante, contrato
  extensao, tipoMime, tamanhoBytes,
  versao, documentoPaiId,       // versionamento
  uploadPorId, uploadEm,
  visivelCliente: boolean
}
```

### 2.8.1 Pasta de documento

```js
{
  id, processoId,
  nome,
  paiId,                        // null = pasta de primeiro nível; permite hierarquia
  criadoPorId
}
```

A pasta é só uma **etiqueta hierárquica**: o documento continua ligado ao processo
por `processoId` e ganha `pastaId`. Nenhuma consulta existente muda de resultado
por causa das pastas — quem não conhece o campo continua vendo todos os documentos
do processo.

Regras:

- irmãs não podem ter o mesmo nome (comparação sem caixa e sem acento);
- uma pasta não pode ser movida para dentro da própria descendência (ciclo);
- excluir uma pasta **promove o conteúdo** (subpastas e documentos) para a pasta-mãe —
  documento de processo nunca some porque alguém apagou a pasta errada;
- documento só entra em pasta do **mesmo processo**.

### 2.9 Tarefa

```js
{
  id, titulo, descricao,
  processoId, clienteId,
  responsavelId, criadorId,
  status: 'a_fazer' | 'em_andamento' | 'em_revisao' | 'concluida',
  prioridade, dataVencimento,
  checklist: [{ texto, feito }],
  concluidoEm
}
```

### 2.10 Feriado

```js
{
  data: 'YYYY-MM-DD', nome,
  abrangencia: 'nacional' | 'estadual' | 'municipal' | 'forense',
  uf, municipio, tribunalId
}
```

### 2.11 Tabelas auxiliares

`Tribunal`, `AreaDireito`, `FaseProcessual`, `ClasseProcessual`, `TipoPrazo` — carregadas do seed, imutáveis no protótipo.

---

## 3. Motor de cálculo de prazos

O componente mais importante do sistema. Prazo errado = perda de direito + responsabilidade civil do advogado.

### 3.1 Regras implementadas (CPC/2015)

| Artigo | Regra |
|--------|-------|
| Art. 219 | Prazos processuais contam-se **apenas em dias úteis** |
| Art. 224 | Exclui-se o dia do começo, inclui-se o do vencimento |
| Art. 224 §1º | Vencendo em dia sem expediente, **prorroga para o dia útil seguinte** |
| Art. 224 §2º | Data da publicação = 1º dia útil seguinte à disponibilização no DJe |
| Art. 224 §3º | Contagem inicia no 1º dia útil seguinte à publicação |
| Art. 220 | **Suspensão entre 20/12 e 20/01** |
| Art. 229 | Prazo em dobro para litisconsortes com procuradores distintos (flag opcional) |

### 3.2 Fluxo

```
dataDisponibilizacao (DJe)
  └─► dataPublicacao      = próximo dia útil
        └─► dataInicio    = próximo dia útil  (dia 1 da contagem)
              └─► soma N dias úteis, pulando feriados e recesso
                    └─► dataFatal (prorrogada se cair em dia sem expediente)
                          └─► dataInterna = dataFatal − diasAntecedencia (dias úteis)
```

### 3.3 API do módulo `domain/prazos.js`

```js
ehDiaUtil(data, { uf, tribunalId })
proximoDiaUtil(data, opts)
somarDiasUteis(data, n, opts)
diasUteisEntre(inicio, fim, opts)
estaEmRecesso(data)
calcularPrazo({ dataDisponibilizacao, dias, tipoContagem, diasAntecedencia, dobro, opts })
  // → { dataPublicacao, dataInicio, dataFatal, dataInterna, diasRestantes, semaforo }
```

### 3.4 Semáforo (dias úteis restantes até a data fatal)

| Estado | Condição | Cor |
|--------|----------|-----|
| `vencido` | < 0 | vermelho escuro |
| `critico` | 0 – 2 | vermelho |
| `atencao` | 3 – 5 | âmbar |
| `ok` | > 5 | verde |

---

## 4. Validação do número CNJ

Formato `NNNNNNN-DD.AAAA.J.TR.OOOO` (Res. CNJ 65/2008).

```
0001234 - 71 . 2024 . 8 . 26 . 0100
   │       │      │     │    │    └── órgão de origem (4)
   │       │      │     │    └─────── tribunal (2)
   │       │      │     └──────────── segmento do Judiciário (1)
   │       │      └────────────────── ano do ajuizamento (4)
   │       └───────────────────────── dígito verificador (2)
   └───────────────────────────────── número sequencial por ano/origem (7)
```

**Cálculo do DV:** módulo 97 base 10 (ISO 7064). Concatena `NNNNNNN + AAAA + J + TR + OOOO + '00'`, calcula `98 − (valor mod 97)`.

`domain/cnj.js` expõe: `validar()`, `formatar()`, `parsear()` (extrai ano, segmento, tribunal e origem), `mascara()`.

---

## 5. Estrutura de arquivos

```
/
├── index.html                    # único HTML (SPA) — carrega os scripts na ordem de dependência
├── PLANEJAMENTO.md
├── assets/
│   └── css/
│       ├── tokens.css            # design tokens em CSS variables
│       ├── base.css              # reset + tipografia
│       ├── layout.css            # shell: sidebar, topbar, área de conteúdo
│       ├── components.css        # botões, cards, tabelas, badges, modais, forms
│       └── pages.css             # ajustes específicos por tela
├── data/
│   └── seed.js                   # dados fictícios embutidos (gerador determinístico)
└── src/
    ├── main.js                   # bootstrap da aplicação
    ├── router.js                 # roteador por hash (#/processos/:id)
    │
    ├── domain/                   # ⭐ lógica pura — MIGRA 100% PRO REACT SEM ALTERAÇÃO
    │   ├── cnj.js
    │   ├── prazos.js
    │   ├── feriados.js           # nacionais + forenses 2024–2026 (calculados)
    │   ├── validators.js         # CPF, CNPJ, e-mail, OAB
    │   └── enums.js              # fases, status, áreas, perfis, prioridades
    │
    ├── services/                 # ⭐ camada de dados — TROCADA POR fetch NA MIGRAÇÃO
    │   ├── http.js               # simula latência e erro
    │   ├── db.js                 # localStorage + carga do seed
    │   ├── processoService.js
    │   ├── clienteService.js
    │   ├── prazoService.js
    │   ├── agendaService.js
    │   ├── tarefaService.js
    │   ├── documentoService.js
    │   ├── pastaDocumentoService.js   # pastas da aba Documentos
    │   ├── arquivoService.js          # binário do envio, só na sessão
    │   └── conteudoService.js         # texto editado, persistido e compartilhado entre abas
    │
    ├── store/
    │   ├── store.js              # createStore: getState, dispatch, subscribe
    │   └── selectors.js          # derivações (prazos críticos, contagem por fase)
    │
    ├── components/               # reutilizáveis — PascalCase
    │   ├── Button.js
    │   ├── Badge.js
    │   ├── Card.js
    │   ├── DataTable.js
    │   ├── Modal.js
    │   ├── Tabs.js
    │   ├── Toast.js
    │   ├── EmptyState.js
    │   ├── Skeleton.js
    │   ├── SearchInput.js
    │   ├── FilterBar.js
    │   ├── Pagination.js
    │   ├── Avatar.js
    │   ├── PrazoCard.js
    │   ├── Timeline.js
    │   ├── Calendar.js
    │   ├── KanbanBoard.js
    │   ├── DocumentExplorer.js   # pastas + arrastar documento
    │   ├── DocumentViewer.js     # visor em modal (prévia + ficha)
    │   └── DocumentEditor.js     # folha de edição (texto puro ou formatado)
    │
    ├── layout/
    │   ├── AppShell.js
    │   ├── Sidebar.js
    │   └── Topbar.js
    │
    ├── pages/
    │   ├── DashboardPage.js
    │   ├── ProcessosListPage.js
    │   ├── ProcessoDetalhePage.js
    │   ├── ProcessoFormPage.js
    │   ├── AgendaPage.js
    │   ├── ClientesPage.js
    │   ├── ClienteDetalhePage.js
    │   ├── TarefasPage.js
    │   └── DocumentoEditorPage.js   # abre em aba própria
    │
    └── utils/
        ├── dom.js                # h(), render(), delegate(), baixar()
        ├── format.js             # moeda, data, documento, telefone
        ├── mask.js               # máscaras de input
        └── exportar.js           # txt · md · html · rtf · PDF por impressão
```

---

## 5.1 Sistema de módulos — por que não ES Modules

O protótipo precisa abrir com **duplo clique no `index.html`**, sem servidor.

`<script type="module">` é bloqueado por CORS sob o protocolo `file://` (a origem vira `null`)
em Chrome, Edge e Firefox. Por isso o protótipo usa **scripts clássicos com um namespace global**:
cada arquivo é uma IIFE que registra seu módulo em `App`.

```js
// src/domain/cnj.js
(function (App) {
  'use strict';

  function validar(numero) { /* ... */ }
  function formatar(numero) { /* ... */ }

  App.domain.cnj = { validar, formatar, parsear, mascara };
})(window.App);
```

A conversão para ESM na migração é **mecânica** — remove o invólucro e troca a linha final por `export`:

```js
// src/domain/cnj.js  — no React
export function validar(numero) { /* corpo idêntico */ }
export function formatar(numero) { /* corpo idêntico */ }
```

**Regra:** nenhum arquivo depende da ordem de carga em *tempo de definição* — só em tempo de chamada.
Isso mantém o `index.html` tolerante e evita acoplamento por ordenação.

---

## 6. Contrato de componente

Todo componente é uma **função pura que recebe um objeto de props e devolve HTML**, com um `mount` opcional para listeners. Isso espelha a assinatura de um componente React.

```js
// components/PrazoCard.js
export function PrazoCard({ prazo, processo, responsavel, onCumprir }) {
  return `
    <article class="prazo-card prazo-card--${prazo.semaforo}" data-id="${prazo.id}">
      ...
    </article>`;
}

PrazoCard.mount = (root, { onCumprir }) => {
  delegate(root, 'click', '[data-action="cumprir"]', e =>
    onCumprir(e.target.closest('[data-id]').dataset.id)
  );
};
```

**Regras:**
- Props sempre como **objeto único desestruturado** — vira `props` do React sem esforço
- Componente **nunca** acessa o store diretamente; recebe dados por props
- Componente **nunca** chama service; recebe callbacks (`onX`) — equivalente a levantar estado
- Nada de estado guardado no DOM: a fonte da verdade é o store

### 6.1 Ciclo de vida dos listeners

Os handlers são ligados por **delegação no container da página**, nunca nos elementos
internos — assim sobrevivem à troca de `innerHTML` a cada re-render.

Isso cria dois riscos que a arquitetura precisa resolver explicitamente, porque no
React o reconciliador resolveria sozinho:

| Risco | Consequência real | Solução adotada |
|-------|-------------------|-----------------|
| Religar listeners a cada `desenhar()` | O mesmo clique dispara N vezes — baixar um prazo criaria N andamentos | `ligarEventos()` é chamado **apenas em `render()`**, uma vez por rota |
| Container reaproveitado entre rotas | O handler da tela anterior continua ativo — arrastar um card no kanban de Tarefas dispararia também o handler do kanban de Processos | O router **substitui o `<main>` por um nó novo** a cada rota; os listeners morrem com o nó antigo |

Consequência prática para quem escrever novas telas:

```js
function render(container) {
  ligarEventos();   // UMA vez, no render
  carregar();       // desenhar() pode rodar N vezes depois
}
```

Na migração, ambos os problemas desaparecem: `onClick` no JSX é reatado pelo React a
cada render e desmontado junto com o componente. A suíte `testes/listeners.test.js`
existe para travar essa regressão enquanto o protótipo for vanilla.

---

## 7. Camada de serviços

Todo service é `async` e devolve `Promise`, mesmo lendo do `localStorage`. Na migração, só o corpo muda.

```js
// services/processoService.js  — HOJE
export async function listar(filtros) {
  await delay(300);
  return db.get('processos').filter(aplicarFiltros(filtros));
}

// services/processoService.js  — DEPOIS
export async function listar(filtros) {
  return http.get('/api/processos', { params: filtros });
}
```

Assinaturas padrão: `listar(filtros)` · `obter(id)` · `criar(dados)` · `atualizar(id, dados)` · `remover(id)`.

---

## 8. Roteamento

Hash router espelhando as rotas do `react-router`:

| Rota | Página |
|------|--------|
| `#/` | Dashboard |
| `#/processos` | Lista de processos |
| `#/processos/novo` | Formulário (criação) |
| `#/processos/:id` | Detalhe |
| `#/processos/:id/editar` | Formulário (edição) |
| `#/agenda` | Agenda |
| `#/clientes` | Lista de clientes |
| `#/clientes/:id` | Detalhe do cliente |
| `#/tarefas` | Kanban |
| `#/documentos/:id/editar` | Editor de documento — **a única rota aberta em aba nova** |

---

## 9. Design tokens

Definidos em `tokens.css` como CSS variables — viram `theme` do Tailwind ou tema do design system na migração.

```css
:root {
  /* Cores de marca — sóbrio, institucional */
  --color-primary-600: #1e3a5f;
  --color-accent-500:  #b8873f;   /* dourado discreto */

  /* Semânticas de prazo */
  --color-prazo-ok:      #2f855a;
  --color-prazo-atencao: #c05621;
  --color-prazo-critico: #c53030;
  --color-prazo-vencido: #742a2a;

  /* Superfícies, texto, bordas */
  --color-bg, --color-surface, --color-text, --color-text-muted, --color-border

  /* Escala de espaçamento 4px */
  --space-1 … --space-12

  /* Tipografia, raios, sombras, transições */
  --font-sans, --text-xs … --text-3xl, --radius-*, --shadow-*
}
```

Suporte a tema claro/escuro via redefinição dos tokens.

---

## 10. Tabela de migração para React

| Protótipo (vanilla) | React |
|---------------------|-------|
| IIFE `(function(App){...})(window.App)` | remove o invólucro, troca por `export` — corpo idêntico |
| `domain/*.js` | **corpo copiado sem nenhuma alteração** |
| `services/*.js` | mesma assinatura, corpo trocado por `fetch` — consumido via React Query |
| `store/store.js` | Context + `useReducer`, Zustand ou Redux Toolkit |
| `components/X.js` (função + props) | componente funcional `X.jsx` |
| `X.mount()` com listeners | `onClick` / `onChange` nos elementos |
| `router.js` (hash) | `react-router-dom` |
| `tokens.css` | `tailwind.config` ou tema do design system |
| `pages/XPage.js` | componente de rota |
| `utils/format.js`, `mask.js` | copiado sem alteração |

---

## 11. Dados fictícios (seed)

Volume suficiente para os filtros, a paginação e os gráficos fazerem sentido:

- **9** usuários (1 administrador, 2 sócios, 4 advogados, 1 estagiário, 1 financeiro) —
  o administrador entrou em F2.1: sem ele, as telas restritas a esse perfil seriam
  inalcançáveis
- **25** clientes (15 PF, 10 PJ)
- **40** processos distribuídos entre as áreas, fases e tribunais
- **~200** andamentos
- **60** prazos — deliberadamente espalhados entre vencidos, críticos, em atenção e ok
- **20** compromissos (audiências, perícias, reuniões)
- **~60** documentos (metadados apenas, sem arquivo real), distribuídos entre a raiz e as pastas
- **~70** pastas de documentos — 1 a 3 por processo que tenha documento, parte delas com subpasta
- **35** tarefas nos quatro status
- **Feriados** nacionais e forenses de 2024 a 2026

---

## 12. Fases de implementação

| Fase | Entrega | Depende de |
|------|---------|------------|
| **0** | `index.html`, tokens, base, layout shell (sidebar + topbar), router funcionando | — |
| **1** | `domain/`: cnj.js, feriados.js, prazos.js, validators.js + página sandbox de teste | 0 |
| **2** | `data/seed.json`, `services/`, `store/` | 1 |
| **3** | Componentes base: Button, Badge, Card, DataTable, Modal, Tabs, Toast, EmptyState | 0 |
| **4** | Dashboard | 2, 3 |
| **5** | Processos: lista → detalhe → formulário | 4 |
| **6** | Agenda (calendário + lista) | 4 |
| **7** | Clientes + Tarefas (kanban) | 4 |
| **8** | Polimento: responsivo, estados de loading/vazio/erro, acessibilidade, tema escuro | 5–7 |

**Status:** fases 0 a 8 implementadas. Cobertura de verificação em `testes/`
(248 checagens): domínio, renderização de todas as rotas, interações e regressão
de listeners. Rodar com `npm test`.

---

## 13. Decisões arquiteturais registradas

1. **Pessoa unificada** em vez de tabelas separadas para cliente e parte contrária — reflete a realidade e evita duplicação.
2. **Soft delete em tudo** — escritório de advocacia não apaga registro; auditoria é defesa profissional.
3. **Lógica de domínio isolada de UI e de dados** — é o ativo que sobrevive a qualquer troca de framework.
4. **Services sempre assíncronos**, mesmo sem rede — evita refatoração de toda a árvore de chamadas na migração.
5. **Sem framework, sem build step, sem servidor** — abre com duplo clique. Isso obriga scripts clássicos
   com namespace `App` no lugar de ES Modules (ver 5.1) e o seed embutido como `.js` em vez de `.json`.
6. **Datas em ISO `YYYY-MM-DD`** internamente; formatação só na camada de apresentação.
7. **Valores monetários em centavos (inteiro)** — nunca `float` para dinheiro.
8. **Um nó de conteúdo novo por rota** — sem isso os listeners delegados vazam entre
   telas (ver 6.1). É a peça que o React entregaria de graça.
9. **Seed determinístico com datas relativas a hoje** — bugs são reproduzíveis, mas o
   protótipo nunca abre com todos os prazos vencidos.

---

## 14. Fora do protótipo, mas previsto no modelo

Campos e relações já contemplados para não haver migração de dados na fase 2:

- `Processo.valorProvisao` e `Processo.risco` → relatório de contingência
- `Documento.visivelCliente` e `Andamento.visivelCliente` → portal do cliente
- `Processo.segredoJustica` + `Usuario.perfil` → controle de acesso granular
- `Prazo.andamentoOrigemId` → rastreabilidade da publicação que gerou o prazo
- `Processo.processoPaiId` → apensos, recursos e incidentes
- Trilha de auditoria: `criadoEm` / `atualizadoEm` / `ativo` em todas as entidades
