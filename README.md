# Dashboard Sass Themes (Bootstrap 4 compat)

Este workspace contém **3 temas Sass modernos** (com nomenclatura de classes compatível com **Bootstrap 4**) e um **projeto web demo** para um dashboard de **rastreamento de veículos**, com filtros, relatórios e controles de frotas.

## Estrutura

- `core/scss/` — componentes base (grid/utilitários/btn/forms/table/card/modal) + overrides de Select2 e Flatpickr
- `themes/aurora/` — tema claro (alto contraste, vibrante)
- `themes/carbon/` — tema escuro (neutro, “enterprise”)
- `themes/atlas/` — tema claro/tech (azuis, layout “map-first”)
- `demo/` — site estático demonstrando componentes e alternância de tema

## Rodar

1. Instale dependências:
   - `npm install`
2. Gere CSS e suba o demo:
   - `npm run start`
3. Abra:
   - `http://localhost:5173`

## Demo por tema

Além da demo com troca de tema (via seletor), existem páginas **fixas** por tema para revisão completa:

- `http://localhost:5173/aurora.html`
- `http://localhost:5173/carbon.html`
- `http://localhost:5173/atlas.html`

> Observação: o dashboard é funcional com dados simulados (filtros, navegação, modais e export CSV).

> Dica: você pode usar Live Server do VS Code também; só rode `npm run build` antes.

## GitHub Pages (via GitHub Actions + docs/)

Este repo está pronto para publicar o demo no GitHub Pages usando GitHub Actions, gerando o site em `docs/` durante o workflow.

1. No GitHub, vá em **Settings → Pages**.
2. Em **Build and deployment**, selecione **Source: GitHub Actions**.
3. Faça push na branch `main`.

O workflow [ .github/workflows/pages.yml ] compila o Sass e publica as páginas:

- `/` (index com seletor de tema)
- `/aurora.html`
- `/carbon.html`
- `/atlas.html`
