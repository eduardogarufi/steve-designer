# Steve Designer v0.3 — dono do design system (UI owner)

**Data:** 2026-09-03 · **Decisor:** Eduardo Garufi · **Status:** aprovado (design em chat, 2026-09-03)
**Origem:** avaliação do design doc do CTG Academy (Kaique Amorim, v0.2.0) contra o que o Steve reforça hoje.

## 1. Objetivo

O Steve passa a ser o **dono do design system de UI de qualquer projeto que o invoque**, web ou app. Em qualquer projeto:

1. ele **cria** o design system (modo Criação, já existe) **ou adota** um existente (modo Governança, já existe como Sheriff);
2. ele **dirige toda mudança de UI** — ou construindo via subagentes, ou entregando o contrato de execução para qualquer outro agente (Claude, Codex, v0, Lovable, humano);
3. ele **verifica** o trabalho feito por qualquer executor: working tree, commit, range ou PR, mecanicamente, semanticamente e visualmente;
4. ele **mantém a documentação canônica** do design system em `docs/design/` do projeto;
5. qualquer agente consegue **perguntar ao Steve o que ele faz** e receber o mapa de capacidades e o contrato.

As práticas do doc do Kaique que o Steve não reforçava entram como regra: camada de feedback, contraste por par de tokens, tipografia/z-index/breakpoints como tokens, estados obrigatórios por tela, voz e i18n, inventário de telas, governança com histórico, halt-and-ask e regras pagas.

## 2. Fora de escopo

- Migrar projetos que já usam o Steve 0.2 (compatibilidade é garantida, migração é manual).
- Escape hatch inline no lint (`// design-lint-allow`) — continua fora, como no playbook.
- Mudar o fluxo das seis fases de Criação. Elas ganham saídas novas, não fases novas.
- Publicar no marketplace da CapitalTrend dentro deste diff: é ação externa, feita depois com confirmação.

## 3. Modos e comandos

| Modo | Comando | Função |
|---|---|---|
| Criação | `/steve-designer:start` | Do zero: arsenal → discovery → referências → tokens → build → polish. Inalterado no fluxo; a fase 4 passa a gerar o design doc e a matriz de contraste. |
| Criação | `/steve-designer:resume` | Retoma pelo brief. Passa a procurar o brief em `docs/design/brief.md`, com fallback em `design-brief.md` na raiz. |
| Governança | `/steve-designer:enforce` (era `guard`) | Uma vez por repo: INGEST → CODIFY → gate. Passa a gerar também `docs/design/design-doc.md` e a apontar o `AGENTS.md` para a pasta. |
| Governança | `/steve-designer:check` (era `patrol`) | Verifica trabalho. Escopos: working tree (default), `--commit <sha>`, `--range <a>..<b>`, `--pr <n>`. Camadas: lint (bloqueia) → `design-enforcer` (severidade) → `design-critic` visual quando há preview ou `--visual`. |
| Direção | `/steve-designer:build` (novo) | Steve dirige uma mudança de UI num projeto governado. Lê manifesto + design doc, monta o **contrato da tela** (componentes permitidos, estados obrigatórios, tokens por papel, chaves i18n, regras pagas) e constrói via `component-builder`, ou conforma uma tela existente. Termina rodando `check`. |
| Direção | `/steve-designer:handoff` (novo) | Mesmo contrato do `build`, mas entregue como **prompt para outro executor** (qualquer agente ou ferramenta). Sai em `docs/design/handoffs/<data>-<tela>.md` e na tela. O executor devolve o diff e o Steve fecha com `check`. |
| Transversal | `/steve-designer:arsenal` | Inalterado. |
| Transversal | `/steve-designer:help` (novo) | Mapa: os três modos, os oito comandos, quando usar cada um, o que o Steve produz e onde. Serve humano e agente. |

`guard.md` e `patrol.md` são removidos; o CHANGELOG registra o rename. Não há alias.

### 3.1 Como outro agente invoca o Steve

Três portas, da mais leve à mais pesada:

1. **`references/capabilities.md`** — arquivo canônico, lido por qualquer agente que consiga ler arquivos: o que o Steve faz, comandos, artefatos e o contrato de retorno de cada um. `help` imprime este arquivo. O `AGENTS.md` gerado aponta para ele.
2. **`AGENTS.md` do projeto** — a seção do Steve diz: "toda mudança de UI passa pelo Steve: peça o contrato via `handoff` antes de escrever e rode `check` antes de commitar". Codex e qualquer agente que leia `AGENTS.md` ficam sob a lei sem precisar do plugin.
3. **A skill** — dentro do Claude Code, a descrição do SKILL.md passa a listar as capacidades e os gatilhos ("mudar UI", "nova tela", "conformar tela", "revisar diff de UI", "prompt para outra ferramenta").

## 4. Estrutura canônica em `docs/design/`

O Steve é dono desta pasta em qualquer projeto governado.

```
docs/design/
├── design-doc.md          # FONTE CANÔNICA (formato do design doc do Kaique, gerado)
├── brief.md               # memória das fases de Criação (era design-brief.md na raiz)
├── manifest.json          # inventário máquina (era design-system-manifest.json na raiz)
├── contrast.md            # matriz de contraste por par de tokens + pares proibidos
├── screens.md             # matriz de telas: tela → rota → componentes → estados → origem
├── decisions.md           # histórico: versão · data · autor · mudança · lição
└── handoffs/              # contratos entregues a outros executores
AGENTS.md                  # continua na raiz (é onde os agentes procuram)
```

Compatibilidade: `design_lint.mjs` e o `ingest` aceitam `--manifest`; o default passa a `docs/design/manifest.json` com fallback para `design-system-manifest.json` na raiz. `resume` e `build` leem `docs/design/brief.md` com fallback para `design-brief.md`. O hook e os templates de pre-commit/CI usam o default novo.

## 5. Manifesto v2

Campos novos, todos opcionais (v1 continua válido; ausente = vazio):

```json
{
  "schemaVersion": 2,
  "tokens": {
    "color":      { "bg-base": { "value": "#080b12", "role": "background" } },
    "feedback":   { "success": { "solid": "#10b981", "fg": "#34d399", "subtle": "rgba(16,185,129,.12)" } },
    "typography": { "h1": { "size": "2.5rem", "lineHeight": "1.1", "weight": "700", "tracking": "-0.02em", "family": "sans" } },
    "spacing": {}, "radius": {}, "shadow": {}, "motion": {},
    "zIndex":     { "dropdown": 100, "modal": 1000, "dropdown-in-modal": 1050, "toast": 1100 },
    "breakpoints": { "sm": "480px", "md": "768px", "lg": "1024px", "xl": "1280px" }
  },
  "components": [
    { "name": "Button", "import": "@/components/ui/button", "props": ["variant","size"],
      "states": ["default","hover","focus","disabled","loading"], "a11y": ["aria-busy","hit>=44px"] }
  ],
  "i18n": { "enabled": true, "keyPattern": "<area>.<screen>.<element>", "source": "src/lib/i18n/pt-BR.json" },
  "voice": { "tone": "executivo e calmo, sentence case, sem exclamação", "locale": "pt-BR" },
  "dsImportPrefixes": [], "packages": {}, "allowedHex": []
}
```

- `tokens.color` aceita string (v1) ou objeto `{value, role}` (v2). Papéis: `background`, `surface`, `text`, `accent`, `border`, `ring`, `brand`.
- `allowedHex` continua derivado de todas as cores (incluindo feedback).
- O ingest extrai: `--text-*`/`--font-*` → typography; `--z-*` → zIndex; `--bp-*`/`--breakpoint-*` → breakpoints; `--success|warning|danger|error|info(-fg|-subtle)?` → feedback. Detecta i18n por dependência (`next-intl`, `i18next`, `react-i18next`, `lingui`) ou por `steve.config.json` → `i18n`. Componentes: `states` e `a11y` só vêm de `steve.config.json` ou de edição manual (o detector não infere).

## 6. Lint

Regras mantidas: `no-hardcoded-hex`, `no-off-scale-spacing`, `no-unknown-component`.
Regra nova: **`no-literal-jsx-string`** — ativa só quando `manifest.i18n.enabled === true`. Flagra texto literal entre tags JSX e em `placeholder`/`title`/`aria-label`/`alt` com string literal. Ignora: só pontuação/número, `{t(...)}`, arquivos `*.test.*`, `*.stories.*`. Severidade `error`.
Sem regra de z-index ou tipografia no lint: fica para o `design-enforcer` (são julgamentos, não regex).

## 7. Agentes

**tokens-engineer** — além do que já produz: `feedback` (solid/fg/subtle), `zIndex` com `dropdown-in-modal`, `breakpoints` com a mudança de layout em cada um, tipografia por papel (display…caption, mono-label), e `docs/design/contrast.md` com a matriz fg×bg calculada (WCAG 2.1, ≥4.5:1 texto normal, ≥3:1 grande) e a lista de **pares proibidos**. O preview HTML mostra a camada de feedback e a matriz.

**component-builder** — regras novas, não negociáveis: toda tela cobre loading / empty / error / sucesso, mais os estados de domínio listados no contrato; texto via chave i18n quando `manifest.i18n.enabled`; **halt-and-ask**: se falta decisão de design (token, componente, cópia), para, registra em `decisions.md` como pendência e devolve ao diretor — não decide no código. Aplica `hard-won-rules.md`.

**design-enforcer** — checks novos: (6) estado obrigatório ausente, (7) token fora do `role` declarado no manifesto, (8) violação de regra paga, (9) string literal quando o lint não cobre (manifesto sem i18n), (10) cópia fora da `voice`. Aceita escopo commit/range/PR.

**design-critic** — sinal novo na dimensão Distinctiveness: "tudo é card" e "tudo é a mesma superfície". Usado pelo `check --visual`.

## 8. Templates

- `design-brief.template.md` → vira `brief.template.md`, ganha **Voz e cópia** (tom, padrão de mensagem por tipo, convenção de chave) e cabeçalho de governança (status `rascunho|em-revisao|cravado|superseded`, decisor, versão).
- **`design-doc.template.md`** (novo): §1 princípios, §2 tokens (core, marca, feedback, tipografia, espaço/raio/sombra, motion, z, breakpoints), §3 voz e microcópia, §4 componentes (props/estados/tokens/a11y), §5 estados obrigatórios, §6 telas, §7 a11y, §8 zero hardcode e paths, §9 DS de referência, §10 checklist "cravado", histórico. Preenchido pelo Steve a partir do manifesto e do brief.
- `screens.template.md` e `decisions.template.md` (novos, pequenos).
- `AGENTS.md.template.md` → ganha: halt-and-ask, estados obrigatórios, voz, ponteiro para `docs/design/` e para `capabilities.md`, e a frase "toda mudança de UI passa pelo Steve: `handoff` antes, `check` depois".
- `ci-design-check.template.yml` → job opcional `design-a11y` com `@axe-core/cli`, ativo quando `STEVE_A11Y_URL` está definido.
- `final-prompt.template.md` → vira `handoff.template.md`, agnóstico de ferramenta.

## 9. Referências

- **`hard-won-rules.md`** (novo): superfície flutuante com teto de altura e rolagem; `ConfirmDialog` como `alertdialog`, foco inicial em Cancelar, foco volta ao gatilho; dropdown dentro de modal precisa de z próprio; microcópia destrutiva nomeia consequência real e tem variantes `_zero`/`_um`; texto de feedback usa `fg`, nunca `solid`; texto claro sobre acento saturado reprova AA; empty state diz o que acontece, não só convida; sucesso reporta o número que importa; sem pré-seleção em campo imutável; conflitos 409 com mensagem própria apontando o campo.
- **`capabilities.md`** (novo): o mapa que `help` imprime.
- `governance-playbook.md`, `orchestration-map.md`, `phase-playbook.md`: atualizados para os nomes e modos novos.

## 10. Docs e versão

README em inglês reescrito: três modos, oito comandos, exemplos, estrutura `docs/design/`, como outro agente invoca, links para `docs/HELP.md` e `docs/INSTALACAO.md`. HELP.md em PT atualizado no mesmo formato. CHANGELOG fecha **0.3.0** (rename `guard→enforce`, `patrol→check` como BREAKING; brownfield sai de Unreleased). `plugin.json` e `marketplace.json` em 0.3.0.

## 11. Verificação

- Scripts: Tier 1 — estender `design_lint.test.mjs`, `design_lint.cli.test.mjs` e `test_ingest.py` com os casos novos (fixtures novas em `scripts/fixtures/`), sem arquivos de teste novos.
- Prosa (agentes, comandos, templates, docs): Tier 0 — `scripts/check_arsenal.sh` roda; `claude plugin validate .` (ou equivalente) passa; um `check` de fumaça num fixture.
- Review: `/codex:review` por fatia; `/codex:adversarial-review` sobre o diff consolidado.

## 12. Riscos

- Rename quebra hábito de quem usa `guard`/`patrol`: mitigado no CHANGELOG e no `help`.
- Mover manifesto e brief para `docs/design/`: fallback para os paths antigos em todos os leitores.
- `no-literal-jsx-string` pode dar falso positivo: por isso só liga com i18n declarado.
