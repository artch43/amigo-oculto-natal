import express from 'express';
import {db, type Gift, type Member} from './db.ts';
const app = express();
app.use(express.json());
app.use(express.static("public"));

app.listen(3000, () =>
    console.log("Rodando na porta 3000"));


app.get("/api/members", (req,res) => {

    const members = db.prepare("SELECT id, name, photo FROM members ORDER BY id").all() as
    Omit<Member, "gifts">[];

    const gifts = db.prepare(`
        SELECT id,
        member_id AS memberId,
        name,
        link,
        price_range AS priceRange,
        note,
        created_at AS createdAt
        FROM gifts
        ORDER BY created_at`).all() as Gift[];

    const lista: Member[] = [];
    for (const m of members) {
        const presentesDela: Gift[] = [];

        for (const g of gifts) {
            if(g.memberId === m.id) {
                presentesDela.push(g);
            }
        }

        lista.push({
        id: m.id,
        name: m.name,
        photo: m.photo,
        gifts: presentesDela,
        });
    }

    res.json(lista);
})

// Campo opcional: se for texto com conteúdo, salva sem espaços nas pontas.
// Se não vier, vier vazio ou não for texto (ex.: um número), salva null.
function textoOpcional(valor: unknown): string | null {
    if (typeof valor !== "string") return null;
    return valor.trim() || null;
}

// Busca um presente pelo id já no formato do JSON (camelCase).
function buscarPresente(id: number | bigint): Gift {
    return db.prepare(`
        SELECT id, member_id AS memberId, name, link,
        price_range AS priceRange, note, created_at AS createdAt
        FROM gifts WHERE id = ?`).get(id) as Gift;
}

app.post("/api/members/:id/gifts", (req,res) => {
    const { name, link, priceRange, note } = req.body ?? {};
    const id = Number(req.params.id)
    if (typeof name !== "string" || name.trim().length ===0) {
        return res.status(400).json({
            error: "O nome do presente é obrigatório"});
    }

    const membro = db.prepare("SELECT id FROM members WHERE id = ?").get(id);
    if (!membro) {
        return res.status(404).json ({error: "Integrante não encontrado"})
    }

    const resultado = db.prepare(`
        INSERT INTO gifts (member_id, name, link, price_range, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        name.trim(),
        textoOpcional(link),
        textoOpcional(priceRange),
        textoOpcional(note),
        new Date().toISOString()
    );

    res.status(201).json(buscarPresente(resultado.lastInsertRowid));
});

app.delete("/api/gifts/:id", (req, res) => {
    const id = Number(req.params.id)
    const deletar = db.prepare("DELETE FROM gifts WHERE id = ?");
    const resultado = deletar.run(id)
    if(resultado.changes === 0) {
        return res.status(404).json({
            error: "Presente não encontrado"
        });
    } else {
        res.status(204).end();
    }
})

app.put("/api/gifts/:id", (req, res) => {
    const id = Number(req.params.id);
    const {name,link, priceRange, note} = req.body ?? {};

    if(typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({
            error:"O nome do presente é obrigatório"
        })
    }

    const result = db.prepare(
        "UPDATE gifts SET name = ?, link = ?, price_range = ?, note = ? WHERE id = ?"
    ).run (
        name.trim(),
        textoOpcional(link),
        textoOpcional(priceRange),
        textoOpcional(note),
        id
    )

    if (result.changes === 0) {
        return res.status(404).json({
            error: "Presente não encontrado"
        });
    }

    res.json(buscarPresente(id));
})