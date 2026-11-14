/* 戦術ボード:全面ピッチ(縦)。座標はメートル(横68 × 縦105)。自チームは下から上へ攻める */
(() => {
  const W = 68, H = 105, R = 2.2, TKEY = "squad-tactics-v1";
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = { "白": "#ffffff", "黄": "#ffd23f", "赤": "#ff5a4f", "青": "#6fb3ff" };
  let st = loadT();
  let tool = "move", color = "#ffd23f", drawing = null, drag = null;

  function loadT() { try { return JSON.parse(localStorage.getItem(TKEY)) || {}; } catch (e) { return {}; } }
  function saveT() { try { localStorage.setItem(TKEY, JSON.stringify(st)); } catch (e) {} }
  const cur = () => {
    const k = st.team || "A";
    if (!st[k]) st[k] = { oppForm: "4-4-2", pos: null, lines: [], hist: [] };
    return st[k];
  };
  const teamKey = () => st.team || "A";
  const ourForm = () => (teams[teamKey()] && F[teams[teamKey()].formation]) ? teams[teamKey()].formation : "4-4-2";
  // ハーフの座標(x%, y% 0=相手ゴール側 100=自陣ゴール)→ 全面
  const toFull = (x, y, opp) => { const fx = x / 100 * W, fy = H / 2 + (y / 100) * (H / 2) * 0.98; return opp ? [W - fx, H - fy] : [fx, fy]; };
  function defaultPos() {
    const t = teams[teamKey()] ? normTeam(teams[teamKey()], teamKey()) : null;
    const our = F[ourForm()].map(([ps, x, y], i) => { const [px, py] = toFull(x, y, false); const id = t && t.lineup[i]; return { k: "o" + i, side: "our", ps, id: id || null, x: px, y: py }; });
    const opp = F[cur().oppForm].map(([ps, x, y], i) => { const [px, py] = toFull(x, y, true); return { k: "e" + i, side: "opp", ps, n: i + 1, x: px, y: py }; });
    return [...our, ...opp, { k: "ball", side: "ball", x: W / 2, y: H / 2 }];
  }
  function ensure() { const c = cur(); if (!c.pos) c.pos = defaultPos(); return c; }
  const snapshot = (c) => { c.hist = [...(c.hist || []).slice(-40), JSON.stringify({ pos: c.pos, lines: c.lines })]; };

  /* ---------- 描画 ---------- */
  function svgEl(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function drawPitch(svg) {
    svgEl("rect", { x: -4, y: -4, width: W + 8, height: H + 8, rx: 2, fill: "#2f7a45" }, svg);
    for (let i = 0; i < 10; i += 2) svgEl("rect", { x: -4, y: i * H / 10, width: W + 8, height: H / 10, fill: "#2a6f3e" }, svg);
    const g = svgEl("g", { fill: "none", stroke: "rgba(255,255,255,.8)", "stroke-width": ".3" }, svg);
    svgEl("rect", { x: 0, y: 0, width: W, height: H }, g);
    svgEl("line", { x1: 0, y1: H / 2, x2: W, y2: H / 2 }, g);
    svgEl("circle", { cx: W / 2, cy: H / 2, r: 9.15 }, g);
    svgEl("circle", { cx: W / 2, cy: H / 2, r: .4, fill: "rgba(255,255,255,.8)" }, g);
    for (const top of [true, false]) {
      const y0 = top ? 0 : H, s = top ? 1 : -1;
      svgEl("rect", { x: (W - 40.3) / 2, y: top ? 0 : H - 16.5, width: 40.3, height: 16.5 }, g);
      svgEl("rect", { x: (W - 18.3) / 2, y: top ? 0 : H - 5.5, width: 18.3, height: 5.5 }, g);
      svgEl("circle", { cx: W / 2, cy: y0 + s * 11, r: .4, fill: "rgba(255,255,255,.8)" }, g);
      const a = Math.acos(5.5 / 9.15), cy = y0 + s * 11;
      const p1 = [W / 2 - 9.15 * Math.sin(a), cy + s * 9.15 * Math.cos(a)], p2 = [W / 2 + 9.15 * Math.sin(a), cy + s * 9.15 * Math.cos(a)];
      svgEl("path", { d: `M${p1[0]},${p1[1]} A9.15,9.15 0 0,${top ? 0 : 1} ${p2[0]},${p2[1]}` }, g);
      svgEl("rect", { x: W / 2 - 3.66, y: top ? -1.5 : H, width: 7.32, height: 1.5, "stroke-width": ".4" }, g);
    }
  }
  function render() {
    const view = $("view-T"); if (!view) return;
    const c = ensure();
    $("tac-team").value = teamKey(); $("tac-opp").value = c.oppForm;
    document.querySelectorAll("#tac-tools [data-tool]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tool === tool)));
    document.querySelectorAll("#tac-colors [data-color]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.color === color)));
    $("tac-undo").disabled = !(c.hist || []).length;
    const svg = $("tac-svg"); svg.innerHTML = "";
    svgEl("defs", {}, svg).innerHTML = Object.values(COLORS).map(col => `<marker id="ah${col.slice(1)}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${col}"/></marker>`).join("");
    drawPitch(svg);
    const lg = svgEl("g", { id: "tac-lines" }, svg);
    c.lines.forEach((l, i) => drawLine(lg, l, i));
    const tg = svgEl("g", {}, svg);
    c.pos.forEach((p, i) => drawToken(tg, p, i));
    $("tac-hint").textContent = tool === "move" ? "選手やボールを指でドラッグして動かせます" : tool === "erase" ? "消したい線をタップ" : "ピッチの上をなぞって線を引きます(選手の上からでも引けます)";
  }
  function drawLine(g, l, i) {
    const common = { fill: "none", stroke: l.c, "stroke-width": l.t === "pass" ? ".55" : ".7", "stroke-linecap": "round", "stroke-linejoin": "round", "data-line": i };
    if (l.t === "pass") common["stroke-dasharray"] = "1.6 1.2";
    if (l.t !== "pen") common["marker-end"] = `url(#ah${l.c.slice(1)})`;
    const pts = l.p.map(q => q.join(",")).join(" ");
    const e = l.t === "pen" ? svgEl("polyline", { ...common, points: pts }, g) : svgEl("line", { ...common, x1: l.p[0][0], y1: l.p[0][1], x2: l.p[l.p.length - 1][0], y2: l.p[l.p.length - 1][1] }, g);
    // 当たり判定を太く
    const hit = e.cloneNode(); hit.setAttribute("stroke", "transparent"); hit.setAttribute("stroke-width", "3"); hit.removeAttribute("marker-end"); hit.removeAttribute("stroke-dasharray"); g.appendChild(hit);
  }
  function drawToken(g, p, i) {
    const tg = svgEl("g", { transform: `translate(${p.x},${p.y})`, "data-tok": i, class: "tok" }, g);
    if (p.side === "ball") {
      const bg = svgEl("g", { transform: "scale(1.6)" }, tg);
      svgEl("circle", { r: 1.25, fill: "#fff", stroke: "#111", "stroke-width": ".22" }, bg);
      svgEl("path", { d: "M0,-.55 L.52,-.17 L.32,.45 L-.32,.45 L-.52,-.17Z", fill: "#111" }, bg);
      svgEl("circle", { r: 3.8, fill: "transparent" }, tg);
      return;
    }
    const our = p.side === "our"; const m = our && p.id ? mById(p.id) : null;
    const fill = our ? (teamKey() === "A" ? "#1d5fd1" : "#d0471f") : "#222831";
    svgEl("circle", { r: R, fill: p.ps === "GK" ? (our ? "#ffd23f" : "#9be15d") : fill, stroke: "#fff", "stroke-width": ".35" }, tg);
    const num = our ? (m && m.no != null ? m.no : "") : p.n;
    const tx = svgEl("text", { y: ".8", "text-anchor": "middle", "font-size": "2.2", "font-weight": "700", fill: p.ps === "GK" ? "#111" : "#fff", "font-family": "Barlow Condensed, Arial Narrow, sans-serif" }, tg); tx.textContent = num;
    if (our) {
      const name = m ? m.name : p.ps; const lab = svgEl("text", { y: R + 2.4, "text-anchor": "middle", "font-size": "1.9", "font-weight": "700", fill: "#fff", stroke: "rgba(0,0,0,.65)", "stroke-width": ".45", "paint-order": "stroke" }, tg); lab.textContent = name.length > 6 ? name.slice(0, 6) : name;
    }
    svgEl("circle", { r: R + 1.4, fill: "transparent" }, tg); // 触りやすく
  }

  /* ---------- 操作 ---------- */
  const pt = (e) => { const svg = $("tac-svg"); const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10]; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function onDown(e) {
    const c = ensure(); const [x, y] = pt(e);
    if (tool === "move") {
      const t = e.target.closest("[data-tok]"); if (!t) return;
      snapshot(c); drag = { i: +t.dataset.tok, dx: c.pos[+t.dataset.tok].x - x, dy: c.pos[+t.dataset.tok].y - y, el: t, moved: false };
      $("tac-svg").setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (tool === "erase") {
      const l = e.target.closest("[data-line]"); if (!l) return; snapshot(c); c.lines.splice(+l.dataset.line, 1); saveT(); render(); return;
    }
    snapshot(c); drawing = { t: tool, c: color, p: [[x, y]] };
    const g = $("tac-lines"); drawing.el = null; $("tac-svg").setPointerCapture(e.pointerId); e.preventDefault();
  }
  function onMove(e) {
    if (drag) {
      const c = ensure(); const [x, y] = pt(e); const p = c.pos[drag.i];
      p.x = clamp(x + drag.dx, -3, W + 3); p.y = clamp(y + drag.dy, -3, H + 3); drag.moved = true;
      drag.el.setAttribute("transform", `translate(${p.x},${p.y})`); return;
    }
    if (drawing) {
      const [x, y] = pt(e); const last = drawing.p[drawing.p.length - 1];
      if (drawing.t === "pen") { if (Math.hypot(x - last[0], y - last[1]) < .6) return; drawing.p.push([x, y]); }
      else drawing.p = [drawing.p[0], [x, y]];
      if (drawing.el) drawing.el.remove();
      const g = $("tac-lines"); const before = g.childNodes.length; drawLine(g, drawing, -1); drawing.el = null;
      // drawLine は線と当たり判定の2要素を足すので、まとめて消せるようにする
      const added = [...g.childNodes].slice(before); drawing.el = { remove: () => added.forEach(n => n.remove()) };
    }
  }
  function onUp() {
    const c = ensure();
    if (drag) { if (!drag.moved) c.hist.pop(); drag = null; saveT(); render(); return; }
    if (drawing) {
      const ok = drawing.p.length > 1 && Math.hypot(drawing.p[drawing.p.length - 1][0] - drawing.p[0][0], drawing.p[drawing.p.length - 1][1] - drawing.p[0][1]) > 1;
      if (ok) c.lines.push({ t: drawing.t, c: drawing.c, p: drawing.p }); else c.hist.pop();
      drawing = null; saveT(); render();
    }
  }

  function init() {
    const svg = $("tac-svg"); if (!svg || svg.dataset.ready) return; svg.dataset.ready = "1";
    $("tac-opp").innerHTML = Object.keys(F).map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join("");
    svg.addEventListener("pointerdown", onDown); svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp); svg.addEventListener("pointercancel", onUp);
    $("tac-tools").addEventListener("click", (e) => { const b = e.target.closest("[data-tool]"); if (b) { tool = b.dataset.tool; render(); } });
    $("tac-colors").addEventListener("click", (e) => { const b = e.target.closest("[data-color]"); if (b) { color = b.dataset.color; if (tool === "move" || tool === "erase") tool = "arrow"; render(); } });
    $("tac-team").addEventListener("change", () => { st.team = $("tac-team").value; saveT(); render(); });
    $("tac-opp").addEventListener("change", () => { const c = ensure(); snapshot(c); c.oppForm = $("tac-opp").value; const np = defaultPos(); c.pos = c.pos.filter(p => p.side !== "opp").concat(np.filter(p => p.side === "opp")); saveT(); render(); });
    $("tac-undo").addEventListener("click", () => { const c = ensure(); const h = c.hist.pop(); if (!h) return; Object.assign(c, JSON.parse(h)); saveT(); render(); });
    $("tac-clear").addEventListener("click", () => { const c = ensure(); if (!c.lines.length) return; snapshot(c); c.lines = []; saveT(); render(); });
    $("tac-reset").addEventListener("click", () => { const c = ensure(); snapshot(c); c.pos = defaultPos(); saveT(); render(); });
  }
  window.tacticsRender = () => { init(); render(); };
})();
