/* スカッドボード本体:部員・チーム・ピッチ・保存 */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* フォーメーション(x:左→右 %, y:上=相手ゴール %) */
const F = {
  "4-4-2": [["GK",50,90],["LSB",13,72],["CB",37,74],["CB",63,74],["RSB",87,72],["LSH",13,47],["CH",37,50],["CH",63,50],["RSH",87,47],["FW",35,22],["FW",65,22]],
  "4-3-3": [["GK",50,90],["LSB",13,72],["CB",37,74],["CB",63,74],["RSB",87,72],["CH",25,50],["DH",50,56],["CH",75,50],["LWG",15,24],["CF",50,18],["RWG",85,24]],
  "4-2-3-1": [["GK",50,90],["LSB",13,72],["CB",37,74],["CB",63,74],["RSB",87,72],["DH",35,57],["DH",65,57],["LSH",14,36],["OH",50,36],["RSH",86,36],["CF",50,16]],
  "4-1-2-1-2": [["GK",50,90],["LSB",13,72],["CB",37,74],["CB",63,74],["RSB",87,72],["DH",50,58],["CH",25,46],["CH",75,46],["OH",50,34],["FW",35,17],["FW",65,17]],
  "3-5-2": [["GK",50,90],["CB",25,73],["CB",50,75],["CB",75,73],["LWB",9,46],["CH",32,52],["DH",50,58],["CH",68,52],["RWB",91,46],["FW",35,21],["FW",65,21]],
  "3-4-3": [["GK",50,90],["CB",25,73],["CB",50,75],["CB",75,73],["LSH",11,48],["CH",37,52],["CH",63,52],["RSH",89,48],["LWG",15,22],["CF",50,18],["RWG",85,22]],
  "8人制 3-3-1": [["GK",50,90],["DF",20,70],["DF",50,73],["DF",80,70],["MF",20,46],["MF",50,48],["MF",80,46],["FW",50,20]],
  "8人制 2-3-2": [["GK",50,90],["DF",30,71],["DF",70,71],["MF",15,48],["MF",50,50],["MF",85,48],["FW",35,21],["FW",65,21]],
  "7人制 2-3-1": [["GK",50,90],["DF",30,70],["DF",70,70],["MF",18,46],["MF",50,48],["MF",82,46],["FW",50,20]],
  "7人制 3-2-1": [["GK",50,90],["DF",20,70],["DF",50,72],["DF",80,70],["MF",33,46],["MF",67,46],["FW",50,20]],
  "5人制 1-2-1": [["GK",50,90],["FIXO",50,68],["ALA",18,46],["ALA",82,46],["PIVO",50,22]],
  "5人制 2-2": [["GK",50,90],["DF",30,66],["DF",70,66],["FW",30,30],["FW",70,30]],
};
$("t-form").innerHTML = Object.keys(F).map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join("");

let db = null, members = [], teams = { A: null, B: null }, view = "H", sel = null, unsub = [];
let lastTeam = (() => { try { return localStorage.getItem("squad-last-team") === "B" ? "B" : "A"; } catch (e) { return "A"; } })();
const blankTeam = () => ({ formation: "4-4-2", lineup: [], subs: [], live: false, log: [], snapshot: null, history: [], events: [], clock: { st: "pre", at: null }, match: { date: "", opp: "", half: 25, att: {} } });
const T = () => teams[view] || blankTeam();
const mById = (id) => members.find(m => m.id === id);
const teamMembers = (t) => members.filter(m => (m.team || "A") === t).sort((a, b) => (a.no ?? 999) - (b.no ?? 999) || a.name.localeCompare(b.name, "ja"));

function normTeam(t, key) {
  const slots = F[t.formation] ? F[t.formation].length : 11;
  const ids = new Set(teamMembers(key).map(m => m.id));
  let lineup = (t.lineup || []).slice(0, slots).map(x => (x && ids.has(x)) ? x : null);
  while (lineup.length < slots) lineup.push(null);
  const used = new Set(lineup.filter(Boolean));
  const subs = (t.subs || []).filter(x => ids.has(x) && !used.has(x));
  return { ...blankTeam(), ...t, lineup, subs };
}

/* ---------- 描画 ---------- */
function render() {
  const isTeam = view === "A" || view === "B";
  if (isTeam) { lastTeam = view; try { localStorage.setItem("squad-last-team", view); } catch (e) {} }
  document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", String(b.dataset.v === view || (b.dataset.v === "S" && isTeam))));
  document.documentElement.classList.toggle("team-B", isTeam ? view === "B" : false);
  $("view-team").hidden = !isTeam; $("view-M").hidden = view !== "M"; $("view-T").hidden = view !== "T"; $("view-R").hidden = view !== "R"; $("view-H").hidden = view !== "H";
  if (view === "H") return window.renderHome && renderHome();
  if (view === "M") { renderMembers(); return window.membersHook && membersHook(); }
  if (view === "R") return window.renderRecords && renderRecords();
  if (view === "T") return window.tacticsRender && window.tacticsRender();
  const t = normTeam(T(), view); teams[view] = t;
  $("t-title").textContent = view + "チーム"; $("team-letter").textContent = view; $("tbl-title").textContent = "メンバー表";
  $("t-form").value = t.formation;
  $("t-live").checked = !!t.live; $("t-live-lab").textContent = t.live ? "試合中(交代を記録)" : "試合モード"; $("t-live-lab").className = t.live ? "live-on" : "";
  const subIn = new Set((t.log || []).map(l => l.inId));
  // pitch
  const lines = `<svg class="lines" viewBox="0 0 68 96" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="var(--chalk)" stroke-width=".4">
    <rect x="2" y="2" width="64" height="92"/><line x1="2" y1="48" x2="66" y2="48"/><circle cx="34" cy="48" r="7.5"/>
    <rect x="15" y="2" width="38" height="14"/><rect x="25" y="2" width="18" height="5"/><rect x="15" y="80" width="38" height="14"/><rect x="25" y="89" width="18" height="5"/></g></svg>`;
  $("pitch").innerHTML = lines + F[t.formation].map(([ps, x, y], i) => {
    const m = t.lineup[i] && mById(t.lineup[i]);
    const cls = ["slot", ps === "GK" ? "gk" : "", m ? "" : "empty", sel && sel.kind === "slot" && sel.i === i ? "selected" : "", m && subIn.has(m.id) ? "subbed" : ""].join(" ");
    return `<button class="${cls}" style="left:${x}%;top:${y}%" data-slot="${i}" aria-label="${esc(ps)} ${m ? esc(m.name) : "空き"}">
      <span class="shirt">${m ? esc(m.no ?? "") : "+"}</span><span class="nm">${m ? esc(m.name) : "空き"}</span><span class="ps">${esc(ps)}</span></button>`;
  }).join("");
  // bench & out
  const onPitch = new Set(t.lineup.filter(Boolean)), onBench = new Set(t.subs);
  const badgeOf = window.chipBadge ? (m, zone) => chipBadge(t, m, zone) : () => "";
  const chip = (m, zone) => `<button class="chip ${zone === "out" ? "out" : ""} ${sel && sel.kind === zone && sel.id === m.id ? "selected" : ""}" data-zone="${zone}" data-id="${m.id}">
    <span class="no">${esc(m.no ?? "-")}</span>${esc(m.name)}<span class="p">${esc(m.pos || "")}</span>${badgeOf(m, zone)}</button>`;
  $("z-sub").innerHTML = `<span class="lab">サブ(ベンチ) ${t.subs.length}人</span>` + (t.subs.map(id => mById(id)).filter(Boolean).map(m => chip(m, "sub")).join("") || '<span class="sub">ここに選手を置くとサブになります</span>');
  const att = (t.match && t.match.att) || {};
  const outsAll = teamMembers(view).filter(m => !onPitch.has(m.id) && !onBench.has(m.id));
  const outs = outsAll.filter(m => att[m.id] !== "no"), absent = outsAll.filter(m => att[m.id] === "no");
  $("z-out").innerHTML = `<span class="lab">メンバー外 ${outs.length}人</span>` + (outs.map(m => chip(m, "out")).join("") || '<span class="sub">全員エントリー済み</span>') +
    (absent.length ? `<span class="sub" style="width:100%">不参加:${absent.map(m => esc(m.name)).join("、")}</span>` : "");
  document.querySelectorAll(".zone").forEach(z => z.classList.toggle("target", !!sel));
  // log
  $("t-log").innerHTML = (t.log || []).length ? t.log.map(l => `<div><span class="min">${l.min != null && l.min !== "" ? esc(l.min) + "'" : "—"}</span><span class="in">IN ${esc(nameOf(l.inId))}</span><span class="outc">OUT ${esc(nameOf(l.outId))}</span><span class="sub">${esc(l.pos || "")}</span></div>`).join("") : "";
  $("t-undo").disabled = !(t.history || []).length;
  // table
  const starters = F[t.formation].map(([ps], i) => ({ ps, m: t.lineup[i] && mById(t.lineup[i]) })).filter(x => x.m);
  const subsM = t.subs.map(id => mById(id)).filter(Boolean);
  if (!teamMembers(view).length) {
    $("t-table").innerHTML = `<tr><td class="empty-state">${view}チームの部員がまだいません。「部員の登録」から追加してね。</td></tr>`;
  } else {
    $("t-table").innerHTML = `<thead><tr><th>No.</th><th>名前</th><th>ポジ</th><th>本来</th></tr></thead><tbody>
      <tr class="sec"><td colspan="4">スタメン ${starters.length}/${F[t.formation].length}人 ・ ${esc(t.formation)}</td></tr>` +
      (starters.map(x => `<tr><td class="no">${esc(x.m.no ?? "")}</td><td>${esc(x.m.name)}${subIn.has(x.m.id) ? ' <span class="in">↑途中</span>' : ""}</td><td class="ps">${esc(x.ps)}</td><td class="ps">${esc(x.m.pos || "")}</td></tr>`).join("") || `<tr><td colspan="4" class="sub">ピッチに選手を置くとここに出ます</td></tr>`) +
      `<tr class="sec"><td colspan="4">サブ ${subsM.length}人</td></tr>` +
      (subsM.map(m => `<tr><td class="no">${esc(m.no ?? "")}</td><td>${esc(m.name)}</td><td class="ps">—</td><td class="ps">${esc(m.pos || "")}</td></tr>`).join("") || `<tr><td colspan="4" class="sub">なし</td></tr>`) + "</tbody>";
  }
  $("tbl-count").textContent = `登録 ${teamMembers(view).length}人`;
  setHint();
  window.teamHook && teamHook(t);
}
const nameOf = (id) => (mById(id) || {}).name || "?";
function setHint() {
  if (!sel) { $("hint").innerHTML = "選手をタップ → 入れ替えたい選手(または空き枠・サブ・メンバー外の欄)をタップ"; return; }
  const t = T(); const id = sel.kind === "slot" ? t.lineup[sel.i] : sel.id;
  const other = view === "A" ? "B" : "A";
  $("hint").innerHTML = id ? `<b>${esc(nameOf(id))}</b> を選択中 → 行き先をタップ(もう一度タップで解除) <button class="btn small" id="move-team" data-id="${esc(id)}">${other}チームへ移す</button>` : `空き枠を選択中 → 入れる選手をタップ`;
}
$("hint").addEventListener("click", async (e) => {
  const b = e.target.closest("#move-team"); if (!b) return;
  const id = b.dataset.id, other = view === "A" ? "B" : "A", name = nameOf(id);
  const t = normTeam(T(), view); pushHist(t);
  t.lineup = t.lineup.map(x => x === id ? null : x); t.subs = t.subs.filter(x => x !== id);
  teams[view] = t; sel = null;
  try { await db.doc("members/" + id).update({ team: other }); } catch (err) {}
  render(); save(t, `${name}を${other}チームに移した(${other}チームではメンバー外に入っています)`);
});

function renderMembers() {
  $("m-count").textContent = `${members.length}人(A ${teamMembers("A").length} / B ${teamMembers("B").length})`;
  if (!members.length) { $("m-table").innerHTML = `<tr><td class="empty-state">まだ部員がいません。左の「まとめて追加」に名前を貼るか、「1人追加」から入れてね。</td></tr>`; return; }
  const rows = [...members].sort((a, b) => (a.team || "A").localeCompare(b.team || "A") || (a.no ?? 999) - (b.no ?? 999));
  $("m-table").innerHTML = `<thead><tr><th>No.</th><th>名前</th><th>ポジ</th><th>チーム</th><th></th></tr></thead><tbody>` + rows.map(m => `<tr data-id="${m.id}">
    <td style="width:70px"><input type="number" id="no-${m.id}" value="${esc(m.no ?? "")}" data-f="no"></td>
    <td><input type="text" id="nm-${m.id}" value="${esc(m.name)}" data-f="name"></td>
    <td style="width:90px"><input type="text" id="ps-${m.id}" value="${esc(m.pos || "")}" data-f="pos"></td>
    <td style="width:80px"><select id="tm-${m.id}" data-f="team"><option ${m.team !== "B" ? "selected" : ""}>A</option><option ${m.team === "B" ? "selected" : ""}>B</option></select></td>
    <td style="width:118px;white-space:nowrap"><button class="btn small" data-detail="${m.id}">詳細</button> <span class="confirm"><button class="btn small" data-del="${m.id}">削除</button></span></td></tr>`).join("") + "</tbody>";
}

/* ---------- 操作 ---------- */
function pushHist(t) { const { history, ...rest } = t; t.history = [...(history || []).slice(-29), JSON.stringify(rest)]; }
function place(t, target) {
  // sel から target へ。戻り値: 交代ログ {outId,inId,pos} or null
  const get = (p) => p.kind === "slot" ? t.lineup[p.i] : p.id || null;
  const a = sel, aId = get(a), bId = target.kind === "zone" ? null : get(target);
  let log = null;
  const remove = (id) => { t.lineup = t.lineup.map(x => x === id ? null : x); t.subs = t.subs.filter(x => x !== id); };
  if (target.kind === "zone") { // 欄へ移動
    if (!aId) return null; remove(aId); if (target.zone === "sub") t.subs.push(aId); return null;
  }
  // 交代判定(試合中 / ピッチ⇄ベンチ)
  const isPitch = (p) => p.kind === "slot", isBench = (p) => p.kind === "sub";
  if (t.live && aId && bId && ((isPitch(a) && isBench(target)) || (isBench(a) && isPitch(target)))) {
    const slot = isPitch(a) ? a.i : target.i; const outId = t.lineup[slot], inId = isPitch(a) ? bId : aId;
    log = { outId, inId, pos: F[t.formation][slot][0] };
  }
  // 入れ替え
  const posOf = (id) => { const i = t.lineup.indexOf(id); if (i >= 0) return { kind: "slot", i }; if (t.subs.includes(id)) return { kind: "sub", id, idx: t.subs.indexOf(id) }; return { kind: "out" }; };
  const pa = aId ? posOf(aId) : a, pb = bId ? posOf(bId) : target;
  if (aId) remove(aId); if (bId) remove(bId);
  // remove で subs の idx がずれるのを避けるため、位置を作り直す
  const tmpSubs = [...t.subs];
  if (pa.kind === "sub" && bId) tmpSubs.splice(Math.min(pa.idx, tmpSubs.length), 0, bId);
  if (pb.kind === "sub" && aId) tmpSubs.splice(Math.min(pb.idx, tmpSubs.length), 0, aId);
  t.subs = tmpSubs;
  if (pa.kind === "slot") t.lineup[pa.i] = bId || null;
  if (pb.kind === "slot") t.lineup[pb.i] = aId || null;
  return log;
}
function onPick(p) {
  if (!sel) {
    if (p.kind === "zone") return;
    if (p.kind === "slot" && !T().lineup[p.i]) { sel = p; return render(); }
    sel = p; return render();
  }
  const same = (x, y) => x.kind === y.kind && (x.kind === "slot" ? x.i === y.i : x.id === y.id);
  if (same(sel, p)) { sel = null; return render(); }
  if (p.kind === "zone" && sel.kind === p.zone) { sel = null; return render(); }
  const t = normTeam(T(), view); pushHist(t);
  if (sel.kind === "slot" && !t.lineup[sel.i] && p.kind === "zone") { sel = null; t.history.pop(); return render(); }
  const lg = place(t, p);
  if (lg) { t.log = [...(t.log || []), { ...lg, min: window.curMinute ? curMinute(t) : ($("t-min").value === "" ? null : Number($("t-min").value)), at: new Date().toISOString() }]; $("t-min").value = ""; }
  sel = null; teams[view] = t; render(); save(t, lg ? `交代:IN ${nameOf(lg.inId)} / OUT ${nameOf(lg.outId)}` : "");
}
$("pitch").addEventListener("click", (e) => { const b = e.target.closest(".slot"); if (b) onPick({ kind: "slot", i: +b.dataset.slot }); });
["z-sub", "z-out"].forEach(z => $(z).addEventListener("click", (e) => {
  const c = e.target.closest(".chip"); if (c) return onPick({ kind: c.dataset.zone, id: c.dataset.id });
  onPick({ kind: "zone", zone: $(z).dataset.zone });
}));
$("t-form").addEventListener("change", () => {
  const t = normTeam(T(), view); pushHist(t);
  const old = t.lineup.filter(Boolean); t.formation = $("t-form").value; const n = F[t.formation].length;
  t.lineup = old.slice(0, n); while (t.lineup.length < n) t.lineup.push(null);
  t.subs = [...old.slice(n), ...t.subs]; teams[view] = t; render(); save(t, "フォーメーションを変更");
});
$("t-live").addEventListener("change", () => {
  const t = normTeam(T(), view); pushHist(t); t.live = $("t-live").checked;
  if (t.live && !t.snapshot) t.snapshot = { formation: t.formation, lineup: [...t.lineup], subs: [...t.subs] };
  teams[view] = t; render(); save(t, t.live ? "試合モード:交代を記録します" : "試合モードを終了");
});
$("t-undo").addEventListener("click", () => {
  const t = T(); const h = [...(t.history || [])]; const last = h.pop(); if (!last) return;
  const nt = { ...JSON.parse(last), history: h }; teams[view] = nt; sel = null; render(); save(nt, "ひとつ戻した");
});
$("reset-box").addEventListener("click", (e) => {
  const id = e.target.id;
  if (id === "t-reset") {
    if (!T().snapshot) { $("t-msg").textContent = "試合モードをオンにした時点のスタメンがまだありません。"; return; }
    $("reset-box").innerHTML = `交代記録を消して試合前に戻す? <button class="btn small primary" id="r-yes">戻す</button><button class="btn small" id="r-no">やめる</button>`;
  } else if (id === "r-yes") {
    const t2 = normTeam(T(), view); pushHist(t2); Object.assign(t2, t2.snapshot, { log: [], live: false, snapshot: null, events: [], clock: { st: "pre", at: null } });
    teams[view] = t2; resetBox(); render(); save(t2, "試合前のスタメンに戻した");
  } else if (id === "r-no") resetBox();
});
function resetBox() { $("reset-box").innerHTML = `<button class="btn small" id="t-reset">試合前に戻す</button>`; }
$("t-copy").addEventListener("click", async () => {
  const t = T(); const st = F[t.formation].map(([ps], i) => ({ ps, m: t.lineup[i] && mById(t.lineup[i]) })).filter(x => x.m);
  const mt = t.match || {}; const head = [mt.date ? mt.date.slice(5).replace("-", "/") : "", mt.opp ? "vs " + mt.opp : ""].filter(Boolean).join(" ");
  const txt = `【${view}チーム メンバー表】${t.formation}${head ? " " + head : ""}\n■スタメン\n` + st.map(x => `${x.ps} ${x.m.no ?? ""} ${x.m.name}`).join("\n") +
    `\n■サブ\n` + (t.subs.map(id => mById(id)).filter(Boolean).map(m => `${m.no ?? ""} ${m.name}(${m.pos || "-"})`).join("\n") || "なし") +
    ((t.log || []).length ? `\n■交代\n` + t.log.map(l => `${l.min != null ? l.min + "分 " : ""}IN ${nameOf(l.inId)} / OUT ${nameOf(l.outId)}`).join("\n") : "");
  try { await navigator.clipboard.writeText(txt); $("t-msg").textContent = "コピーした。LINEなどに貼り付けられるよ。"; }
  catch (e) { $("t-msg").innerHTML = `<textarea readonly>${esc(txt)}</textarea>`; $("t-msg").querySelector("textarea").select(); }
});
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => { view = b.dataset.v === "S" ? lastTeam : b.dataset.v; sel = null; render(); window.scrollTo({ top: 0 }); }));

/* 部員 */
$("bulk-add").addEventListener("click", async () => {
  const lines = $("bulk").value.split(/\n/).map(s => s.trim()).filter(Boolean); if (!lines.length) return;
  let n = 0;
  for (const ln of lines) {
    const p = ln.split(/[\s,、\t]+/); const name = p.shift(); let no = null, pos = "", team = "A";
    for (const x of p) { if (/^[ABab]$/.test(x)) team = x.toUpperCase(); else if (/^\d+$/.test(x) && no == null) no = +x; else if (x) pos = x.toUpperCase(); }
    const rec = { name, no, pos, team, createdAt: new Date().toISOString() };
    if (!db) { members.push({ id: "local" + Date.now() + n, ...rec }); n++; continue; }
    try { await db.collection("members").add(rec); n++; } catch (e) {}
  }
  $("bulk-msg").textContent = `${n}人追加した`; $("bulk").value = ""; if (!db) render();
});
$("m-new").addEventListener("click", async () => { if (db) await db.collection("members").add({ name: "新しい部員", no: null, pos: "", team: "A", createdAt: new Date().toISOString() }); });
$("m-table").addEventListener("change", async (e) => {
  const el = e.target; const tr = el.closest("tr"); if (!tr || !el.dataset.f || !db) return;
  let v = el.value; if (el.dataset.f === "no") v = v === "" ? null : Number(v); if (el.dataset.f === "pos") v = v.toUpperCase();
  try { await db.doc("members/" + tr.dataset.id).update({ [el.dataset.f]: v }); } catch (err) { $("m-count").textContent = "保存できなかった。もう一度入れてね。"; }
});
$("m-table").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-del]"); if (!b) return; const id = b.dataset.del; const box = b.parentElement;
  box.innerHTML = `<button class="btn small primary" data-yes="${id}">消す</button><button class="btn small" data-no>×</button>`;
});
$("m-table").addEventListener("click", async (e) => {
  const y = e.target.closest("[data-yes]"); const n = e.target.closest("[data-no]");
  if (n) return renderMembers();
  if (y && db) { try { await db.doc("members/" + y.dataset.yes).delete(); } catch (err) {} }
});

/* 保存 */
let saveTimer = {};
function save(t, msg) {
  $("t-msg").textContent = msg ? msg : "";
  if (!db) return; const key = view; clearTimeout(saveTimer[key]);
  saveTimer[key] = setTimeout(async () => {
    try { const { history, ...rest } = t; await db.doc("teams/" + key).set({ ...rest, history: (history || []).slice(-30), updatedAt: new Date().toISOString() }); }
    catch (e) { $("t-msg").textContent = "保存できなかった。通信を確認してもう一度操作してね。"; }
  }, 250);
}

/* 保存(このスマホの中) */
const KEY = "squad-board-v1";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { members: {}, teams: {} }; } catch (e) { return { members: {}, teams: {} }; } };
let store = load();
const listeners = { members: [], teams: [] };
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { $("conn").textContent = "保存できませんでした(容量不足かプライベートモードかも)。"; } };
const snap = (col) => ({ docs: Object.entries(store[col] || {}).map(([id, v]) => ({ id, data: () => v })) });
const emit = (col) => listeners[col].forEach(f => f(snap(col)));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
db = {
  collection: (col) => ({
    add: async (v) => { store[col] = store[col] || {}; store[col][uid()] = v; persist(); emit(col); },
    onSnapshot: (f) => { listeners[col].push(f); f(snap(col)); return () => {}; },
  }),
  doc: (path) => { const [col, id] = path.split("/"); return {
    set: async (v) => { store[col] = store[col] || {}; store[col][id] = v; persist(); },
    update: async (v) => { store[col] = store[col] || {}; store[col][id] = { ...(store[col][id] || {}), ...v }; persist(); emit(col); },
    delete: async () => { if (store[col]) delete store[col][id]; persist(); emit(col); },
  }; },
};
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

/* 書き出し・読み込み */
$("ex-btn").addEventListener("click", () => {
  store.meta = { ...(store.meta || {}), lastExport: new Date().toISOString() }; persist();
  let tactics = null; try { tactics = JSON.parse(localStorage.getItem("squad-tactics-v1")); } catch (e) {}
  const blob = new Blob([JSON.stringify({ app: "squad-board", v: 2, at: new Date().toISOString(), ...store, tactics }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  const d = new Date(); a.download = `スカッドボード_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`;
  document.body.append(a); a.click(); a.remove(); $("io-msg").textContent = "書き出した。ファイルを移したい端末に送ってね。"; window.backupHook && backupHook();
});
$("im-file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text()); if (!d || typeof d.members !== "object") throw 0;
    $("io-msg").innerHTML = `部員${Object.keys(d.members).length}人のデータで今の内容を置きかえる? <button class="btn small primary" id="im-yes">置きかえる</button> <button class="btn small" id="im-no">やめる</button>`;
    $("im-yes").onclick = () => {
      store = { members: d.members || {}, teams: d.teams || {}, matches: d.matches || {}, presets: d.presets || {}, opponents: d.opponents || {}, meta: { ...(d.meta || {}), lastExport: new Date().toISOString() } }; persist();
      if (d.tactics) { try { localStorage.setItem("squad-tactics-v1", JSON.stringify(d.tactics)); } catch (e) {} }
      $("io-msg").textContent = "読み込んだ。画面を読み込み直すね。"; setTimeout(() => location.reload(), 600);
    };
    $("im-no").onclick = () => { $("io-msg").textContent = ""; };
  } catch (err) { $("io-msg").textContent = "このファイルは読み込めなかった。スカッドボードで書き出したファイルを選んでね。"; }
  e.target.value = "";
});

/* 起動 */
db.collection("members").onSnapshot(s => { members = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.name); render(); });
db.collection("teams").onSnapshot(s => { s.docs.forEach(d => { if (d.id === "A" || d.id === "B") teams[d.id] = d.data(); }); render(); });
render();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
