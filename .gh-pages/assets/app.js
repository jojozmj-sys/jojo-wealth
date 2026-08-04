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
  const sideCollapse = $("#sideCollapse");
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

  /* ---------- 侧边栏左右展开/收起（桌面端） ---------- */
  sideCollapse.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-collapsed");
  });

  /* ---------- 侧边栏滑动：左滑收起、右滑展开（触屏/鼠标拖拽） ---------- */
  (function initSidebarSwipe() {
    if (!sidebar || !window.PointerEvent) return;
    let startX = 0, startY = 0, active = false, moved = false;
    const THRESHOLD = 40;      // 水平位移阈值
    const DOMINANT = 1.3;      // 水平需明显大于垂直才算横向滑动

    sidebar.addEventListener("pointerdown", e => {
      active = true; moved = false;
      startX = e.clientX; startY = e.clientY;
    });
    sidebar.addEventListener("pointermove", e => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      // 一旦确定为纵向滚动（菜单滚动），放弃本次滑动
      if (!moved && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        active = false; // 让给纵向滚动
        return;
      }
      if (Math.abs(dx) > 10) moved = true;
    });
    const finish = (e) => {
      if (!active) { active = false; return; }
      active = false;
      if (!moved) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < THRESHOLD) return;                    // 未达阈值
      if (Math.abs(dy) > Math.abs(dx) * DOMINANT) return;      // 纵向为主，忽略
      const isCollapsed = document.body.classList.contains("sidebar-collapsed");
      if (dx > 0 && isCollapsed) {
        // 右滑 → 展开
        document.body.classList.remove("sidebar-collapsed");
      } else if (dx < 0 && !isCollapsed) {
        // 左滑 → 收起
        document.body.classList.add("sidebar-collapsed");
      }
    };
    sidebar.addEventListener("pointerup", finish);
    sidebar.addEventListener("pointercancel", () => { active = false; });
  })();

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
  /* ---------- 每日新闻：多版面 + 每2小时自动更新 + 今日要闻 ---------- */
  const NEWS_API = "https://60s.viki.moe/v2/60s";
  const NEWS_CACHE_KEY = "wb_news_cache_v2";
  const NEWS_INTERVAL_MS = 2 * 60 * 60 * 1000; // 每 2 小时

  /* 关键词 → 版面归类（用于把实时新闻整理进对应版面） */
  function classifyNewsSection(title) {
    const t = (title || "");
    if (/(地震|暴雨|台风|高温预警|寒潮|寒潮预警|气象预警|预警信号|降温|强降雨|洪水|干旱|暴雨预警|台风预警|气象台|气象局)/.test(t)) return "天气预警";
    if (/(美联储|央行|人民币|股市|A股|港股|基金|利率|汇率|GDP|经济|财政|税收|投资|融资|银行|债券|上市公司|通胀|CPI|出口|贸易)/.test(t)) return "财经";
    if (/(AI|人工智能|芯片|半导体|华为|苹果|小米|腾讯|阿里|字节|百度|软件|手机|5G|6G|算法|互联网|科技|机器人|航天|卫星|火箭|SpaceX|大模型|新能源|电动车|量子)/.test(t)) return "科技";
    if (/(体育|奥运|世界杯|足球|篮球|网球|国足|NBA|CBA|金牌|冠军|羽毛球|乒乓球|田径)/.test(t)) return "体育";
    if (/(电影|票房|电视剧|综艺|演唱会|明星|导演|艺人|音乐|综艺|纪录片|颁奖|演出)/.test(t)) return "文娱";
    if (/(美国|俄|乌|英|法|德|日本|韩国|印度|欧盟|联合国|北约|中东|以色列|伊朗|欧洲|非洲|美洲|海外|全球|国际|特朗普|普京|世卫)/.test(t)) return "国际";
    if (/(国务院|发改委|政府|政策|规定|通知|新闻办|卫健委|教育部|公安部|中办|国办|部长|省委|市委|县长|市场监管|财政部)/.test(t)) return "国内";
    return "头条";
  }
  /* 重要新闻判定（用于今日要闻精选） */
  function isTopNews(title) {
    const t = (title || "");
    return /(重大|突发|宣布|正式|国家|国家主席|国务院|央行|首次|创历史|重要讲话|开幕|签署|通过|发布|出台|地震|台风|升级|紧急|官宣)/.test(t);
  }

  function newsSearchUrl(t) {
    return "https://www.baidu.com/s?wd=" + encodeURIComponent(t);
  }

  /* 从 API 拉取实时新闻并整理 */
  async function fetchLiveNews() {
    try {
      const res = await fetch(NEWS_API, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error("http " + res.status);
      const j = await res.json();
      const d = (j && j.data) || {};
      const list = (d.news || []).filter(Boolean).slice(0, 15);
      if (!list.length) throw new Error("empty news");
      const now = new Date();
      const dateStr = d.date || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
      const weekday = ["周日","周一","周二","周三","周四","周五","周六"][now.getDay()];
      // 今日要闻（重要新闻优先，最多 10 条，不足则用其他新闻补齐）
      const tops = list.filter(isTopNews);
      const headlinePool = tops.length >= 2 ? [...tops, ...list.filter(t => !isTopNews(t))] : list;
      const headline = headlinePool.slice(0, 10).map(t => ({
        title: t, url: newsSearchUrl(t), source: "实时新闻", important: true
      }));
      // 整理进版面：在现有静态版面基础上，把实时新闻按关键词归入对应版面
      const base = (D.news && D.news.today && D.news.today.sections) || [];
      const sections = base.map(s => ({ name: s.name, items: (s.items||[]).slice() }));
      const addToSection = (name, title) => {
        const sec = sections.find(s => s.name === name) || sections[0];
        if (sec) sec.items.unshift({ title, desc: "", source: "实时新闻", url: newsSearchUrl(title) });
      };
      list.forEach(t => addToSection(classifyNewsSection(t), t));
      const newsData = {
        mode: "live",
        updated: `${now.getHours()}:${String(now.getMinutes()).padStart(2,"0")}`,
        today: { date: dateStr, weekday, sections }
      };
      D.news = newsData;
      // 缓存
      try { localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: newsData, headline })); } catch (e) {}
      renderNewsUI(newsData, headline);
      return true;
    } catch (e) {
      return false;
    }
  }

  function renderHeadlineUI(headline) {
    const box = $("#newsHeadline");
    if (!box) return;
    if (!headline || !headline.length) { box.hidden = true; return; }
    box.hidden = false;
    const $cnt = $("#newsHeadlineCount");
    if ($cnt) $cnt.textContent = headline.length + " 条要闻 · 实时整理";
    // 全部默认收起（只显示标题），点头部切换；列表项都是同一形态
    $("#newsHeadlineList").innerHTML = headline.map((it, i) => {
      return `
      <div class="news-hl-item" data-hl="${i}">
        <span class="news-hl-rank">${i + 1}</span>
        <div class="news-hl-main">
          <div class="news-hl-head">
            <div class="news-hl-t">${escapeHtml(it.title)}</div>
            <span class="news-hl-arr">▸</span>
          </div>
          <div class="news-hl-src">${it.source} · <a class="news-link" href="${it.url}" target="_blank" rel="noopener">查看原文 ↗</a></div>
        </div>
      </div>`;
    }).join("");
    // 折叠交互：点击任一条目头部切换展开/收起
    const listEl = $("#newsHeadlineList");
    listEl.querySelectorAll(".news-hl-item").forEach(item => {
      item.querySelector(".news-hl-head").addEventListener("click", () => {
        const open = item.classList.contains("open");
        item.classList.toggle("open", !open);
        const arr = item.querySelector(".news-hl-arr");
        if (arr) arr.textContent = open ? "▸" : "▾";
      });
    });
  }

  function renderNewsUI(N, headline) {
    N = N || D.news || {};
    const today = N.today || {};
    const sections = today.sections || [];
    const $date = $("#newsDate"), $upd = $("#newsUpdated"), $cnt = $("#newsCount"), $filter = $("#newsFilter"), $box = $("#news");
    if ($date) $date.textContent = (today.date || "") + " " + (today.weekday || "");
    if ($upd) $upd.textContent = "更新于 " + (N.updated || "");
    const total = sections.reduce((a, s) => a + (s.items ? s.items.length : 0), 0);
    if ($cnt) $cnt.textContent = sections.length + " 个版面 · 共 " + total + " 条";
    const newsItemHTML = (s, it) => `
      <div class="news-item">
        <div class="t"><span class="tag">${s.name}</span><span>${it.title}</span></div>
        ${it.desc ? `<div class="d">${it.desc}</div>` : ""}
        <div class="src">来源：${it.source} · <a class="news-link" href="${it.url}" target="_blank" rel="noopener">查看原文 ↗</a></div>
      </div>`;
    const newsSectionHTML = (s) => {
      const items = s.items || [];
      // 默认整体折叠（只看到版块标题+数量），点头部展开
      return `
        <div class="news-section collapsed">
          <div class="news-sec-head"><span>${s.name}</span><span class="news-sec-num">${items.length} 条</span><span class="news-arr">▸</span></div>
          <div class="news-sec-items">${items.map(it => newsItemHTML(s, it)).join("")}</div>
        </div>`;
    };
    const build = (filter) => {
      const list = (!filter || filter === "全部") ? sections : sections.filter(s => s.name === filter);
      if (!list.length) return `<div class="news-empty">今日暂无该版面新闻</div>`;
      return list.map(s => newsSectionHTML(s)).join("");
    };
    let cur = "全部";
    const renderFilter = () => {
      const names = ["全部", ...sections.map(s => s.name)];
      $filter.innerHTML = names.map(n => `<button class="news-chip${n === cur ? " active" : ""}" data-f="${n}">${n}</button>`).join("");
      $filter.querySelectorAll(".news-chip").forEach(b => {
        b.addEventListener("click", () => { cur = b.dataset.f; renderFilter(); $box.innerHTML = build(cur); bindNews(); });
      });
    };
    // 版面折叠交互：点击版面头切换收起/展开
    const bindNews = () => {
      if (!$box) return;
      $box.querySelectorAll(".news-sec-head").forEach(head => {
        head.addEventListener("click", () => {
          const sec = head.closest(".news-section");
          if (!sec) return;
          const collapsed = sec.classList.toggle("collapsed");
          const arr = head.querySelector(".news-arr");
          if (arr) arr.textContent = collapsed ? "▸" : "▾";
        });
      });
    };
    renderFilter();
    $box.innerHTML = build(cur);
    bindNews();
    renderHeadlineUI(headline || headlineFromData(N));
  }

  /* 初始化新闻：优先缓存 → 静态快照，然后检查是否需要刷新 */
  /* 从静态/现有新闻数据生成默认今日要闻（保证初始即显示，避免“显示缺失”） */
  function headlineFromData(N) {
    const today = (N && N.today) || {};
    const sections = today.sections || [];
    const items = [];
    for (const s of sections) {
      for (const it of (s.items || [])) {
        items.push({
          title: it.title || it,
          url: it.url || newsSearchUrl(it.title || it),
          source: it.source || "今日新闻",
          important: true
        });
        if (items.length >= 10) break;
      }
      if (items.length >= 10) break;
    }
    return items.slice(0, 10);
  }

  (function initNews() {
    let cached = null, cachedHeadline = null;
    try {
      const raw = localStorage.getItem(NEWS_CACHE_KEY);
      if (raw) { const c = JSON.parse(raw); cached = c.data; cachedHeadline = c.headline || null; }
    } catch (e) {}
    // 首次渲染：用缓存（若有且为今天）否则用静态快照；都要保证今日要闻不缺失
    if (cached && cached.today && cached.today.date === (D.news && D.news.today && D.news.today.date)) {
      D.news = cached;
      renderNewsUI(cached, cachedHeadline || headlineFromData(cached));
    } else {
      renderNewsUI(D.news, headlineFromData(D.news));
    }
    // 每 2 小时检查：距上次更新超过 2 小时则拉取
    const tryRefresh = () => {
      let lastTs = 0;
      try {
        const raw = localStorage.getItem(NEWS_CACHE_KEY);
        if (raw) lastTs = (JSON.parse(raw).ts) || 0;
      } catch (e) {}
      if (!lastTs || (Date.now() - lastTs) >= NEWS_INTERVAL_MS) {
        fetchLiveNews().then(ok => {
          const badge = $("#newsLiveBadge");
          if (badge) badge.textContent = ok ? "🟢 实时更新 · 每2小时" : "🔄 每2小时自动更新";
        });
      } else {
        const badge = $("#newsLiveBadge");
        if (badge) badge.textContent = "🟢 实时更新 · 每2小时";
      }
    };
    tryRefresh();
    setInterval(tryRefresh, NEWS_INTERVAL_MS);
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

    // b23: 顶部状态条元素（每次更新/启动/失败时回调）
    const $hotBar = document.getElementById("hotRefreshBar");
    const HOT_INTERVAL_MS = 30 * 60 * 1000; // 30 分钟
    let nextTimer = null;        // setTimeout 句柄
    let nextDueAt = 0;            // 下次到期时间戳
    let tickingTimer = null;      // 倒计时 1s ticker
    let inFlight = false;         // 防止并发

    function setBar(state, msg) {
      if (!$hotBar) return;
      const dot = $hotBar.querySelector(".hot-bar-dot");
      const txt = $hotBar.querySelector(".hot-bar-txt");
      const cdn = $hotBar.querySelector(".hot-bar-cdn");
      if (dot) dot.dataset.state = state || "idle"; // idle | live | error | loading
      if (txt) txt.textContent = msg || "";
    }
    function pad2(n) { return String(n).padStart(2, "0"); }
    function fmtTime(d) {
      return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    }
    function fmtCountdown(ms) {
      if (ms <= 0) return "即将刷新…";
      const total = Math.floor(ms / 1000);
      const m = Math.floor(total / 60);
      const s = total % 60;
      return "下次刷新 " + pad2(m) + ":" + pad2(s);
    }
    function startCountdown() {
      stopCountdown();
      tickingTimer = setInterval(() => {
        if (!$hotBar) return;
        const cdn = $hotBar.querySelector(".hot-bar-cdn");
        if (!cdn) return;
        const remain = nextDueAt - Date.now();
        cdn.textContent = remain > 0 ? fmtCountdown(remain) : "即将刷新…";
      }, 1000);
    }
    function stopCountdown() {
      if (tickingTimer) { clearInterval(tickingTimer); tickingTimer = null; }
    }
    function scheduleNext() {
      if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
      nextDueAt = Date.now() + HOT_INTERVAL_MS;
      const cdn = $hotBar && $hotBar.querySelector(".hot-bar-cdn");
      if (cdn) cdn.textContent = fmtCountdown(HOT_INTERVAL_MS);
      startCountdown();
      nextTimer = setTimeout(() => { tickRefresh(); }, HOT_INTERVAL_MS);
    }
    function tickRefresh() {
      // 到点刷新：完成后再排下一次（无论成功失败都重排，确保 30 分钟周期不漏）
      manualRefresh().finally(() => { scheduleNext(); });
    }

    async function manualRefresh() {
      if (inFlight) return 0;
      inFlight = true;
      const old = $btn ? $btn.textContent : "";
      if ($btn) { $btn.textContent = "更新中…"; $btn.disabled = true; }
      setBar("loading", "⏳ 正在拉取实时热点…");
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
      if (got) setBar("live", "🟢 已更新 " + got + " 个平台 · " + fmtTime(now));
      else setBar("error", "⚠️ 实时接口暂不可用 · 已保留上轮缓存");
      if ($btn) {
        $btn.textContent = got ? "✅ 已更新 " + got + " 个平台" : "实时接口暂不可用";
        setTimeout(() => { $btn.textContent = old; $btn.disabled = false; }, 2500);
      }
      inFlight = false;
      return got;
    }
    if ($btn) $btn.addEventListener("click", () => { manualRefresh().then(got => { if (got) scheduleNext(); }); });

    // b23: 页面可见时启动 30 分钟自动刷新；切走/隐藏时停止（避免后台空跑）
    const $pageHot = document.getElementById("page-hot");
    function startAuto() {
      if (nextTimer) return; // 已在跑
      setBar("live", "⏱ 30 分钟自动刷新已启用");
      scheduleNext();
      // 首次进入立即拉一次（保证用户进来就看到最新热点）
      manualRefresh();
    }
    function stopAuto() {
      if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
      stopCountdown();
      const cdn = $hotBar && $hotBar.querySelector(".hot-bar-cdn");
      if (cdn) cdn.textContent = "（页面隐藏中）";
    }
    if ($pageHot && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((ents) => {
        ents.forEach(en => { en.isIntersecting ? startAuto() : stopAuto(); });
      }, { threshold: 0.1 });
      io.observe($pageHot);
    } else {
      // 老浏览器兜底：直接启动
      startAuto();
    }
    // 浏览器切到后台/锁屏时也停掉，回到前台立即刷一次
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { stopAuto(); }
      else if ($pageHot && $pageHot.classList.contains("active")) { startAuto(); manualRefresh(); }
    });
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
  // 板块展开/收起：点击 .sub-title-collapse 的标题区切换下方 .sec-body / .collapsible-body 显隐
  document.querySelectorAll(".sub-title-collapse").forEach(title => {
    title.addEventListener("click", (ev) => {
      // 不要拦截「阅读模式」按钮的点击
      if (ev.target.closest(".mode-toggle")) return;
      const body = title.nextElementSibling;
      if (!body) return;
      // 模式 A：sec-body 旧式（手动加/去 sec-body-hidden）
      if (body.classList.contains("sec-body")) {
        const open = body.classList.contains("sec-body-hidden");
        body.classList.toggle("sec-body-hidden", !open);
        title.classList.toggle("collapsed", !open);
        const arr = title.querySelector(".sec-arr");
        if (arr) arr.textContent = open ? "▾" : "▸";
        return;
      }
      // 模式 B：collapsible-body 新式（CSS 用 + 选择器同步 .collapsed 状态）
      if (body.classList.contains("collapsible-body")) {
        const willCollapse = !title.classList.contains("collapsed");
        title.classList.toggle("collapsed", willCollapse);
        const arr = title.querySelector(".sec-arr");
        if (arr) arr.textContent = willCollapse ? "▸" : "▾";
        return;
      }
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

  /* ---------- 播客 · 单期「喜欢」基础设施 ---------- */
  const POD_LIKE_KEY = "wb_pod_likes";
  const POD_LIKE_FB = "wb_pod_likes_bak";
  let podLikes = {};                       // { epKey: ts }
  try { podLikes = JSON.parse(localStorage.getItem(POD_LIKE_KEY) || "{}") || {}; } catch (e) { podLikes = {}; }
  const podEpKey = (e) => ((e && e.show) ? e.show : "未知节目") + "·" + ((e && e.title) ? e.title : "未知单期");
  const isLiked = (e) => Object.prototype.hasOwnProperty.call(podLikes, podEpKey(e));
  function podLikeToast(msg, ms) {
    let el = document.getElementById("podLikeToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "podLikeToast";
      el.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:9999;background:var(--card);color:var(--pink-dark);border:1px solid var(--mint);border-radius:10px;padding:8px 14px;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,.08);opacity:0;transition:opacity .2s;pointer-events:none;max-width:260px;line-height:1.45;";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = "0"; }, ms || 1600);
  }
  function savePodLikes() {
    const json = JSON.stringify(podLikes);
    try { localStorage.setItem(POD_LIKE_KEY, json); return true; }
    catch (e1) {
      try { sessionStorage.setItem(POD_LIKE_FB, json); } catch (e2) {}
      podLikeToast("⚠️ 本地存储不可用，「喜欢」仅本次会话内保留。", 3500);
      return false;
    }
  }
  function togglePodLike(ep, btn) {
    const k = podEpKey(ep);
    const on = isLiked(ep);
    if (on) {
      delete podLikes[k];
    } else {
      podLikes[k] = Date.now();
    }
    savePodLikes();
    if (btn) {
      btn.classList.toggle("liked", !on);
      btn.setAttribute("aria-pressed", String(!on));
      btn.title = !on ? "已喜欢（再点取消）" : "喜欢这期播客";
      const t = btn.querySelector(".pod-like-glyph");
      if (t) t.textContent = !on ? "❤" : "♡";
    }
    podLikeToast(on ? "已取消喜欢" : ("❤ 已收藏：" + (ep.title || "本期节目")));
    // 同步刷新"猜你喜欢"区块
    renderPodRecommend();
  }
  function podLikeBtnHtml(ep) {
    const on = isLiked(ep);
    return `<button class="pod-like-btn${on ? " liked" : ""}" type="button" data-like="1" aria-pressed="${on}" title="${on ? "已喜欢（再点取消）" : "喜欢这期播客"}"><span class="pod-like-glyph">${on ? "❤" : "♡"}</span></button>`;
  }

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
            ${podLikeBtnHtml(e)}
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
      <div class="pod-ep-head"><span class="pod-ep-show">${e.show}</span><span class="pod-ep-title">${e.title}</span>${podLikeBtnHtml(e)}</div>
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

  /* ---------- ❤️ 喜欢按钮事件委托（精选单期 + RSS 最新单期） ---------- */
  function bindLikeClicks(box, getEpisode) {
    if (!box) return;
    box.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".pod-like-btn");
      if (!btn) return;
      ev.stopPropagation();
      const ep = getEpisode(btn);
      if (!ep) return;
      togglePodLike(ep, btn);
    });
  }
  bindLikeClicks(podLatestBox, (btn) => {
    // 通过 head 里的 pod-ep-title 文字匹配回 list
    if (!podLatestBox) return null;
    const card = btn.closest(".pod-ep");
    if (!card) return null;
    const show = card.querySelector(".pod-ep-show")?.textContent || "";
    const title = card.querySelector(".pod-ep-title")?.textContent || "";
    return (D.podcastLatest || []).find(e => e && e.show === show && e.title === title) || null;
  });
  bindLikeClicks(podEpBox, (btn) => {
    const card = btn.closest(".pod-ep");
    if (!card) return null;
    const show = card.querySelector(".pod-ep-show")?.textContent || "";
    const title = card.querySelector(".pod-ep-title")?.textContent || "";
    return (D.podcastEpisodes || []).find(e => e && e.show === show && e.title === title) || null;
  });

  /* ---------- 🎯 猜你喜欢：根据 ❤️ 记录推荐 ---------- */
  // 主题词：精选库里有"标题+summary+quotes"可用；RSS 只有 title 文本。
  // 简单算法：聚合 show 喜欢数 → Top3 节目；聚合 quotes 文本 → 词频 Top6 主题词。
  const STOP_WORDS = new Set(["我们","你们","他们","她们","它们","这个","那个","一个","一些","一种","一定","一直","已经","可以","可能","应该","没有","不是","就是","也是","还是","什么","怎么","为什么","如果","因为","所以","但是","而且","以及","或者","而是","则","那","这","我","你","他","她","它","了","的","是","在","和","与","或","也","就","要","会","能","得","着","过","把","被","给","从","到","为","以","对","上","下","中","里","外","前","后","之","其","此","彼","每","各","某","本","另","再","又","才","并","且","且","所","以便","之","也","就","即","在","向","由","自","于","按","依","据","至","到","之","其","本","该"]);
  const TOKEN_RE = /[\u4e00-\u9fa5]{2,4}/g;   // 2-4 字中文词
  function tokenize(text) {
    const out = [];
    const m = (text || "").match(TOKEN_RE) || [];
    for (const t of m) {
      if (STOP_WORDS.has(t)) continue;
      out.push(t);
    }
    return out;
  }
  function renderPodRecommend() {
    const recBox = $("#podcastRecommend");
    if (!recBox) return;
    const entries = Object.entries(podLikes);
    if (entries.length === 0) {
      recBox.innerHTML = `<div class="pod-rec-empty">🤍 还没有喜欢的单期 —— 看到触动你的节目，点下 ❤ 按钮，我会慢慢读懂你，给你推荐合适的内容。</div>`;
      return;
    }
    // 节目级聚合
    const showCount = {};
    const showLatest = {};          // 节目 → 最近一集（用于显示代表作）
    const allEpisodesByKey = {};
    (D.podcastEpisodes || []).forEach(e => { if (e && e.show) allEpisodesByKey[e.show + "·" + e.title] = e; });
    (D.podcastLatest || []).forEach(e => { if (e && e.show) allEpisodesByKey[e.show + "·" + e.title] = e; });
    entries.forEach(([k, ts]) => {
      const ep = allEpisodesByKey[k];
      if (!ep) return;
      showCount[ep.show] = (showCount[ep.show] || 0) + 1;
      if (!showLatest[ep.show] || ts > showLatest[ep.show].ts) {
        showLatest[ep.show] = { ep, ts };
      }
    });
    const topShows = Object.entries(showCount).sort((a,b) => b[1]-a[1]).slice(0, 5);

    // 主题词聚合
    const wordCount = {};
    entries.forEach(([k]) => {
      const ep = allEpisodesByKey[k];
      if (!ep) return;
      const corpus = [ep.title, ep.summary, (ep.quotes || []).join(" "), ep.core || "", (ep.points || []).join(" "), ep.reason || ""].join(" ");
      tokenize(corpus).forEach(w => { wordCount[w] = (wordCount[w] || 0) + 1; });
    });
    const topWords = Object.entries(wordCount).sort((a,b) => b[1]-a[1]).slice(0, 8);

    // 候选推荐：从精选库 + RSS 库中，已被喜欢节目所属主题词的、未被喜欢的、Top 3
    const likedKeys = new Set(entries.map(([k]) => k));
    const candidates = [];
    const seenKeys = new Set();
    function pushCand(ep) {
      if (!ep || !ep.show || !ep.title) return;
      const k = ep.show + "·" + ep.title;
      if (likedKeys.has(k) || seenKeys.has(k)) return;
      seenKeys.add(k);
      // 算 score：corpus 中含 topWords 几个
      const corpus = [ep.title, ep.summary, (ep.quotes || []).join(" "), ep.core || "", (ep.points || []).join(" "), ep.reason || ""].join(" ");
      let s = 0;
      const tokens = new Set(tokenize(corpus));
      topWords.forEach(([w]) => { if (tokens.has(w)) s += 1; });
      // 同一节目加 0.3 分（基于 show 喜欢加权）
      if (showCount[ep.show]) s += 0.3;
      candidates.push({ ep, s });
    }
    (D.podcastEpisodes || []).forEach(pushCand);
    (D.podcastLatest || []).forEach(pushCand);
    candidates.sort((a,b) => b.s - a.s);
    const recs = candidates.filter(c => c.s > 0).slice(0, 3);

    const showChips = topShows.length
      ? `<div class="pod-rec-row"><div class="pod-rec-label">🎙 你常听的节目</div><div class="pod-rec-shows">${
          topShows.map(([s, c]) => `<span class="pod-rec-chip">${s}<span class="pod-rec-num">${c}</span></span>`).join("")
        }</div></div>` : "";
    const wordChips = topWords.length
      ? `<div class="pod-rec-row"><div class="pod-rec-label">💡 你常听的主题</div><div class="pod-rec-words">${
          topWords.map(([w, c]) => `<span class="pod-rec-tag">#${w}<span class="pod-rec-num">${c}</span></span>`).join("")
        }</div></div>` : "";
    const recList = recs.length
      ? `<div class="pod-rec-row"><div class="pod-rec-label">✨ 为你推荐</div><div class="pod-rec-list">${
          recs.map(({ ep }) => `
            <div class="pod-rec-card">
              <div class="pod-rec-card-head"><span class="pod-rec-show">${ep.show}</span><span class="pod-rec-title">${ep.title}</span></div>
              <div class="pod-rec-sum">${(ep.summary || ep.core || "").slice(0, 70)}${(ep.summary || ep.core || "").length > 70 ? "…" : ""}</div>
            </div>`).join("")
        }</div></div>`
      : `<div class="pod-rec-row"><div class="pod-rec-label">✨ 为你推荐</div><div class="pod-rec-empty">再多收藏几期，我会更懂你的口味。</div></div>`;

    recBox.innerHTML = `<div class="pod-rec-head">🤍 你的播客口味 · 已收藏 ${entries.length} 期</div>${showChips}${wordChips}${recList}`;
  }
  renderPodRecommend();

  /* ---------- Memos（我的记录：支持语音 + 图片 + 智能归档） ---------- */
  const memoKey = "wb_memos";
  let memos = [];
  try { memos = JSON.parse(localStorage.getItem(memoKey)) || []; } catch (e) { memos = []; }
  // 兼容旧版（纯字符串）→ 对象 { t, img, ts, cat }
  memos = memos.map(m => typeof m === "string" ? { t: m, img: null, ts: 0, cat: "daily" } : (m.cat ? m : { ...m, cat: "daily" }));

  /* 备忘录分类元信息 */
  const MEMO_CATS = {
    meeting: { name: "会议记录", icon: "📋" },
    daily:   { name: "日常记录", icon: "📅" },
    thought: { name: "随笔感想", icon: "💭" }
  };
  /* 关键词自动识别分类（优先级从高到低） */
  const MEMO_RULES = [
    { cat: "meeting", kw: ["会议", "开会", "纪要", "议题", "讨论", "决策", "参会", "会议记录", "周会", "例会", "晨会", "汇报", "立项", "复盘会", "头脑风暴", "对齐", "同步", "排期", "上线", "需求", "方案", "议程", "决议", "待办事项", "分工", "负责人"] },
    { cat: "thought", kw: ["感想", "随笔", "感悟", "心情", "思考", "觉得", "感受", "反思", "日记", "碎碎念", "灵感", "想法", "启发", "困惑", "焦虑", "开心", "难过", "梦想", "目标", "复盘", "成长", "喜欢", "希望", "我想", "我觉得", "意识到"] },
    { cat: "daily",   kw: ["买菜", "做饭", "吃饭", "睡觉", "快递", "取件", "缴费", "水电", "账单", "购物", "买东西", "日程", "安排", "提醒", "备忘", "todo", "任务", "今天", "明天", "周末", "约", "聚餐", "看电影", "收拾", "打扫", "出门", "回家", "买", "拿"] }
  ];
  function guessMemoCat(text) {
    const t = (text || "").toLowerCase();
    if (!t) return "daily";
    for (const r of MEMO_RULES) {
      if (r.kw.some(k => t.indexOf(k.toLowerCase()) !== -1)) return r.cat;
    }
    return "daily";
  }

  let memoImgData = null; // 待添加的压缩后 dataURL
  let memoCurCat = "all"; // 当前筛选分类

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
  function renderMemoTabs() {
    const wrap = $("#memoTabs");
    if (!wrap) return;
    wrap.querySelectorAll(".memo-tab").forEach(b => {
      const c = b.dataset.mcat;
      let count = c === "all" ? memos.length : memos.filter(m => (m.cat || "daily") === c).length;
      b.classList.toggle("active", c === memoCurCat);
      // 在标签里显示计数
      const m = b.textContent.replace(/\s*\d*$/, "");
      b.textContent = `${m} ${count}`;
      b.addEventListener("click", () => {
        memoCurCat = c;
        renderMemoTabs(); renderMemos();
      });
    });
  }
  function renderMemos() {
    const list = $("#memoList");
    if (!list) return;
    const filtered = memoCurCat === "all" ? memos : memos.filter(m => (m.cat || "daily") === memoCurCat);
    if (!filtered.length) {
      const emptyTxt = memoCurCat === "all" ? "还没有记录 ✦" : `还没有${MEMO_CATS[memoCurCat]?.name || ""} ✦`;
      list.innerHTML = `<div class="plan-empty">${emptyTxt}</div>`;
    }
    else list.innerHTML = filtered.map((m, i) => {
      const cat = m.cat || "daily";
      const catMeta = MEMO_CATS[cat] || MEMO_CATS.daily;
      const origIdx = memos.indexOf(m);
      return `
      <li data-memo-open="${origIdx}">
        ${m.img ? `<img class="memo-img" src="${m.img}" alt="图片" />` : ""}
        <div class="memo-main">
          <span class="memo-cat-tag cat-${cat}" title="${catMeta.name}">${catMeta.icon} ${catMeta.name}</span>
          <span class="memo-text">${escapeHtml(m.t || "")}</span>
          <span class="memo-time">${m.ts ? formatMemoTs(m.ts) : ""}</span>
        </div>
        <button class="del" data-memo-i="${origIdx}" title="删除">×</button>
      </li>`;
    }).join("");
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
    const sel = $("#memoCat");
    let cat = sel && sel.value !== "auto" ? sel.value : guessMemoCat(v || "");
    memos.unshift({ t: v, img: memoImgData, ts: Date.now(), cat });
    $("#memoInput").value = "";
    autoSize($("#memoInput"));
    memoImgData = null;
    $("#memoImgPreview").hidden = true;
    $("#memoImgThumb").src = "";
    saveMemos(); renderMemoTabs(); renderMemos();
  });
  $("#memoInput").addEventListener("input", e => autoSize(e.target));
  $("#memoInput").addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) $("#memoAdd").click(); });
  $("#memoList").addEventListener("click", e => {
    const del = e.target.closest(".del");
    if (del) {
      memos.splice(+del.dataset.memoI, 1);
      saveMemos(); renderMemoTabs(); renderMemos();
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
    const cat = m.cat || "daily";
    const catMeta = MEMO_CATS[cat] || MEMO_CATS.daily;
    body.innerHTML = `
      ${m.ts ? `<div class="mf-view-date">${formatMemoTs(m.ts)}</div>` : ""}
      <div class="mf-view-cat cat-${cat}">${catMeta.icon} ${catMeta.name}</div>
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

  renderMemoTabs();
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
  // 按需动态加载 Tesseract OCR 引擎：仅在用户第一次点「拍图识字」时才下载 CDN 脚本，避免阻塞首屏
  function loadTesseract() {
    return new Promise((resolve, reject) => {
      if (typeof Tesseract !== "undefined") return resolve();
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
      s.onload = () => (typeof Tesseract !== "undefined" ? resolve() : reject(new Error("识别引擎加载异常")));
      s.onerror = () => reject(new Error("网络错误"));
      document.head.appendChild(s);
    });
  }
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

  /* ---------- 摘抄分类归档：写人 / 写事 / 写景 / 观点 / 情感 / 其他 + 自定义 ---------- */
  const EX_DEFAULT_CATS = ["写人", "写事", "写景", "观点", "情感", "其他"];
  const exCatChips = $("#exCatChips");
  const exCatCustom = $("#exCatCustom");
  let exCat = "";               // 当前选择的类别
  let exFilter = "";            // 当前筛选的类别（""=全部，"__none"=未分类）

  // 从既有摘抄里收集出现过的自定义类别，与预设类别合并展示
  function exAllCats() {
    const set = new Set(EX_DEFAULT_CATS);
    exLoadAll().forEach(it => { if (it && it.cat && !it.cat.startsWith("__")) set.add(it.cat); });
    return Array.from(set);
  }
  function exRenderCatChips() {
    if (!exCatChips) return;
    const cats = exAllCats();
    exCatChips.innerHTML = cats.map(c => `
      <button type="button" class="excerpt-cat-chip${exCat === c ? " active" : ""}" data-cat="${c.replace(/"/g, "&quot;")}">${c}</button>
    `).join("");
    exCatChips.querySelectorAll(".excerpt-cat-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        exCat = btn.dataset.cat;
        if (exCatCustom) exCatCustom.value = "";
        exRenderCatChips();
      });
    });
  }
  if (exCatCustom) {
    exCatCustom.addEventListener("input", () => {
      const v = exCatCustom.value.trim();
      if (v) {
        exCat = v;
        exRenderCatChips();  // 高亮会随 exCat 变化更新（自定义类别默认不在 chips 里，无高亮即可）
      }
    });
  }

  /* 摘抄编辑区草稿自动保存：还没点「保存到摘抄库」也不会丢 */
  const EX_DRAFT_KEY = "wb_excerpt_draft";
  function exSaveDraft() {
    try {
      localStorage.setItem(EX_DRAFT_KEY, JSON.stringify({
        text: exText ? exText.value : "",
        source: exSource ? exSource.value : "",
        tags: exTags ? exTags.value : "",
        cat: exCat
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
    if (d.cat) { exCat = d.cat; if (exCatCustom) exCatCustom.value = EX_DEFAULT_CATS.indexOf(d.cat) >= 0 ? "" : d.cat; }
  })();
  [exText, exSource, exTags].forEach(el => { if (el) el.addEventListener("input", exSaveDraft); });
  // 摘抄的类别：兼容旧数据（无 cat 字段）→ 未分类
  function exCatOf(it) { return (it && it.cat && it.cat.trim()) ? it.cat.trim() : "__none"; }

  // 渲染「我的摘抄」顶部分类筛选栏，并统计每类数量
  function exRenderFilters() {
    if (!document.getElementById("exFilters")) return;
    const arr = exLoadAll();
    const counts = {};
    arr.forEach(it => { const c = exCatOf(it); counts[c] = (counts[c] || 0) + 1; });
    const all = [{ k: "", label: "全部" }, ...EX_DEFAULT_CATS.map(c => ({ k: c, label: c }))];
    // 追加出现过的自定义类别
    Object.keys(counts).forEach(c => {
      if (c !== "__none" && !EX_DEFAULT_CATS.includes(c) && !all.some(x => x.k === c)) all.push({ k: c, label: c });
    });
    if (counts["__none"]) all.push({ k: "__none", label: "未分类" });
    document.getElementById("exFilters").innerHTML = all.map(f => `
      <button type="button" class="excerpt-filter${exFilter === f.k ? " active" : ""}" data-f="${f.k}">
        ${f.label}<span class="excerpt-filter-n">${f.k === "" ? arr.length : (counts[f.k] || 0)}</span>
      </button>`).join("");
    document.querySelectorAll("#exFilters .excerpt-filter").forEach(btn => {
      btn.addEventListener("click", () => { exFilter = btn.dataset.f; exRenderList(); });
    });
  }

  function exRenderList() {
    const arr = exLoadAll();
    exRenderFilters();
    if (exCount) exCount.textContent = arr.length ? "共 " + arr.length + " 条" : "";
    if (!exList) return;
    if (!arr.length) {
      exList.innerHTML = `<div style="font-size:13px;color:var(--ink-faint);padding:8px 2px;">还没有摘抄，拍一张图试试 👆</div>`;
      return;
    }
    const filtered = exFilter ? arr.filter(it => exCatOf(it) === exFilter) : arr;
    if (!filtered.length) {
      exList.innerHTML = `<div style="font-size:13px;color:var(--ink-faint);padding:8px 2px;">这一分类下还没有摘抄。</div>`;
      return;
    }
    exList.innerHTML = filtered.map((it, idx) => {
      const cat = exCatOf(it);
      const catLabel = cat === "__none" ? "未分类" : cat;
      const catCls = ({ "写人": "ren", "写事": "shi", "写景": "jing", "观点": "guan", "情感": "qing", "其他": "qi", "__none": "none" })[cat] || "custom";
      return `
      <div class="excerpt-item" data-idx="${idx}">
        <div class="excerpt-item-head">
          <button type="button" class="excerpt-cat-badge cat-${catCls.replace(/[^\w\u4e00-\u9fa5]/g, "")}" data-cat="${cat.replace(/"/g, "&quot;")}">${catLabel}</button>
          <span class="excerpt-item-date">${it.date}</span>
          ${it.source ? `<span class="excerpt-item-src">📖 ${it.source.replace(/</g, "&lt;")}</span>` : ""}
          <button class="excerpt-del" data-idx="${idx}" type="button">✕</button>
        </div>
        <div class="excerpt-item-text">${it.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>
        ${it.tags ? `<div class="excerpt-item-tags">${it.tags.split(/[,，]/).map(t => `<span>#${t.trim().replace(/</g, "&lt;")}</span>`).filter(t => t !== "#").join("")}</div>` : ""}
      </div>`;
    }).join("");
    // 删除
    exList.querySelectorAll(".excerpt-del").forEach(b => {
      b.addEventListener("click", () => {
        const a = exLoadAll();
        const f = exFilter ? a.filter(it => exCatOf(it) === exFilter) : a;
        const real = exFilter ? a.findIndex(it => it === f[+b.getAttribute("data-idx")]) : +b.getAttribute("data-idx");
        if (real >= 0) { a.splice(real, 1); localStorage.setItem(EX_KEY, JSON.stringify(a)); }
        exRenderList();
      });
    });
    // 点击分类徽章 → 按该分类筛选；未分类徽章点击 → 弹出归类（用 prompt 选/填类别）
    exList.querySelectorAll(".excerpt-cat-badge").forEach(bd => {
      bd.addEventListener("click", () => {
        const cat = bd.dataset.cat;
        if (cat === "__none") {
          const a = exLoadAll();
          const f = exFilter ? a.filter(it => exCatOf(it) === exFilter) : a;
          const real = exFilter ? a.findIndex(it => it === f[+bd.closest(".excerpt-item").dataset.idx]) : +bd.closest(".excerpt-item").dataset.idx;
          if (real < 0) return;
          const opts = EX_DEFAULT_CATS.join("、");
          const v = prompt("给这条摘抄选择类别（" + opts + "，或直接输入自定义）：", "");
          if (v === null) return;
          const t = v.trim();
          a[real].cat = t ? t : "其他";
          localStorage.setItem(EX_KEY, JSON.stringify(a));
          exRenderList();
        } else {
          exFilter = cat;
          exRenderList();
        }
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
        // 首次使用才按需下载识别引擎（约 2MB），之后使用秒开
        exMsg.textContent = "首次使用需加载识别引擎，请稍候…";
        try {
          await loadTesseract();
        } catch (err) {
          exMsg.textContent = "识别引擎加载失败，请检查网络后重试。";
          return;
        }
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
      const cat = (exCatCustom && exCatCustom.value.trim()) ? exCatCustom.value.trim() : (exCat || "其他");
      arr.unshift({ text, source: exSource.value.trim(), tags: exTags.value.trim(), cat, date: fmtDate(new Date()) });
      localStorage.setItem(EX_KEY, JSON.stringify(arr));
      exMsg.textContent = "已保存 ✓";
      exText.value = ""; exSource.value = ""; exTags.value = "";
      if (exCatCustom) exCatCustom.value = "";
      exCat = "";
      exClearDraft();
      exReset();
      exRenderCatChips();
      exRenderList();
      setTimeout(() => { if (exMsg) exMsg.textContent = ""; }, 2000);
    });
  }
  exRenderCatChips();
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

    // 收集"已出现"复习条目：今天及之前的天（按口语区同样的 dayOfYear 索引）
    // 满足"必须在今日必记词汇/核心句出现过才进入复习"
    function dayOfYearYmd(d) {
      const start = new Date(d.getFullYear(), 0, 0);
      return Math.floor((d - start) / 86400000);
    }
    const todayIdx = dayOfYearYmd(today) % days.length;
    function buildWeekItems() {
      const items = [];
      for (let di = 0; di <= todayIdx; di++) {
        const day = days[di];
        if (!day) continue;
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
      }
      return items;
    }
    const WEEK = buildWeekItems();
    const idOf = it => it.id;

    // ---- 本地进度存储：wb_ebbinghaus = { [id]: { learn, stage(1..5), due } } ----
    // 修复存储：localStorage 失败时降级 sessionStorage + 弹 toast 提示
    const STORE_KEY = "wb_ebbinghaus";
    const FB_KEY = STORE_KEY + "_session";
    let store = {};
    function loadStore() {
      try { store = JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
      catch (e) {
        try { store = JSON.parse(sessionStorage.getItem(FB_KEY) || "{}"); } catch (_) { store = {}; }
      }
    }
    loadStore();
    // 极简 toast：在右下角弹一条提示（避免 alert 打扰）
    function ebToast(msg, ms) {
      let el = document.getElementById("ebToast");
      if (!el) {
        el = document.createElement("div");
        el.id = "ebToast";
        el.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:9999;background:var(--card);color:var(--pink-dark);border:1px solid var(--mint);border-radius:10px;padding:8px 14px;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,.08);opacity:0;transition:opacity .2s;pointer-events:none;max-width:240px;line-height:1.45;";
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.opacity = "1";
      clearTimeout(el._t);
      el._t = setTimeout(() => { el.style.opacity = "0"; }, ms || 1800);
    }
    function save() {
      const json = JSON.stringify(store);
      try { localStorage.setItem(STORE_KEY, json); return true; }
      catch (e1) {
        // 降级：写到 sessionStorage（同会话至少能保留）+ 弹提示
        try { sessionStorage.setItem(FB_KEY, json); } catch (e2) {}
        ebToast("⚠️ 本地存储不可用，复习进度仅本次会话内保留。请检查浏览器隐私/无痕模式或存储空间。", 4500);
        return false;
      }
    }

    // 按需激活："已出现"的项若 store 中没有，补为「第1阶段，今天到期」
    // - store 中 b21 残留的 28 条全周条目会自动失效（di > todayIdx 不再被 buildWeekItems 收集）
    // - 用户每天首次进入会激活当天内容，新词句自动进入复习
    let activatedNow = 0;
    WEEK.forEach(it => {
      if (!store[it.id]) {
        store[it.id] = { learn: todayStr, stage: 1, due: todayStr };
        activatedNow++;
      }
    });
    if (activatedNow > 0) save();

    const ebSub = document.getElementById("ebSub");
    if (ebSub) ebSub.textContent = "已激活 " + (todayIdx + 1) + " 天内容（共 " + WEEK.length + " 条）· 第1/2/4/7/15天循环复习";

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
      const ok = save();
      // 实时存储已修复：无论成功失败都立即反馈给用户
      if (ok) ebToast("✅ 已记录：第" + (rec.stage) + "阶段（" + gap + "天后到期）", 1600);
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
    // 概览：7 天主题 chips（已激活 = 实色/未激活 = 灰）+ 复习阶段进度条
    function renderWeek() {
      const ebWeek = document.getElementById("ebWeek");
      if (!ebWeek) return;
      ebWeek.innerHTML = `
        <div class="eb-week-chips">${days.map((day, i) => {
          const rec = store["eb_s" + i];
          const done = rec && rec.stage >= 5;
          const locked = i > todayIdx;
          return `<span class="eb-chip ${done ? "done" : ""} ${locked ? "locked" : ""}" ${locked ? 'title="该天内容尚未出现"' : ""}>${i + 1}·${day.theme || ""}</span>`;
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
      function deepCardHTML(x, idx, alwaysOpen) {
        const bodyHtml = (x.body || []).map(b => {
          const h = b.h ? `<h4 class="deep-para-h">${b.h}</h4>` : "";
          return `${h}<p class="deep-para">${b.p || ""}</p>`;
        }).join("");
        const openCls = alwaysOpen ? " open" : "";
        return `<div class="deep-card${openCls}">
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
            <div class="deep-arc-body">${deepCardHTML(x, i, true)}</div>
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

    /* 碎片阅读板块折叠：点击板块标题（含折叠按钮）切换对应内容显隐 */
    document.querySelectorAll(".frag-fold").forEach(title => {
      title.addEventListener("click", (ev) => {
        if (ev.target.closest(".frag-fold-body")) return;
        const target = document.getElementById(title.dataset.target);
        if (!target) return;
        const hidden = target.classList.toggle("frag-fold-hidden");
        title.classList.toggle("collapsed", hidden);
        const arr = title.querySelector(".sec-arr");
        if (arr) arr.textContent = hidden ? "▸" : "▾";
      });
    });
  })();

  /* ---------- Snapshot label ---------- */
  if (D && D.snapshotLabel) { const sl = $("#snapLabel"); if (sl) sl.textContent = D.snapshotLabel.split("·")[1].trim(); }

  /* ---------- Card 收起 / 展开 ---------- */
  $$(".card").forEach(card => {
    const head = card.querySelector(".card-head");
    if (!head) return;
    if (card.querySelector(".card-toggle")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-toggle";
    btn.setAttribute("aria-label", "收起 / 展开该模块");
    btn.innerHTML = "▾";
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.toggle("collapsed");
      btn.setAttribute("aria-expanded", card.classList.contains("collapsed") ? "false" : "true");
    });
    head.appendChild(btn);
    btn.setAttribute("aria-expanded", "true");
  });
})();

/* ==========================================================================
   股票模块（自选股 · 行情 · 技术指标 · 持仓 · 复盘 · 舆情预警）
   数据源：东方财富 push2 / 新浪 hq.sinajs（A 股免费 JSON API，CORS 友好）
   存储：localStorage（自选股 / 持仓 / 复盘 / 预警阈值）
   ========================================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const LS_KEYS = {
    quotes: "wb_stock_quotes_v1",       // 自选股 [{code, name, market}]
    trades: "wb_stock_trades_v1",       // 持仓/成交记录 [{id, code, name, type, price, qty, date, note}]
    reviews: "wb_stock_reviews_v1",     // 复盘 [{id, date, market, pos, mind, plan}]
    alert: "wb_stock_alert_v1",         // 预警阈值 {drop, rise, rsiHi, rsiLo}
  };

  function lsGet(k, fb) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- 状态 ---------- */
  let quotes = lsGet(LS_KEYS.quotes, null);
  if (quotes === null) {
    // 首次使用给一个新手友好的默认自选股（5 只跨市场）
    quotes = [
      { code: "600519", name: "贵州茅台", market: "sh" },
      { code: "000858", name: "五粮液",   market: "sz" },
      { code: "300750", name: "宁德时代", market: "sz" },
      { code: "00700",  name: "腾讯控股", market: "hk" },
      { code: "TSLA",   name: "特斯拉",   market: "us" },
    ];
    lsSet(LS_KEYS.quotes, quotes);
  }
  let trades = lsGet(LS_KEYS.trades, []);    // [{...}]
  let reviews = lsGet(LS_KEYS.reviews, []);
  let alertCfg = lsGet(LS_KEYS.alert, { drop: 3, rise: 5, rsiHi: 70, rsiLo: 30 });

  /* ---------- 市场识别 ---------- */
  function detectMarket(codeOrName) {
    const s = String(codeOrName || "").trim().toUpperCase();
    if (/^\d{6}$/.test(s)) return "sh";      // A 股默认沪（深圳/上海再靠后接口判定）
    if (/^\d{5}$/.test(s)) return "hk";
    if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(s)) return "us";
    return null;
  }
  function secidForA(code) {
    // 6 开头或 9 开头 → 深；其余 → 沪
    return /^(0|3)/.test(code) ? `0.${code}` : `1.${code}`;
  }

  /* ---------- 拉实时行情（东财 push2）---------- */
  async function fetchQuotesBatch(items) {
    if (!items.length) return {};
    const secids = items.map(q => {
      if (q.market === "hk") return `116.${q.code}`;
      if (q.market === "us") return `105.${q.code}`; // 东财美股 secid 前缀
      return secidForA(q.code);
    }).join(",");
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${items.length}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(secids)}&fields=f12,f14,f2,f3,f4,f5`;
    try {
      const res = await fetch(url, { mode: "cors" });
      const json = await res.json();
      const map = {};
      (json.data && json.data.diff ? json.data.diff : []).forEach(d => {
        const code = d.f12;
        const cur = +(d.f2 || 0);
        const pct = +(d.f3 || 0);
        const chg = +(d.f4 || 0);
        map[code] = { cur, pct, chg, name: d.f14, high: +d.f5 };
      });
      return map;
    } catch (e) {
      console.warn("[stock] 行情拉取失败：", e);
      return {};
    }
  }

  /* ---------- 计算 MACD / RSI / MA（基于简化的 K 线估算）---------- */
  // 真实 MACD/RSI 需要历史 K 线；这里用「本地日线序列」近似。如未拉取历史 K 线，给出 -1 标记「数据不足」。
  // 方案 B：调用腾讯 / 新浪历史 K 线接口
  async function fetchKLineA(code, days = 60) {
    // 新浪日线：https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=sh600519&scale=240&ma=no&datalen=60
    const sym = (/^6/.test(code) ? "sh" : "sz") + code;
    const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${sym}&scale=240&ma=no&datalen=${days}`;
    try {
      const res = await fetch(url, { mode: "cors" });
      const json = await res.json();
      if (!Array.isArray(json)) return [];
      return json.map(k => +k.close);
    } catch (e) { return []; }
  }
  function calcMA(closes, n) {
    if (closes.length < n) return null;
    const slice = closes.slice(-n);
    return slice.reduce((a, b) => a + b, 0) / n;
  }
  function calcEMA(closes, n) {
    if (closes.length < n) return null;
    const k = 2 / (n + 1);
    let ema = closes.slice(0, n).reduce((a, b) => a + b, 0) / n;
    for (let i = n; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
    return ema;
  }
  function calcMACD(closes) {
    if (closes.length < 26) return null;
    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    const dif = ema12 - ema26;
    // DEA = 9-day EMA of DIF (近似: 用最近 9 个 DIF 的均值)
    const difs = [];
    for (let i = 26; i <= closes.length; i++) {
      const e12 = calcEMA(closes.slice(0, i), 12);
      const e26 = calcEMA(closes.slice(0, i), 26);
      difs.push(e12 - e26);
    }
    const dea = difs.slice(-9).reduce((a, b) => a + b, 0) / 9;
    const macd = (dif - dea) * 2;
    return { dif, dea, macd };
  }
  function calcRSI(closes, n = 14) {
    if (closes.length < n + 1) return null;
    let gain = 0, loss = 0;
    for (let i = closes.length - n; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gain += diff; else loss -= diff;
    }
    const ag = gain / n, al = loss / n;
    if (al === 0) return 100;
    return 100 - 100 / (1 + ag / al);
  }

  /* ---------- 渲染：自选股列表 ---------- */
  async function renderQuotes() {
    const list = $("#stQuoteList");
    const empty = $("#stQuoteEmpty");
    const sub = $("#stQuoteSub");
    if (!quotes.length) {
      list.innerHTML = "";
      empty.style.display = "block";
      sub.textContent = "还没有自选股";
      return;
    }
    empty.style.display = "none";
    sub.textContent = `共 ${quotes.length} 只 · 行情约 30s 刷新一次`;
    const data = await fetchQuotesBatch(quotes);
    list.innerHTML = quotes.map(q => {
      const d = data[q.code];
      const cur = d ? d.cur : 0;
      const pct = d ? d.pct : 0;
      const chg = d ? d.chg : 0;
      const cls = pct > 0 ? "st-up" : pct < 0 ? "st-down" : "st-flat";
      const sign = pct > 0 ? "+" : "";
      return `<div class="st-quote-row" data-code="${q.code}">
        <div><div class="st-quote-name">${q.name || q.code}<span class="st-quote-code">${q.code}</span></div></div>
        <div class="st-quote-price ${cls}">${cur ? cur.toFixed(2) : "--"}</div>
        <div class="st-quote-chg ${cls}">${chg ? sign + chg.toFixed(2) : "--"}</div>
        <div class="st-quote-pct ${cls}">${pct ? sign + pct.toFixed(2) + "%" : "--"}</div>
        <div class="st-quote-act"><button data-del="${q.code}">删除</button></div>
      </div>`;
    }).join("");

    // 删除
    $$(".st-quote-act button", list).forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const code = btn.getAttribute("data-del");
        quotes = quotes.filter(q => q.code !== code);
        lsSet(LS_KEYS.quotes, quotes);
        renderQuotes();
        renderIndiSel();
      });
    });

    // 检查预警
    renderAlerts(data);
  }

  /* ---------- 渲染：指标选择器 ---------- */
  function renderIndiSel() {
    const sel = $("#stIndiSel");
    sel.innerHTML = quotes.map(q => `<option value="${q.code}">${q.name || q.code} (${q.code})</option>`).join("");
  }

  /* ---------- 渲染：技术指标 ---------- */
  async function renderIndi() {
    const sel = $("#stIndiSel");
    const code = sel.value;
    const body = $("#stIndiBody");
    if (!code) { body.innerHTML = `<div class="st-indi-empty">请先在「实时行情」里加一只股票</div>`; return; }
    body.innerHTML = `<div class="st-indi-empty">⏳ 拉取 K 线计算中...</div>`;
    const closes = await fetchKLineA(code, 90);
    if (!closes.length) { body.innerHTML = `<div class="st-indi-empty">⚠️ K 线数据拉取失败，可能是非 A 股或网络问题</div>`; return; }
    const ma5 = calcMA(closes, 5);
    const ma20 = calcMA(closes, 20);
    const ma60 = calcMA(closes, 60);
    const macd = calcMACD(closes);
    const rsi = calcRSI(closes, 14);
    const last = closes[closes.length - 1];

    const sig = (label, val, judge) => {
      const c = judge.startsWith("超买") ? "st-up" : judge.startsWith("超卖") ? "st-down" : "st-flat";
      return `<div class="st-indi-box"><div class="lbl">${label}</div><div class="val ${c}">${val}</div><div class="sig">${judge}</div></div>`;
    };

    // 简易信号
    const maSig = !ma5 || !ma20 ? "数据不足" :
      (last > ma5 && ma5 > ma20 ? "🟢 多头排列" : (last < ma5 && ma5 < ma20 ? "🔴 空头排列" : "🟡 震荡"));
    const macdSig = !macd ? "数据不足" :
      (macd.dif > macd.dea && macd.macd > 0 ? "🟢 金叉" : (macd.dif < macd.dea && macd.macd < 0 ? "🔴 死叉" : "🟡 盘整"));
    const rsiSig = rsi == null ? "数据不足" :
      (rsi > alertCfg.rsiHi ? "🔴 超买" : (rsi < alertCfg.rsiLo ? "🟢 超卖" : "🟡 中性"));

    body.innerHTML = `
      <div class="st-indi-grid">
        ${sig("现价", last.toFixed(2), "—")}
        ${sig("MA5", ma5 ? ma5.toFixed(2) : "--", maSig)}
        ${sig("MA20", ma20 ? ma20.toFixed(2) : "--", maSig)}
        ${sig("MA60", ma60 ? ma60.toFixed(2) : "--", ma60 ? (last > ma60 ? "🟢 在上方" : "🔴 在下方") : "数据不足")}
        ${sig("MACD", macd ? `DIF ${macd.dif.toFixed(3)}` : "--", macdSig)}
        ${sig("RSI(14)", rsi != null ? rsi.toFixed(1) : "--", rsiSig)}
      </div>
      <svg class="st-indi-svg" viewBox="0 0 600 120" preserveAspectRatio="none" id="stKLineSvg"></svg>
      <div style="font-size:11px;color:var(--pink-dark);margin-top:6px;">最近 ${closes.length} 个交易日收盘价走势（简化图）</div>
    `;
    drawKLine(closes);
  }
  function drawKLine(closes) {
    const svg = $("#stKLineSvg");
    if (!svg) return;
    const w = 600, h = 120, pad = 6;
    const min = Math.min(...closes), max = Math.max(...closes);
    const span = max - min || 1;
    const pts = closes.map((c, i) => {
      const x = pad + (i / (closes.length - 1)) * (w - pad * 2);
      const y = h - pad - ((c - min) / span) * (h - pad * 2);
      return `${x},${y}`;
    }).join(" ");
    svg.innerHTML = `
      <defs><linearGradient id="stKG" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="var(--st-up)" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="var(--st-up)" stop-opacity="0"/>
      </linearGradient></defs>
      <polyline points="${pts}" fill="none" stroke="var(--st-up)" stroke-width="1.6"/>
      <polygon points="${pts} ${w - pad},${h - pad} ${pad},${h - pad}" fill="url(#stKG)"/>
    `;
  }

  /* ---------- 持仓管理 ---------- */
  function renderTrades() {
    const list = $("#stPosList");
    // 汇总：按 code 聚合
    const sum = {};
    trades.forEach(t => {
      if (!sum[t.code]) sum[t.code] = { name: t.name, code: t.code, qty: 0, cost: 0, realized: 0 };
      const sign = t.type === "buy" ? 1 : -1;
      sum[t.code].qty += sign * t.qty;
      if (t.type === "buy") sum[t.code].cost += t.qty * t.price;
      else sum[t.code].realized += t.qty * t.price;
    });

    const summary = $("#stPosSummary");
    const held = Object.values(sum).filter(s => s.qty > 0);
    const totalCost = held.reduce((a, s) => a + s.cost, 0);
    summary.innerHTML = `
      <div class="st-pos-stat"><div class="lbl">持仓只数</div><div class="val">${held.length}</div></div>
      <div class="st-pos-stat"><div class="lbl">总成本</div><div class="val">¥${totalCost.toFixed(0)}</div></div>
      <div class="st-pos-stat"><div class="lbl">已实现盈亏</div><div class="val">¥${Object.values(sum).reduce((a, s) => a + s.realized - s.cost * 0, 0).toFixed(0)}</div></div>
      <div class="st-pos-stat"><div class="lbl">总交易笔数</div><div class="val">${trades.length}</div></div>
    `;

    // 列表
    if (!trades.length) { list.innerHTML = `<div style="text-align:center;color:var(--pink-dark);padding:20px;">还没有交易记录</div>`; return; }
    list.innerHTML = trades.slice().reverse().map(t => `
      <div class="st-pos-row">
        <div><div class="nm">${t.name || t.code}</div><div class="cd">${t.code} · ${t.date}</div></div>
        <div class="qty">${t.type === "buy" ? "买入" : "卖出"} ${t.qty}@${t.price.toFixed(2)}</div>
        <div class="pl ${t.type === 'buy' ? '' : 'st-down'}">${t.note || "—"}</div>
        <div class="qty">${t.id.slice(-4)}</div>
        <div class="act"><button data-deltrade="${t.id}">删除</button></div>
      </div>
    `).join("");

    $$(".st-pos-row .act button", list).forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-deltrade");
        trades = trades.filter(t => t.id !== id);
        lsSet(LS_KEYS.trades, trades);
        renderTrades();
      });
    });
  }

  /* ---------- 复盘 ---------- */
  function renderReviews() {
    const list = $("#stReviewList");
    if (!reviews.length) { list.innerHTML = `<div style="text-align:center;color:var(--pink-dark);padding:20px;">还没有复盘，点上方表单写下今天的思考吧</div>`; return; }
    list.innerHTML = reviews.slice().reverse().slice(0, 30).map(r => `
      <div class="st-review-item">
        <div class="dt">📅 ${r.date}</div>
        ${r.market ? `<div class="sec"><b>📈 大盘：</b>${escape(r.market)}</div>` : ""}
        ${r.pos ? `<div class="sec"><b>💼 持仓：</b>${escape(r.pos)}</div>` : ""}
        ${r.mind ? `<div class="sec"><b>🧠 心态：</b>${escape(r.mind)}</div>` : ""}
        ${r.plan ? `<div class="sec"><b>🎯 计划：</b>${escape(r.plan)}</div>` : ""}
        <div style="text-align:right;margin-top:6px;"><button data-delrev="${r.id}" style="background:transparent;border:1px solid var(--pink-faint);color:var(--pink-dark);border-radius:6px;padding:2px 8px;font-size:10px;cursor:pointer;">删除</button></div>
      </div>
    `).join("");
    $$("[data-delrev]", list).forEach(btn => {
      btn.addEventListener("click", () => {
        reviews = reviews.filter(r => r.id !== btn.getAttribute("data-delrev"));
        lsSet(LS_KEYS.reviews, reviews);
        renderReviews();
      });
    });
  }
  function escape(s) { return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  /* ---------- 舆情 + 预警 ---------- */
  function renderAlerts(data) {
    const list = $("#stAlertList");
    const items = [];
    quotes.forEach(q => {
      const d = data[q.code];
      if (!d) return;
      if (d.pct <= -alertCfg.drop) items.push({ type: "down", name: q.name || q.code, code: q.code, pct: d.pct, msg: `跌幅 ${d.pct.toFixed(2)}% 突破 ${alertCfg.drop}%` });
      if (d.pct >= alertCfg.rise) items.push({ type: "up", name: q.name || q.code, code: q.code, pct: d.pct, msg: `涨幅 ${d.pct.toFixed(2)}% 突破 ${alertCfg.rise}%` });
    });
    if (!items.length) { list.innerHTML = ""; return; }
    list.innerHTML = items.map(a => `<div class="st-alert-item">
      <span>${a.type === "up" ? "🚀" : "⚠️"} <b>${a.name}</b> (${a.code}) — ${a.msg}</span>
      <span class="${a.type === 'up' ? 'st-up' : 'st-down'}">${a.pct > 0 ? "+" : ""}${a.pct.toFixed(2)}%</span>
    </div>`).join("");
  }

  // 新闻：浏览器 CORS 多被东财拦截。降级为「推荐入口」，并展示一个示例片段
  async function renderNews() {
    const list = $("#stNewsList");
    if (!quotes.length) { list.innerHTML = `<div style="text-align:center;color:var(--pink-dark);padding:20px;">加入自选股后这里会聚合相关新闻</div>`; return; }
    const q = quotes[0];
    list.innerHTML = `
      <div class="st-news-row">
        <div class="tt">📡 实时新闻流（受浏览器 CORS 限制）</div>
        <div class="sn">推荐入口：<a href="https://data.eastmoney.com/notices/stock/${q.code}.html" target="_blank" rel="noopener">东方财富 · ${q.name || q.code} 公告全文</a> · <a href="https://xueqiu.com/S/${q.code}" target="_blank" rel="noopener">雪球 · ${q.code} 讨论</a></div>
      </div>
      <div class="st-news-row">
        <div class="tt">💡 如何用好舆情分析？</div>
        <div class="sn">1) 每天开盘前看一遍自选股的公告与新闻；2) 重点关注「业绩预增/重大合同/股东减持」三类；3) 配合持仓复盘写进上面的「每日复盘」板块。</div>
      </div>
    `;
  }

  /* ---------- 搜索（本地字典 + 简单 A 股 600/000/002/300 提示）---------- */
  const NAME_HINT = {
    "600519": "贵州茅台", "000858": "五粮液", "601318": "中国平安", "000001": "平安银行",
    "600036": "招商银行", "000333": "美的集团", "600276": "恒瑞医药", "300750": "宁德时代",
    "002594": "比亚迪", "600900": "长江电力", "601398": "工商银行", "601988": "中国银行",
    "601012": "隆基绿能", "600887": "伊利股份", "600028": "中国石化", "601857": "中国石油",
    "00700": "腾讯控股", "09988": "阿里巴巴-W", "03690": "美团-W", "01024": "快手-W",
    "TSLA": "特斯拉", "AAPL": "苹果", "MSFT": "微软", "NVDA": "英伟达", "GOOGL": "谷歌",
  };
  function renderSearchResult(q) {
    const box = $("#stSearchResult");
    if (!q) { box.innerHTML = ""; return; }
    const u = q.toUpperCase();
    // 直接作为代码尝试
    const direct = [];
    if (/^\d{6}$/.test(u)) direct.push({ code: u, name: NAME_HINT[u] || "A 股" });
    if (/^\d{5}$/.test(u)) direct.push({ code: u, name: NAME_HINT[u] || "港股" });
    if (/^[A-Z]{1,5}$/.test(u)) direct.push({ code: u, name: NAME_HINT[u] || "美股" });
    // 名称模糊匹配
    const nameHits = Object.entries(NAME_HINT).filter(([c, n]) => n.toUpperCase().includes(u) || n.includes(q)).slice(0, 6)
      .map(([c, n]) => ({ code: c, name: n }));
    const all = [...direct, ...nameHits];
    if (!all.length) { box.innerHTML = `<span style="font-size:11px;color:var(--pink-dark);">无匹配，可以直接输入代码加入</span>`; return; }
    box.innerHTML = all.map(a => `<span class="st-search-chip" data-add="${a.code}" data-name="${a.name}">${a.name} <b>${a.code}</b> +</span>`).join("");
    $$(".st-search-chip", box).forEach(chip => {
      chip.addEventListener("click", () => addQuote(chip.getAttribute("data-add"), chip.getAttribute("data-name")));
    });
  }
  function addQuote(code, name) {
    if (quotes.find(q => q.code === code)) return;
    const m = detectMarket(code);
    if (!m) return;
    quotes.push({ code, name: name || NAME_HINT[code] || code, market: m });
    lsSet(LS_KEYS.quotes, quotes);
    $("#stSearchResult").innerHTML = "";
    $("#stSearchInput").value = "";
    renderQuotes();
    renderIndiSel();
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    $("#stSearchBtn").addEventListener("click", () => renderSearchResult($("#stSearchInput").value.trim()));
    $("#stSearchInput").addEventListener("input", e => renderSearchResult(e.target.value.trim()));
    $("#stSearchInput").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); const v = $("#stSearchInput").value.trim(); if (/^[\dA-Z]{1,6}$/.test(v.toUpperCase())) addQuote(v.toUpperCase(), NAME_HINT[v.toUpperCase()] || v); } });
    $("#stAddByCode").addEventListener("click", () => {
      const v = $("#stSearchInput").value.trim().toUpperCase();
      if (!v) return;
      addQuote(v, NAME_HINT[v] || v);
    });

    $("#stIndiSel").addEventListener("change", renderIndi);
    $("#stIndiRefresh").addEventListener("click", renderIndi);

    // 持仓
    $("#stPosAdd").addEventListener("click", () => {
      const t = {
        id: "t" + Date.now() + Math.random().toString(36).slice(-4),
        code: $("#stPosCode").value.trim(),
        name: $("#stPosName").value.trim(),
        price: +$("#stPosPrice").value,
        qty: +$("#stPosQty").value,
        type: $("#stPosType").value,
        date: $("#stPosDate").value || new Date().toISOString().slice(0, 10),
        note: $("#stPosNote").value.trim(),
      };
      if (!t.code || !t.price || !t.qty) { alert("请填写代码、价格、数量"); return; }
      if (!t.name) t.name = NAME_HINT[t.code] || t.code;
      trades.push(t);
      lsSet(LS_KEYS.trades, trades);
      ["#stPosCode","#stPosName","#stPosPrice","#stPosQty","#stPosNote"].forEach(s => $(s).value = "");
      renderTrades();
    });
    $("#stPosDate").value = new Date().toISOString().slice(0, 10);

    // 复盘
    $("#stReviewDate").value = new Date().toISOString().slice(0, 10);
    $("#stReviewSave").addEventListener("click", () => {
      const r = {
        id: "r" + Date.now(),
        date: $("#stReviewDate").value,
        market: $("#stReviewMarket").value.trim(),
        pos: $("#stReviewPos").value.trim(),
        mind: $("#stReviewMind").value.trim(),
        plan: $("#stReviewPlan").value.trim(),
      };
      reviews.push(r);
      lsSet(LS_KEYS.reviews, reviews);
      ["#stReviewMarket","#stReviewPos","#stReviewMind","#stReviewPlan"].forEach(s => $(s).value = "");
      renderReviews();
    });

    // 预警阈值
    $("#stAlertDrop").value = alertCfg.drop;
    $("#stAlertRise").value = alertCfg.rise;
    $("#stAlertRsi").value = alertCfg.rsiHi;
    $("#stAlertRsiLow").value = alertCfg.rsiLo;
    $("#stAlertSave").addEventListener("click", () => {
      alertCfg = {
        drop: +$("#stAlertDrop").value || 3,
        rise: +$("#stAlertRise").value || 5,
        rsiHi: +$("#stAlertRsi").value || 70,
        rsiLo: +$("#stAlertRsiLow").value || 30,
      };
      lsSet(LS_KEYS.alert, alertCfg);
      alert("✅ 阈值已保存");
    });

    // 监听侧边栏切到 stock 时刷新
    const link = document.querySelector('.menu a[data-page="stock"]');
    if (link) link.addEventListener("click", () => {
      setTimeout(() => { renderQuotes(); renderIndiSel(); renderTrades(); renderReviews(); renderNews(); }, 50);
    });
  }

  bind();
  renderIndiSel();
  // 初次进入不渲染行情，等切到页面再拉
})();
