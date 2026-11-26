const $ = id => document.getElementById(id);
const CART_KEY = "bluestore_cart";
const COUNTRIES = ["United Kingdom","Germany","EIRE","Lithuania","France","Netherlands","Iran","Turkey","Italy","Spain","United States","Canada"];
let R = [], O = [], P = [], shown = 24;
let cart = (() => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; } })();
const saveCart = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} };
const find1 = name => P.find(p => p.name === name);

function refresh() {
  R = allRows(); O = orders(R); P = products(R);
  cart = cart.filter(i => find1(i.name));
  $("heroStats").innerHTML = [[P.length, "products"], [num(R.reduce((s, r) => s + r.quantity, 0)), "units sold"], [O.length, "orders"], [new Set(R.map(r => r.country)).size, "countries"]]
    .map(s => `<div class="stat"><b>${s[0]}</b><span>${s[1]}</span></div>`).join("");
  renderGrid(); renderCart();
}

// ---------- product grid ----------
function renderGrid() {
  const q = $("q").value.trim().toLowerCase(), lo = parseFloat($("pmin").value) || 0, hi = parseFloat($("pmax").value) || Infinity, s = $("sort").value;
  const list = P.filter(p => p.price >= lo && p.price <= hi && p.name.toLowerCase().includes(q));
  list.sort((a, b) => s === "qa" ? a.qty - b.qty : s === "pd" ? b.price - a.price : s === "pa" ? a.price - b.price : b.qty - a.qty);
  $("grid").innerHTML = list.slice(0, shown).map(p => `
    <article class="pcard" data-n="${esc(p.name)}">
      <div class="art" data-open>${visual(p.name)}</div>
      <div class="pname" data-open>${esc(p.name.toLowerCase())}</div>
      <div class="price">${money(p.price)}</div>
      <div class="meta"><b>${num(p.qty)}</b> units sold &bull; in <b>${p.orderCount}</b> ${p.orderCount === 1 ? "order" : "orders"}</div>
      <div class="row2" style="margin-top:12px"><button class="btn sm" data-add>Add to cart</button><button class="btn ghost sm" data-open>Details</button></div>
    </article>`).join("") || `<p class="empty">No products match. Try a wider price range.</p>`;
  $("count").textContent = `Showing ${Math.min(shown, list.length)} of ${list.length}`;
  $("more").hidden = shown >= list.length;
}

$("grid").addEventListener("click", e => {
  const c = e.target.closest(".pcard"); if (!c) return;
  if (e.target.closest("[data-add]")) addToCart(c.dataset.n, 1);
  else if (e.target.closest("[data-open]")) openProduct(c.dataset.n);
});
$("grid").addEventListener("mousemove", e => {   // 3D tilt on the illustration
  const a = e.target.closest(".art"); if (!a) return;
  const r = a.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
  a.firstElementChild.style.transform = `rotateY(${x * 28}deg) rotateX(${-y * 22}deg) scale(1.06)`;
});
$("grid").addEventListener("mouseout", e => { const a = e.target.closest(".art"); if (a) a.firstElementChild.style.transform = ""; });
["q", "pmin", "pmax", "sort"].forEach(id => $(id).addEventListener("input", () => { shown = 24; renderGrid(); }));
$("more").addEventListener("click", () => { shown += 24; renderGrid(); });
$("tiers").addEventListener("click", e => {
  const b = e.target.closest("[data-r]"); if (!b) return;
  const [lo, hi] = b.dataset.r.split("-"); $("pmin").value = lo; $("pmax").value = hi; shown = 24; renderGrid();
});

// ---------- product detail (with real co-purchase data) ----------
function openProduct(name) {
  const p = find1(name); if (!p) return;
  const co = {};
  O.filter(o => o.lines.some(l => l.description === name)).forEach(o => o.lines.forEach(l => { if (l.description !== name) co[l.description] = (co[l.description] || 0) + 1; }));
  const top = Object.entries(co).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const dates = R.filter(r => r.description === name).map(r => r.date).sort();
  $("pd").innerHTML = `<div class="bar" style="margin:0"><span class="spacer"></span><button class="chip" data-close type="button">Close</button></div>
    <div class="pdg"><div class="art">${visual(name)}</div><div>
      <h2 style="text-transform:capitalize">${esc(name.toLowerCase())}</h2>
      <div class="price" style="font-size:1.8rem">${money(p.price)}</div>
      <div class="facts"><div><b>${num(p.qty)}</b><span>units sold</span></div><div><b>${p.orderCount}</b><span>orders</span></div><div><b>${money(p.revenue)}</b><span>revenue</span></div></div>
      <p class="meta">Sales dates in data: ${esc(dates[0])} to ${esc(dates[dates.length - 1])}. Stock level is not part of the dataset, so it is not shown.</p>
      <div class="row2" style="margin:14px 0"><div class="qty"><button data-d="-1" type="button">&minus;</button><span id="dq">1</span><button data-d="1" type="button">+</button></div><button class="btn" data-addq type="button">Add to cart</button></div>
      ${top.length ? `<h3 style="font-size:.95rem;margin:10px 0 6px">Often ordered together</h3>` + top.map(t => `<div class="meta"><a href="#" data-open2="${esc(t[0])}" style="color:var(--sky);text-transform:capitalize">${esc(t[0].toLowerCase())}</a> (${t[1]} ${t[1] === 1 ? "order" : "orders"})</div>`).join("") : ""}
    </div></div>`;
  $("pd").dataset.n = name; if (!$("pd").open) $("pd").showModal();
}
$("pd").addEventListener("click", e => {
  const d = e.target.closest("[data-d]"), q = $("dq");
  if (d) q.textContent = Math.max(1, +q.textContent + +d.dataset.d);
  else if (e.target.closest("[data-addq]")) { addToCart($("pd").dataset.n, +q.textContent); $("pd").close(); }
  else if (e.target.closest("[data-close]") || e.target === $("pd")) $("pd").close();
  else if (e.target.dataset.open2) { e.preventDefault(); openProduct(e.target.dataset.open2); }
});

// ---------- cart ----------
function toggleCart(open) { $("drawer").classList.toggle("open", open); $("ov").classList.toggle("open", open); }
function addToCart(name, q) {
  const i = cart.find(x => x.name === name);
  if (i) i.qty += q; else cart.push({name, qty: q});
  saveCart(); renderCart(); toggleCart(true);
}
const cartTotal = () => cart.reduce((s, i) => s + i.qty * find1(i.name).price, 0);
function renderCart() {
  const line = (i, k, edit) => { const p = find1(i.name); return `<li><div class="li"><div class="th">${visual(i.name)}</div><div class="t">${esc(i.name.toLowerCase())}<div class="meta">${money(p.price)} each</div></div>
    ${edit ? `<div class="qty"><button data-k="${k}" data-d="-1" aria-label="Decrease">&minus;</button><span>${i.qty}</span><button data-k="${k}" data-d="1" aria-label="Increase">+</button></div><button data-rm="${k}" aria-label="Remove" style="background:none;border:0;color:var(--bad);font-size:1.2rem;cursor:pointer">&times;</button>` : `<span>${i.qty} × ${money(p.price)}</span>`}
    </div></li>`; };
  const none = `<li class="empty" style="display:block">Your cart is empty. Add a product to start an order.</li>`;
  $("cartList").innerHTML = cart.map((i, k) => line(i, k, true)).join("") || none;
  $("sumList").innerHTML = cart.map((i, k) => line(i, k, false)).join("") || none;
  const t = money(cartTotal()); $("cartTotal").textContent = t; $("sumTotal").textContent = t;
  $("badge").textContent = cart.reduce((s, i) => s + i.qty, 0);
}
$("cartList").addEventListener("click", e => {
  const d = e.target.closest("[data-d]"), r = e.target.closest("[data-rm]");
  if (d) { const i = cart[+d.dataset.k]; i.qty += +d.dataset.d; if (i.qty < 1) cart.splice(+d.dataset.k, 1); }
  else if (r) cart.splice(+r.dataset.rm, 1); else return;
  saveCart(); renderCart();
});
$("cartBtn").addEventListener("click", () => toggleCart(true));
$("closeCart").addEventListener("click", () => toggleCart(false));
$("ov").addEventListener("click", () => toggleCart(false));
$("goCheckout").addEventListener("click", () => { toggleCart(false); $("checkout").scrollIntoView(); });

// ---------- checkout ----------
const note = t => $("msg").textContent = t || "";
function newCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c;
  do { c = "ORD-" + Array.from({length: 6}, () => A[Math.floor(Math.random() * A.length)]).join(""); } while (O.some(o => o.code === c));
  return c;
}
$("submit").addEventListener("click", () => {
  const name = $("cname").value.trim();
  if (!name) return note("Enter the customer name.");
  if (!cart.length) return note("Your cart is empty. Add at least one product.");
  note();
  const now = new Date(), code = newCode();
  const items = cart.map(i => { const p = find1(i.name); return {description: p.name, stockcode: p.stockcode, unitprice: p.price, quantity: i.qty}; });
  const order = {code, customer: name, customerid: Math.floor(10000 + Math.random() * 90000), country: $("ccountry").value, date: now.toISOString().slice(0, 10), hour: now.getHours(), items};
  saveOrder(order); cart = []; saveCart(); $("cname").value = "";
  refresh(); showReceipt(order);
});
function showReceipt(o) {
  const total = o.items.reduce((s, i) => s + i.quantity * i.unitprice, 0);
  $("receipt").innerHTML = `<div style="text-align:center"><div class="meta">Order placed. Your tracking code is</div><div class="code">${esc(o.code)}</div></div>
    <p class="meta" style="text-align:center">${esc(o.customer)} &bull; ${esc(o.country)} &bull; ${esc(o.date)}</p>
    <div class="tw" style="margin-top:12px"><table><thead><tr><th>Product</th><th class="n">Qty</th><th class="n">Price</th><th class="n">Amount</th></tr></thead><tbody>
    ${o.items.map(i => `<tr><td>${esc(i.description)}</td><td class="n">${i.quantity}</td><td class="n">${money(i.unitprice)}</td><td class="n">${money(i.quantity * i.unitprice)}</td></tr>`).join("")}</tbody></table></div>
    <div class="total"><span>Total</span><span>${money(total)}</span></div>
    <div class="row2"><button class="btn ghost sm" id="copy" type="button">Copy code</button><button class="btn ghost sm" onclick="window.print()" type="button">Print receipt</button></div>`;
  $("receipt").hidden = false; $("receipt").scrollIntoView({behavior: "smooth"});
  $("copy").onclick = () => { navigator.clipboard?.writeText(o.code); $("copy").textContent = "Copied"; };
}

// ---------- order tracking ----------
function track() {
  const raw = $("code").value.trim(), out = $("result");
  if (!raw) { out.innerHTML = `<p class="empty">Enter an order code to see its details.</p>`; return; }
  const o = O.find(o => o.code.toLowerCase() === raw.toLowerCase());
  if (!o) { out.innerHTML = `<p class="empty">No order found with code “${esc(raw)}”. Check the code and try again.</p>`; return; }
  out.innerHTML = `<div class="bar"><span class="tag">Order ${esc(o.code)}</span><span class="meta">${esc(o.date)} &bull; ${esc(o.country)} &bull; ${o.customer ? esc(o.customer) : "customer " + esc(o.customerid)}</span></div>
    <div class="tw"><table><thead><tr><th>Product</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Amount</th></tr></thead><tbody>
    ${o.lines.map(l => `<tr><td>${esc(l.description)}</td><td class="n">${num(l.quantity)}</td><td class="n">${money(l.unitprice)}</td><td class="n">${money(l.total_amount)}</td></tr>`).join("")}</tbody></table></div>
    <div class="total"><span>${o.units} units</span><span>${money(o.total)}</span></div>
    <p class="meta">Order status is not tracked: the dataset has no status field.</p>`;
}
$("find").addEventListener("click", track);
$("code").addEventListener("keydown", e => e.key === "Enter" && track());

// ---------- init ----------
$("ccountry").innerHTML = [...new Set(COUNTRIES.concat(allRows().map(r => r.country)))].sort().map(c => `<option>${esc(c)}</option>`).join("");
$("ccountry").value = "United Kingdom";
refresh();
