# Copilot / Agentes de IA — Instruções do Repositório

Siga o guia principal em [AGENTS.md](AGENTS.md). Este arquivo existe para dar contexto rápido aos agentes durante edições.

## Contexto rápido

- Sass base em `core/scss/` (parciais por componente).
- Temas em `themes/<tema>/src/scss/theme.scss`.
- Demo estático em `demo/`.

## Comandos úteis

- Instalar deps: `npm install`
- Compilar tudo: `npm run build`
- Rodar demo: `npm run start`

## Expectativas ao editar

- Prefira mudanças pequenas e focadas.
- Preserve compatibilidade de classes estilo Bootstrap 4.
- Não commite arquivos gerados em `themes/*/dist/` e `demo/assets/css/` (já ignorados no `.gitignore`).
