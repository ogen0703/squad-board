/* 試合まわり(v2):次の試合・出欠・スタメン案・タイマー・得点とカード・出場時間・記録に保存・試合記録・個人成績・画像で共有 */

/* ---------- 共通 ---------- */
const HALF_DEFAULT = 25;
const attOf = (t) => (t.match && t.match.att) || {};
function matchOf(t) { t.match = { date: "", opp: "", half: HALF_DEFAULT, att: {}, ...(t.match || {}) }; return t.match; }
const halfOf = (t) => Number((t.match && t.match.half) || HALF_DEFAULT);
const fmtDate = (d) => { if (!d) return ""; const x = new Date(d + "T00:00:00"); return `${x.getMonth() + 1}/${x.getDate()}(${"日月火水木金土"[x.getDay()]})`; };
const nameIn = (rec, id) => (mById(id) || {}).name || (rec && rec.names && rec.names[id]) || "?";
function editTeam(fn, msg, hist = true) { const t = normTeam(T(), view); if (hist) pushHist(t); fn(t); teams[view] = t; render(); save(t, msg || ""); }

/* ---------- 時計 ---------- */
const CLOCK_LAB = { pre: "キックオフ前", "1st": "前半", ht: "ハーフタイム", "2nd": "後半", ft: "試合終了" };
function clockMin(t) {
  const c = t.clock || {}; const h = halfOf(t);
  if ((c.st === "1st" || c.st === "2nd") && c.at) return Math.floor((Date.now() - Date.parse(c.at)) / 60000) + 1 + (c.st === "2nd" ? h : 0);
  if (c.st === "ht") return h; if (c.st === "ft") return h * 2;
  return null;
}
/** 交代や得点を記録する「分」:手入力があればそれ、なければ時計 */
function curMinute(t) { const v = $("t-min").value; return v !== "" ? Number(v) : clockMin(t); }
function clockText(t) {
  const c = t.clock || { st: "pre" };
  if (c.st === "1st" || c.st === "2nd") {
    const sec = Math.max(0, Math.floor((Date.now() - Date.parse(c.at)) / 1000)) + (c.st === "2nd" ? halfOf(t) * 60 : 0);
    const over = sec >= halfOf(t) * 60 * (c.st === "2nd" ? 2 : 1);
    return `<small>${CLOCK_LAB[c.st]}</small><span style="${over ? "color:var(--warn)" : ""}">${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}</span>`;
  }
  return `<small>${CLOCK_LAB[c.st] || ""}</small>`;
}
setInterval(() => { if ((view === "A" || view === "B") && teams[view]) { const c = teams[view].clock || {}; if (c.st === "1st" || c.st === "2nd") $("clock").innerHTML = clockText(teams[view]); } }, 1000);

/* ---------- 出場時間 ---------- */
function endMinute(t, final) {
  const logMax = Math.max(0, ...(t.log || []).map((l) => l.min || 0), ...(t.events || []).map((e) => e.min || 0));
  if (final) return Math.max(halfOf(t) * 2, logMax);
  const cm = clockMin(t); return cm != null ? cm : logMax;
}
/** 選手ごとの出場分数(試合モードの開始時のスタメンと交代の記録から) */
function minutesOf(t, final = false) {
  const start = (t.snapshot || t).lineup.filter(Boolean); const end = endMinute(t, final);
  const on = {}, res = {}; start.forEach((id) => { on[id] = 0; });
  [...(t.log || [])].sort((a, b) => (a.min ?? end) - (b.min ?? end)).forEach((l) => {
    const m = l.min ?? end;
    if (on[l.outId] != null) { res[l.outId] = (res[l.outId] || 0) + Math.max(0, m - on[l.outId]); delete on[l.outId]; }
    if (l.inId) on[l.inId] = m;
  });
  Object.keys(on).forEach((id) => { res[id] = (res[id] || 0) + Math.max(0, end - on[id]); });
  return res;
}
const playedSet = (t) => new Set([...((t.snapshot || t).lineup.filter(Boolean)), ...(t.log || []).map((l) => l.inId)]);
const scoreOf = (t) => ({ us: (t.events || []).filter((e) => e.type === "goal").length, them: (t.events || []).filter((e) => e.type === "against").length });

/** ベンチの選手に「未出場」、メンバー外に出欠の印 */
function chipBadge(t, m, zone) {
  const a = attOf(t)[m.id];
  if (zone === "sub" && t.live && !playedSet(t).has(m.id)) return '<span class="badge warn">未出場</span>';
  if (zone === "out" && a === "yes") return '<span class="badge">参加</span>';
  if (zone !== "pitch" && a === "maybe") return '<span class="badge" style="background:none;color:var(--muted)">未定</span>';
  return "";
}

/* ---------- チーム画面のつけ足し ---------- */
let attOpen = false, evMode = null, evDraft = {};
function teamHook(t) {
  const mt = matchOf(t);
  if (document.activeElement !== $("m-date")) $("m-date").value = mt.date || "";
  if (document.activeElement !== $("m-opp")) $("m-opp").value = mt.opp || "";
  if (document.activeElement !== $("m-half")) $("m-half").value = mt.half || HALF_DEFAULT;
  // 出欠
  const att = mt.att || {}, ms = teamMembers(view);
  const n = { yes: 0, maybe: 0, no: 0 }; ms.forEach((m) => { n[att[m.id] || "maybe"]++; });
  $("att-sum").innerHTML = `出欠:<b class="in">参加 ${n.yes}</b> ・ 未定 ${n.maybe} ・ <span class="outc">不参加 ${n.no}</span>`;
  $("att-toggle").textContent = attOpen ? "閉じる" : "出欠をつける";
  $("att-list").hidden = !attOpen;
  if (attOpen) {
    $("att-list").innerHTML = `<div class="bar" style="margin-bottom:4px"><button class="btn small" data-att-all="yes">全員を参加に</button><button class="btn small" data-att-all="maybe">全員を未定に</button></div>` +
      ms.map((m) => { const a = att[m.id] || "maybe"; return `<div class="att-row"><span class="nm"><b style="font-family:var(--f-num)">${esc(m.no ?? "")}</b> ${esc(m.name)} <span class="sub">${esc(m.pos || "")}</span></span>
      <span class="seg">${[["yes", "参加"], ["maybe", "未定"], ["no", "不参加"]].map(([k, l]) => `<button class="${k}" aria-pressed="${a === k}" data-att="${m.id}" data-v="${k}">${l}</button>`).join("")}</span></div>`; }).join("");
  }
  // スタメン案
  const pre = presetsOf(view), cur = $("pre-sel").value;
  $("pre-sel").innerHTML = pre.length ? pre.map((p, i) => `<option value="${i}">${esc(p.name)}(${esc(p.formation)})</option>`).join("") : '<option value="">まだありません</option>';
  if (cur && pre[+cur]) $("pre-sel").value = cur;
  $("pre-load").disabled = $("pre-del").disabled = !pre.length;
  // 時計・スコア
  const c = t.clock || { st: "pre" };
  $("clock").innerHTML = clockText(t);
  const B = (id, lab, primary) => `<button class="btn small ${primary ? "primary" : ""}" data-clock="${id}">${lab}</button>`;
  $("clock-btns").innerHTML = c.st === "pre" ? B("1st", "▶ 前半キックオフ", true) : c.st === "1st" ? B("ht", "前半終了") : c.st === "ht" ? B("2nd", "▶ 後半キックオフ", true) : c.st === "2nd" ? B("ft", "試合終了") : '<span class="sub">試合終了。「記録に保存」で試合記録に残せます。</span>';
  const sc = scoreOf(t); $("score").textContent = `${sc.us} - ${sc.them}`;
  const h2h = mt.opp ? Object.values(store.matches || {}).filter((r) => r.opp && r.opp === mt.opp) : [];
  $("h2h-note").textContent = h2h.length ? `この相手と${h2h.length}戦 ${h2h.filter((r) => r.us > r.them).length}勝${h2h.filter((r) => r.us === r.them).length}分${h2h.filter((r) => r.us < r.them).length}敗` : "";
  $("min-note").textContent = c.st === "1st" || c.st === "2nd" ? `いま ${clockMin(t)}分(手入力すると、そちらが優先)` : "タイマーを使わないときは、ここに分を入れてから交代・得点を記録";
  renderPicker(t);
  // ログ(交代+得点+カード、時間順)
  const items = [...(t.log || []).map((l) => ({ ...l, k: "sub" })), ...(t.events || []).map((e) => ({ ...e, k: "ev" }))].sort((a, b) => (a.min ?? 999) - (b.min ?? 999));
  $("t-log").innerHTML = items.map((x) => `<div><span class="min">${x.min != null && x.min !== "" ? esc(x.min) + "'" : "—"}</span>${x.k === "sub"
    ? `<span class="in">IN ${esc(nameOf(x.inId))}</span><span class="outc">OUT ${esc(nameOf(x.outId))}</span><span class="sub">${esc(x.pos || "")}</span>`
    : x.type === "goal" ? `<span class="ev-goal">⚽ ${x.id ? esc(nameOf(x.id)) : "オウンゴール"}</span>${x.assistId ? `<span class="sub">(アシスト ${esc(nameOf(x.assistId))})</span>` : ""}`
      : x.type === "against" ? '<span class="ev-against">失点</span>'
        : `<span class="ev-card">${x.type === "red" ? "🟥" : "🟨"} ${esc(nameOf(x.id))}</span>`}</div>`).join("");
  $("rec-save").disabled = !((t.log || []).length || (t.events || []).length || c.st !== "pre");
  // メンバー表に出場時間と得点
  if (t.snapshot || (t.log || []).length) addMinutesToTable(t);
}
function addMinutesToTable(t) {
  const mins = minutesOf(t), ev = t.events || [];
  const tb = $("t-table"); const head = tb.querySelector("thead tr"); if (!head) return;
  head.insertAdjacentHTML("beforeend", "<th>出場</th>");
  tb.querySelectorAll("tbody tr").forEach((tr) => {
    if (tr.classList.contains("sec")) { const td = tr.querySelector("td"); if (td) td.colSpan = 5; return; }
    const nm = tr.children[1] ? tr.children[1].textContent.replace("↑途中", "").trim() : ""; const m = teamMembers(view).find((x) => x.name === nm);
    if (!m) { tr.insertAdjacentHTML("beforeend", "<td></td>"); return; }
    const g = ev.filter((e) => e.type === "goal" && e.id === m.id).length, a = ev.filter((e) => e.assistId === m.id).length;
    tr.insertAdjacentHTML("beforeend", `<td class="ps">${mins[m.id] != null ? mins[m.id] + "分" : "—"}${g ? ` <span class="ev-goal">⚽${g > 1 ? g : ""}</span>` : ""}${a ? ` <span class="sub">A${a > 1 ? a : ""}</span>` : ""}</td>`);
  });
}

/* 得点・失点・カードの選び方 */
function renderPicker(t) {
  const box = $("ev-pick"); if (!evMode) { box.innerHTML = ""; return; }
  const onPitch = t.lineup.filter(Boolean).map((id) => mById(id)).filter(Boolean);
  const ch = (m, attr) => `<button class="chip" ${attr}="${m.id}"><span class="no">${esc(m.no ?? "-")}</span>${esc(m.name)}</button>`;
  const cancel = '<button class="btn small" data-ev-cancel>やめる</button>';
  if (evMode === "goal") box.innerHTML = `<div class="picker"><span class="lab">得点した選手は?</span>${onPitch.map((m) => ch(m, "data-scorer")).join("")}<button class="btn small" data-scorer="">オウンゴール</button>${cancel}</div>`;
  else if (evMode === "assist") box.innerHTML = `<div class="picker"><span class="lab">アシストは?(${esc(evDraft.id ? nameOf(evDraft.id) : "オウンゴール")}の得点)</span>${onPitch.filter((m) => m.id !== evDraft.id).map((m) => ch(m, "data-assist")).join("")}<button class="btn small" data-assist="">なし</button>${cancel}</div>`;
  else if (evMode === "card") box.innerHTML = `<div class="picker"><span class="lab">カードを受けた選手は?</span>${[...onPitch, ...t.subs.map((id) => mById(id)).filter(Boolean)].map((m) => ch(m, "data-carded")).join("")}${cancel}</div>`;
  else if (evMode === "cardType") box.innerHTML = `<div class="picker"><span class="lab">${esc(nameOf(evDraft.id))} のカード</span><button class="btn small" data-ctype="yellow">🟨 イエロー</button><button class="btn small" data-ctype="red">🟥 レッド</button>${cancel}</div>`;
}
function addEvent(e) { editTeam((t) => { t.events = [...(t.events || []), { ...e, min: curMinute(t), at: new Date().toISOString() }]; }, e.type === "goal" ? "得点を記録" : e.type === "against" ? "失点を記録" : "カードを記録"); $("t-min").value = ""; }
$("ev-goal").addEventListener("click", () => { evMode = "goal"; evDraft = {}; render(); });
$("ev-card").addEventListener("click", () => { evMode = "card"; evDraft = {}; render(); });
$("ev-against").addEventListener("click", () => { evMode = null; addEvent({ type: "against" }); });
$("ev-pick").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.hasAttribute("data-ev-cancel")) { evMode = null; return render(); }
  if (b.hasAttribute("data-scorer")) { evDraft = { id: b.dataset.scorer || null }; evMode = "assist"; return render(); }
  if (b.hasAttribute("data-assist")) { evMode = null; return addEvent({ type: "goal", id: evDraft.id, assistId: b.dataset.assist || null }); }
  if (b.hasAttribute("data-carded")) { evDraft = { id: b.dataset.carded }; evMode = "cardType"; return render(); }
  if (b.dataset.ctype) { evMode = null; return addEvent({ type: b.dataset.ctype, id: evDraft.id }); }
});

/* 時計のボタン */
$("clock-btns").addEventListener("click", (e) => {
  const b = e.target.closest("[data-clock]"); if (!b) return; const st = b.dataset.clock;
  editTeam((t) => {
    if (st === "1st" && !t.snapshot) t.snapshot = { formation: t.formation, lineup: [...t.lineup], subs: [...t.subs] };
    if (st === "1st") t.live = true;
    t.clock = { st, at: st === "1st" || st === "2nd" ? new Date().toISOString() : (t.clock || {}).at };
  }, { "1st": "前半キックオフ!交代を記録します", ht: "ハーフタイム", "2nd": "後半キックオフ!", ft: "試合終了。おつかれさま" }[st]);
});

/* 次の試合の入力 */
$("m-date").addEventListener("change", () => editTeam((t) => { matchOf(t).date = $("m-date").value; }, "", false));
$("m-opp").addEventListener("change", () => editTeam((t) => { matchOf(t).opp = $("m-opp").value.trim(); }, "", false));
$("m-half").addEventListener("change", () => editTeam((t) => { const v = Number($("m-half").value); matchOf(t).half = v >= 1 && v <= 90 ? v : HALF_DEFAULT; }, "", false));
$("att-toggle").addEventListener("click", () => { attOpen = !attOpen; render(); });
$("att-list").addEventListener("click", (e) => {
  const all = e.target.closest("[data-att-all]");
  if (all) return editTeam((t) => { const a = matchOf(t).att; teamMembers(view).forEach((m) => { a[m.id] = all.dataset.attAll; }); }, "出欠をまとめて変えた");
  const b = e.target.closest("[data-att]"); if (!b) return;
  const id = b.dataset.att, v = b.dataset.v;
  editTeam((t) => {
    matchOf(t).att[id] = v;
    if (v === "no") { t.lineup = t.lineup.map((x) => (x === id ? null : x)); t.subs = t.subs.filter((x) => x !== id); }
  }, v === "no" ? `${nameOf(id)}は不参加(ピッチ・サブから外した)` : "");
});

/* スタメン案(端末に保存) */
function presetsOf(k) { store.presets = store.presets || {}; return store.presets[k] || (store.presets[k] = []); }
$("pre-save").addEventListener("click", () => {
  const t = normTeam(T(), view); const list = presetsOf(view);
  $("pre-msg").innerHTML = `名前:<input type="text" id="pre-name" value="案${list.length + 1}" style="width:140px"> <button class="btn small primary" id="pre-ok">保存</button> <button class="btn small" id="pre-cancel">やめる</button>`;
  $("pre-name").select();
  $("pre-ok").onclick = () => {
    const name = $("pre-name").value.trim() || `案${list.length + 1}`;
    const i = list.findIndex((p) => p.name === name); const rec = { name, formation: t.formation, lineup: [...t.lineup], subs: [...t.subs], at: new Date().toISOString() };
    if (i >= 0) list[i] = rec; else list.push(rec);
    persist(); $("pre-msg").textContent = `「${name}」を保存した`; render(); $("pre-sel").value = String(i >= 0 ? i : list.length - 1);
  };
  $("pre-cancel").onclick = () => { $("pre-msg").textContent = ""; };
});
$("pre-load").addEventListener("click", () => {
  const p = presetsOf(view)[+$("pre-sel").value]; if (!p) return;
  if (T().live) { $("pre-msg").textContent = "試合中は呼び出せません(試合前に戻してから)"; return; }
  editTeam((t) => {
    const ids = new Set(teamMembers(view).map((m) => m.id)), att = attOf(t), ok = (id) => id && ids.has(id) && att[id] !== "no";
    t.formation = p.formation; t.lineup = p.lineup.map((id) => (ok(id) ? id : null)); t.subs = p.subs.filter(ok);
  }, `「${p.name}」を呼び出した(不参加・いない人は空き枠に)`);
  $("pre-msg").textContent = "";
});
$("pre-del-box").addEventListener("click", (e) => {
  const list = presetsOf(view), i = +$("pre-sel").value;
  if (e.target.id === "pre-del" && list[i]) $("pre-del-box").innerHTML = `「${esc(list[i].name)}」を消す? <button class="btn small primary" id="pre-del-yes">消す</button><button class="btn small" id="pre-del-no">やめる</button>`;
  else if (e.target.id === "pre-del-yes") { list.splice(i, 1); persist(); $("pre-del-box").innerHTML = '<button class="btn small" id="pre-del">削除</button>'; render(); }
  else if (e.target.id === "pre-del-no") $("pre-del-box").innerHTML = '<button class="btn small" id="pre-del">削除</button>';
});

/* ---------- 記録に保存 ---------- */
$("rec-box").addEventListener("click", (e) => {
  const id = e.target.id;
  if (id === "rec-save") {
    const t = T(), sc = scoreOf(t), mt = matchOf(t);
    $("rec-box").innerHTML = `${esc(mt.opp || "相手未入力")} ${sc.us}-${sc.them} で保存? <button class="btn small primary" id="rec-yes">保存</button><button class="btn small" id="rec-no">やめる</button>`;
  } else if (id === "rec-yes") {
    const t = normTeam(T(), view), mt = matchOf(t), sc = scoreOf(t), start = (t.snapshot || t).lineup.filter(Boolean);
    const ids = new Set([...start, ...(t.log || []).flatMap((l) => [l.inId, l.outId]), ...(t.events || []).flatMap((x) => [x.id, x.assistId])].filter(Boolean));
    const rec = { team: view, date: mt.date || new Date().toISOString().slice(0, 10), opp: mt.opp || "", half: halfOf(t), formation: (t.snapshot || t).formation, starters: start, log: t.log || [], events: t.events || [], us: sc.us, them: sc.them, minutes: minutesOf(t, true), att: { ...(mt.att || {}) }, names: Object.fromEntries([...ids].map((x) => [x, nameOf(x)])), savedAt: new Date().toISOString() };
    store.matches = store.matches || {}; store.matches[Date.now().toString(36)] = rec; persist();
    // 次の試合に向けて、試合前のスタメンに戻す
    const t2 = normTeam(T(), view); pushHist(t2);
    if (t2.snapshot) Object.assign(t2, t2.snapshot);
    Object.assign(t2, { log: [], live: false, snapshot: null, events: [], clock: { st: "pre", at: null }, match: { date: "", opp: "", half: halfOf(t2), att: {} } });
    teams[view] = t2; recBox(); render(); save(t2, "試合記録に保存した。スタメンは試合前に戻したよ(「試合記録」タブで見られる)");
  } else if (id === "rec-no") recBox();
});
function recBox() { $("rec-box").innerHTML = '<button class="btn small primary" id="rec-save">記録に保存</button>'; }

/* ---------- 試合記録タブ ---------- */
let openRec = null;
function recList(team) { return Object.entries(store.matches || {}).map(([id, r]) => ({ id, ...r })).filter((r) => team === "all" || r.team === team).sort((a, b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt)); }
const resOf = (r) => (r.us > r.them ? "W" : r.us === r.them ? "D" : "L");
function renderRecords() {
  const team = $("r-team").value, list = recList(team);
  const w = list.filter((r) => resOf(r) === "W").length, d = list.filter((r) => resOf(r) === "D").length, l = list.length - w - d;
  const gf = list.reduce((s, r) => s + r.us, 0), ga = list.reduce((s, r) => s + r.them, 0);
  $("r-kpis").innerHTML = list.length ? `<div><span class="sub">試合</span><b>${list.length}</b></div><div><span class="sub">成績</span><b>${w}勝 ${d}分 ${l}敗</b></div><div><span class="sub">得点 / 失点</span><b>${gf} / ${ga}</b></div>` : "";
  $("r-list").innerHTML = list.length ? list.map((r) => {
    const scorers = r.events.filter((e) => e.type === "goal").map((e) => (e.id ? nameIn(r, e.id) : "OG"));
    const open = openRec === r.id;
    return `<div class="rec"><button class="head" data-rec="${r.id}"><span class="res ${resOf(r)}">${{ W: "勝", D: "分", L: "負" }[resOf(r)]}</span><span class="sc">${r.us} - ${r.them}</span><b>vs ${esc(r.opp || "(相手未入力)")}</b><span class="sub">${fmtDate(r.date)} ・ ${r.team}チーム</span>${scorers.length ? `<span class="sub" style="width:100%">⚽ ${esc(scorers.join("、"))}</span>` : ""}</button>${open ? recDetail(r) : ""}</div>`;
  }).join("") : '<div class="empty-state">まだ記録がありません。チーム画面で試合モードを使い、終わったら「記録に保存」。</div>';
  // 個人成績
  const st = {};
  const row = (r, id) => (st[id] = st[id] || { id, name: nameIn(r, id), team: (mById(id) || {}).team || r.team, apps: 0, starts: 0, min: 0, g: 0, a: 0, y: 0, rd: 0 });
  list.forEach((r) => {
    const played = new Set([...r.starters, ...r.log.map((x) => x.inId)].filter(Boolean));
    played.forEach((id) => { const s = row(r, id); s.apps++; s.min += r.minutes[id] || 0; if (r.starters.includes(id)) s.starts++; });
    r.events.forEach((e) => { if (e.type === "goal" && e.id) row(r, e.id).g++; if (e.type === "goal" && e.assistId) row(r, e.assistId).a++; if (e.type === "yellow") row(r, e.id).y++; if (e.type === "red") row(r, e.id).rd++; });
  });
  const rows = Object.values(st).sort((a, b) => b.min - a.min || b.g - a.g);
  $("r-stats").innerHTML = rows.length ? `<thead><tr><th>名前</th><th>試合</th><th>先発</th><th>時間</th><th>得点</th><th>A</th><th>警告</th></tr></thead><tbody>` +
    rows.map((s) => `<tr><td>${mById(s.id) ? `<button class="link" data-player="${s.id}">${esc(s.name)}</button>` : esc(s.name)}${team === "all" ? ` <span class="sub">${esc(s.team)}</span>` : ""}</td><td class="ps">${s.apps}</td><td class="ps">${s.starts}</td><td class="ps">${s.min}分</td><td class="ps">${s.g || ""}</td><td class="ps">${s.a || ""}</td><td class="ps">${s.y ? "🟨" + s.y : ""}${s.rd ? " 🟥" + s.rd : ""}</td></tr>`).join("") + "</tbody>"
    : '<tr><td class="empty-state">記録に保存した試合がまだありません。</td></tr>';
}
/** 試合分析(動画)でこの記録とつながっている分 */
function recAnalysis(r) {
  const an = store.analysis; if (!an) return "";
  const ms = (an.matches || []).filter((m) => m.sbRec === r.id); if (!ms.length) return "";
  const c = {}; ms.forEach((m) => Object.entries(m.counts || {}).forEach(([k, v]) => { c[k] = (c[k] || 0) + v; }));
  const nm = (k) => ((an.events || []).find((e) => e.id === k) || {}).name || k;
  const order = ["shot", "shot_against", "chance", "pinch", "win", "lose", "set_us", "set_them", "good", "fix"];
  const coms = ms.flatMap((m) => Object.entries(m.comments || {})).filter(([, v]) => v && v.trim());
  return `<div><span class="sub">動画の分析(${ms.map((m) => esc(m.half || "")).filter(Boolean).join("・") || "1本"}):</span>${order.filter((k) => c[k]).map((k) => `${esc(nm(k))} ${c[k]}`).join(" ・ ") || "タグなし"}</div>
    ${coms.length ? `<div><span class="sub">コメント:</span>${coms.map(([id, v]) => `<b>${esc(nameIn(r, id))}</b> ${esc(v)}`).join("<br>")}</div>` : ""}`;
}
function recDetail(r) {
  const ev = [...r.log.map((l) => ({ ...l, k: "sub" })), ...r.events.map((e) => ({ ...e, k: "ev" }))].sort((a, b) => (a.min ?? 999) - (b.min ?? 999));
  const mins = Object.entries(r.minutes).sort((a, b) => b[1] - a[1]);
  return `<div class="detail">
    <div><span class="sub">先発(${esc(r.formation)}・${r.half}分×2):</span>${r.starters.map((id) => esc(nameIn(r, id))).join("、")}</div>
    ${ev.length ? `<div class="log">${ev.map((x) => `<div><span class="min">${x.min != null ? x.min + "'" : "—"}</span>${x.k === "sub" ? `<span class="in">IN ${esc(nameIn(r, x.inId))}</span><span class="outc">OUT ${esc(nameIn(r, x.outId))}</span>` : x.type === "goal" ? `<span class="ev-goal">⚽ ${x.id ? esc(nameIn(r, x.id)) : "オウンゴール"}</span>${x.assistId ? `<span class="sub">(A ${esc(nameIn(r, x.assistId))})</span>` : ""}` : x.type === "against" ? '<span class="ev-against">失点</span>' : `<span>${x.type === "red" ? "🟥" : "🟨"} ${esc(nameIn(r, x.id))}</span>`}</div>`).join("")}</div>` : ""}
    <div><span class="sub">出場時間:</span>${mins.map(([id, m]) => `${esc(nameIn(r, id))} ${m}分`).join(" ・ ")}</div>
    ${recAnalysis(r)}
    <div class="bar"><span class="confirm" data-recdel-box="${r.id}"><button class="btn small" data-recdel="${r.id}">この記録を消す</button></span></div>
  </div>`;
}
$("r-team").addEventListener("change", () => renderRecords());
$("r-list").addEventListener("click", (e) => {
  const h = e.target.closest("[data-rec]"); if (h) { openRec = openRec === h.dataset.rec ? null : h.dataset.rec; return renderRecords(); }
  const d = e.target.closest("[data-recdel]"); if (d) { d.parentElement.innerHTML = `消すと元に戻せない。消す? <button class="btn small primary" data-recyes="${d.dataset.recdel}">消す</button><button class="btn small" data-recno>やめる</button>`; return; }
  const y = e.target.closest("[data-recyes]"); if (y) { delete store.matches[y.dataset.recyes]; persist(); openRec = null; return renderRecords(); }
  if (e.target.closest("[data-recno]")) renderRecords();
});

/* ---------- 画像で共有 ---------- */
async function squadImage(t, key) {
  try { await Promise.all(["700 30px 'Zen Kaku Gothic New'", "700 30px 'Barlow Condensed'"].map((f) => document.fonts.load(f))); } catch (e) {}
  const mt = matchOf(t), form = F[t.formation], subs = t.subs.map((id) => mById(id)).filter(Boolean);
  const W = 1080, pad = 48, pw = W - pad * 2, ph = Math.round(pw * 1.18), top = 220, rows = Math.ceil(subs.length / 2);
  const H = top + ph + 90 + Math.max(1, rows) * 52 + 70;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  const col = key === "A" ? "#c8102e" : "#00a398", JP = "'Zen Kaku Gothic New','Hiragino Sans',sans-serif", NUM = "'Barlow Condensed','Arial Narrow',sans-serif";
  g.fillStyle = "#f3f1f1"; g.fillRect(0, 0, W, H);
  // チームカラーの帯と大きな斜体の文字
  g.fillStyle = col; g.fillRect(0, 0, W, top - 36); g.fillStyle = "#f6eb61"; g.fillRect(0, top - 36, W, 6); g.fillStyle = col;
  g.save(); g.globalAlpha = 0.09; g.fillStyle = "#fff"; g.beginPath(); g.moveTo(W * 0.62, 0); g.lineTo(W * 0.70, 0); g.lineTo(W * 0.62, top - 36); g.lineTo(W * 0.54, top - 36); g.fill();
  g.beginPath(); g.moveTo(W * 0.74, 0); g.lineTo(W * 0.78, 0); g.lineTo(W * 0.70, top - 36); g.lineTo(W * 0.66, top - 36); g.fill(); g.restore();
  g.fillStyle = "#fff"; g.font = `italic 800 170px ${NUM}`; g.fillText(key, pad - 6, top - 52);
  g.font = `900 52px ${JP}`; g.fillText(`${key}チーム メンバー表`, pad + 120, 86);
  g.globalAlpha = 0.85; g.font = `700 30px ${JP}`;
  g.fillText([mt.date ? fmtDate(mt.date) : "", mt.opp ? `vs ${mt.opp}` : "", t.formation].filter(Boolean).join("   "), pad + 122, 136); g.globalAlpha = 1;
  // ピッチ
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.save(); rr(pad, top, pw, ph, 22); g.clip();
  for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? "#2a6f3e" : "#2f7a45"; g.fillRect(pad, top + (ph / 10) * i, pw, ph / 10 + 1); }
  g.restore();
  const X = (p) => pad + (pw * p) / 100, Y = (p) => top + (ph * p) / 100;
  g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 3;
  g.strokeRect(X(3), Y(2), X(97) - X(3), Y(98) - Y(2)); g.beginPath(); g.moveTo(X(3), Y(50)); g.lineTo(X(97), Y(50)); g.stroke();
  g.beginPath(); g.arc(X(50), Y(50), pw * 0.11, 0, Math.PI * 2); g.stroke();
  g.strokeRect(X(22), Y(2), X(78) - X(22), Y(16) - Y(2)); g.strokeRect(X(22), Y(84), X(78) - X(22), Y(98) - Y(84));
  form.forEach(([ps, x, y], i) => {
    const m = t.lineup[i] && mById(t.lineup[i]); const cx = X(x), cy = Y(4 + y * 0.86);
    g.beginPath(); g.arc(cx, cy, 38, 0, Math.PI * 2); g.fillStyle = ps === "GK" ? "#f6eb61" : m ? col : "rgba(255,255,255,.2)"; g.fill();
    g.lineWidth = 5; g.strokeStyle = "#fff"; g.stroke();
    g.fillStyle = ps === "GK" ? "#1d1d1b" : "#fff"; g.font = `700 40px ${NUM}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(m ? String(m.no ?? "") : "", cx, cy + 2);
    g.textBaseline = "alphabetic"; g.font = `700 28px ${JP}`; g.lineWidth = 6; g.strokeStyle = "rgba(0,0,0,.55)"; g.fillStyle = "#fff";
    const nm = m ? m.name : "空き"; g.strokeText(nm, cx, cy + 74); g.fillText(nm, cx, cy + 74);
    g.font = `600 22px ${NUM}`; g.fillStyle = "rgba(255,255,255,.9)"; g.fillText(ps, cx, cy + 100);
  });
  g.textAlign = "left";
  // サブ
  let y0 = top + ph + 70; g.fillStyle = col; g.fillRect(pad, y0 - 30, 8, 36); g.fillStyle = "#1d1d1b"; g.font = `900 34px ${JP}`; g.fillText(`サブ ${subs.length}人`, pad + 20, y0);
  g.font = `500 30px ${JP}`;
  if (!subs.length) { g.fillStyle = "#5d6b61"; g.fillText("なし", pad, y0 + 52); }
  subs.forEach((m, i) => { const cx = pad + (i % 2) * (pw / 2), cy = y0 + 52 * (Math.floor(i / 2) + 1); g.fillStyle = col; g.font = `700 32px ${NUM}`; g.fillText(String(m.no ?? "-"), cx, cy); g.fillStyle = "#1d1d1b"; g.font = `700 30px ${JP}`; g.fillText(`${m.name}${m.pos ? `(${m.pos})` : ""}`, cx + 56, cy); });
  return new Promise((res) => cv.toBlob(res, "image/png"));
}
$("share-img").addEventListener("click", () => shareSquad(view, $("pre-msg")));
async function shareSquad(k, msgEl) {
  const t = normTeam(teams[k] || blankTeam(), k); const blob = await squadImage(t, k);
  const mt = matchOf(t), name = `${k}チーム_${mt.date || new Date().toISOString().slice(0, 10)}.png`;
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `${k}チーム メンバー表` }); if (msgEl) msgEl.textContent = ""; return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  if (msgEl) msgEl.textContent = "画像を保存した。LINEで送るときは、写真から選んでね。";
}

render();
