# JurisControl — convenções do projeto

Protótipo de controle de processos judiciais. HTML, CSS e JavaScript puro:
sem framework, sem build, sem backend. Abre por duplo clique em `index.html`,
sob `file://`.

O planejamento completo está em [PLANEJAMENTO.md](PLANEJAMENTO.md) e
[PLANEJAMENTO-FASE2.md](PLANEJAMENTO-FASE2.md). Este arquivo guarda só as
regras que precisam valer em **todo** código novo.

Documentação de funcionalidade para o usuário final — a que vai para o Notion,
com capturas de tela — segue
[PADRAO-DOCUMENTACAO.md](PADRAO-DOCUMENTACAO.md), sem exceção.

---

## Responsividade — padrão do projeto

**Toda página é responsiva. Sem exceção, e sem "depois eu arrumo".**

Não é preferência estética: metade do trabalho de advocacia acontece com o
celular na mão, no corredor do fórum. Uma tela que empurra a página de lado
esconde o menu e o cabeçalho, e quem está com pressa se perde.

A regra é verificada por `testes/responsivo.test.js` a cada `npm test`.

### A escala de breakpoints

Quatro degraus. Cada um tem um motivo físico — não são números redondos
escolhidos por gosto:

| Degrau | Quando |
|--------|--------|
| **600px** | telefone em pé |
| **720px** | telefone deitado / tablet estreito |
| **900px** | tablet — é onde a sidebar vira gaveta |
| **1100px** | desktop estreito — onde um layout de dois painéis deixa de caber |

`@media (min-width: 901px)` é o par válido de `max-width: 900px`; o teste
aceita `degrau + 1` por isso.

**Não invente um quinto degrau para resolver um caso.** Se um layout só
quebra em 830px, o problema é o layout, não a escala. Acrescentar um degrau é
decisão de projeto: mexa em `ESCALA` no teste e escreva o motivo junto.

> **Atenção:** custom properties **não funcionam** dentro de condição de
> `@media` — `@media (max-width: var(--bp-lg))` falha em silêncio. Por isso a
> escala é convenção verificada por teste, e não token CSS.

### As cinco regras

**1. Grade de largura fixa colapsa.** Uma grade tipo `300px 1fr` não encolhe:
abaixo de ~400px de container ela empurra a página inteira. Toda grade com
trilha em px precisa de regra de colapso em algum degrau.

```css
.pub { grid-template-columns: 340px 1fr; }

@media (max-width: 1100px) {
  .pub { grid-template-columns: 1fr; }
}
```

Quando a grade só precisa se reorganizar, prefira `auto-fit`/`auto-fill` —
resolve sozinho, sem media query:

```css
.grid--kpi { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
```

**2. Conteúdo largo rola dentro do próprio container, nunca na página.**
Tabela, diagrama e bloco de código ficam dentro de um elemento com
`overflow-x: auto`. A tabela mantém `min-width` de propósito — tabela
espremida é ilegível —, mas quem rola de lado é ela, não o `<body>`.

```html
<div class="table-wrap"><table class="table">…</table></div>
```

**3. Linha que guarda botão quebra.** Botão não encolhe: seu tamanho não
depende do container. Toda linha de ações leva `flex-wrap: wrap`.

Um par ícone + texto **não** precisa disso — encolhe sozinho. A lista das
linhas que precisam está em `LINHAS_DE_ACAO`, no teste; acrescente ali quando
criar uma nova.

**4. Nada declara largura mínima maior que 600px** fora de um container com
rolagem própria, e **nada usa `width: 100vw`** — `100vw` inclui a barra de
rolagem e produz uma barra horizontal que ninguém consegue explicar. Use
`100%`.

**5. A meta viewport não bloqueia zoom.** Nada de `user-scalable=no` nem de
`maximum-scale`. Num sistema que exibe número de processo com 20 dígitos,
tirar o zoom de quem enxerga mal é barreira de acessibilidade.

### O que o teste NÃO garante

O `jsdom` monta o DOM mas **não calcula largura nenhuma**, então é impossível
medir estouro de verdade sem um navegador. A suíte verifica as *causas*
mecânicas conhecidas, na fonte.

Passar não prova que a tela está boa no celular — prova que as armadilhas
conhecidas não voltaram. **Antes de dar uma tela por pronta, abra o
inspetor em 360px de largura e role até o fim.** É a única prova real.

---

## Arquitetura — o que não pode mudar

- **Sem ES Modules e sem `fetch` de JSON.** Ambos são bloqueados por CORS sob
  `file://`, e abrir por duplo clique é decisão de projeto. Módulos são IIFE
  registrando em `window.App`.
- **`src/domain/` é lógica pura.** Sem DOM, sem store, sem service. É o que
  permite testar sob Node puro e o que migra para o React sem alteração.
- **Services são sempre `async`** e devolvem `Promise` via
  `App.services.http.requisicao(fn)`. Assinaturas: `listar`, `obter`,
  `criar`, `atualizar`, `remover`.
- **Soft delete em tudo** (`ativo: false`). Nenhum registro é apagado.
- **Dinheiro em centavos inteiros**, datas em ISO `YYYY-MM-DD`.
- **Componente é função pura** que recebe um objeto de props e devolve HTML,
  com `mount(root, handlers)` opcional para listeners. Callbacks começam com
  `ao*` (`aoAvancar`, `aoSalvar`) — nunca `on*`.
- **O router troca o nó `<main>` a cada rota.** As páginas ligam listeners
  por delegação no container; descartar o nó descarta os listeners junto.

## As três regras da simulação

O protótipo não tem backend, e isso nunca é escondido.

1. **Nada finge ser real.** O que é simulado leva um `SeloSimulado` dizendo o
   que não acontece e o que aconteceria na fase 3.
2. **A simulação mora em `services/simulado/`**, com as assinaturas que o
   serviço real terá.
3. **O que pode ser real, é real.** Motor de prazos do CPC, dígito
   verificador do CNJ, CPF/CNPJ e linha digitável FEBRABAN são calculados de
   verdade — não são valores plausíveis inventados.

## Testes

```bash
npm test
```

Suítes sem `jsdom` compartilham o sandbox de `testes/ambiente.js`, que carrega
o núcleo na ordem de dependência. **Módulo novo no seed entra ali, uma vez** —
foi o que parou de quebrar seis suítes a cada dependência nova.

Ao criar uma suíte, registre em `testes/executar.js`.

Um teste precisa poder falhar: ao escrever um que verifica correção, desligue
a correção uma vez e confirme que ele acusa.
