# Steve Designer — Guia de Uso

Referência rápida do que dá pra fazer. O Steve tem **dois modos**: **Criação** (do zero a uma UI com identidade) e **Sheriff** (manter um design system existente fiel, em Claude e Codex).

---

## Comandos (slash)

| Comando | Modo | O que faz |
|---|---|---|
| `/steve-designer:start` | Criação | Começa uma sessão de design do zero: arsenal check → discovery → referências → tokens → build → polish |
| `/steve-designer:resume` | Criação | Retoma uma sessão existente (lê o `design-brief.md` e continua de onde parou) |
| `/steve-designer:arsenal` | Ambos | Verifica quais plugins/MCPs estão instalados e mostra o que falta |
| `/steve-designer:guard` | Sheriff | **Setup único por repo.** Detecta a stack, gera o `design-system-manifest.json` + `AGENTS.md`, instala o gate (pre-commit + CI) e configura os MCPs (Claude + Codex). Mostra o diff, não commita sozinho |
| `/steve-designer:patrol` | Sheriff | **Review sob demanda.** Roda o lint mecânico + o `design-enforcer` (review semântico) no diff atual. Use antes de abrir PR |

---

## Subagents (o Steve chama; você normalmente não chama direto)

| Subagent | Quando |
|---|---|
| `tokens-engineer` | Fase de Tokens (criação) — gera paleta, escala tipográfica, spacing, motion + swatch visual |
| `component-builder` | Fase de Build (criação) — constrói uma seção por vez, fiel aos tokens |
| `design-critic` | Fase de Polish (criação) — crítica de designer sênior, aponta onde está "AI-genérico" |
| `design-enforcer` | Sheriff (`/patrol`) — pega o que o lint não vê: prop inventada, componente errado, token no papel errado, drift |

---

## Modo Sheriff — o ciclo

```
/steve-designer:guard   →   INGEST → CODIFY → PATROL
(uma vez por repo)          (manifesto)  (AGENTS.md+gate)  (lint+enforcer)
```

**O que o gate bloqueia** (pre-commit + CI, automático, vale em Claude e Codex):
- Cor hardcoded (hex que não está nos tokens) → use `var(--color-*)`
- Spacing fora da escala (ex.: `p-[13px]`)
- Componente fora do inventário (importou algo que não existe no DS)

**A garantia cross-tool:** o gate é git-level (pre-commit + CI), então segura o código **independente de qual agente escreveu** — Claude ou Codex.

---

## Cheat sheet do dia a dia (com Sheriff já instalado)

| Você quer… | Como pedir |
|---|---|
| **Construir** tela/componente novo | Linguagem natural: *"Steve, faz a tela X usando o design system deste projeto — leia o manifesto, use só o que existe, não invente nada"* |
| **Conformar** uma tela existente ao DS | *"Steve, analisa `caminho/tela.tsx` e ajusta tudo ao design system; me mostra o que mudou antes de aplicar"* |
| **Diagnosticar** uma tela antes de mexer | `/steve-designer:patrol` |
| **Conferir** antes do PR | `/steve-designer:patrol` |
| **Manter fiel passivamente** | Nada — o hook (a cada edição) + o pre-commit (a cada commit) já fiscalizam sozinhos |

---

## O que roda sozinho vs. o que você aciona

- **Sozinho (depois do `guard`):** o `design-lint` dispara a cada edição de arquivo de UI (silencioso se está tudo certo, fala só quando falha) e a cada commit. Você não pede nada.
- **Você aciona:** construir algo novo, consertar uma tela, ou rodar `/patrol`. Aí é linguagem natural ou o comando.

---

## Prompts prontos pra colar

**Ativar o Sheriff num projeto** (dentro da pasta do repo):
```
/steve-designer:guard
```

**Construir tela nova fiel ao DS:**
```
Steve, preciso de uma tela de [X] com [seções/campos]. Use o design system
deste projeto — leia o design-system-manifest.json e use só os componentes e
tokens que já existem. Não invente nada novo.
```

**Conformar tela existente ao DS:**
```
Steve, analise [caminho/da/tela.tsx] e ajuste tudo ao design system: troque
valores hardcoded por tokens, use os componentes corretos do inventário no
lugar dos genéricos, e corrija o espaçamento pra escala. Me mostre o que
mudou antes de aplicar.
```

**Começar um projeto do zero (modo criação):**
```
/steve-designer:start
```

---

## Notas

- **Calibre o manifesto na primeira vez:** depois do `guard`, revise o `design-system-manifest.json` pra confirmar que capturou seus componentes e tokens. Se faltar algo, o "conformar" vai mirar um inventário incompleto.
- **Atualização do plugin:** se `guard`/`patrol` não aparecerem num projeto, rode `claude plugin update steve-designer`.
- **Referências internas:** `skills/steve-designer/references/governance-playbook.md` (modelo do Sheriff), `references/orchestration-map.md` (quando chamar o quê).
