# steve-designer — Guia rápido de instalação

steve-designer é um **plugin do Claude Code**. A instalação usa o próprio CLI
do Claude Code — ele **não** descobre plugins que você joga em
`~/.claude/plugins/` manualmente; é preciso registrar via marketplace.

## 1. Do marketplace interno da CapitalTrend

```bash
claude plugin marketplace add CapitalTrendGroup/claude-marketplace
claude plugin install steve-designer@capitaltrendgroup-internal
```

> Publicação nesse marketplace está em andamento. Se a instalação falhar, use uma das
> opções abaixo enquanto isso.

Depois **reinicie o Claude Code**.

## 2. Do GitHub

```bash
claude plugin marketplace add eduardogarufi/steve-designer
claude plugin install steve-designer@steve-designer
```

Depois **reinicie o Claude Code**.

## 3. De um clone local (para desenvolvimento do plugin)

```bash
git clone https://github.com/eduardogarufi/steve-designer.git
cd steve-designer
./install.sh --local
```

Suas edições aparecem no próximo restart do Claude Code.

## 3b. Kilo e Codex

Kilo e Codex são file-based: o instalador renderiza o bundle a partir da fonte única
(`skills/steve-designer/`) e copia para o diretório de config do CLI. Requer `python3` — é
ele que faz o merge de configuração sem duplicar servidores que você já define e ancora cada
arquivo no path absoluto da skill.

```bash
./install.sh --cli kilo  --global     # ~/.config/kilo
./install.sh --cli codex --global     # ~/.agents/skills + ~/.codex
./install.sh --cli kilo  --project    # ./.kilo
./install.sh --cli codex --project    # ./.agents + ./.codex
./install.sh --cli all   --global     # todos os CLIs detectados no PATH
```

Depois, reinicie o CLI. As portas de entrada mudam:

| CLI | Comando | Subagents | Hook por edição |
|---|---|---|---|
| Claude Code | `/steve-designer:enforce` | `agents/*.md` | PostToolUse |
| Kilo | `/steve-enforce` | `agent/steve-*.md` | — (só o gate git) |
| Codex | `$steve-designer enforce` | `.codex/agents/steve_*.toml` | `PostToolUse` em `apply_patch` |

No Codex, o instalador faz **merge** do MCP no `config.toml` (dentro de um bloco marcado) e
do hook no `hooks.json` — nunca substitui o arquivo, e nunca duplica um servidor que você já
tem. Depois rode `/hooks` no Codex para revisar e confiar no handler; hooks de projeto só
carregam com o projeto *trusted*. O gate git continua valendo de qualquer forma.

Os comandos de Kilo e Codex são **dispatchers finos**: carregam a skill instalada e executam
o workflow de `<skill>/commands/<nome>.md`. O instalador mantém um manifesto do que escreveu,
recusa sobrescrever arquivo que não é dele (use `--force` para forçar) e o `--uninstall`
remove exatamente esses paths.

Em Kilo e Codex, `frontend-design` e `ui-ux-pro-max-skill` não existem: o `arsenal` os
reporta como **degradados** e a Criação roda sem eles. Governança e Direção não degradam.

## 4. Instalador interativo

```bash
./install.sh
```

Vai perguntar qual CLI (Claude Code, Kilo, Codex ou todos) e, no caso do Claude Code, se
você quer instalar do clone local ou do GitHub.

### Flags não-interativas

```bash
./install.sh --cli claude --local      # registra este diretório como marketplace
./install.sh --cli claude --github     # registra o repo do GitHub como marketplace
./install.sh --cli <claude|kilo|codex|all> --global|--project
./install.sh --cli <name> --uninstall  # remove o que o instalador escreveu
```

## 5. Conferir se funcionou

Depois de reiniciar o Claude Code, rode:

```bash
claude plugin list | grep steve-designer
```

Deve aparecer `steve-designer@steve-designer  ✔ enabled` (ou
`@capitaltrendgroup-internal`, conforme a fonte usada).

Dentro do Claude Code:

```
/help
```

Deve listar os oito comandos do Steve, entre eles:
- `/steve-designer:arsenal`
- `/steve-designer:start`
- `/steve-designer:resume`
- `/steve-designer:enforce`
- `/steve-designer:check`
- `/steve-designer:build`
- `/steve-designer:handoff`
- `/steve-designer:help`

## 6. Usar

```
/steve-designer:arsenal   # checa pré-requisitos, oferece instalar o que falta
/steve-designer:start     # novo projeto de design, do zero (Criação)
/steve-designer:resume    # continuar de onde parou (lê docs/design/brief.md)
/steve-designer:enforce   # adota e fiscaliza o design system existente (Governança)
/steve-designer:check     # verifica uma mudança de UI contra o design system
/steve-designer:build     # constrói/conforma uma tela específica (Direção)
/steve-designer:handoff   # entrega o contrato de uma tela pra outro executor
/steve-designer:help      # imprime o mapa de capacidades do Steve
```

O `/arsenal` roda o `scripts/check_arsenal.sh` e, se você aceitar, executa os
comandos de instalação automaticamente (plugins, MCPs e skills essenciais).

## Configuração mínima recomendada para rodar em capacidade plena

Se o arsenal check apontar faltantes, estes são os essenciais:

```bash
claude plugin add anthropic/frontend-design
claude plugin add nextlevelbuilder/ui-ux-pro-max-skill
claude mcp add context7 -s user -- npx -y @upstash/context7-mcp@latest
claude mcp add playwright -s user -- npx @playwright/mcp@latest
claude mcp add chrome-devtools -s user -- npx @anthropic-ai/chrome-devtools-mcp@latest
npx ui-skills add baseline-ui
npx ui-skills add fixing-accessibility
npx ui-skills add fixing-motion-performance
```

Sem estes, ele opera em modo degradado (ele te avisa o que fica pior).

## Desinstalar

```bash
./install.sh --cli claude --uninstall
./install.sh --cli kilo   --uninstall
./install.sh --cli codex  --uninstall
# ou, para o Claude Code, manualmente:
claude plugin uninstall steve-designer@steve-designer
claude plugin marketplace remove steve-designer
```

O `--uninstall` remove **exatamente** os paths registrados no manifesto do instalador
(`.steve-designer-manifest.json`), mais as entradas de MCP que ele mesmo adicionou ao
`kilo.json`/`config.toml` e o handler que ele adicionou ao `hooks.json`. Ele nunca usa glob
de namespace, então arquivos seus como `steve-personal.md` não são tocados. Se não houver
manifesto, ele não apaga nada e avisa.

## Estrutura do que você está instalando

```
steve-designer/
├── skills/steve-designer/        # FONTE ÚNICA, autocontida e portável
│   ├── SKILL.md                  # o cérebro
│   ├── references/               # capabilities.md, catálogos, playbooks, arsenal
│   ├── templates/                # brief, design-doc, AGENTS.md, CI, pre-commit, MCP
│   └── scripts/                  # check_arsenal, ingest, design_lint, hook, preview + testes
├── adapters/kilo/                # README + template de MCP do Kilo
├── adapters/codex/               # README + templates de MCP (TOML) e hook (JSON)
├── scripts/build_dist.mjs        # renderiza dist/kilo e dist/codex a partir da fonte
├── .claude-plugin/               # adaptador Claude — manifests do plugin/marketplace
├── commands/                     # adaptador Claude — 8 comandos (fonte dos workflows)
├── agents/                       # adaptador Claude — 4 subagents
├── hooks/                        # adaptador Claude — hook PostToolUse
├── install.sh                    # instalador multi-CLI
└── dist/                         # bundles gerados (gitignored)
```

O layout do plugin do Claude Code é fixo por convenção, então o adaptador do Claude fica na
raiz do repo; Kilo e Codex são gerados a partir da fonte única. Nos bundles, os workflows de
comando são copiados para dentro da skill e os arquivos de comando viram dispatchers finos.

## Primeiro teste sugerido

Num projeto vazio qualquer:
1. `/steve-designer:arsenal` (Kilo: `/steve-arsenal`; Codex: `$steve-designer arsenal`) — confirma que tudo está instalado
2. `/steve-designer:start` — começa o fluxo
3. Deixa ele rodar Discovery e veja se o tom sai no ponto

Se alguma coisa parecer estranha — tom, perguntas repetitivas, referência
errada — é sinal para ajustar. Mande o trecho do chat e a gente refina.
