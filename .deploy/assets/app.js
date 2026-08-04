/* JOJO的发财之路 - 单页应用逻辑 */
(function () {
  const D = window.WORKBENCH_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Utilities ---------- */
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function todayKey(prefix) {
    return prefix + "_" + new Date().toISOString().slice(0, 10);
  }

  /* ---------- Header ---------- */
  const now = new Date();
  const week = ["周日","周一","周二","周三","周四","周五","周六"][now.getDay()];
  $("#date").textContent = `${now.getMonth()+1}月${now.getDate()}日 · ${week}`;

  /* ---------- Router ---------- */
  const menu = $("#menu");
  const pages = $$(".page");
  const sidebar = $("#sidebar");
  const overlay = $("#overlay");
  const toggle = $("#menuToggle");
  const pageTitle = $("#pageTitle");

  function showPage(page, title) {
    pages.forEach(p => p.classList.remove("active"));
    const target = document.getElementById("page-" + page);
    if (target) target.classList.add("active");
    pageTitle.textContent = title || document.querySelector(`[data-page="${page}"] .mlabel`)?.textContent || "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  menu.addEventListener("click", e => {
    const link = e.target.closest("a[data-page]");
    if (!link) return;
    e.preventDefault();
    const page = link.dataset.page;
    const title = link.querySelector(".mlabel").textContent;
    $$(".menu a").forEach(a => a.classList.remove("active"));
    link.classList.add("active");
    showPage(page, title);
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  });

  toggle.addEventListener("click", () => {
    const open = sidebar.classList.toggle("open");
    overlay.classList.toggle("open", open);
  });
  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  });

  // 卡片内的“去完整版”按钮
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-go]");
    if (!btn) return;
    const page = btn.dataset.go;
    const link = document.querySelector(`.menu a[data-page="${page}"]`);
    if (link) {
      $$(".menu a").forEach(a => a.classList.remove("active"));
      link.classList.add("active");
      showPage(page, link.querySelector(".mlabel").textContent);
    }
  });

  /* ---------- Generic Tracker ---------- */
  class Tracker {
    constructor(container) {
      this.container = container;
      this.key = container.dataset.key;
      this.title = container.dataset.title;
      this.placeholder = container.dataset.placeholder;
      this.icon = container.dataset.icon || "✅";
      this.items = [];
    }
    init() {
      this.load();
      this.container.innerHTML = `
        <div class="card">
          <div class="card-head"><div class="ic">${this.icon}</div><h2>${this.title}</h2><span class="sub">打卡清单</span></div>
          <div class="plan-bar"><input class="trk-input" type="text" placeholder="${this.placeholder}" maxlength="80" /><button class="btn trk-add">添加</button></div>
          <div class="progress"><span class="trk-progress"></span></div>
          <div class="progress-label trk-label"></div>
          <ul class="plan-list trk-list"></ul>
          <div class="plan-foot"><button class="btn ghost trk-clear">清除已完成</button></div>
        </div>
      `;
      this.input = this.container.querySelector(".trk-input");
      this.addBtn = this.container.querySelector(".trk-add");
      this.progress = this.container.querySelector(".trk-progress");
      this.label = this.container.querySelector(".trk-label");
      this.list = this.container.querySelector(".trk-list");
      this.clearBtn = this.container.querySelector(".trk-clear");
      this.bind();
      this.render();
    }
    load() { try { this.items = JSON.parse(localStorage.getItem(this.key)) || []; } catch (e) { this.items = []; } }
    save() { localStorage.setItem(this.key, JSON.stringify(this.items)); }
    bind() {
      this.addBtn.addEventListener("click", () => this.add(this.input.value));
      this.input.addEventListener("keydown", e => { if (e.key === "Enter") this.add(this.input.value); });
      this.list.addEventListener("click", e => {
        const btn = e.target.closest("[data-act]");
        if (!btn) return;
        const i = +btn.dataset.i;
        if (btn.dataset.act === "toggle") this.items[i].done = !this.items[i].done;
        if (btn.dataset.act === "del") this.items.splice(i, 1);
        this.save(); this.render();
      });
      this.clearBtn.addEventListener("click", () => { this.items = this.items.filter(i => !i.done); this.save(); this.render(); });
    }
    add(text) {
      text = text.trim();
      if (!text) return;
      this.items.push({ text, done: false });
      this.input.value = "";
      this.save(); this.render();
    }
    render() {
      if (!this.items.length) this.list.innerHTML = `<div class="plan-empty">还没有记录，添加第一条吧 ✦</div>`;
      else this.list.innerHTML = this.items.map((it, i) => `
        <li class="${it.done ? "done" : ""}">
          <div class="chk" data-act="toggle" data-i="${i}">${it.done ? "✓" : ""}</div>
          <span class="txt">${escapeHtml(it.text)}</span>
          <button class="del" data-act="del" data-i="${i}">×</button>
        </li>`).join("");
      const total = this.items.length;
      const done = this.items.filter(i => i.done).length;
      this.progress.style.width = (total ? (done / total * 100) : 0) + "%";
      this.label.textContent = total ? `已完成 ${done} / ${total}` : "暂无记录";
    }
  }

  // Initialize all generic trackers
  $$(".tracker").forEach(el => new Tracker(el).init());

  /* ---------- Daily Plan (date-keyed) ---------- */
  const planKey = todayKey("wb_plan");
  let planItems = [];
  try { planItems = JSON.parse(localStorage.getItem(planKey)) || []; } catch (e) { planItems = []; }

  function savePlan() { localStorage.setItem(planKey, JSON.stringify(planItems)); }

  // 从文本解析时长：“背单词30分钟” / “跑步1小时” / “开会45分”
  function parseDuration(text) {
    let dur = null;
    const h = text.match(/(\d+(?:\.\d+)?)\s*小时/);
    const m = text.match(/(\d+)\s*(?:分钟|分|min)/i);
    if (h) dur = Math.round(parseFloat(h[1]) * 60);
    else if (m) dur = parseInt(m[1], 10);
    const clean = text
      .replace(/\d+(?:\.\d+)?\s*小时/, "")
      .replace(/\d+\s*(?:分钟|分|min)/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return { dur, clean };
  }

  function renderPlanList() {
    const listEl = $("#planList");
    if (!listEl) return;
    if (!planItems.length) listEl.innerHTML = `<div class="plan-empty">还没有计划，先添加今天要做的 3 件最小事吧 ✦</div>`;
    else listEl.innerHTML = planItems.map((it, i) => `
      <li class="${it.done ? "done" : ""}">
        <div class="chk" data-act="toggle" data-i="${i}">${it.done ? "✓" : ""}</div>
        <span class="txt">${escapeHtml(it.text)}</span>
        <input class="li-dur" type="number" min="0" step="5" value="${it.duration || ""}" placeholder="时长" data-act="dur" data-i="${i}" title="预估分钟" />
        <button class="del" data-act="del" data-i="${i}">×</button>
      </li>`).join("");
  }
  function renderDashPlan() {
    const listEl = $("#dashPlanList");
    const progEl = $("#dashPlanProgress");
    const labelEl = $("#dashPlanLabel");
    if (!listEl) return;
    const total = planItems.length;
    const done = planItems.filter(i => i.done).length;
    if (!total) listEl.innerHTML = `<div class="plan-empty">今日计划为空，去“每日计划”添加吧 ✦</div>`;
    else {
      const show = planItems.slice(0, 5);
      listEl.innerHTML = show.map((it, i) => `
        <li class="${it.done ? "done" : ""}">
          <div class="chk" style="cursor:default;">${it.done ? "✓" : ""}</div>
          <span class="txt">${escapeHtml(it.text)}</span>
        </li>`).join("");
      if (total > 5) listEl.innerHTML += `<div class="plan-empty">+ ${total - 5} 项更多…</div>`;
    }
    if (progEl) progEl.style.width = (total ? (done / total * 100) : 0) + "%";
    if (labelEl) labelEl.textContent = total ? `已完成 ${done} / ${total}` : "今日计划为空";
  }
  function updatePlan() { savePlan(); renderPlanList(); renderDashPlan(); }
  function planAdd(text, duration) {
    text = text.trim();
    if (!text) return;
    let dur = null;
    if (duration !== undefined && duration !== null && duration !== "") {
      const d = parseInt(duration, 10);
      if (d > 0) dur = d;
    }
    planItems.push({ text, done: false, duration: dur });
    updatePlan();
  }

  /* ---- 每日计划：事件文本 → 智能行程表 ---- */
  const planTextDate = planKey.replace("wb_plan_", "");
  const textKey = "wb_plan_text_" + planTextDate;
  const doneKey = "wb_plan_done_" + planTextDate;
  const $planText = $("#planText");
  const $planSched = $("#planSchedule");

  function savePlanText() { try { localStorage.setItem(textKey, $planText.value); } catch (e) {} }
  function loadDoneMap() { try { return JSON.parse(localStorage.getItem(doneKey)) || {}; } catch (e) { return {}; } }
  function saveDoneMap(m) { try { localStorage.setItem(doneKey, JSON.stringify(m)); } catch (e) {} }

  function appendEvent(t) {
    t = (t || "").trim();
    if (!t) return;
    const cur = $planText.value.trim();
    $planText.value = cur ? cur + "\n" + t : t;
    savePlanText();
    generatePlan();
  }
  $("#planAdd").addEventListener("click", () => {
    const v = $("#planInput").value.trim();
    if (!v) return;
    const d = $("#planDur").value.trim();
    appendEvent(d ? v + " " + d + "分钟" : v);
    $("#planInput").value = ""; $("#planDur").value = ""; $("#planInput").focus();
  });
  $("#planInput").addEventListener("keydown", e => { if (e.key === "Enter") { $("#planAdd").click(); } });
  let _planTextTimer = null;
  $planText.addEventListener("input", () => {
    savePlanText();  // 即时落盘，关闭页面不丢
    if (_planTextTimer) clearTimeout(_planTextTimer);
    _planTextTimer = setTimeout(() => {
      if (typeof window.__planAfterRender === "function") window.__planAfterRender();
    }, 800);
  });
  $("#planExample").addEventListener("click", () => {
    $planText.value = ["9:00 晨会", "背单词30分钟", "健身1小时", "14:00-15:00 项目评审", "重要: 写周报", "买菜", "读论文45分钟"].join("\n");
    savePlanText(); generatePlan();
  });
  $("#planClear").addEventListener("click", () => {
    $planText.value = ""; try { localStorage.removeItem(doneKey); } catch (e) {}
    savePlanText(); generatePlan();
  });
  $("#planGen").addEventListener("click", generatePlan);
  ["planStart", "planGap", "planMeals"].forEach(id => { const el = $("#" + id); if (el) el.addEventListener("change", generatePlan); });

  // 启动：恢复已保存事件并生成行程表
  try { const saved = localStorage.getItem(textKey); if (saved != null) $planText.value = saved; } catch (e) {}
  generatePlan();

  /* ---------- Voice input for daily plan (Web Speech API) ---------- */
  (function initVoicePlan() {
    const btn = $("#planVoice");
    const input = $("#planInput");
    const durInput = $("#planDur");
    const status = $("#planVoiceStatus");
    if (!btn || !input) return;
    function setStatus(msg, kind) {
      if (!status) return;
      status.textContent = msg || "";
      status.className = "plan-voice-status" + (kind ? " " + kind : "");
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    /* ---------- 原生 Web Speech（Chrome / Edge 支持，更快） ---------- */
    if (SR) {
      let rec = null, listening = false;
      function stop() {
        try { if (rec) rec.stop(); } catch (e) {}
        listening = false;
        btn.classList.remove("listening");
        btn.textContent = "🎤";
        input.classList.remove("voice-typing");
      }
      btn.addEventListener("click", () => {
        if (listening) { stop(); setStatus("已停止。"); return; }
        if (!rec) {
          rec = new SR();
          rec.lang = "zh-CN";
          rec.interimResults = true;
          rec.continuous = false;
          rec.onresult = e => {
            let interim = "", finalText = "";
            for (let k = e.resultIndex; k < e.results.length; k++) {
              const t = e.results[k][0].transcript;
              if (e.results[k].isFinal) finalText += t; else interim += t;
            }
            const txt = finalText || interim;
            if (txt) {
              input.value = txt;
              input.classList.add("voice-typing");
              if (finalText) {
                const { dur, clean } = parseDuration(finalText);
                input.value = clean || finalText;
                if (dur) durInput.value = dur;
                setStatus("✓ 识别完成，可点「添加」。", "ok");
              } else {
                setStatus("聆听中…说完会自动填入");
              }
            }
          };
          rec.onerror = ev => {
            const map = {
              "not-allowed": "麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试。",
              "service-not-allowed": "麦克风权限被拒绝（需在 https / localhost 下使用）。",
              "no-speech": "没听到声音，请再点一次 🎤 并靠近说话。",
              "audio-capture": "没检测到麦克风设备。",
              "network": "⚠️ 语音服务连接失败：当前网络无法访问 Google 语音识别（国内常因网络限制）。本应用已内置「离线识别」，在 Safari 或网络受限时自动启用。",
              "aborted": "识别被中断，请再点一次 🎤。"
            };
            setStatus("⚠️ " + (map[ev.error] || ("识别出错：" + ev.error)));
            stop();
          };
          rec.onend = () => { if (listening) stop(); };
        }
        listening = true;
        btn.classList.add("listening");
        btn.textContent = "●";
        setStatus("聆听中…请说话");
        try { rec.start(); } catch (e) { setStatus("⚠️ 无法启动识别：" + (e && e.message ? e.message : e)); }
      });
      return;
    }

    /* ---------- 离线 Whisper（Safari / 国内网络 可用，纯本地） ---------- */
    btn.title = "离线语音识别（首次需加载模型，约几十秒）";
    let transcriber = null, loading = false, recording = false, mediaStream = null, mediaRec = null, chunks = [], recTimer = null;

    async function ensureModel() {
      if (transcriber) return true;
      if (loading) return false;
      loading = true;
      setStatus("正在加载离线语音引擎（首次约几十秒，请稍候）…", "");
      try {
        const mod = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0");
        const { pipeline, env } = mod;
        try { env.modelBaseUrl = "https://hf-mirror.com"; } catch (e) {}
        transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", { device: "wasm" });
        setStatus("引擎就绪，点 🎤 开始说话。", "ok");
        return true;
      } catch (e) {
        setStatus("⚠️ 离线引擎加载失败（可能网络无法访问模型源）。可换 Chrome / Edge 或用下方手动输入。", "warn");
        loading = false;
        return false;
      }
    }

    async function captureToFloat() {
      const blob = new Blob(chunks, { type: (mediaRec && mediaRec.mimeType) || "audio/webm" });
      const arr = await blob.arrayBuffer();
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const buf = await ac.decodeAudioData(arr);
      const targetRate = 16000;
      const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * targetRate)), targetRate);
      const src = offline.createBufferSource();
      src.buffer = buf;
      src.connect(offline.destination);
      src.start();
      const rendered = await offline.startRendering();
      return rendered.getChannelData(0);
    }

    function stopRecording() {
      if (recTimer) { clearTimeout(recTimer); recTimer = null; }
      try { if (mediaRec && mediaRec.state && mediaRec.state !== "inactive") mediaRec.stop(); } catch (e) {}
      recording = false;
      btn.classList.remove("listening");
      btn.textContent = "🎤";
    }

    btn.addEventListener("click", async () => {
      if (recording) { stopRecording(); return; }
      if (!transcriber) {
        const ok = await ensureModel();
        if (!ok) return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("⚠️ 当前环境不支持麦克风采集。", "warn");
        return;
      }
      if (typeof MediaRecorder === "undefined") {
        setStatus("⚠️ 当前浏览器版本过低，不支持录音。请升级 Safari 或用 Chrome / Edge。", "warn");
        return;
      }
      setStatus("聆听中…再次点击 🎤 结束并识别（最长 30 秒）", "");
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        setStatus("⚠️ 麦克风权限被拒绝，请在浏览器允许后重试。", "warn");
        return;
      }
      chunks = [];
      mediaRec = new MediaRecorder(mediaStream);
      mediaRec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      mediaRec.onstop = async () => {
        recording = false;
        setStatus("识别中…", "");
        try {
          const floats = await captureToFloat();
          const out = await transcriber(floats, { language: "chinese", task: "transcribe", chunk_length_s: 30, stride_length_s: 5 });
          const text = (out && out.text ? out.text : "").trim();
          if (text) {
            const { dur, clean } = parseDuration(text);
            input.value = clean || text;
            input.classList.add("voice-typing");
            if (dur) durInput.value = dur;
            setStatus("✓ 识别完成，可点「添加」。", "ok");
          } else setStatus("没听清，请再试一次。", "warn");
        } catch (e) {
          setStatus("⚠️ 识别失败：" + (e && e.message ? e.message : e), "warn");
        } finally {
          if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
        }
      };
      mediaRec.start();
      recording = true;
      btn.classList.add("listening");
      btn.textContent = "■";
      recTimer = setTimeout(() => { if (recording) stopRecording(); }, 30000);
    });
  })();

  /* ---------- 每日计划：智能行程表生成 ---------- */
  function generatePlan() {
    const out = $("#planSchedule");
    if (!out) return;
    const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const fmt = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };

    function parseLine(raw, idx) {
      let s = (raw || "").trim();
      let priority = "中";
      let m;
      if ((m = s.match(/^(重要|紧急|!|\*高|高:)\s*/))) { priority = "高"; s = s.slice(m[0].length); }
      else if ((m = s.match(/^(低|不急|稍后|低:)\s*/))) { priority = "低"; s = s.slice(m[0].length); }
      s = s.replace(/^[:：、]\s*/, "");
      let fixedStart = null, fixedEnd = null;
      if ((m = s.match(/(\d{1,2}):(\d{2})\s*[-~—]\s*(\d{1,2}):(\d{2})/))) {
        fixedStart = (+m[1]) * 60 + (+m[2]); fixedEnd = (+m[3]) * 60 + (+m[4]); s = s.replace(m[0], " ");
      } else if ((m = s.match(/(\d{1,2}):(\d{2})/))) {
        fixedStart = (+m[1]) * 60 + (+m[2]); s = s.replace(m[0], " ");
      }
      let dur = null;
      if ((m = s.match(/(\d+(?:\.\d+)?)\s*小时/))) dur = Math.round(parseFloat(m[1]) * 60);
      else if ((m = s.match(/(\d+)\s*(?:分钟|分|min)/i))) dur = parseInt(m[1], 10);
      let label = s.replace(/\d+(?:\.\d+)?\s*小时/g, "").replace(/\d+\s*(?:分钟|分|min)/gi, "").replace(/\s{2,}/g, " ").trim();
      if (!label) label = (raw || "").trim();
      if (dur == null && fixedStart != null && fixedEnd != null) dur = fixedEnd - fixedStart;
      if (dur == null) dur = 45;
      if (dur < 5) dur = 5;
      return { raw: raw, label, priority, fixedStart, fixedEnd, dur, idx };
    }

    const lines = ($planText.value || "").split("\n").map(x => x.trim()).filter(Boolean);
    if (!lines.length) {
      out.innerHTML = `<div class="sched-empty">在上方输入今天要做的事，每行一件，然后点「🤖 智能规划」。<br>支持写法：<b>9:00 晨会</b>（固定时间）、<b>14:00-15:00 评审</b>（固定时段）、<b>背单词30分钟</b> / <b>健身1小时</b>（时长）、<b>重要: 写周报</b>（优先级）。</div>`;
      updatePlanProgress(0, 0);
      if (typeof window.__planAfterRender === "function") window.__planAfterRender();
      return;
    }
    const startEl = $("#planStart"), gapEl = $("#planGap"), mealsEl = $("#planMeals");
    const startMin = startEl && startEl.value ? toMin(startEl.value) : 8 * 60;
    const gap = Math.max(0, parseInt(gapEl && gapEl.value, 10) || 0);
    const mealsOn = mealsEl ? mealsEl.checked : true;
    const items = lines.map((ln, i) => parseLine(ln, i));
    const fixed = items.filter(it => it.fixedStart != null).sort((a, b) => a.fixedStart - b.fixedStart);
    const prioRank = { "高": 0, "中": 1, "低": 2 };
    const flex = items.filter(it => it.fixedStart == null).sort((a, b) => (prioRank[a.priority] - prioRank[b.priority]) || (b.dur - a.dur) || (a.idx - b.idx));
    const MEALS = [[7 * 60, 9 * 60, "🌅 早餐"], [12 * 60, 13 * 60, "🍱 午餐 / 午休"], [19 * 60, 20 * 60, "🌙 晚餐 / 休息"]];
    const blocks = [];
    const warnings = [];
    let cursor = startMin, fi = 0;

    function fillFlex(from, limit) {
      let c = from;
      while (flex.length) {
        const it = flex[0];
        if (mealsOn) {
          for (const [s, e, lbl] of MEALS) {
            if (c < e && c + it.dur > s) {
              if (c < s) blocks.push({ meal: true, label: lbl, s, e });
              c = e;
            }
          }
        }
        const end = c + it.dur;
        if (end + gap > limit) break;
        flex.shift();
        blocks.push({ ...it, s: c, e: end });
        c = end + gap;
      }
      return c;
    }

    while (fi < fixed.length || flex.length) {
      if (fi < fixed.length && (flex.length === 0 || fixed[fi].fixedStart <= cursor)) {
        const f = fixed[fi];
        const s = f.fixedStart;
        const e = (f.fixedEnd != null) ? f.fixedEnd : (s + f.dur);
        if (s < cursor) warnings.push(`「${f.label}」固定时间 ${fmt(s)} 与前面安排重叠，已按固定时间放置。`);
        if (s > cursor && flex.length) cursor = fillFlex(cursor, s);
        else if (s > cursor) cursor = s;
        blocks.push({ ...f, s, e, fixed: true });
        cursor = e + gap;
        fi++;
      } else {
        const limit = (fi < fixed.length) ? fixed[fi].fixedStart : Infinity;
        cursor = fillFlex(cursor, limit);
        if (flex.length && fi < fixed.length) cursor = fixed[fi].fixedStart;
        else break;
      }
    }

    blocks.sort((a, b) => a.s - b.s);
    const doneMap = loadDoneMap();
    const taskBlocks = blocks.filter(b => !b.meal);
    const total = taskBlocks.length;
    const done = taskBlocks.filter(b => doneMap["i" + b.idx]).length;
    const totalMin = blocks.reduce((a, b) => a + (b.meal ? 0 : b.dur), 0);

    const html = blocks.map(b => {
      if (b.meal) return `<div class="sched-block meal"><span class="sched-time">${fmt(b.s)}–${fmt(b.e)}</span><span class="sched-label">${b.label}</span></div>`;
      const key = "i" + b.idx;
      const isDone = !!doneMap[key];
      const prioTag = b.priority === "高" ? '<span class="sched-prio high">高</span>' : b.priority === "低" ? '<span class="sched-prio low">低</span>' : "";
      const fixedTag = b.fixed ? '<span class="sched-prio fixed">📌固定</span>' : "";
      return `<div class="sched-block${isDone ? " done" : ""}">
        <label class="sched-check"><input type="checkbox" data-key="${key}" ${isDone ? "checked" : ""} /></label>
        <span class="sched-time">${fmt(b.s)}–${fmt(b.e)}</span>
        <span class="sched-label">${escapeHtml(b.label)}</span>
        ${prioTag}${fixedTag}
        <span class="sched-dur">${b.dur}′</span>
      </div>`;
    }).join("");

    out.innerHTML = `
      <div class="sched-head">📅 今日行程表　<span class="sched-meta">${total} 项 · 预计 ${(totalMin / 60).toFixed(1)} 小时 · ${mealsOn ? "含三餐" : "不含三餐"}</span></div>
      <div class="sched-list">${html}</div>
      ${warnings.length ? `<div class="sched-note">⚠️ ${escapeHtml(warnings.join(" "))}</div>` : `<div class="sched-note">※ 固定时间任务优先占位；弹性任务按「优先级→时长」填入空档并自动避开三餐；勾选可记录完成进度。</div>`}`;

    out.querySelectorAll('input[type="checkbox"][data-key]').forEach(cb => {
      cb.addEventListener("change", () => {
        const mp = loadDoneMap();
        if (cb.checked) mp[cb.dataset.key] = 1; else delete mp[cb.dataset.key];
        saveDoneMap(mp);
        const blk = cb.closest(".sched-block"); if (blk) blk.classList.toggle("done", cb.checked);
        updatePlanProgressFromDom();
        if (typeof window.__planAfterRender === "function") window.__planAfterRender();
      });
    });
    updatePlanProgressFromDom();
    if (typeof window.__planAfterRender === "function") window.__planAfterRender();
  }

  function updatePlanProgressFromDom() {
    const out = $("#planSchedule");
    if (!out) return;
    const total = out.querySelectorAll(".sched-block:not(.meal)").length;
    const done = out.querySelectorAll(".sched-block:not(.meal) input:checked").length;
    const prog = $("#planProgress"), label = $("#planProgressLabel");
    if (prog) prog.style.width = (total ? (done / total * 100) : 0) + "%";
    if (label) label.textContent = total ? `已完成 ${done} / ${total}` : "暂无安排";
  }
  function updatePlanProgress(total, done) {
    const prog = $("#planProgress"), label = $("#planProgressLabel");
    if (prog) prog.style.width = (total ? (done / total * 100) : 0) + "%";
    if (label) label.textContent = total ? `已完成 ${done} / ${total}` : "暂无安排";
  }

  /* ---------- 历史任务归档：按日期折叠 ---------- */
  const PH_OPEN_KEY = "ui_plan_hist_open";      // 展开的日期（本机 UI 状态，不参与云同步）
  const PH_HIDEDONE_KEY = "ui_plan_hide_done";  // 今日行程是否折叠已完成
  const PH_WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  let phFilter = "all";

  // 本模块自带日期助手（fmtDate/today 在文件后段才定义，这里不能引用）
  function phToday() {
    const d = new Date(), p = n => (n < 10 ? "0" : "") + n;
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function phLoadOpen() { try { return JSON.parse(localStorage.getItem(PH_OPEN_KEY)) || []; } catch (e) { return []; } }
  function phSaveOpen(a) { try { localStorage.setItem(PH_OPEN_KEY, JSON.stringify(a)); } catch (e) {} }

  // 把一行原始文本拆成 时间 / 优先级 / 时长 / 纯任务名
  function phCleanLabel(raw) {
    let s = (raw || "").trim();
    let prio = "", time = "", dur = "", m;
    if ((m = s.match(/^(重要|紧急|!|\*高|高:)\s*/))) { prio = "高"; s = s.slice(m[0].length); }
    else if ((m = s.match(/^(低|不急|稍后|低:)\s*/))) { prio = "低"; s = s.slice(m[0].length); }
    s = s.replace(/^[:：、]\s*/, "");
    if ((m = s.match(/(\d{1,2}):(\d{2})\s*[-~—]\s*(\d{1,2}):(\d{2})/))) { time = m[0]; s = s.replace(m[0], " "); }
    else if ((m = s.match(/(\d{1,2}):(\d{2})/))) { time = m[0]; s = s.replace(m[0], " "); }
    if ((m = s.match(/(\d+(?:\.\d+)?)\s*小时/))) dur = m[0];
    else if ((m = s.match(/(\d+)\s*(?:分钟|分|min)/i))) dur = m[0];
    let label = s.replace(/\d+(?:\.\d+)?\s*小时/g, "").replace(/\d+\s*(?:分钟|分|min)/gi, "").replace(/\s{2,}/g, " ").trim();
    if (!label) label = (raw || "").trim();
    return { label, prio, time, dur };
  }

  // 扫描 localStorage，把所有日期的计划整理成 [{date, tasks:[...]}]，按日期倒序
  function phCollect() {
    const dates = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      let m = k.match(/^wb_plan_text_(\d{4}-\d{2}-\d{2})$/);
      if (m) { (dates[m[1]] = dates[m[1]] || {}).text = true; continue; }
      m = k.match(/^wb_plan_(\d{4}-\d{2}-\d{2})$/);
      if (m) (dates[m[1]] = dates[m[1]] || {}).legacy = true;
    }
    return Object.keys(dates).sort().reverse().map(date => {
      const tasks = [];
      let doneMap = {};
      try { doneMap = JSON.parse(localStorage.getItem("wb_plan_done_" + date)) || {}; } catch (e) { doneMap = {}; }
      if (dates[date].text) {
        const lines = (localStorage.getItem("wb_plan_text_" + date) || "")
          .split("\n").map(x => x.trim()).filter(Boolean);
        lines.forEach((ln, idx) => {
          const c = phCleanLabel(ln);
          tasks.push({ label: c.label, prio: c.prio, time: c.time, dur: c.dur, done: !!doneMap["i" + idx] });
        });
      } else if (dates[date].legacy) {
        let arr = [];
        try { arr = JSON.parse(localStorage.getItem("wb_plan_" + date)) || []; } catch (e) { arr = []; }
        arr.forEach(it => {
          if (!it || !it.text) return;
          const c = phCleanLabel(it.text);
          tasks.push({ label: c.label, prio: c.prio, time: c.time, dur: it.duration ? it.duration + "分钟" : c.dur, done: !!it.done });
        });
      }
      return { date, tasks };
    }).filter(g => g.tasks.length);
  }

  function phRender() {
    const box = $("#planHistory");
    if (!box) return;
    const groups = phCollect();
    const openSet = phLoadOpen();
    const todayStr = phToday();
    const sub = $("#phSub");

    if (!groups.length) {
      box.innerHTML = `<div class="ph-empty">还没有历史记录 ✦<br>写下今天的事件并在行程表里勾选完成，这里就会按日期自动归档。</div>`;
      if (sub) sub.textContent = "按日期折叠 · 点标题展开";
      return;
    }

    let totalAll = 0, totalDone = 0, dayAllDone = 0;
    const html = groups.map(g => {
      const all = g.tasks.length;
      const done = g.tasks.filter(t => t.done).length;
      totalAll += all; totalDone += done;
      const full = all > 0 && done === all;
      if (full) dayAllDone++;
      let list = g.tasks;
      if (phFilter === "done") list = list.filter(t => t.done);
      else if (phFilter === "undone") list = list.filter(t => !t.done);
      if (!list.length) return "";
      const pct = all ? Math.round(done / all * 100) : 0;
      const isToday = g.date === todayStr;
      // 今天默认展开；其它日期记住上次的展开状态；「全部完成」的日子默认收起
      const open = isToday || openSet.indexOf(g.date) >= 0;
      let wd = "";
      try { wd = PH_WD[new Date(g.date + "T00:00:00").getDay()]; } catch (e) {}
      return `<details class="ph-day${full ? " all-done" : ""}" data-date="${g.date}"${open ? " open" : ""}>
        <summary class="ph-sum">
          <span class="ph-arrow">▸</span>
          <span class="ph-date">${isToday ? "今天" : g.date}</span>
          <span class="ph-wd">${wd}</span>
          <span class="ph-stat${full ? " full" : ""}">${done}/${all}</span>
          <span class="ph-bar"><i style="width:${pct}%"></i></span>
          ${full ? '<span class="ph-badge">全部完成 🎉</span>' : ""}
        </summary>
        <ul class="ph-tasks">
          ${list.map(t => `<li class="${t.done ? "done" : ""}">
            <span class="ph-mark">${t.done ? "✓" : "○"}</span>
            ${t.time ? `<span class="ph-time">${escapeHtml(t.time)}</span>` : ""}
            <span class="ph-label">${escapeHtml(t.label)}</span>
            ${t.prio === "高" ? '<span class="ph-tag high">高</span>' : (t.prio === "低" ? '<span class="ph-tag low">低</span>' : "")}
            ${t.dur ? `<span class="ph-dur">${escapeHtml(t.dur)}</span>` : ""}
          </li>`).join("")}
        </ul>
      </details>`;
    }).join("");

    box.innerHTML = html || `<div class="ph-empty">该筛选下暂无任务</div>`;
    if (sub) sub.textContent = `${groups.length} 天记录 · 累计完成 ${totalDone}/${totalAll} · 全勤 ${dayAllDone} 天`;

    box.querySelectorAll("details.ph-day").forEach(d => {
      d.addEventListener("toggle", () => {
        const set = phLoadOpen();
        const date = d.getAttribute("data-date");
        const i = set.indexOf(date);
        if (d.open && i < 0) set.push(date);
        if (!d.open && i >= 0) set.splice(i, 1);
        phSaveOpen(set);
      });
    });
  }

  // 筛选切换
  document.querySelectorAll(".ph-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      phFilter = btn.getAttribute("data-f") || "all";
      document.querySelectorAll(".ph-tab").forEach(b => b.classList.toggle("active", b === btn));
      phRender();
    });
  });
  if ($("#phExpandAll")) $("#phExpandAll").addEventListener("click", () => {
    const all = phCollect().map(g => g.date);
    phSaveOpen(all);
    document.querySelectorAll("#planHistory details.ph-day").forEach(d => { d.open = true; });
  });
  if ($("#phCollapseAll")) $("#phCollapseAll").addEventListener("click", () => {
    phSaveOpen([]);
    document.querySelectorAll("#planHistory details.ph-day").forEach(d => { d.open = false; });
  });

  // 今日行程「收起已完成」
  const $hideDone = $("#planHideDone");
  function applyHideDone() {
    const on = $hideDone ? $hideDone.checked : false;
    const list = document.querySelector("#planSchedule .sched-list");
    if (list) list.classList.toggle("hide-done", on);
  }
  if ($hideDone) {
    try { $hideDone.checked = localStorage.getItem(PH_HIDEDONE_KEY) === "1"; } catch (e) {}
    $hideDone.addEventListener("change", () => {
      try { localStorage.setItem(PH_HIDEDONE_KEY, $hideDone.checked ? "1" : "0"); } catch (e) {}
      applyHideDone();
    });
  }
  window.__planAfterRender = function () { applyHideDone(); phRender(); };
  window.__planAfterRender();

  /* ---------- Render content modules ---------- */
  /* ---------- 每日新闻：多版面 ---------- */
  (function renderNews() {
    const N = D.news || {};
    const today = N.today || {};
    const sections = today.sections || [];
    const $date = $("#newsDate"), $upd = $("#newsUpdated"), $cnt = $("#newsCount"), $filter = $("#newsFilter"), $box = $("#news");
    if ($date) $date.textContent = (today.date || "") + " " + (today.weekday || "");
    if ($upd) $upd.textContent = "更新于 " + (N.updated || "");
    const total = sections.reduce((a, s) => a + (s.items ? s.items.length : 0), 0);
    if ($cnt) $cnt.textContent = sections.length + " 个版面 · 共 " + total + " 条";
    const build = (filter) => {
      const list = (!filter || filter === "全部") ? sections : sections.filter(s => s.name === filter);
      if (!list.length) return `<div class="news-empty">今日暂无该版面新闻</div>`;
      return list.map(s => `
        <div class="news-section">
          <div class="news-sec-head"><span>${s.name}</span><span class="news-sec-num">${s.items.length} 条</span></div>
          ${s.items.map(it => `
            <div class="news-item">
              <div class="t"><span class="tag">${s.name}</span><span>${it.title}</span></div>
              <div class="d">${it.desc}</div>
              <div class="src">来源：${it.source} · <a class="news-link" href="${it.url}" target="_blank" rel="noopener">查看原文 ↗</a></div>
            </div>`).join("")}
        </div>`).join("");
    };
    let cur = "全部";
    const renderFilter = () => {
      const names = ["全部", ...sections.map(s => s.name)];
      $filter.innerHTML = names.map(n => `<button class="news-chip${n === cur ? " active" : ""}" data-f="${n}">${n}</button>`).join("");
      $filter.querySelectorAll(".news-chip").forEach(b => {
        b.addEventListener("click", () => { cur = b.dataset.f; renderFilter(); $box.innerHTML = build(cur); });
      });
    };
    renderFilter();
    $box.innerHTML = build(cur);
  })();

  (function renderHot() {
    const H = D.dailyHot || {};
    const platforms = H.platforms || ["微博", "抖音", "小红书", "B站", "快手", "公众号", "知乎"];
    const $date = $("#hotDate"), $upd = $("#hotUpdated"), $box = $("#hotPlatforms"), $btn = $("#hotRefresh");

    // 实时接口（免费、可跨域的热榜 API），覆盖有接口的平台
    const HOT_LIVE = {
      "微博": "https://60s.viki.moe/v2/weibo",
      "抖音": "https://60s.viki.moe/v2/douyin",
      "知乎": "https://60s.viki.moe/v2/zhihu",
      "头条": "https://60s.viki.moe/v2/toutiao"
    };
    // 「● 实时」徽章平台：data.js 里由实时接口/官方接口生成（B站走官方API）
    const LIVE_PF = new Set(["微博", "抖音", "知乎", "B站"]);
    const PF_TAG = { "微博": "社会", "抖音": "娱乐", "知乎": "知识", "头条": "综合", "小红书": "生活", "B站": "影视", "快手": "生活", "公众号": "深度" };

    // 数据按平台分组（先取 data.js 兜底）
    let byPf = {};
    platforms.forEach(p => byPf[p] = []);
    ((H.today && H.today.items) || []).forEach(it => {
      if (!byPf[it.platform]) byPf[it.platform] = [];
      byPf[it.platform].push(it);
    });

    const fmtHot = (v) => {
      v = Number(v) || 0;
      if (v >= 1e8) return (v / 1e8).toFixed(2) + "亿";
      if (v >= 1e4) return (v / 1e4).toFixed(1) + "万";
      return String(v);
    };
    const esc = (s) => String(s == null ? "" : s);

    // 各平台「查看原文」兜底搜索链接（原文 url 为空时使用，保证可打开）
    const SEARCH = {
      "快手": t => "https://www.kuaishou.com/search/video?searchKey=" + encodeURIComponent(t),
      "小红书": t => "https://www.xiaohongshu.com/search_result?keyword=" + encodeURIComponent(t),
      "公众号": t => "https://weixin.sogou.com/weixin?type=2&query=" + encodeURIComponent(t),
      "B站": t => "https://search.bilibili.com/all?keyword=" + encodeURIComponent(t),
      "抖音": t => "https://www.douyin.com/search/" + encodeURIComponent(t),
      "微博": t => "https://s.weibo.com/weibo?q=" + encodeURIComponent(t),
      "知乎": t => "https://www.zhihu.com/search?type=content&q=" + encodeURIComponent(t)
    };
    // 移动端判断：小红书 PC 端用 search_result、移动端 H5 用 web_search_result（两者互斥，需按设备选）
    const isMobile = () => /Android|iPhone|iPad|iPod|Mobile|Windows Phone|MQQBrowser|MicroMessenger/i.test(navigator.userAgent || "");
    function linkFor(it) {
      // 小红书：若有真实笔记直达链接（it.url 且非搜索链接），优先使用 → 直达具体帖子
      if (it.platform === "小红书" && it.url && !it.url.includes("search_result") && !it.url.includes("web_search_result")) {
        return it.url;
      }
      // 小红书：无真实链接时，电脑端 search_result / 手机端 web_search_result，按 UA 动态生成（两端都能打开）
      if (it.platform === "小红书") {
        const kw = encodeURIComponent(it.title);
        return isMobile()
          ? "https://www.xiaohongshu.com/web_search_result?keyword=" + kw
          : "https://www.xiaohongshu.com/search_result?keyword=" + kw;
      }
      if (it.url) return it.url;
      const mk = SEARCH[it.platform];
      return mk ? mk(it.title) : ("https://www.baidu.com/s?wd=" + encodeURIComponent(it.title));
    }

    function itemHtml(it) {
      return `
        <div class="hot-item">
          <span class="hot-rank">${esc(it.rank)}</span>
          <div class="hot-main">
            <div class="hot-title">${esc(it.title)}</div>
            <div class="hot-meta">
              <span class="hot-fire">🔥 ${esc(it.hot)}</span>
              <span class="hot-tag">${esc(it.tag || PF_TAG[it.platform] || "")}</span>
              <a class="hot-link" href="${esc(linkFor(it))}" target="_blank" rel="noopener">查看原文 ↗</a>
            </div>
          </div>
        </div>`;
    }
    function platformHtml(p) {
      const list = (byPf[p] || []).slice(0, 25);
      const badge = LIVE_PF.has(p) ? '<span class="hot-live">● 实时</span>' : '<span class="hot-cache">每日更新</span>';
      const scrollHint = list.length > 8 ? '<span class="hot-scroll">⇅ 上下滚动</span>' : '';
      const body = list.length ? list.map(itemHtml).join("") : '<div class="hot-empty">该平台暂无数据</div>';
      return `
        <div class="hot-plat">
          <div class="hot-plat-head"><span class="hot-plat-name">${esc(p)}</span>${badge}<span class="hot-scroll">${scrollHint}</span><span class="hot-plat-cnt">${list.length} 条</span></div>
          <div class="hot-plat-list">${body}</div>
        </div>`;
    }
    function renderAll() {
      if ($date) $date.textContent = ((H.today && H.today.date) || "") + " " + ((H.today && H.today.weekday) || "");
      if ($upd) $upd.textContent = "更新于 " + (H.updated || "—");
      if ($box) $box.innerHTML = platforms.map(platformHtml).join("");
    }
    renderAll();

    async function manualRefresh() {
      if (!$btn) return;
      const old = $btn.textContent;
      $btn.textContent = "更新中…";
      $btn.disabled = true;
      const tasks = [];
      platforms.forEach(p => {
        const url = HOT_LIVE[p];
        if (!url) return;
        tasks.push(
          fetch(url).then(r => r.ok ? r.json() : null).then(j => {
            if (!j || j.code !== 200 || !Array.isArray(j.data)) return null;
            const arr = j.data.slice(0, 25).map((d, i) => {
              const raw = d.hot_value != null ? d.hot_value : (d.hot_value_desc || "");
              const hot = (typeof raw === "number") ? fmtHot(raw) : String(raw);
              return {
                platform: p, rank: i + 1, title: d.title,
                hot: hot,
                url: d.link || (SEARCH[p] ? SEARCH[p](d.title) : ("https://www.baidu.com/s?wd=" + encodeURIComponent(d.title))),
                tag: PF_TAG[p] || "", desc: ""
              };
            });
            return { p, arr };
          }).catch(() => null)
        );
      });
      const res = await Promise.all(tasks);
      let got = 0;
      res.forEach(r => { if (r && r.arr.length) { byPf[r.p] = r.arr; got++; } });
      const now = new Date();
      const pad = n => String(n).padStart(2, "0");
      H.updated = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      renderAll();
      $btn.textContent = got ? "✅ 已更新 " + got + " 个平台" : "实时接口暂不可用";
      setTimeout(() => { $btn.textContent = old; $btn.disabled = false; }, 2500);
    }
    if ($btn) $btn.addEventListener("click", manualRefresh);
  })();

  const $notesIdea = $("#notesIdea");
  if ($notesIdea) $notesIdea.innerHTML = D.inspiration.map(i => `
    <div class="idea-quote"><div class="q">${i.quote}</div><div class="f">—— ${i.from}</div></div>`).join("");


  // 自媒体：每日网络热梗
  (function renderMemes() {
    const M = D.dailyMemes || {};
    const $date = $("#memeDate"), $upd = $("#memeUpdated"), $sum = $("#memeSummary"), $box = $("#memeGroups");
    if (!$box) return;
    if ($date && M.date) $date.textContent = M.date + " · 每日更新";
    if ($upd) $upd.textContent = M.updated ? "更新于 " + M.updated : "";
    const items = M.items || [];
    // 顶部概要：当日热点一句话 + 今日热梗数
    if ($sum) {
      $sum.innerHTML = items.length
        ? `<span class="meme-sum-t">今日 ${items.length} 个热梗</span>${M.summary ? `<span class="meme-sum-x">${M.summary}</span>` : ""}`
        : `<span class="meme-sum-x">今日热梗正在梳理中，请稍后查看。</span>`;
    }
    // 按分类分组
    const groups = {};
    items.forEach(it => {
      const c = it.category || "其他";
      (groups[c] = groups[c] || []).push(it);
    });
    const catList = Object.keys(groups);
    if (!catList.length) { $box.innerHTML = `<div class="meme-note">暂无热梗数据。</div>`; return; }
    $box.innerHTML = catList.map((cat, gi) => `
      <div class="meme-group">
        <div class="meme-group-head"><span class="mg-icon">${['🔥','💬','🎮','😜','📺'][gi % 5]}</span><span class="mg-name">${cat}</span><span class="mg-count">${groups[cat].length}</span></div>
        <div class="meme-list">
          ${groups[cat].map((it, i) => `
            <div class="meme-item">
              <div class="meme-top">
                <span class="meme-rank">${i + 1}</span>
                <span class="meme-name">${it.name}</span>
                ${it.platform ? `<span class="meme-plat">${it.platform}</span>` : ""}
                ${it.heat != null ? `<span class="meme-heat" style="--mh:${Math.min(100, it.heat)}%"><i></i>${it.heat}</span>` : ""}
              </div>
              ${it.origin ? `<div class="meme-row"><span class="meme-lab">由来</span><span class="meme-txt">${it.origin}</span></div>` : ""}
              ${it.meaning ? `<div class="meme-row"><span class="meme-lab">含义</span><span class="meme-txt">${it.meaning}</span></div>` : ""}
              ${it.usage ? `<div class="meme-row"><span class="meme-lab">用法</span><span class="meme-txt">${it.usage}</span></div>` : ""}
              ${it.tip ? `<div class="meme-row meme-tip"><span class="meme-lab">可蹭</span><span class="meme-txt">${it.tip}</span></div>` : ""}
              ${it.link ? `<a class="meme-link" href="${it.link}" target="_blank" rel="noopener">🔗 查看相关讨论</a>` : ""}
            </div>`).join("")}
        </div>
      </div>`).join("");
  })();

  // podcast content整理
  const upEl = document.getElementById("podcastUpdate");
  if (upEl && D.podcastUpdateTime) upEl.textContent = "更新于 " + D.podcastUpdateTime;
  // 板块展开/收起：点击 .sub-title-collapse 的标题区切换下方 .sec-body 显隐
  document.querySelectorAll(".sub-title-collapse").forEach(title => {
    title.addEventListener("click", (ev) => {
      // 不要拦截「阅读模式」按钮的点击
      if (ev.target.closest(".mode-toggle")) return;
      const body = title.nextElementSibling;
      if (!body || !body.classList.contains("sec-body")) return;
      const open = body.classList.contains("sec-body-hidden");
      body.classList.toggle("sec-body-hidden", !open);
      title.classList.toggle("collapsed", !open);
      const arr = title.querySelector(".sec-arr");
      if (arr) arr.textContent = open ? "▾" : "▸";
    });
  });
  $("#podcastList").innerHTML = D.podcasts.map((p, i) => `
    <div class="pod-item">
      <div class="pod-head">
        <span class="pod-name">${p.name}</span><span class="pod-cat">${p.cat}</span>
        <button class="pod-list-toggle" type="button" data-i="${i}"><span class="pod-list-arr">▸</span></button>
      </div>
      <div class="pod-meta">${p.metric}</div>
      <div class="pod-list-more" id="podMore${i}" hidden>
        <div class="pod-plat">平台：${p.platform}</div>
        <div class="pod-host-line">主播：${p.host}</div>
        <div class="pod-sum">${p.summary}</div>
      </div>
    </div>`).join("");
  // 「当下最值得听的播客」卡片收起/展开
  const podListBox = $("#podcastList");
  if (podListBox) {
    podListBox.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".pod-list-toggle");
      if (!btn) return;
      const i = btn.getAttribute("data-i");
      const more = document.getElementById("podMore" + i);
      if (!more) return;
      const open = more.hidden;
      more.hidden = !open;
      btn.querySelector(".pod-list-arr").textContent = open ? "▾" : "▸";
      btn.classList.toggle("on", open);
    });
  }
  $("#podcastTrends").innerHTML = D.podcastTrends.map(t => `<div class="pod-note">${t}</div>`).join("");
  // 📡 最新单集：各热门播客最新一期（RSS 实时跟随节目更新）
  const podLatestBox = $("#podcastLatest");
  if (podLatestBox) {
    const list = (D.podcastLatest || []).filter(e => e && e.title);
    // 把 RSS 的 pubDate 转成更友好的 MM-DD 显示
    const fmtPub = (raw) => {
      if (!raw) return '';
      const d = new Date(raw);
      if (!isNaN(d)) {
        const m = d.getMonth() + 1, dd = d.getDate();
        return `发布于 ${m < 10 ? '0' + m : m}-${dd < 10 ? '0' + dd : dd}`;
      }
      return raw.replace(/,.*/, '');
    };
    podLatestBox.innerHTML = list.length
      ? list.map((e, i) => `
        <div class="pod-ep pod-latest">
          <div class="pod-ep-head">
            <span class="pod-ep-show">${e.show}</span>
            <span class="pod-ep-title">${e.title}</span>
            ${e.pub ? `<span class="pod-latest-pub">${fmtPub(e.pub)}</span>` : ''}
          </div>
          <div class="pod-latest-insight">
            <div class="pod-latest-core">${e.core || e.insight || ''}</div>
            ${(e.points && e.points.length) ? `<div class="pod-latest-label">📌 本期看点</div><div class="pod-latest-points">${e.points.map(p => `<div class="pod-latest-point">• ${p}</div>`).join("")}</div>` : ''}
            ${e.reason ? `<div class="pod-latest-label">🎧 为什么值得听</div><div class="pod-latest-reason">${e.reason}</div>` : ''}
          </div>
          ${e.full ? `<button class="pod-sum-toggle pod-latest-toggle" type="button" data-latest="${i}">▾ 查看完整深度解读</button><div class="pod-ep-full pod-latest-full" id="podLatestFull${i}" hidden></div>` : ''}
          ${(e.quotes && e.quotes.length) ? `<div class="pod-quotes pod-latest-quotes"><div class="pod-quotes-label">💬 当期重要语句</div>${e.quotes.map(q => `<div class="pod-quote">${q}</div>`).join("")}</div>` : ''}
          ${e.link ? `<a class="pod-latest-link" href="${e.link}" target="_blank" rel="noopener">▶ 收听本期节目</a>` : ''}
        </div>`).join("")
      : `<div class="pod-note">最新单集暂未获取到，请稍后再看。</div>`;

    // 「查看完整深度解读」展开/收起（懒渲染 full 内容）
    podLatestBox.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".pod-latest-toggle");
      if (!btn) return;
      const i = btn.getAttribute("data-latest");
      const full = document.getElementById("podLatestFull" + i);
      if (!full) return;
      if (full.hidden) {
        if (!full.innerHTML) {
          const e = list[i];
          full.innerHTML = (e.full || "").split("\n").map(podLineHtml).join("");
        }
        full.hidden = false;
        btn.textContent = "▴ 收起完整深度解读";
      } else {
        full.hidden = true;
        btn.textContent = "▾ 查看完整深度解读";
      }
    });
  }
  const podEpBox = $("#podcastEpisodes");
  // 把「完整内容」文本行渲染为结构化 HTML：
  //  【…】 → 分节标题；含引号/对话标记的行 → 经典对话（引用样式）；其余 → 正文段落
  function podLineHtml(line) {
    const t = line.trim();
    if (!t) return "";
    const m = t.match(/^【(.+?)】\s*(.*)$/);
    if (m) {
      const title = m[1].replace(/^[📌🗣️🔍💡✨]/u, "").replace(/[\uFE0F\u200D]/g, "").trim();
      const rest = m[2].trim();
      return rest
        ? `<div class="pod-h">【${title}】</div><p>${rest}</p>`
        : `<div class="pod-h">【${title}】</div>`;
    }
    // 经典对话/引用行：以引号开头，或整行本身就是一句"话"
    if (/^[“"']/.test(t) || (t.indexOf("：“") > -1) || (t.indexOf("——") > -1 && t.length < 60)) {
      return `<div class="pod-dlg">${t}</div>`;
    }
    // 内容梳理中的小要点行（以 ▸ 开头）
    if (/^[▸▪•·]/.test(t)) {
      return `<p class="pod-li">${t}</p>`;
    }
    return `<p>${t}</p>`;
  }
  function podFullHtml(e) {
    return (e.full || "").split("\n").map(podLineHtml).join("");
  }
  podEpBox.innerHTML = D.podcastEpisodes.map((e, i) => `
    <div class="pod-ep">
      <div class="pod-ep-head"><span class="pod-ep-show">${e.show}</span><span class="pod-ep-title">${e.title}</span></div>
      <div class="pod-ep-sum">${e.summary}</div>
      <button class="pod-sum-toggle" type="button" data-i="${i}">▾ 查看完整内容</button>
      <div class="pod-ep-full" id="podFull${i}" hidden></div>
      ${e.quotes && e.quotes.length ? `<div class="pod-quotes"><div class="pod-quotes-label">💬 重要语句</div>${e.quotes.map(q => `<div class="pod-quote">${q}</div>`).join("")}</div>` : ""}
    </div>`).join("");
  const podToggle = $("#podToggle");
  if (podToggle) {
    podToggle.addEventListener("click", () => {
      const on = podEpBox.classList.toggle("reading");
      podToggle.textContent = on ? "🗂 卡片模式" : "📖 阅读模式";
    });
  }
  podEpBox.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".pod-sum-toggle");
    if (!btn) return;
    const i = btn.getAttribute("data-i");
    const full = document.getElementById("podFull" + i);
    if (!full) return;
    if (full.hidden) {
      if (!full.innerHTML) full.innerHTML = podFullHtml(D.podcastEpisodes[i]);
      full.hidden = false;
      btn.textContent = "▴ 收起完整内容";
    } else {
      full.hidden = true;
      btn.textContent = "▾ 查看完整内容";
    }
  });

  /* ---------- Memos（我的记录：支持语音 + 图片） ---------- */
  const memoKey = "wb_memos";
  let memos = [];
  try { memos = JSON.parse(localStorage.getItem(memoKey)) || []; } catch (e) { memos = []; }
  // 兼容旧版（纯字符串）→ 对象 { t, img, ts }
  memos = memos.map(m => typeof m === "string" ? { t: m, img: null, ts: 0 } : m);

  let memoImgData = null; // 待添加的压缩后 dataURL

  function autoSize(el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 200) + "px"; }
  function formatMemoTs(ts) {
    if (!ts) return "";
    const d = new Date(ts), p = n => (n < 10 ? "0" + n : "" + n);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function saveMemos() {
    try { localStorage.setItem(memoKey, JSON.stringify(memos)); }
    catch (e) { alert("保存失败：本地存储空间不足，请删减带图片的记录"); }
  }
  function renderMemos() {
    const list = $("#memoList");
    if (!list) return;
    if (!memos.length) list.innerHTML = `<div class="plan-empty">还没有记录 ✦</div>`;
    else list.innerHTML = memos.map((m, i) => `
      <li data-memo-open="${i}">
        ${m.img ? `<img class="memo-img" src="${m.img}" alt="图片" />` : ""}
        <div class="memo-main">
          <span class="memo-text">${escapeHtml(m.t || "")}</span>
          <span class="memo-time">${m.ts ? formatMemoTs(m.ts) : ""}</span>
        </div>
        <button class="del" data-memo-i="${i}" title="删除">×</button>
      </li>`).join("");
  }

  // 图片压缩（避免 localStorage 爆掉）
  function compressImage(file, cb) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 800;
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        cb(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => cb(null);
      img.src = reader.result;
    };
    reader.onerror = () => cb(null);
    reader.readAsDataURL(file);
  }

  $("#memoImgBtn").addEventListener("click", () => $("#memoFile").click());
  $("#memoFile").addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    compressImage(file, dataUrl => {
      if (!dataUrl) { alert("图片读取失败，请换一张"); return; }
      memoImgData = dataUrl;
      $("#memoImgThumb").src = dataUrl;
      $("#memoImgPreview").hidden = false;
    });
    e.target.value = "";
  });
  $("#memoImgClear").addEventListener("click", () => {
    memoImgData = null;
    $("#memoImgPreview").hidden = true;
    $("#memoImgThumb").src = "";
  });

  $("#memoAdd").addEventListener("click", () => {
    const v = $("#memoInput").value.trim();
    if (!v && !memoImgData) return;
    memos.unshift({ t: v, img: memoImgData, ts: Date.now() });
    $("#memoInput").value = "";
    autoSize($("#memoInput"));
    memoImgData = null;
    $("#memoImgPreview").hidden = true;
    $("#memoImgThumb").src = "";
    saveMemos(); renderMemos();
  });
  $("#memoInput").addEventListener("input", e => autoSize(e.target));
  $("#memoInput").addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) $("#memoAdd").click(); });
  $("#memoList").addEventListener("click", e => {
    const del = e.target.closest(".del");
    if (del) {
      memos.splice(+del.dataset.memoI, 1);
      saveMemos(); renderMemos();
      return;
    }
    const open = e.target.closest("[data-memo-open]");
    if (open) openMemoModal(+open.dataset.memoOpen);
  });

  /* 语音输入（Web Speech API） */
  (function bindMemoVoice() {
    const btn = $("#memoVoice"), ta = $("#memoInput");
    if (!btn || !ta) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { btn.title = "当前浏览器不支持语音输入"; btn.disabled = true; return; }
    const rec = new SR();
    rec.lang = "zh-CN"; rec.interimResults = true; rec.continuous = false;
    let finalBuf = "";
    rec.onresult = ev => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalBuf += r[0].transcript; else interim += r[0].transcript;
      }
      ta.value = finalBuf + interim;
      autoSize(ta);
    };
    rec.onerror = () => stop();
    rec.onend = () => stop();
    function stop() {
      btn.classList.remove("recording");
      btn.textContent = "🎤";
      ta.classList.remove("voice-typing");
    }
    function start() {
      finalBuf = ta.value ? ta.value + " " : "";
      btn.classList.add("recording");
      btn.textContent = "🔴";
      ta.classList.add("voice-typing");
      try { rec.start(); } catch (e) {}
    }
    btn.addEventListener("click", () => {
      if (btn.classList.contains("recording")) rec.stop(); else start();
    });
  })();

  /* 记录完整内容查看（点击列表项打开） */
  function openMemoModal(i) {
    const m = memos[i];
    if (!m) return;
    const body = $("#memoModalBody");
    if (!body) return;
    body.innerHTML = `
      ${m.ts ? `<div class="mf-view-date">${formatMemoTs(m.ts)}</div>` : ""}
      ${m.t ? `<div class="mf-view-val">${escapeHtml(m.t)}</div>` : (m.img ? `<div class="mf-view-empty">（这条记录只有图片）</div>` : "")}
      ${m.img ? `<div class="mf-view-img"><img src="${m.img}" alt="图片" /></div>` : ""}
    `;
    $("#memoModal").hidden = false;
  }
  (function bindMemoModal() {
    const ov = $("#memoModal");
    if (!ov) return;
    const close = () => { ov.hidden = true; };
    const $c = $("#memoModalClose");
    if ($c) $c.addEventListener("click", close);
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !ov.hidden) close(); });
  })();

  /* ---------- 玄学日历（黄历，依赖 lunar.js） ---------- */
  /* 个人命盘：身强戊土 · 属狗 · 上升处女座 · 喜金水木（木为调和） */
  const MY_PROFILE = {
    dayMaster: "戊", strong: true, zodiac: "猴",
    asc: "处女座", fav: ["金", "水", "木"], balance: "木"
  };
  const GAN_WX = { "甲":"木","乙":"木","丙":"火","丁":"火","戊":"土","己":"土","庚":"金","辛":"金","壬":"水","癸":"水" };
  const ZHI_WX = { "子":"水","丑":"土","寅":"木","卯":"木","辰":"土","巳":"火","午":"火","未":"土","申":"金","酉":"金","戌":"土","亥":"水" };
  function wxOfChar(ch) { return GAN_WX[ch] || ZHI_WX[ch] || "土"; }
  /* 喜用神配色：金白/水黑/木绿；土火日无喜用时以木(调和)或水(制火)兜底 */
  const ELEM_COLOR = {
    "金": { name: "白 · 金 · 银", hex: "#d9d9e2", txt: "#3a3a44" },
    "水": { name: "黑 · 深蓝 · 藏青", hex: "#22324f", txt: "#ffffff" },
    "木": { name: "绿 · 青 · 翠", hex: "#2e7d4f", txt: "#ffffff" },
    "土": { name: "绿（木来调和）", hex: "#2e7d4f", txt: "#ffffff" },
    "火": { name: "黑（水来制火）", hex: "#22324f", txt: "#ffffff" }
  };

  /* 记录当前已渲染的日期，用于跨天自动刷新 */
  var _almKey = "";
  function almDateKey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }

  function renderAlmanac() {
    const body = $("#almBody");
    if (!body) return;
    if (typeof Solar === "undefined" || !Solar.fromDate) {
      body.innerHTML = `<div class="alm-fallback">黄历组件未加载</div>`;
      return;
    }
    try {
      const now = new Date();
      const solar = Solar.fromDate(now);
      const lunar = solar.getLunar();
      const WK = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
      const gzY = lunar.getYearInGanZhi();
      const sx = lunar.getYearShengXiao();
      const lm = lunar.getMonthInChinese();
      const ld = lunar.getDayInChinese();
      const gzM = lunar.getMonthInGanZhi();
      const gzD = lunar.getDayInGanZhi();
      const zhiXing = lunar.getZhiXing();
      const yi = lunar.getDayYi() || [];
      const ji = lunar.getDayJi() || [];
      const chong = lunar.getChong();
      const sha = lunar.getSha();
      const xz = solar.getXingZuo();
      const jq = lunar.getJieQi();
      const jqStr = (jq && jq !== "" && jq !== "无") ? ` · ${jq}` : "";

      /* ---- 个人当日运势（身强戊土 喜金水木·木调和） ---- */
      const dayStem = gzD.charAt(0), dayBranch = gzD.charAt(1);
      const sw = wxOfChar(dayStem), bw = wxOfChar(dayBranch);
      const fav = MY_PROFILE.fav;
      const favCnt = (fav.includes(sw) ? 1 : 0) + (fav.includes(bw) ? 1 : 0);
      const hasWood = (sw === "木" || bw === "木");
      let luckLevel, luckText;
      if (favCnt >= 2) { luckLevel = "大吉"; luckText = "金水木得气，身强得泄得制，思路清、行动顺，宜推进要事、把握机会。"; }
      else if (favCnt === 1) { luckLevel = "平顺"; luckText = "喜用略有帮扶，气场中和，宜按部就班、稳扎稳打。"; }
      else { luckLevel = "守成"; luckText = "土火偏旺、比劫印星当令，身强更盛，宜静不宜动，蓄力守成、重大决定缓一缓。"; }
      if (hasWood) luckText += "木来调和，贵人暗助，沟通合作运佳。";
      const favColors = fav.map(e => `<span class="alm-clr" style="background:${ELEM_COLOR[e].hex};color:${ELEM_COLOR[e].txt}">${ELEM_COLOR[e].name}</span>`).join("");
      const mainElem = hasWood ? "木" : (fav.includes(sw) ? sw : (fav.includes(bw) ? bw : "木"));
      const mainColor = ELEM_COLOR[mainElem];

      const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
      const gd = `${y}年${m}月${d}日`;
      const wk = WK[now.getDay()];
      const lunarStr = `${gzY}${sx}年 ${lm}${ld}`;
      _almKey = almDateKey(now);
      const yiHtml = yi.length
        ? yi.map(x => `<span class="alm-tag yi">${escapeHtml(x)}</span>`).join("")
        : `<span class="alm-tag none">诸事随缘</span>`;
      const jiHtml = ji.length
        ? ji.map(x => `<span class="alm-tag ji">${escapeHtml(x)}</span>`).join("")
        : `<span class="alm-tag none">无</span>`;

      body.innerHTML = `
        <div class="alm-top">
          <div class="alm-date">
            <div class="alm-gd">${gd} · ${wk}</div>
            <div class="alm-lunar">${lunarStr}${jqStr}</div>
          </div>
          <div class="alm-zodiac">${escapeHtml(sx)}</div>
        </div>
        <div class="alm-ganzhi">${gzY}年 · ${gzM}月 · ${gzD}日 · ${escapeHtml(xz)}座</div>
        <div class="alm-luck">
          <span class="alm-star">${escapeHtml(zhiXing)}日</span>
          ${chong ? `<span class="alm-clash">冲${escapeHtml(chong)}${sha ? ` · 煞${escapeHtml(sha)}` : ""}</span>` : ""}
        </div>
        <div class="alm-personal">
          <div class="alm-pf">身强戊土 · 属猴 · 上升处女座 · 喜金水木（木为调和）</div>
          <div class="alm-luck2">
            <span class="alm-luck-lv lv-${luckLevel}">${luckLevel}</span>
            <span class="alm-luck-txt">${luckText}</span>
          </div>
          <div class="alm-clr-row">
            <span class="alm-clr-label">幸运色系</span>${favColors}
          </div>
          <div class="alm-clr-row">
            <span class="alm-clr-label">今日主打</span><span class="alm-clr alm-clr-main" style="background:${mainColor.hex};color:${mainColor.txt}">${mainColor.name}</span>
            <span class="alm-daywx">日干 ${dayStem}（${sw}）· 日支 ${dayBranch}（${bw}）</span>
          </div>
        </div>
        <div class="alm-row">
          <div class="alm-yi-label">宜</div>
          <div class="alm-tags">${yiHtml}</div>
        </div>
        <div class="alm-row">
          <div class="alm-ji-label">忌</div>
          <div class="alm-tags">${jiHtml}</div>
        </div>`;
    } catch (e) {
      body.innerHTML = `<div class="alm-fallback">黄历解析失败：${escapeHtml(e && e.message ? e.message : e)}</div>`;
    }
  }
  renderAlmanac();

  /* 保持每天更新：每分钟检查日期是否跨天；切回页面/窗口聚焦时立即重算 */
  function almCheckDate() {
    try {
      const k = almDateKey(new Date());
      if (k !== _almKey) renderAlmanac();
    } catch (e) { /* 忽略轮询异常 */ }
  }
  setInterval(almCheckDate, 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) almCheckDate(); });
  window.addEventListener("focus", almCheckDate);

  renderMemos();

  /* ---------- 每日觉察日记（每条独立条目，不再按天覆盖） ---------- */
  const pad = n => (n < 10 ? "0" + n : "" + n);
  const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  const DIARY_STORE_KEY = "wb_diary_records";
  // 文本字段（textarea），按钮组 djKada / djBias 单独处理
  const djFields = ["djBody", "djEmo", "djMind", "djSee", "djAuto", "djFact", "djBiasNote", "djReframe", "djAlt", "djKadaWhy", "djAct", "djGrat", "djOne"];
  const djKadaBtns = () => Array.prototype.slice.call(document.querySelectorAll("#djKada .kada-btn"));
  const djBiasBtns = () => Array.prototype.slice.call(document.querySelectorAll("#djBias .bias-btn"));

  let djCurrentId = null; // 当前正编辑的条目 id，null=新建模式

  function loadDiaryRecords() {
    try { return JSON.parse(localStorage.getItem(DIARY_STORE_KEY)) || []; } catch (e) { return []; }
  }
  function saveDiaryRecords(arr) {
    localStorage.setItem(DIARY_STORE_KEY, JSON.stringify(arr));
  }

  // 迁移旧数据：wb_diary_YYYY-MM-DD → 新数组
  (function migrateOldDiaries() {
    const existing = loadDiaryRecords();
    if (existing.length > 0) return; // 已有新结构，不重复迁移
    const migrated = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.indexOf("wb_diary_") !== 0) continue;
      const dateStr = k.slice("wb_diary_".length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
      try {
        const rec = JSON.parse(localStorage.getItem(k));
        if (rec && Object.keys(rec).length > 0) {
          rec.id = "dj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
          rec.createdAt = dateStr;
          migrated.push(rec);
        }
      } catch (e) { /* skip */ }
    }
    if (migrated.length > 0) saveDiaryRecords(migrated);
  })();

  // 回填表单
  function loadDiaryEntry(entry) {
    djFields.forEach(function(id) { if ($("#" + id)) $("#" + id).value = (entry && entry[id]) || ""; });
    // 课题归属高亮
    const sel = (entry && entry.djKada) || "";
    djKadaBtns().forEach(function(b) {
      b.classList.toggle("active", b.getAttribute("data-k") === sel);
    });
    // 认知偏差多选高亮
    const biasSet = new Set(((entry && entry.djBias) || "").split(",").filter(Boolean));
    djBiasBtns().forEach(function(b) {
      b.classList.toggle("active", biasSet.has(b.getAttribute("data-b")));
    });
    // 日期显示
    if ($("#djDate")) {
      const d = (entry && entry.createdAt) || fmtDate(today);
      const dateStr = typeof d === "string" ? d.slice(0, 10) : d;
      const isToday = dateStr === fmtDate(today);
      $("#djDate").textContent = isToday ? "今天 · " + dateStr : dateStr;
    }
    djCurrentId = (entry && entry.id) || null;
    // 编辑已有记录 vs 新建
    if ($("#djSave")) $("#djSave").textContent = entry && entry.id ? "✏️ 保存修改" : "保存今日觉察";
  }

  // 按 latest 优先显示最新条目，若无则空表单
  (function initDiaryEditor() {
    const records = loadDiaryRecords();
    if (records.length === 0) { loadDiaryEntry(null); return; }
    records.sort(function(a, b) { return (a.createdAt || "") < (b.createdAt || "") ? 1 : -1; });
    loadDiaryEntry(records[0]);
  })();

  // 日记历史记录列表：扫描所有条目，按日期倒序渲染
  // ---------- 觉察日记 · 完整版查看 ----------
  // 字段展示配置：标题 + 对应字段 id（按步骤顺序）
  const DJ_VIEW_FIELDS = [
    { t: "🌬️ 身体扫描", f: "djBody" },
    { t: "💭 主要情绪", f: "djEmo" },
    { t: "☁️ 飘过的念头", f: "djMind" },
    { t: "📌 发生的情景", f: "djSee" },
    { t: "⚡ 自动念头", f: "djAuto" },
    { t: "⚖️ 事实 vs 想法（证据）", f: "djFact" },
    { t: "🕳️ 认知陷阱", f: "__bias" },
    { t: "🩹 陷阱说明", f: "djBiasNote" },
    { t: "🔄 其他可能的解释", f: "djReframe" },
    { t: "🌈 替代念头", f: "djAlt" },
    { t: "🔀 课题归属", f: "__kada" },
    { t: "🧩 课题判断理由", f: "djKadaWhy" },
    { t: "🎯 今天能做的小事", f: "djAct" },
    { t: "💛 感谢", f: "djGrat" },
    { t: "✍️ 一句话收尾", f: "djOne" }
  ];
  const DJ_BIAS_LABEL = {
    "all-or-nothing": "非黑即白", catastrophizing: "灾难化", "mind-reading": "读心术",
    "over-general": "以偏概全", should: "应该主义", labeling: "贴标签",
    emotional: "情绪推理", negative: "否定正面"
  };
  const DJ_KADA_LABEL = { my: "我的课题", other: "别人的课题", heaven: "老天的课题" };

  function viewDiary(id) {
    const records = loadDiaryRecords();
    const rec = records.find(r => r.id === id);
    if (!rec) return;
    const modal = $("#djModal");
    const body = $("#djModalBody");
    if (!modal || !body) return;
    const d = rec.createdAt || fmtDate(today);
    const dateStr = typeof d === "string" ? d.slice(0, 10) : d;
    const dateText = dateStr === fmtDate(today) ? "今天 · " + dateStr : dateStr;
    let html = '<div class="mf-view-date">' + dateText + '</div>';
    let any = false;
    DJ_VIEW_FIELDS.forEach(({ t, f }) => {
      let v;
      if (f === "__bias") {
        v = (rec.djBias || "").split(",").filter(Boolean).map(b => DJ_BIAS_LABEL[b] || b).join("、");
      } else if (f === "__kada") {
        v = DJ_KADA_LABEL[rec.djKada] || "";
      } else {
        v = (rec[f] || "").toString().trim();
      }
      if (!v) return;
      any = true;
      html += '<div class="mf-view-block"><div class="mf-view-label">' + t + '</div><div class="mf-view-val">' + escapeHtml(v).replace(/\n/g, "<br>") + '</div></div>';
    });
    if (!any) html += '<div class="mf-view-empty">该日记暂无填写内容。</div>';
    body.innerHTML = html;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeDiaryModal() {
    const modal = $("#djModal");
    if (modal) modal.hidden = true;
    document.body.style.overflow = "";
  }

  function renderDiaryHistory() {
    var box = $("#djHistory");
    if (!box) return;
    var empty = $("#djHistoryEmpty");
    var records = loadDiaryRecords();
    records.sort(function(a, b) { return (a.createdAt || "") < (b.createdAt || "") ? 1 : -1; });
    // 清除旧的列表项（保留空态容器）
    box.querySelectorAll(".dj-history-item").forEach(function(el) { el.remove(); });
    if (records.length === 0) {
      if (empty) empty.style.display = "";
      return;
    }
    if (empty) empty.style.display = "none";
    records.forEach(function(rec) {
      var dateStr = typeof rec.createdAt === "string" ? rec.createdAt.slice(0, 10) : rec.createdAt;
      var snippet = (rec.djOne || rec.djEmo || rec.djSee || "无内容").toString().replace(/\s+/g, " ").slice(0, 26);
      var item = document.createElement("div");
      item.className = "dj-history-item" + (rec.id === djCurrentId ? " active" : "");
      var dateText = dateStr === fmtDate(today) ? "今天" : dateStr;
      item.innerHTML =
        '<button type="button" class="dh-main" title="回填到编辑表单">' +
          '<span class="dh-date">' + dateText + '</span><span class="dh-snip">' + escapeHtml(snippet) + '</span>' +
        '</button>' +
        '<button type="button" class="dh-view" data-id="' + rec.id + '" title="查看完整版">📖 查看完整版</button>';
      var mainBtn = item.querySelector(".dh-main");
      mainBtn.addEventListener("click", function() {
        if (typeof djFlush === "function") djFlush();   // 切走前先把当前编辑内容落盘
        loadDiaryEntry(rec);
        renderDiaryHistory();
      });
      var viewBtn = item.querySelector(".dh-view");
      viewBtn.addEventListener("click", function() { viewDiary(rec.id); });
      box.appendChild(item);
    });
  }
  renderDiaryHistory();

  // 课题归属选择
  djKadaBtns().forEach(b => {
    b.addEventListener("click", () => {
      const k = b.getAttribute("data-k");
      djKadaBtns().forEach(x => x.classList.toggle("active", x.getAttribute("data-k") === k));
    });
  });

  // 认知偏差多选：可多选，点一下选中/取消
  djBiasBtns().forEach(b => {
    b.addEventListener("click", () => {
      b.classList.toggle("active");
    });
  });

  if ($("#djPrev")) {
    $("#djPrev").addEventListener("click", function() {
      if (typeof djFlush === "function") djFlush();
      var records = loadDiaryRecords();
      if (records.length <= 1) return;
      records.sort(function(a, b) { return (a.createdAt || "") < (b.createdAt || "") ? 1 : -1; });
      var idx = -1;
      for (var i = 0; i < records.length; i++) { if (records[i].id === djCurrentId) { idx = i; break; } }
      if (idx === -1) idx = records.length;
      var prevIdx = (idx + 1) % records.length;
      loadDiaryEntry(records[prevIdx]);
      renderDiaryHistory();
    });
  }
  if ($("#djNext")) {
    $("#djNext").addEventListener("click", function() {
      if (typeof djFlush === "function") djFlush();
      var records = loadDiaryRecords();
      if (records.length <= 1) return;
      records.sort(function(a, b) { return (a.createdAt || "") < (b.createdAt || "") ? 1 : -1; });
      var idx = -1;
      for (var i = 0; i < records.length; i++) { if (records[i].id === djCurrentId) { idx = i; break; } }
      if (idx === -1) idx = -1;
      var nextIdx = (idx - 1 + records.length) % records.length;
      loadDiaryEntry(records[nextIdx]);
      renderDiaryHistory();
    });
  }
  /* ---- 觉察日记：自动保存（输入即存，关闭不丢） ---- */
  function djBuildRec() {
    var rec = {};
    djFields.forEach(function(id) { rec[id] = $("#" + id) ? $("#" + id).value : ""; });
    // 课题归属单选：取 active 的 data-k
    var kadaAct = djKadaBtns().find(function(b) { return b.classList.contains("active"); });
    rec.djKada = kadaAct ? kadaAct.getAttribute("data-k") : "";
    // 认知偏差多选：取所有 active 的 data-b，逗号拼接
    rec.djBias = djBiasBtns().filter(function(b) { return b.classList.contains("active"); }).map(function(b) { return b.getAttribute("data-b"); }).join(",");
    return rec;
  }
  function djHasContent(rec) {
    return Object.keys(rec).some(function(k) { return (rec[k] || "").toString().trim() !== ""; });
  }
  function nowHM() {
    var d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  // silent=true 表示自动保存（不打断用户），false 表示手动点保存
  function djPersist(silent) {
    var rec = djBuildRec();
    // 新建态且内容全空 → 不创建空条目
    if (!djCurrentId && !djHasContent(rec)) {
      if (!silent && $("#djMsg")) {
        $("#djMsg").textContent = "还没有内容可保存";
        setTimeout(function() { if ($("#djMsg")) $("#djMsg").textContent = ""; }, 2000);
      }
      return false;
    }
    var records = loadDiaryRecords();
    if (djCurrentId) {
      var found = false;
      for (var i = 0; i < records.length; i++) {
        if (records[i].id === djCurrentId) {
          rec.id = djCurrentId;
          rec.createdAt = records[i].createdAt;
          records[i] = rec;
          found = true;
          break;
        }
      }
      if (!found) { rec.id = djCurrentId; rec.createdAt = fmtDate(today); records.push(rec); }
    } else {
      rec.id = "dj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      rec.createdAt = fmtDate(today);
      records.push(rec);
      djCurrentId = rec.id;
    }
    saveDiaryRecords(records);
    renderDiaryHistory();
    if ($("#djSave")) $("#djSave").textContent = "✏️ 保存修改";
    if ($("#djMsg")) {
      $("#djMsg").textContent = silent ? "✓ 已自动保存 " + nowHM() : "已保存 ✓ " + fmtDate(today);
      if (!silent) setTimeout(function() { if ($("#djMsg")) $("#djMsg").textContent = ""; }, 2000);
    }
    return true;
  }
  var _djTimer = null;
  function djAutoQueue() {
    if (_djTimer) clearTimeout(_djTimer);
    if ($("#djMsg")) $("#djMsg").textContent = "…正在输入";
    _djTimer = setTimeout(function() { djPersist(true); }, 700);
  }
  // 绑定所有输入框 + 两组标签按钮
  djFields.forEach(function(id) {
    var el = $("#" + id);
    if (el) { el.addEventListener("input", djAutoQueue); el.addEventListener("change", djAutoQueue); }
  });
  djKadaBtns().forEach(function(b) { b.addEventListener("click", djAutoQueue); });
  djBiasBtns().forEach(function(b) { b.addEventListener("click", djAutoQueue); });
  // 离开页面/切后台前立刻落盘，避免防抖窗口内丢失
  function djFlush() { if (_djTimer) { clearTimeout(_djTimer); _djTimer = null; djPersist(true); } }
  window.addEventListener("pagehide", djFlush);
  window.addEventListener("beforeunload", djFlush);
  document.addEventListener("visibilitychange", function() { if (document.hidden) djFlush(); });

  if ($("#djSave")) {
    $("#djSave").addEventListener("click", function() {
      if (_djTimer) { clearTimeout(_djTimer); _djTimer = null; }
      djPersist(false);
    });
  }

  // 「＋ 新建一条」按钮：先落盘当前内容，再清空表单进入新建模式
  if ($("#djNewEntry")) {
    $("#djNewEntry").addEventListener("click", function() {
      djFlush();
      loadDiaryEntry(null); // null = 新建模式
      if ($("#djSave")) $("#djSave").textContent = "保存今日觉察";
      $("#djMsg").textContent = "";
      renderDiaryHistory();
    });
  }

  /* ---------- 显化日记 ---------- */
  // 数据模型：每条愿望 = 一个独立条目，存入数组，避免同一天互相覆盖
  const MF_RECORDS_KEY = "wb_manifest_records";
  const mfFields = ["mfWish", "mfWhy", "mfFeel", "mfScene", "mfRelease", "mfAction", "mfMantra", "mfRevisit", "mfAffirm", "mfAffirmAct", "mfGratList", "mfGratFuture", "mfScript", "mfVision", "mfAsIf", "mfLetter", "mfRelFeel", "mfRelQ", "mfRelR"];
  const mfMethodBtns = () => Array.prototype.slice.call(document.querySelectorAll("#mfMethod .bias-btn"));

  function mfLoadAll() {
    try { return JSON.parse(localStorage.getItem(MF_RECORDS_KEY)) || []; } catch (e) { return []; }
  }
  function makeNewId() { return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function sortRecords(arr) {
    return arr.slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.id || "").localeCompare(a.id || "");
    });
  }
  // 兼容迁移：旧的「按日期单条」key → 并入条目数组（每条独立保留）
  (function migrateOldManifest() {
    const migrated = [];
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf("wb_manifest_") === 0 && k !== MF_RECORDS_KEY) {
        const d = k.slice("wb_manifest_".length);
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          try {
            const rec = JSON.parse(localStorage.getItem(k)) || {};
            rec.id = makeNewId();
            rec.date = d;
            migrated.push(rec);
          } catch (e) {}
          toRemove.push(k);
        }
      }
    }
    if (migrated.length) {
      const merged = sortRecords(mfLoadAll().concat(migrated));
      localStorage.setItem(MF_RECORDS_KEY, JSON.stringify(merged));
      toRemove.forEach(k => localStorage.removeItem(k));
    }
  })();

  let mfCurrentId = null; // null = 新建态

  // 方法选择 ↔ 专属实践栏联动显示
  function syncMfTools() {
    const active = new Set(mfMethodBtns().filter(b => b.classList.contains("active")).map(b => b.getAttribute("data-m")));
    document.querySelectorAll(".mf-tool").forEach(t => {
      t.style.display = active.has(t.getAttribute("data-m")) ? "block" : "none";
    });
  }

  function loadManifest(id) {
    const arr = mfLoadAll();
    const rec = id ? arr.find(r => r.id === id) : null;
    mfFields.forEach(f => { if ($("#" + f)) $("#" + f).value = (rec && rec[f]) || ""; });
    const methodSet = new Set((rec && rec.mfMethod || "").split(",").filter(Boolean));
    mfMethodBtns().forEach(b => b.classList.toggle("active", methodSet.has(b.getAttribute("data-m"))));
    // 恢复愿景板上传的图片
    const vp = $("#mfVisionPreview");
    if (vp) {
      const img = rec && rec.mfVisionImg;
      if (img) { vp.innerHTML = '<img src="' + img + '" alt="愿景板素材">'; vp.hidden = false; }
      else { vp.innerHTML = ""; vp.hidden = true; }
    }
    syncMfTools();
    mfCurrentId = id;
    const dateText = rec ? rec.date : fmtDate(today);
    const isToday = dateText === fmtDate(today);
    if ($("#mfDate")) $("#mfDate").textContent = (isToday ? "今天 · " : "") + dateText + (rec ? "" : " · 新建");
  }
  loadManifest(null);

  // 显化方法多选
  mfMethodBtns().forEach(b => {
    b.addEventListener("click", () => { b.classList.toggle("active"); syncMfTools(); });
  });

  // 愿景板：本地上传图片（dataURL 存 localStorage）
  const vf = $("#mfVisionFile");
  if (vf) vf.addEventListener("change", () => {
    const f = vf.files && vf.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const vp = $("#mfVisionPreview");
      if (vp) { vp.innerHTML = '<img src="' + reader.result + '" alt="愿景板素材">'; vp.hidden = false; }
    };
    reader.readAsDataURL(f);
  });
  const vc = $("#mfVisionClear");
  if (vc) vc.addEventListener("click", () => {
    const vp = $("#mfVisionPreview");
    if (vp) { vp.innerHTML = ""; vp.hidden = true; }
    if (vf) vf.value = "";
    if (typeof mfAutoQueue === "function") mfAutoQueue();
  });

  // 显化记录历史列表（每条独立，倒序展示）
  function renderManifestHistory() {
    const box = $("#mfHistory");
    if (!box) return;
    const empty = $("#mfHistoryEmpty");
    const arr = sortRecords(mfLoadAll());
    box.querySelectorAll(".dj-history-item").forEach(el => el.remove());
    if (arr.length === 0) { if (empty) empty.style.display = ""; return; }
    if (empty) empty.style.display = "none";
    arr.forEach(rec => {
      const snippet = (rec.mfWish || rec.mfMantra || "无内容").toString().replace(/\s+/g, " ").slice(0, 26);
      const item = document.createElement("div");
      item.className = "dj-history-item" + (rec.id === mfCurrentId ? " active" : "");
      const dateText = rec.date === fmtDate(today) ? "今天" : rec.date;
      item.innerHTML =
        '<button type="button" class="dh-main" title="回填到编辑表单">' +
          '<span class="dh-date">' + dateText + '</span><span class="dh-snip">' + escapeHtml(snippet) + '</span>' +
        '</button>' +
        '<button type="button" class="dh-view" data-id="' + rec.id + '" title="查看完整版">📖 查看完整版</button>';
      const mainBtn = item.querySelector(".dh-main");
      mainBtn.addEventListener("click", () => { if (typeof mfFlush === "function") mfFlush(); loadManifest(rec.id); renderManifestHistory(); });
      const viewBtn = item.querySelector(".dh-view");
      viewBtn.addEventListener("click", () => viewManifest(rec.id));
      box.appendChild(item);
    });
  }
  renderManifestHistory();

  // ---------- 显化记录 · 完整版查看 ----------
  // 字段展示配置：label 标题 + 对应字段 id（按填写顺序分组）
  const MF_VIEW_FIELDS = [
    { t: "🎯 我在显化的一件愿望", f: "mfWish" },
    { t: "💭 为什么我真心想要它", f: "mfWhy" },
    { t: "✨ 当成已实现时的感受", f: "mfFeel" },
    { t: "🎬 已成真时的场景", f: "mfScene" },
    { t: "🗣 肯定语（现在时宣言）", f: "mfAffirm" },
    { t: "🏃 肯定语配套动作", f: "mfAffirmAct" },
    { t: "🙏 感恩三件事", f: "mfGratList" },
    { t: "💞 提前感恩愿望成真", f: "mfGratFuture" },
    { t: "✍️ 脚本 / 剧本", f: "mfScript" },
    { t: "📌 愿景板关键词 / 画面", f: "mfVision" },
    { t: "🎭 假设法则（已经实现的我怎么做）", f: "mfAsIf" },
    { t: "💌 写给未来自己", f: "mfLetter" },
    { t: "1️⃣ 释放法 · 觉察感受", f: "mfRelFeel" },
    { t: "2️⃣ 释放法 · 自问三连", f: "mfRelQ" },
    { t: "3️⃣ 释放法 · 松手回到平静", f: "mfRelR" },
    { t: "🕊️ 交托的话", f: "mfRelease" },
    { t: "👟 今天会做的一小步", f: "mfAction" },
    { t: "🔁 反复默念的肯定语", f: "mfMantra" },
    { t: "📅 放下重看日期 / 触发点", f: "mfRevisit" }
  ];
  const MF_METHOD_LABEL = {
    visual: "🖼 可视化", affirm: "🗣 肯定语", gratitude: "🙏 感恩", script: "✍️ 脚本/剧本",
    vision: "📌 愿景板", sats: "🌙 SATS", "act-as-if": "🎭 假设法则", letter: "💌 写给未来自己", release: "🔓 释放法"
  };
  function viewManifest(id) {
    const arr = mfLoadAll();
    const rec = arr.find(r => r.id === id);
    if (!rec) return;
    const modal = $("#mfModal");
    const body = $("#mfModalBody");
    if (!modal || !body) return;
    const dateText = rec.date === fmtDate(today) ? "今天 · " + rec.date : rec.date;
    // 已选方法
    const methods = (rec.mfMethod || "").split(",").filter(Boolean)
      .map(m => MF_METHOD_LABEL[m] || m).join("、");
    let html = '<div class="mf-view-date">' + dateText + '</div>';
    if (methods) html += '<div class="mf-view-methods">🧭 使用的方法：' + escapeHtml(methods) + '</div>';
    // 有内容的字段
    let any = false;
    MF_VIEW_FIELDS.forEach(({ t, f }) => {
      const v = (rec[f] || "").toString().trim();
      if (!v) return;
      any = true;
      html += '<div class="mf-view-block"><div class="mf-view-label">' + t + '</div><div class="mf-view-val">' + escapeHtml(v).replace(/\n/g, "<br>") + '</div></div>';
    });
    // 愿景板图片
    if (rec.mfVisionImg) {
      any = true;
      html += '<div class="mf-view-block"><div class="mf-view-label">📌 愿景板素材</div><div class="mf-view-img"><img src="' + rec.mfVisionImg + '" alt="愿景板素材"></div></div>';
    }
    if (!any) html += '<div class="mf-view-empty">该日期暂无填写内容。</div>';
    body.innerHTML = html;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeManifestModal() {
    const modal = $("#mfModal");
    if (modal) modal.hidden = true;
    document.body.style.overflow = "";
  }
  const mfModal = $("#mfModal");
  if (mfModal) mfModal.addEventListener("click", e => { if (e.target === mfModal) closeManifestModal(); });
  if ($("#mfModalClose")) $("#mfModalClose").addEventListener("click", closeManifestModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") { if (mfModal && !mfModal.hidden) closeManifestModal(); const dm = $("#djModal"); if (dm && !dm.hidden) closeDiaryModal(); } });
  // 觉察日记完整版弹窗关闭
  const djModal = $("#djModal");
  if (djModal) djModal.addEventListener("click", e => { if (e.target === djModal) closeDiaryModal(); });
  if ($("#djModalClose")) $("#djModalClose").addEventListener("click", closeDiaryModal);
  // 保存后若完整版模态正打开，会在保存监听里刷新当前记录


  // 导航：在条目间切换（上一条 / 下一条）
  function navStep(dir) {
    if (typeof mfFlush === "function") mfFlush();
    const sorted = sortRecords(mfLoadAll());
    if (!sorted.length) return;
    const ids = sorted.map(r => r.id);
    let idx = mfCurrentId ? ids.indexOf(mfCurrentId) : 0;
    if (idx === -1) idx = 0;
    const ni = idx + dir;
    if (ni < 0 || ni >= ids.length) return;
    loadManifest(ids[ni]);
    renderManifestHistory();
  }
  if ($("#mfPrev")) $("#mfPrev").addEventListener("click", () => navStep(-1));
  if ($("#mfNext")) $("#mfNext").addEventListener("click", () => navStep(1));
  // 新建一条
  if ($("#mfNew")) $("#mfNew").addEventListener("click", () => {
    if (typeof mfFlush === "function") mfFlush();
    loadManifest(null);
    renderManifestHistory();
    if ($("#mfMsg")) $("#mfMsg").textContent = "";
    if ($("#mfWish")) $("#mfWish").focus();
  });
  /* ---- 显化日记：自动保存（输入即存，关闭不丢） ---- */
  function mfBuildRec() {
    const rec = {};
    mfFields.forEach(id => { rec[id] = $("#" + id) ? $("#" + id).value : ""; });
    rec.mfMethod = mfMethodBtns().filter(b => b.classList.contains("active")).map(b => b.getAttribute("data-m")).join(",");
    // 保存愿景板上传的图片 dataURL
    const vp = $("#mfVisionPreview");
    const img = vp && !vp.hidden ? (vp.querySelector("img") ? vp.querySelector("img").src : "") : "";
    rec.mfVisionImg = img || "";
    return rec;
  }
  function mfHasContent(rec) {
    return Object.keys(rec).some(k => (rec[k] || "").toString().trim() !== "");
  }
  function mfPersist(silent) {
    const rec = mfBuildRec();
    if (!mfCurrentId && !mfHasContent(rec)) {
      if (!silent && $("#mfMsg")) {
        $("#mfMsg").textContent = "还没有内容可保存";
        setTimeout(() => { if ($("#mfMsg")) $("#mfMsg").textContent = ""; }, 2000);
      }
      return false;
    }
    const arr = mfLoadAll();
    let savedId, savedDate;
    if (mfCurrentId) {
      const idx = arr.findIndex(r => r.id === mfCurrentId);
      if (idx >= 0) {
        const orig = arr[idx];
        arr[idx] = Object.assign({}, orig, rec); // 保留 id / date
        savedId = orig.id; savedDate = orig.date;
      } else {
        rec.id = mfCurrentId; rec.date = fmtDate(today);
        arr.unshift(rec); savedId = rec.id; savedDate = rec.date;
      }
    } else {
      rec.id = makeNewId(); rec.date = fmtDate(today);
      arr.unshift(rec); savedId = rec.id; savedDate = rec.date;
    }
    localStorage.setItem(MF_RECORDS_KEY, JSON.stringify(sortRecords(arr)));
    mfCurrentId = savedId;
    if ($("#mfDate")) $("#mfDate").textContent = (savedDate === fmtDate(today) ? "今天 · " : "") + savedDate;
    if ($("#mfMsg")) {
      $("#mfMsg").textContent = silent ? "✓ 已自动保存 " + nowHM() : "已保存 ✓";
      if (!silent) setTimeout(() => { if ($("#mfMsg")) $("#mfMsg").textContent = ""; }, 2000);
    }
    // 若完整版模态正打开，刷新当前记录
    if ($("#mfModal") && !$("#mfModal").hidden && $("#mfModalBody")) viewManifest(mfCurrentId);
    renderManifestHistory();
    return true;
  }
  let _mfTimer = null;
  function mfAutoQueue() {
    if (_mfTimer) clearTimeout(_mfTimer);
    if ($("#mfMsg")) $("#mfMsg").textContent = "…正在输入";
    _mfTimer = setTimeout(() => mfPersist(true), 700);
  }
  function mfFlush() { if (_mfTimer) { clearTimeout(_mfTimer); _mfTimer = null; mfPersist(true); } }
  mfFields.forEach(id => {
    const el = $("#" + id);
    if (el) { el.addEventListener("input", mfAutoQueue); el.addEventListener("change", mfAutoQueue); }
  });
  mfMethodBtns().forEach(b => b.addEventListener("click", mfAutoQueue));
  if (vf) vf.addEventListener("change", () => setTimeout(mfAutoQueue, 300)); // 愿景板图片读完再存
  window.addEventListener("pagehide", mfFlush);
  window.addEventListener("beforeunload", mfFlush);
  document.addEventListener("visibilitychange", () => { if (document.hidden) mfFlush(); });

  if ($("#mfSave")) {
    $("#mfSave").addEventListener("click", () => {
      if (_mfTimer) { clearTimeout(_mfTimer); _mfTimer = null; }
      mfPersist(false);
    });
  }

  // 显化方法速查指引
  const MF_GUIDES = [
    { t: "🖼 可视化（Visualization）", d: "用想象力在脑海里播放「已经拥有」的电影，越生动越好。这是最基础也最核心的显化法。", steps: ["找个安静处，闭眼、放松", "让场景充满细节：颜色、声音、触感、气味", "让自己真的「身处其中」，停留 3-5 分钟", "结束时记住那股「已经有了」的感受"] },
    { t: "🗣 肯定语（Affirmations）", d: "用「现在时、肯定句、第一人称」的话反复对自己说，改写潜意识里的旧信念。", steps: ["避免『我希望/我想』，改用『我是/我拥有』", "一次只聚焦 1-2 条，别贪多", "每天早晚各一遍，念出感情而不是背诵", "念的时候在脑中同步播放画面"] },
    { t: "🙏 感恩（Gratitude）", d: "感恩把频率调高，让大脑留意「已经拥有」的证据，进而吸引更多。", steps: ["每天写下 3 件真实感恩的事", "专注感受「谢意」本身，不只是列清单", "把想显化的愿望也当「已经收到」来感谢", "睡前想想今天所有好的细节"] },
    { t: "✍️ 脚本 / 剧本（Scripting）", d: "用第一人称、现在时，把愿望成真后的一天写成小故事，落笔即「已经发生」。", steps: ["开头写『今天是 X 年 X 月，我……』", "写你正在做、看到、听到什么", "加入情绪与细节，越具体越真实", "写完收好，不必反复改"] },
    { t: "📌 愿景板（Vision Board）", d: "把愿望的图片/文字做成视觉板，每天看，让潜意识持续锚定目标。", steps: ["收集代表愿望的图片、金句", "排版后固定在你常看到的位置", "每天花 1 分钟注视并感受它成真", "手机壁纸也可以当轻量版"] },
    { t: "🌙 SATS（睡前状态）", d: "Neville Goddard 经典法：在半梦半醒的放松态里，反复想象愿望成真的最后一幕，直到它刻进潜意识。", steps: ["躺下放松，进入昏昏欲睡状态", "只选一个简短画面，如『拿到合同那一刻』", "像回放记忆一样反复播放这幕", "带着满足感入眠，第二天不再回头想"] },
    { t: "🎭 假设法则（Act As If）", d: "「假装你是」那个已经实现愿望的人，用 TA 的语言、行动、选择过今天。", steps: ["问自己：『如果我已经做到了，我会怎么想怎么做？』", "今天就按那个版本的自己行动一件小事", "不必跟任何人宣告，心里知道就好", "这不是表演，是提前成为"] },
    { t: "💌 写给未来自己（Letter）", d: "写给「愿望已实现」的自己，把现在的期待变成对未来的感谢与确认。", steps: ["以『亲爱的未来的我』开头", "描述你已经拥有的状态，越具体越好", "感谢对方（未来的自己）坚持了下来", "写完后把它收进盒子，设定重看日期"] },
    { t: "🔓 释放法（Release）", d: "Lester Levenson 核心法：觉察并放下对愿望的「想要/抗拒」，回到平静，显化在放松中自然发生。", steps: ["写下此刻抓住的感受（六种之一：想要或抗拒控制/认可/安全）", "自问三连：『这值得放下吗？』『我能放下吗？』『什么时候放？』", "呼一口气，想象那团执念从胸口松开飘走", "回到平静，记住：执念越松，显化越顺"] }
  ];
  const guideBox = $("#mfGuide");
  if (guideBox) {
    guideBox.innerHTML = MF_GUIDES.map((g, i) =>
      '<div class="mf-guide-item"><button type="button" class="mfg-t" data-i="' + i + '">' +
      '<span class="mfg-arr">▶</span><span>' + g.t + '</span></button>' +
      '<div class="mfg-d">' + g.d + '</div>' +
      '<ul class="mfg-steps">' + g.steps.map(s => '<li>' + s + '</li>').join("") + '</ul></div>'
    ).join("");
    guideBox.addEventListener("click", e => {
      const btn = e.target.closest(".mfg-t");
      if (!btn) return;
      const item = btn.closest(".mf-guide-item");
      const open = item.classList.toggle("open");
      btn.querySelector(".mfg-arr").textContent = open ? "▼" : "▶";
      // 联动表单里的方法多选：点击指引，把对应方法一并选中（顺序与 MF_GUIDES 一致）
      const methodBtns = mfMethodBtns();
      const idx = parseInt(btn.getAttribute("data-i"), 10);
      if (methodBtns.length && methodBtns[idx]) { methodBtns[idx].classList.add("active"); syncMfTools(); }
    });
  }

  /* ---------- 摘抄笔记（拍图识字 OCR） ---------- */
  const EX_KEY = "wb_excerpts";
  const exUpload = $("#exUpload");
  const exFile = $("#exFile");
  const exFileCam = $("#exFileCam");
  const exPick = $("#exPick");
  const exCam = $("#exCam");
  const exPreview = $("#exPreview");
  const exActions = $("#exActions");
  const exRecognize = $("#exRecognize");
  const exRetry = $("#exRetry");
  const exProgress = $("#exProgress");
  const exEnhance = $("#exEnhance");
  const exEnhanceBar = $("#exEnhanceBar");
  const exText = $("#exText");
  const exSource = $("#exSource");
  const exTags = $("#exTags");
  const exSave = $("#exSave");
  const exMsg = $("#exMsg");
  const exList = $("#exList");
  const exCount = $("#exCount");
  let exImgLoaded = false;

  function exLoadAll() {
    try { return JSON.parse(localStorage.getItem(EX_KEY)) || []; } catch (e) { return []; }
  }

  /* 摘抄编辑区草稿自动保存：还没点「保存到摘抄库」也不会丢 */
  const EX_DRAFT_KEY = "wb_excerpt_draft";
  function exSaveDraft() {
    try {
      localStorage.setItem(EX_DRAFT_KEY, JSON.stringify({
        text: exText ? exText.value : "",
        source: exSource ? exSource.value : "",
        tags: exTags ? exTags.value : ""
      }));
    } catch (e) {}
  }
  function exClearDraft() { try { localStorage.removeItem(EX_DRAFT_KEY); } catch (e) {} }
  (function exRestoreDraft() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(EX_DRAFT_KEY)); } catch (e) { d = null; }
    if (!d) return;
    if (exText && d.text) exText.value = d.text;
    if (exSource && d.source) exSource.value = d.source;
    if (exTags && d.tags) exTags.value = d.tags;
  })();
  [exText, exSource, exTags].forEach(el => { if (el) el.addEventListener("input", exSaveDraft); });
  function exRenderList() {
    const arr = exLoadAll();
    if (exCount) exCount.textContent = arr.length ? "共 " + arr.length + " 条" : "";
    if (!exList) return;
    if (!arr.length) {
      exList.innerHTML = `<div style="font-size:13px;color:var(--ink-faint);padding:8px 2px;">还没有摘抄，拍一张图试试 👆</div>`;
      return;
    }
    exList.innerHTML = arr.map((it, i) => `
      <div class="excerpt-item">
        <div class="excerpt-item-head">
          <span class="excerpt-item-date">${it.date}</span>
          ${it.source ? `<span class="excerpt-item-src">📖 ${it.source.replace(/</g, "&lt;")}</span>` : ""}
          <button class="excerpt-del" data-i="${i}" type="button">✕</button>
        </div>
        <div class="excerpt-item-text">${it.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>
        ${it.tags ? `<div class="excerpt-item-tags">${it.tags.split(/[,，]/).map(t => `<span>#${t.trim().replace(/</g, "&lt;")}</span>`).filter(t => t !== "#").join("")}</div>` : ""}
      </div>`).join("");
    exList.querySelectorAll(".excerpt-del").forEach(b => {
      b.addEventListener("click", () => {
        const a = exLoadAll(); a.splice(+b.getAttribute("data-i"), 1);
        localStorage.setItem(EX_KEY, JSON.stringify(a));
        exRenderList();
      });
    });
  }
  function exReset() {
    exImgLoaded = false;
    exFile.value = "";
    if (exFileCam) exFileCam.value = "";
    exPreview.hidden = true;
    exPreview.removeAttribute("src");
    exActions.hidden = true;
    if (exEnhanceBar) exEnhanceBar.hidden = true;
    exProgress.hidden = true;
    exProgress.textContent = "";
  }
  function exHandleFile(f) {
    if (!f) return;
    exPreview.src = URL.createObjectURL(f);
    exPreview.hidden = false;
    exActions.hidden = false;
    if (exEnhanceBar) exEnhanceBar.hidden = false;
    exImgLoaded = true;
    exMsg.textContent = "";
  }
  if (exUpload && exFile) {
    exUpload.addEventListener("click", () => {
      if (exFileCam && exFileCam.files && exFileCam.files.length) exFileCam.value = "";
      exFile.click();
    });
    exFile.addEventListener("change", () => exHandleFile(exFile.files && exFile.files[0]));
    if (exFileCam) exFileCam.addEventListener("change", () => exHandleFile(exFileCam.files && exFileCam.files[0]));
    if (exPick) exPick.addEventListener("click", (e) => {
      e.stopPropagation();
      if (exFileCam && exFileCam.files && exFileCam.files.length) exFileCam.value = "";
      exFile.click();
    });
    if (exCam) exCam.addEventListener("click", (e) => {
      e.stopPropagation();
      exFile.value = "";
      exFileCam.click();
    });
  }
  if (exRetry) exRetry.addEventListener("click", exReset);

  // —— 图像预处理：放大 + 灰度 + 自适应二值化，显著提升 Tesseract 识别率 ——
  function exLoadImg(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = src;
    });
  }
  function exOtsuThreshold(gray) {
    // 统计灰度直方图，用 Otsu 求最优二值化阈值
    const hist = new Array(256).fill(0);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
    const total = gray.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, maxVar = 0, thr = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const v = wB * wF * (mB - mF) * (mB - mF);
      if (v > maxVar) { maxVar = v; thr = t; }
    }
    return thr;
  }
  function exPreprocess(img) {
    // 目标短边，过小的图放大，过大的图适当缩放，兼顾清晰度与性能
    const SHORT = 2200;
    const scale = SHORT / Math.min(img.naturalWidth, img.naturalHeight);
    const w = Math.round(img.naturalWidth * Math.min(scale, 1.6)); // 最多放大 1.6 倍
    const h = Math.round(img.naturalHeight * Math.min(scale, 1.6));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    // 灰度化
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      gray[p] = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    }
    // Otsu 自适应阈值二值化：文字变黑，背景变白，最利于 Tesseract 识别
    const thr = exOtsuThreshold(gray);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const v = gray[p] < thr ? 0 : 255;
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  if (exRecognize) {
    exRecognize.addEventListener("click", async () => {
      if (!exImgLoaded) return;
      if (typeof Tesseract === "undefined") {
        exMsg.textContent = "识字引擎未加载（需联网加载一次），请检查网络后刷新。";
        return;
      }
      exRecognize.disabled = true;
      exProgress.hidden = false;
      exProgress.textContent = "正在加载识别引擎…";
      try {
        const worker = await Tesseract.createWorker("chi_sim", 1, {
          logger: m => {
            exProgress.textContent = m.status === "recognizing text"
              ? "识别中… " + Math.round(m.progress * 100) + "%"
              : "准备中… " + (m.status || "");
          }
        });
        // 优化识别：单列文本模式，对印刷体/书页效果最佳
        await worker.setParameters({ tessedit_pageseg_mode: "6" });
        const enhanceOn = exEnhance ? exEnhance.checked : true;
        let source;
        if (enhanceOn) {
          exProgress.textContent = "正在智能增强图片…";
          const img = await exLoadImg(exPreview.src);
          source = exPreprocess(img);
        } else {
          source = exPreview;
        }
        const ret = await worker.recognize(source);
        exText.value = (ret.data.text || "").trim();
        exSaveDraft();
        await worker.terminate();
        exProgress.textContent = enhanceOn
          ? "✅ 增强识别完成（黑底白字已二值化），可手动修订后保存"
          : "✅ 识别完成，可手动修订后保存";
      } catch (err) {
        exProgress.textContent = "识别失败：" + (err && err.message ? err.message : err);
      } finally {
        exRecognize.disabled = false;
      }
    });
  }
  if (exSave) {
    exSave.addEventListener("click", () => {
      const text = exText.value.trim();
      if (!text) { exMsg.textContent = "请先识别或输入文字"; return; }
      const arr = exLoadAll();
      arr.unshift({ text, source: exSource.value.trim(), tags: exTags.value.trim(), date: fmtDate(new Date()) });
      localStorage.setItem(EX_KEY, JSON.stringify(arr));
      exMsg.textContent = "已保存 ✓";
      exText.value = ""; exSource.value = ""; exTags.value = "";
      exClearDraft();
      exReset();
      exRenderList();
      setTimeout(() => { if (exMsg) exMsg.textContent = ""; }, 2000);
    });
  }
  exRenderList();

  /* ---------- English daily: spoken video + must-remember vocab ---------- */
  (function renderEnglishDaily() {
    if (!D || !D.englishDaily) return;
    const days = D.englishDaily.days || [];
    if (!days.length) return;
    function dayOfYear(d) {
      const start = new Date(d.getFullYear(), 0, 0);
      return Math.floor((d - start) / 86400000);
    }
    // 朗读语速（原速 1.0 / 慢速 0.6），本地持久化
    let engRate = parseFloat(localStorage.getItem("wb_eng_rate"));
    if (!(engRate === 0.6 || engRate === 1)) engRate = 1;
    // 朗读英文（调用浏览器内置语音合成，无需音频文件）
    function pickVoice() {
      const vs = (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || [];
      // 优先美式英语，其次任意英语，尽量挑高质量（Google / Microsoft / Samantha 等）
      return vs.find(v => /en[-_]US/i.test(v.lang) && /google|microsoft|samantha|natural/i.test(v.name))
        || vs.find(v => /en[-_]US/i.test(v.lang))
        || vs.find(v => /^en/i.test(v.lang))
        || null;
    }
    function speakEn(text) {
      if (!text) return;
      if (!("speechSynthesis" in window)) {
        alert("当前浏览器不支持语音朗读，请换 Chrome / Edge / Safari 试试。");
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        const v = pickVoice();
        if (v) u.voice = v;
        u.rate = engRate;   // 按所选语速播放
        u.pitch = 1.0;
        u.volume = 1.0;
        window.speechSynthesis.speak(u);
      } catch (e) { /* 忽略 */ }
    }
    // 语音列表异步加载，提前触发一次以便缓存
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = pickVoice;
      pickVoice();
    }
    // 语速切换控件
    const rateBox = document.getElementById("engRate");
    if (rateBox) {
      const syncRate = () => rateBox.querySelectorAll(".eng-rate-btn").forEach(b =>
        b.classList.toggle("active", parseFloat(b.dataset.rate) === engRate));
      syncRate();
      rateBox.querySelectorAll(".eng-rate-btn").forEach(b => b.addEventListener("click", () => {
        engRate = parseFloat(b.dataset.rate);
        localStorage.setItem("wb_eng_rate", String(engRate));
        syncRate();
      }));
    }
    const today = new Date();
    const day = days[dayOfYear(today) % days.length];
    const dateStr = fmtDate(today);

    // spoken video
    const sp = day.spoken || {};
    const spDate = document.getElementById("engSpokenDate");
    if (spDate) spDate.textContent = dateStr + " · " + (day.theme || "");
    const spBox = document.getElementById("engSpoken");
    if (spBox) {
      spBox.innerHTML = `
        <div class="eng-spoken-title">${sp.title || ""}</div>
        ${sp.key ? `<div class="eng-key">🔑 核心句：<b>${sp.key}</b><button class="eng-speak" type="button" data-sent="${sp.key.replace(/"/g, "&quot;")}" title="朗读核心句">🔊</button></div>` : ""}
        ${sp.keyTrans ? `<div class="eng-key-trans">📖 ${sp.keyTrans}</div>` : ""}
        ${sp.transcript ? `<div class="eng-transcript">${sp.transcript.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>` : ""}
      `;
      const spSpeak = spBox.querySelector(".eng-speak");
      if (spSpeak) spSpeak.addEventListener("click", () => speakEn(spSpeak.dataset.sent));
    }

    // vocab
    const vbBox = document.getElementById("engVocab");
    if (vbBox) {
      vbBox.innerHTML = (day.vocab || []).map(v => {
        const exEn = (v.example || "").split("（")[0].trim();
        return `
        <div class="vocab-item">
          <div class="vocab-head"><span class="vocab-word">${v.word}</span><button class="vocab-play" type="button" data-word="${v.word}" title="朗读单词">🔊</button></div>
          <div class="vocab-phon">${v.phonetic || ""}</div>
          <div class="vocab-meaning">${v.meaning || ""}</div>
          <div class="vocab-example">${v.example || ""}${exEn ? `<button class="vocab-play-sm" type="button" data-sent="${exEn.replace(/"/g, "&quot;")}" title="朗读例句">🔊</button>` : ""}</div>
        </div>`;
      }).join("");
      vbBox.querySelectorAll(".vocab-play").forEach(b => b.addEventListener("click", () => speakEn(b.dataset.word)));
      vbBox.querySelectorAll(".vocab-play-sm").forEach(b => b.addEventListener("click", () => speakEn(b.dataset.sent)));
    }
  })();

  /* ---------- Ebbinghaus review (weekly English content) ---------- */
  (function renderEbbinghaus() {
    if (!D || !D.englishDaily) return;
    const days = D.englishDaily.days || [];
    if (days.length < 1) return;

    const dkey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const today = new Date();
    const todayStr = dkey(today);
    // 艾宾浩斯遗忘曲线复习间隔：第1天→第2天→第4天→第7天→第15天
    const INTERVALS = [1, 2, 4, 7, 15];

    // 收集当周全部复习条目：7天 × (1 核心句 + N 词汇)
    function buildWeekItems() {
      const items = [];
      days.forEach((day, di) => {
        const src = "Day" + (di + 1) + " · " + (day.theme || "");
        if (day.spoken && day.spoken.key) {
          items.push({
            id: "eb_s" + di,
            kind: "sentence",
            front: day.spoken.key,
            trans: day.spoken.keyTrans || "",
            back: src + "（核心句）",
            src: src
          });
        }
        (day.vocab || []).forEach((v, vi) => {
          items.push({
            id: "eb_v" + di + "_" + vi,
            kind: "word",
            front: v.word || "",
            back: (v.meaning || "") + (v.phonetic ? "  " + v.phonetic : ""),
            src: src
          });
        });
      });
      return items;
    }
    const WEEK = buildWeekItems();
    const idOf = it => it.id;

    // ---- 本地进度存储：wb_ebbinghaus = { [id]: { learn, stage(1..5), due } } ----
    let store = {};
    try { store = JSON.parse(localStorage.getItem("wb_ebbinghaus") || "{}"); } catch (e) { store = {}; }
    const save = () => { try { localStorage.setItem("wb_ebbinghaus", JSON.stringify(store)); } catch (e) {} };

    // 首次使用：把本周全部条目初始化为「第1阶段，今天到期」
    if (Object.keys(store).length === 0) {
      WEEK.forEach(it => { store[it.id] = { learn: todayStr, stage: 1, due: todayStr }; });
      save();
    }

    const ebSub = document.getElementById("ebSub");
    if (ebSub) ebSub.textContent = "当周 7 天内容 · 第1/2/4/7/15天循环复习";

    const dueCount = document.getElementById("ebDueCount");
    const ebDue = document.getElementById("ebDue");
    const ebEmpty = document.getElementById("ebEmpty");

    // 轻量朗读（复用浏览器 speechSynthesis，读取与口语区一致的语速设置）
    function ebSpeak(text) {
      if (!("speechSynthesis" in window)) return;
      let rate = parseFloat(localStorage.getItem("wb_eng_rate"));
      if (!(rate === 0.6 || rate === 1)) rate = 1;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = rate;
      const vs = window.speechSynthesis.getVoices() || [];
      const v = vs.find(x => /en[-_]US/i.test(x.lang) && /google|microsoft|samantha|natural/i.test(x.name))
            || vs.find(x => /en[-_]US/i.test(x.lang))
            || vs.find(x => /^en/i.test(x.lang));
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    }

    // 渲染一张复习卡（默认折叠答案）
    function cardHTML(it, gap) {
      const backExtra = it.trans ? `<div class="eb-back-trans">📖 ${it.trans}</div>` : "";
      return `
        <div class="eb-card" data-id="${it.id}">
          <div class="eb-card-top"><span class="eb-kind">${it.kind === "word" ? "🔤" : "💬"}</span><span class="eb-src">${it.src}</span><span class="eb-gap">第${gap}天</span></div>
          <div class="eb-front">${it.front}<button class="eb-play" type="button" data-sent="${it.front.replace(/"/g, "&quot;")}" title="朗读">🔊</button></div>
          <div class="eb-back" data-hide="1">${backExtra}${it.back}</div>
          <button class="eb-reveal" type="button">👁 显示答案</button>
          <div class="eb-actions">
            <button class="eb-btn hard" type="button" data-score="forgot">🧠 遗忘</button>
            <button class="eb-btn mid" type="button" data-score="fuzzy">🤔 模糊</button>
            <button class="eb-btn good" type="button" data-score="know">😐 认识</button>
          </div>
        </div>`;
    }
    // 自评打分：按艾宾浩斯间隔推进下一次复习
    function scoreCard(card, score) {
      const id = card.dataset.id;
      const rec = store[id] || { learn: todayStr, stage: 1, due: todayStr };
      let stage = rec.stage || 1;
      if (score === "know") {           // 认识：推进到下一间隔阶段
        stage = Math.min(stage + 1, 5);
      } else if (score === "fuzzy") {   // 模糊：保持当前阶段，明天再复习
        stage = Math.max(stage, 1);
      } else {                          // 遗忘：重置到第1阶段，明天再复习
        stage = 1;
      }
      rec.stage = stage;
      rec.learn = todayStr;
      const gap = INTERVALS[Math.min((stage - 1) || 0, INTERVALS.length - 1)];
      rec.due = dkey(new Date(today.getTime() + gap * 86400000));
      store[id] = rec;
      save();
      card.classList.add("flash");
      setTimeout(() => {
        card.style.opacity = "0";
        setTimeout(() => { if (card.parentNode) card.parentNode.removeChild(card); renderAll(); }, 260);
      }, 160);
    }
    // 绑定卡片上的「显示答案」与「自评」事件
    function bindDue(container) {
      if (!container) return;
      container.querySelectorAll(".eb-reveal").forEach(b => b.addEventListener("click", () => {
        const card = b.closest(".eb-card");
        const back = card.querySelector(".eb-back");
        const hidden = back.dataset.hide === "1";
        back.dataset.hide = hidden ? "0" : "1";
        b.textContent = hidden ? "🙈 隐藏答案" : "👁 显示答案";
      }));
      container.querySelectorAll(".eb-play").forEach(b => b.addEventListener("click", () => ebSpeak(b.dataset.sent)));
      container.querySelectorAll(".eb-btn").forEach(b => b.addEventListener("click", () => {
        const card = b.closest(".eb-card");
        const score = b.dataset.score;
        card.querySelectorAll(".eb-btn").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        scoreCard(card, score);
      }));
    }
    // 概览：7 天主题 chips + 复习阶段进度条
    function renderWeek() {
      const ebWeek = document.getElementById("ebWeek");
      if (!ebWeek) return;
      ebWeek.innerHTML = `
        <div class="eb-week-chips">${days.map((day, i) => {
          const rec = store["eb_s" + i];
          const done = rec && rec.stage >= 5;
          return `<span class="eb-chip ${done ? "done" : ""}">${i + 1}·${day.theme || ""}</span>`;
        }).join("")}</div>
        <div class="eb-stages">
          ${INTERVALS.map((g, i) => {
            const cnt = WEEK.filter(it => (store[it.id] && store[it.id].stage) === i + 1).length;
            const cur = i === 0 ? " cur" : "";
            return `<div class="eb-stage${cur}"><span class="eb-stage-n">第${g}天</span><span class="eb-stage-c">${cnt}</span></div>`;
          }).join("")}
          <div class="eb-stage fin${WEEK.length && WEEK.every(it => (store[it.id] || {}).stage >= 5) ? " on" : ""}"><span class="eb-stage-n">已掌握</span></div>
        </div>`;
    }
    // 全量渲染（概览 + 今日到期列表）
    function renderAll() {
      renderWeek();
      const du = WEEK.filter(it => {
        const rec = store[it.id];
        if (!rec || rec.stage >= 5) return false;
        return !rec.due || rec.due <= todayStr;
      });
      if (dueCount) dueCount.textContent = du.length ? du.length + " 项" : "0 项";
      if (ebDue && ebEmpty) {
        if (du.length) {
          ebEmpty.style.display = "none";
          ebDue.innerHTML = du.map(it => {
            const rec = store[it.id];
            const gap = rec ? INTERVALS[Math.min((rec.stage - 1) || 0, INTERVALS.length - 1)] : 1;
            return cardHTML(it, gap);
          }).join("");
          bindDue(ebDue);
        } else {
          ebDue.innerHTML = "";
          ebEmpty.style.display = "block";
          ebEmpty.textContent = "🎉 今天没有到期的复习项，去打卡今日口语或背单词吧！";
        }
      }
    }
    renderAll();
    window.refreshEbbinghaus = renderAll;

    // 重置本周复习进度
    const ebReset = document.getElementById("ebReset");
    if (ebReset) ebReset.addEventListener("click", () => {
      if (!confirm("重置后，本周全部内容将重新从第1天开始复习。确定继续？")) return;
      store = {};
      WEEK.forEach(it => { store[it.id] = { learn: todayStr, stage: 1, due: todayStr }; });
      save();
      renderAll();
    });
  })();

  /* ---------- Word library: pass/fail self-test (会认·会读·知道意思) ---------- */
  (function renderWordLib() {
    if (!D || !D.englishDaily) return;
    const days = D.englishDaily.days || [];
    if (!days.length) return;

    // 汇总全部词汇（7 天 × 3 个），携带来源主题便于归类
    const WORDS = [];
    days.forEach((day, di) => {
      (day.vocab || []).forEach(v => {
        WORDS.push({
          id: "wl_" + di + "_" + WORDS.length,
          word: v.word || "",
          phonetic: v.phonetic || "",
          meaning: v.meaning || "",
          example: v.example || "",
          src: "Day" + (di + 1) + " · " + (day.theme || "")
        });
      });
    });
    if (!WORDS.length) return;

    // 本地进度：wb_wordlib = { [id]: { r(会认), d(会读), m(知道意思), pass(bool) } }
    let wstore = {};
    try { wstore = JSON.parse(localStorage.getItem("wb_wordlib") || "{}"); } catch (e) { wstore = {}; }
    const wsave = () => { try { localStorage.setItem("wb_wordlib", JSON.stringify(wstore)); } catch (e) {} };
    const passedOf = id => { const r = wstore[id]; return !!(r && r.r && r.d && r.m); };

    const pendingTab = document.getElementById("wlPendingCount");
    const passedTab = document.getElementById("wlPassedCount");
    const allTab = document.getElementById("wlAllCount");
    const wlProgress = document.getElementById("wlProgress");
    const wlList = document.getElementById("wlList");

    // 语音：复用当前页 speakEn（在 renderEnglishDaily 中已定义于闭包内，此处自建轻量朗读）
    function speak(text) {
      if (!text) return;
      if (!("speechSynthesis" in window)) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        u.rate = 1;
        const vs = window.speechSynthesis.getVoices() || [];
        u.voice = vs.find(v => /en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }

    // 渲染一张单词卡：未过关显示三项自测勾选；已过关显示绿色“已过关”标记
    function cardHTML(w, showChecks) {
      const rec = wstore[w.id] || {};
      const chk = k => (rec[k] ? " on" : "");
      const passed = passedOf(w.id);
      return `
        <div class="wl-item${passed ? " passed" : ""}" data-id="${w.id}">
          <div class="wl-main">
            <div class="wl-word-row">
              <span class="wl-word">${w.word}</span>
              <span class="wl-play" data-w="${w.word}" title="朗读单词">🔊</span>
              ${passed ? `<span class="wl-badge">✅ 已过关</span>` : `<span class="wl-badge no">待过关</span>`}
            </div>
            <div class="wl-phon">${w.phonetic} <span class="wl-src">· ${w.src}</span></div>
            ${w.example ? `<div class="wl-ex">${w.example}</div>` : ""}
          </div>
          ${showChecks ? `
          <div class="wl-checks">
            <button class="wl-chk${chk("r")}" type="button" data-k="r">👁 会认</button>
            <button class="wl-chk${chk("d")}" type="button" data-k="d">🗣 会读</button>
            <button class="wl-chk${chk("m")}" type="button" data-k="m">💡 知道意思</button>
          </div>
          <div class="wl-meaning">${w.meaning}</div>` : `
          <div class="wl-meaning-simple">${w.meaning}</div>`}
        </div>`;
    }

    function render() {
      const tab = (document.querySelector(".wl-tab.active") || {}).dataset?.tab || "pending";
      let list = WORDS.slice();
      if (tab === "pending") list = list.filter(w => !passedOf(w.id));
      else if (tab === "passed") list = list.filter(w => passedOf(w.id));
      // 未过关标签：展示三项勾选（可操作）；已过关/全部标签：仅展示词义（只读）
      const showChecks = tab !== "passed";

      if (pendingTab) pendingTab.textContent = WORDS.filter(w => !passedOf(w.id)).length;
      if (passedTab) passedTab.textContent = WORDS.filter(w => passedOf(w.id)).length;
      if (allTab) allTab.textContent = WORDS.length;
      if (wlProgress) {
        const p = WORDS.filter(w => passedOf(w.id)).length;
        const pct = Math.round(p / WORDS.length * 100);
        wlProgress.innerHTML = `<span>过关进度</span><div class="wl-bar"><i style="width:${pct}%"></i></div><b>${p}/${WORDS.length} · ${pct}%</b>`;
      }
      if (wlList) {
        wlList.innerHTML = list.length
          ? list.map(w => cardHTML(w, showChecks)).join("")
          : `<div class="wl-empty">${tab === "passed" ? "🎉 还没人过关，去「未过关」里把单词练到会认会读会意吧！" : tab === "pending" ? "🎉 全部单词都已过关！太棒了 🎉" : "暂无单词。"}</div>`;

        // 三项自测勾选（仅未过关标签可操作）
        if (showChecks) {
          wlList.querySelectorAll(".wl-chk").forEach(b => b.addEventListener("click", () => {
            const item = b.closest(".wl-item");
            const id = item.dataset.id;
            const k = b.dataset.k;
            const rec = wstore[id] || { r: false, d: false, m: false };
            rec[k] = !rec[k];
            wstore[id] = rec;
            wsave();
            // 三项齐备 → 自动标记过关
            if (rec.r && rec.d && rec.m) {
              rec.pass = true;
              wsave();
            }
            render();
          }));
        }
        wlList.querySelectorAll(".wl-play").forEach(b => b.addEventListener("click", () => speak(b.dataset.w)));
      }
    }

    // 标签切换
    document.querySelectorAll(".wl-tab").forEach(t => t.addEventListener("click", () => {
      document.querySelectorAll(".wl-tab").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      render();
    }));

    render();
    window.refreshWordLib = render;

    const wlReset = document.getElementById("wlReset");
    if (wlReset) wlReset.addEventListener("click", () => {
      if (!confirm("重置后，所有单词将回到「未过关」，需要重新自测三项。确定继续？")) return;
      wstore = {};
      wsave();
      render();
    });
  })();

  /* ---------- Fragment reading (daily updated) ---------- */
  (function renderFragment() {
    if (!D || !D.fragmentReading) return;
    const fr = D.fragmentReading;
    const weeks = fr.weeks || [];
    if (!weeks.length) return;

    const PER_DAY = 5;                          // 每天推送篇数
    const WEEK_DAYS = 7;                        // 每周 7 天
    const EPOCH = new Date(2026, 7, 1);         // 2026-08-01 记为第 1 周第 1 天
    // 长短穿插：每天 5 篇 = SHORT_N 篇短 + LONG_N 篇长
    const SHORT_N = 3;                          // 每天穿插的短语段数
    const LONG_N = 2;                           // 每天穿插的长语段数

    const midnight = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dkey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const idxOf = d => Math.round((midnight(d) - EPOCH) / 86400000);
    const shiftDay = (d, k) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - k);

    // 素材池：短语段 = 第1、2周（70篇），长语段 = 第3周（16篇）
    const shortPool = (weeks[0].days || []).concat(weeks[1].days || []);
    const longPool = (weeks[2].days || []).length ? weeks[2].days : [];
    const mod = (a, m) => ((a % m) + m) % m;

    // 按日期返回当天的 5 篇 = 3 短 + 2 长（穿插）
    function pickOn(date) {
      const idx = idxOf(date);
      const weekIdx = (((Math.floor(idx / WEEK_DAYS)) % weeks.length) + weeks.length) % weeks.length;
      const dow = mod(idx, WEEK_DAYS);
      // 短池循环取 SHORT_N 篇
      const shorts = [];
      if (shortPool.length) for (let k = 0; k < SHORT_N; k++) {
        const d = shortPool[mod(idx * SHORT_N + k, shortPool.length)];
        shorts.push(Object.assign({}, d, { isLong: false }));
      }
      // 长池循环取 LONG_N 篇
      const longs = [];
      if (longPool.length) for (let k = 0; k < LONG_N; k++) {
        const d = longPool[mod(idx * LONG_N + k, longPool.length)];
        longs.push(Object.assign({}, d, { isLong: true }));
      }
      // 穿插合并：短1、长1、短2、长2、短3 —— 让长段与短段交错出现
      const list = [];
      const max = Math.max(shorts.length, longs.length);
      for (let i = 0; i < max; i++) {
        if (i < shorts.length) list.push(shorts[i]);
        if (i < longs.length) list.push(longs[i]);
      }
      const week = weeks[weekIdx];
      return { weekIdx, dow, week, list };
    }

    const today = new Date();
    const dateEl = document.getElementById("fragDate");
    if (dateEl) dateEl.textContent = fmtDate(today);
    const t = pickOn(today);
    const issueEl = document.getElementById("fragIssue");
    if (issueEl) issueEl.textContent = `每日 ${t.list.length} 篇 · ${t.list.filter(x => x.isLong).length} 长 ${t.list.filter(x => !x.isLong).length} 短 · 长短穿插`;
    const cntEl = document.getElementById("fragCount");
    if (cntEl) cntEl.textContent = `共 ${weeks.length} 周素材库 · 短 ${shortPool.length} 篇 / 长 ${longPool.length} 篇`;

    /* 练笔存储（跨「每日素材」与「素材库」共享同一套 key，写哪都同步） */
    const fragStoreKey = "wb_frag_practice_v1";
    function loadPractice() {
      try { return JSON.parse(localStorage.getItem(fragStoreKey) || "{}"); }
      catch (e) { return {}; }
    }
    function savePractice(p) {
      try { localStorage.setItem(fragStoreKey, JSON.stringify(p)); } catch (e) {}
    }
    // 素材唯一 key：分类 + 来源 + 语段前 20 字（跨周/分类稳定）
    function fragKey(d) {
      const head = (d.passage || "").replace(/\s+/g, "").slice(0, 20);
      return (d.category || "") + "|" + (d.source || "") + "|" + head;
    }
    // 练笔输入框 HTML（今日/往期/素材库共用）
    function practiceHTML(d) {
      const saved = loadPractice()[fragKey(d)] || "";
      const safeText = String(saved).replace(/`/g, "\\`");
      return `<div class="frag-block frag-practice-block" data-pkey="${fragKey(d)}">
        <div class="frag-block-title">🖊 我的练笔 <span class="frag-write-hint">写下你的仿写 / 续写（自动保存）</span></div>
        <textarea class="frag-practice-input" rows="4" placeholder="在这里写下你的练笔文段…">${safeText}</textarea>
        <div class="frag-practice-foot"><span class="frag-count">0 字</span><span class="frag-save-status">已自动保存</span></div>
      </div>`;
    }
    // 在某个容器内绑定练笔输入：实时保存 + 字数统计
    function bindPractice(root) {
      if (!root) return;
      root.querySelectorAll(".frag-practice-block").forEach(block => {
        const key = block.dataset.pkey;
        const ta = block.querySelector(".frag-practice-input");
        const count = block.querySelector(".frag-count");
        const status = block.querySelector(".frag-save-status");
        const upd = () => { if (count) count.textContent = (ta.value || "").length + " 字"; };
        upd();
        if (ta) ta.addEventListener("input", () => {
          const p = loadPractice();
          if (ta.value) p[key] = ta.value; else delete p[key];
          savePractice(p);
          upd();
          if (status) { status.textContent = "已保存 ✓"; status.classList.add("saved"); }
        });
      });
    }

    function cardHTML(d, i) {
      const badge = d.isLong
        ? `<span class="frag-len-badge is-long">📄 长语段 · ${(d.passage || "").length}字</span>`
        : `<span class="frag-len-badge">✨ 短句 · ${(d.passage || "").length}字</span>`;
      return `<div class="frag-one${d.isLong ? " is-long" : ""}">
        <div class="frag-one-head"><span class="frag-no">${i + 1}</span><span class="frag-cat">${d.category || ""}</span><span class="frag-source-mini">${d.source || ""}</span></div>
        ${badge}
        <div class="frag-passage">${d.passage || ""}</div>
        <div class="frag-block"><div class="frag-block-title">✒️ 文笔解析</div><div class="frag-analysis">${d.analysis || ""}</div></div>
        <div class="frag-block frag-prompt-block"><div class="frag-block-title">✍️ 练笔</div><div class="frag-prompt">${d.prompt || ""}</div></div>
        ${practiceHTML(d)}
      </div>`;
    }

    /* 今日 5 篇（每日更新的素材，含练笔输入框） */
    const feat = document.getElementById("fragFeatured");
    if (feat) {
      const list = t.list;
      feat.innerHTML = `<div class="frag-feat-label">🌟 今日 ${list.length} 篇 · 长短穿插（${list.filter(x => x.isLong).length} 长 · ${list.filter(x => !x.isLong).length} 短）</div>`
        + list.map(cardHTML).join("");
      bindPractice(feat);
    }

    /* 往期回顾（近 7 天，可展开） */
    const arcEl = document.getElementById("fragArchive");
    if (arcEl) {
      let html = "";
      for (let k = 1; k <= 7; k++) {
        const d = shiftDay(today, k);
        const p = pickOn(d);
        html += `<div class="frag-arc-row">
          <div class="frag-arc-head">
            <span class="frag-arc-date">${fmtDate(d)}</span>
            <span class="frag-arc-issue">${p.list.filter(x => x.isLong).length}长${p.list.filter(x => !x.isLong).length}短</span>
            <span class="frag-arc-cats">${p.list.map(x => x.category).join(" · ")}</span>
            <span class="frag-arrow">▾</span>
          </div>
          <div class="frag-arc-body">${p.list.map(cardHTML).join("")}</div>
        </div>`;
      }
      arcEl.innerHTML = html;
      bindPractice(arcEl);
      arcEl.addEventListener("click", e => {
        const h = e.target.closest(".frag-arc-head");
        if (!h) return;
        h.parentElement.classList.toggle("open");
      });
    }

    /* 打卡 + 连续天数 */
    const CK = "wb_frag_read";
    const readArr = () => { try { return JSON.parse(localStorage.getItem(CK) || "[]"); } catch (e) { return []; } };
    function streakOf(set) {
      let n = 0;
      for (let k = 0; k < 400; k++) {
        const d = shiftDay(today, k);
        if (set.has(dkey(d))) n++;
        else if (k === 0) continue;
        else break;
      }
      return n;
    }
    const ckBtn = document.getElementById("fragCheck");
    const stEl = document.getElementById("fragStreak");
    function paintCheck() {
      const set = new Set(readArr());
      const done = set.has(dkey(today));
      if (ckBtn) { ckBtn.classList.toggle("done", done); ckBtn.textContent = done ? "今日已读 ✓" : "标记今日已读"; }
      const n = streakOf(set);
      if (stEl) stEl.textContent = n > 0 ? `🔥 连续阅读 ${n} 天` : "";
    }
    if (ckBtn) ckBtn.addEventListener("click", () => {
      const arr = readArr(); const k = dkey(today); const i = arr.indexOf(k);
      if (i >= 0) arr.splice(i, 1); else arr.push(k);
      try { localStorage.setItem(CK, JSON.stringify(arr)); } catch (e) {}
      paintCheck();
    });
    paintCheck();

    /* 深度阅读：每日一篇 + 往期列表 */
    const deep = fr.deep || [];
    if (deep.length) {
      function deepCardHTML(x, idx) {
        const bodyHtml = (x.body || []).map(b => {
          const h = b.h ? `<h4 class="deep-para-h">${b.h}</h4>` : "";
          return `${h}<p class="deep-para">${b.p || ""}</p>`;
        }).join("");
        return `<div class="deep-card">
          <div class="deep-card-top">
            <span class="deep-tag">${x.tag || ""}</span>
            <span class="deep-time">${x.readingTime || ""}</span>
            <span class="frag-arrow">▾</span>
          </div>
          <div class="deep-title-lg">${x.title || ""}</div>
          <div class="deep-source">${x.source || ""}</div>
          <div class="deep-intro">${x.intro || ""}</div>
          <div class="deep-body">
            ${bodyHtml}
            <div class="deep-block"><div class="deep-block-title">🧭 结构拆解</div><div class="deep-block-body">${x.structure || ""}</div></div>
            <div class="deep-block"><div class="deep-block-title">💡 主题提炼</div><div class="deep-block-body">${x.theme || ""}</div></div>
            <div class="deep-block deep-takeaway"><div class="deep-block-title">🎯 今日带走</div><div class="deep-block-body">${x.takeaway || ""}</div></div>
          </div>
        </div>`;
      }

      /* 今日深度文章 */
      const dtEl = document.getElementById("deepToday");
      if (dtEl) {
        const idx = ((idxOf(today) % deep.length) + deep.length) % deep.length;
        dtEl.innerHTML = deepCardHTML(deep[idx], idx);
        dtEl.addEventListener("click", e => {
          const c = e.target.closest(".deep-card");
          if (!c) return;
          if (e.target.closest(".deep-body")) return;
          c.classList.toggle("open");
        });
      }

      /* 深度往期（其余文章，可展开） */
      const daEl = document.getElementById("deepArchive");
      if (daEl) {
        let html = "";
        deep.forEach((x, i) => {
          const cur = ((idxOf(today) % deep.length) + deep.length) % deep.length;
          if (i === cur) return;
          html += `<div class="deep-arc-row">
            <div class="deep-arc-head">
              <span class="deep-tag">${x.tag || ""}</span>
              <span class="deep-arc-title">${x.title || ""}</span>
              <span class="frag-arrow">▾</span>
            </div>
            <div class="deep-arc-body">${deepCardHTML(x, i)}</div>
          </div>`;
        });
        daEl.innerHTML = html;
        daEl.addEventListener("click", e => {
          const h = e.target.closest(".deep-arc-head");
          if (!h) return;
          h.parentElement.classList.toggle("open");
        });
      }
    }

    /* 素材库：周次切换 + 分类筛选 + 折叠 */
    const cats = (fr.categories && fr.categories.length) ? fr.categories : ["全部"];
    let activeCat = "全部";
    let activeWeek = t.weekIdx;                       // 默认定位到「当前周」
    const weekbarEl = document.getElementById("fragWeekbar");
    const filterEl = document.getElementById("fragFilter");
    const listEl = document.getElementById("fragList");

    function curDays() {
      return (weeks[activeWeek] || {}).days || [];
    }

    function renderList() {
      if (!listEl) return;
      const items = activeCat === "全部" ? curDays() : curDays().filter(d => d.category === activeCat);
      if (!items.length) {
        listEl.innerHTML = `<div class="frag-empty">该周该分类暂无素材，切换分类或周次看看</div>`;
        return;
      }
      listEl.innerHTML = items.map(d => {
        return `
        <div class="frag-item" data-fkey="${fragKey(d)}">
          <div class="frag-item-head"><span class="frag-cat">${d.category || ""}</span><span class="frag-source-mini">${d.source || ""}</span><span class="frag-arrow">▾</span></div>
          <div class="frag-passage">${d.passage || ""}</div>
          <div class="frag-item-body">
            <div class="frag-block"><div class="frag-block-title">✒️ 文笔解析</div><div class="frag-analysis">${d.analysis || ""}</div></div>
            <div class="frag-block frag-prompt-block"><div class="frag-block-title">✍️ 练笔</div><div class="frag-prompt">${d.prompt || ""}</div></div>
            ${practiceHTML(d)}
          </div>
        </div>`;
      }).join("");
      bindPractice(listEl);
    }

    /* 周次切换条 */
    if (weekbarEl) {
      weekbarEl.innerHTML = weeks.map((w, i) => {
        const isLong = /长语段/.test(w.label || "");
        return `<button type="button" class="frag-weekchip${i === activeWeek ? " active" : ""}" data-week="${i}">${w.label}${isLong ? " ✨" : ""}</button>`;
      }).join("");
      weekbarEl.addEventListener("click", e => {
        const b = e.target.closest(".frag-weekchip");
        if (!b) return;
        activeWeek = Number(b.dataset.week);
        weekbarEl.querySelectorAll(".frag-weekchip").forEach(x => x.classList.toggle("active", Number(x.dataset.week) === activeWeek));
        renderList();
      });
    }

    if (listEl) {
      listEl.addEventListener("click", e => {
        const it = e.target.closest(".frag-item");
        if (!it) return;
        if (e.target.closest(".frag-item-body")) return;
        it.classList.toggle("open");
      });
    }

    if (filterEl) {
      filterEl.innerHTML = cats.map(c => `<button type="button" class="frag-chip${c === activeCat ? " active" : ""}" data-cat="${c}">${c}</button>`).join("");
      filterEl.addEventListener("click", e => {
        const b = e.target.closest(".frag-chip");
        if (!b) return;
        activeCat = b.dataset.cat;
        filterEl.querySelectorAll(".frag-chip").forEach(x => x.classList.toggle("active", x.dataset.cat === activeCat));
        renderList();
      });
    }
    renderList();
  })();

  /* ---------- Snapshot label ---------- */
  if (D && D.snapshotLabel) { const sl = $("#snapLabel"); if (sl) sl.textContent = D.snapshotLabel.split("·")[1].trim(); }
})();
