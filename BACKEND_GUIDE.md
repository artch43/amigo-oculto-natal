# 🎅 Guia do backend: Amigo Oculto da Família

Este guia é para **você escrever o backend sozinho**, em TypeScript. Ele não traz o código pronto. Cada etapa diz **o que fazer**, dá **dicas** e termina com um **teste** para você saber que acertou antes de seguir.

O frontend já está pronto em `public/`. Ele espera exatamente as rotas da seção 0.

---

## Visão geral (bem simples)

```
navegador ──fetch──▶  servidor Express (server/index.ts)
                          │
                          ▼
                     SQLite (amigo-oculto.db)  ← um arquivo no seu computador
```

- **Node 24** já roda arquivos `.ts` direto (`node server/index.ts`). Não precisa de `tsc` nem de `tsx`.
- **`node:sqlite`** já vem dentro do Node. Não precisa instalar banco nenhum.
- Única dependência: **Express**.

Você vai criar só **2 arquivos**:

| Arquivo | O que faz |
|---|---|
| `server/db.ts` | abre o banco, cria as tabelas e coloca a família (seed) |
| `server/index.ts` | o servidor: serve o site e responde as rotas `/api` |

---

## 0. O contrato da API (não mude isto!)

```ts
type Gift = {
  id: number;
  memberId: number;
  name: string;
  link: string | null;
  priceRange: string | null;
  note: string | null;
  createdAt: string;      // data em texto ISO, ex.: "2026-12-01T18:00:00.000Z"
};

type Member = {
  id: number;
  name: string;
  photo: string | null;   // ex.: "fotos/ana.jpg" (arquivo dentro de public/)
  gifts: Gift[];
};
```

| Método | Rota | Corpo (JSON) | Resposta de sucesso |
|---|---|---|---|
| GET | `/api/members` | – | `200` + `Member[]` (cada um com seus `gifts`) |
| POST | `/api/members/:id/gifts` | `{ name, link?, priceRange?, note? }` | `201` + o `Gift` criado |
| PUT | `/api/gifts/:id` | `{ name, link?, priceRange?, note? }` | `200` + o `Gift` atualizado |
| DELETE | `/api/gifts/:id` | – | `204` (sem corpo) |

Erros (o frontend mostra a mensagem do campo `error`):

- `400 { "error": "..." }`: faltou `name`, ou o `name` está vazio.
- `404 { "error": "..." }`: o integrante ou o presente com aquele id não existe.

---

## 1. Preparar o projeto

1. No terminal, dentro de `amigo-oculto-natal/`:
   ```bash
   npm i express
   npm i -D @types/express @types/node typescript
   ```
   O `typescript` serve só para o editor (VS Code) e para o `npm run typecheck`. Quem executa é o próprio Node.

2. Crie o `tsconfig.json` na raiz:
   ```json
   {
     "compilerOptions": {
       "target": "ES2023",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "strict": true,
       "noEmit": true,
       "allowImportingTsExtensions": true,
       "verbatimModuleSyntax": true,
       "erasableSyntaxOnly": true,
       "types": ["node"]
     },
     "include": ["server"]
   }
   ```

3. Adicione scripts no `package.json` (já existem `build:css` e `dev:css`):
   ```json
   "dev": "node --watch server/index.ts",
   "start": "node server/index.ts",
   "typecheck": "tsc"
   ```

**Regras do Node rodando TypeScript direto** (é por isso que estão no tsconfig):
- Ao importar um arquivo seu, **use a extensão `.ts`**: `import { db } from "./db.ts";`
- Para importar **só tipos**, use `import type`: `import type { Request, Response } from "express";`
- Não use `enum` nem `namespace`. Prefira `type` e objetos comuns.

✅ **Teste:** crie `server/index.ts` com um `console.log("oi")` e rode `npm run dev`. Tem que aparecer "oi".

---

## 2. O banco (`server/db.ts`)

### 2.1 Abrir o banco
- Importe `DatabaseSync` de `"node:sqlite"`.
- Crie e **exporte** `db = new DatabaseSync("amigo-oculto.db")`. O arquivo é criado sozinho.
- Rode `db.exec("PRAGMA foreign_keys = ON;")`. Sem isso o SQLite ignora as chaves estrangeiras.

### 2.2 Criar as tabelas
Use `db.exec(...)` com `CREATE TABLE IF NOT EXISTS`, que não dá erro se a tabela já existir.

Tabela **members**:
| coluna | tipo |
|---|---|
| id | `INTEGER PRIMARY KEY` (o SQLite numera sozinho) |
| name | `TEXT NOT NULL` |
| photo | `TEXT` (pode ser nulo) |

Tabela **gifts**:
| coluna | tipo |
|---|---|
| id | `INTEGER PRIMARY KEY` |
| member_id | `INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE` |
| name | `TEXT NOT NULL` |
| link, price_range, note | `TEXT` |
| created_at | `TEXT NOT NULL` |

> 💡 No banco os nomes usam `snake_case` (`member_id`). No JSON eles viram `camelCase` (`memberId`). Converter um no outro faz parte do exercício. Dica: `SELECT member_id AS memberId ...`

### 2.3 Seed (colocar a família)
- Faça uma lista `const FAMILY = [{ name: "Vovó Lúcia", photo: null }, ...]` com os nomes de verdade.
- **Só insira se a tabela estiver vazia**, senão cada reinício duplica a família. Pergunte `SELECT COUNT(*) AS total FROM members` antes.
- Para inserir use **prepared statement** com `?`. **Nunca** monte SQL juntando strings, porque isso abre brecha para SQL injection:
  ```ts
  const insert = db.prepare("INSERT INTO members (name, photo) VALUES (?, ?)");
  insert.run("Ana", "fotos/ana.jpg");
  ```

### 2.4 Tipos
Exporte os tipos `Gift` e `Member` (copie da seção 0). Você vai usá-los no `index.ts` com `import type`.

✅ **Teste:** importe `db.ts` no `index.ts`, rode o servidor e confira se apareceu o arquivo `amigo-oculto.db`. Para olhar dentro dele, use a extensão **"SQLite Viewer"** do VS Code.

---

## 3. O servidor (`server/index.ts`)

### 3.1 Esqueleto
1. `import express from "express";`
2. `const app = express();`
3. `app.use(express.json());`: sem isso o `req.body` chega `undefined`.
4. `app.use(express.static("public"));`: serve o `index.html`, o `app.js` e as fotos.
5. `app.listen(3000, () => console.log("http://localhost:3000"));`

✅ **Teste:** `npm run dev` e abra http://localhost:3000. O site tem que aparecer, ainda usando o modo mock.

### 3.2 `GET /api/members` (comece por esta)
Passos:
1. Busque todos os integrantes: `db.prepare("SELECT ...").all()`.
2. Busque todos os presentes, ordenados por `created_at`.
3. Para cada integrante, monte `{ ...membro, gifts: presentesDele }`. Dica: `filter` pelo `memberId`.
4. `res.json(lista)`.

✅ **Teste:**
```bash
curl http://localhost:3000/api/members
```
Tem que vir a família, cada um com `"gifts": []`.

### 3.3 `POST /api/members/:id/gifts`
Passos:
1. Pegue o id: `Number(req.params.id)`.
2. **Valide** o `name`: tem que ser string e, depois do `.trim()`, não pode ficar vazio. Se falhar, `res.status(400).json({ error: "O nome do presente é obrigatório" })` e `return`.
3. Confira se o integrante existe (`SELECT ... WHERE id = ?` com `.get(id)`). Se não existir, responda **404**.
4. Campos opcionais: se vier vazio ou não vier, salve `null`. Dica: `valor?.trim() || null`.
5. `INSERT` com `created_at = new Date().toISOString()`.
6. O `.run(...)` devolve `lastInsertRowid`. Use-o para buscar o presente criado e responda `res.status(201).json(presente)`.

> 💡 **Tipando o body:** `req.body` chega como `any`. Crie um tipo `GiftInput = { name?: unknown; link?: unknown; ... }` e valide com `typeof x === "string"`. Esse é o melhor exercício de TypeScript do projeto.

✅ **Teste:**
```bash
curl -X POST http://localhost:3000/api/members/1/gifts \
  -H "Content-Type: application/json" \
  -d '{"name":"Livro","priceRange":"Até R$ 60"}'

# deve dar 400:
curl -i -X POST http://localhost:3000/api/members/1/gifts \
  -H "Content-Type: application/json" -d '{"name":"   "}'

# deve dar 404:
curl -i -X POST http://localhost:3000/api/members/999/gifts \
  -H "Content-Type: application/json" -d '{"name":"x"}'
```

### 3.4 `DELETE /api/gifts/:id`
1. `DELETE FROM gifts WHERE id = ?`
2. O `.run()` devolve `changes`. Se for `0`, nada foi apagado e a resposta é **404**.
3. Se apagou: `res.status(204).end()`.

✅ **Teste:** `curl -i -X DELETE http://localhost:3000/api/gifts/1` deve dar `204`. Rodando de novo, deve dar `404`.

### 3.5 `PUT /api/gifts/:id`
Use a mesma validação do POST. Que tal transformar em uma função `parseGiftInput(body)` reaproveitada nas duas rotas?
1. `UPDATE gifts SET name = ?, link = ?, price_range = ?, note = ? WHERE id = ?`
2. Se `changes === 0`, responda **404**.
3. Busque o presente atualizado e responda com `200` + ele.

✅ **Teste:**
```bash
curl -X PUT http://localhost:3000/api/gifts/2 \
  -H "Content-Type: application/json" -d '{"name":"Livro capa dura"}'
```

---

## 4. Ligar o frontend no seu backend

1. Em `public/app.js`, troque `const USE_MOCK = true;` por `false`.
2. Recarregue http://localhost:3000.
3. Adicione, edite e remova presentes pelo site. Depois **reinicie o servidor**: os dados têm que continuar lá, porque estão no arquivo `.db`.

> Os presentes que você testou no modo mock ficaram no `localStorage` do navegador e **não** vão para o banco. É normal.

---

## 5. Fotos da família
1. Coloque as fotos em `public/fotos/` (ex.: `ana.jpg`). Fotos quadradas de uns 400×400 px ficam melhores.
2. No seed, use `photo: "fotos/ana.jpg"`.
3. Se o banco já existe, apague o `amigo-oculto.db` para o seed rodar de novo. Só faça isso **antes** de a família começar a usar, porque apaga os presentes.

---

## 6. Checklist final
- [ ] `npm run typecheck` sem erros
- [ ] As 4 rotas respondem certo, inclusive os erros 400 e 404
- [ ] Os dados continuam lá depois de reiniciar o servidor
- [ ] O site funciona com `USE_MOCK = false` no computador **e no celular**. No celular, acesse `http://IP-do-seu-computador:3000` na mesma rede Wi-Fi.

## 7. Desafios extras (opcionais)
- Middleware de erro: um `app.use((err, req, res, next) => ...)` que devolve `500 { error }`.
- Validar o `link` no servidor (só `http://` e `https://`). Dica: `new URL(link)`.
- Limitar o tamanho dos textos (ex.: `name` com no máximo 120 caracteres, igual ao `maxlength` do HTML).
- Colocar no ar: Railway ou Render, com um **volume** para o arquivo `.db` não sumir a cada deploy.

## Se travar
| Sintoma                                 | Provável causa                                        |
| --------------------------------------- | ----------------------------------------------------- |
| `req.body` é `undefined`                | esqueceu o `app.use(express.json())`                  |
| `Cannot find module './db'`             | faltou o `.ts` no import                              |
| `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`     | usou `enum`, `namespace` ou modificador no construtor |
| família duplicada a cada reinício       | o seed não confere se a tabela já tem gente           |
| site mostra "Não foi possível carregar" | servidor desligado, ou a rota não devolve JSON        |
