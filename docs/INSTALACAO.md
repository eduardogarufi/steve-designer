# steve-designer — Guia rápido de instalação

steve-designer é um **plugin do Claude Code**. A instalação usa o próprio CLI
do Claude Code — ele **não** descobre plugins que você joga em
`~/.claude/plugins/` manualmente; é preciso registrar via marketplace.

## 1. Do GitHub (recomendado)

```bash
claude plugin marketplace add eduardogarufi/steve-designer
claude plugin install steve-designer@steve-designer
```

Depois **reinicie o Claude Code**.

## 2. De um clone local (para desenvolvimento do plugin)

```bash
git clone https://github.com/eduardogarufi/steve-designer.git
cd steve-designer
./install.sh --local
```

Suas edições aparecem no próximo restart do Claude Code.

## 3. Instalador interativo

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

## 4. Conferir se funcionou

Depois de reiniciar o Claude Code, rode:

```bash
claude plugin list | grep steve-designer
```

Deve aparecer `steve-designer@steve-designer  ✔ enabled`.

Dentro do Claude Code:

```
/help
```

Deve listar:
- `/steve-designer:arsenal`
- `/steve-designer:start`
- `/steve-designer:resume`

## 5. Usar

```
/steve-designer:arsenal   # checa pré-requisitos, oferece instalar o que falta
/steve-designer:start     # novo projeto de design
/steve-designer:resume    # continuar de onde parou (lê design-brief.md)
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
├── commands/                     # /steve-designer:arsenal, :start, :resume
├── agents/                       # 3 subagents (tokens, build, critic)
├── scripts/                      # check_arsenal, init_brief, start_preview
└── skills/steve-designer/
    ├── SKILL.md                  # o cérebro
    ├── references/               # catálogos de referência, anti-patterns
    └── templates/                # brief + snippets
```

## Primeiro teste sugerido

Num projeto vazio qualquer:
1. `/steve-designer:arsenal` — confirma que tudo está instalado
2. `/steve-designer:start` — começa o fluxo
3. Deixa ele rodar Discovery e veja se o tom sai no ponto

Se alguma coisa parecer estranha — tom, perguntas repetitivas, referência
errada — é sinal para ajustar. Mande o trecho do chat e a gente refina.
