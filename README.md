# 🎄 Amigo Oculto da Família

Site de uma página onde cada integrante da família monta a sua lista de desejos de Natal.

## Rodando
```bash
npm install
npm run build:css   # gera public/styles.css
npm run dev         # backend Express + SQLite em http://localhost:3000
```
O banco `amigo-oculto.db` é criado sozinho na primeira execução, já com a família (seed em `server/db.ts`).

Sem backend: troque para `USE_MOCK = true` em `public/app.js` e sirva a pasta `public/` (ex.: `cd public && python3 -m http.server 4321`). Nesse modo os dados ficam no navegador.

Para editar estilos: `npm run dev:css` (recompila o CSS sozinho a cada mudança).

## Estrutura
- `public/index.html`: a página
- `public/app.js`: lógica (lista, janela, formulário, modo mock)
- `src/input.css`: Tailwind + paleta do Natal (60% vermelho / 30% verde / 10% branco)
- `public/santa.svg`: o Papai Noel
- `public/fotos/`: fotos da família
- `server/db.ts`: banco SQLite (tabelas + seed da família)
- `server/index.ts`: servidor Express e rotas `/api`
- [BACKEND_GUIDE.md](BACKEND_GUIDE.md): o guia usado para montar o backend

Design: https://www.figma.com/design/Ygb2q8WmywTBiCFtUeDN9y
