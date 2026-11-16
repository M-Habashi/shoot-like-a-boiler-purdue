/* Shoot Like a Boiler: Purdue women's basketball, 2025-26. Draws every figure from data/purdue-2025-26.json.
   Hero: light rays (Paper Shaders) and gold dust (tsParticles), both in js/vendor/. ?static shows the page with no motion. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const STATIC = /[?&]static\b/.test(location.search);              // ?static shows the finished page with no motion
  const REDUCED = STATIC || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (STATIC) document.documentElement.classList.add('static');
  const LOGO = 'img/purdue.png';
  const $ = id => document.getElementById(id);

  /* ---------- data ---------- */
  // Served over http the page fetches the JSON. Opened straight from disk, browsers block fetch,
  // so it falls back to data/fable-v2.js, the same JSON wrapped as a script by the build.
  async function loadData() {
    try {
      const r = await fetch('data/purdue-2025-26.json');
      if (r.ok) return await r.json();
    } catch (e) { /* file:// or offline: use the script copy */ }
    await new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = 'data/purdue-2025-26.js';
      s.onload = ok; s.onerror = () => fail(new Error('Could not load data/purdue-2025-26.js'));
      document.head.appendChild(s);
    });
    return window.FABLE_V2_DATA;
  }

  /* ---------- helpers ---------- */
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const f2 = v => v.toFixed(2);
  const signed = (v, d = 2) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d);
  const pct = v => Math.round(v * 100) + '%';
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function el(name, attrs, parent, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  /* CSS timing functions as lookup tables, so canvas motion matches the CSS transitions. */
  function bezier(x1, y1, x2, y2) {
    const N = 200, xs = new Float64Array(N + 1), ys = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const s = i / N, a = 3 * (1 - s) * (1 - s) * s, b = 3 * (1 - s) * s * s, c = s * s * s;
      xs[i] = a * x1 + b * x2 + c; ys[i] = a * y1 + b * y2 + c;
    }
    return t => {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      let lo = 0, hi = N;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] < t) lo = m; else hi = m; }
      const k = (t - xs[lo]) / (xs[hi] - xs[lo] || 1);
      return ys[lo] + k * (ys[hi] - ys[lo]);
    };
  }
  const EASE_OUT = bezier(0, 0, 0.58, 1), POP = bezier(0.2, 1.4, 0.4, 1);
  function canvasFor(cv, w, h, maxDpr = 3) {
    const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  const TAU = Math.PI * 2;
  function animate(dur, paint) {                      // paint(elapsed ms) every frame for dur ms, ending on the final state
    const t0 = performance.now();
    let live = true;
    const step = now => { if (!live) return; const t = now - t0; if (t >= dur) return paint(Infinity); paint(t); requestAnimationFrame(step); };
    requestAnimationFrame(step);
    return () => { live = false; };                   // stop: the caller paints whatever comes next
  }

  /* One-hue value ramp: dim pays little, bright gold pays a lot. */
  const STOPS = [[0.55, [58, 52, 42]], [0.70, [104, 89, 62]], [0.85, [146, 123, 72]], [0.95, [196, 164, 84]], [1.10, [243, 208, 104]], [1.30, [255, 249, 224]]];
  function rampRGB(v) {
    if (v <= STOPS[0][0]) return STOPS[0][1];
    for (let i = 1; i < STOPS.length; i++) {
      if (v <= STOPS[i][0]) {
        const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], t = (v - a) / (b - a);
        return ca.map((c, k) => Math.round(c + t * (cb[k] - c)));
      }
    }
    return STOPS[STOPS.length - 1][1];
  }
  const rgb = c => `rgb(${c})`;
  // Figure 1 is greyscale until a shot type is picked: the same brightness as the gold ramp, without the hue.
  const greyRGB = v => { const [r, g, b] = rampRGB(v), y = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b); return [y, y, y]; };
  function ramp(v) {
    return rgb(rampRGB(v));
  }

  /* ---------- tooltip ---------- */
  const tip = $('tip');
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight, vw = document.documentElement.clientWidth;
    let left = x + 14, top = y + 16;
    if (left + w > vw - 8) left = x - w - 14;
    if (left < 8) left = Math.max(8, Math.min(vw - w - 8, x - w / 2));
    if (top + h > innerHeight - 8) top = y - h - 14;
    tip.style.left = left + scrollX + 'px';
    tip.style.top = Math.max(8, top) + scrollY + 'px';
  }
  const hideTip = () => { tip.hidden = true; };
  addEventListener('scroll', hideTip, { passive: true });

  let D, TEAMS, courtReveal = null, stripReveal = null, stripPaints = [];

  /* ---------- text bindings ---------- */
  function bindText() {
    const R = D.ranks, C = D.crowd, O = D.others, S = O.split, M = D.method;   // comparisons use the other teams (Purdue left out)
    const values = {
      all_rank: `${ordinal(R.all.rank)} of ${D.n_teams}`, purdue_pps: f2(D.purdue_pps),
      shots_pg: Math.round(D.purdue_shots / D.purdue_games), mix_r: signed(S.mix), making_r: signed(S.making),
      gap_u: S.gap.toFixed(3), making_u: S.making.toFixed(3),
      mix_dir: `${Math.abs(S.mix).toFixed(3)} ${S.mix < 0 ? 'below' : 'above'}`,
      rim_top: `top ${R.rim.top_pct}%`, layup_top: `top ${D.layups.top_pct}%`,
      rim_rank: `${ordinal(R.rim.rank)} of ${R.rim.of}`, layup_rank: `${ordinal(D.layups.rank)} of ${D.layups.of}`,
      layup_pu: `${D.layups.purdue.made} of ${D.layups.purdue.shots} (${Math.round(D.layups.purdue.pct)}%)`, layup_oth: `${Math.round(D.layups.others.pct)}%`,
      pct_more: `${O.purdue_pct_more.toFixed(1)}%`, others_pps: f2(O.pps), others_n: O.teams,
      season_text: D.season_text, generated: D.generated, n_teams: D.n_teams, record: `${D.record.wins}-${D.record.losses}`,
      crowd_x: `${(C.median / C.national_median).toFixed(1)} times`, crowd_r: fmt(Math.round(C.median / 100) * 100), typ_r: fmt(Math.round(C.national_median / 100) * 100),
      shots_all: fmt(D.shots_all), purdue_shots: fmt(D.purdue_shots), purdue_games: D.purdue_games, rim_feet: D.rim_feet,
      min_cell: O.map.min_shots_drawn,
      rim_b10: `${ordinal(R.rim.big_ten_rank)} of ${R.rim.big_ten_of}`, three_b10: `${ordinal(R.three.big_ten_rank)} of ${R.three.big_ten_of}`,
      all_b10: `${ordinal(R.all.big_ten_rank)} of ${R.all.big_ten_of}`, mid_rank: `${ordinal(R.mid.rank)} of ${R.mid.of}`,
      rim_moe: f2(R.rim.pm_2se), three_moe: f2(R.three.pm_2se),
      rim_range: `${ordinal(R.rim.rank_range_2se[0])} to ${ordinal(R.rim.rank_range_2se[1])}`,
      three_range: `${ordinal(R.three.rank_range_2se[0])} to ${ordinal(R.three.rank_range_2se[1])}`,
      making: signed(S.making, 3), mix: signed(S.mix, 3), gap: signed(S.gap, 3),
      making_rank: `${ordinal(R.making.rank)} of ${R.making.of}`, per_game: (S.making * D.purdue_shots / D.purdue_games).toFixed(1),
      crowd_median: fmt(C.median), crowd_typical: fmt(C.national_median), crowd_rank: `${ordinal(C.rank)} of ${C.of}`,
      crowd_games: C.games_counted, crowd_home: C.home_games, crowd_min: C.min_games, crowd_of: C.of,
      // Calculation methods (D.method comes from analysis/fable-v2_page_method.py)
      fga_events: fmt(M.fga_events), pbp_games: fmt(M.pbp_games), drop_team: M.drop_team_not_in_game, drop_two: M.drop_two_beyond_24ft,
      drop_three: M.drop_three_inside_21ft, unlisted_shots: fmt(M.unlisted_shots), unlisted_teams: M.unlisted_teams,
      others_shots: fmt(O.shots), layup_odd: D.layups.left_out_three_point_layup_labels.shots,
      three_rank: `${ordinal(R.three.rank)} of ${R.three.of}`, all_moe: f2(R.all.pm_2se), b10_of: R.all.big_ten_of,
      all_range: `${ordinal(R.all.rank_range_2se[0])} to ${ordinal(R.all.rank_range_2se[1])}`,
      chk_rim4: ordinal(M.rank_all_rim_4ft), chk_rim6: ordinal(M.rank_all_rim_6ft), chk_reg: ordinal(M.rank_all_regular_season),
      chk_box: ordinal(M.rank_all_box_matched), rim_lo: D.rim_feet - 1, rim_hi: D.rim_feet + 1,
    };
    document.querySelectorAll('[data-bind]').forEach(n => {
      const k = n.dataset.bind;
      if (!(k in values)) throw new Error('No value for ' + k);
      n.textContent = values[k];
    });
  }

  /* ---------- rank stamps: each Purdue rank sits in the figure it describes ---------- */
  const rankNum = n => `<span class="count" data-to="${n}">${n}</span><sup>${ordinal(n).slice(-2)}</sup>`;
  function buildRanks() {
    const R = D.ranks, C = D.crowd;
    [['rank3', R.making, 'Making shots', 'at making shots'], ['rank4', C, 'Home crowd size', 'for crowd size']].forEach(([id, it, label, what]) => {
      const host = $(id);
      host.innerHTML = `<span class="rank-n">${rankNum(it.rank)}</span><span class="rank-of">of <span class="num">${it.of}</span> teams ${what}</span><span class="rank-top">Top ${it.top_pct}%</span>`;
      host.setAttribute('aria-label', `${label}: ${ordinal(it.rank)} of ${it.of} teams, top ${it.top_pct} percent`);
    });
  }
  function countUp(root) {
    if (REDUCED) return;
    root.querySelectorAll('.count').forEach(n => {
      const to = +n.dataset.to, from = Math.min(361, to * 6), t0 = performance.now(), dur = 1100;
      const step = now => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        n.textContent = Math.round(from + (to - from) * e);
        if (k < 1) requestAnimationFrame(step);
      };
      n.textContent = from;
      requestAnimationFrame(step);
    });
  }

  /* ---------- figure 1: value court (feet; hoop at x 25, y 0; baseline at y -5.25) ---------- */
  const zoneOf = (x, y, n, n3) => (n3 * 2 > n ? 'three' : Math.hypot(x - 25, y) < D.rim_feet ? 'rim' : 'mid');
  const ZLABEL = { rim: 'At the rim', three: 'Threes', mid: 'In between' };
  const zoneSub = z => ({ rim: `within ${D.rim_feet} feet`, three: '3-pointers', mid: 'other 2-pointers' }[z]);
  function drawCourt() {
    const host = $('court'), W = host.clientWidth, cells = D.others.map.cells;   // other teams' shots, Purdue's left out
    const yEnd = Math.max(...cells.map(c => c[1])) + 1.4, pad = 2, s = (W - 2 * pad) / 51.4;
    const X = ft => pad + (ft + 0.7) * s, Y = ft => pad + (ft + 5.25 + 0.4) * s, H = Math.round(Y(yEnd) + pad);
    host.textContent = '';
    host.setAttribute('aria-label', `Half-court map of ${fmt(D.others.shots)} shots by the other ${D.others.teams} teams. Shots at the rim score the most points per shot, threes come next, and two-pointers in between score the least.`);
    // dots draw on three canvases, one per zone (a zone highlight is one composited opacity change), under the lines
    const layers = {};
    for (const z of ['rim', 'three', 'mid']) {
      const cv = document.createElement('canvas');
      cv.className = 'cv cv-z'; cv.dataset.z = z; cv.setAttribute('aria-hidden', 'true');
      host.appendChild(cv);
      layers[z] = canvasFor(cv, W, H);
    }
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' }, host);
    const at = new Map(), byZone = { rim: [], three: [], mid: [] };
    let last = 0;
    for (const [x, y, n, pts, n3] of cells) {
      at.set(x + ',' + y, [x, y, n, pts]);
      const d = Math.round(Math.hypot(x - 25, y) * 30);
      last = Math.max(last, d);
      const ga = greyRGB(pts / n), ya = rampRGB(pts / n);
      byZone[zoneOf(x, y, n, n3)].push({ cx: +X(x).toFixed(1), cy: +Y(y).toFixed(1), r: +(s * 0.47 * Math.max(0.42, Math.min(1, Math.sqrt(n / 300)))).toFixed(2),
        ga, ya, g: rgb(ga), y: rgb(ya), d });
    }
    // A picked zone turns gold in a quick sweep from its nearest dot outward (TINT_STEP ms per foot, TINT_DOT ms per dot).
    const tintDur = {};
    for (const z in byZone) {
      const d0 = Math.min(...byZone[z].map(p => p.d));
      byZone[z].forEach(p => { p.d0 = (p.d - d0) / 30 * TINT_STEP; });
      tintDur[z] = Math.max(...byZone[z].map(p => p.d0)) + TINT_DOT;
    }
    // reveal per dot: opacity 0 to 1 over .5s ease-out, scale .2 to 1 over .6s with overshoot, delayed by distance
    const paintZone = (z, t) => {
      const ctx = layers[z], gold = zoneSel === z;
      ctx.clearRect(0, 0, W, H);
      for (const p of byZone[z]) {
        const k = t - p.d;
        if (k <= 0) continue;
        const sc = 0.2 + 0.8 * POP(Math.min(1, k / 600));
        ctx.globalAlpha = EASE_OUT(k / 500); ctx.fillStyle = gold ? p.y : p.g;
        ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r * sc, 0, TAU); ctx.fill();
      }
    };
    // grey to gold (on) or back (off); on the way to gold each dot swells a little and settles
    const paintTint = (z, t, on) => {
      const ctx = layers[z];
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      for (const p of byZone[z]) {
        const u = Math.max(0, Math.min(1, (t - (on ? p.d0 : 0)) / TINT_DOT)), e = EASE_OUT(u), m = on ? e : 1 - e;
        ctx.fillStyle = m <= 0 ? p.g : m >= 1 ? p.y : `rgb(${p.ga.map((c, i) => Math.round(c + m * (p.ya[i] - c)))})`;
        const sc = on ? 1 + 0.35 * Math.sin(Math.PI * u) : 1;
        ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r * sc, 0, TAU); ctx.fill();
      }
    };
    stopCourt();
    courtReveal = { paintZone, paintTint, tintDur, offDur: TINT_DOT, dur: last + 600, paint: t => ZONES.forEach(z => paintZone(z, t)) };
    if (REDUCED || $('fig1').classList.contains('in')) courtReveal.paint(Infinity);
    const d = [
      `M${X(0)} ${Y(yEnd)}V${Y(-5.25)}H${X(50)}V${Y(yEnd)}`, `M${X(19)} ${Y(-5.25)}V${Y(13.75)}H${X(31)}V${Y(-5.25)}`,
      `M${X(19)} ${Y(13.75)}A${6 * s} ${6 * s} 0 0 0 ${X(31)} ${Y(13.75)}`, `M${X(21)} ${Y(0)}A${4 * s} ${4 * s} 0 0 0 ${X(29)} ${Y(0)}`,
      `M${X(3.344)} ${Y(-5.25)}V${Y(4.63)}A${22.146 * s} ${22.146 * s} 0 0 0 ${X(46.656)} ${Y(4.63)}V${Y(-5.25)}`, `M${X(22)} ${Y(-1.25)}H${X(28)}`,
    ].join('');
    el('path', { class: 'court-line', d }, svg);
    el('circle', { class: 'hoop', cx: X(25), cy: Y(0), r: Math.max(2.2, 0.75 * s) }, svg);
    // Purdue's edge in the picked zone: a label inside that zone (the rim's sits to the side, with a line to the hoop)
    const edge = el('g', { class: 'edge' }, svg), small = W < 520, ew = small ? 132 : 156, eh = small ? 42 : 48;
    courtReveal.showEdge = z => {
      edge.textContent = '';
      if (!z) return;
      const pu = D.zones[z].purdue, ot = D.others.zones[z].pps, gap = pu - ot, [fx, fy] = EDGE_AT[z];
      let cx = X(fx);
      if (z === 'rim') cx = Math.max(cx, X(25) + (D.rim_feet + 0.8) * s + ew / 2);
      cx = Math.max(pad + ew / 2 + 2, Math.min(W - pad - ew / 2 - 2, cx));
      const cy = Math.min(Y(fy), H - pad - eh / 2 - 2);
      if (z === 'rim') el('line', { class: 'edge-lead', x1: cx - ew / 2, y1: cy, x2: X(25) + 0.9 * s, y2: Y(0) }, edge);
      const g = el('g', { class: 'edge-card' }, edge);
      el('rect', { x: cx - ew / 2, y: cy - eh / 2, width: ew, height: eh, rx: 9 }, g);
      const n = el('text', { class: 'edge-n', x: cx, y: cy + (small ? -2 : -3), 'text-anchor': 'middle' }, g, '+' + gap.toFixed(2));
      const sub = el('text', { class: 'edge-sub', x: cx, y: cy + (small ? 13 : 15), 'text-anchor': 'middle' }, g, 'Purdue ');
      el('tspan', { class: 'num edge-pu' }, sub, f2(pu));
      sub.appendChild(document.createTextNode(' · Others '));
      el('tspan', { class: 'num' }, sub, f2(ot));
      if (REDUCED) return;
      const t0 = performance.now(), count = now => {              // the edge counts up from +0.00 while the card pops in
        if (!n.isConnected) return;
        const k = Math.min(1, (now - t0 - 100) / 450);
        n.textContent = '+' + (gap * EASE_OUT(Math.max(0, k))).toFixed(2);
        if (k < 1) requestAnimationFrame(count);
      };
      n.textContent = '+0.00';
      requestAnimationFrame(count);
    };
    const ring =el('circle', { class: 'cursor', r: 0.62 * s, visibility: 'hidden' }, svg);
    const move = e => {
      const r = svg.getBoundingClientRect(), k = W / r.width;
      const x = Math.round(((e.clientX - r.left) * k - pad) / s - 0.7), y = Math.round(((e.clientY - r.top) * k - pad) / s - 5.65);
      const c = at.get(x + ',' + y);
      if (!c) { ring.setAttribute('visibility', 'hidden'); return hideTip(); }
      ring.setAttribute('cx', X(x)); ring.setAttribute('cy', Y(y)); ring.setAttribute('visibility', 'visible');
      const ft = Math.round(Math.hypot(x - 25, y));
      showTip(`<strong>${ft ? `<span class="num">${ft}</span> ft from the hoop` : 'At the hoop'}</strong><span><em>${f2(c[3] / c[2])}</em> points per shot, other teams · <span class="num">${fmt(c[2])}</span> shots</span>`, e.clientX, e.clientY);
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', () => { ring.setAttribute('visibility', 'hidden'); hideTip(); });
    if (zoneSel) courtReveal.showEdge(zoneSel);            // a redraw (resize) keeps the picked zone's label
  }
  /* Court dot animations, one per zone, so a selected zone can replay while the others keep their state. */
  const ZONES = ['rim', 'three', 'mid'];
  const TINT_STEP = 18, TINT_DOT = 240;                  // gold sweep: ms per foot from the zone's nearest dot, ms per dot
  const EDGE_AT = { rim: [38, 1.5], mid: [25, 14], three: [6.5, 27.5] };   // edge label centers, in court feet
  const courtAnims = {};
  function stopCourt() { for (const z in courtAnims) courtAnims[z](); }
  function playCourt() {                               // the first reveal, all zones together, timed by distance from the hoop
    stopCourt();
    ZONES.forEach(z => { courtAnims[z] = animate(courtReveal.dur, t => courtReveal.paintZone(z, t)); });
  }
  function tintZone(z, on) {                           // a picked zone sweeps to gold; a dropped one fades back to grey
    if (courtAnims[z]) courtAnims[z]();
    if (REDUCED) return courtReveal.paintZone(z, Infinity);
    courtAnims[z] = animate(on ? courtReveal.tintDur[z] : courtReveal.offDur, t => courtReveal.paintTint(z, t, on));
  }

  /* Zone toggles: a tap or click picks one shot type (gold on the court, with Purdue's edge); the same tap again shows all,
     as does Escape. Click only (no hover or focus effects), so a phone tap behaves exactly like a mouse click.
     Only styles change on a pick: nothing around the cards changes size, so the cards never move. */
  const HINT_ALL = 'Tap a shot type to compare.', HINT_ONE = 'Tap it again to show all.';   // short: one line even at 320 px
  let zoneSel = null;
  function setZone(z) {
    const prev = zoneSel;
    zoneSel = z;
    const fig = $('fig1'), host = $('zones');
    ZONES.forEach(k => fig.classList.toggle('hl-' + k, k === z));
    host.classList.toggle('has-sel', !!z);
    host.querySelectorAll('.zone').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.z === z)));
    $('zoneHint').textContent = z ? HINT_ONE : HINT_ALL;
    if (!courtReveal) return;
    if (prev && prev !== z) tintZone(prev, false);
    if (z && z !== prev) tintZone(z, true);
    courtReveal.showEdge(z);
  }
  function buildZones() {
    const host = $('zones');
    ZONES.forEach(z => {
      const v = D.zones[z], o = D.others.zones[z].pps, b = document.createElement('button');
      b.type = 'button'; b.className = 'zone'; b.dataset.z = z;
      b.setAttribute('aria-pressed', 'false');
      b.style.setProperty('--zc', rgb(greyRGB(o))); b.style.setProperty('--zg', ramp(o));
      b.innerHTML = `<span class="zone-head"><span class="zone-name"><i></i>${ZLABEL[z]}</span><span class="zone-sub">${zoneSub(z)}</span></span>` +
        `<span class="zone-cmp"><span class="cmp pu"><span class="cmp-label"><img src="${LOGO}" alt="">Purdue</span><span class="cmp-n">${f2(v.purdue)}</span></span>` +
        `<span class="cmp all"><span class="cmp-label">Other teams</span><span class="cmp-n">${f2(o)}</span></span></span>`;
      b.setAttribute('aria-label', `${ZLABEL[z]}: ${f2(v.purdue)} points per shot for Purdue, ${f2(o)} for other teams. Shows only these shots on the court.`);
      b.addEventListener('click', () => setZone(zoneSel === z ? null : z));
      host.appendChild(b);
    });
    $('fig1').addEventListener('keydown', e => { if (e.key === 'Escape' && zoneSel) setZone(null); });
    setZone(null);
    const lo = 0.6, hi = 1.3;
    $('ramp').style.background = `linear-gradient(90deg, ${Array.from({ length: 15 }, (_, i) => rgb(greyRGB(lo + (i * (hi - lo)) / 14))).join(',')})`;
    $('rampTicks').innerHTML = [0.6, 0.8, 1.0, 1.2].map(v => `<span style="left:${((v - lo) / (hi - lo)) * 100}%">${v.toFixed(1)}</span>`).join('');
  }

  /* ---------- figure 2: rank strips ---------- */
  const STRIPS = [['rim', 'At the rim'], ['three', 'Threes'], ['all', 'All shots']];
  function swarm(values, X, r) {                                       // simple beeswarm: each dot takes the free slot nearest the center line
    const placed = [], out = new Array(values.length);
    let from = 0;                                                      // placed is sorted by x, so the dots near x are a suffix
    values.map((v, i) => [X(v), i]).sort((a, b) => a[0] - b[0]).forEach(([x, i]) => {
      while (from < placed.length && !(x - placed[from][0] < 2 * r)) from++;
      const near = placed.slice(from);
      let y = 0;
      for (let k = 0; k < 40; k++) {
        const cand = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * r * 0.9;
        if (near.every(p => Math.hypot(x - p[0], cand - p[1]) >= 2 * r - 0.1)) { y = cand; break; }
      }
      placed.push([x, y]); out[i] = [x, y];
    });
    return out;
  }
  function drawStrips() {
    const host = $('strips'), W = host.clientWidth, small = W < 560;
    host.textContent = '';
    stripPaints = [];
    host.setAttribute('aria-label', `Points per shot, rank among ${D.n_teams} teams (1 is best): ` +
      STRIPS.map(([k, label]) => `${label.toLowerCase()}, Purdue ${ordinal(D.ranks[k].rank)}, top ${D.ranks[k].top_pct} percent`).join('; ') + '.');
    STRIPS.forEach(([key, label], row) => {
      const R = D.ranks[key], col = TEAMS.columns.indexOf(key), vals = TEAMS.rows.map(t => t[col]);
      const sorted = [...vals].sort((a, b) => b - a), cut = sorted[Math.ceil(vals.length / 4) - 1];
      const lo = sorted[Math.floor(sorted.length * 0.995)], hi = sorted[0];
      const m = { l: 8, r: small ? 14 : 22 }, H = small ? 92 : 104, mid = H / 2 + 6, r = small ? 2.4 : 3;
      const X = v => m.l + Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * (W - m.l - m.r);
      const wrap = document.createElement('div');
      wrap.className = 'strip';
      wrap.innerHTML = `<div class="strip-head"><span class="strip-label">${label}</span>` +
        `<span class="strip-rank"><b>${rankNum(R.rank)}</b><span>of <span class="num">${R.of}</span><em>Top ${R.top_pct}%</em></span></span></div>`;
      host.appendChild(wrap);
      const plot = document.createElement('div');
      plot.className = 'strip-plot';
      wrap.appendChild(plot);
      const back = el('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' }, plot);
      const cv = document.createElement('canvas');
      cv.className = 'cv'; cv.setAttribute('aria-hidden', 'true');
      plot.appendChild(cv);
      const ctx = canvasFor(cv, W, H);
      const svg = el('svg', { class: 'front', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' }, plot);
      el('rect', { class: 'band', x: X(cut), y: 4, width: X(hi) + r + 4 - X(cut), height: H - 8, rx: 8 }, back);
      el('text', { class: 'band-label', x: X(cut) + 9, y: 19 }, back, 'Top 25%');
      el('line', { class: 'median', x1: X(R.median), x2: X(R.median), y1: 10, y2: H - 6 }, back);
      if (!small) el('text', { class: 'median-label', x: X(R.median) - 5, y: 18, 'text-anchor': 'end' }, back, 'Typical team');
      const pos = swarm(vals, X, r), sdots = [];
      TEAMS.rows.forEach((t, i) => {
        if (t[0] === D.purdue_id) return;
        const b10 = t[2] === 'Big Ten';
        sdots.push({ cx: +pos[i][0].toFixed(1), cy: +(mid + pos[i][1]).toFixed(1), fill: b10 ? '#d9cfb6' : '#8d8572', a: b10 ? 0.9 : 0.62,
          d: Math.round((pos[i][0] / W) * 900 + row * 150) });
      });
      // reveal per dot: fade to .62 (Big Ten .9) over .5s ease-out, sweeping left to right
      stripPaints.push(tt => {
        ctx.clearRect(0, 0, W, H);
        for (const p of sdots) {
          const k = tt - p.d;
          if (k <= 0) continue;
          ctx.globalAlpha = p.a * EASE_OUT(k / 500); ctx.fillStyle = p.fill;
          ctx.beginPath(); ctx.arc(p.cx, p.cy, r, 0, TAU); ctx.fill();
        }
      });
      const pi = TEAMS.rows.findIndex(t => t[0] === D.purdue_id), px = X(vals[pi]), PR = small ? 14 : 17;
      const pg = el('g', { class: 'pmark', style: `--d:${1000 + row * 200}ms` }, svg);
      const ring = document.createElement('i');                      // the pulse ring: stroke 2 on radius PR + 3
      ring.className = 'pu-ring';
      Object.assign(ring.style, { left: `${px - PR - 4}px`, top: `${mid - PR - 4}px`, width: `${2 * PR + 8}px`, height: `${2 * PR + 8}px` });
      plot.insertBefore(ring, svg);
      el('circle', { class: 'pu-chip', cx: px, cy: mid, r: PR + 2 }, pg);
      el('image', { href: LOGO, x: px - PR * 0.8, y: mid - PR * 0.8, width: PR * 1.6, height: PR * 1.6 }, pg);
      svg.addEventListener('pointermove', e => {
        const b = svg.getBoundingClientRect(), k = W / b.width, mx = (e.clientX - b.left) * k, my = (e.clientY - b.top) * k;
        let best = -1, bd = 14;
        pos.forEach((p, i) => { const dd = Math.hypot(p[0] - mx, mid + p[1] - my) - (i === pi ? PR : 0); if (dd < bd) { bd = dd; best = i; } });
        if (best < 0) return hideTip();
        const t = TEAMS.rows[best], rk = t[TEAMS.columns.indexOf('rank_' + key)];   // exact rank from the analysis, not from rounded values
        showTip(`<strong>${esc(t[1])}</strong><span>${label}: <em>${f2(t[col])}</em> points per shot<br><span class="num">${ordinal(rk)} of ${vals.length}</span> · ${esc(t[2])}</span>`, e.clientX, e.clientY);
      });
      svg.addEventListener('pointerleave', hideTip);
    });
    stripReveal = { paint: t => stripPaints.forEach(f => f(t)), dur: 900 + 2 * 150 + 500 };
    if (REDUCED || $('fig2').classList.contains('in')) stripReveal.paint(Infinity);
    const key = document.createElement('p');
    key.className = 'strip-key';
    key.innerHTML = '<span><i class="k-line"></i>typical team (middle of <span class="num">' + D.n_teams + '</span>)</span><span><i class="k-dot"></i>one team</span><span><i class="k-dot b10"></i>Big Ten team</span><span><img src="' + LOGO + '" alt="">Purdue</span>';
    host.appendChild(key);
  }

  /* ---------- figure 3: how many of every 100 shots went in, Purdue next to the other teams ---------- */
  function drawSplit() {
    const host = $('split'), W = host.clientWidth, small = W < 560, Z = D.zones, O = D.others.zones, S = D.others.split;
    const per100 = v => v * 100, order = ['rim', 'three', 'mid'];
    host.textContent = '';
    host.setAttribute('aria-label', 'Shots made out of every 100: ' +
      order.map(z => `${ZLABEL[z].toLowerCase()}, Purdue ${Math.round(per100(Z[z].purdue_made))}, other teams ${Math.round(per100(O[z].made))}`).join('; ') + '.');
    const key = document.createElement('p');
    key.className = 'split-key';
    key.innerHTML = '<span>Shots made out of every <span class="num">100</span>:</span><span><i class="k-pu"></i>Purdue</span><span><i class="k-all"></i>Other teams</span>';
    host.appendChild(key);
    const lw = small ? 0 : 120, m = { l: small ? 4 : lw + 16, r: 40 }, bh = small ? 16 : 18, gap = 4;
    const lab = small ? 24 : 0, rowH = lab + 2 * bh + gap + (small ? 20 : 24), top = 6, H = top + order.length * rowH + 20;
    const max = 70, X = v => m.l + (v / max) * (W - m.l - m.r);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' }, host);
    [20, 40, 60].forEach(v => {
      el('line', { class: 'grid', x1: X(v), x2: X(v), y1: top, y2: H - 20 }, svg);
      el('text', { class: 'axis-text', x: X(v), y: H - 4, 'text-anchor': 'middle' }, svg, v);
    });
    order.forEach((z, i) => {
      const y0 = top + i * rowH + lab;
      el('text', { class: 'row-label halo', x: small ? 4 : lw, y: small ? y0 - 8 : y0 + bh + gap / 2 + 5, 'text-anchor': small ? 'start' : 'end' }, svg, ZLABEL[z]);
      [['make', Z[z].purdue_made], ['avg', O[z].made]].forEach(([cls, v], j) => {
        const y = y0 + j * (bh + gap), x1 = X(per100(v));
        el('rect', { class: 'bar ' + cls, x: X(0), y, width: Math.max(2, x1 - X(0)), height: bh, rx: 3, style: `--d:${250 + i * 300 + j * 120}ms` }, svg);
        el('text', { class: 'bar-val ' + cls, x: x1 + 7, y: y + bh / 2 + 6 }, svg, Math.round(per100(v)));
      });
    });
    el('line', { class: 'zero', x1: X(0), x2: X(0), y1: top - 2, y2: H - 20 }, svg);
    const sum = document.createElement('p');
    sum.className = 'split-sum';
    sum.innerHTML = `<img src="${LOGO}" alt=""><span>Purdue shot from about the same spots as other teams and made more of those shots. ` +
      `That was worth about <b>${(S.making * D.purdue_shots / D.purdue_games).toFixed(1)} points a game</b>.</span>`;
    host.appendChild(sum);
  }

  /* ---------- figure 4: home crowd ---------- */
  function drawCrowd() {
    const host = $('crowd'), W = host.clientWidth, C = D.crowd, PER = 250;
    host.textContent = '';
    host.setAttribute('aria-label', `Fans at a typical home game: Purdue ${fmt(C.median)}, typical team ${fmt(C.national_median)}, about ${(C.median / C.national_median).toFixed(1)} times as many. Purdue ranks ${ordinal(C.rank)} of ${C.of}.`);
    const rows = [
      { who: 'Purdue', n: C.median, cls: 'pu', logo: true },
      { who: 'Typical team', n: C.national_median, cls: 'typ' },
    ];
    rows.forEach(r => {
      const line = document.createElement('div');
      line.className = 'crowd-row ' + r.cls;
      const full = Math.floor(r.n / PER), part = r.n / PER - full;
      let icons = '';
      for (let i = 0; i <= full; i++) {
        const w = i < full ? 1 : part;
        if (w <= 0.02) continue;
        icons += `<svg class="fan" style="--d:${i * 45}ms;--w:${(w * 100).toFixed(0)}%" viewBox="0 0 20 28" aria-hidden="true"><use href="#fan"/></svg>`;
      }
      line.innerHTML = `<span class="crowd-who">${r.logo ? `<img src="${LOGO}" alt="">` : ''}${r.who}</span><span class="fans">${icons}</span><span class="crowd-n">${fmt(r.n)}</span>`;
      host.appendChild(line);
    });
    const key = document.createElement('p');
    key.className = 'foot';
    key.innerHTML = `Each icon is <span class="num">${PER}</span> fans at a typical home game.`;
    host.appendChild(key);
  }

  /* ---------- hero: the scene, held in place, with slow light rays and gold dust ----------
     Coordinates are pixels of img/hero.webp (1536 x 1024; rim center measured at 1024, 337). The photo is placed
     with one static transform, so the hoop stays put at every width and nothing in the hero moves when the page scrolls. */
  const PHOTO = { w: 1536, h: 1024, rim: [1024, 337], light: [940, -40] };   // light: where the photo's spotlight shafts start
  // Light rays: Paper Shaders' God Rays (js/vendor/paper-rays.js, Apache-2.0) on a clear background, fanning down from the
  // spotlight. The library stops drawing while the hero is off screen or the tab is hidden; reduced motion gets one still frame.
  const RAYS = {
    colors: ['#ffd75e', '#ceb888', '#fff2c4'], alpha: [0.3, 0.24, 0.16], bloomColor: '#ffd75e', bloom: 0.25,
    density: 0.22, spotty: 0.22, midSize: 0.12, midIntensity: 0.2, intensity: 0.55,
    unit: 700,          // photo pixels per unit of ray radius, so the rays keep their size against the photo at every width
    speed: 0.25, frame: 9000, maxPixels: 1280 * 720,
  };
  // Dust: tsParticles (js/vendor/tsparticles-dust.js, MIT). A few gold specks drift slowly up and twinkle; a mask in style.css
  // keeps them brightest in the spotlight. The library stops drawing while the tab is hidden, and an observer here pauses it
  // while the hero is off screen (version 4.4 accepts pauseOnOutsideViewport but does not act on it). Reduced motion gets
  // one still frame.
  const DUST = {
    colors: ['#ffd75e', '#ceb888', '#fff2c4'],
    count: 90, per: [1440, 800], min: 26,  // specks per 1440 x 800 CSS pixels of hero, and never fewer than 26 (phones)
    size: { min: 0.7, max: 2.3 }, opacity: { min: 0.15, max: 0.95 }, twinkle: 0.6,
    speed: { min: 0.16, max: 0.56 },       // CSS pixels per 60 fps frame: about 10 to 34 pixels a second
    fps: 24,                               // slow drift (under a pixel a frame) looks smooth at 24 frames a second and costs less
  };
  let heroView = null, rays = null;
  function layoutHero() {
    const stage = $('heroStage'), W = stage.clientWidth, H = stage.clientHeight;
    let s, ix0, iy0;
    if (W >= 900) {                                     // desktop: photo pinned to the right edge, title on the dark left
      s = Math.max((H / PHOTO.h) * 0.88, W / 2200);
      ix0 = PHOTO.w - W / s; iy0 = 0;
    } else {                                            // phones and tablets: cropped around the hoop, title below
      s = Math.min(W / 680, H / 760);
      ix0 = Math.min(PHOTO.w - W / s, PHOTO.rim[0] - (0.62 * W) / s);
      iy0 = Math.max(0, PHOTO.rim[1] - (0.44 * H) / s);
    }
    $('heroPhoto').style.transform = `translate(${(-ix0 * s).toFixed(2)}px, ${(-iy0 * s).toFixed(2)}px) scale(${s.toFixed(5)})`;
    heroView = { s, ix0, iy0, W, H };
    aimRays();
  }
  // The shader centers its rays at offset x min(width, height) from the middle of its canvas, which covers the stage.
  function aimRays() {
    if (!heroView) return;
    const { s, ix0, iy0, W, H } = heroView, m = Math.min(W, H), lx = (PHOTO.light[0] - ix0) * s, ly = (PHOTO.light[1] - iy0) * s;
    const scene = $('heroScene');                       // rays and dust fade with distance from the light (style.css)
    scene.style.setProperty('--lx', lx.toFixed(0) + 'px');
    scene.style.setProperty('--ly', ly.toFixed(0) + 'px');
    if (rays) rays.setUniforms({ u_offsetX: (lx - W / 2) / m, u_offsetY: (ly - H / 2) / m, u_scale: (RAYS.unit * s) / m });
  }
  // Version 5's title moment without the shots: "shoot" swells and glows gold once.
  function lightTitle() {
    const band = $('heroBand');
    if (REDUCED) { band.classList.remove('pre'); return; }
    const anims = [], A = (node, kf, opt) => { const a = node.animate(kf, { fill: 'both', ...opt }); anims.push(a); return a; };
    const shoot = document.querySelector('.h1-b'), t = 500;
    A(shoot, [{ transform: 'none' }, { transform: 'scale(1.04)', offset: 0.3 }, { transform: 'none' }], { duration: 650, delay: t, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'none' });
    A(shoot, [{ opacity: 0 }, { opacity: 0.9, offset: 0.25 }, { opacity: 0 }], { duration: 1400, delay: t, pseudoElement: '::after', fill: 'none' });
    band.classList.remove('pre');
    // every end state equals the plain CSS, so release the animations when they finish
    Promise.all(anims.map(a => a.finished)).then(() => anims.forEach(a => a.cancel())).catch(() => {});
  }
  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }
  async function startRays() {
    if (!('WebGL2RenderingContext' in window)) return;
    try {
      await loadScript('js/vendor/paper-rays.js');
      const P = window.PaperRays, noise = P.getShaderNoiseTexture(), c = P.getShaderColorFromString, host = $('heroRays');
      await noise.decode();
      rays = new P.ShaderMount(host, P.godRaysFragmentShader, {
        u_colorBack: [0, 0, 0, 0], u_colorBloom: c(RAYS.bloomColor), u_bloom: RAYS.bloom,
        u_colors: RAYS.colors.map((h, i) => { const v = c(h); v[3] = RAYS.alpha[i]; return v; }), u_colorsCount: RAYS.colors.length,
        u_density: RAYS.density, u_spotty: RAYS.spotty, u_midSize: RAYS.midSize, u_midIntensity: RAYS.midIntensity, u_intensity: RAYS.intensity,
        u_noiseTexture: noise,
        u_fit: P.ShaderFitOptions.contain, u_scale: 1, u_rotation: 0, u_originX: 0.5, u_originY: 0.5,
        u_offsetX: 0, u_offsetY: 0, u_worldWidth: 0, u_worldHeight: 0,
      }, undefined, REDUCED ? 0 : RAYS.speed, RAYS.frame, 1, RAYS.maxPixels);
      aimRays();
      requestAnimationFrame(() => host.classList.add('on'));
    } catch (e) { /* no WebGL 2, or the script did not load: the photo alone */ }
  }
  async function startDust() {
    const host = $('heroDust');
    try {
      await loadScript('js/vendor/tsparticles-dust.js');
      const { tsParticles, loadBasic } = window.TsDust;
      await loadBasic(tsParticles);
      const count = Math.round(Math.max(DUST.min, DUST.count * (host.clientWidth * host.clientHeight) / (DUST.per[0] * DUST.per[1])));
      const dust = await tsParticles.load({ id: 'heroDustCanvas', element: host, options: {
        fullScreen: { enable: false }, background: { color: 'transparent' }, detectRetina: true, fpsLimit: DUST.fps,
        pauseOnBlur: true,
        particles: {
          number: { value: count },
          paint: { fill: { enable: true, color: { value: DUST.colors } } },
          shape: { type: 'circle' },
          size: { value: DUST.size },
          opacity: { value: DUST.opacity, animation: { enable: !REDUCED, speed: DUST.twinkle, sync: false, startValue: 'random' } },
          move: { enable: !REDUCED, direction: 'top', speed: DUST.speed, random: false, straight: false, outModes: { default: 'out' } },
        },
      } });
      if (!dust) return;
      if (REDUCED) requestAnimationFrame(() => requestAnimationFrame(() => dust.pause()));   // one still frame, then no redraws
      else new IntersectionObserver(([e]) => (e.isIntersecting ? dust.play() : dust.pause())).observe($('heroBand'));
      requestAnimationFrame(() => host.classList.add('on'));
    } catch (e) { /* the script did not load: the hero without dust */ }
  }

  /* ---------- lifecycle ---------- */
  const nextTask = () => new Promise(r => setTimeout(r, 0));   // build in small tasks so the phone can draw in between
  function drawAll() { layoutHero(); drawCourt(); drawStrips(); drawSplit(); }
  async function main() {
    // The dust needs only the photo's placement, not the data, so it starts as the page opens (its script is preloaded).
    layoutHero();
    startDust();
    try { D = await loadData(); } catch (e) { $('loading').textContent = 'Could not load the data file. ' + e.message; return; }
    $('loading').remove();
    TEAMS = D.teams;
    bindText();
    layoutHero();
    if (REDUCED) $('heroBand').classList.remove('pre');
    await nextTask();
    buildRanks();
    buildZones();
    drawCourt();
    await nextTask();
    drawStrips();
    await nextTask();
    drawSplit();
    drawCrowd();
    document.dispatchEvent(new Event('page-ready'));
    const figs = [...document.querySelectorAll('.fig')];
    const reveal = f => {
      f.classList.add('in'); countUp(f);
      setTimeout(() => f.classList.add('done'), REDUCED ? 0 : 2800);
      if (f.id === 'fig1') { if (REDUCED) courtReveal.paint(Infinity); else playCourt(); }
      if (f.id === 'fig2') { if (REDUCED) stripReveal.paint(Infinity); else animate(stripReveal.dur, t => stripReveal.paint(t)); }
    };
    if (REDUCED) figs.forEach(reveal);
    else {
      // Each figure plays when its chart (not its heading) rises past 65% of the screen height, so the motion
      // happens in view while scrolling. A chart already above that line (a jump or a reload part way down)
      // plays at once. One rect read per waiting chart per scroll frame; the listener goes once all have played.
      const waiting = new Map(figs.map(f => [f.querySelector('.chart, .strips, .split, .crowd') || f, f]));
      let frame = 0;
      const sweep = () => {
        frame = 0;
        for (const [c, f] of waiting) {
          const r = c.getBoundingClientRect();                     // also play once the whole chart is on screen (page end)
          if (r.top > innerHeight * 0.65 && r.bottom > innerHeight) continue;
          waiting.delete(c);
          requestAnimationFrame(() => requestAnimationFrame(() => reveal(f)));
        }
        if (!waiting.size) removeEventListener('scroll', onScroll);
      };
      const onScroll = () => { if (!frame) frame = requestAnimationFrame(sweep); };
      addEventListener('scroll', onScroll, { passive: true });
      sweep();
    }
    let lastW = document.documentElement.clientWidth, timer = 0;
    addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const w = document.documentElement.clientWidth;
        if (w === lastW) return;
        lastW = w; hideTip(); drawAll();
      }, 150);
    });
    // The hero's motion starts once the figures are built and the photo is decoded, in an idle moment,
    // so neither the title flash nor the rays script shares a busy frame with the page build.
    const photo = $('heroPhoto');
    (photo.decode ? photo.decode() : Promise.resolve()).catch(() => {}).then(() =>
      (window.requestIdleCallback || (f => setTimeout(f, 60)))(() => requestAnimationFrame(() => { lightTitle(); startRays(); }), { timeout: 400 }));
  }
  main();
})();
