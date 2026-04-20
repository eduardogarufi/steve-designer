# steve-designer — Guia rápido de instalação

## 1. Extrair

### tar.gz
```bash
tar -xzf steve-designer-plugin-v0.1.0.tar.gz
cd steve-designer-plugin
```

### zip
```bash
unzip steve-designer-plugin-v0.1.0.zip
cd steve-designer-plugin
```

## 2. Instalar

### Interativo (recomendado na primeira vez)
```bash
./install.sh
```
Vai perguntar se você quer instalar como **pessoal** (em qualquer projeto) ou **projeto** (só neste).

### Direto
```bash
./install.sh --personal   # ~/.claude/plugins/steve-designer
./install.sh --project    # ./.claude/plugins/steve-designer
```

### Manual (se preferir)
Basta copiar a pasta inteira para:
- `~/.claude/plugins/steve-designer/` (pessoal)
- `./.claude/plugins/steve-designer/` (projeto)

## 3. Reiniciar o Claude Code

Fecha e abre uma nova sessão — plugins e skills só registram na inicialização.

## 4. Usar

```
/steve-designer:start     # novo projeto
/steve-designer:resume    # continuar onde parou (lê design-brief.md)
```

A primeira coisa que ele faz é **arsenal check** — te diz o que falta instalar e te dá os comandos prontos para copiar.

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

## Como saber se funcionou

Depois de instalar e reiniciar, rode:
```
/help
```
Você deve ver `steve-designer:start` e `steve-designer:resume` na lista de comandos.

Ou simplesmente diga algo como: "Quero criar um site para X" — o skill deve ativar automaticamente por conta da descrição no frontmatter.

## Estrutura do que você está instalando

```
steve-designer-plugin/
├── .claude-plugin/plugin.json          # manifest
├── README.md                           # doc completa
├── install.sh                          # installer
├── commands/                           # /steve-designer:start, :resume
├── agents/                             # 3 subagents (tokens, build, critic)
├── scripts/                            # check_arsenal, init_brief, start_preview
└── skills/steve-designer/
    ├── SKILL.md                        # o cérebro
    ├── references/                     # 7 arquivos de referência (catálogos, anti-patterns, etc.)
    └── templates/                      # 3 templates (brief, final-prompt, CLAUDE.md snippet)
```

## Primeiro teste sugerido

Num projeto vazio qualquer:
1. `/steve-designer:start`
2. Deixa ele rodar o arsenal check
3. Começa a conversar quando ele fizer a primeira pergunta de Discovery
4. Veja se a conversa sai no tom que você queria

Se alguma coisa parecer estranha — tom, perguntas repetitivas, referência errada — é sinal para eu ajustar. Manda o trecho do chat e a gente refina.
