const $ = id => document.getElementById(id);
const BLUES = ["#3b82f6","#22d3ee","#7dd3fc","#1d4ed8","#60a5fa","#0ea5e9","#818cf8","#38bdf8","#2563eb","#67e8f9"];
let rows = [], ords = [], prods = [], charts = {}, bands = null;
const ST = {p: {k: "revenue", d: -1}, o: {k: "date", d: -1}};
const cap = s => esc(s.toLowerCase());
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const pct = v => (v * 100).toFixed(1) + "%";

if (window.Chart) { Chart.defaults.color = "#8da6d4"; Chart.defaults.borderColor = "#1d3868"; Chart.defaults.font.family = "'Plus Jakarta Sans','Segoe UI',sans-serif"; }
function mk(id, cfg) {
  if (!window.Chart) return;
  charts[id]?.destroy();
  cfg.options = Object.assign({responsive: true, maintainAspectRatio: false}, cfg.options);
  charts[id] = new Chart($(id), cfg);
}

// ---------- data ----------
const swapDate = d => { const [y, a, b] = d.split("-"); return `${y}-${b}-${a}`; };
function load() {
  const sw = $("dfmt").checked, c = $("fc").value, f = $("from").value, t = $("to").value;
  rows = allRows().map(r => ({...r, date: sw && !r.saved ? swapDate(r.date) : r.date}))
    .filter(r => (c === "all" || r.country === c) && (!f || r.date >= f) && (!t || r.date <= t));
  ords = orders(rows); prods = products(rows);
  const tot = sum(prods, p => p.revenue); let cum = 0;
  [...prods].sort((a, b) => b.revenue - a.revenue).forEach(p => { const before = cum / tot; cum += p.revenue; p.cls = before < .8 ? "A" : before < .95 ? "B" : "C"; });
  const maxLine = {}; rows.forEach(r => maxLine[r.description] = Math.max(maxLine[r.description] || 0, r.quantity));
  prods.forEach(p => p.maxLine = maxLine[p.name] || 0);
  kpis(); charts_(); compareSetup(); insights(); if (!bands) autoBands(); priceBands(); productTable(); orderTable(); countryTable();
}

function kpis() {
  const rev = sum(rows, r => r.total_amount), best = [...prods].sort((a, b) => b.revenue - a.revenue)[0];
  $("kpis").innerHTML = [["Total revenue", money(rev)], ["Orders", num(ords.length)], ["Units sold", num(sum(rows, r => r.quantity))],
    ["Average order value", money(ords.length ? rev / ords.length : 0)], ["Customers", num(new Set(rows.map(r => r.customerid)).size)],
    ["Products", num(prods.length)], ["Top product (revenue)", best ? best.name.toLowerCase().slice(0, 24) : "-"]]
    .map(k => `<div class="kpi"><span>${k[0]}</span><b style="${k[0].startsWith("Top") ? "font-size:1rem;text-transform:capitalize" : ""}">${esc(k[1])}</b></div>`).join("");
}

// ---------- charts ----------
const groupSum = (key, f) => rows.reduce((m, r) => (m[r[key]] = (m[r[key]] || 0) + f(r), m), {});
function charts_() {
  const rev = groupSum("date", r => r.total_amount), dates = Object.keys(rev).sort();
  const oc = {}; ords.forEach(o => oc[o.date] = (oc[o.date] || 0) + 1);
  mk("c1", {data: {labels: dates, datasets: [
    {type: "line", label: "Revenue ($)", data: dates.map(d => +rev[d].toFixed(2)), borderColor: "#7dd3fc", backgroundColor: "#3b82f633", fill: true, tension: .3, yAxisID: "y"},
    {type: "bar", label: "Orders", data: dates.map(d => oc[d] || 0), backgroundColor: "#3b82f6aa", borderRadius: 4, yAxisID: "y1"}]},
    options: {interaction: {mode: "index", intersect: false}, scales: {y: {position: "left"}, y1: {position: "right", grid: {drawOnChartArea: false}}}}});
  drawTop();
  const byC = groupSum("country", r => r.total_amount);
  mk("c3", {type: "doughnut", data: {labels: Object.keys(byC), datasets: [{data: Object.values(byC).map(v => +v.toFixed(2)), backgroundColor: BLUES, borderColor: "#0a1a38"}]}, options: {plugins: {legend: {position: "right"}}}});
  const hr = {}; ords.forEach(o => { const h = o.lines[0].hour; hr[h] = (hr[h] || 0) + 1; });
  const hl = Object.keys(hr).map(Number).sort((a, b) => a - b);
  mk("c4", {type: "bar", data: {labels: hl.map(h => h + ":00"), datasets: [{label: "Orders", data: hl.map(h => hr[h]), backgroundColor: "#22d3ee", borderRadius: 4}]}, options: {plugins: {legend: {display: false}}}});
  const tots = ords.map(o => o.total), mx = Math.max(1, ...tots), w = Math.ceil(mx / 8), bins = Array(8).fill(0);
  tots.forEach(t => bins[Math.min(7, Math.floor(t / w))]++);
  mk("c5", {type: "bar", data: {labels: bins.map((_, i) => `$${i * w}–${(i + 1) * w}`), datasets: [{label: "Orders", data: bins, backgroundColor: "#60a5fa", borderRadius: 4}]}, options: {plugins: {legend: {display: false}}}});
}
function drawTop() {
  const m = $("tm").value, top = [...prods].sort((a, b) => b[m] - a[m]).slice(0, 10);
  mk("c2", {type: "bar", data: {labels: top.map(p => p.name.toLowerCase().slice(0, 22)), datasets: [{label: $("tm").selectedOptions[0]?.text, data: top.map(p => +p[m].toFixed(2)), backgroundColor: "#3b82f6", borderRadius: 4}]}, options: {indexAxis: "y", plugins: {legend: {display: false}}}});
}

// ---------- product comparison ----------
function compareSetup() {
  const names = prods.map(p => p.name).sort(), top = [...prods].sort((a, b) => b.qty - a.qty);
  const opts = names.map(n => `<option value="${esc(n)}">${cap(n)}</option>`).join("");
  const a = $("ca").value, b = $("cb").value;
  $("ca").innerHTML = opts; $("cb").innerHTML = opts;
  $("ca").value = names.includes(a) ? a : top[0]?.name ?? ""; $("cb").value = names.includes(b) ? b : top[1]?.name ?? "";
  drawCompare();
}
function drawCompare() {
  const sel = [$("ca").value, $("cb").value], dates = [...new Set(rows.map(r => r.date))].sort();
  mk("c6", {type: "bar", data: {labels: dates, datasets: sel.map((n, i) => ({label: n.toLowerCase().slice(0, 30), backgroundColor: i ? "#22d3ee" : "#3b82f6", borderRadius: 4,
    data: dates.map(d => sum(rows.filter(r => r.date === d && r.description === n), r => r.quantity))}))}, options: {interaction: {mode: "index", intersect: false}}});
  const ps = sel.map(n => prods.find(p => p.name === n)).filter(Boolean);
  $("cmpT").innerHTML = `<thead><tr><th>Metric</th>${ps.map(p => `<th class="n" style="text-transform:capitalize">${cap(p.name.slice(0, 26))}</th>`).join("")}</tr></thead><tbody>` +
    [["Unit price", p => money(p.price)], ["Units sold", p => num(p.qty)], ["Orders", p => p.orderCount], ["Revenue", p => money(p.revenue)], ["ABC class", p => p.cls]]
    .map(r => `<tr><td>${r[0]}</td>${ps.map(p => `<td class="n">${r[1](p)}</td>`).join("")}</tr>`).join("") + "</tbody>";
}

// ---------- insights (rule-based, from real data only) ----------
const li = (a, b) => `<li><span>${a}</span><span>${b}</span></li>`;
function insights() {
  if (!rows.length) { $("ins").innerHTML = `<div class="panel empty">No data for the selected filters.</div>`; return; }
  const byQ = [...prods].sort((a, b) => b.qty - a.qty), dates = [...new Set(rows.map(r => r.date))].sort();
  const cls = {A: 0, B: 0, C: 0}; prods.forEach(p => cls[p.cls]++);
  const tot = sum(prods, p => p.revenue), clsRev = c => sum(prods.filter(p => p.cls === c), p => p.revenue) / tot;
  const rev = groupSum("date", r => r.total_amount), bestDay = Object.entries(rev).sort((a, b) => b[1] - a[1])[0];
  const hr = {}; ords.forEach(o => { const h = o.lines[0].hour; hr[h] = (hr[h] || 0) + 1; });
  const peak = Object.entries(hr).sort((a, b) => b[1] - a[1])[0];
  const half = Math.ceil(dates.length / 2), h1 = new Set(dates.slice(0, half));
  const r1 = sum(rows.filter(r => h1.has(r.date)), r => r.total_amount), r2 = tot - r1;
  const multi = prods.map(p => {
    const d = [...new Set(rows.filter(r => r.description === p.name).map(r => r.date))];
    const u1 = sum(rows.filter(r => r.description === p.name && h1.has(r.date)), r => r.quantity);
    return {p, n: d.length, delta: p.qty - 2 * u1};
  }).filter(x => x.n > 1 && dates.length > 1).sort((a, b) => a.delta - b.delta);
  const bulk = prods.filter(p => p.maxLine >= 48 && p.maxLine / p.qty >= .6).sort((a, b) => b.maxLine - a.maxLine).slice(0, 5);
  const fragile = prods.filter(p => p.cls === "A" && p.orderCount === 1).slice(0, 5);
  $("ins").innerHTML = `
  <div class="panel"><h3>Best and slowest sellers</h3><ul>${byQ.slice(0, 5).map(p => li(cap(p.name), num(p.qty) + " units")).join("")}</ul>
    <p class="note">Slowest by units (${num(byQ[byQ.length - 1].qty)} units or fewer):</p><ul>${byQ.slice(-4).reverse().map(p => li(cap(p.name), num(p.qty) + " units")).join("")}</ul></div>
  <div class="panel"><h3>ABC classification (revenue)</h3><ul>${["A", "B", "C"].map(c => li(`<span class="cls ${c}">${c}</span> ${cls[c]} products`, pct(clsRev(c)) + " of revenue")).join("")}</ul>
    <p class="note">Suggested policy review (no stock data available): class A items deserve tight, frequent review; class C items can use simpler periodic review and lower safety stock.</p></div>
  <div class="panel"><h3>Time patterns</h3><ul>${li("Best day", `${esc(bestDay[0])} · ${money(bestDay[1])}`)}${peak ? li("Peak hour (orders)", `${peak[0]}:00 · ${peak[1]} orders`) : ""}
    ${dates.length > 1 ? li("Revenue, first vs second half of range", `${money(r1)} → ${money(r2)} (${r1 ? ((r2 - r1) / r1 * 100).toFixed(0) : "n/a"}%)`) : ""}</ul>
    <p class="note">The data covers only ${dates.length} distinct date${dates.length === 1 ? "" : "s"}, so weekly or seasonal patterns cannot be measured.</p></div>
  <div class="panel"><h3>Product trend</h3>${multi.length ? `<ul>${multi.slice(0, 6).map(x => li(cap(x.p.name), `${x.delta > 0 ? "+" : ""}${x.delta} units (2nd vs 1st half)`)).join("")}</ul>` : `<p class="empty">Not enough repeat sales to compute trends.</p>`}
    <p class="note">Only ${multi.length} product${multi.length === 1 ? "" : "s"} sold on more than one date. Trend claims for the rest would be unreliable.</p></div>
  <div class="panel"><h3>Needs management attention</h3>
    <p class="note" style="margin:0 0 6px">Demand driven by one bulk line (do not use for reorder points):</p><ul>${bulk.map(p => li(cap(p.name), `${num(p.maxLine)} of ${num(p.qty)} units`)).join("") || li("None found", "")}</ul>
    <p class="note">Class A products with a single order (revenue not yet repeated):</p><ul>${fragile.map(p => li(cap(p.name), money(p.revenue))).join("") || li("None found", "")}</ul></div>
  <div class="panel"><h3>Limitations</h3><p class="note" style="margin:0">${num(rows.length)} order lines, ${ords.length} orders and ${prods.length} products in this view. Most products have one or two sales, so statistics per product are descriptive, not predictive. The dataset has no stock, cost or lead-time data, so stock-outs, margins and optimal reorder quantities are not computed.</p></div>`;
}

// ---------- price bands ----------
function autoBands() {
  const p = prods.map(x => x.price).sort((a, b) => a - b), q = f => p[Math.floor((p.length - 1) * f)] || 0;
  bands = [q(.25), q(.5), q(.75)].map(v => +v.toFixed(2)); ["b1", "b2", "b3"].forEach((id, i) => $(id).value = bands[i]);
}
function bandOf(price) { return bands.findIndex(c => price <= c) < 0 ? 3 : bands.findIndex(c => price <= c); }
function priceBands() {
  const lab = [`Up to ${money(bands[0])}`, `${money(bands[0])} – ${money(bands[1])}`, `${money(bands[1])} – ${money(bands[2])}`, `Above ${money(bands[2])}`];
  const g = lab.map(() => ({n: 0, u: 0, r: 0})); prods.forEach(p => { const b = g[bandOf(p.price)]; b.n++; b.u += p.qty; b.r += p.revenue; });
  const tot = sum(g, b => b.r) || 1;
  $("bandT").innerHTML = `<thead><tr><th>Price band</th><th class="n">Products</th><th class="n">Units</th><th class="n">Revenue</th><th class="n">Share</th><th></th></tr></thead><tbody>` +
    g.map((b, i) => `<tr><td>${lab[i]}</td><td class="n">${b.n}</td><td class="n">${num(b.u)}</td><td class="n">${money(b.r)}</td><td class="n">${pct(b.r / tot)}</td><td><button class="btn ghost sm" data-band="${i}" type="button">Filter</button></td></tr>`).join("") + "</tbody>";
  mk("c7", {type: "bar", data: {labels: lab, datasets: [{label: "Revenue ($)", data: g.map(b => +b.r.toFixed(2)), backgroundColor: BLUES, borderRadius: 4}]}, options: {plugins: {legend: {display: false}}}});
}
$("bandT").addEventListener("click", e => {
  const b = e.target.closest("[data-band]"); if (!b) return; const i = +b.dataset.band;
  $("pmin").value = i ? bands[i - 1] : 0; $("pmax").value = i < 3 ? bands[i] : ""; productTable(); $("products").scrollIntoView();
});
["b1", "b2", "b3"].forEach((id, i) => $(id).addEventListener("input", () => { const v = parseFloat($(id).value); if (!isNaN(v)) { bands[i] = v; bands.sort((a, b) => a - b); priceBands(); } }));
$("bauto").addEventListener("click", () => { autoBands(); priceBands(); });

// ---------- sortable tables ----------
function table(el, cols, data, st, rowAttr) {
  const sorted = [...data].sort((a, b) => { const x = a[st.k], y = b[st.k]; return (typeof x === "string" ? x.localeCompare(y) : x - y) * st.d; });
  $(el).innerHTML = `<thead><tr>${cols.map(c => `<th class="s ${c.n ? "n" : ""}" data-k="${c.k}">${c.l}${st.k === c.k ? (st.d > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead><tbody>` +
    (sorted.map(r => `<tr ${rowAttr ? rowAttr(r) : ""}>${cols.map(c => `<td class="${c.n ? "n" : ""}">${c.f(r)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="empty">No rows match.</td></tr>`) + "</tbody>";
  return sorted.length;
}
function sortClick(el, st, redraw) {
  $(el).addEventListener("click", e => { const h = e.target.closest("th[data-k]"); if (!h) return; const k = h.dataset.k; st.d = st.k === k ? -st.d : -1; st.k = k; redraw(); });
}
function productTable() {
  const q = $("pq").value.trim().toLowerCase(), n = id => { const v = parseFloat($(id).value); return isNaN(v) ? null : v; };
  const [a, b, c, d] = ["pmin", "pmax", "umin", "umax"].map(n);
  const list = prods.filter(p => p.name.toLowerCase().includes(q) && (a === null || p.price >= a) && (b === null || p.price <= b) && (c === null || p.qty >= c) && (d === null || p.qty <= d));
  const cnt = table("ptable", [
    {k: "name", l: "Product", f: p => cap(p.name)}, {k: "cls", l: "ABC", f: p => `<span class="cls ${p.cls}">${p.cls}</span>`},
    {k: "price", l: "Price", n: 1, f: p => money(p.price)}, {k: "qty", l: "Units", n: 1, f: p => num(p.qty)},
    {k: "orderCount", l: "Orders", n: 1, f: p => p.orderCount}, {k: "revenue", l: "Revenue", n: 1, f: p => money(p.revenue)}], list, ST.p);
  $("pcount").textContent = `${cnt} of ${prods.length} products`;
}
function orderTable() {
  const q = $("oq").value.trim().toLowerCase();
  const list = ords.map(o => ({...o, items: o.lines.length, cust: o.customer || "#" + o.customerid}))
    .filter(o => !q || [o.code, o.country, o.cust].some(s => String(s).toLowerCase().includes(q)) || o.lines.some(l => l.description.toLowerCase().includes(q)));
  const cnt = table("otable", [
    {k: "code", l: "Order", f: o => `<span class="tag">${esc(o.code)}</span>`}, {k: "date", l: "Date", f: o => esc(o.date)}, {k: "cust", l: "Customer", f: o => esc(o.cust)},
    {k: "country", l: "Country", f: o => esc(o.country)}, {k: "items", l: "Items", n: 1, f: o => o.items}, {k: "units", l: "Units", n: 1, f: o => num(o.units)}, {k: "total", l: "Total", n: 1, f: o => money(o.total)}],
    list, ST.o, o => `data-o="${esc(o.code)}"`);
  $("ocount").textContent = `${cnt} of ${ords.length} orders`;
}
$("otable").addEventListener("click", e => {
  const r = e.target.closest("tr[data-o]"); if (!r) return;
  const o = ords.find(x => x.code === r.dataset.o); if (!o) return;
  $("od").innerHTML = `<div class="bar" style="margin:0"><span class="tag">Order ${esc(o.code)}</span><span class="meta">${esc(o.date)} · ${esc(o.country)} · ${esc(o.customer || "customer " + o.customerid)}</span><span class="spacer"></span><button class="chip" data-close type="button">Close</button></div>
    <div class="tw"><table><thead><tr><th>Product</th><th class="n">Qty</th><th class="n">Price</th><th class="n">Amount</th></tr></thead><tbody>${o.lines.map(l => `<tr><td>${esc(l.description)}</td><td class="n">${num(l.quantity)}</td><td class="n">${money(l.unitprice)}</td><td class="n">${money(l.total_amount)}</td></tr>`).join("")}</tbody></table></div>
    <div class="total"><span>${o.units} units</span><span>${money(o.total)}</span></div>`;
  $("od").showModal();
});
$("od").addEventListener("click", e => { if (e.target === $("od") || e.target.closest("[data-close]")) $("od").close(); });
function countryTable() {
  const m = {}; ords.forEach(o => { const c = m[o.country] ||= {o: 0, u: 0, r: 0}; c.o++; c.u += o.units; c.r += o.total; });
  const tot = sum(Object.values(m), c => c.r) || 1;
  $("ctable").innerHTML = `<thead><tr><th>Country</th><th class="n">Orders</th><th class="n">Units</th><th class="n">Revenue</th><th class="n">Share</th></tr></thead><tbody>` +
    Object.entries(m).sort((a, b) => b[1].r - a[1].r).map(([n, c]) => `<tr><td>${esc(n)}</td><td class="n">${c.o}</td><td class="n">${num(c.u)}</td><td class="n">${money(c.r)}</td><td class="n">${pct(c.r / tot)}</td></tr>`).join("") + "</tbody>";
}

// ---------- events ----------
sortClick("ptable", ST.p, productTable); sortClick("otable", ST.o, orderTable);
["pq", "pmin", "pmax", "umin", "umax"].forEach(id => $(id).addEventListener("input", productTable));
$("oq").addEventListener("input", orderTable);
["fc", "from", "to"].forEach(id => $(id).addEventListener("change", () => { bands = null; load(); }));
$("dfmt").addEventListener("change", () => { $("from").value = ""; $("to").value = ""; bands = null; load(); });
$("clear").addEventListener("click", () => { $("fc").value = "all"; $("from").value = ""; $("to").value = ""; bands = null; load(); });
$("tm").addEventListener("change", drawTop); $("ca").addEventListener("change", drawCompare); $("cb").addEventListener("change", drawCompare);
$("reset").addEventListener("click", () => { if (confirm("Delete all orders placed through the store? Original data stays.")) { clearSavedOrders(); bands = null; load(); } });
$("csv").addEventListener("click", () => {
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const body = ords.map(o => [q(o.code), o.date, q(o.customer || o.customerid), q(o.country), o.lines.length, o.units, o.total.toFixed(2)].join(","));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["order_code,date,customer,country,items,units,total\n" + body.join("\n")], {type: "text/csv"})); a.download = "orders.csv"; a.click();
});
$("fc").innerHTML = `<option value="all">All countries</option>` + [...new Set(allRows().map(r => r.country))].sort().map(c => `<option>${esc(c)}</option>`).join("");
load();
