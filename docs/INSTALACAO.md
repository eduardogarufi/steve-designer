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

## 4. Instalador interativo

```bash
./install.sh
```

Vai perguntar se você quer instalar do clone local ou do GitHub.

### Flags não-interativas

```bash
./install.sh --local       # registra este diretório como marketplace
./install.sh --github      # registra o repo do GitHub como marketplace
./install.sh --uninstall   # remove plugin + marketplace
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
./install.sh --uninstall
# ou manualmente:
claude plugin uninstall steve-designer@steve-designer
claude plugin marketplace remove steve-designer
```

## Estrutura do que você está instalando

```
steve-designer/
├── .claude-plugin/
│   ├── plugin.json               # manifest do plugin
│   └── marketplace.json          # manifest do marketplace
├── commands/                     # 8 comandos + 2 aliases depreciados (guard, patrol)
├── agents/                       # 4 subagents (tokens, build, critic, enforcer)
├── scripts/                      # check_arsenal, ingest, design_lint, steve_paths, start_preview
└── skills/steve-designer/
    ├── SKILL.md                  # o cérebro
    ├── references/               # capabilities.md, catálogos de referência, playbooks
    └── templates/                # brief, manifest, decisions, handoff
```

## Primeiro teste sugerido

Num projeto vazio qualquer:
1. `/steve-designer:arsenal` — confirma que tudo está instalado
2. `/steve-designer:start` — começa o fluxo
3. Deixa ele rodar Discovery e veja se o tom sai no ponto

Se alguma coisa parecer estranha — tom, perguntas repetitivas, referência
errada — é sinal para ajustar. Mande o trecho do chat e a gente refina.
