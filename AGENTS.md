# Instruções para Agentes de IA (Consistência do Projeto)

Este repositório contém **temas Sass** e um **demo estático**. Estas regras existem para manter consistência visual, estrutural e de build ao longo do tempo.

## Objetivo do projeto

- Manter **compatibilidade de nomenclatura com Bootstrap 4** (classes/semântica de componentes).
- Centralizar componentes base em `core/scss/` e manter temas em `themes/<tema>/src/scss/theme.scss`.
- Gerar CSS via `sass` (Dart Sass), sem source maps.

## Regras de estrutura

- **Core**: mudanças em componentes (botões, cards, forms, tabelas, etc.) devem ir em `core/scss/partials/`.
- **Tema**: cada tema deve conter apenas o que for *específico do tema* (tokens/variáveis, paleta, overrides e ajustes finos).
- Evite adicionar novos arquivos fora da estrutura existente sem uma razão clara; se precisar, mantenha o padrão `core/scss/partials/<componente>.scss`.

## Regras para SCSS (consistência)

- Prefira **variáveis/tokens** para cores, espaçamentos e sombras (evite “números mágicos” repetidos).
- Quando alterar estilos compartilhados por múltiplos temas, priorize:
  1) ajustar o `core/` e
  2) usar overrides mínimos por tema.
- Mantenha **ordem de importação** estável em `theme.scss` (tokens/variáveis → core → overrides de plugins → componentes específicos do demo).
- Não duplique regras entre temas: extraia para `core/` quando fizer sentido.

## Artefatos gerados (não versionar)

- Não commitar CSS gerado em:
  - `themes/*/dist/`
  - `demo/assets/css/`

Essas pastas são geradas pelos scripts `npm run build:*`.

## Build e verificação

Antes de concluir alterações de SCSS:

- Rodar `npm run build` para garantir que todos os temas compilam.
- Se mexer em estilos do demo, rodar `npm run start` e conferir em `http://localhost:5173`.

## Mudanças seguras (o que evitar)

- Evite renomear classes existentes ou quebrar a semântica “Bootstrap 4 compat”.
- Evite reformatar arquivos inteiros sem necessidade (difícil de revisar).
- Evite introduzir dependências novas sem justificar (este projeto é propositalmente leve).

## Checklist rápido para PR/commit

- [ ] Alterações em `core/` não quebram compilação dos 3 temas
- [ ] `npm run build` passa
- [ ] Mudanças específicas do tema foram aplicadas de forma simétrica quando apropriado
- [ ] Nenhum arquivo gerado foi commitado (CSS em `dist/` e `demo/assets/css/`)
