// Néstor Premium · lògica de l'app. Els textos són a data.js.
(function () {
  "use strict";

  const D = window.DATA;
  const T = D.texts;
  const STOPS = D.stops;
  const QUOTAS = D.quotas;
  const TOTAL = QUOTAS.length;
  // Diumenge 8/11/2026 a les 17:00, hora de Brussel·les (CET, UTC+1)
  const DEADLINE = Date.parse("2026-11-08T17:00:00+01:00");

  // ---------- Estat (localStorage, o memòria si falla)
  const KEY = "nestor-premium";
  const memory = {};
  const store = {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return memory[KEY] || null;
      }
    },
    save(s) {
      memory[KEY] = s;
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* continua en memòria */ }
    },
  };

  // stage: go | story | test | rejected | paid | end ("end" = certificat o renovació pendent)
  const fresh = () => ({ started: false, idx: 0, stage: "go", done: false, paid: {}, tools: {}, choice: {} });
  let state = Object.assign(fresh(), store.load() || {});
  state.choice = state.choice || {};
  // Si el rellotge del Pasapalabra estava en marxa, en tornar a obrir queda aturat
  Object.values(state.tools).forEach((t) => { if (t && t.run) t.run = false; });
  let tab = "route";
  let justPaid = false; // el segell només cau en el moment de pagar

  const save = () => store.save(state);

  // ---------- Utilitats
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ""));
  const quota = (n) => QUOTAS.find((q) => q.n === n);
  const paidCount = () => Object.keys(state.paid).length;
  const allPaid = () => paidCount() >= TOTAL;
  const clock = (ms) => new Date(ms).toLocaleTimeString("ca-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" });
  const mapsUrl = (s) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}&travelmode=${s.mode}`;
  const stampColor = (n) => ["blue", "magenta", "green", "ochre"][(n - 1) % 4];

  // ---------- Icones (traç simple)
  const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const ICONS = {
    route: svg('<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16"/>'),
    map: svg('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>'),
    passport: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 16h6"/>'),
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    walking: svg('<circle cx="13" cy="4" r="1.6"/><path d="m9 21 2.5-6.5L14 17v4M7 12l2-4 4-1 3 4 3 1M11.5 14.5 13 8"/>'),
    transit: svg('<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l-2-4M15 21l2-4"/><circle cx="9" cy="14" r=".6" fill="currentColor"/><circle cx="15" cy="14" r=".6" fill="currentColor"/>'),
    pin: svg('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>'),
  };

  // ---------- Barra superior
  function countdown() {
    if (allPaid()) return T.topbar.renewed;
    const left = DEADLINE - Date.now();
    if (left <= 0) return T.topbar.expired;
    const min = Math.floor(left / 60000);
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    return d >= 1 ? fill(T.topbar.expiresDays, { d, h }) : fill(T.topbar.expiresHours, { h, m });
  }

  function renderTopbar() {
    const renewed = allPaid();
    const segs = QUOTAS.map((q) => `<i class="seg${state.paid[q.n] ? " seg--on" : ""}"></i>`).join("");
    $("#topbar").innerHTML = `
      <div class="topbar__row">
        <span class="topbar__brand">${esc(T.appName)}</span>
        <span class="topbar__plan${renewed ? " topbar__plan--ok" : ""}">
          ${renewed ? "" : `<span class="topbar__trial">${esc(T.topbar.trial)}</span>`}
          <span class="topbar__count mono">${esc(countdown())}</span>
        </span>
      </div>
      <div class="segs" aria-label="${paidCount()}/${TOTAL}">${segs}</div>`;
  }

  // ---------- Peces comunes
  // Parada amb opcions: els camps del lloc triat substitueixen els de la parada
  const pick = (s) => (s.options ? Object.assign({}, s, s.options[state.choice[s.n] || 0]) : s);

  const choiceBar = (s) => !s.options ? "" : `
    <div class="choice">
      <h3 class="label">${esc(T.go.choose)}</h3>
      <div class="choice__opts" role="radiogroup">
        ${s.options.map((o, i) => `<button class="choice__opt" role="radio" aria-checked="${(state.choice[s.n] || 0) === i}" data-act="choose" data-i="${i}">${esc(o.name)}</button>`).join("")}
      </div>
    </div>`;

  const tagFor = (s) => {
    if (s.quota) return fill(T.go.tagQuota, { n: s.quota, owner: quota(s.quota).owner });
    return s.kind === "Visita" || s.kind === "Activitat" ? T.go.tagVisit : T.go.tagFood;
  };

  const stopHead = (s) => `
    <div class="kicker mono">
      <span>${esc(fill(T.go.dayTime, { day: T.days[s.day], time: s.time }))}</span>
      <span>${esc(fill(T.go.stopOf, { n: s.n, total: STOPS.length }))}</span>
    </div>
    <h2 class="stop-name">${esc(s.name)}</h2>`;

  const stamp = (n, at, cls) => {
    const lines = T.paid.stamp.map((l) => fill(l, { n, time: clock(at) }));
    return `<div class="stamp stamp--${stampColor(n)} ${cls || ""}">
      <span class="stamp__small">${esc(lines[0])}</span>
      <span class="stamp__big">${esc(lines[1])}</span>
      <span class="stamp__small">${esc(lines[2])} · ${esc(lines[3])}</span>
    </div>`;
  };

  function sundayBanner(s) {
    const firstSunday = STOPS.find((x) => x.day === "sun");
    if (s.n !== firstSunday.n) return "";
    return `<div class="banner">${esc(fill(T.sundayBanner, { x: paidCount() }))}</div>`;
  }

  // ---------- Eines de les proves (l'estat de cada una es desa a state.tools[n])
  const TT = T.tools;
  const R = T.rosco;
  const ui = { answer: false, roscoAnswer: false, mapDay: null, confirmReset: false }; // coses de pantalla que no cal desar
  const curQuota = () => quota(STOPS[state.idx].quota);
  const tool = (q, init) => state.tools[q.n] || (state.tools[q.n] = init());
  const num = (x) => x.toLocaleString("ca-ES", { maximumFractionDigits: 1 });

  const stepper = (label, value, key) => `
    <div class="stepper">
      <span class="stepper__label">${esc(label)}</span>
      <div class="stepper__row">
        <button class="stepper__btn" data-act="step" data-k="${key}" data-d="-1">−</button>
        <span class="stepper__value mono">${value}</span>
        <button class="stepper__btn" data-act="step" data-k="${key}" data-d="1">+</button>
      </div>
    </div>`;

  function scoreTool(q) {
    const t = tool(q, () => ({ a: 0, b: 0 }));
    return `
      <h3 class="label">${esc(q.tool.unit)}</h3>
      <div class="steppers">${stepper(TT.claudia, t.a, "a")}${stepper(q.owner, t.b, "b")}</div>`;
  }

  function counterTool(q) {
    const t = tool(q, () => ({ n: 0 }));
    return `<div class="steppers">${stepper(q.tool.unit, t.n, "n")}</div>`;
  }

  function hitsTool(q) {
    const t = tool(q, () => ({ a: 0, b: 0 }));
    const { need, total } = q.tool;
    const ok = t.a >= need;
    return `
      <div class="steppers">${stepper(TT.hits, t.a, "a")}${stepper(TT.misses, t.b, "b")}</div>
      <p class="goal mono${ok ? " goal--ok" : ""}">${ok ? ICONS.check : ""}<span>${esc(fill(TT.hitsLeft, { need, left: Math.max(0, total - t.a - t.b), total }))}</span></p>`;
  }

  function voteTool(q) {
    const t = tool(q, () => ({ v: {} }));
    const votes = q.tool.voters.map((v) => t.v[v]).filter(Boolean);
    const avg = votes.length ? votes.reduce((x, y) => x + y, 0) / votes.length : null;
    const ok = avg !== null && avg >= q.tool.min;
    const opts = (sel) => [`<option value="">${esc(TT.noVote)}</option>`]
      .concat(Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}"${sel === i + 1 ? " selected" : ""}>${i + 1}</option>`)).join("");
    return `
      <div class="votes">
        ${q.tool.voters.map((v) => `
          <label class="vote"><span>${esc(v)}</span><select class="mono" data-vote="${esc(v)}">${opts(t.v[v])}</select></label>`).join("")}
      </div>
      <p class="goal mono${ok ? " goal--ok" : ""}">${ok ? ICONS.check : ""}<span>${esc(TT.average)}: ${avg === null ? esc(TT.noVote) : num(avg)}</span></p>`;
  }

  function cardsTool(q) {
    const t = tool(q, () => ({ c: D.clauses.map(() => 0) }));
    const done = t.c.filter((x) => x === 2).length;
    return `
      <div class="clauses">
        ${D.clauses.map((text, i) => `
          <button class="clause clause--${t.c[i]}" data-act="card" data-i="${i}">
            <span class="clause__n mono">${t.c[i] === 2 ? ICONS.check : ""}${esc(fill(TT.cardLabel, { n: i + 1 }))}</span>
            ${t.c[i] === 1 ? `<span class="clause__text">${esc(text)}</span>` : ""}
          </button>`).join("")}
      </div>
      <p class="goal mono${done === D.clauses.length ? " goal--ok" : ""}"><span>${esc(fill(TT.cardsDone, { x: done }))}</span></p>`;
  }

  function nextQuestion(t) {
    let pool = D.questions.map((_, i) => i).filter((i) => !t.used.includes(i));
    if (!pool.length) { t.used = [t.cur]; pool = D.questions.map((_, i) => i).filter((i) => i !== t.cur); }
    t.cur = pool[Math.floor(Math.random() * pool.length)];
    t.used.push(t.cur);
    ui.answer = false;
  }

  function questionsTool(q) {
    const t = tool(q, () => { const x = { cur: -1, used: [], ok: 0, ko: 0 }; nextQuestion(x); return x; });
    const Q = D.questions[t.cur];
    return `
      <div class="qcard">
        <p class="qcard__q">${esc(Q.q)}</p>
        ${ui.answer
          ? `<p class="qcard__a">${esc(Q.a)}</p>`
          : `<button class="btn btn--small" data-act="qShow">${esc(TT.showAnswer)}</button>`}
      </div>
      <div class="qbtns">
        <button class="btn btn--ok" data-act="qOk">${esc(TT.gotIt)}</button>
        <button class="btn btn--ko" data-act="qKo">${esc(TT.failed)}</button>
        <button class="btn" data-act="qNext">${esc(TT.another)}</button>
      </div>
      <div class="qstats mono">
        <span class="${t.ok >= 3 ? "goal--ok" : ""}"><b>${t.ok}/3</b> ${esc(TT.streak)}</span>
        <span><b>${t.ko}</b> ${esc(TT.failedStrangers)}</span>
      </div>`;
  }

  // Rosco: s = estat de cada lletra (p pendent, ok, ko), cur = lletra actual, time = segons que queden
  const roscoFresh = (q) => () => ({ s: D.rosco.map(() => "p"), cur: 0, time: q.tool.seconds, run: false });
  const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const nextPending = (t, from) => {
    for (let k = 1; k <= t.s.length; k++) {
      const j = (from + k) % t.s.length;
      if (t.s[j] === "p") return j;
    }
    return -1;
  };
  const roscoOver = (t) => t.time <= 0 || !t.s.includes("p");
  let timer = null;

  function stopTimer() {
    clearInterval(timer);
    timer = null;
  }

  function startTimer(t) {
    stopTimer();
    t.run = true;
    let last = Date.now();
    timer = setInterval(() => {
      const now = Date.now();
      const passed = Math.floor((now - last) / 1000);
      if (!passed) return;
      last += passed * 1000;
      t.time = Math.max(0, t.time - passed);
      if (t.time === 0) { t.run = false; stopTimer(); }
      save();
      const el = $("#rosco-time");
      if (t.time === 0) refreshTool();
      else if (el) el.textContent = mmss(t.time);
    }, 250);
  }

  function roscoTool(q) {
    const t = tool(q, roscoFresh(q));
    const over = roscoOver(t);
    if (over && t.run) { t.run = false; stopTimer(); }
    const ok = t.s.filter((x) => x === "ok").length;
    const ko = t.s.filter((x) => x === "ko").length;
    const none = t.s.length - ok - ko;
    const cur = D.rosco[t.cur];
    const letters = D.rosco.map((r, i) => {
      const a = (i / D.rosco.length) * 2 * Math.PI - Math.PI / 2;
      const pos = `left:${(50 + 44 * Math.cos(a)).toFixed(2)}%;top:${(50 + 44 * Math.sin(a)).toFixed(2)}%`;
      return `<span class="letter letter--${t.s[i]}${!over && i === t.cur ? " letter--cur" : ""}" style="${pos}">${esc(r.letter)}</span>`;
    }).join("");
    const reached = ok >= q.tool.need;
    const bottom = over
      ? `<div class="rosco__end">
          <p class="mono">${esc(fill(R.done, { ok, ko, none }))}</p>
          <p class="goal mono${reached ? " goal--ok" : " goal--ko"}">${reached ? ICONS.check : ICONS.alert}<span>${esc(reached ? R.reached : R.notReached)}</span></p>
        </div>`
      : `<p class="rosco__starts mono">${esc(fill(R.startsWith, { l: cur.letter }))}</p>
        <p class="rosco__def">${esc(cur.def)}</p>
        <button class="linkbtn" data-act="rAnswer">${esc(R.answer)}</button>
        ${ui.roscoAnswer ? `<p class="rosco__answer mono">${esc(cur.answer)}</p>` : ""}
        <div class="rosco__btns">
          <button class="btn btn--ok" data-act="rHit">${esc(R.hit)}</button>
          <button class="btn btn--ko" data-act="rMiss">${esc(R.miss)}</button>
          <button class="btn btn--pass" data-act="rPass">${esc(R.pass)}</button>
        </div>
        <div class="rosco__clock">
          <button class="btn" data-act="rRun">${esc(t.run ? R.stop : R.start)}</button>
          <button class="btn" data-act="rPlus">${esc(R.plus30)}</button>
        </div>`;
    return `
      <div class="rosco">
        <div class="rosco__ring">
          ${letters}
          <div class="rosco__center">
            <span class="rosco__big">${over ? "" : esc(cur.letter)}</span>
            <span class="rosco__time mono" id="rosco-time">${mmss(t.time)}</span>
            <span class="rosco__score mono"><b class="ok">${ok}</b> ${esc(R.hits)} · <b class="ko">${ko}</b> ${esc(R.misses)}</span>
          </div>
        </div>
        ${bottom}
        <button class="linkbtn linkbtn--reset" data-act="rReset">${esc(R.reset)}</button>
      </div>`;
  }

  const TOOLS = { score: scoreTool, counter: counterTool, hits: hitsTool, vote: voteTool, cards: cardsTool, questions: questionsTool, rosco: roscoTool };
  const toolView = (q) => (TOOLS[q.tool.type] ? TOOLS[q.tool.type](q) : "");

  function refreshTool() {
    save();
    const el = $(".tool");
    if (el) el.innerHTML = toolView(curQuota());
  }

  const toolActions = {
    step(el) {
      const q = curQuota();
      const t = state.tools[q.n];
      const k = el.dataset.k;
      const d = Number(el.dataset.d);
      if (q.tool.type === "hits" && d > 0 && t.a + t.b >= q.tool.total) return;
      t[k] = Math.max(0, t[k] + d);
      refreshTool();
    },
    card(el) {
      const t = state.tools[curQuota().n];
      const i = Number(el.dataset.i);
      t.c[i] = t.c[i] === 1 ? 2 : 1; // 1r toc obre, 2n marca, 3r desmarca
      refreshTool();
    },
    qShow() { ui.answer = true; refreshTool(); },
    qOk() { const t = state.tools[curQuota().n]; t.ok = Math.min(3, t.ok + 1); nextQuestion(t); refreshTool(); },
    qKo() { const t = state.tools[curQuota().n]; t.ok = 0; t.ko += 1; nextQuestion(t); refreshTool(); },
    qNext() { nextQuestion(state.tools[curQuota().n]); refreshTool(); },
    rHit() { roscoMark("ok"); },
    rMiss() { roscoMark("ko"); },
    rPass() {
      const t = state.tools[curQuota().n];
      const j = nextPending(t, t.cur);
      if (j >= 0) t.cur = j;
      ui.roscoAnswer = false;
      refreshTool();
    },
    rRun() {
      const t = state.tools[curQuota().n];
      if (t.run) { t.run = false; stopTimer(); } else startTimer(t);
      refreshTool();
    },
    rPlus() { state.tools[curQuota().n].time += 30; refreshTool(); },
    rAnswer() { ui.roscoAnswer = !ui.roscoAnswer; refreshTool(); },
    rReset() {
      const q = curQuota();
      stopTimer();
      state.tools[q.n] = roscoFresh(q)();
      ui.roscoAnswer = false;
      refreshTool();
    },
  };

  function roscoMark(v) {
    const t = state.tools[curQuota().n];
    t.s[t.cur] = v;
    const j = nextPending(t, t.cur);
    if (j >= 0) t.cur = j;
    ui.roscoAnswer = false;
    refreshTool();
  }

  // ---------- Pantalles de la ruta
  function introView() {
    const I = T.intro;
    return `
      <section class="intro">
        <h1 class="intro__title">${esc(I.title)}</h1>
        <p class="intro__text">${esc(I.text)}</p>
        <div class="card">
          <h3 class="label">${esc(I.howTitle)}</h3>
          <ol class="steps">${I.how.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
        </div>
        <div class="card terms">
          <h3 class="label">${esc(I.termsTitle)}</h3>
          <ul>${I.terms.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>
        <button class="btn btn--primary" data-act="start">${esc(I.button)}</button>
      </section>`;
  }

  function goView(s) {
    return `
      ${sundayBanner(s)}
      <article class="card">
        ${stopHead(s)}
        ${choiceBar(s)}
        <p class="addr">${ICONS.pin}<span>${esc(s.address)}</span></p>
        <span class="tag${s.quota ? " tag--quota" : ""}">${esc(tagFor(s))}</span>
        <div class="howto">
          <h3 class="label">${ICONS[s.mode]}${esc(T.go.howto)}</h3>
          <p>${esc(s.howto)}</p>
        </div>
        ${s.note ? `<div class="note"><h3 class="label">${esc(T.go.note)}</h3><p>${esc(s.note)}</p></div>` : ""}
        <div class="actions">
          <a class="btn" href="${esc(mapsUrl(s))}" target="_blank" rel="noopener">${ICONS[s.mode]}${esc(T.go.openMaps)}</a>
          <button class="btn btn--primary" data-act="arrived">${esc(T.go.arrived)}</button>
        </div>
      </article>`;
  }

  function storyView(s) {
    const btn = s.quota
      ? `<button class="btn btn--primary" data-act="toTest">${esc(T.story.toTest)}</button>`
      : `<button class="btn btn--primary" data-act="next">${esc(T.story.next)}</button>`;
    return `
      ${sundayBanner(s)}
      <article class="card">
        ${stopHead(s)}
        <span class="tag tag--read">${esc(T.story.readAloud)}</span>
        <div class="story">${s.story.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        <div class="actions">${btn}</div>
      </article>`;
  }

  function testView(s) {
    const q = quota(s.quota);
    return `
      <article class="card">
        <div class="kicker mono"><span>${esc(fill(T.test.quota, { n: q.n }))}</span><span>${esc(s.name)}</span></div>
        <h2 class="test-title">${esc(q.title)}</h2>
        <p class="with">${esc(fill(T.test.with, { owner: q.owner }))}</p>
        <ol class="rules">${q.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>
        <p class="cond">${ICONS.check}<span><b>${esc(T.test.payBtn)}:</b> ${esc(q.pass)}</span></p>
        <div class="tool" data-tool="${q.n}">${toolView(q)}</div>
        <div class="verdict">
          <button class="btn btn--ko" data-act="reject">${esc(T.test.rejectBtn)}</button>
          <button class="btn btn--ok" data-act="pay">${esc(T.test.payBtn)}</button>
        </div>
      </article>`;
  }

  function rejectedView(s) {
    const q = quota(s.quota);
    return `
      <article class="card card--ko">
        <div class="kicker mono ko">${ICONS.alert}<span>${esc(fill(T.rejected.kicker, { n: q.n }))}</span></div>
        <h2>${esc(T.rejected.title)}</h2>
        <p class="ko-sub mono">${esc(T.rejected.text)}</p>
        <p class="ko-text">${esc(q.reject)}</p>
        <div class="actions"><button class="btn btn--primary" data-act="retry">${esc(T.rejected.button)}</button></div>
      </article>`;
  }

  function paidView(s) {
    const q = quota(s.quota);
    const p = state.paid[q.n];
    const left = TOTAL - paidCount();
    const last = state.idx >= STOPS.length - 1;
    const btn = allPaid() || last || state.done
      ? `<button class="btn btn--primary" data-act="end">${esc(T.paid.final)}</button>`
      : `<button class="btn btn--primary" data-act="next">${esc(fill(T.paid.next, { stop: STOPS[state.idx + 1].name }))}</button>`;
    const html = `
      <article class="card paid">
        ${stamp(q.n, p.at, justPaid ? "stamp--drop" : "")}
        <h2>${esc(fill(T.paid.title, { test: q.title }))}</h2>
        <p class="mono left">${esc(fill(T.paid.left, { x: left }))}</p>
        <div class="actions">${btn}</div>
      </article>`;
    justPaid = false;
    return html;
  }

  function certificateView() {
    const C = T.certificate;
    const [big, small] = C.stamp.split(" · ");
    return `
      <article class="card cert">
        <h1>${esc(C.title)}</h1>
        <table class="receipt mono">${C.rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
        <p>${esc(C.endorsed)}</p>
        <div class="stamp stamp--magenta stamp--huge stamp--drop">
          <span class="stamp__big">${esc(big)}</span>
          <span class="stamp__small">${esc(small)}</span>
        </div>
        <p class="cta">${esc(C.cta)}</p>
      </article>`;
  }

  function pendingView() {
    const P = T.pending;
    const missing = QUOTAS.filter((q) => !state.paid[q.n]);
    return `
      <article class="card card--ko">
        <h2>${esc(P.title)}</h2>
        <p>${esc(fill(P.text, { x: missing.length }))}</p>
      </article>
      <ul class="pending">
        ${missing.map((q) => `
          <li class="card pending__item">
            <div>
              <div class="kicker mono"><span>${esc(fill(T.test.quota, { n: q.n }))}</span></div>
              <strong>${esc(q.title)}</strong>
              <span class="muted">${esc(STOPS[q.stop - 1].name)} · ${esc(q.owner)}</span>
            </div>
            <button class="btn btn--small" data-act="goQuota" data-q="${q.n}">${esc(P.go)}</button>
          </li>`).join("")}
      </ul>`;
  }

  function routeView() {
    if (!state.started) return introView();
    if (state.stage === "end") return allPaid() ? certificateView() : pendingView();
    const s = pick(STOPS[state.idx]);
    if (!s.quota && ["test", "rejected", "paid"].includes(state.stage)) state.stage = "story";
    switch (state.stage) {
      case "story": return storyView(s);
      case "test": return testView(s);
      case "rejected": return rejectedView(s);
      case "paid": return state.paid[s.quota] ? paidView(s) : testView(s);
      default: return goView(s);
    }
  }

  // ---------- Mapa
  const DAYS = ["sat", "sun"];
  const stopStatus = (i) => {
    if (!state.started) return "todo";
    if (state.done || i < state.idx) return "done";
    return i === state.idx ? "cur" : "todo";
  };
  const dayTabs = (cur, act) => `
    <div class="choice__opts" role="radiogroup">
      ${DAYS.map((d) => `<button class="choice__opt" role="radio" aria-checked="${d === cur}" data-act="${act}" data-d="${d}">${esc(T.map[d])}</button>`).join("")}
    </div>`;

  // Posició esquemàtica: meitat coordenada real, meitat ordre relatiu, perquè els punts del centre no es trepitgin
  function layout(list) {
    const axis = (vals) => {
      const min = Math.min(...vals), max = Math.max(...vals);
      const sorted = vals.slice().sort((a, b) => a - b);
      return vals.map((v) => {
        const real = max > min ? (v - min) / (max - min) : 0.5;
        const rank = vals.length > 1 ? sorted.indexOf(v) / (vals.length - 1) : 0.5;
        return (real + rank) / 2;
      });
    };
    const xs = axis(list.map((s) => s.lng));
    const ys = axis(list.map((s) => -s.lat));
    return list.map((_, i) => ({ x: xs[i], y: ys[i] }));
  }

  // Mapa real (Leaflet + OpenStreetMap). Si Leaflet no ha carregat (sense connexió), es fa servir l'esquema.
  let leaf = null;
  const dark = window.matchMedia("(prefers-color-scheme: dark)");
  const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  dark.addEventListener("change", () => { if (tab === "map") render(); });

  function unmountMap() {
    if (leaf) { leaf.remove(); leaf = null; }
  }

  function mountMap() {
    const el = $("#realmap");
    if (!el || !window.L) return;
    const list = ui.mapList;
    leaf = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer(TILES, {
      maxZoom: 19,
      crossOrigin: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(leaf);
    const latlngs = list.map(({ s }) => [s.lat, s.lng]);
    L.polyline(latlngs, { className: "route-line", weight: 3, dashArray: "6 7" }).addTo(leaf);
    const markers = list.map(({ s, i }) => {
      const st = stopStatus(i);
      const icon = L.divIcon({ className: "pin-wrap", html: `<span class="pin pin--${st}">${s.n}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
      return L.marker([s.lat, s.lng], { icon, zIndexOffset: st === "cur" ? 1000 : 0, title: s.name })
        .bindPopup(`<strong>${s.n} · ${esc(s.name)}</strong><br><span class="mono">${esc(s.time)}</span> · <a href="${esc(mapsUrl(s))}" target="_blank" rel="noopener">${esc(T.map.maps)}</a>`)
        .addTo(leaf);
    });
    // Els pins que queden enganxats al zoom actual s'aparten una mica (només el dibuix, no la posició real)
    const spread = () => {
      const pts = markers.map((m) => leaf.latLngToLayerPoint(m.getLatLng()));
      const off = pts.map(() => ({ x: 0, y: 0 }));
      const GAP = 25;
      for (let it = 0; it < 40; it++) {
        for (let a = 0; a < pts.length; a++) {
          for (let b = a + 1; b < pts.length; b++) {
            const dx = pts[b].x + off[b].x - pts[a].x - off[a].x, dy = pts[b].y + off[b].y - pts[a].y - off[a].y;
            const d = Math.hypot(dx, dy) || 0.01;
            if (d >= GAP) continue;
            const push = (GAP - d) / 2, ux = dx / d || 1, uy = dy / d;
            off[a].x -= ux * push; off[a].y -= uy * push;
            off[b].x += ux * push; off[b].y += uy * push;
          }
        }
      }
      markers.forEach((m, k) => {
        const pin = m.getElement() && m.getElement().querySelector(".pin");
        if (pin) pin.style.translate = `${off[k].x.toFixed(1)}px ${off[k].y.toFixed(1)}px`;
      });
    };
    leaf.on("zoomend", spread);
    leaf.fitBounds(L.latLngBounds(latlngs), { padding: [26, 26], maxZoom: 16 });
    spread();
  }

  function schematic(list, day) {
    const W = 320, H = 300, P = 22;
    const pts = layout(list.map((x) => x.s)).map((p) => ({ x: P + p.x * (W - 2 * P), y: P + p.y * (H - 2 * P - 14) }));
    // Si dos punts encara queden enganxats, s'aparten fins a tenir espai per al número
    const GAP = 27;
    for (let it = 0; it < 60; it++) {
      for (let a = 0; a < pts.length; a++) {
        for (let b = a + 1; b < pts.length; b++) {
          const dx = pts[b].x - pts[a].x, dy = pts[b].y - pts[a].y;
          const d = Math.hypot(dx, dy) || 0.01;
          if (d >= GAP) continue;
          const push = (GAP - d) / 2, ux = dx / d || 1, uy = dy / d;
          pts[a].x -= ux * push; pts[a].y -= uy * push;
          pts[b].x += ux * push; pts[b].y += uy * push;
        }
      }
      pts.forEach((p) => {
        p.x = Math.min(W - P, Math.max(P, p.x));
        p.y = Math.min(H - P - 14, Math.max(P, p.y));
      });
    }
    const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const dots = list.map(({ s, i }, k) => `
      <g class="dot dot--${stopStatus(i)}">
        <circle cx="${pts[k].x.toFixed(1)}" cy="${pts[k].y.toFixed(1)}" r="11"/>
        <text x="${pts[k].x.toFixed(1)}" y="${(pts[k].y + 4).toFixed(1)}" text-anchor="middle">${s.n}</text>
      </g>`).join("");
    return `
      <div class="card map">
        <svg class="map__svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T.map[day])}">
          <polyline class="map__line" points="${line}"/>
          ${dots}
          <text class="map__note" x="${W - 6}" y="${H - 6}" text-anchor="end">${esc(T.map.schematic)}</text>
        </svg>
      </div>`;
  }

  function mapView() {
    const day = ui.mapDay || (state.started ? STOPS[state.idx].day : "sat");
    const list = STOPS.map((s, i) => ({ s: pick(s), i })).filter((x) => x.s.day === day);
    ui.mapList = list;
    const rows = list.map(({ s, i }) => {
      const q = s.quota && quota(s.quota);
      return `
        <li class="stoprow stoprow--${stopStatus(i)}">
          <button class="stoprow__n mono" data-act="mapFocus" data-i="${i}">${s.n}</button>
          <div class="stoprow__body">
            <span class="stoprow__time mono">${esc(s.time)}</span>
            <strong>${esc(s.name)}</strong>
            ${q ? `<span class="tag tag--quota">${esc(fill(T.go.tagQuota, { n: q.n, owner: q.owner }))}</span>` : ""}
          </div>
          <a class="stoprow__maps" href="${esc(mapsUrl(s))}" target="_blank" rel="noopener">${ICONS.pin}${esc(T.map.maps)}</a>
        </li>`;
    }).join("");
    return `
      ${dayTabs(day, "mapDay")}
      ${window.L ? `<div class="card map map--real"><div id="realmap" class="realmap" aria-label="${esc(T.map[day])}"></div></div>` : schematic(list, day)}
      <ol class="stoplist">${rows}</ol>`;
  }

  // ---------- Passaport
  const TILTS = [-7, 5, -11, 8, -4, 10, -9, 3, -13, 6, -2, 9];

  function passportView() {
    const P = T.passport;
    const cells = QUOTAS.map((q) => {
      const p = state.paid[q.n];
      if (!p) {
        return `
          <div class="slot">
            <span class="slot__n mono">${q.n}</span>
            <span class="slot__title">${esc(q.title)}</span>
            <span class="slot__owner">${esc(q.owner)}</span>
          </div>`;
      }
      return `
        <div class="slot slot--paid">
          <div class="stamp stamp--${stampColor(q.n)} stamp--mini" style="transform: rotate(${TILTS[(q.n - 1) % TILTS.length]}deg)">
            <span class="stamp__small">${esc(fill(T.test.quota, { n: q.n }))}</span>
            <span class="stamp__big">${esc(P.stamp)}</span>
            <span class="stamp__small">${esc(clock(p.at))}</span>
          </div>
          <span class="slot__title">${esc(q.title)}</span>
        </div>`;
    }).join("");
    const rows = QUOTAS.map((q) => {
      const p = state.paid[q.n];
      return `<tr class="${p ? "" : "is-pending"}">
        <th><span class="mono">${q.n}</span> ${esc(q.title)}</th>
        <td>${esc(pick(STOPS[q.stop - 1]).name)}</td>
        <td class="mono">${p ? esc(clock(p.at)) : esc(P.pending)}</td>
      </tr>`;
    }).join("");
    return `
      <h1 class="page-title">${esc(fill(P.header, { x: paidCount() }))}</h1>
      <div class="card passport"><div class="slots">${cells}</div></div>
      <div class="card">
        <table class="receipts">
          <thead><tr>${P.cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ---------- Menú
  function menuView() {
    const M = T.menu;
    const owners = [...new Set(QUOTAS.map((q) => q.owner))];
    const ownerRows = owners.map((o) => `
      <tr>
        <th>${esc(o)}</th>
        <td>${QUOTAS.filter((q) => q.owner === o).map((q) => `
          <span class="ownq${state.paid[q.n] ? " ownq--paid" : ""}">${state.paid[q.n] ? ICONS.check : ""}<span class="mono">${q.n}</span> ${esc(q.title)}</span>`).join("")}</td>
      </tr>`).join("");
    const jump = DAYS.map((d) => `
      <h3 class="label">${esc(T.days[d])}</h3>
      <ul class="jumplist">
        ${STOPS.map((s, i) => ({ s, i })).filter((x) => x.s.day === d).map(({ s, i }) => `
          <li class="jumprow${state.started && i === state.idx ? " jumprow--cur" : ""}">
            <span class="mono">${s.n} · ${esc(s.time)}</span>
            <strong>${esc(s.name)}</strong>
            <button class="btn btn--small" data-act="jump" data-i="${i}">${esc(M.go)}</button>
          </li>`).join("")}
      </ul>`).join("");
    const reset = ui.confirmReset
      ? `<div class="card card--ko">
          <p class="ko-text">${esc(M.resetConfirm)}</p>
          <div class="verdict">
            <button class="btn" data-act="resetNo">${esc(M.resetNo)}</button>
            <button class="btn btn--danger" data-act="resetYes">${esc(M.resetYes)}</button>
          </div>
        </div>`
      : `<button class="btn btn--ko" data-act="reset">${esc(M.reset)}</button>`;
    return `
      <div class="card">
        <h2 class="section-title">${esc(M.owners)}</h2>
        <table class="owners">${ownerRows}</table>
      </div>
      <div class="card">
        <h2 class="section-title">${esc(M.jump)}</h2>
        ${jump}
      </div>
      <div class="menu-reset">${reset}</div>`;
  }

  // ---------- Vistes
  const views = {
    route: routeView,
    map: mapView,
    passport: passportView,
    menu: menuView,
  };

  function renderTabs() {
    $("#tabbar").innerHTML = Object.keys(views)
      .map((k) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${k === tab}">${ICONS[k]}<span>${esc(T.tabs[k])}</span></button>`)
      .join("");
  }

  function render() {
    renderTopbar();
    renderTabs();
    unmountMap();
    $("#view").innerHTML = views[tab]();
    if (tab === "map") mountMap();
  }

  // ---------- Accions
  function setStage(stage, idx) {
    if (idx !== undefined) state.idx = idx;
    state.stage = stage;
    ui.answer = false;
    ui.roscoAnswer = false;
    save();
    render();
    window.scrollTo(0, 0);
  }

  const actions = {
    start() { state.started = true; setStage("go", 0); },
    arrived() { setStage("story"); },
    toTest() {
      const s = STOPS[state.idx];
      setStage(state.paid[s.quota] ? "paid" : "test");
    },
    reject() { setStage("rejected"); },
    retry() { setStage("test"); },
    pay() {
      const n = STOPS[state.idx].quota;
      if (!state.paid[n]) state.paid[n] = { at: Date.now() };
      justPaid = true;
      setStage("paid");
    },
    next() {
      if (state.idx >= STOPS.length - 1) return actions.end();
      setStage("go", state.idx + 1);
    },
    end() { state.done = true; setStage("end"); },
    choose(el) {
      state.choice[STOPS[state.idx].n] = Number(el.dataset.i);
      save();
      render();
    },
    mapDay(el) { ui.mapDay = el.dataset.d; render(); },
    mapFocus(el) {
      const s = pick(STOPS[Number(el.dataset.i)]);
      if (!leaf) return;
      leaf.setView([s.lat, s.lng], 17, { animate: false });
      $("#realmap").scrollIntoView({ behavior: "smooth", block: "center" });
    },
    jump(el) {
      state.started = true;
      state.done = false;
      tab = "route";
      setStage("go", Number(el.dataset.i));
    },
    reset() { ui.confirmReset = true; render(); },
    resetNo() { ui.confirmReset = false; render(); },
    resetYes() {
      stopTimer();
      state = fresh();
      ui.confirmReset = false;
      ui.mapDay = null;
      tab = "route";
      setStage("go", 0);
    },
    goQuota(el) { setStage("go", quota(Number(el.dataset.q)).stop - 1); },
    ...toolActions,
  };

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (t) {
      tab = t.dataset.tab;
      ui.confirmReset = false;
      render();
      window.scrollTo(0, 0);
      return;
    }
    const a = e.target.closest("[data-act]");
    if (a && actions[a.dataset.act]) actions[a.dataset.act](a);
  });

  document.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-vote]");
    if (!sel) return;
    const t = state.tools[curQuota().n];
    if (sel.value) t.v[sel.dataset.vote] = Number(sel.value);
    else delete t.v[sel.dataset.vote];
    refreshTool();
  });

  setInterval(renderTopbar, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) renderTopbar(); });

  // Exposat per a les fases següents i per depurar
  window.NP = { get state() { return state; }, save, fill, esc, render, setStage, stopTimer };

  // ---------- Mòbil: pantalla encesa i sense connexió
  let wakeLock = null;
  async function keepAwake() {
    if (!("wakeLock" in navigator) || document.hidden || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } catch (e) { /* si el mòbil no ho permet, s'ignora */ }
  }
  keepAwake();
  document.addEventListener("visibilitychange", keepAwake);
  document.addEventListener("click", keepAwake);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => { /* sense memòria cau, continua online */ });
    });
  }

  render();
})();
