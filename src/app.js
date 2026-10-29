// EMK SYSTEM demo store — shared behaviour for every page.
// Edit PRODUCT to change the price, stock or sizes shown everywhere.

const PRODUCT = {
  id: "peace-001",
  name: "Peace Tee",
  collection: "Peace Collection 001",
  price: 65, // placeholder — confirm with EMK
  stockLeft: 37,
  stockTotal: 100,
  image: "images/flat-back.jpg",
  sizes: {
    S:  { chest: "24", length: "27",    shoulder: "23", sleeve: "8.5" },
    M:  { chest: "25", length: "28.25", shoulder: "23", sleeve: "8.5" },
    L:  { chest: "25", length: "29",    shoulder: "24", sleeve: "8.5" },
    XL: { chest: "26", length: "29",    shoulder: "24", sleeve: "9"   },
  },
};

const money = (n) => "$" + n.toFixed(2);

// ---------- image slots: show a styled placeholder until a photo exists ----------
document.querySelectorAll(".slot img").forEach((img) => {
  const mark = () => img.closest(".slot").classList.add("missing");
  if (img.complete && img.naturalWidth === 0) mark();
  img.addEventListener("error", mark);
});

// ---------- cart (kept in this browser only; a real store uses Shopify's cart) ----------
const store = {
  get() {
    try { return JSON.parse(localStorage.getItem("emk-cart")) || []; } catch { return []; }
  },
  set(items) {
    try { localStorage.setItem("emk-cart", JSON.stringify(items)); } catch {}
  },
};

function cartCount() {
  return store.get().reduce((n, i) => n + i.qty, 0);
}

function renderCart() {
  const items = store.get();
  document.querySelectorAll("[data-cart-count]").forEach((el) => (el.textContent = cartCount()));
  const body = document.querySelector("#cart .drawer-body");
  const foot = document.querySelector("#cart .drawer-foot");
  if (!body) return;

  if (!items.length) {
    body.innerHTML = `<p class="empty">Your bag is empty.</p>`;
    foot.innerHTML = `<a class="btn block" href="product.html">Shop Peace Collection 001</a>`;
    return;
  }

  body.innerHTML = items.map((i, idx) => `
    <div class="line-item">
      <div class="slot" data-label="EMK"><img src="${PRODUCT.image}" alt=""></div>
      <div>
        <b>${PRODUCT.name}</b>
        <small>${PRODUCT.collection} · Size ${i.size} · Qty ${i.qty}</small><br>
        <button class="remove" data-remove="${idx}">Remove</button>
      </div>
      <div>${money(PRODUCT.price * i.qty)}</div>
    </div>`).join("");
  body.querySelectorAll(".slot img").forEach((img) =>
    img.addEventListener("error", () => img.closest(".slot").classList.add("missing")));

  const subtotal = items.reduce((s, i) => s + i.qty * PRODUCT.price, 0);
  foot.innerHTML = `
    <div class="sum-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    <div class="sum-row" style="color:var(--muted);font-size:14px"><span>Shipping</span><span>Calculated at checkout</span></div>
    <div class="sum-row total"><span>Total</span><span>${money(subtotal)}</span></div>
    <button class="btn block" data-checkout>Checkout</button>
    <div class="pay-row"><span>Apple Pay</span><span>Google Pay</span><span>Visa</span><span>Mastercard</span><span>Shop Pay</span></div>
    <p class="sum-note">All sales final · Size exchanges within 14 days</p>`;
}

function addToCart(size, qty) {
  const items = store.get();
  const hit = items.find((i) => i.size === size);
  if (hit) hit.qty += qty; else items.push({ size, qty });
  store.set(items);
  renderCart();

// home page price line
document.querySelectorAll("[data-home-price]").forEach((el) => (el.textContent = "$" + PRODUCT.price));
}

// ---------- drawers ----------
const scrim = document.querySelector(".scrim");
function openDrawer(id) {
  document.querySelectorAll(".drawer.on").forEach((d) => d.classList.remove("on"));
  document.getElementById(id)?.classList.add("on");
  scrim?.classList.add("on");
}
function closeDrawers() {
  document.querySelectorAll(".drawer.on").forEach((d) => d.classList.remove("on"));
  scrim?.classList.remove("on");
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-open],[data-close],[data-remove],[data-checkout]");
  if (!t) return;
  if (t.dataset.open) { e.preventDefault(); openDrawer(t.dataset.open); }
  if (t.hasAttribute("data-close")) closeDrawers();
  if (t.dataset.remove) {
    const items = store.get();
    items.splice(Number(t.dataset.remove), 1);
    store.set(items);
    renderCart();

// home page price line
document.querySelectorAll("[data-home-price]").forEach((el) => (el.textContent = "$" + PRODUCT.price));
  }
  if (t.hasAttribute("data-checkout")) toast("Demo only — at launch this opens Shopify checkout with Apple Pay.");
});
scrim?.addEventListener("click", closeDrawers);
document.addEventListener("keydown", (e) => e.key === "Escape" && closeDrawers());

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  const el = document.querySelector(".toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 2800);
}

// ---------- size guide table (panel on every page) ----------
function sizeTable(highlight) {
  const rows = Object.entries(PRODUCT.sizes).map(([s, m]) => `
    <tr class="${s === highlight ? "hl" : ""}"><td>${s}</td><td>${m.chest}"</td><td>${m.length}"</td><td>${m.shoulder}"</td><td>${m.sleeve}"</td></tr>`).join("");
  return `<table class="size-table">
    <thead><tr><th>Size</th><th>Chest</th><th>Length</th><th>Shoulder</th><th>Sleeve</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}
document.querySelectorAll("[data-size-table]").forEach((el) => (el.innerHTML = sizeTable()));

// ---------- signup ----------
document.querySelectorAll("form[data-signup]").forEach((form) => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = form.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Joining…";
    setTimeout(() => {
      form.reset();
      btn.disabled = false;
      btn.textContent = "Join";
      const note = form.parentElement.querySelector(".thanks");
      if (note) note.textContent = "You're on the list. You'll hear about Drop 002 first.";
    }, 600);
  });
});

// ---------- reveal on scroll ----------
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// ---------- product page ----------
const buy = document.querySelector("[data-buy]");
if (buy) {
  let size = null;
  let qty = 1;
  const addBtn = buy.querySelector("[data-add]");
  const qtyEl = buy.querySelector("[data-qty]");
  const fitEl = buy.querySelector("[data-fit]");

  buy.querySelector("[data-price]").textContent = money(PRODUCT.price);
  buy.querySelector("[data-stock-text]").textContent = `Only ${PRODUCT.stockLeft} left in the first drop`;
  buy.querySelector(".stock-bar i").style.width = (PRODUCT.stockLeft / PRODUCT.stockTotal) * 100 + "%";

  const sizesEl = buy.querySelector(".sizes");
  sizesEl.innerHTML = Object.keys(PRODUCT.sizes)
    .map((s) => `<button type="button" aria-pressed="false" data-size="${s}">${s}</button>`).join("");

  sizesEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-size]");
    if (!b) return;
    size = b.dataset.size;
    sizesEl.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    const m = PRODUCT.sizes[size];
    fitEl.innerHTML = `<b>Size ${size}:</b> ${m.chest}" chest, ${m.length}" long. Cut oversized and relaxed — take your usual size for the intended fit, or size down for a closer fit.`;
    addBtn.disabled = false;
    addBtn.textContent = `Add to bag — ${money(PRODUCT.price * qty)}`;
    const panel = document.querySelector("#sizes [data-size-table]");
    if (panel) panel.innerHTML = sizeTable(size);
  });

  buy.querySelectorAll("[data-step]").forEach((b) =>
    b.addEventListener("click", () => {
      qty = Math.max(1, Math.min(5, qty + Number(b.dataset.step)));
      qtyEl.textContent = qty;
      if (size) addBtn.textContent = `Add to bag — ${money(PRODUCT.price * qty)}`;
    }));

  addBtn.addEventListener("click", () => {
    if (!size) return;
    addBtn.disabled = true;
    addBtn.textContent = "Adding…";
    setTimeout(() => {
      addToCart(size, qty);
      addBtn.disabled = false;
      addBtn.textContent = `Add to bag — ${money(PRODUCT.price * qty)}`;
      openDrawer("cart");
    }, 350);
  });
}

// ---------- mobile menu ----------
document.querySelector(".menu-btn")?.addEventListener("click", () => openDrawer("menu"));

renderCart();

// home page price line
document.querySelectorAll("[data-home-price]").forEach((el) => (el.textContent = "$" + PRODUCT.price));
