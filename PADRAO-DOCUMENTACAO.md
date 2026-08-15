# Padrão de documentação — JurisControl

Como se escreve a documentação de uma funcionalidade deste projeto, e como se
capturam as imagens que vão nela.

Vale para **toda** página de documentação nova. Este arquivo é a única
autoridade sobre o padrão: não existe página-modelo a consultar, e o esqueleto
descrito aqui é completo o bastante para escrever uma página do zero.

O padrão nasceu documentando a tela de Agenda, e é dela que saem os exemplos
ao longo do texto — a tela continua no sistema, então os exemplos podem ser
conferidos abrindo `#/agenda`.

---

## Para quem se escreve

**Para quem vai usar o sistema, não para quem vai mantê-lo.**

Advogado, estagiário, secretária. Alguém que abriu a tela pela primeira vez e
quer saber o que fazer. Não é um leitor que conhece a palavra "componente",
"endpoint" ou "store" — e não precisa conhecer.

A documentação técnica já existe e mora em `CLAUDE.md`,
[PLANEJAMENTO.md](PLANEJAMENTO.md) e nos comentários do código. Não é papel
desta documentação repetir nada disso.

| Escreva assim | Não escreva assim |
|---|---|
| "O número vermelho conta os prazos críticos ou vencidos." | "O badge é alimentado por `prazoService.resumo()`." |
| "Clicar na faixa colorida leva à tela do processo." | "O evento tem um `href` para a rota `#/processos/:id`." |
| "A contagem é em dias úteis, não em dias corridos." | "`diasUteisEntre()` exclui o dia inicial." |

### Tom

Frases curtas. Voz ativa. Segunda pessoa ("você clica", não "o usuário deve
clicar"). Sem "simplesmente", sem "basta", sem "é só" — se fosse óbvio, não
precisaria de documentação.

**Sempre diga o porquê, não só o quê.** "Os dias sombreados não contam prazo"
é uma regra; "é o que explica por que um prazo de 15 dias pode terminar cinco
semanas depois" é o motivo de a regra existir. O segundo é o que faz a pessoa
lembrar.

---

## Onde mora

Tudo no Notion, sob a página **Protótipo ERP Advogados**.

- Uma página por funcionalidade, criada **como subpágina** dela.
- Nome no formato `<Funcionalidade> - Exemplo` — hífen simples, com espaços.
  Exemplos: `Financeiro - Exemplo`, `Publicações - Exemplo`.
- Ícone: um emoji que represente a tela (📅 para a Agenda, 💲 para o
  Financeiro). O mesmo emoji da barra lateral, quando houver.

---

## O esqueleto da página

Nem toda tela precisa de todas as seções, mas a **ordem** não muda, e as
marcadas com ★ são obrigatórias.

1. ★ **Abertura** — uma ou duas frases dizendo qual pergunta a tela responde.
   Não é um resumo do que ela contém; é a razão de ela existir.
2. ★ **Selo de dados fictícios** — um `<callout icon="🧪" color="yellow_bg">`
   avisando que as imagens vêm do protótipo com dados gerados.
3. ★ **Índice** — `<table_of_contents/>`.
4. ★ **Visão geral da tela** — a captura inteira, seguida da lista das partes
   da tela na ordem em que se lê.
5. ★ **Uma seção por área da tela**, na mesma ordem da lista acima.
6. ★ **As ações** — o que se pode fazer, cada uma em passo a passo numerado,
   com a captura do **resultado** (a confirmação, o estado depois).
7. **Onde os dados nascem** — o que esta tela *não* faz e em que tela se faz.
   Toda tela de acompanhamento precisa dessa seção.
8. **Telas relacionadas** — atalhos que o cabeçalho oferece.
9. **Em telas menores** — como o layout se reorganiza.
10. ★ **Perguntas frequentes** — quatro a seis, em blocos `<details>`. Escreva
    as perguntas que alguém faria depois de errar, não as que a tela já
    responde sozinha.
11. ★ **Glossário** — os termos do jargão jurídico que a tela usa.

### Recursos do Notion que valem a pena

| Para | Use |
|---|---|
| Aviso, alerta, ressalva | `<callout icon="⚠️" color="red_bg">` |
| Comparar opções, listar significados | `<table header-row="true" fit-page-width="true">` |
| Perguntas frequentes | `<details><summary>` |
| Escala de cores, estados | Tabela com `<span color="green">` na primeira coluna |

Cores dos callouts, por significado: `yellow_bg` para simulação, `blue_bg`
para dica, `red_bg` para risco, `gray_bg` para tranquilizar ("nada é
apagado").

---

## As imagens

**Toda seção que descreve uma área da tela tem uma imagem.** Texto sozinho
descrevendo posição na tela ("no canto superior direito") é o modo mais rápido
de a documentação ficar desatualizada sem ninguém perceber.

### Quantas e quais

Entre 8 e 14 por página. O conjunto mínimo:

- A tela inteira, uma vez.
- Um recorte de cada área (cabeçalho, filtros, painéis).
- Um recorte **fechado** do elemento que se repete — o cartão, a linha da
  lista. É onde se explica a anatomia.
- O resultado de cada ação (a confirmação depois do clique).
- Um estado vazio.
- A tela em largura estreita.

### Regras

1. **A imagem mostra o sistema rodando, com os dados do seed.** Nada de
   mockup, nada de recorte editado à mão.
2. **Legenda em toda imagem**, descrevendo o que se deve olhar — ela é o texto
   alternativo de quem usa leitor de tela.
3. **Nunca ilustre uma tela quebrada como se estivesse certa.** Se a tela
   estoura numa largura, documente numa largura em que ela funciona e
   **reporte o defeito** em vez de fotografá-lo. Ver "Antes de publicar".
4. Telas cheias em `deviceScaleFactor: 2`; recortes fechados em `3`.

---

## Como capturar

O protótipo exige sessão, e a tela de entrada não tem senha para automatizar.
A captura, então, roda sobre uma **cópia temporária do `index.html`** com um
script que entra sozinho.

### Passo 1 — gerar a cópia com entrada automática

Grave `bootstrap.js` num diretório temporário (nunca dentro do projeto):

```js
/* Entra automaticamente como sócio — só para a captura de telas. */
(function () {
  var App = window.App;
  var s = App.services.sessaoService;
  var orig = s.restaurar;

  s.restaurar = function () {
    var us = App.services.db.get('usuarios');
    var u = us.filter(function (x) { return x.perfil === 'socio'; })[0] || us[0];
    if (!u) return orig();
    App.store.setState({
      usuarioAtual: u,
      sessao: {
        usuarioId: u.id, perfil: u.perfil,
        iniciadaEm: new Date().toISOString(),
        expiraEm: new Date(Date.now() + 12 * 3600000).toISOString()
      }
    });
    return u;
  };
})();
```

E injete-o antes do `main.js`:

```js
const fs = require('fs');
const boot = fs.readFileSync(TEMP + '/bootstrap.js', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(
  '  <script src="src/main.js"></script>',
  '  <script>\n' + boot + '  </script>\n  <script src="src/main.js"></script>'
);
fs.writeFileSync('_captura-doc.html', html);
```

> **O arquivo `_captura-doc.html` é lixo de trabalho.** Ele precisa ficar na
> raiz porque os caminhos dos scripts são relativos — e precisa ser **apagado
> ao terminar**. Nunca vai para o commit.

### Passo 2 — dirigir o Chrome pelo DevTools Protocol

O `ws` já vem instalado como dependência do `jsdom`, então não há dependência
nova a instalar:

```js
const WebSocket = require('./node_modules/ws');
```

Suba o Chrome com porta de depuração e perfil próprio:

```
--headless=new --disable-gpu --hide-scrollbars
--no-first-run --no-default-browser-check
--remote-debugging-port=9333 --user-data-dir=<temp>
```

Para cada captura:

```js
await cmd('Emulation.setDeviceMetricsOverride', {
  width: 1500, height: 1120, deviceScaleFactor: 2, mobile: false
});
await cmd('Page.navigate', { url: 'about:blank' });   // ver armadilha 2
await cmd('Page.navigate', { url: BASE + '?j=' + nome + '#/agenda' });
// espera ~2,2 s: os services são assíncronos
await cmd('Runtime.evaluate', { expression: interacaoOpcional });
const r = await cmd('Page.captureScreenshot', { format: 'png', clip });
```

Para recortar por seletor, meça a caixa no próprio navegador e passe como
`clip` (com `scale` igual ao `deviceScaleFactor`):

```js
const r = await cmd('Runtime.evaluate', {
  expression: `(function(){
    var e = document.querySelector(${JSON.stringify(seletor)});
    var c = e.getBoundingClientRect(), m = 14;
    return JSON.stringify({ x: c.left - m, y: c.top - m,
                            width: c.width + m * 2, height: c.height + m * 2 });
  })()`,
  returnByValue: true
});
```

Estados que dependem de interação saem de um `Runtime.evaluate` antes da
captura — trocar filtro pelo store, clicar num botão, avançar o mês:

```js
App.store.setState({ agendaFiltros: { tipo: 'compromisso' } }); App.router.recarregar();
document.querySelectorAll('[data-action="cumprir-prazo"]')[2].click();
for (var i = 0; i < 5; i++) document.querySelector('[data-action="mes-proximo"]').click();
```

### As três armadilhas

**1. `--window-size` com `--screenshot` não produz viewport de celular.**
No Windows a janela tem largura mínima, então pedir 390px devolve uma imagem
de 390px recortada de um layout bem mais largo — parece estouro onde não há, e
esconde estouro onde há. Só `Emulation.setDeviceMetricsOverride` dá a largura
de verdade. É por isso que a captura é por CDP e não pela linha de comando.

**2. Navegar para a mesma URL trocando só o hash não recarrega a página.**
O estado da captura anterior vaza para a seguinte: o filtro continua aplicado,
o calendário continua no mês para onde você avançou. Passe por `about:blank`
entre uma captura e outra, e ponha um parâmetro distinto na query.

**3. Recorte por seletor precisa do elemento visível.** Se o alvo está abaixo
da dobra, ou aumente a altura do viewport, ou role até ele com
`scrollIntoView()` antes de medir.

---

## Publicar no Notion

Imagem no Notion não aceita caminho local. São três etapas:

1. `notion-create-file-upload` com o nome do arquivo → devolve `upload_url`,
   `upload_headers` e um `file_upload_id`.
2. Um POST `multipart/form-data` para `upload_url`, com o arquivo no campo
   `file` e os headers devolvidos. A URL é curta de vida — envie logo.
3. No markdown da página, referencie pelo esquema devolvido:

```
![Legenda descrevendo o que olhar.](file-upload://<file_upload_id>)
```

A página inteira vai num `notion-create-pages`, com
`parent: { type: "page_id", page_id: <Protótipo ERP Advogados> }`. A subpágina
aparece sozinha sob o índice da página-mãe.

Para corrigir depois, `notion-update-page` com `update_content` e o menor
trecho que identifique o lugar — não reescreva a página inteira.

---

## Antes de publicar

Uma documentação que descreve um botão que não funciona é pior que nenhuma:
ela transfere a culpa do sistema para quem está lendo.

- [ ] **Cada controle documentado foi conferido no código.** Botão renderizado
      não é botão ligado — procure o `data-action` no `ligarEventos` da página,
      não só no componente. (Foi assim que se descobriu que o botão "Perdido"
      da Agenda não tem handler.)
- [ ] **Nada que não existe foi prometido.** Se não há tela de cadastro,
      a documentação diz que não há, e diz onde o cadastro acontece.
- [ ] **O que é simulado está marcado como simulado**, conforme as três regras
      da simulação em `CLAUDE.md`.
- [ ] **A tela foi aberta a 360px** e o que se viu foi registrado. Se estoura,
      isso vira relato de defeito para quem programa — não vira imagem bonita
      numa largura conveniente sem avisar ninguém.
- [ ] **Nenhum link morto.** Referência a outra seção da mesma página se
      escreve por extenso ("na seção 7"), nunca como `[texto](#)`.
- [ ] **`_captura-doc.html` foi apagado** e o `git status` está limpo.
- [ ] **Todas as imagens carregaram** na página publicada — confira com
      `notion-fetch` depois de criar.

---

## Defeito encontrado durante a documentação

Acontece com frequência: documentar uma tela é a primeira vez que alguém a
percorre inteira, do começo ao fim, com atenção.

Quando acontecer, **não conserte de passagem e não maquie a documentação para
esconder**. Termine a documentação sobre o comportamento real, e relate o
defeito separadamente — com a largura em que aparece, o arquivo, a linha e o
que se esperava. A correção é decisão de quem programa, não efeito colateral
de uma tarefa de escrita.
