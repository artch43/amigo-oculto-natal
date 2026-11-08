import { DatabaseSync } from "node:sqlite";
export const db = new DatabaseSync("amigo-oculto.db");
db.exec("PRAGMA foreign_keys = ON");

export type Gift = {
  id: number;
  memberId: number;
  name: string;
  link: string | null;
  priceRange: string | null;
  note: string | null;
  createdAt: string;      // data em texto ISO, ex.: "2026-12-01T18:00:00.000Z"
};

export type Member = {
  id: number;
  name: string;
  photo: string | null;   // ex.: "fotos/ana.jpg" (arquivo dentro de public/)
  gifts: Gift[];
};

db.exec(`
    CREATE TABLE IF NOT EXISTS members(
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    photo TEXT
)`);

db.exec(`
    CREATE TABLE IF NOT EXISTS gifts(
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    link TEXT,
    price_range TEXT,
    note TEXT,
    created_at TEXT NOT NULL)`);


const FAMILY = [{name: "Vovó Marlene", photo: "fotos/marlene.jpg"}, {name: "Isabel", photo: "fotos/isabel.jpg"}
    , {name: "Laura", photo: "fotos/laura.jpg"}, {name: "Luísa", photo: "fotos/luisa.jpg"}, {name: "Arthur", photo: "fotos/arthur.jpg"}, {name: "Alexandre", photo: "fotos/alexandre.jpg"}
    , {name: "Patrícia", photo: "fotos/patricia.jpg"}, {name: "Gian", photo: "fotos/gian.jpg"}, {name: "Adriana", photo: "fotos/adriana.jpg"}
    , {name: "Nina", photo: "fotos/nina.jpg"}
]

const insert = db.prepare("INSERT INTO members (name,photo) VALUES (? , ?)");

const { total } = db.prepare("SELECT COUNT(*) AS total FROM members").get() as {total:number};
if (total ==0) {
    for (const m of FAMILY) insert.run(m.name, m.photo);
}

