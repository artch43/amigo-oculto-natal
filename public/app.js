// ============================================================
//  Amigo Oculto da Família — frontend
// ============================================================
//  USE_MOCK = true  → os dados ficam no localStorage do navegador
//                     (serve para testar antes de o backend existir)
//  USE_MOCK = false → o site conversa com o seu backend em /api
// ============================================================
const USE_MOCK = false;
const API_URL = "/api";

// Família usada SÓ no modo mock. No backend, quem define a família é o banco (seed).
// "photo" é o caminho da foto dentro de public/ (ex.: "fotos/ana.jpg") ou null.
const MOCK_FAMILY = [
  { id: 1, name: "Vovó Lúcia", photo: null },
  { id: 2, name: "Vovô José", photo: null },
  { id: 3, name: "Mãe", photo: null },
  { id: 4, name: "Pai", photo: null },
  { id: 5, name: "Arthur", photo: null },
  { id: 6, name: "Ana", photo: null },
  { id: 7, name: "Tio Carlos", photo: null },
  { id: 8, name: "Tia Bia", photo: null },
];

// ------------------------------------------------------------
//  API — mesmo contrato nos dois modos
//  Member = { id, name, photo, gifts: Gift[] }
//  Gift   = { id, memberId, name, link, priceRange, note, createdAt }
// ------------------------------------------------------------
const httpApi = {
  async getMembers() {
    return request("GET", "/members");
  },
  async addGift(memberId, data) {
    return request("POST", `/members/${memberId}/gifts`, data);
  },
  async updateGift(giftId, data) {
    return request("PUT", `/gifts/${giftId}`, data);
  },
  async deleteGift(giftId) {
    return request("DELETE", `/gifts/${giftId}`);
  },
};

async function request(method, path, body) {
  const res = await fetch(API_URL + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status} ao falar com o servidor`);
  }
  return res.status === 204 ? null : res.json();
}

const MOCK_KEY = "amigo-oculto:v1";
const mockApi = {
  _load() {
    const saved = JSON.parse(localStorage.getItem(MOCK_KEY) || "null");
    return saved ?? { nextId: 1, gifts: [] };
  },
  _save(db) {
    localStorage.setItem(MOCK_KEY, JSON.stringify(db));
  },
  async getMembers() {
    const db = this._load();
    return MOCK_FAMILY.map((m) => ({ ...m, gifts: db.gifts.filter((g) => g.memberId === m.id) }));
  },
  async addGift(memberId, data) {
    if (!MOCK_FAMILY.some((m) => m.id === memberId)) throw new Error("Integrante não encontrado");
    const db = this._load();
    const gift = { id: db.nextId++, memberId, ...data, createdAt: new Date().toISOString() };
    db.gifts.push(gift);
    this._save(db);
    return gift;
  },
  async updateGift(giftId, data) {
    const db = this._load();
    const gift = db.gifts.find((g) => g.id === giftId);
    if (!gift) throw new Error("Presente não encontrado");
    Object.assign(gift, data);
    this._save(db);
    return gift;
  },
  async deleteGift(giftId) {
    const db = this._load();
    db.gifts = db.gifts.filter((g) => g.id !== giftId);
    this._save(db);
    return null;
  },
};

const api = USE_MOCK ? mockApi : httpApi;

// ------------------------------------------------------------
//  Estado + elementos
// ------------------------------------------------------------
let members = [];
let currentMemberId = null;
let editingGiftId = null;

const $ = (sel) => document.querySelector(sel);
const els = {
  members: $("#members"),
  status: $("#status"),
  memberCount: $("#member-count"),
  dialog: $("#list-dialog"),
  dlgAvatar: $("#dlg-avatar"),
  dlgName: $("#dlg-name"),
  dlgClose: $("#dlg-close"),
  giftList: $("#gift-list"),
  giftEmpty: $("#gift-empty"),
  form: $("#gift-form"),
  formTitle: $("#form-title"),
  formSubmit: $("#form-submit"),
  formCancel: $("#form-cancel"),
  formError: $("#form-error"),
};

// Cria elementos com segurança (textContent, nunca innerHTML com dados do usuário)
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function svg(markup) {
  const t = document.createElement("template");
  t.innerHTML = markup.trim(); // markup fixo do próprio código, sem dados do usuário
  return t.content.firstChild;
}

function initials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function countLabel(n) {
  if (n === 0) return "Nenhum desejo ainda";
  return n === 1 ? "1 desejo" : `${n} desejos`;
}

function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function avatarContent(member) {
  if (member.photo) {
    return h("img", { src: member.photo, alt: "", class: "size-full object-cover", loading: "lazy" });
  }
  return initials(member.name);
}

// ------------------------------------------------------------
//  Renderização — família
//  Celular: linhas (foto + nome + contador + seta)
//  Tablet/desktop (sm+): cards em grade
// ------------------------------------------------------------
function renderMembers() {
  els.members.replaceChildren(
    ...members.map((m) => {
      const n = m.gifts.length;
      return h(
        "li",
        {},
        h(
          "button",
          {
            type: "button",
            class:
              "group flex w-full items-center gap-3.5 rounded-[22px] bg-natal-green p-3.5 pr-4 text-left shadow-lg shadow-natal-red-dark/40 transition " +
              "hover:-translate-y-0.5 hover:bg-[#236b42] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-natal-gold " +
              "sm:flex-col sm:gap-3.5 sm:rounded-[28px] sm:px-5 sm:pb-6 sm:pt-7 sm:text-center",
            "aria-label": `Abrir a lista de ${m.name} (${countLabel(n)})`,
            onclick: () => openList(m.id),
          },
          h(
            "span",
            {
              class:
                "grid size-[60px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-white bg-natal-red font-display text-[22px] font-semibold " +
                "sm:size-[124px] sm:border-4 sm:p-1.5 sm:text-[38px]",
            },
            h("span", { class: "grid size-full place-items-center overflow-hidden rounded-full bg-natal-red" }, avatarContent(m))
          ),
          h(
            "span",
            { class: "flex min-w-0 flex-1 flex-col gap-0.5 sm:items-center sm:gap-2.5" },
            h("span", { class: "truncate font-display text-xl font-semibold sm:text-[22px]" }, m.name),
            h(
              "span",
              {
                class:
                  "text-sm font-bold " +
                  (n ? "text-natal-gold" : "text-white/75") +
                  " sm:inline-flex sm:items-center sm:gap-1.5 sm:rounded-full sm:bg-white/15 sm:px-3 sm:py-1.5 sm:text-white",
              },
              h("span", { class: "hidden size-2 rounded-full sm:inline-block " + (n ? "bg-natal-gold" : "bg-white/60") }),
              countLabel(n)
            ),
            h(
              "span",
              { class: "hidden text-[15px] font-bold underline underline-offset-4 sm:mt-1 sm:inline" },
              n ? "Ver lista →" : "Adicionar desejos →"
            )
          ),
          h(
            "span",
            { class: "grid size-10 shrink-0 place-items-center rounded-full bg-white/15 sm:hidden", "aria-hidden": "true" },
            svg('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>')
          )
        )
      );
    })
  );
  els.memberCount.textContent = `${members.length} participantes`;
}

// ------------------------------------------------------------
//  Renderização — lista de presentes
// ------------------------------------------------------------
const ICON_GIFT =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8v13"/><path d="M12 8c-1.5-3-5-4-5.5-2S9 8 12 8Zm0 0c1.5-3 5-4 5.5-2S15 8 12 8Z"/></svg>';
const ICON_EDIT =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>';
const ICON_TRASH =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

function iconButton(icon, label, onclick) {
  return h(
    "button",
    {
      type: "button",
      "aria-label": label,
      title: label,
      onclick,
      class:
        "grid size-11 place-items-center rounded-xl bg-white/12 transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-natal-gold sm:size-10",
    },
    svg(icon)
  );
}

function renderGifts() {
  const member = members.find((m) => m.id === currentMemberId);
  if (!member) return;

  els.dlgName.textContent = member.name;
  els.dlgAvatar.replaceChildren(avatarContent(member));
  els.giftEmpty.classList.toggle("hidden", member.gifts.length > 0);

  els.giftList.replaceChildren(
    ...member.gifts.map((g) => {
      const link = g.link ? safeUrl(g.link) : null;
      const details = [g.priceRange, g.note].filter(Boolean).join("  ·  ");
      return h(
        "li",
        {
          class:
            "flex items-start gap-3.5 rounded-[18px] bg-natal-green-dark p-3.5 sm:gap-4 sm:p-4 " +
            (editingGiftId === g.id ? "ring-2 ring-natal-gold" : ""),
        },
        h("span", { class: "grid size-11 shrink-0 place-items-center rounded-[14px] bg-natal-red", "aria-hidden": "true" }, svg(ICON_GIFT)),
        h(
          "div",
          { class: "flex min-w-0 flex-1 flex-col gap-1" },
          h("p", { class: "break-words text-[17px] font-bold leading-snug" }, g.name),
          details && h("p", { class: "break-words text-sm text-white/72" }, details),
          link &&
            h(
              "a",
              {
                href: link,
                target: "_blank",
                rel: "noopener noreferrer",
                class: "w-fit py-1 text-sm font-bold text-natal-gold underline-offset-4 hover:underline",
              },
              "Abrir na loja →"
            )
        ),
        h(
          "div",
          { class: "flex shrink-0 gap-1.5" },
          iconButton(ICON_EDIT, `Editar ${g.name}`, () => startEdit(g)),
          iconButton(ICON_TRASH, `Remover ${g.name}`, () => removeGift(g))
        )
      );
    })
  );
}

// ------------------------------------------------------------
//  Ações
// ------------------------------------------------------------
async function loadMembers() {
  try {
    members = await api.getMembers();
    els.status.classList.add("hidden");
    renderMembers();
    if (currentMemberId != null) renderGifts();
  } catch (err) {
    els.status.classList.remove("hidden");
    els.status.textContent = `Não foi possível carregar a família: ${err.message}`;
  }
}

function openList(memberId) {
  currentMemberId = memberId;
  resetForm();
  renderGifts();
  els.dialog.showModal();
  els.dialog.scrollTop = 0;
}

function closeList() {
  els.dialog.close();
}

function resetForm() {
  editingGiftId = null;
  els.form.reset();
  els.formTitle.textContent = "Adicionar um desejo";
  els.formSubmit.textContent = "Adicionar à lista";
  els.formCancel.classList.add("hidden");
  showFormError("");
}

function startEdit(gift) {
  editingGiftId = gift.id;
  els.form.elements.name.value = gift.name;
  els.form.elements.link.value = gift.link ?? "";
  els.form.elements.priceRange.value = gift.priceRange ?? "";
  els.form.elements.note.value = gift.note ?? "";
  els.formTitle.textContent = "Editar desejo";
  els.formSubmit.textContent = "Salvar alterações";
  els.formCancel.classList.remove("hidden");
  renderGifts();
  els.form.scrollIntoView({ behavior: "smooth", block: "start" });
  els.form.elements.name.focus({ preventScroll: true });
}

function showFormError(msg) {
  els.formError.textContent = msg;
  els.formError.classList.toggle("hidden", !msg);
}

function readForm() {
  const val = (name) => els.form.elements[name].value.trim() || null;
  return { name: val("name"), link: val("link"), priceRange: val("priceRange"), note: val("note") };
}

async function onSubmit(e) {
  e.preventDefault();
  const data = readForm();
  if (!data.name) {
    showFormError("Escreva o nome do presente.");
    els.form.elements.name.focus();
    return;
  }
  if (data.link && !safeUrl(data.link)) {
    showFormError("O link precisa começar com http:// ou https://");
    els.form.elements.link.focus();
    return;
  }

  els.formSubmit.disabled = true;
  try {
    if (editingGiftId != null) await api.updateGift(editingGiftId, data);
    else await api.addGift(currentMemberId, data);
    resetForm();
    await loadMembers();
  } catch (err) {
    showFormError(err.message);
  } finally {
    els.formSubmit.disabled = false;
  }
}

async function removeGift(gift) {
  if (!confirm(`Remover "${gift.name}" da lista?`)) return;
  try {
    await api.deleteGift(gift.id);
    if (editingGiftId === gift.id) resetForm();
    await loadMembers();
  } catch (err) {
    alert(err.message);
  }
}

// ------------------------------------------------------------
//  Neve
// ------------------------------------------------------------
function makeSnow() {
  const box = $("#snow");
  const count = window.innerWidth < 640 ? 40 : 80;
  for (let i = 0; i < count; i++) {
    // Flocos maiores caem mais rápido e mais "perto"; os pequenos ficam ao fundo.
    const size = 2 + Math.random() ** 2 * 6;
    const near = size > 5;
    const flake = h("span", {
      class: "animate-fall absolute top-0 rounded-full bg-white",
      style: [
        `left:${Math.random() * 100}%`,
        `width:${size}px`,
        `height:${size}px`,
        `opacity:${0.45 + Math.random() * 0.5}`,
        `animation-duration:${(near ? 7 : 11) + Math.random() * 10}s`,
        `animation-delay:-${Math.random() * 20}s`,
        `--drift:${-60 + Math.random() * 120}px`,
        near ? "box-shadow:0 0 6px 1px rgb(255 255 255 / .55)" : "",
      ].join(";"),
    });
    box.append(flake);
  }
}

// ------------------------------------------------------------
//  Início
// ------------------------------------------------------------
$("#year").textContent = new Date().getFullYear();
els.form.addEventListener("submit", onSubmit);
els.formCancel.addEventListener("click", () => {
  resetForm();
  renderGifts();
});
els.dlgClose.addEventListener("click", closeList);
// Clicar no fundo escuro fecha a janela
els.dialog.addEventListener("click", (e) => {
  if (e.target === els.dialog) closeList();
});
els.dialog.addEventListener("close", () => {
  currentMemberId = null;
  resetForm();
});

makeSnow();
loadMembers();
