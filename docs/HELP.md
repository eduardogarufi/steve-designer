# Steve Designer — Guia de Uso

Referência rápida do que dá pra fazer. O Steve é o **dono do design system de UI de
qualquer projeto** onde é invocado. Ele tem **três modos**: **Criação** (do zero a uma UI
com identidade), **Governança** (adota e fiscaliza um design system existente) e
**Direção** (executa mudanças de UI específicas num projeto já governado).

---

## Comandos (slash)

| Comando | Modo | O que faz |
|---|---|---|
| `/steve-designer:start` | Criação | Começa uma sessão de design do zero: arsenal check → discovery → referências → tokens → build → polish |
| `/steve-designer:resume` | Criação | Retoma uma sessão existente (lê `docs/design/brief.md`, com fallback pro `design-brief.md` legado) |
| `/steve-designer:enforce` | Governança | **Setup único por repo.** Detecta o design system existente, gera `docs/design/manifest.json` + `docs/design/design-doc.md` + `AGENTS.md`, instala o gate (pre-commit + CI) e configura os MCPs (Claude + Codex). Nunca sobrescreve um repo brownfield — mostra o diff, mescla ou pula com aviso |
| `/steve-designer:check` | Governança | **Verificação sob demanda.** Roda o lint mecânico + o `design-enforcer` (review semântico) + opcionalmente o `design-critic` (visual). Escopos: working tree (padrão), `--commit <sha>`, `--range <a>..<b>`, `--pr <n>` |
| `/steve-designer:build` | Direção | Steve constrói (ou conforma) uma tela específica num projeto já governado, lendo o manifesto e o design doc, montando o contrato da tela, e chamando o `component-builder`. Termina rodando `check` |
| `/steve-designer:handoff` | Direção | Mesmo contrato do `build`, mas entregue como prompt pra outro executor (Claude, Codex, v0, Lovable, humano) rodar |
| `/steve-designer:arsenal` | Transversal | Verifica quais plugins/MCPs estão instalados e mostra o que falta |
| `/steve-designer:help` | Transversal | Imprime o mapa canônico de capacidades (`skills/steve-designer/references/capabilities.md`) literalmente |

**Aliases depreciados (funcionam até 0.4, com aviso):** `/steve-designer:guard` →
`enforce`, `/steve-designer:patrol` → `check`.

---

## Subagents (o Steve chama; você normalmente não chama direto)

| Subagent | Quando |
|---|---|
| `tokens-engineer` | Fase de Tokens (Criação) — gera paleta, escala tipográfica, spacing, motion + swatch visual |
| `component-builder` | Fase de Build (Criação) e `/build`/`/handoff` (Direção) — constrói uma seção por vez, fiel aos tokens |
| `design-critic` | Fase de Polish (Criação) e `/check --visual` (Governança) — crítica de designer sênior, aponta onde está "AI-genérico" |
| `design-enforcer` | `/check` (Governança) — pega o que o lint não vê: prop inventada, componente errado, token no papel errado, drift |

---

## Modo Governança — o ciclo

```
/steve-designer:enforce   →   INGEST → CODIFY → gate
(uma vez por repo)            (manifesto+design-doc)  (AGENTS.md + pre-commit + CI)
```

**O que o gate bloqueia** (pre-commit + CI, automático, vale em Claude e Codex):
- Cor hardcoded (hex que não está nos tokens) → use `var(--color-*)`
- Spacing fora da escala (ex.: `p-[13px]`)
- Componente fora do inventário (importou algo que não existe no DS)
- String literal em JSX (só quando `manifest.i18n.enabled === true`)

**A garantia cross-tool:** o gate é git-level (pre-commit + CI), então segura o código
**independente de qual agente escreveu** — Claude ou Codex.

**`check` verifica quatro escopos:** working tree (padrão), `--commit <sha>`,
`--range <a>..<b>`, `--pr <n>` — e sai com código 0 (limpo), 1 (violação) ou 2 (erro de
escopo/manifesto, inclusive flag inválida ou desconhecida).

**Política de override do manifesto:** `--manifest` explícito vence; senão
`docs/design/manifest.json`; senão o legado na raiz; os dois presentes = para e roda
`enforce` para migrar.

---

## Modo Direção — quando o design system já existe

Depois de `/steve-designer:enforce`, toda mudança de UI passa por `build` (Steve
constrói) ou `handoff` (Steve prepara o contrato pra outro executor rodar). Os dois
terminam com `check` — a mesma verificação, mecânica + semântica + visual, não importa
quem escreveu.

---

## Cheat sheet do dia a dia (com Governança já instalada)

| Você quer… | Como pedir |
|---|---|
| **Construir** tela/componente novo | `/steve-designer:build [tela]` ou linguagem natural: *"Steve, faz a tela X usando o design system deste projeto — leia o manifesto, use só o que existe, não invente nada"* |
| **Entregar** o contrato pra outro executor (Codex, v0, humano) | `/steve-designer:handoff [tela]` |
| **Conformar** uma tela existente ao DS | *"Steve, analisa `caminho/tela.tsx` e ajusta tudo ao design system; me mostra o que mudou antes de aplicar"* |
| **Conferir** antes do PR | `/steve-designer:check` (ou `/steve-designer:check --pr <n>`) |
| **Manter fiel passivamente** | Nada — o hook (a cada edição) + o pre-commit (a cada commit) já fiscalizam sozinhos |
| **Saber o que o Steve faz** | `/steve-designer:help` |

---

## O que roda sozinho vs. o que você aciona

- **Sozinho (depois do `enforce`):** o `design-lint` dispara a cada edição de arquivo de UI (silencioso se está tudo certo, fala só quando falha) e a cada commit. Você não pede nada.
- **Você aciona:** construir algo novo (`build`), entregar um contrato (`handoff`), consertar uma tela, ou rodar `check`. Aí é linguagem natural ou o comando.

---

## Prompts prontos pra colar

**Ativar a Governança num projeto** (dentro da pasta do repo):
```
/steve-designer:enforce
```

**Construir tela nova fiel ao DS:**
```
Steve, preciso de uma tela de [X] com [seções/campos]. Use o design system
deste projeto — leia o docs/design/manifest.json e use só os componentes e
tokens que já existem. Não invente nada novo.
```

**Conformar tela existente ao DS:**
```
Steve, analise [caminho/da/tela.tsx] e ajuste tudo ao design system: troque
valores hardcoded por tokens, use os componentes corretos do inventário no
lugar dos genéricos, e corrija o espaçamento pra escala. Me mostre o que
mudou antes de aplicar.
```

**Entregar um contrato pra outro executor:**
```
/steve-designer:handoff [tela] — for Codex
```

**Começar um projeto do zero (modo criação):**
```
/steve-designer:start
```

---

## Instalação

Três formas, veja o passo a passo completo em [`INSTALACAO.md`](./INSTALACAO.md):

```bash
# marketplace interno da CapitalTrend (publicação em andamento)
claude plugin marketplace add CapitalTrendGroup/claude-marketplace
claude plugin install steve-designer@capitaltrendgroup-internal

# ou GitHub
claude plugin marketplace add eduardogarufi/steve-designer
claude plugin install steve-designer@steve-designer

# ou clone local (dev do plugin)
./install.sh --local
```

Veja [`README.md`](../README.md) (em inglês) para a documentação completa e a estrutura
de `docs/design/`.

## Notas

- **Calibre o manifesto na primeira vez:** depois do `enforce`, revise o `docs/design/manifest.json` pra confirmar que capturou seus componentes e tokens. Se faltar algo, o `build`/"conformar" vai mirar um inventário incompleto.
- **Mapa de capacidades dentro do projeto:** o `enforce` copia o mapa de capacidades para `docs/design/capabilities.md` — qualquer agente no projeto lê esse arquivo sem precisar do plugin. `/steve-designer:help` sempre imprime a versão do plugin (a fonte).
- **Atualização do plugin:** se `enforce`/`check`/`build`/`handoff` não aparecerem num projeto, rode `claude plugin update steve-designer`.
- **Referências internas:** `skills/steve-designer/references/governance-playbook.md` (modelo de Governança), `skills/steve-designer/references/orchestration-map.md` (quando chamar o quê), `skills/steve-designer/references/capabilities.md` (mapa canônico, fonte do `/help`).
