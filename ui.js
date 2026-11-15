/* v3:ホーム・選手と相手の詳細・ドラッグで入れ替え・大きい画面・部の名前 */

const TEAM_COL = { A: "var(--a)", B: "var(--b)" };
const allRecs = () => Object.entries(store.matches || {}).map(([id, r]) => ({ id, ...r })).sort((a, b) => b.date.localeCompare(a.date) || (b.savedAt || "").localeCompare(a.savedAt || ""));
const resLab = { W: "勝", D: "分", L: "負" };
const daysTo = (d) => { const a = new Date(); a.setHours(0, 0, 0, 0); return Math.round((new Date(d + "T00:00:00") - a) / 864e5); };

/* ---------- 部の名前 ---------- */
function clubName() { return (store.meta && store.meta.club) || "サッカー部"; }
function renderClub() { $("club-name").textContent = clubName(); document.title = `${clubName()} スカッドボード`; }
$("club-save").addEventListener("click", () => { store.meta = { ...(store.meta || {}), club: $("club-input").value.trim() }; persist(); renderClub(); $("club-input").value = ""; });

/* ---------- ホーム ---------- */
function renderHome() {
  const keys = ["A", "B"].filter((k) => teamMembers(k).length || (teams[k] && teams[k].match && teams[k].match.date));
  if (!members.length) {
    $("home-fixtures").innerHTML = `<div class="fixture" style="--tc:var(--a)"><div class="side">A</div><div class="body"><div class="vs">まずは部員を登録しよう</div><div class="sub">名前・背番号・ポジションをまとめて貼り付けられます。</div><div class="bar"><button class="btn small primary" data-go="M">部員を登録する</button></div></div></div>`;
  } else {
    $("home-fixtures").innerHTML = keys.map((k) => {
      const t = normTeam(teams[k] || blankTeam(), k), mt = matchOf(t), ms = teamMembers(k), att = mt.att || {};
      const n = { yes: 0, maybe: 0, no: 0 }; ms.forEach((m) => { n[att[m.id] || "maybe"]++; });
      const tot = ms.length || 1, starters = t.lineup.filter(Boolean).length;
      const dd = mt.date ? daysTo(mt.date) : null;
      const left = dd == null ? "" : dd > 0 ? `あと${dd}日` : dd === 0 ? "今日" : "日付を過ぎています";
      const c = t.clock || {}; const live = t.live && (c.st === "1st" || c.st === "2nd" || c.st === "ht");
      const sc = scoreOf(t);
      const h2h = mt.opp ? allRecs().filter((r) => r.opp === mt.opp) : [];
      return `<article class="fixture" style="--tc:${TEAM_COL[k]}"><div class="side">${k}</div><div class="body">
        ${mt.date ? `<div class="when"><span class="date">${new Date(mt.date + "T00:00:00").getMonth() + 1}/${new Date(mt.date + "T00:00:00").getDate()}</span><span class="dow">${"日月火水木金土"[new Date(mt.date + "T00:00:00").getDay()]}曜日</span><span class="left">${live ? `試合中 ${sc.us}-${sc.them}` : left}</span></div>` : `<div class="when"><span class="sub">次の試合の日付がまだ決まっていません</span></div>`}
        <div class="vs"><small>vs</small>${esc(mt.opp || "相手未定")}</div>
        ${h2h.length ? `<div class="sub">この相手と${h2h.length}戦 ${h2h.filter((r) => r.us > r.them).length}勝${h2h.filter((r) => r.us === r.them).length}分${h2h.filter((r) => r.us < r.them).length}敗(前回 ${h2h[0].us}-${h2h[0].them})</div>` : ""}
        <div class="attbar" aria-hidden="true"><i style="width:${n.yes / tot * 100}%;background:var(--ok)"></i><i style="width:${n.no / tot * 100}%;background:var(--warn)"></i></div>
        <div class="sub">出欠 参加 ${n.yes} / 未定 ${n.maybe} / 不参加 ${n.no}<br>スタメン ${starters}/${t.lineup.length} ・ サブ ${t.subs.length}人</div>
        <div class="bar"><button class="btn small primary" data-go="${k}">スカッドを開く</button><button class="btn small" data-att-go="${k}">出欠をつける</button><button class="btn small" data-share="${k}">画像で共有</button></div>
        <div class="status" data-msg="${k}"></div>
      </div></article>`;
    }).join("");
  }
  const recs = allRecs();
  $("home-form").innerHTML = recs.length ? `<div class="form-strip" style="margin-bottom:6px">${recs.slice(0, 5).reverse().map((r) => `<span class="res ${resOf(r)}" title="${esc(r.opp)}">${resLab[resOf(r)]}</span>`).join("")}<span class="sub" style="margin-left:6px;align-self:center">直近${Math.min(5, recs.length)}試合(左が古い)</span></div>` +
    recs.slice(0, 5).map((r) => `<div class="form-row"><span class="res ${resOf(r)}">${resLab[resOf(r)]}</span><span><b>vs ${esc(r.opp || "(相手未入力)")}</b><br><span class="sub">${fmtDate(r.date)} ${r.team}チーム</span></span><span class="sc">${r.us} - ${r.them}</span></div>`).join("") + `<div class="bar" style="margin-top:6px"><button class="btn small" data-go="R">試合記録をすべて見る</button></div>`
    : '<div class="empty-state">試合を「記録に保存」すると、ここに結果が並びます。</div>';
  const st = {};
  recs.forEach((r) => r.events.forEach((e) => { if (e.type === "goal" && e.id) { const s = st[e.id] = st[e.id] || { id: e.id, name: nameIn(r, e.id), team: r.team, g: 0, a: 0 }; s.g++; } if (e.type === "goal" && e.assistId) { const s = st[e.assistId] = st[e.assistId] || { id: e.assistId, name: nameIn(r, e.assistId), team: r.team, g: 0, a: 0 }; s.a++; } }));
  const top = Object.values(st).filter((s) => s.g).sort((a, b) => b.g - a.g || b.a - a.a).slice(0, 5);
  $("home-leaders").innerHTML = top.length ? top.map((s, i) => `<div class="leader"><span class="rk">${i + 1}</span><span><button class="link" data-player="${s.id}">${esc(s.name)}</button> <span class="sub">${s.team}チーム${s.a ? ` ・ ${s.a}アシスト` : ""}</span></span><span class="n">${s.g}</span></div>`).join("")
    : '<div class="empty-state">得点を記録すると、ここにランキングが出ます。</div>';
}
$("view-H").addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]"); if (go) { view = go.dataset.go; sel = null; render(); window.scrollTo({ top: 0 }); return; }
  const ag = e.target.closest("[data-att-go]"); if (ag) { view = ag.dataset.attGo; attOpen = true; render(); $("match-panel").scrollIntoView({ block: "start" }); return; }
  const sh = e.target.closest("[data-share]"); if (sh) { shareSquad(sh.dataset.share, document.querySelector(`[data-msg="${sh.dataset.share}"]`)); return; }
  const pl = e.target.closest("[data-player]"); if (pl) openPlayer(pl.dataset.player);
});

/* ---------- 詳細のシート ---------- */
const sheet = $("sheet");
function openSheet(html, color) { $("sheet-body").innerHTML = html; sheet.style.setProperty("--tc", color || "var(--team)"); if (!sheet.open) sheet.showModal(); }
sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest("[data-close]")) sheet.close(); });

function playerStats(id) {
  const s = { apps: 0, starts: 0, min: 0, g: 0, a: 0, y: 0, r: 0, games: [] };
  allRecs().forEach((r) => {
    const played = r.starters.includes(id) || r.log.some((l) => l.inId === id);
    const g = r.events.filter((e) => e.type === "goal" && e.id === id).length, a = r.events.filter((e) => e.type === "goal" && e.assistId === id).length;
    r.events.forEach((e) => { if (e.id === id && e.type === "yellow") s.y++; if (e.id === id && e.type === "red") s.r++; });
    if (played) { s.apps++; if (r.starters.includes(id)) s.starts++; s.min += r.minutes[id] || 0; s.games.push({ r, min: r.minutes[id] || 0, g, a }); }
    s.g += g; s.a += a;
  });
  return s;
}
const FEET = ["", "右", "左", "両足"];
function openPlayer(id) {
  const m = mById(id); if (!m) return;
  const s = playerStats(id);
  openSheet(`<div class="sheet-head"><span class="big-no">${esc(m.no ?? "-")}</span><div><h2>${esc(m.name)}</h2><span class="sub" style="color:#fff;opacity:.85">${esc(m.team || "A")}チーム ・ ${esc(m.pos || "ポジション未設定")}</span></div><button class="x" data-close aria-label="閉じる">×</button></div>
    <div class="sheet-sec"><h3 class="sec-h">通算</h3>
      <div class="statgrid"><div><span>試合</span><b>${s.apps}</b></div><div><span>先発</span><b>${s.starts}</b></div><div><span>出場時間</span><b>${s.min}</b></div><div><span>得点</span><b>${s.g}</b></div><div><span>アシスト</span><b>${s.a}</b></div></div>
      ${s.y || s.r ? `<div class="sub">警告 ${s.y} ・ 退場 ${s.r}</div>` : ""}</div>
    <div class="sheet-sec"><h3 class="sec-h">プロフィール</h3>
      <div class="form2" id="pf" data-id="${m.id}">
        <label class="sub" for="pf-pos">ポジション</label><input type="text" id="pf-pos" data-f="pos" value="${esc(m.pos || "")}">
        <label class="sub" for="pf-pos2">ほかにできる</label><input type="text" id="pf-pos2" data-f="pos2" value="${esc(m.pos2 || "")}" placeholder="例)SB、DH">
        <label class="sub" for="pf-foot">利き足</label><select id="pf-foot" data-f="foot">${FEET.map((f) => `<option value="${f}" ${(m.foot || "") === f ? "selected" : ""}>${f || "—"}</option>`).join("")}</select>
        <label class="sub" for="pf-memo">メモ</label><textarea id="pf-memo" data-f="memo" placeholder="得意なプレー、気をつけること など" style="min-height:70px">${esc(m.memo || "")}</textarea>
      </div><div class="status" id="pf-msg"></div></div>
    <div class="sheet-sec"><h3 class="sec-h">最近の試合</h3>
      ${s.games.length ? s.games.slice(0, 8).map((x) => `<div class="form-row"><span class="res ${resOf(x.r)}">${resLab[resOf(x.r)]}</span><span><b>vs ${esc(x.r.opp || "(相手未入力)")}</b><br><span class="sub">${fmtDate(x.r.date)} ・ ${x.min}分${x.g ? ` ・ ${x.g}得点` : ""}${x.a ? ` ・ ${x.a}アシスト` : ""}</span></span><span class="sc">${x.r.us} - ${x.r.them}</span></div>`).join("") : '<div class="sub">まだ記録に出場がありません。</div>'}</div>`,
    TEAM_COL[m.team || "A"]);
}
$("sheet-body").addEventListener("change", async (e) => {
  const f = e.target.dataset.f, box = e.target.closest("#pf"); if (!f || !box) return;
  let v = e.target.value; if (f === "pos" || f === "pos2") v = v.toUpperCase();
  await db.doc("members/" + box.dataset.id).update({ [f]: v }); $("pf-msg").textContent = "保存した";
});
$("m-table").addEventListener("click", (e) => { const b = e.target.closest("[data-detail]"); if (b) openPlayer(b.dataset.detail); });

/* 対戦相手 */
function oppGroups(team) {
  const g = {};
  allRecs().filter((r) => r.opp && (team === "all" || r.team === team)).forEach((r) => { (g[r.opp] = g[r.opp] || []).push(r); });
  return Object.entries(g).sort((a, b) => b[1][0].date.localeCompare(a[1][0].date));
}
function renderOpps() {
  const gs = oppGroups($("r-team").value);
  $("r-opps").innerHTML = gs.length ? gs.map(([name, rs]) => { const w = rs.filter((r) => r.us > r.them).length, d = rs.filter((r) => r.us === r.them).length;
    return `<button class="opp-row" data-opp="${esc(name)}"><b>${esc(name)}</b><span class="rec3">${w}勝${d}分${rs.length - w - d}敗</span><span class="sub">${rs.length}試合 ・ 最後 ${fmtDate(rs[0].date)}</span><span class="sub">得点${rs.reduce((s, r) => s + r.us, 0)} 失点${rs.reduce((s, r) => s + r.them, 0)}</span></button>`; }).join("")
    : '<div class="sub">相手の名前を入れて試合を保存すると、相手ごとの成績とメモがここにまとまります。</div>';
}
function openOpp(name) {
  const rs = allRecs().filter((r) => r.opp === name), w = rs.filter((r) => r.us > r.them).length, d = rs.filter((r) => r.us === r.them).length;
  const memo = ((store.opponents || {})[name] || {}).memo || "";
  openSheet(`<div class="sheet-head" style="background:var(--dark)"><span class="big-no" style="font-size:2rem">vs</span><div><h2>${esc(name)}</h2><span class="sub" style="color:#fff;opacity:.85">${rs.length}試合 ${w}勝${d}分${rs.length - w - d}敗</span></div><button class="x" data-close aria-label="閉じる">×</button></div>
    <div class="sheet-sec"><h3 class="sec-h">対戦の記録</h3>${rs.map((r) => `<div class="form-row"><span class="res ${resOf(r)}">${resLab[resOf(r)]}</span><span><b>${fmtDate(r.date)}</b> <span class="sub">${r.team}チーム</span><br><span class="sub">${r.events.filter((e) => e.type === "goal").map((e) => (e.id ? nameIn(r, e.id) : "OG")).join("、") || "得点なし"}</span></span><span class="sc">${r.us} - ${r.them}</span></div>`).join("")}</div>
    <div class="sheet-sec"><h3 class="sec-h">相手のメモ</h3><textarea id="opp-memo" data-opp-name="${esc(name)}" placeholder="例)10番が速い、セットプレーが得意">${esc(memo)}</textarea><div class="status" id="opp-msg"></div></div>`, "var(--dark)");
}
$("r-opps").addEventListener("click", (e) => { const b = e.target.closest("[data-opp]"); if (b) openOpp(b.dataset.opp); });
$("sheet-body").addEventListener("change", (e) => {
  if (e.target.id !== "opp-memo") return;
  store.opponents = store.opponents || {}; store.opponents[e.target.dataset.oppName] = { ...(store.opponents[e.target.dataset.oppName] || {}), memo: e.target.value }; persist(); $("opp-msg").textContent = "保存した";
});
$("r-stats").addEventListener("click", (e) => { const b = e.target.closest("[data-player]"); if (b) openPlayer(b.dataset.player); });
const _renderRecords = renderRecords;
renderRecords = function () { _renderRecords(); renderOpps(); };

/* ---------- ドラッグで入れ替え ---------- */
let drag = null, suppressClick = 0;
const pickOf = (el) => el.classList.contains("slot") ? { kind: "slot", i: +el.dataset.slot } : el.classList.contains("chip") ? { kind: el.dataset.zone, id: el.dataset.id } : el.classList.contains("zone") ? { kind: "zone", zone: el.dataset.zone } : null;
const targetAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && (el.closest("#pitch .slot") || el.closest("#z-sub .chip, #z-out .chip") || el.closest("#z-sub, #z-out")); };
function startDrag(d) {
  d.on = true; const r = d.el.getBoundingClientRect(); const g = d.el.cloneNode(true); g.classList.add("ghost"); g.style.width = r.width + "px"; g.style.left = d.x + "px"; g.style.top = d.y + "px"; g.classList.remove("selected"); document.body.append(g); d.ghost = g;
  d.el.style.opacity = ".35"; try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
}
function endDrag(ok, x, y) {
  const d = drag; drag = null; if (!d) return;
  clearTimeout(d.timer); document.querySelectorAll(".drop").forEach((n) => n.classList.remove("drop"));
  if (!d.on) return;
  d.ghost.remove(); d.el.style.opacity = ""; suppressClick = Date.now();
  const tgt = ok ? targetAt(x, y) : null; if (!tgt || tgt === d.el) return;
  const a = pickOf(d.el), b = pickOf(tgt); if (!a || !b) return;
  sel = null; onPick(a); onPick(b);
}
document.addEventListener("pointerdown", (e) => {
  if (drag || (view !== "A" && view !== "B")) return;
  const el = e.target.closest("#pitch .slot, #z-sub .chip, #z-out .chip"); if (!el || el.classList.contains("empty")) return;
  drag = { el, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, on: false, touch: e.pointerType === "touch", chip: el.classList.contains("chip"), id: e.pointerId };
  if (drag.touch && drag.chip) drag.timer = setTimeout(() => { if (drag && !drag.on) startDrag(drag); }, 260); // ベンチは長押しで(スクロールと区別)
});
document.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.x = e.clientX; drag.y = e.clientY;
  const far = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8;
  if (!drag.on) { if (far && drag.touch && drag.chip) { clearTimeout(drag.timer); drag = null; return; } if (far) startDrag(drag); else return; }
  drag.ghost.style.left = e.clientX + "px"; drag.ghost.style.top = e.clientY + "px";
  document.querySelectorAll(".drop").forEach((n) => n.classList.remove("drop"));
  const t = targetAt(e.clientX, e.clientY); if (t && t !== drag.el) t.classList.add("drop");
});
document.addEventListener("pointerup", (e) => { if (drag && e.pointerId === drag.id) endDrag(true, e.clientX, e.clientY); });
document.addEventListener("pointercancel", () => endDrag(false));
document.addEventListener("touchmove", (e) => { if (drag && drag.on) e.preventDefault(); }, { passive: false });
document.addEventListener("click", (e) => { if (Date.now() - suppressClick < 400 && e.target.closest("#pitch, #z-sub, #z-out")) { e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener("contextmenu", (e) => { if (e.target.closest("#pitch, #z-sub, #z-out")) e.preventDefault(); });

/* ---------- 大きい画面(試合中)と画面の消灯防止 ---------- */
let wake = null;
async function keepAwake(on) {
  try {
    if (on && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); }
    if (!on && wake) { await wake.release(); wake = null; }
  } catch (e) {}
}
function setBig(on) {
  document.body.classList.toggle("big", on); $("big-toggle").textContent = on ? "元の画面に戻す" : "大きい画面";
  keepAwake(on || isRunning()); window.scrollTo({ top: 0 });
}
const isRunning = () => { const t = teams[view]; const c = t && t.clock; return !!(c && (c.st === "1st" || c.st === "2nd" || c.st === "ht")); };
$("big-toggle").addEventListener("click", () => setBig(!document.body.classList.contains("big")));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(document.body.classList.contains("big") || isRunning()); });
$("clock-btns").addEventListener("click", () => setTimeout(() => keepAwake(document.body.classList.contains("big") || isRunning()), 50));

/* 画面を切り替えたら大きい画面はやめる */
document.querySelectorAll(".tabbar .tab").forEach((b) => b.addEventListener("click", () => { if (document.body.classList.contains("big")) setBig(false); }));

renderClub();
render();
