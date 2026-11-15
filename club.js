/* 部(v2):紅白戦のチーム分け・書き出しのリマインド */

/* ---------- 紅白戦 ---------- */
const KH_GROUP = (pos) => { const p = String(pos || "").toUpperCase();
  if (p === "GK") return 0;
  if (/CB|SB|WB|DF|FIXO/.test(p)) return 1;
  if (/DH|CH|SH|OH|MF|ALA|AM|DM|CM/.test(p)) return 2;
  if (/FW|CF|WG|ST|PIVO/.test(p)) return 3;
  return 4; };
let khPick = null, khResult = null;
function membersHook() {
  if (!khPick) khPick = new Set(members.map((m) => m.id));
  const list = [...members].sort((a, b) => (a.team || "A").localeCompare(b.team || "A") || (a.no ?? 999) - (b.no ?? 999));
  $("kh-list").innerHTML = list.length ? list.map((m) => `<label><input type="checkbox" data-kh="${m.id}" ${khPick.has(m.id) ? "checked" : ""}>${esc(m.name)}<span class="sub">${esc(m.pos || "")}</span></label>`).join("") : '<span class="sub">部員を登録すると使えます</span>';
  $("kh-msg").textContent = `${[...khPick].filter((id) => mById(id)).length}人`;
  renderKh();
}
function renderKh() {
  $("kh-copy").hidden = !khResult;
  if (!khResult) { $("kh-out").innerHTML = ""; return; }
  const col = (lab, color, ids) => `<div class="panel" style="padding:10px;border-color:${color}"><b style="color:${color}">${lab} ${ids.length}人</b><ol>${ids.map((id) => { const m = mById(id); return m ? `<li>${esc(m.name)} <span class="sub">${esc(m.pos || "")}</span></li>` : ""; }).join("")}</ol></div>`;
  $("kh-out").innerHTML = col("ビブス", "var(--b)", khResult[0]) + col("白", "var(--a)", khResult[1]);
}
/** ポジションの種類ごとに、少ない方のチームへ交互に入れる(同じ種類の中はランダム) */
function splitTeams(ids) {
  const groups = [[], [], [], [], []];
  ids.map((id) => mById(id)).filter(Boolean).forEach((m) => groups[KH_GROUP(m.pos)].push(m.id));
  const out = [[], []]; let turn = Math.random() < 0.5 ? 0 : 1;
  groups.forEach((g) => {
    for (let i = g.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [g[i], g[j]] = [g[j], g[i]]; }
    g.forEach((id) => { const k = out[0].length === out[1].length ? turn : out[0].length < out[1].length ? 0 : 1; out[k].push(id); turn = 1 - k; });
  });
  return out;
}
$("kh-list").addEventListener("change", (e) => { const c = e.target.closest("[data-kh]"); if (!c) return; if (c.checked) khPick.add(c.dataset.kh); else khPick.delete(c.dataset.kh); $("kh-msg").textContent = `${[...khPick].filter((id) => mById(id)).length}人`; });
$("kh-all").addEventListener("click", () => { khPick = new Set(members.map((m) => m.id)); membersHook(); });
$("kh-none").addEventListener("click", () => { khPick = new Set(); membersHook(); });
$("kh-go").addEventListener("click", () => {
  const ids = [...khPick].filter((id) => mById(id));
  if (ids.length < 2) { $("kh-msg").textContent = "2人以上チェックしてね"; return; }
  khResult = splitTeams(ids); $("kh-go").textContent = "もう一度分ける"; renderKh();
});
$("kh-copy").addEventListener("click", async () => {
  if (!khResult) return;
  const txt = ["【紅白戦】", "■ビブス", ...khResult[0].map((id) => nameOf(id)), "■白", ...khResult[1].map((id) => nameOf(id))].join("\n");
  try { await navigator.clipboard.writeText(txt); $("kh-msg").textContent = "コピーした"; } catch (e) { $("kh-msg").textContent = "コピーできなかった"; }
});

/* ---------- 書き出しのリマインド ---------- */
const BACKUP_DAYS = 14, SNOOZE_DAYS = 7;
function backupHook() {
  const b = $("backup-banner"); const meta = store.meta || {};
  const hasData = Object.keys(store.members || {}).length > 0;
  const last = meta.lastExport ? Date.parse(meta.lastExport) : null, snooze = meta.snooze ? Date.parse(meta.snooze) : 0;
  const days = last ? Math.floor((Date.now() - last) / 864e5) : null;
  const show = hasData && Date.now() > snooze && (days == null || days >= BACKUP_DAYS);
  b.hidden = !show; if (!show) return;
  b.innerHTML = `<span style="flex:1;min-width:200px">${days == null ? "まだ一度もデータを書き出していないよ。" : `最後に書き出してから ${days}日たったよ。`}データはこの端末の中だけにあるので、念のため書き出しておこう。</span><button class="btn small primary" id="bk-go">書き出す</button><button class="btn small" id="bk-later">あとで</button>`;
  $("bk-go").onclick = () => $("ex-btn").click();
  $("bk-later").onclick = () => { store.meta = { ...(store.meta || {}), snooze: new Date(Date.now() + SNOOZE_DAYS * 864e5).toISOString() }; persist(); backupHook(); };
}
backupHook();
render();
