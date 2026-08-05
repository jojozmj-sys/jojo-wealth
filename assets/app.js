/* JOJO的发财之路 - 单页应用逻辑 */
(function () {
  const D = window.WORKBENCH_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Utilities ---------- */
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  /* 手绘卡通 SVG 图标：返回内联 <svg><use> 片段（引用 index.html 顶部的 symbol 库）
     用法：hbIcon("mic") 或 hbIcon("mic", "on") 切换红色录音态 */
  const HB = {
    "mic": "hb-mic", "mic-on": "hb-mic-on", "img": "hb-img",
    "speak": "hb-speak", "mute": "hb-mute",
    "eye": "hb-eye", "eye-off": "hb-eye-off", "bubble": "hb-voice-bubble",
    "play": "hb-play", "pause": "hb-pause"
  };
  function hbIcon(name, state) {
    let id = HB[name] || "hb-" + name;
    if (state === "on") { const alt = HB[name + "-on"]; if (alt) id = alt; }
    return `<svg class="hb-ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#${id}"/></svg>`;
  }
  /* 切换按钮内手绘图标（用于录音/朗读等运行时状态） */
  function hbSet(btn, name, state) {
    if (!btn) return;
    const svg = btn.querySelector("svg.hb-ic");
    if (svg) {
      let target = HB[name] || "hb-" + name;
      if (state === "on") { const alt = HB[name + "-on"]; if (alt) target = alt; }
      const use = svg.querySelector("use");
      if (use) use.setAttribute("href", "#" + target);
    }
  }
  /* 图标 + 文字的按钮内容（用于「🔊 收听」这类带文字的按钮）
     结构：<svg.hb-ic> + <span.hb-label> */
  function hbLabel(icon, label) {
    return hbIcon(icon) + `<span class="hb-label">${label}</span>`;
  }
  /* 更新「图标+文字」按钮：换图标 + 换文字 */
  function hbSetLabel(btn, icon, label) {
    if (!btn) return;
    hbSet(btn, icon);
    let sp = btn.querySelector("span.hb-label");
    if (!sp) { sp = document.createElement("span"); sp.className = "hb-label"; btn.appendChild(sp); }
    sp.textContent = label;
  }
  /* 暴露到全局：app.js 拆分为多个独立 IIFE，后续渲染函数需跨作用域调用 */
  window.hbIcon = hbIcon;
  window.hbLabel = hbLabel;
  window.hbSet = hbSet;
  window.hbSetLabel = hbSetLabel;

  /* 全局轻量 toast：在右下角弹一条提示，避免 alert 打断流程
     用法：appToast("内容", 1600) —— 默认 1.6s 自动消失 */
  function appToast(msg, ms, kind) {
    let el = document.getElementById("appToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "appToast";
      el.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:9999;background:var(--card);color:var(--ink);border:1px solid var(--mint);border-radius:10px;padding:8px 14px;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,.08);opacity:0;transition:opacity .2s;pointer-events:none;max-width:280px;line-height:1.45;";
      document.body.appendChild(el);
    }
    // kind: "ok" 绿色 / "warn" 橙色 / "err" 红色；缺省走原色
    const k = kind || "info";
    if (k === "ok") el.style.borderColor = "var(--mint)";
    else if (k === "warn") el.style.borderColor = "#E8A23A";
    else if (k === "err") el.style.borderColor = "#E85F7A";
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = "0"; }, ms || 1600);
  }
  window.appToast = appToast;  /* 暴露到全局，其他 IIFE 复用，避免重复定义 */
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
  let isEditMode = false;

  function showPage(page, title) {
    pages.forEach(p => p.classList.remove("active"));
    const target = document.getElementById("page-" + page);
    if (target) target.classList.add("active");
    pageTitle.textContent = title || document.querySelector(`[data-page="${page}"] .mlabel`)?.textContent || "";
    /* 派发页面切换事件，各模块可监听并清理状态（如停止语音） */
    document.dispatchEvent(new CustomEvent("wb:pagechange", { detail: { page } }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  menu.addEventListener("click", e => {
    if (isEditMode) { e.preventDefault(); return; }
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
      if (isEditMode) { active = false; return; }
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

  /* ---------- 侧边栏自定义：拖动排序 + 改名（持久化到 localStorage） ---------- */
  const MENU_ORDER_KEY = "wb_menu_order_v1";
  const MENU_NAME_KEY = "wb_menu_names_v1";
  const getMenuItems = () => $$(".menu a[data-page]");

  function renumberMenu() {
    getMenuItems().forEach((a, i) => {
      const m = a.querySelector(".mnum");
      if (m) m.textContent = String(i + 1).padStart(2, "0");
    });
  }

  function saveMenuPrefs() {
    const order = getMenuItems().map(a => a.dataset.page);
    const names = {};
    getMenuItems().forEach(a => {
      const lbl = a.querySelector(".mlabel");
      if (lbl && a.dataset.defLabel && lbl.textContent !== a.dataset.defLabel) {
        names[a.dataset.page] = lbl.textContent;
      }
    });
    try {
      localStorage.setItem(MENU_ORDER_KEY, JSON.stringify(order));
      localStorage.setItem(MENU_NAME_KEY, JSON.stringify(names));
    } catch (e) { /* localStorage 不可用时静默 */ }
  }

  function loadMenuPrefs() {
    // 1) 应用保存的顺序
    try {
      const saved = JSON.parse(localStorage.getItem(MENU_ORDER_KEY) || "null");
      if (Array.isArray(saved) && saved.length) {
        const byPage = {};
        getMenuItems().forEach(a => { byPage[a.dataset.page] = a; });
        const ordered = saved.filter(p => byPage[p]);
        getMenuItems().forEach(a => { if (!ordered.includes(a.dataset.page)) ordered.push(a.dataset.page); });
        ordered.forEach(p => { if (byPage[p]) menu.appendChild(byPage[p]); });
      }
    } catch (e) {}
    // 2) 应用保存的改名
    try {
      const names = JSON.parse(localStorage.getItem(MENU_NAME_KEY) || "null");
      if (names && typeof names === "object") {
        getMenuItems().forEach(a => {
          const n = names[a.dataset.page];
          const lbl = a.querySelector(".mlabel");
          if (n && lbl) lbl.textContent = n;
        });
      }
    } catch (e) {}
    renumberMenu();
  }

  // 给每个菜单项注入拖拽手柄，并记录默认标签（用于判断是否被改名）
  getMenuItems().forEach(a => {
    const lbl = a.querySelector(".mlabel");
    if (lbl) a.dataset.defLabel = lbl.textContent;
    const h = document.createElement("span");
    h.className = "mhandle";
    h.textContent = "⠿";
    h.title = "拖动排序";
    a.insertBefore(h, a.firstChild);
  });
  loadMenuPrefs();

  // 行内改名
  function startRename(a) {
    const lbl = a.querySelector(".mlabel");
    if (!lbl || a.querySelector(".mlabel-input")) return;
    const prev = lbl.textContent;
    const input = document.createElement("input");
    input.className = "mlabel-input";
    input.value = prev;
    input.maxLength = 12;
    lbl.style.display = "none";
    lbl.parentNode.insertBefore(input, lbl.nextSibling);
    input.focus(); input.select();
    let done = false;
    const commit = () => {
      if (done) return; done = true;
      const v = input.value.trim();
      lbl.textContent = v || prev;
      if (input.parentNode) input.remove();
      lbl.style.display = "";
      saveMenuPrefs();
    };
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { done = true; if (input.parentNode) input.remove(); lbl.style.display = ""; }
    });
    input.addEventListener("blur", commit);
  }

  // 原生拖拽排序（编辑模式开启 draggable）
  function getDragAfterElement(container, y) {
    const els = $$(".menu a[data-page]:not(.dragging)", container);
    let closest = { offset: -Infinity, el: null };
    els.forEach(child => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) closest = { offset, el: child };
    });
    return closest.el;
  }

  getMenuItems().forEach(a => {
    a.addEventListener("dragstart", e => {
      a.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", a.dataset.page); } catch (_) {}
    });
    a.addEventListener("dragend", () => {
      a.classList.remove("dragging");
      getMenuItems().forEach(x => x.classList.remove("drag-over"));
      saveMenuPrefs();
      renumberMenu();
    });
  });
  menu.addEventListener("dragover", e => {
    e.preventDefault();
    const dragging = menu.querySelector(".dragging");
    if (!dragging) return;
    getMenuItems().forEach(x => x.classList.remove("drag-over"));
    const after = getDragAfterElement(menu, e.clientY);
    if (after == null) menu.appendChild(dragging);
    else { after.classList.add("drag-over"); menu.insertBefore(dragging, after); }
  });
  menu.addEventListener("drop", e => { e.preventDefault(); });

  // 双击标签改名（桌面）；编辑模式下也可长按标签改名（触屏）
  menu.addEventListener("dblclick", e => {
    if (!isEditMode) return;
    const lbl = e.target.closest(".mlabel");
    if (lbl) startRename(lbl.closest("a[data-page]"));
  });
  let lpTimer = null;
  menu.addEventListener("pointerdown", e => {
    if (!isEditMode) return;
    const lbl = e.target.closest(".mlabel");
    if (!lbl) return;
    const a = lbl.closest("a[data-page]");
    clearTimeout(lpTimer);
    lpTimer = setTimeout(() => { lpTimer = null; startRename(a); }, 550);
  });
  const cancelLp = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
  menu.addEventListener("pointerup", cancelLp);
  menu.addEventListener("pointermove", cancelLp);
  menu.addEventListener("pointercancel", cancelLp);

  // 编辑模式开关
  const sideEdit = $("#sideEdit");
  sideEdit.addEventListener("click", () => {
    isEditMode = !isEditMode;
    document.body.classList.toggle("sidebar-edit", isEditMode);
    sideEdit.classList.toggle("active", isEditMode);
    if (isEditMode) {
      getMenuItems().forEach(a => a.setAttribute("draggable", "true"));
      if (document.body.classList.contains("sidebar-collapsed")) {
        document.body.classList.remove("sidebar-collapsed");
      }
      appToast("编辑模式：拖动 ⠿ 排序，双击/长按标签改名", 2800, "info");
    } else {
      getMenuItems().forEach(a => a.removeAttribute("draggable"));
      saveMenuPrefs();
      renumberMenu();
    }
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
        hbSet(btn, "mic");
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
        hbSet(btn, "mic", "on");
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
      hbSet(btn, "mic");
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
      hbSet(btn, "mic", "on");
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
  const NEWS_READ_KEY = "wb_news_read_v1";   // 已读新闻标题集合（去空格哈希）
  const NEWS_INTERVAL_MS = 2 * 60 * 60 * 1000; // 每 2 小时

  /* ---------- 已读机制：已看过的新闻从列表去掉，未看的保留，新来的增量加入 ---------- */
  function newsHashKey(title) {
    return String(title || "").replace(/\s+/g, "");
  }
  function loadNewsReadSet() {
    const set = new Set();
    try {
      const raw = localStorage.getItem(NEWS_READ_KEY);
      if (raw) JSON.parse(raw).forEach(k => set.add(k));
    } catch (e) {}
    return set;
  }
  function saveNewsReadSet(set) {
    try { localStorage.setItem(NEWS_READ_KEY, JSON.stringify(Array.from(set))); } catch (e) {}
  }
  const newsReadSet = loadNewsReadSet();
  function markNewsRead(title) {
    if (!title) return;
    newsReadSet.add(newsHashKey(title));
    saveNewsReadSet(newsReadSet);
  }
  /* 过滤掉已读条目：返回新数组，不污染原数据 */
  function filterUnread(items) {
    return (items || []).filter(it => {
      const t = (it && (it.title || it)) || "";
      return !newsReadSet.has(newsHashKey(t));
    });
  }

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
      // 整理进版面：在现有版面基础上【增量合并 + 按标题去重】，新新闻 unshift 进对应版面，旧条目保留
      const base = (D.news && D.news.today && D.news.today.sections) || [];
      const sections = base.map(s => ({ name: s.name, items: filterUnread(s.items).slice() }));
      const addToSection = (name, title) => {
        const sec = sections.find(s => s.name === name) || sections[0];
        if (!sec) return;
        // 去重：原标题已存在则不重复加
        const dup = (sec.items || []).some(it => newsHashKey(it.title || it) === newsHashKey(title));
        if (dup) return;
        sec.items.unshift({ title, desc: "", source: "实时新闻", url: newsSearchUrl(title) });
      };
      list.forEach(t => addToSection(classifyNewsSection(t), t));
      // 所有版面统一剔除已读条目（已看过的新闻从列表去掉）
      sections.forEach(s => { s.items = filterUnread(s.items); });
      // 今日要闻：从已整理的 sections 中精选（带 desc 概览），重要新闻优先
      var allItems = [];
      sections.forEach(s => (s.items || []).forEach(it => {
        const title = it.title || it;
        allItems.push({
          title: title, desc: it.desc || "",
          url: it.url || newsSearchUrl(title),
          source: it.source || "实时新闻",
          section: s.name, important: isTopNews(title)
        });
      }));
      // 重要新闻排前面，整体最多 10 条
      var tops = allItems.filter(it => it.important);
      var headline = tops.length >= 2 ?
        [...tops, ...allItems.filter(it => !it.important)].slice(0, 10) :
        allItems.slice(0, 10);
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
    // 已读的要闻不再展示
    const items = (headline || []).filter(it => !newsReadSet.has(newsHashKey(it.title || "")));
    if (!items.length) { box.hidden = true; return; }
    box.hidden = false;
    const $cnt = $("#newsHeadlineCount");
    if ($cnt) $cnt.textContent = items.length + " 条要闻 · 实时整理";
    // 每条要闻直接展示：标题 + 概览（desc）+ 原文链接，不再折叠
    $("#newsHeadlineList").innerHTML = items.map((it, i) => {
      return `
      <div class="news-hl-item open" data-hl="${i}" data-nt="${escapeHtml(newsHashKey(it.title || ""))}">
        <span class="news-hl-rank">${i + 1}</span>
        <div class="news-hl-main">
          <div class="news-hl-t">${escapeHtml(it.title)}</div>
          ${it.desc ? `<div class="news-hl-desc">${escapeHtml(it.desc)}</div>` : ""}
          <div class="news-hl-src">${escapeHtml(it.source || "今日新闻")}${it.section ? " · " + escapeHtml(it.section) : ""} · <a class="news-link" href="${it.url}" target="_blank" rel="noopener">查看原文 ↗</a></div>
        </div>
      </div>`;
    }).join("");
    // 查看原文即视为已读并移除
    const listEl = $("#newsHeadlineList");
    const hlRemove = (item) => {
      const title = item.getAttribute("data-nt") || "";
      if (title) markNewsRead(title);
      item.remove();
      // 若全部移除则隐藏要闻区
      if (!listEl.querySelectorAll(".news-hl-item").length) { box.hidden = true; }
      else {
        const cc = $("#newsHeadlineCount");
        if (cc) cc.textContent = listEl.querySelectorAll(".news-hl-item").length + " 条要闻 · 实时整理";
      }
    };
    listEl.querySelectorAll(".news-hl-item").forEach(item => {
      const link = item.querySelector(".news-link");
      if (link) link.addEventListener("click", () => hlRemove(item));
    });
  }

  function renderNewsUI(N, headline) {
    N = N || D.news || {};
    const today = N.today || {};
    // 渲染时统一剔除已读条目（已看过的新闻从列表去掉，未看的保留）
    const sections = (today.sections || []).map(s => ({ name: s.name, items: filterUnread(s.items) }));
    const $date = $("#newsDate"), $upd = $("#newsUpdated"), $cnt = $("#newsCount"), $filter = $("#newsFilter"), $box = $("#news");
    if ($date) $date.textContent = (today.date || "") + " " + (today.weekday || "");
    if ($upd) $upd.textContent = "更新于 " + (N.updated || "");
    const total = sections.reduce((a, s) => a + (s.items ? s.items.length : 0), 0);
    if ($cnt) $cnt.textContent = sections.length + " 个版面 · 共 " + total + " 条（已读已隐藏）";
    const newsItemHTML = (s, it) => `
      <div class="news-item" data-nt="${escapeHtml(newsHashKey(it.title || it))}">
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
      // 已读标记：点击「查看原文」或新闻条目正文 → 标记已读并立即从列表移除该条
      $box.querySelectorAll(".news-item").forEach(item => {
        const title = item.getAttribute("data-nt") || "";
        const markAndRemove = () => {
          if (!title) return;
          markNewsRead(title);
          item.remove();
          // 刷新计数
          const cntEl = $("#newsCount");
          if (cntEl) {
            let m = cntEl.textContent.match(/共\s*(\d+)\s*条/);
            if (m) cntEl.textContent = cntEl.textContent.replace(m[1], Math.max(0, +m[1] - 1));
          }
        };
        const link = item.querySelector(".news-link");
        if (link) link.addEventListener("click", () => markAndRemove());
        item.addEventListener("click", (e) => {
          // 只在点击正文（非链接）时标记已读；链接自身已单独处理
          if (e.target && e.target.closest && e.target.closest(".news-link")) return;
          markAndRemove();
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
        const title = (it && it.title) || it || "";
        items.push({
          title: title,
          desc: (it && it.desc) || "",
          url: (it && it.url) || newsSearchUrl(title),
          source: (it && it.source) || "今日新闻",
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
    // 每 2 小时检查：距上次更新超过 2 小时则拉取；且缓存数据日期≠今天时【跨天强制刷新】
    const tryRefresh = () => {
      let lastTs = 0, cachedDate = null;
      try {
        const raw = localStorage.getItem(NEWS_CACHE_KEY);
        if (raw) { const c = JSON.parse(raw); lastTs = c.ts || 0; cachedDate = (c.data && c.data.today && c.data.today.date) || null; }
      } catch (e) {}
      const nowD = new Date();
      const todayStr = `${nowD.getFullYear()}-${String(nowD.getMonth()+1).padStart(2,"0")}-${String(nowD.getDate()).padStart(2,"0")}`;
      const isStaleDate = (cachedDate && cachedDate !== todayStr); // 缓存的是旧日期 → 必须刷新为当日
      if (isStaleDate || !lastTs || (Date.now() - lastTs) >= NEWS_INTERVAL_MS) {
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
  // 播客 · 节目 + 最新一期整合板块：每张「值得听的播客」卡片下挂它的最新一期（RSS 实时）
  const fmtPub = (raw) => {
    if (!raw) return '';
    const d = new Date(raw);
    if (!isNaN(d)) {
      const m = d.getMonth() + 1, dd = d.getDate();
      return `发布于 ${m < 10 ? '0' + m : m}-${dd < 10 ? '0' + dd : dd}`;
    }
    return raw.replace(/,.*/, '');
  };
  /* ---------- 播客 · 单期「喜欢」基础设施（提前到使用前，避免 TDZ 阻断顶层初始化） ---------- */
  const POD_LIKE_KEY = "wb_pod_likes";
  const POD_LIKE_FB = "wb_pod_likes_bak";
  let podLikes = {};
  try { podLikes = JSON.parse(localStorage.getItem(POD_LIKE_KEY) || "{}") || {}; } catch (e) { podLikes = {}; }
  const podEpKey = (e) => ((e && e.show) ? e.show : "未知节目") + "·" + ((e && e.title) ? e.title : "未知单期");
  const isLiked = (e) => Object.prototype.hasOwnProperty.call(podLikes, podEpKey(e));

  // 最新一期卡片 HTML（可复用：整合进播客卡片 / 猜你喜欢）
  function podLatestHtml(e, id) {
    if (!e || !e.title) return '';
    return `
      <div class="pod-ep pod-latest">
        <div class="pod-latest-head">
          <span class="pod-latest-badge">📡 最新一期</span>
          <span class="pod-ep-title">${e.title}</span>
          ${podLikeBtnHtml(e)}
        </div>
        ${e.pub ? `<div class="pod-latest-pub">🕐 ${fmtPub(e.pub)}</div>` : ''}
        <div class="pod-latest-insight">
          <div class="pod-latest-core">${e.core || e.insight || ''}</div>
          ${(e.points && e.points.length) ? `<div class="pod-latest-label">📌 本期看点</div><div class="pod-latest-points">${e.points.map(p => `<div class="pod-latest-point">• ${p}</div>`).join("")}</div>` : ''}
          ${e.reason ? `<div class="pod-latest-label">🎧 为什么值得听</div><div class="pod-latest-reason">${e.reason}</div>` : ''}
        </div>
        ${e.full ? `<button class="pod-sum-toggle pod-latest-toggle" type="button" data-latest="${id}">▾ 查看完整深度解读</button><div class="pod-ep-full pod-latest-full" id="podLatestFull${id}" hidden></div>` : ''}
        ${(e.quotes && e.quotes.length) ? `<div class="pod-quotes pod-latest-quotes"><div class="pod-quotes-label">💬 当期重要语句</div>${e.quotes.map(q => `<div class="pod-quote">${q}</div>`).join("")}</div>` : ''}
        ${(e.full || e.core || e.summary || e.insight) ? `<button class="pod-listen-btn pod-latest-listen" type="button" data-latest="${id}">${hbLabel("podcast", "收听本期")}</button>` : (e.link ? `<a class="pod-listen-btn pod-latest-listen" href="${e.link}" target="_blank" rel="noopener">${hbLabel("podcast", "收听本期")}</a>` : '')}
      </div>`;
  }
  /* ---------- 🎙 栏目级「保留」+ 三天轮换 ---------- */
  // 用户点❤的栏目永久保留（每天照常更新最新一期）；其余栏目若展示满 3 天仍未获赞，
  // 则按用户口味（单期❤ + 栏目❤聚合出的主题词）从栏目池中换一档更对味的进来。
  const POD_SHOW_LIKE_KEY = "wb_pod_show_likes";
  const POD_SHOW_PICK_KEY = "wb_pod_show_pick";
  let podShowLikes = {};
  let podShowPick = {};
  try { podShowLikes = JSON.parse(localStorage.getItem(POD_SHOW_LIKE_KEY) || "{}") || {}; } catch (e) { podShowLikes = {}; }
  try { podShowPick = JSON.parse(localStorage.getItem(POD_SHOW_PICK_KEY) || "{}") || {}; } catch (e) { podShowPick = {}; }
  const SHOW_TARGET = 10;                 // 一屏展示的栏目数（保留原 10 个卡槽）
  const SHOW_KEEP_DAYS = 3;               // 未获赞栏目的最长保留天数
  const _todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
  const _daysSincePick = (name) => {
    const s = podShowPick[name];
    if (!s) return 9999;
    const p = new Date(s);
    if (isNaN(p.getTime())) return 9999;
    return Math.floor((Date.now() - p.getTime()) / 86400000);
  };
  const isShowLiked = (name) => Object.prototype.hasOwnProperty.call(podShowLikes, name);
  const savePodShowLikes = () => { try { localStorage.setItem(POD_SHOW_LIKE_KEY, JSON.stringify(podShowLikes)); } catch (e) {} };
  const savePodShowPick = () => { try { localStorage.setItem(POD_SHOW_PICK_KEY, JSON.stringify(podShowPick)); } catch (e) {} };
  const showLikeBtnHtml = (name) => {
    const on = isShowLiked(name);
    return `<button class="pod-show-like${on ? " liked" : ""}" type="button" data-showlike="1" aria-pressed="${on}" title="${on ? "已保留，不会因轮换被换走（再点取消）" : "保留这个栏目，不会因轮换被换走"}"><span class="pod-show-like-glyph">${on ? "❤" : "♡"}</span></button>`;
  };
  // 栏目口味评分：用已收藏单期(节目/单期) + 已保留栏目 的词频，算候选栏目与口味匹配度
  const POD_SHOW_STOP = new Set(["我们","你们","他们","她们","它们","这个","那个","一个","一些","一种","一定","一直","已经","可以","可能","应该","没有","不是","就是","也是","还是","什么","怎么","为什么","如果","因为","所以","但是","而且","以及","或者","而是","则","那","这","我","你","他","她","它","了","的","是","在","和","与","或","也","就","要","会","能","得","着","过","把","被","给","从","到","为","以","对","上","下","中","里","外","前","后","之","其","此","彼","每","各","某","本","另","再","又","才","并","且","所","即","向","由","自","于","按","依","据","至","该","正在","这个"]);
  const _tokens = (text) => (String(text || "").match(/[\u4e00-\u9fa5]{2,4}/g) || []).filter(t => !POD_SHOW_STOP.has(t));
  // —— 持久化口味画像：点❤单期 + 保留栏目 → 累积主题词词频，随喜好不断演化，且可供自动化读取 ——
  const POD_TASTE_KEY = "wb_pod_taste_profile";
  let podTasteProfile = {};
  try { podTasteProfile = JSON.parse(localStorage.getItem(POD_TASTE_KEY) || "{}") || {}; } catch (e) { podTasteProfile = {}; }
  const savePodTasteProfile = () => { try { localStorage.setItem(POD_TASTE_KEY, JSON.stringify(podTasteProfile)); } catch (e) {} };
  // 把一批文本的主题词累加入口味画像（词频衰减：越久不出现的词权重越低）
  function _feedTasteProfile(texts, boost) {
    const decay = 0.9; // 每次更新对旧词轻微衰减，让画像随当前偏好"移动"
    const now = Date.now();
    Object.keys(podTasteProfile).forEach(w => { podTasteProfile[w] = podTasteProfile[w] * decay; });
    (Array.isArray(texts) ? texts : [texts]).forEach(t => {
      _tokens(t).forEach(w => {
        podTasteProfile[w] = (podTasteProfile[w] || 0) + (boost || 1);
      });
    });
    // 清理权重过低的噪声词
    Object.keys(podTasteProfile).forEach(w => { if (podTasteProfile[w] < 0.2) delete podTasteProfile[w]; });
    savePodTasteProfile();
  }
  function buildPodTasteWordCount() {
    // 合并「口味画像」+「实时点赞」得到当前主题词频
    const wordCount = Object.assign({}, podTasteProfile);
    const allEpKey = {};
    (D.podcastEpisodes || []).forEach(e => { if (e && e.show) allEpKey[e.show + "·" + e.title] = e; });
    (D.podcastLatest || []).forEach(e => { if (e && e.show) allEpKey[e.show + "·" + e.title] = e; });
    Object.keys(podLikes).forEach(k => {
      const ep = allEpKey[k]; if (!ep) return;
      _tokens([ep.title, ep.summary, (ep.quotes || []).join(" "), ep.core || "", (ep.reason || "")].join(" ")).forEach(w => { wordCount[w] = (wordCount[w] || 0) + 2; });
    });
    Object.keys(podShowLikes).forEach(show => {
      const p = (D.podcasts || []).find(x => x.name === show); if (!p) return;
      _tokens([p.cat, p.summary].join(" ")).forEach(w => { wordCount[w] = (wordCount[w] || 0) + 2; });
    });
    return wordCount;
  }
  function podTasteScore(name) {
    const topWords = Object.entries(buildPodTasteWordCount()).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
    if (!topWords.length) return 0;
    const p = (D.podcasts || []).find(x => x.name === name);
    if (!p) return 0;
    // corpus 加入 tag 标签，让有 tag 的后备栏目匹配更精准
    const corpus = [p.cat, p.summary, p.metric, p.host, (p.tag || []).join(" ")].join(" ");
    const tokens = new Set(_tokens(corpus));
    let s = 0;
    topWords.forEach(w => { if (tokens.has(w)) s += 1; });
    return s;
  }
  // 口味画像初始化：首次访问时用已有喜欢内容灌一次（不重复灌）
  (function feedInitialTaste() {
    const seeded = podTasteProfile.__seeded;
    if (seeded) return;
    const allEpKey = {};
    (D.podcastEpisodes || []).forEach(e => { if (e && e.show) allEpKey[e.show + "·" + e.title] = e; });
    (D.podcastLatest || []).forEach(e => { if (e && e.show) allEpKey[e.show + "·" + e.title] = e; });
    const feedTexts = [];
    Object.keys(podLikes).forEach(k => { const ep = allEpKey[k]; if (ep) feedTexts.push([ep.title, ep.summary, (ep.quotes || []).join(" "), ep.core || "", (ep.reason || "")].join(" ")); });
    Object.keys(podShowLikes).forEach(show => { const p = (D.podcasts || []).find(x => x.name === show); if (p) feedTexts.push([p.cat, p.summary].join(" ")); });
    if (feedTexts.length) _feedTasteProfile(feedTexts, 1);
    podTasteProfile.__seeded = 1;
    savePodTasteProfile();
  })();
  const ACTIVE_POOL_TARGET = 20; // 活跃候选池：从全部栏目里按口味筛出的一档，3 天轮换在其中进行
  // 活跃池演化：喜欢必进 + 展示中(<=3天)保留 + 按口味分从后备补足到 ACTIVE_POOL_TARGET
  // 这样栏目池会随你的喜好不断"新陈代谢"——长期被冷落的栏目会淡出，更对味的持续顶上来。
  function resolveActivePool() {
    const today = _todayStr();
    const liked = new Set(D.podcasts.filter(p => isShowLiked(p.name)).map(p => p.name));
    const pool = new Set(liked);
    // 展示中（pick 在 3 天内）且未获赞的栏目，保留在活跃池（不打断观看连续性）
    D.podcasts.forEach(p => {
      if (pool.has(p.name)) return;
      if (podShowPick[p.name] !== undefined && _daysSincePick(p.name) <= SHOW_KEEP_DAYS) pool.add(p.name);
    });
    // 其余槽位：按口味分从全部非池内栏目里补足（优先有 latest 的，保证展示体验）
    const rest = D.podcasts.filter(p => !pool.has(p.name));
    rest.sort((a, b) => {
      const sa = podTasteScore(a.name), sb = podTasteScore(b.name);
      if (sa !== sb) return sb - sa;
      // 同分时优先有 latest 的栏目，避免展示无最新一期的占位卡
      const la = a.latest ? 1 : 0, lb = b.latest ? 1 : 0;
      if (la !== lb) return lb - la;
      return 0;
    });
    rest.forEach(o => { if (pool.size < ACTIVE_POOL_TARGET) pool.add(o.name); });
    // 新进池的栏目 pick=今天（从此刻起算 3 天展示期）
    Array.from(pool).forEach(name => {
      if (podShowPick[name] === undefined || _daysSincePick(name) > SHOW_KEEP_DAYS) podShowPick[name] = today;
    });
    savePodShowPick();
    return Array.from(pool);
  }
  // 决定本轮展示的栏目列表（在活跃池内：喜欢必留 + 未过期保留 + 超期让位换新）
  function resolvePodcastShowList() {
    const today = _todayStr();
    const activePool = resolveActivePool();
    const liked = new Set(activePool.filter(n => isShowLiked(n)));
    const result = new Set(liked);
    const others = activePool.filter(n => !isShowLiked(n)).map(n => (D.podcasts || []).find(x => x.name === n)).filter(Boolean);
    // A. 未过期（<=3 天）的栏目继续展示（累积时间，展示满 3 天后自然过期）
    const notExpired = others.filter(o => podShowPick[o.name] !== undefined && _daysSincePick(o.name) <= SHOW_KEEP_DAYS);
    notExpired.forEach(o => { if (result.size < SHOW_TARGET) result.add(o.name); });
    // B. 槽位不足时补足：从「未展示 / 已过期」之外的栏目里按口味分换入；
    //    刚超期让位的本轮不选回，避免整批原地打转。
    const pickedSet = new Set(result);
    const expiredNow = new Set(others.filter(o => podShowPick[o.name] !== undefined && _daysSincePick(o.name) > SHOW_KEEP_DAYS).map(o => o.name));
    const rotatePool = others.filter(o => !pickedSet.has(o.name) && !expiredNow.has(o.name));
    rotatePool.sort((a, b) => podTasteScore(b.name) - podTasteScore(a.name));
    rotatePool.forEach(o => { if (result.size < SHOW_TARGET) result.add(o.name); });
    // C. 新换入的（此前未展示，或曾超期被换走、本轮因口味重新进入）→ 重置 pick=今天
    Array.from(result).forEach(name => {
      if (podShowPick[name] === undefined || _daysSincePick(name) > SHOW_KEEP_DAYS) podShowPick[name] = today;
    });
    savePodShowPick();
    return Array.from(result);
  }
  const activeShows = resolvePodcastShowList();
  const activeIndex = activeShows.map((name, idx) => ({ name, idx }))
    .reduce((m, o) => { m[o.name] = o.idx; return m; }, {});
  const displayList = D.podcasts.filter(p => activeShows.includes(p.name))
    .sort((a, b) => activeIndex[a.name] - activeIndex[b.name]);
  $("#podcastList").innerHTML = displayList.map((p, i) => {
    const l = p.latest;
    return `
    <div class="pod-item${isShowLiked(p.name) ? " pod-item-kept" : ""}" data-show="${p.name}">
      <div class="pod-head">
        <span class="pod-name">${p.name}</span><span class="pod-cat">${p.cat}</span>
        ${showLikeBtnHtml(p.name)}
        <button class="pod-list-toggle" type="button" data-i="${i}"><span class="pod-list-arr">▸</span></button>
      </div>
      <div class="pod-meta">${p.metric}</div>
      <div class="pod-list-more" id="podMore${i}" hidden>
        <div class="pod-plat">平台：${p.platform}</div>
        <div class="pod-host-line">主播：${p.host}</div>
        <div class="pod-sum">${p.summary}</div>
      </div>
      ${l ? `<div class="pod-latest-wrap" id="podLatestWrap${i}">${podLatestHtml(l, p.name)}</div>` : `<div class="pod-note">📡 最新一期暂未获取到，请稍后再看。</div>`}
    </div>`;
  }).join("");
  // 「值得听的播客」卡片事件：节目信息展开 + 最新一期完整解读展开
  const podListBox = $("#podcastList");
  if (podListBox) {
    podListBox.addEventListener("click", (ev) => {
      const lb = ev.target.closest(".pod-listen-btn");
      if (lb) { handlePodListen(lb); return; }
      const btn = ev.target.closest(".pod-list-toggle");
      if (btn) {
        const i = btn.getAttribute("data-i");
        const more = document.getElementById("podMore" + i);
        if (!more) return;
        const open = more.hidden;
        more.hidden = !open;
        btn.querySelector(".pod-list-arr").textContent = open ? "▾" : "▸";
        btn.classList.toggle("on", open);
        return;
      }
      const tbtn = ev.target.closest(".pod-latest-toggle");
      if (tbtn) {
        const id = tbtn.getAttribute("data-latest");
        const full = document.getElementById("podLatestFull" + id);
        if (!full) return;
        if (full.hidden) {
          if (!full.innerHTML) {
            const showName = tbtn.closest(".pod-item")?.getAttribute("data-show");
            const pod = (D.podcasts || []).find(x => x && x.name === showName);
            const e = (pod && pod.latest) || null;
            if (e) full.innerHTML = (e.full || "").split("\n").map(podLineHtml).join("");
          }
          full.hidden = false;
          tbtn.textContent = "▴ 收起完整深度解读";
        } else {
          full.hidden = true;
          tbtn.textContent = "▾ 查看完整深度解读";
        }
      }
      const sbtn = ev.target.closest(".pod-show-like");
      if (sbtn) {
        ev.stopPropagation();
        const card = sbtn.closest(".pod-item");
        const show = card && card.getAttribute("data-show");
        if (!show) return;
        const on = isShowLiked(show);
        if (on) {
          delete podShowLikes[show];
        } else {
          podShowLikes[show] = Date.now();
          podShowPick[show] = _todayStr();   // 点喜欢即视为本轮已选中，重新计时
          // 把该栏目的口味喂入画像，让活跃池随喜好演化
          const likedPod = (D.podcasts || []).find(x => x.name === show);
          if (likedPod) _feedTasteProfile([likedPod.cat, likedPod.summary, (likedPod.tag || []).join(" ")].join(" "), 2);
        }
        savePodShowLikes();
        sbtn.classList.toggle("liked", !on);
        sbtn.setAttribute("aria-pressed", String(!on));
        sbtn.title = !on ? "已保留，不会因轮换被换走（再点取消）" : "保留这个栏目，不会因轮换被换走";
        const t = sbtn.querySelector(".pod-show-like-glyph");
        if (t) t.textContent = !on ? "❤" : "♡";
        card && card.classList.toggle("pod-item-kept", !on);
        podLikeToast(on ? "已取消保留：" + show : "❤ 已保留「" + show + "」，不会因轮换被换走");
        return;
      }
    });
  }
  $("#podcastTrends").innerHTML = D.podcastTrends.map(t => `<div class="pod-note">${t}</div>`).join("");

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
      // 把该单期的主题词喂入口味画像，让活跃池随喜好演化
      _feedTasteProfile([ep.title, ep.summary, (ep.quotes || []).join(" "), ep.core || "", (ep.reason || "")].join(" "), 1);
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
      <button class="pod-listen-btn" type="button" data-i="${i}">${hbLabel("podcast", "收听本期")}</button>
    </div>`).join("");
  const podToggle = $("#podToggle");
  if (podToggle) {
    podToggle.addEventListener("click", () => {
      const on = podEpBox.classList.toggle("reading");
      podToggle.textContent = on ? "🗂 卡片模式" : "📖 阅读模式";
    });
  }
  /* ---------- 收听：跳转到播客平台收听当期真实音频 ---------- */
  // 根据按钮取对应单期的音频外链
  function resolvePodAudioLink(btn) {
    // 精选单期（data-i）：优先用自身 link，其次按 show 匹配 podcasts 列表的 latest.link
    const i = btn.getAttribute("data-i");
    if (i != null && i !== "") {
      const ep = D.podcastEpisodes[+i];
      if (!ep) return null;
      if (ep.link) return ep.link;
      const pod = (D.podcasts || []).find(x => x && x.name === ep.show);
      return (pod && pod.latest && pod.latest.link) || null;
    }
    // 最新一期（data-latest）：直接用 latest.link
    const id = btn.getAttribute("data-latest");
    if (id != null && id !== "") {
      const showName = btn.closest(".pod-item")?.getAttribute("data-show");
      const pod = (D.podcasts || []).find(x => x && x.name === showName);
      return (pod && pod.latest && pod.latest.link) || null;
    }
    return null;
  }
  function handlePodListen(btn) {
    const link = resolvePodAudioLink(btn);
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    } else {
      // 没有直接链接时，按节目名+标题搜索
      const i = btn.getAttribute("data-i");
      let q = "";
      if (i != null && i !== "") {
        const ep = D.podcastEpisodes[+i];
        q = ep ? (ep.show + " " + ep.title) : "";
      }
      if (q) {
        window.open("https://www.xiaoyuzhoufm.com/search?q=" + encodeURIComponent(q), "_blank", "noopener,noreferrer");
      } else {
        appToast("暂无收听链接", 2000, "warn");
      }
    }
  }
  podEpBox.addEventListener("click", (ev) => {
    const listenBtn = ev.target.closest(".pod-listen-btn");
    if (listenBtn) { handlePodListen(listenBtn); return; }
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
  // 最新一期（整合进「值得听的播客」卡片）喜欢按钮：从外层播客卡片取节目名，从卡片内取单期标题
  bindLikeClicks(podListBox, (btn) => {
    const card = btn.closest(".pod-item");
    if (!card) return null;
    const show = card.querySelector(".pod-name")?.textContent || "";
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

    recBox.innerHTML = `<div class="pod-rec-head pod-rec-toggle">🤍 你的播客口味 · 已收藏 ${entries.length} 期<span class="sec-arr">▾</span></div><div class="pod-rec-body">${showChips}${wordChips}${recList}</div>`;
    const toggleHead = recBox.querySelector(".pod-rec-toggle");
    if (toggleHead) {
      toggleHead.addEventListener("click", () => {
        const collapsed = toggleHead.classList.toggle("collapsed");
        const arr = toggleHead.querySelector(".sec-arr");
        if (arr) arr.textContent = collapsed ? "▸" : "▾";
      });
    }
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
    thought: { name: "随笔感想", icon: "💭" },
    study:   { name: "学习记录", icon: "📖" }
  };
  /* 关键词自动识别分类（优先级从高到低） */
  const MEMO_RULES = [
    { cat: "meeting", kw: ["会议", "开会", "纪要", "议题", "讨论", "决策", "参会", "会议记录", "周会", "例会", "晨会", "汇报", "立项", "复盘会", "头脑风暴", "对齐", "同步", "排期", "上线", "需求", "方案", "议程", "决议", "待办事项", "分工", "负责人"] },
    { cat: "study", kw: ["学习", "复习", "预习", "课程", "课堂", "网课", "视频课", "看书", "阅读", "读书", "笔记", "知识点", "公式", "概念", "考点", "错题", "刷题", "练习", "作业", "论文", "文献", "背单词", "英语", "单词", "语法", "考试", "测验", "测评", "分数", "成绩", "毕业", "升学", "考研", "考公", "考证", "证书", "上课", "老师", "老师讲", "教材", "课本", "笔记记录", "听讲", "默写", "听写", "讲解", "题型", "方法", "解题", "例题", "理解", "掌握", "学会"] },
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
    catch (e) { appToast("保存失败：本地存储空间不足，请删减带图片的记录", 3500, "err"); }
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
      if (!dataUrl) { appToast("图片读取失败，请换一张", 2400, "warn"); return; }
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
      hbSet(btn, "mic");
      ta.classList.remove("voice-typing");
    }
    function start() {
      finalBuf = ta.value ? ta.value + " " : "";
      btn.classList.add("recording");
      hbSet(btn, "mic", "on");
      ta.classList.add("voice-typing");
      try { rec.start(); } catch (e) {}
    }
    btn.addEventListener("click", () => {
      if (btn.classList.contains("recording")) rec.stop(); else start();
    });
  })();

  /* 记录完整内容查看（点击列表项打开） */
  function memoCatOptions(selected) {
    let html = "";
    for (const k in MEMO_CATS) {
      const c = MEMO_CATS[k];
      html += `<option value="${k}" ${k === selected ? "selected" : ""}>${c.icon} ${c.name}</option>`;
    }
    return html;
  }
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
      <div class="mf-view-cat-edit" data-memo-index="${i}">
        <label for="memoCatEdit">调整归档类别</label>
        <select id="memoCatEdit" class="memo-cat-edit-select">${memoCatOptions(cat)}</select>
      </div>
    `;
    const sel = body.querySelector("#memoCatEdit");
    if (sel) sel.addEventListener("change", () => {
      const idx = +body.querySelector(".mf-view-cat-edit").dataset.memoIndex;
      const m2 = memos[idx];
      if (!m2) return;
      const newCat = sel.value;
      m2.cat = newCat;
      saveMemos(); renderMemoTabs(); renderMemos();
      // 刷新详情里的标签展示
      const meta = MEMO_CATS[newCat] || MEMO_CATS.daily;
      const tag = body.querySelector(".mf-view-cat");
      if (tag) { tag.className = `mf-view-cat cat-${newCat}`; tag.textContent = `${meta.icon} ${meta.name}`; }
      appToast(`已调整到「${meta.name}」`, 1800, "ok");
    });
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

  /* 备忘录 → MD 导出 */
  function buildMemosMarkdown() {
    const lines = [];
    lines.push("# 我的记录（备忘录）· 完整导出");
    lines.push("");
    lines.push("> 导出时间：" + new Date().toLocaleString("zh-CN"));
    lines.push("> 共 " + memos.length + " 条记录");
    lines.push("");
    if (memos.length === 0) {
      lines.push("_还没有记录，随手写一条吧_ 📝");
      return lines.join("\n");
    }
    // 按分类分组，保持原有顺序（新→旧）
    const groups = {};
    memos.forEach(m => {
      const c = m.cat || "daily";
      if (!groups[c]) groups[c] = [];
      groups[c].push(m);
    });
    // 分类展示顺序
    const memoOrder = ["meeting", "study", "daily", "thought"];
    const keys = Object.keys(groups).sort((a, b) => {
      const ia = memoOrder.indexOf(a), ib = memoOrder.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b, "zh");
    });
    keys.forEach(cat => {
      const meta = MEMO_CATS[cat] || { name: cat, icon: "🗂️" };
      const items = groups[cat];
      lines.push("---");
      lines.push("");
      lines.push("## " + meta.icon + " " + meta.name + "　·　" + items.length + " 条");
      lines.push("");
      items.forEach((m, i) => {
        const date = m.ts ? formatMemoTs(m.ts) : "无日期";
        lines.push("### " + date + "　·　#" + (i + 1));
        lines.push("");
        if (m.t && m.t.trim()) lines.push("> " + m.t.trim().replace(/\n/g, "\n> "));
        else lines.push("> （本条只有图片）");
        lines.push("");
        if (m.img) lines.push("- **含图片**：需在「我的记录」页面查看原图");
        lines.push("");
      });
    });
    lines.push("---");
    lines.push("");
    lines.push("_由 jojo-wealth 导出 · 备忘录_");
    return lines.join("\n");
  }
  const memoExportBtn = document.getElementById("memoExport");
  if (memoExportBtn) memoExportBtn.addEventListener("click", () => {
    if (memos.length === 0) {
      const appToast = window.appToast;
      if (appToast) appToast("还没有记录可以导出 📝", 2500, "info");
      return;
    }
    downloadTextFile("我的记录_" + fmtTs() + ".md", buildMemosMarkdown());
    const appToast = window.appToast;
    if (appToast) appToast("已导出 " + memos.length + " 条记录 ✓", 2500, "ok");
  });

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

  /* ---- 星盘视角：基于当日日月黄经推算（自包含，无需 ephemeris） ---- */
  const ZODIAC_CN = ["白羊", "金牛", "双子", "巨蟹", "狮子", "处女", "天秤", "天蝎", "射手", "摩羯", "水瓶", "双鱼"];
  const ZODIAC_ELEM = ["火", "土", "风", "水", "火", "土", "风", "水", "火", "土", "风", "水"]; // 与 ZODIAC_CN 同序
  /* 用户出生信息（1992-07-11 11:35 四川成都）。仅用于推演更准的本命盘/当日相位，绝不渲染到界面。 */
  const BIRTH = {
    y: 1992, mo: 7, d: 11, h: 11, min: 35,
    lng: 104.07, lat: 30.67, place: "成都"   // 成都经纬度：真太阳时修正用
  };
  // 由出生时刻精确推算的本命黄经（单位：度，0-360，含各星体相位精度）
  const NATAL_LON = {
    sun: 109.083,      // 太阳 巨蟹 19°05'
    moon: 248.017,     // 本命月亮 射手 8°01'
    asc: 177.5,        // 上升 处女 27°30'
    mc: 87.35          // 天顶 双子 27°21'
  };
  // 本命星座索引（供文案显示）
  const NATAL_MOON_IDX = Math.floor(NATAL_LON.moon / 30) % 12;  // 8 = 射手
  const NATAL_ASC_IDX = Math.floor(NATAL_LON.asc / 30) % 12;    // 5 = 处女
  function _julianDate(d) { return (d.getTime() / 86400000) + 2440587.5; }
  function _ecliptic(date) {
    const JD = _julianDate(date);
    const d = JD - 2451545.0; // 自 J2000 起算天数
    // 太阳（低精度，误差<0.01°）
    const L0 = 280.46646 + 0.98564736 * d;
    const g = (357.52911 + 0.98560028 * d) * Math.PI / 180;
    let sun = L0 + 1.914602 * Math.sin(g) + 0.019993 * Math.sin(2 * g) + 0.000289 * Math.sin(3 * g);
    // 月亮（低精度，误差<0.3°，足够判定星座）
    const Lm = 218.3165 + 13.176396 * d;
    const Mm = (134.9634 + 13.064993 * d) * Math.PI / 180;
    let moon = Lm + 6.289 * Math.sin(Mm);
    return {
      sun: ((sun % 360) + 360) % 360,
      moon: ((moon % 360) + 360) % 360
    };
  }
  function _signOf(lon) { return Math.floor(lon / 30) % 12; }
  /* 度数级相位：流运黄经 transLon 对本命黄经 natalLon 的最短角距(0..180)，
     匹配标准相位(合相0/六合60/刑90/三合120/冲180)，容许度 orb=8°；无主要相位返回 null */
  function _aspectDeg(transLon, natalLon) {
    const raw = Math.abs(((transLon - natalLon) % 360 + 360) % 360);
    const diff = Math.min(raw, 360 - raw);
    const ORB = 8;
    const cands = [
      { name: "合相", level: "平顺", kind: "focus", ang: 0 },
      { name: "六合", level: "平顺", kind: "flow", ang: 60 },
      { name: "刑相", level: "守成", kind: "tension", ang: 90 },
      { name: "三合", level: "大吉", kind: "flow", ang: 120 },
      { name: "对冲", level: "守成", kind: "oppose", ang: 180 }
    ];
    let best = null;
    for (const c of cands) {
      const d = Math.abs(diff - c.ang);
      if (d <= ORB && (!best || d < best.d)) best = { name: c.name, level: c.level, kind: c.kind, d };
    }
    return best;
  }
  const _ELEM_NOTE = {
    "火": "行动与冲劲上扬，宜果断推进，但留意急躁。",
    "土": "踏实落地，宜处理实务、整理与执行，稳扎稳打。",
    "风": "交流点子多，宜沟通、学习、社交，思路更开阔。",
    "水": "情绪与直觉敏感，宜内省、创作、照顾心情。"
  };
  const _ASPECT_CORE = {
    "focus": "月亮落本命巨蟹，能量高度聚焦，情感与直觉敏锐，最适合照顾内心、经营亲近关系与居所事务。",
    "minor": "微调之日，宜小步推进、留意健康与日常秩序，不必大动。",
    "flow": "天象顺流，贵人、合作与表达运佳，适合推进重要事项或与人协作。",
    "tension": "张力显现，易有摩擦或自我拉扯，重要决定留缓冲、避免硬碰硬。",
    "adjust": "略有错位别扭，需主动调整节奏，跨界与突发事务多留神。",
    "oppose": "波动最大，情绪与对外关系易两极，宜稳守、少做重大承诺。"
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
      /* ---- 当日财运（八字视角）：戊土身强，以「金」为财星（土生金），金为喜用神之一 ---- */
      const dayIsMetal = (sw === "金" || bw === "金");
      let wealthLevel, wealthText;
      if (dayIsMetal) {
        wealthLevel = "财旺"; wealthText = "日干日支临金，财星得地当令，正偏财皆有可得之机，宜把握进账、谈成合作与合同。";
      } else if (favCnt >= 2) {
        wealthLevel = "财顺"; wealthText = "喜用神得气，财路顺畅、进账稳健，可适度开源、规划理财。";
      } else if (favCnt === 1) {
        wealthLevel = "财平"; wealthText = "财星平平，宜守现有收益，避免冲动消费与投机冒进。";
      } else {
        wealthLevel = "财守"; wealthText = "比劫偏旺、财星受制，宜守财勿漏，重大投资与借贷缓一缓。";
      }
      const favColors = fav.map(e => `<span class="alm-clr" style="background:${ELEM_COLOR[e].hex};color:${ELEM_COLOR[e].txt}">${ELEM_COLOR[e].name}</span>`).join("");
      const mainElem = hasWood ? "木" : (fav.includes(sw) ? sw : (fav.includes(bw) ? bw : "木"));
      const mainColor = ELEM_COLOR[mainElem];

      /* ---- 星盘视角：当日日月黄经 → 与精确本命盘(太阳/月亮/上升)的度数级相位 ---- */
      const _lon = _ecliptic(now);
      const _moonSignIdx = _signOf(_lon.moon);
      const moonSign = ZODIAC_CN[_moonSignIdx];
      const moonElem = ZODIAC_ELEM[_moonSignIdx];
      const sunSign = ZODIAC_CN[_signOf(_lon.sun)];
      // 度数级相位（orb 8°）：月亮→本命太阳(情感主线)、月亮→本命月亮(内在情绪)、太阳→本命上升(自我展现)
      const aspSun = _aspectDeg(_lon.moon, NATAL_LON.sun);
      const aspMoon = _aspectDeg(_lon.moon, NATAL_LON.moon);
      const aspAsc = _aspectDeg(_lon.sun, NATAL_LON.asc);
      // 星盘吉凶综合：以月照本命太阳为主，参考内在情绪与自我展现两面
      const ups = [aspSun, aspMoon, aspAsc].filter(Boolean).filter(a => a.level === "大吉").length;
      const downs = [aspSun, aspMoon, aspAsc].filter(Boolean).filter(a => a.level === "守成").length;
      let astroLevel;
      if (aspSun && aspSun.level === "大吉" && ups >= 2) astroLevel = "大吉";
      else if (aspSun && (aspSun.level === "守成") && downs >= 2) astroLevel = "守成";
      else astroLevel = (aspSun && aspSun.level) || "平顺";
      // 主导相位（供文案定位）：月照本命太阳 > 月照本命月亮 > 太阳照上升
      const mainAsp = aspSun || aspMoon || aspAsc;
      const natalMoonSign = ZODIAC_CN[NATAL_MOON_IDX];
      const natalAscSign = ZODIAC_CN[NATAL_ASC_IDX];
      const moonNatalPart = aspMoon
        ? `；月亮同时触发本命月亮（${natalMoonSign}），情绪面成「${aspMoon.name}」`
        : `；本命月亮（${natalMoonSign}）今日不受强相位扰动`;
      const ascPart = aspAsc
        ? `对外表现受「${aspAsc.name}」影响`
        : `对外气场平稳`;
      const astroText = `今日月亮落在${moonSign}座（${moonElem}象），与你的本命太阳成「${mainAsp ? mainAsp.name : "顺行"}」${moonNatalPart}，${ascPart}。${mainAsp ? _ASPECT_CORE[mainAsp.kind] : _ASPECT_CORE.minor}${_ELEM_NOTE[moonElem]}`;
      /* ---- 当日财运（星盘视角）：月亮四象定位务实/开拓/人脉/情绪消费，再以本命相位加持或收束 ---- */
      const wealthMoonMap = { "土": "财旺", "火": "财活", "风": "财源", "水": "财平" };
      const wealthNoteMap = {
        "土": `月亮落${moonSign}座（土象），财帛宫得务实落地能量，谈钱进账、处理合约与财务较有把握。`,
        "火": `月亮落${moonSign}座（火象），求财有冲劲但易急躁冒进，宜先谋定再出手。`,
        "风": `月亮落${moonSign}座（风象），财源多来自人脉与点子，宜多沟通、谈合作、拓展资源。`,
        "水": `月亮落${moonSign}座（水象），情绪易影响消费判断，宜克制冲动买单、量入为出。`
      };
      let astroWealthLevel = wealthMoonMap[moonElem] || "财平";
      let astroWealthText = wealthNoteMap[moonElem] || "财运平顺，按计划打理即可。";
      if (astroLevel === "大吉") {
        astroWealthLevel = "财旺"; astroWealthText = "星盘顺流加持，" + astroWealthText;
      } else if (astroLevel === "守成") {
        astroWealthLevel = "财守"; astroWealthText = "星盘张力，财务宜守不宜攻，避免冲动投资与借贷。";
      }
      let synth;
      if (luckLevel !== "守成" && astroLevel !== "守成") {
        synth = "八字得气、星盘顺流，两盘同向向好——宜主动推进、把握关键节奏。";
      } else if (luckLevel === "守成" && astroLevel === "守成") {
        synth = "八字与星盘皆宜守，今日重蓄力与整理，重大决定缓一缓。";
      } else if (luckLevel === "守成") {
        synth = "八字偏弱，但星盘有助力，可借外力与协作成事、对外多借势。";
      } else {
        synth = "星盘张力，但八字得气，按自己节奏推进、对外多留弹性空间。";
      }

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
          <div class="alm-pf">身强戊土 · 属猴 · 太阳巨蟹 · 上升处女 · 喜金水木（木为调和）</div>
          <div class="alm-views">
            <div class="alm-view">
              <div class="alm-view-h">☯ 八字视角</div>
              <div class="alm-luck2">
                <span class="alm-luck-lv lv-${luckLevel}">${luckLevel}</span>
                <span class="alm-luck-txt">${luckText}</span>
              </div>
              <div class="alm-luck2 alm-wealth">
                <span class="alm-luck-lv lv-${wealthLevel}">💰${wealthLevel}</span>
                <span class="alm-luck-txt">${wealthText}</span>
              </div>
              <div class="alm-clr-row">
                <span class="alm-clr-label">幸运色系</span>${favColors}
              </div>
              <div class="alm-clr-row">
                <span class="alm-clr-label">今日主打</span><span class="alm-clr alm-clr-main" style="background:${mainColor.hex};color:${mainColor.txt}">${mainColor.name}</span>
                <span class="alm-daywx">日干 ${dayStem}（${sw}）· 日支 ${dayBranch}（${bw}）</span>
              </div>
            </div>
            <div class="alm-view alm-view-astro">
              <div class="alm-view-h">✦ 星盘视角</div>
              <div class="alm-luck2">
                <span class="alm-luck-lv lv-${astroLevel}">${astroLevel}</span>
                <span class="alm-luck-txt">${astroText}</span>
              </div>
              <div class="alm-luck2 alm-wealth">
                <span class="alm-luck-lv lv-${astroWealthLevel}">💰${astroWealthLevel}</span>
                <span class="alm-luck-txt">${astroWealthText}</span>
              </div>
              <div class="alm-clr-row">
                <span class="alm-clr-label">月亮</span><span class="alm-clr alm-clr-main">${moonSign}座 · ${moonElem}象</span>
              </div>
              <div class="alm-clr-row">
                <span class="alm-clr-label">太阳</span><span class="alm-clr">行进于${sunSign}座</span>
                <span class="alm-clr-label" style="margin-left:4px">相位</span><span class="alm-clr">与巨蟹本命「${mainAsp ? mainAsp.name : "顺行"}」</span>
              </div>
            </div>
          </div>
          <div class="alm-synth">🜔 综合：${synth}</div>
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

  // ---------- 一键导出（Markdown 格式） ----------
  // 通用下载工具
  function downloadTextFile(filename, content, mime) {
    try {
      const blob = new Blob([content], { type: (mime || "text/markdown") + ";charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    } catch (e) {
      console.warn("下载失败", e);
      const appToast = window.appToast;
      if (appToast) appToast("导出失败：" + (e && e.message || e), 3000, "err");
    }
  }
  function fmtTs() {
    const d = new Date();
    const p = n => String(n).padStart(2, "0");
    return d.getFullYear() + p(d.getMonth()+1) + p(d.getDate());
  }

  // 摘抄 → MD（按分类分组）
  function buildExcerptsMarkdown() {
    const arr = exLoadAll().slice();
    const lines = [];
    lines.push("# 我的摘抄 · 完整导出");
    lines.push("");
    lines.push("> 导出时间：" + new Date().toLocaleString("zh-CN"));
    lines.push("> 共 " + arr.length + " 条摘抄");
    lines.push("");
    if (arr.length === 0) {
      lines.push("_还没有摘抄记录，认字 / 拍图存起来吧_ ✍️");
      return lines.join("\n");
    }
    // 按分类分组
    const groups = {};
    arr.forEach(it => {
      const c = (it.cat && it.cat.trim()) ? it.cat.trim() : "未分类";
      if (!groups[c]) groups[c] = [];
      groups[c].push(it);
    });
    // 分类名排序：写人/写事/写景/观点/情感/其他/自定义…/未分类 放最后
    const order = ["写人", "写事", "写景", "观点", "情感", "其他"];
    const keys = Object.keys(groups).sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      if (a === "未分类") return 1;
      if (b === "未分类") return -1;
      return a.localeCompare(b, "zh");
    });
    keys.forEach(cat => {
      const items = groups[cat];
      lines.push("---");
      lines.push("");
      lines.push("## 📂 " + cat + "　·　" + items.length + " 条");
      lines.push("");
      items.forEach((it, i) => {
        const text = (it.text || "").toString().trim();
        if (!text) return;
        const date = (it.date || "").toString().trim();
        const source = (it.source || "").toString().trim();
        const tags = (it.tags || "").toString().trim();
        lines.push("### " + (date || "无日期") + "　·　#" + (i + 1));
        lines.push("");
        lines.push("> " + text.replace(/\n/g, "\n> "));
        lines.push("");
        if (source) lines.push("- **来源**：" + source);
        if (tags) {
          const tagList = tags.split(/[,，\s]+/).filter(Boolean).map(t => "`" + t + "`").join(" ");
          if (tagList) lines.push("- **标签**：" + tagList);
        }
        lines.push("");
      });
    });
    lines.push("---");
    lines.push("");
    lines.push("_由 jojo-wealth 导出 · 摘抄笔记_");
    return lines.join("\n");
  }

  // 绑定按钮
  const exExportBtn = $("#exExport");
  if (exExportBtn) exExportBtn.addEventListener("click", () => {
    const arr = exLoadAll();
    if (arr.length === 0) {
      const appToast = window.appToast;
      if (appToast) appToast("还没有摘抄记录可以导出 ✍️", 2500, "info");
      return;
    }
    downloadTextFile("我的摘抄_" + fmtTs() + ".md", buildExcerptsMarkdown());
    const appToast = window.appToast;
    if (appToast) appToast("已导出 " + arr.length + " 条摘抄 ✓", 2500, "ok");
  });

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

  // 基础词典：每类一组关键词（出现 1 次 +1 分，2 字以上的词再 +1）
  // 选词原则：常见、互斥性高、避免与"其他"高重叠
  const EX_BASE_LEX = {
    "写人": [
      "他", "她", "我", "你", "我们", "他们", "她们", "父亲", "母亲", "爸爸", "妈妈",
      "爷爷", "奶奶", "外公", "外婆", "老师", "朋友", "同学", "孩子", "男孩", "女孩",
      "老人", "男人", "女人", "眼神", "笑容", "背影", "头发", "手", "脸", "眼睛",
      "沉默", "说话", "性格", "脾气", "长大", "年轻", "美丽", "温柔", "善良", "倔强"
    ],
    "写事": [
      "那天", "一次", "有一次", "后来", "当时", "于是", "然后", "接着", "最后",
      "发生", "开始", "结束", "做", "做了一件事", "去", "来到", "离开", "回来",
      "遇到", "碰见", "走过", "进了", "出了", "出发", "到达", "经历", "经过",
      "决定", "选择", "做了", "开始做", "做完", "举办", "发生了一件事", "事件", "事故"
    ],
    "写景": [
      "山", "水", "河", "海", "湖", "天", "云", "风", "雨", "雪",
      "月", "日", "星", "光", "影", "色", "红", "绿", "蓝", "白",
      "田野", "森林", "草原", "沙漠", "城市", "村庄", "小路", "街道", "夕阳", "朝阳",
      "清晨", "黄昏", "夜晚", "春天", "夏天", "秋天", "冬天", "微风", "细雨", "落叶",
      "花瓣", "天空", "大地", "自然", "风景", "景色", "窗外", "炊烟", "远山"
    ],
    "观点": [
      "所谓", "其实", "不过", "只是", "真正", "本质", "道理", "规律", "真理", "意义",
      "因为", "所以", "因此", "然而", "但是", "如果", "虽然", "尽管", "即使", "无论",
      "认为", "觉得", "以为", "想必", "可见", "可知", "可知", "不难", "必然", "应该",
      "必须", "需要", "值得", "事实上", "换言之", "总之", "反之", "无疑", "未必", "可惜"
    ],
    "情感": [
      "爱", "恨", "思念", "想念", "牵挂", "孤独", "寂寞", "温柔", "心疼", "难过",
      "悲伤", "开心", "快乐", "喜悦", "痛苦", "失望", "遗憾", "不舍", "眷恋", "依恋",
      "心", "泪", "哭", "笑", "幸福", "温暖", "感动", "心酸", "情", "感情",
      "情怀", "心境", "内心", "心里", "心头", "心上", "情感", "情绪", "心情", "感受"
    ]
  };
  // 中文里词频极端不均，2 字词比 1 字更准一些
  const EX_WORD_BONUS = { 2: 1, 3: 2, 4: 3 };

  // 把"我写的字"按 1~4 字滑窗切成 token（不做中文分词，简单 n-gram 足够）
  function exTokenize(str) {
    const s = String(str || "").replace(/\s+/g, "");
    const out = [];
    for (let n = 4; n >= 1; n--) {
      for (let i = 0; i + n <= s.length; i++) out.push(s.substr(i, n));
    }
    return out;
  }

  // 个性化词典：从用户已分类的条目中，提炼「该类下出现频率高于全库均值的 token」加权
  // 缓存 key，每次新增/删除摘抄时清掉
  const EX_PERS_KEY = "wb_excerpt_personal_v1";
  function exGetPersonalLex() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(EX_PERS_KEY) || "null");
      if (cached) return cached;
    } catch (e) {}
    const arr = exLoadAll();
    if (arr.length < 3) return null;       // 数据太少，不做个性化
    const byCat = {};   // cat -> token 频次
    const total = {};   // token 全库频次
    arr.forEach(it => {
      if (!it || !it.cat || it.cat.startsWith("__")) return;
      const c = it.cat;
      if (!EX_DEFAULT_CATS.includes(c)) return;   // 自定义类别不进个人词典
      byCat[c] = byCat[c] || {};
      const toks = exTokenize((it.text || "") + " " + (it.source || "") + " " + (it.tags || ""));
      toks.forEach(t => { if (t.length >= 1) { byCat[c][t] = (byCat[c][t] || 0) + 1; total[t] = (total[t] || 0) + 1; } });
    });
    if (!Object.keys(byCat).length) return null;
    // 选每类 top 20 token
    const result = {};
    Object.keys(byCat).forEach(c => {
      const entries = Object.entries(byCat[c])
        .filter(([t, n]) => total[t] >= 2 && n / total[t] >= 0.4)   // 该类占比 ≥40% 才算特征
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([t]) => t);
      if (entries.length) result[c] = entries;
    });
    try { sessionStorage.setItem(EX_PERS_KEY, JSON.stringify(result)); } catch (e) {}
    return result;
  }
  function exClearPersonalLex() { try { sessionStorage.removeItem(EX_PERS_KEY); } catch (e) {} }

  // 智能归类主函数
  // 输入：{ text, source, tags, currentCat }（currentCat 是用户已手动选的，会被加权）
  // 输出：{ cat, scores, confidence, reason }
  function exClassify(input) {
    input = input || {};
    const tokens = exTokenize((input.text || "") + " " + (input.source || "") + " " + (input.tags || ""));
    if (!tokens.length) return { cat: "其他", scores: {}, confidence: 0, reason: "无文本" };
    const scores = {};
    EX_DEFAULT_CATS.forEach(c => { scores[c] = 0; });
    // 基础词典
    Object.keys(EX_BASE_LEX).forEach(c => {
      const dict = EX_BASE_LEX[c];
      const dictSet = new Set(dict);
      tokens.forEach(t => {
        if (dictSet.has(t)) {
          scores[c] += 1 + (EX_WORD_BONUS[t.length] || 0);
        }
      });
    });
    // 个性化词典加成（用户已分类条目提炼的）
    const pers = exGetPersonalLex();
    if (pers) {
      Object.keys(pers).forEach(c => {
        const set = new Set(pers[c]);
        tokens.forEach(t => { if (set.has(t)) scores[c] += 3; });
      });
    }
    // 标签直加：标签里出现的词直接进对应类
    if (input.tags) {
      const tagWords = String(input.tags).split(/[,，;；\s]+/).map(s => s.trim()).filter(Boolean);
      tagWords.forEach(w => {
        Object.keys(EX_BASE_LEX).forEach(c => {
          if (EX_BASE_LEX[c].indexOf(w) >= 0) scores[c] += 4;
        });
        if (pers) Object.keys(pers).forEach(c => { if ((pers[c] || []).indexOf(w) >= 0) scores[c] += 4; });
      });
    }
    // 出处关键词
    if (input.source) {
      const src = String(input.source);
      ["写人", "写事", "写景", "观点", "情感"].forEach(c => {
        if (src.indexOf(c) >= 0) scores[c] += 3;
      });
    }
    // 用户已手动选 → 大幅加权（保证不会被自动推荐覆盖）
    if (input.currentCat && EX_DEFAULT_CATS.indexOf(input.currentCat) >= 0) {
      scores[input.currentCat] += 50;
    }
    // 选最高分
    let best = "其他", bestScore = 0;
    EX_DEFAULT_CATS.forEach(c => { if (scores[c] > bestScore) { best = c; bestScore = scores[c]; } });
    if (bestScore === 0) best = "其他";
    // 置信度：最高分 / 总分（0-1）
    const sum = EX_DEFAULT_CATS.reduce((a, c) => a + scores[c], 0) || 1;
    const confidence = bestScore / sum;
    // 给出 reason：top3 命中词
    const reasonTokens = tokens.filter(t => {
      for (const c of EX_DEFAULT_CATS) {
        if (c === "其他") continue;
        if ((EX_BASE_LEX[c] || []).indexOf(t) >= 0) return true;
        if (pers && c in pers && pers[c].indexOf(t) >= 0) return true;
      }
      return false;
    });
    const top = {};
    reasonTokens.forEach(t => { top[t] = (top[t] || 0) + 1; });
    const topList = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]);
    return { cat: best, scores, confidence, reason: topList.join("·") };
  }
  // 暴露到全局，供碎片阅读收藏 IIFE 跨作用域调用
  window.exClassify = exClassify;

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

  /* ---------- 整理文字实时自动识别归档类别 ---------- */
  const exAutoCat = $("#exAutoCat");
  const exAutoCatChip = $("#exAutoCatChip");
  const exAutoCatConf = $("#exAutoCatConf");
  let exAutoCatTimer = null;

  function exUpdateAutoCat() {
    if (!exAutoCat || !exAutoCatChip) return;
    const text = exText ? exText.value.trim() : "";
    const source = exSource ? exSource.value.trim() : "";
    const tags = exTags ? exTags.value.trim() : "";
    // 用户手动选了类别 → 标记覆盖态
    const manualOverride = !!(exCat || (exCatCustom && exCatCustom.value.trim()));
    if (!text) {
      exAutoCat.hidden = true;
      return;
    }
    const r = exClassify({ text, source, tags });
    if (!r || r.confidence < 0.25) {
      exAutoCat.hidden = true;
      return;
    }
    exAutoCat.hidden = false;
    exAutoCat.classList.toggle("override", manualOverride);
    exAutoCatChip.textContent = r.cat;
    const pct = Math.round(r.confidence * 100);
    exAutoCatConf.textContent = r.reason ? "匹配词：" + r.reason + " · 置信度 " + pct + "%" : "置信度 " + pct + "%";
    exAutoCatChip.onclick = () => {
      exCat = r.cat;
      if (exCatCustom) exCatCustom.value = "";
      exRenderCatChips();
      exSaveDraft();
    };
  }
  // debounce 输入
  function exAutoCatInput() {
    clearTimeout(exAutoCatTimer);
    exAutoCatTimer = setTimeout(exUpdateAutoCat, 300);
  }
  if (exText) exText.addEventListener("input", exAutoCatInput);
  if (exSource) exSource.addEventListener("input", exAutoCatInput);
  if (exTags) exTags.addEventListener("input", exAutoCatInput);

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
  // 草稿恢复后触发一次自动识别
  setTimeout(exUpdateAutoCat, 50);

  // 摘抄的类别：兼容旧数据（无 cat 字段）→ 未分类
  function exCatOf(it) { return (it && it.cat && it.cat.trim()) ? it.cat.trim() : "__none"; }

  /* ---------- 批量智能归类：旧数据回溯 ---------- */
  const exBatch = $("#exBatch");
  const exBatchN = $("#exBatchN");
  const exBatchBtn = $("#exBatchBtn");
  function exRenderBatch() {
    if (!exBatch) return;
    const arr = exLoadAll();
    const n = arr.filter(it => exCatOf(it) === "__none").length;
    if (n > 0) {
      exBatch.hidden = false;
      if (exBatchN) exBatchN.textContent = n;
    } else {
      exBatch.hidden = true;
    }
  }
  if (exBatchBtn) {
    exBatchBtn.addEventListener("click", () => {
      const arr = exLoadAll();
      let count = 0;
      const dist = {};
      arr.forEach(it => {
        if (exCatOf(it) !== "__none") return;
        const r = exClassify({ text: it.text, source: it.source, tags: it.tags });
        it.cat = r.cat;
        count++;
        dist[r.cat] = (dist[r.cat] || 0) + 1;
      });
      if (count === 0) return;
      localStorage.setItem(EX_KEY, JSON.stringify(arr));
      exClearPersonalLex();
      const summary = Object.keys(dist).map(k => `${k} ${dist[k]}`).join(" / ");
      exMsg.textContent = `📦 已归类 ${count} 条 → ${summary}`;
      exFilter = "";   // 切回"全部"视图，让用户看到全貌
      exRenderList();
      setTimeout(() => { if (exMsg) exMsg.textContent = ""; }, 4000);
    });
  }

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
    exRenderBatch();
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
    // 点击分类徽章 → 打开「调整分类」弹窗：任何已保存的摘抄都可重新归类（含自定义类别）
    exList.querySelectorAll(".excerpt-cat-badge").forEach(bd => {
      bd.addEventListener("click", () => {
        const a = exLoadAll();
        const f = exFilter ? a.filter(it => exCatOf(it) === exFilter) : a;
        const real = exFilter ? a.findIndex(it => it === f[+bd.closest(".excerpt-item").dataset.idx]) : +bd.closest(".excerpt-item").dataset.idx;
        if (real < 0) return;
        const it = a[real];
        openExCatModal(real, it);
      });
    });
  }

  /* ---------- 摘抄「调整分类」弹窗：保存后任意条目可自行改分类 ---------- */
  function openExCatModal(realIdx, it) {
    const modal = $("#exCatModal");
    const body = $("#exCatModalBody");
    if (!modal || !body) return;
    const cur = exCatOf(it);
    const curLabel = cur === "__none" ? "未分类" : cur;
    const cats = exAllCats();   // 预设 + 出现过的自定义
    const chips = cats.map(c => `
      <button type="button" class="excerpt-cat-chip${c === cur ? " active" : ""}" data-newcat="${c.replace(/"/g, "&quot;")}">${c}</button>
    `).join("");
    body.innerHTML = `
      <div style="font-size:13px;color:var(--ink-faint);margin-bottom:10px;">
        当前类别：<b style="color:var(--ink)">${curLabel}</b>
      </div>
      <div class="excerpt-cat-chips" style="margin-bottom:10px;">${chips}</div>
      <input id="exCatModalCustom" type="text" placeholder="或输入自定义类别" maxlength="12" />
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
        <button type="button" class="btn ghost small" id="exCatModalCancel">取消</button>
        <button type="button" class="btn small" id="exCatModalOk">✅ 确定</button>
      </div>
    `;
    let chosen = cur === "__none" ? "" : cur;
    body.querySelectorAll(".excerpt-cat-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        chosen = btn.dataset.newcat;
        body.querySelectorAll(".excerpt-cat-chip").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const cu = $("#exCatModalCustom");
        if (cu) cu.value = "";
      });
    });
    const cu = $("#exCatModalCustom");
    if (cu) {
      cu.addEventListener("input", () => {
        const v = cu.value.trim();
        if (v) {
          chosen = v;
          body.querySelectorAll(".excerpt-cat-chip").forEach(b => b.classList.remove("active"));
        }
      });
    }
    if ($("#exCatModalCancel")) $("#exCatModalCancel").addEventListener("click", () => { modal.hidden = true; document.body.style.overflow = ""; });
    const ok = $("#exCatModalOk");
    if (ok) {
      ok.addEventListener("click", () => {
        const v = (chosen || "").trim();
        if (!v) { exMsg.textContent = "请选择或输入一个类别"; return; }
        const a = exLoadAll();
        if (!a[realIdx]) { modal.hidden = true; document.body.style.overflow = ""; return; }
        const old = exCatOf(a[realIdx]);
        a[realIdx].cat = v;
        localStorage.setItem(EX_KEY, JSON.stringify(a));
        exClearPersonalLex();
        exMsg.textContent = `✅ 已把这条摘抄调整到「${v}」`;
        exRenderList();
        setTimeout(() => { if (exMsg) exMsg.textContent = ""; }, 2500);
        modal.hidden = true;
        document.body.style.overflow = "";
      });
    }
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    // 移除旧的 __none 徽章点击时的 prompt 逻辑（旧逻辑已由上面统一接管）
    const oldBadge = exList.querySelector('[data-idx="' + realIdx + '"] .excerpt-cat-badge');
    void oldBadge;
  }
  const exCatModal = $("#exCatModal");
  if (exCatModal) exCatModal.addEventListener("click", e => { if (e.target === exCatModal) { exCatModal.hidden = true; document.body.style.overflow = ""; } });
  if ($("#exCatModalClose")) $("#exCatModalClose").addEventListener("click", () => { exCatModal.hidden = true; document.body.style.overflow = ""; });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      const m = $("#exCatModal");
      if (m && !m.hidden) { m.hidden = true; document.body.style.overflow = ""; }
    }
  });
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
        exUpdateAutoCat();   // 识别完成后立即触发归档识别
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
      // 智能归类：用户没手动选时，调用 exClassify 给个建议
      let cat;
      if (exCatCustom && exCatCustom.value.trim()) {
        cat = exCatCustom.value.trim();
      } else if (exCat) {
        cat = exCat;
      } else {
        const r = exClassify({ text, source: exSource.value.trim(), tags: exTags.value.trim() });
        cat = r.cat;
      }
      arr.unshift({ text, source: exSource.value.trim(), tags: exTags.value.trim(), cat, date: fmtDate(new Date()) });
      localStorage.setItem(EX_KEY, JSON.stringify(arr));
      exClearPersonalLex();   // 新增条目让个人词典缓存失效，下次自动重建
      exMsg.textContent = "已保存到「" + cat + "」✓";
      exText.value = ""; exSource.value = ""; exTags.value = "";
      if (exCatCustom) exCatCustom.value = "";
      exCat = "";
      exClearDraft();
      exReset();
      exRenderCatChips();
      exUpdateAutoCat();   // 保存后隐藏自动识别
      exRenderList();
      setTimeout(() => { if (exMsg) exMsg.textContent = ""; }, 2500);
    });
  }
  /* ---------- 一键清除编辑区文字（整理后的文字） ---------- */
  const exTextClear = $("#exTextClear");
  if (exTextClear) {
    exTextClear.addEventListener("click", () => {
      const hasText = exText && exText.value.trim();
      const hasMeta = (exSource && exSource.value.trim()) || (exTags && exTags.value.trim()) || exCat;
      if (!hasText && !hasMeta) {
        exMsg.textContent = "编辑区已经是空的了";
        setTimeout(() => { if (exMsg) exMsg.textContent = ""; }, 1800);
        return;
      }
      if (hasText && !confirm("确定清除当前编辑区的识别文字吗？\n（只清空此处草稿，不会删除已保存的摘抄）")) return;
      if (exText) exText.value = "";
      if (exSource) exSource.value = "";
      if (exTags) exTags.value = "";
      if (exCatCustom) exCatCustom.value = "";
      exCat = "";
      exClearDraft();
      exRenderCatChips();
      exMsg.textContent = "已清除编辑区";
      setTimeout(() => { if (exMsg) exMsg.textContent = ""; }, 1800);
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
        appToast("当前浏览器不支持语音朗读，请换 Chrome / Edge / Safari 试试。", 3500, "warn");
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
      const spKeys = (Array.isArray(sp.keys) && sp.keys.length) ? sp.keys : null;
      let inner;
      if (spKeys) {
        inner = `
        <div class="eng-spoken-title">${sp.title || ""}</div>
        <div class="eng-keys">
          ${spKeys.map((k, i) => {
            const en = (k && k.en) || "";
            const cn = (k && k.cn) || "";
            return `
            <div class="eng-key">
              <span class="eng-key-no">${i + 1}</span>
              <span class="eng-key-en">${en}</span>
              ${en ? `<button class="eng-speak" type="button" data-sent="${en.replace(/"/g, "&quot;")}" title="朗读这句">${hbIcon("speak")}</button>` : ""}
              ${cn ? `<div class="eng-key-trans">📖 ${cn}</div>` : ""}
            </div>`;
          }).join("")}
        </div>`;
      } else {
        inner = `
        <div class="eng-spoken-title">${sp.title || ""}</div>
        ${sp.key ? `<div class="eng-key"><span class="eng-key-en">${sp.key}</span><button class="eng-speak" type="button" data-sent="${sp.key.replace(/"/g, "&quot;")}" title="朗读核心句">${hbIcon("speak")}</button>${sp.keyTrans ? `<div class="eng-key-trans">📖 ${sp.keyTrans}</div>` : ""}</div>` : ""}`;
      }
      spBox.innerHTML = inner + `
        ${sp.transcript ? `<div class="eng-transcript">${sp.transcript.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>` : ""}
      `;
      const spSpeak = spBox.querySelectorAll(".eng-speak");
      spSpeak.forEach(b => b.addEventListener("click", () => speakEn(b.dataset.sent)));
    }

    // vocab —— 支持多词性（senses 数组）展示，每个词性含独立例句
    const vbBox = document.getElementById("engVocab");
    if (vbBox) {
      vbBox.innerHTML = (day.vocab || []).map(v => {
        const senses = (v.senses && v.senses.length) ? v.senses
          : [{ pos: "", meaning: v.meaning || "", example: v.example || "" }];
        const exEn = s => (s.example || "").split("（")[0].trim();
        const sensesHtml = senses.map(s => `
          <div class="vocab-sense">
            ${s.pos ? `<span class="vocab-pos">${s.pos}</span>` : ""}
            <span class="vocab-sense-meaning">${s.meaning || ""}</span>
            ${s.example ? `<div class="vocab-example">${s.example}${exEn(s) ? `<button class="vocab-play-sm" type="button" data-sent="${exEn(s).replace(/"/g, "&quot;")}" title="朗读例句">${hbIcon("speak")}</button>` : ""}</div>` : ""}
          </div>`).join("");
        return `
        <div class="vocab-item">
          <div class="vocab-head"><span class="vocab-word">${v.word}</span><button class="vocab-play" type="button" data-word="${v.word}" title="朗读单词">${hbIcon("speak")}</button></div>
          <div class="vocab-phon">${v.phonetic || ""}</div>
          <div class="vocab-senses">${sensesHtml}</div>
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
          <div class="eb-front">${it.front}<button class="eb-play" type="button" data-sent="${it.front.replace(/"/g, "&quot;")}" title="朗读">${hbIcon("speak")}</button></div>
          <div class="eb-back" data-hide="1">${backExtra}${it.back}</div>
          <button class="eb-reveal" type="button">${hbLabel("eye", "显示答案")}</button>
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
        b.textContent = "";
        if (hidden) { b.innerHTML = hbLabel("eye-off", "隐藏答案"); } else { b.innerHTML = hbLabel("eye", "显示答案"); }
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
          senses: (v.senses && v.senses.length) ? v.senses
            : [{ pos: "", meaning: v.meaning || "", example: v.example || "" }],
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
      const sensesHtml = (w.senses || []).map(s => `
        <div class="wl-sense">
          ${s.pos ? `<span class="vocab-pos">${s.pos}</span>` : ""}<span class="wl-sense-meaning">${s.meaning || ""}</span>
          ${s.example ? `<div class="wl-sense-ex">${s.example}</div>` : ""}
        </div>`).join("");
      return `
        <div class="wl-item${passed ? " passed" : ""}" data-id="${w.id}">
          <div class="wl-main">
            <div class="wl-word-row">
              <span class="wl-word">${w.word}</span>
              <span class="wl-play" data-w="${w.word}" title="朗读单词">${hbIcon("speak")}</span>
              ${passed ? `<span class="wl-badge">✅ 已过关</span>` : `<span class="wl-badge no">待过关</span>`}
            </div>
            <div class="wl-phon">${w.phonetic} <span class="wl-src">· ${w.src}</span></div>
            ${(w.senses && w.senses.length) ? `<div class="wl-senses">${sensesHtml}</div>` : ""}
          </div>
          ${showChecks ? `
          <div class="wl-checks">
            <button class="wl-chk${chk("r")}" type="button" data-k="r">${hbLabel("eye", "会认")}</button>
            <button class="wl-chk${chk("d")}" type="button" data-k="d">${hbLabel("bubble", "会读")}</button>
            <button class="wl-chk${chk("m")}" type="button" data-k="m">${hbLabel("bubble", "知道意思")}</button>
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
        <div class="frag-one-head"><span class="frag-no">${i + 1}</span><span class="frag-cat">${d.category || ""}</span><span class="frag-source-mini">${d.source || ""}</span><button type="button" class="frag-fav-btn" data-fav-type="fragment" data-fav-key="${fragKey(d)}" title="收藏">☆</button></div>
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
            <button type="button" class="frag-fav-btn" data-fav-type="deep" data-fav-key="${(x.title || "") + "|" + (x.source || "")}" title="收藏">☆</button>
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
          if (e.target.closest(".deep-body") || e.target.closest(".frag-fav-btn")) return;
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
          <div class="frag-item-head"><span class="frag-cat">${d.category || ""}</span><span class="frag-source-mini">${d.source || ""}</span><button type="button" class="frag-fav-btn" data-fav-type="fragment" data-fav-key="${fragKey(d)}" title="收藏">☆</button><span class="frag-arrow">▾</span></div>
          <div class="frag-passage">${d.passage || ""}</div>
          <div class="frag-item-body">
            <div class="frag-block"><div class="frag-block-title">✒️ 文笔解析</div><div class="frag-analysis">${d.analysis || ""}</div></div>
            <div class="frag-block frag-prompt-block"><div class="frag-block-title">✍️ 练笔</div><div class="frag-prompt">${d.prompt || ""}</div></div>
            ${practiceHTML(d)}
          </div>
        </div>`;
      }).join("");
      bindPractice(listEl);
      document.dispatchEvent(new Event("frag:repaint"));
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
        if (e.target.closest(".frag-item-body") || e.target.closest(".frag-fav-btn")) return;
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

    /* 今日古诗文（每日 1 篇） */
    function classicHTML(c) {
      const head = `<div class="frag-fold-head-row">
        <span class="frag-classic-era">${c.era || ""}</span>
        <span class="frag-classic-poet">· ${c.poet || ""}</span>
        <button type="button" class="frag-fav-btn" data-fav-type="classic" data-fav-key="${c.id}" title="收藏">☆</button>
      </div>
      <div class="frag-classic-title">${c.title || ""}</div>`;
      return `<div class="frag-classic-card" data-fav-type="classic" data-fav-key="${c.id}">
        ${head}
        <div class="frag-classic-original">${c.original || ""}</div>
        <div class="frag-block"><div class="frag-block-title">📜 现代汉语译文</div><div class="frag-block-body">${c.translation || ""}</div></div>
        <div class="frag-block"><div class="frag-block-title">🏯 历史背景</div><div class="frag-block-body">${c.history || ""}</div></div>
        <div class="frag-block"><div class="frag-block-title">🌿 诗文赏析</div><div class="frag-block-body">${c.appreciation || ""}</div></div>
      </div>`;
    }
    const classics = fr.classics || [];
    const todayClassicEl = document.getElementById("fragClassicToday");
    if (todayClassicEl && classics.length) {
      const idx = ((idxOf(today) % classics.length) + classics.length) % classics.length;
      const c = classics[idx];
      todayClassicEl.innerHTML = classicHTML(c);
      const headEl = todayClassicEl.querySelector(".frag-classic-title");
      if (headEl) headEl.dataset.classicTitle = c.title;
    }

    /* 今日历史事件（每日 1 篇） */
    function historyHTML(h) {
      return `<div class="frag-history-card" data-fav-type="history" data-fav-key="${h.id}">
        <div class="frag-fold-head-row">
          <span class="frag-history-year">${h.year || ""}</span>
          <span class="frag-history-region">· ${h.region || ""}</span>
          <button type="button" class="frag-fav-btn" data-fav-type="history" data-fav-key="${h.id}" title="收藏">☆</button>
        </div>
        <div class="frag-history-title">${h.title || ""}</div>
        <div class="frag-history-summary">${h.summary || ""}</div>
        <div class="frag-block"><div class="frag-block-title">🌍 历史背景</div><div class="frag-block-body">${h.background || ""}</div></div>
        <div class="frag-block"><div class="frag-block-title">⚙️ 事件经过</div><div class="frag-block-body">${h.event || ""}</div></div>
        <div class="frag-block"><div class="frag-block-title">💥 历史影响</div><div class="frag-block-body">${h.impact || ""}</div></div>
      </div>`;
    }
    const historyArr = fr.history || [];
    const todayHistoryEl = document.getElementById("fragHistoryToday");
    if (todayHistoryEl && historyArr.length) {
      const idx = ((idxOf(today) % historyArr.length) + historyArr.length) % historyArr.length;
      const h = historyArr[idx];
      todayHistoryEl.innerHTML = historyHTML(h);
    }
  })();

  /* ---------- Snapshot label ---------- */
  if (D && D.snapshotLabel) { const sl = $("#snapLabel"); if (sl) sl.textContent = D.snapshotLabel.split("·")[1].trim(); }

  /* ---------- Card 收起 / 展开 ---------- */
  var LS_KEY = "wb_card_collapsed_v1";
  var saved = {};
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch(e) {}
  function _cardId(card) {
    // 用 card 内的 h2 文本 + 父页面 ID 生成唯一 key
    var h2 = card.querySelector("h2");
    var pageEl = card.closest(".page");
    var prefix = pageEl ? pageEl.id.replace("page-","") : "global";
    var title = h2 ? h2.textContent.replace(/\s+/g,"").substring(0,20) : "";
    return prefix + "__" + title;
  }
  function _saveCards() {
    var obj = {};
    $$(".card.collapsed").forEach(function(c) { var id = _cardId(c); if (id) obj[id] = 1; });
    try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch(e) {}
  }
  function _restoreCard(card) {
    var id = _cardId(card);
    if (saved[id]) card.classList.add("collapsed");
  }
  $$(".card").forEach(function(card) {
    var head = card.querySelector(".card-head");
    if (!head) return;
    // 已有或没有都走同一条路：找到 .card-toggle，没有就建一个
    var btn = head.querySelector(".card-toggle");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card-toggle";
      btn.setAttribute("aria-label", "收起 / 展开该模块");
      btn.innerHTML = "▾";
      head.appendChild(btn);
    }
    btn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      card.classList.toggle("collapsed");
      btn.setAttribute("aria-expanded", card.classList.contains("collapsed") ? "false" : "true");
      _saveCards();
    });
    // 恢复上一次折叠状态
    _restoreCard(card);
    btn.setAttribute("aria-expanded", card.classList.contains("collapsed") ? "false" : "true");
  });
})();

/* ==========================================================================
   心理学模块（认知偏差 / 社交 / 情绪 / 行为 / 营销 / 影响力）
   由浅入深：入门 → 进阶 → 实战；每张卡「看懂了 → 会用上了」两阶段掌握标记
   ========================================================================== */
(function renderPsychology() {
  const D = window.WORKBENCH_DATA || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  const appToast = window.appToast;  /* 复用全局 appToast */
  const P = D && D.psychology;
  if (!P) return;
  const KEY = "wb_psych_progress_v1";
  const UNLOCK_KEY = "wb_psych_tier2_unlocked_v1";
  const CATS = P.categories || [];
  const CARDS_BASE = P.cards || [];
  const QUIZZES = P.quizzes || [];
  const LV = P.levelNames || { "1": "入门", "2": "进阶", "3": "实战" };
  const catMap = {}; CATS.forEach(c => catMap[c.id] = c);

  // ---------- 动态卡片池：tier2 解锁后自动并入 ----------
  function tier2Unlocked() { return localStorage.getItem(UNLOCK_KEY) === "1"; }
  function setTier2Unlocked(v) { try { localStorage.setItem(UNLOCK_KEY, v ? "1" : "0"); } catch (e) {} }
  function CARDS() {
    if (tier2Unlocked()) return CARDS_BASE;
    return CARDS_BASE.filter(c => !c.tier || c.tier !== 2);
  }

  // 状态：当前筛选
  const state = { cat: "all", level: "all", view: "path", expanded: {} };

  function loadProg() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function saveProg(p) { try { localStorage.setItem(KEY, JSON.stringify(p || prog)); } catch (e) {} }
  let prog = loadProg();

  const listEl = $("#psychList");
  const barEl = $("#psychProgressBar");
  const txtEl = $("#psychProgressText");
  const subEl = $("#psychSub");
  if (!listEl) return;

  // ---------- 进度 ----------
  function masters() { return CARDS().filter(c => prog[c.id] && prog[c.id].applied).length; }
  function understood() { return CARDS().filter(c => prog[c.id] && prog[c.id].understood).length; }
  function renderProgress() {
    const cards = CARDS();
    const m = masters(), u = understood(), total = cards.length;
    const pct = total ? Math.round(m / total * 100) : 0;
    if (barEl) barEl.style.width = pct + "%";
    if (txtEl) txtEl.textContent = `已掌握 ${m} / ${total} · 看懂 ${u}`;
    if (subEl) {
      const next = cards.filter(c => !(prog[c.id] && prog[c.id].applied))
        .sort((a, b) => a.level - b.level)[0];
      subEl.textContent = next ? `下一站：${LV[next.level]} · ${next.title}` : "全部掌握，牛！";
    }
  }

  // ---------- 筛选 chips ----------
  function renderChips() {
    const catBox = $("#psychCatChips");
    if (catBox) {
      catBox.innerHTML = `<button class="psych-chip ${state.cat === "all" ? "active" : ""}" data-cat="all" type="button">全部</button>` +
        CATS.map(c => `<button class="psych-chip ${state.cat === c.id ? "active" : ""}" data-cat="${c.id}" type="button">${c.icon} ${c.name}</button>`).join("");
      catBox.querySelectorAll(".psych-chip").forEach(b => b.addEventListener("click", () => {
        state.cat = b.dataset.cat;
        catBox.querySelectorAll(".psych-chip").forEach(x => x.classList.toggle("active", x === b));
        render();
      }));
    }
    const lvBox = $("#psychLevelChips");
    if (lvBox) lvBox.querySelectorAll(".psych-chip").forEach(b => b.addEventListener("click", () => {
      state.level = b.dataset.level;
      lvBox.querySelectorAll(".psych-chip").forEach(x => x.classList.toggle("active", x === b));
      render();
    }));
    const vBox = $("#psychViewChips");
    if (vBox) vBox.querySelectorAll(".psych-chip").forEach(b => b.addEventListener("click", () => {
      state.view = b.dataset.view;
      vBox.querySelectorAll(".psych-chip").forEach(x => x.classList.toggle("active", x === b));
      render();
    }));
  }

  // ---------- 卡片 HTML ----------
  function cardHTML(c, idx, showIdx) {
    const st = prog[c.id] || {};
    const cat = catMap[c.cat] || { name: c.cat, icon: "📌" };
    const exp = state.expanded[c.id];
    const applyItems = (c.apply || []).map(a => `<li>${escapeHtml(a)}</li>`).join("");
    const tags = (c.tags || []).map(t => `<span class="psych-tag">${escapeHtml(t)}</span>`).join("");
    const lvlClass = "lv" + c.level;
    return `<div class="psych-card ${lvlClass} ${st.applied ? "is-mastered" : ""} ${exp ? "is-open" : ""}" data-id="${c.id}">
      <div class="psych-card-head" data-toggle="${c.id}">
        ${showIdx ? `<span class="psych-no">${idx + 1}</span>` : ""}
        <span class="psych-lv-badge lv${c.level}">${LV[c.level] || c.level}</span>
        <span class="psych-cat-mini">${cat.icon} ${cat.name}</span>
        <span class="psych-title">${escapeHtml(c.title)}</span>
        <span class="psych-one">${escapeHtml(c.one)}</span>
        <span class="psych-arr">${exp ? "▴" : "▾"}</span>
      </div>
      <div class="psych-card-body" ${exp ? "" : "hidden"}>
        <div class="psych-block"><div class="psych-block-t">📖 是什么</div><div class="psych-text">${escapeHtml(c.concept)}</div></div>
        <div class="psych-block"><div class="psych-block-t">🧩 为什么有效</div><div class="psych-text">${escapeHtml(c.why)}</div></div>
        <div class="psych-block psych-apply"><div class="psych-block-t">✅ 怎么用（照着做）</div><ul class="psych-apply-list">${applyItems}</ul></div>
        <div class="psych-block"><div class="psych-block-t">💡 例子</div><div class="psych-text">${escapeHtml(c.example)}</div></div>
        <div class="psych-tags">${tags}</div>
        <div class="psych-mark">
          <button class="psych-btn ${st.understood ? "on" : ""}" data-mark="understood" data-id="${c.id}" type="button">${st.understood ? "✓ 看懂了" : "📖 看懂了"}</button>
          <button class="psych-btn primary ${st.applied ? "on" : ""}" data-mark="applied" data-id="${c.id}" type="button" ${st.understood ? "" : "disabled"}>${st.applied ? "✓ 会用上了" : "✅ 会用上了"}</button>
        </div>
        ${st.lastReview ? `<div class="psych-reviewed">上次复习：${new Date(st.lastReview).toLocaleDateString("zh-CN")}</div>` : ""}
      </div>
    </div>`;
  }

  // ---------- 主渲染 ----------
  function render() {
    let arr = CARDS().slice();
    if (state.cat !== "all") arr = arr.filter(c => c.cat === state.cat);
    if (state.level !== "all") arr = arr.filter(c => String(c.level) === String(state.level));
    if (state.view === "path") {
      arr.sort((a, b) => a.level - b.level || CATS.findIndex(x => x.id === a.cat) - CATS.findIndex(x => x.id === b.cat));
    } else {
      arr.sort((a, b) => CATS.findIndex(x => x.id === a.cat) - CATS.findIndex(x => x.id === b.cat) || a.level - b.level);
    }
    listEl.innerHTML = arr.length
      ? arr.map((c, i) => cardHTML(c, i, state.view === "path")).join("")
      : `<div class="psych-empty">这个分类/难度下还没有卡片～</div>`;
    bindCards();
    renderProgress();
  }

  function bindCards() {
    listEl.querySelectorAll("[data-toggle]").forEach(h => h.addEventListener("click", () => {
      const id = h.dataset.toggle;
      state.expanded[id] = !state.expanded[id];
      const card = listEl.querySelector(`.psych-card[data-id="${id}"]`);
      if (card) {
        card.classList.toggle("is-open", state.expanded[id]);
        const body = card.querySelector(".psych-card-body");
        if (body) body.hidden = !state.expanded[id];
        const arr = card.querySelector(".psych-arr");
        if (arr) arr.textContent = state.expanded[id] ? "▴" : "▾";
      }
    }));
    listEl.querySelectorAll("[data-mark]").forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      const id = b.dataset.id, kind = b.dataset.mark;
      if (!prog[id]) prog[id] = {};
      prog[id][kind] = !prog[id][kind];
      prog[id].lastReview = Date.now();
      saveProg(prog);
      render();
      appToast(kind === "applied" && prog[id].applied ? "已标记「会用上了」🎉" : (kind === "understood" && prog[id].understood ? "已标记「看懂了」👍" : "已取消标记"), 1600, "ok");
      checkTier2Unlock();
    }));
  }

  // ---------- 今日学习：基于日期种子的确定性 3 张 ----------
  // 同一天点击结果不变，次日自动更新
  function daySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function mulberry32(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pickDaily3() {
    const cards = CARDS();
    const seed = daySeed();
    const rng = mulberry32(seed);
    const pool = cards.slice();
    // Fisher-Yates shuffle with seeded RNG
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, Math.min(3, pool.length));
  }

  // ---------- tier2 自动解锁检测 ----------
  function checkTier2Unlock() {
    if (tier2Unlocked()) return false;
    const cards = CARDS();
    if (!cards.length) return false;
    const m = cards.filter(c => prog[c.id] && prog[c.id].applied).length;
    if (m / cards.length >= 0.75) {
      setTier2Unlocked(true);
      appToast("🎉 进阶知识库已解锁！20 张深度卡片等你挑战", 4000, "ok");
      renderProgress();
      render();
      return true;
    }
    return false;
  }

  const todayBtn = $("#psychToday");
  if (todayBtn) todayBtn.addEventListener("click", () => {
    const picks = pickDaily3();
    if (!picks.length) { appToast("暂无卡片可用", 1800, "info"); return; }
    state.cat = "all"; state.level = "all"; state.view = "path";
    picks.forEach(c => state.expanded[c.id] = true);
    // 同步 chips 高亮
    const catBox = $("#psychCatChips"); if (catBox) catBox.querySelectorAll(".psych-chip").forEach(x => x.classList.toggle("active", x.dataset.cat === "all"));
    const lvBox = $("#psychLevelChips"); if (lvBox) lvBox.querySelectorAll(".psych-chip").forEach(x => x.classList.toggle("active", x.dataset.level === "all"));
    const vBox = $("#psychViewChips"); if (vBox) vBox.querySelectorAll(".psych-chip").forEach(x => x.classList.toggle("active", x.dataset.view === "path"));
    render();
    listEl.scrollIntoView({ behavior: "smooth", block: "start" });
    appToast(`今日 ${picks.length} 条已展开，学完记得标记 🎯`, 2000, "ok");
  });

  // 页面进入时自动展示今日 3 条
  function autoShowDaily() {
    const picks = pickDaily3();
    if (!picks.length) return;
    // 如果当前没有展开任何卡片，就自动展开今日 3 条
    const hasExpanded = Object.values(state.expanded).some(v => v);
    if (hasExpanded) return;
    picks.forEach(c => state.expanded[c.id] = true);
  }

  const reviewBtn = $("#psychReview");
  if (reviewBtn) reviewBtn.addEventListener("click", () => {
    const pool = CARDS().filter(c => prog[c.id] && prog[c.id].understood);
    const src = pool.length ? pool : CARDS();
    const c = src[Math.floor(Math.random() * src.length)];
    state.cat = "all"; state.level = "all";
    state.expanded[c.id] = true;
    // 标记本次复习
    if (!prog[c.id]) prog[c.id] = {};
    prog[c.id].lastReview = Date.now(); saveProg();
    render();
    const card = listEl.querySelector(`.psych-card[data-id="${c.id}"]`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    appToast(`随机复习：${LV[c.level]} · ${c.title}`, 1800, "info");
  });

  const resetBtn = $("#psychReset");
  if (resetBtn) resetBtn.addEventListener("click", () => {
    if (!confirm("确定清空心理学的学习进度吗？（进阶库解锁状态也会重置）")) return;
    prog = {}; saveProg(prog); setTier2Unlocked(false); render();
    appToast("进度已重置", 1600, "warn");
  });

  // ---------- 每日练习：基于今日 3 张卡片动态生成 3 道题 ----------
  const QKEY = "wb_psych_quiz_v1";
  const QDAY_KEY = "wb_psych_quiz_day_v1";  // 记录 quizProg 属于哪一天，跨天自动清空
  function loadQuizProg() {
    try {
      const stored = JSON.parse(localStorage.getItem(QKEY)) || {};
      const lastDay = localStorage.getItem(QDAY_KEY);
      const today = String(daySeed());
      if (lastDay !== today) {
        // 跨天：清空旧答题记录（题目已换）
        localStorage.setItem(QKEY, "{}");
        localStorage.setItem(QDAY_KEY, today);
        return {};
      }
      return stored;
    } catch (e) { return {}; }
  }
  function saveQuizProg(q) { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch (e) {} }
  let quizProg = loadQuizProg();

  // 基于今日 pickDaily3() 的 3 张卡片，各生成一道选择题
  // 题干 = card.example（兜底 one）；选项 = 正确 title + 3 个干扰 title（打乱）
  // 解释 = card.concept + card.why
  function genDailyQuizzes() {
    const picks = pickDaily3();
    const all = CARDS();
    // 使用与 pickDaily3 不同的种子流，避免 shuffle 相关性
    const rng = mulberry32(daySeed() * 7 + 13);
    return picks.map(card => {
      const scenario = (card.example || card.one || "").trim();
      // 干扰项池：除本卡片外的所有 title
      const distractPool = all.filter(c => c.id !== card.id).map(c => c.title);
      // Fisher-Yates 抽 3 个干扰项
      for (let i = distractPool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [distractPool[i], distractPool[j]] = [distractPool[j], distractPool[i]];
      }
      const distract3 = distractPool.slice(0, 3);
      // 4 选项 + 打乱位置
      const opts = [card.title].concat(distract3);
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      const answer = opts.indexOf(card.title);
      // 解释：concept 主体 + why 补充
      let explain = (card.concept || "").trim();
      if (card.why) explain += "  原理：" + card.why.trim();
      const catName = (catMap[card.cat] || {}).name || "";
      return {
        id: "daily_" + card.id,
        cardId: card.id,
        cardTitle: card.title,
        catName,
        scenario,
        question: "以上场景最可能体现了下面哪个心理学原理？",
        options: opts,
        answer,
        explain
      };
    });
  }

  function renderQuiz() {
    const quizBox = $("#psychQuizList");
    if (!quizBox) return;
    const quizzes = genDailyQuizzes();
    if (!quizzes.length) { quizBox.innerHTML = ""; return; }
    const total = quizzes.length;
    const answered = quizzes.filter(q => quizProg[q.id] != null).length;
    const correct = quizzes.filter(q => quizProg[q.id] === q.answer).length;
    const pct = Math.round(answered / total * 100);
    const allDone = answered === total;

    const cardsHtml = quizzes.map((q, qi) => {
      const ans = quizProg[q.id];
      const opts = q.options.map((opt, i) => {
        let cls = "quiz-opt";
        if (ans != null) {
          if (i === q.answer) cls += " correct";
          else if (i === ans) cls += " wrong";
        }
        return `<button class="${cls}" data-q="${qi}" data-opt="${i}" type="button"${ans != null ? " disabled" : ""}>
          <span class="quiz-letter">${String.fromCharCode(65 + i)}</span>
          <span class="quiz-text">${escapeHtml(opt)}</span>
          ${ans != null && i === q.answer ? '<span class="quiz-mark">✓</span>' : ""}
          ${ans != null && i === ans && i !== q.answer ? '<span class="quiz-mark">✗</span>' : ""}
        </button>`;
      }).join("");
      const headRight = ans != null
        ? `✅ ${escapeHtml(q.cardTitle)}`
        : escapeHtml(q.catName || ("第 " + (qi + 1) + " 题"));
      return `<div class="quiz-card" data-qid="${q.id}">
        <div class="quiz-head">
          <span class="quiz-badge">📝 第 ${qi + 1} 题</span>
          <span class="quiz-count">${headRight}</span>
        </div>
        <div class="quiz-scenario">${escapeHtml(q.scenario)}</div>
        <div class="quiz-question">${escapeHtml(q.question)}</div>
        <div class="quiz-opts">${opts}</div>
        ${ans != null ? `
          <div class="quiz-explain">
            <div class="quiz-explain-t">${ans === q.answer ? "✅ 回答正确！" : "💡 正确答案：" + String.fromCharCode(65 + q.answer) + " · " + escapeHtml(q.cardTitle)}</div>
            <div class="quiz-explain-body">${escapeHtml(q.explain)}</div>
          </div>
        ` : ""}
      </div>`;
    }).join("");

    quizBox.innerHTML = `
      <div class="quiz-summary">
        <div class="quiz-summary-info">
          <span class="quiz-summary-label">今日 ${total} 题</span>
          <span class="quiz-summary-stat">已答 ${answered}/${total} · 答对 <strong>${correct}</strong></span>
        </div>
        <div class="quiz-summary-bar"><div class="quiz-summary-fill" style="width:${pct}%"></div></div>
      </div>
      ${cardsHtml}
      ${allDone ? `<div class="quiz-done">🎉 今日练习完成！正确率 ${correct}/${total}，明天再来挑战</div>` : ""}
    `;

    // 绑定选项点击
    quizBox.querySelectorAll(".quiz-opt").forEach(b => b.addEventListener("click", () => {
      const qi = parseInt(b.dataset.q);
      const choice = parseInt(b.dataset.opt);
      const q = quizzes[qi];
      if (!q || quizProg[q.id] != null) return;
      quizProg[q.id] = choice;
      saveQuizProg(quizProg);
      renderQuiz();
    }));
  }

  // 初始渲染
  renderChips();
  autoShowDaily();
  render();
  renderQuiz();
})();

/* ==========================================================================
   股票模块（自选股 · 行情 · 技术指标 · 持仓 · 复盘 · 舆情预警）
   数据源：东方财富 push2 / 新浪 hq.sinajs（A 股免费 JSON API，CORS 友好）
   存储：localStorage（自选股 / 持仓 / 复盘 / 预警阈值）
   ========================================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const appToast = window.appToast;  /* 复用全局 appToast */

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

  /* ---------- 拉实时行情（腾讯 qt.gtimg 批量接口）----------
     东财 push2 ulist.np 在部分网络返回 Empty reply（不可靠），改为腾讯 qt.gtimg。
     腾讯接口：https://qt.gtimg.cn/q=sh600519,sz000858,hk00700,usTSLA
     返回 v_xxx="...~..." 以 ~ 分隔，UTF-8 编码，A/港/美统一字段：
       [1]名称 [2]代码 [3]现价 [4]昨收 [5]今开 [6]成交量(手) [30]时间 [31]涨跌额 [32]涨跌幅 [33]最高 [34]最低
     无需 GBK 转码（腾讯返回 UTF-8），浏览器 fetch 可直接 decode。 */
  async function fetchQuotesBatch(items) {
    if (!items.length) return {};
    const qs = items.map(q => {
      if (q.market === "hk") return "hk" + q.code;
      if (q.market === "us") return "us" + q.code;
      return (/^(0|3)/.test(q.code) ? "sz" : "sh") + q.code;
    }).join(",");
    const url = `https://qt.gtimg.cn/q=${encodeURIComponent(qs)}`;
    try {
      const res = await fetch(url, { mode: "cors" });
      // qt.gtimg.cn 返回 GBK 编码字节；必须用 TextDecoder('gbk') 解密，
      // 否则股票中文名会乱码（fetch.text() 默认按 UTF-8 解释）。
      const buf = await res.arrayBuffer();
      const text = new TextDecoder("gbk").decode(buf);
      const map = {};
      const re = /v_(\w+)="([^"]*)"/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const code = m[1].replace(/^(sh|sz|hk|us)/, "");
        const f = m[2].split("~");
        const cur = +f[3] || 0;
        const chg = +f[31] || 0;
        const pct = +f[32] || 0;
        const pre = +f[4] || 0;
        const open = +f[5] || 0;
        const high = +f[33] || 0;
        const low = +f[34] || 0;
        // 若涨跌额/幅缺失（个别市场），用现价-昨收兜底
        const pctReal = (pct === 0 && pre > 0) ? ((cur - pre) / pre * 100) : pct;
        map[code] = { cur, pct: pctReal, chg: (chg === 0 && pre > 0) ? (cur - pre) : chg, name: f[1], high, low, open, pre };
      }
      return map;
    } catch (e) {
      console.warn("[stock] 行情拉取失败：", e);
      return {};
    }
  }

  /* ---------- 计算 MACD / RSI / MA（基于真实日线 K 线）----------
     数据源：腾讯 web.ifzq.gtimg.cn 前复权日线(qfqday)，UTF-8，稳定可用。
     接口：https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,day,,,90,qfq
     返回 data.{sym}.qfqday = [[日期,开,收,高,低,量], ...] 注意顺序 开/收/高/低。 */
  async function fetchKLineA(code, days = 90) {
    // 只支持 A 股日线（600/000/300/002/688 等）
    if (!/^\d{6}$/.test(code)) return [];
    const sym = (/^(0|3)/.test(code) ? "sz" : "sh") + code;
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${sym},day,,,${days},qfq`;
    try {
      const res = await fetch(url, { mode: "cors" });
      const json = await res.json();
      if (json.code !== 0 || !json.data) return [];
      const d = json.data[sym];
      const rows = (d && (d.qfqday || d.day)) || [];
      // rows 每项 [日期, 开, 收, 高, 低, 量] —— 取收(索引2)
      return rows.map(k => ({ day: k[0], open: +k[1], close: +k[2], high: +k[3], low: +k[4], vol: +k[5] }));
    } catch (e) { console.warn("[stock] K线拉取失败：", e); return []; }
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
  function calcSTD(closes, n) {
    if (closes.length < n) return null;
    const slice = closes.slice(-n);
    const mean = slice.reduce((a, b) => a + b, 0) / n;
    const v = slice.reduce((s, x) => s + (x - mean) * (x - mean), 0) / n;
    return Math.sqrt(v);
  }
  // BOLL 布林带（20 日均线 ± 2 倍标准差）
  function calcBOLL(closes) {
    if (closes.length < 20) return null;
    const mid = calcMA(closes, 20);
    const std = calcSTD(closes, 20);
    return { mid, up: mid + 2 * std, low: mid - 2 * std };
  }
  // KDJ 随机指标（9,3,3），需 high/low
  function calcKDJ(klines) {
    const n = 9;
    if (klines.length < n + 1) return null;
    let k = 50, d = 50;
    for (let i = 0; i < klines.length; i++) {
      const win = klines.slice(Math.max(0, i - n + 1), i + 1);
      const hh = Math.max(...win.map(x => x.high));
      const ll = Math.min(...win.map(x => x.low));
      const rsv = (hh - ll) === 0 ? 50 : ((klines[i].close - ll) / (hh - ll)) * 100;
      k = (2 / 3) * k + (1 / 3) * rsv;
      d = (2 / 3) * d + (1 / 3) * k;
    }
    const j = 3 * k - 2 * d;
    return { k, d, j };
  }
  // 支撑位 / 压力位：近 60 日高低点 + MA20 动态支撑
  function calcLevels(klines) {
    if (klines.length < 20) return null;
    const look = klines.slice(-60);
    const highs = look.map(x => x.high);
    const lows = look.map(x => x.low);
    const price = klines[klines.length - 1].close;
    const resist = Math.max(...highs);
    const support = Math.min(...lows);
    // 取 MA20 作为动态支撑参考
    const ma20 = calcMA(klines.map(x => x.close), 20);
    return { support, resist, ma20 };
  }
  // 量能研判：最近 5 日 vs 前 20 日均量
  function calcVolumeTrend(klines) {
    if (klines.length < 25) return null;
    const vols = klines.map(x => x.vol);
    const last5 = vols.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const prev20 = vols.slice(-25, -5).reduce((a, b) => a + b, 0) / 20;
    if (prev20 === 0) return null;
    return { ratio: last5 / prev20, last5, prev20 };
  }
  // 区间涨跌幅（近 5 / 20 日）
  function calcChgPct(closes, n) {
    if (closes.length < n + 1) return null;
    const base = closes[closes.length - 1 - n];
    const cur = closes[closes.length - 1];
    if (base === 0) return null;
    return (cur - base) / base * 100;
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
    /* 名称自动修正：如果自选股存的是占位名（A 股/港股/美股/空），用 API 返回的真实名覆盖 */
    let nameFixed = false;
    for (const q of quotes) {
      const d = data[q.code];
      if (d && d.name && (!q.name || /^(A 股|港股|美股|A股|)$/.test(q.name.trim()))) {
        q.name = d.name;
        nameFixed = true;
      }
    }
    if (nameFixed) lsSet(LS_KEYS.quotes, quotes);

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
    const klines = await fetchKLineA(code, 90);
    if (!klines.length) { body.innerHTML = `<div class="st-indi-empty">⚠️ 技术指标目前仅支持 A 股，请切换到 6 位 A 股代码</div>`; return; }
    const closes = klines.map(k => k.close);   // 收盘价序列
    const ma5 = calcMA(closes, 5);
    const ma20 = calcMA(closes, 20);
    const ma60 = calcMA(closes, 60);
    const macd = calcMACD(closes);
    const rsi = calcRSI(closes, 14);
    const last = closes[closes.length - 1];

    const sig = (label, val, judge, c) => {
      if (!c) {
        c = (judge.includes("超买") || judge.includes("多头") || judge.includes("金叉") || judge.includes("在上方") || judge.includes("放量") || judge.includes("强")) ? "st-up"
          : (judge.includes("超卖") || judge.includes("空头") || judge.includes("死叉") || judge.includes("在下方") || judge.includes("弱")) ? "st-down" : "st-flat";
      }
      return `<div class="st-indi-box"><div class="lbl">${label}</div><div class="val ${c}">${val}</div><div class="sig">${judge}</div></div>`;
    };

    // 简易信号
    const maSig = !ma5 || !ma20 ? "数据不足" :
      (last > ma5 && ma5 > ma20 ? "多头排列" : (last < ma5 && ma5 < ma20 ? "空头排列" : "震荡纠结"));
    const macdSig = !macd ? "数据不足" :
      (macd.dif > macd.dea && macd.macd > 0 ? "金叉·多头动能" : (macd.dif < macd.dea && macd.macd < 0 ? "死叉·空头动能" : "盘整待变"));
    const rsiSig = rsi == null ? "数据不足" :
      (rsi > alertCfg.rsiHi ? "超买区" : (rsi < alertCfg.rsiLo ? "超卖区" : "中性区间"));

    // —— 专业深度指标 ——
    const boll = calcBOLL(closes);
    const kdj = calcKDJ(klines);
    const lv = calcLevels(klines);
    const vt = calcVolumeTrend(klines);
    const chg5 = calcChgPct(closes, 5);
    const chg20 = calcChgPct(closes, 20);

    const sigColor = (s) => s.includes("超买") || s.includes("多头") || s.includes("金叉") || s.includes("在上方") ? "st-up"
      : (s.includes("超卖") || s.includes("空头") || s.includes("死叉") || s.includes("在下方") ? "st-down" : "st-flat");

    const bollSig = !boll ? "数据不足" : (last > boll.up ? "触及上轨·短线超买" : (last < boll.low ? "触及下轨·短线超卖" : "中轨区间运行"));
    const kdjSig = !kdj ? "数据不足" : (kdj.k > 80 || kdj.j > 100 ? "高位钝化·追高需谨慎" : (kdj.k < 20 ? "低位区域·超卖" : "中性区间"));
    const volSig = !vt ? "数据不足" : (vt.ratio > 1.5 ? "明显放量" : (vt.ratio > 1.1 ? "温和放量" : (vt.ratio < 0.7 ? "明显缩量" : "量能平稳")));

    body.innerHTML = `
      <div class="st-indi-grid">
        ${sig("现价", last.toFixed(2), "—")}
        ${sig("MA5", ma5 ? ma5.toFixed(2) : "--", maSig, sigColor(maSig))}
        ${sig("MA20", ma20 ? ma20.toFixed(2) : "--", maSig, sigColor(maSig))}
        ${sig("MA60", ma60 ? ma60.toFixed(2) : "--", ma60 ? (last > ma60 ? "在上方·强" : "在下方·弱") : "数据不足", sigColor(ma60 ? (last > ma60 ? "在上方·强" : "在下方·弱") : "数据不足"))}
        ${sig("MACD", macd ? `DIF ${macd.dif.toFixed(3)}` : "--", macdSig, sigColor(macdSig))}
        ${sig("RSI(14)", rsi != null ? rsi.toFixed(1) : "--", rsiSig, sigColor(rsiSig))}
        ${sig("BOLL", boll ? `中轨 ${boll.mid.toFixed(2)}` : "--", bollSig, sigColor(bollSig))}
        ${sig("KDJ", kdj ? `K ${kdj.k.toFixed(0)}` : "--", kdjSig, sigColor(kdjSig))}
        ${sig("量能", vt ? `×${vt.ratio.toFixed(2)}` : "--", volSig, sigColor(volSig))}
      </div>
      <svg class="st-indi-svg" viewBox="0 0 600 120" preserveAspectRatio="none" id="stKLineSvg"></svg>
      <div style="font-size:11px;color:var(--pink-dark);margin-top:6px;">最近 ${closes.length} 个交易日收盘价走势（简化图）· 数据源：腾讯前复权日线</div>
      ${buildStockAnalysis({
        last, ma5, ma20, ma60, macd, rsi, boll, kdj, lv, vt, chg5, chg20, closes,
        rsiHi: alertCfg.rsiHi, rsiLo: alertCfg.rsiLo
      })}
    `;
    drawKLine(closes);
  }

  /* ---------- 专业财经分析引擎 ---------- */
  // 综合趋势/动量/超买超卖/支撑压力/量能，输出结构化研判与操作建议
  function buildStockAnalysis(a) {
    const { last, ma5, ma20, ma60, macd, rsi, boll, kdj, lv, vt, chg5, chg20, rsiHi, rsiLo } = a;
    const items = [];

    // —— 1. 趋势研判 ——
    let trend, trendTxt;
    const bulls = (ma5 > ma20 ? 1 : 0) + (ma20 > ma60 ? 1 : 0) + (last > ma20 ? 1 : 0);
    const bears = (ma5 < ma20 ? 1 : 0) + (ma20 < ma60 ? 1 : 0) + (last < ma20 ? 1 : 0);
    if (bulls >= 2 && bears <= 1) { trend = "多头"; trendTxt = "均线呈多头排列（MA5>MA20>MA60），股价站上中期均线，中期趋势偏强，回踩不破 MA20 可视为强势整理。"; }
    else if (bears >= 2 && bulls <= 1) { trend = "空头"; trendTxt = "均线呈空头排列（MA5<MA20<MA60），股价运行于中期均线下方，中期趋势偏弱，反弹至均线附近或遇明显抛压。"; }
    else { trend = "震荡"; trendTxt = "均线交织、方向未明，股价在中期均线附近反复，市场处于多空平衡的箱体整理阶段，需等待方向性突破。"; }
    items.push({ icon: "📈", tag: "趋势研判", state: trend, txt: trendTxt, tone: trend === "多头" ? "up" : trend === "空头" ? "down" : "flat" });

    // —— 2. 动量（MACD）——
    let mom, momTxt;
    if (!macd) { mom = "数据不足"; momTxt = "K 线样本不足以计算 MACD，请保持自选股长期跟踪。"; }
    else if (macd.dif > macd.dea && macd.macd > 0) { mom = "多头动能"; momTxt = "DIF 位于 DEA 上方且 MACD 红柱为正，表明短线多头动能占优；若 DIF 由下向上穿越零轴，中期动量进一步确认。"; }
    else if (macd.dif < macd.dea && macd.macd < 0) { mom = "空头动能"; momTxt = "DIF 位于 DEA 下方且 MACD 绿柱为负，短线空头动能主导；需观察 DIF 能否上穿零轴以确认趋势转强。"; }
    else { mom = "动能收敛"; momTxt = "DIF 与 DEA 靠拢、柱体收窄，动能正在衰竭，通常对应盘整或变盘前兆，方向待突破确认。"; }
    items.push({ icon: "⚡", tag: "动量研判", state: mom, txt: momTxt, tone: mom === "多头动能" ? "up" : mom === "空头动能" ? "down" : "flat" });

    // —— 3. 超买超卖（RSI）——
    let os, osTxt;
    if (rsi == null) { os = "数据不足"; osTxt = "RSI 样本不足。"; }
    else if (rsi > rsiHi) { os = "超买"; osTxt = `RSI(${rsi.toFixed(1)}) 已高于 ${rsiHi}，短期买盘过热，存在回调或获利回吐压力，不宜盲目追高。`; }
    else if (rsi < rsiLo) { os = "超卖"; osTxt = `RSI(${rsi.toFixed(1)}) 已低于 ${rsiLo}，短期卖盘透支，存在技术性反弹需求，可关注企稳信号。`; }
    else { os = "中性"; osTxt = `RSI(${rsi.toFixed(1)}) 处于 ${rsiLo}-${rsiHi} 中性区间，多空力量相对均衡，短线方向不明朗。`; }
    items.push({ icon: "🧭", tag: "超买超卖", state: os, txt: osTxt, tone: os === "超买" ? "up" : os === "超卖" ? "down" : "flat" });

    // —— 4. 关键点位（支撑/压力）——
    let lvTxt, supportTxt, resistTxt;
    if (!lv) { lvTxt = "K 线样本不足以计算关键点位。"; supportTxt = "--"; resistTxt = "--"; }
    else {
      supportTxt = lv.support.toFixed(2);
      resistTxt = lv.resist.toFixed(2);
      lvTxt = `近 60 日低点 ${supportTxt} 为下方支撑，高点 ${resistTxt} 为上方压力；MA20（${lv.ma20.toFixed(2)}）为动态支撑/压力参考。当前价距支撑 ${Math.abs((last - lv.support) / last * 100).toFixed(1)}%，距压力 ${Math.abs((last - lv.resist) / last * 100).toFixed(1)}%。`;
    }
    items.push({ icon: "🎯", tag: "关键点位", state: `支撑 ${supportTxt} · 压力 ${resistTxt}`, txt: lvTxt, tone: "flat" });

    // —— 5. 量能配合 ——
    let vol, volTxt;
    if (!vt) { vol = "数据不足"; volTxt = "K 线样本不足以判断量能。"; }
    else if (vt.ratio > 1.5) { vol = "明显放量"; volTxt = `近 5 日均量约为前 20 日的 ${vt.ratio.toFixed(2)} 倍，量能显著放大。上涨放量确认突破有效性，下跌放量则警惕出货。`; }
    else if (vt.ratio < 0.7) { vol = "明显缩量"; volTxt = `近 5 日均量仅约为前 20 日的 ${vt.ratio.toFixed(2)} 倍，交投清淡、观望情绪浓，趋势延续性需谨慎看待。`; }
    else { vol = "量能平稳"; volTxt = `近 5 日均量约为前 20 日的 ${vt.ratio.toFixed(2)} 倍，量能维持常态，走势以存量博弈为主。`; }
    items.push({ icon: "📊", tag: "量能配合", state: vol, txt: volTxt, tone: vol === "明显放量" ? "up" : vol === "明显缩量" ? "flat" : "flat" });

    // —— 6. 区间表现 ——
    let chgTxt = "";
    const chgParts = [];
    if (chg5 != null) chgParts.push(`近 5 日 ${chg5 >= 0 ? "+" : ""}${chg5.toFixed(2)}%`);
    if (chg20 != null) chgParts.push(`近 20 日 ${chg20 >= 0 ? "+" : ""}${chg20.toFixed(2)}%`);
    if (chgParts.length) { chgTxt = `短线与中线区间表现：${chgParts.join("、")}。`; items.push({ icon: "🕐", tag: "区间表现", state: chgParts.join(" / "), txt: chgTxt, tone: (chg5 || 0) >= 0 ? "up" : "down" }); }

    // —— 综合打分（0-100）——
    let score = 50;
    score += bulls * 12; score -= bears * 12;              // 均线趋势 ±36
    if (macd) { if (macd.dif > macd.dea) score += 8; else score -= 8; if (macd.macd > 0) score += 6; else score -= 6; }
    if (rsi != null) { if (rsi > rsiHi) score -= 6; else if (rsi < rsiLo) score += 6; }
    if (vt) { if (vt.ratio > 1.3 && last > ma20) score += 5; if (vt.ratio > 1.3 && last < ma20) score -= 5; }
    score = Math.max(5, Math.min(95, score));

    const verdict = score >= 65 ? "偏多" : score <= 35 ? "偏空" : "中性";
    let action;
    if (score >= 65) action = "多头信号占优，可考虑逢回踩 MA20 / 支撑位分批低吸，仓位控制在可承受范围，跌破关键支撑需止损。";
    else if (score <= 35) action = "空头信号占优，宜轻仓或观望，等待企稳（缩量止跌 + MACD 金叉）后再介入，勿轻易抄底。";
    else action = "多空信号均衡、趋势未明，建议观望或轻仓试探，以突破压力位/跌破支撑位作为加减仓触发条件。";

    const risk = "以上基于技术面历史数据测算，未含基本面、消息面与宏观因素，技术信号存在滞后性与失效可能，不构成投资建议，据此操作风险自担。";

    return `
      <div class="st-anl">
        <div class="st-anl-head">📋 专业财经分析 <span class="st-anl-sub">综合 ${items.length} 个维度 · 技术面测算</span></div>
        <div class="st-anl-grid">
          ${items.map(it => `
            <div class="st-anl-card st-anl-${it.tone}">
              <div class="st-anl-card-tag">${it.icon} ${it.tag}</div>
              <div class="st-anl-state">${it.state}</div>
              <div class="st-anl-txt">${it.txt}</div>
            </div>`).join("")}
        </div>
        <div class="st-anl-score">
          <div class="st-anl-score-num" data-score="${score}" style="--s:${score}"></div>
          <div class="st-anl-score-info">
            <div class="st-anl-score-verdict">技术面综合评分 <b>${score}/100</b> · 倾向 <b class="st-anl-v-${verdict === '偏多' ? 'up' : verdict === '偏空' ? 'down' : 'flat'}">${verdict}</b></div>
            <div class="st-anl-score-bar"><span style="width:${score}%"></span></div>
            <div class="st-anl-score-txt">${action}</div>
          </div>
        </div>
        <div class="st-anl-risk">⚠️ ${risk}</div>
      </div>`;
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

  /* ---------- 搜索（本地字典即时匹配 + 腾讯/东财 suggest 全市场实时搜索）---------- */
  // 本地常用股字典（离线即时命中；全市场名称仍走在线搜索补全）
  const NAME_HINT = {
    // 白酒 / 消费
    "600519": "贵州茅台", "000858": "五粮液", "000568": "泸州老窖", "600809": "山西汾酒",
    "000596": "古井贡酒", "000799": "酒鬼酒", "600600": "青岛啤酒", "000895": "双汇发展",
    "603288": "海天味业", "600887": "伊利股份", "603043": "广州酒家",
    // 金融
    "601318": "中国平安", "000001": "平安银行", "600036": "招商银行", "601398": "工商银行",
    "601988": "中国银行", "601288": "农业银行", "601939": "建设银行", "600030": "中信证券",
    "600837": "海通证券", "601688": "华泰证券", "601166": "兴业银行", "600016": "民生银行",
    "600015": "华夏银行", "600000": "浦发银行",
    // 科技 / 制造 / 新能源
    "300750": "宁德时代", "002594": "比亚迪", "600900": "长江电力", "601012": "隆基绿能",
    "600276": "恒瑞医药", "000333": "美的集团", "000651": "格力电器", "600690": "海尔智家",
    "002415": "海康威视", "688981": "中芯国际", "688111": "金山办公",
    "300059": "东方财富", "600588": "用友网络", "002230": "科大讯飞", "600570": "恒生电子",
    "603986": "兆易创新", "300015": "爱尔眼科", "603259": "药明康德", "600196": "复星医药",
    "300760": "迈瑞医疗", "601899": "紫金矿业", "600028": "中国石化", "601857": "中国石油",
    "601088": "中国神华", "600309": "万华化学", "600438": "通威股份", "002475": "立讯精密",
    "000725": "京东方A", "002460": "赣锋锂业", "603501": "韦尔股份", "300124": "汇川技术",
    // 港股
    "00700": "腾讯控股", "09988": "阿里巴巴-W", "03690": "美团-W", "01024": "快手-W",
    "01810": "小米集团-W", "09618": "京东集团-SW", "09999": "网易-S", "09888": "百度集团-SW",
    "00388": "香港交易所", "02318": "中国平安", "01299": "友邦保险", "00941": "中国移动",
    "00788": "中国铁塔", "00005": "汇丰控股", "02828": "恒生指数ETF", "00939": "建设银行",
    // 美股
    "TSLA": "特斯拉", "AAPL": "苹果", "MSFT": "微软", "NVDA": "英伟达", "GOOGL": "谷歌",
    "GOOG": "谷歌A", "AMZN": "亚马逊", "META": "Meta", "NFLX": "奈飞", "AMD": "AMD",
    "INTC": "英特尔", "BABA": "阿里巴巴", "PDD": "拼多多", "JD": "京东", "NIO": "蔚来",
    "LI": "理想汽车", "XPEV": "小鹏汽车", "BIDU": "百度", "KO": "可口可乐", "PEP": "百事",
    "DIS": "迪士尼", "WMT": "沃尔玛", "PG": "宝洁", "JPM": "摩根大通", "BAC": "美国银行",
    "BA": "波音", "XOM": "埃克森美孚", "CVX": "雪佛龙", "ORCL": "甲骨文", "CRM": "Salesforce",
    "ADBE": "Adobe", "CSCO": "思科", "QCOM": "高通", "TXN": "德州仪器", "AVGO": "博通",
    "UBER": "Uber", "TSM": "台积电", "V": "Visa", "MA": "万事达", "PFE": "辉瑞",
    "JNJ": "强生", "MCD": "麦当劳", "SBUX": "星巴克", "COST": "好市多", "HD": "家得宝",
  };
  // 本地字典即时命中（离线可用，优先返回）
  // 名称匹配规则：股票名包含输入词（方向正确），支持全名/简称/部分词
  function nameMatch(n, q, u) {
    if (!n) return false;
    if (n === q) return true;
    const N = n.toUpperCase();
    if (N === u) return true;
    if (N.includes(u)) return true;        // 股票名包含输入词（茅台 → 贵州茅台）
    // 逐个词包含：输入多词时所有词都在股票名里（如"茅台股份"拆词）
    if (q.includes(" ") || q.includes("·") || q.includes("-")) {
      const parts = q.split(/[\s·\-]+/).filter(Boolean);
      if (parts.every(p => N.includes(p.toUpperCase()))) return true;
    }
    return false;
  }
  function searchLocal(q) {
    if (!q) return [];
    const u = q.trim().toUpperCase();
    const out = [];
    // 直接当 A 股代码（6 位数字，0/3/6 开头为沪深 A 股）
    if (/^\d{6}$/.test(u) && /^[036]/.test(u)) out.push({ code: u, name: NAME_HINT[u] || "", market: /^(0|3)/.test(u) ? "sz" : "sh" });
    // 名称反查（精确 → 包含），只取 A 股代码
    const qq = q.trim();
    Object.entries(NAME_HINT).forEach(([c, n]) => {
      if (out.some(x => x.code === c)) return;
      if (!/^\d{6}$/.test(c) || !/^[036]/.test(c)) return;   // 跳过港股(5位)/美股(字母)
      if (nameMatch(n, qq, u)) out.push({ code: c, name: n, market: detectMarket(c) });
    });
    return out.slice(0, 6);
  }
  // 把东财 suggest 结果转成自选条目（识别市场）
  function normalizeSuggest(s) {
    const market =
      s.Classify === "HK" ? "hk" :
      s.Classify === "US" ? "us" :
      s.SecurityTypeName && /美/.test(s.SecurityTypeName) ? "us" :
      s.SecurityTypeName && /港/.test(s.SecurityTypeName) ? "hk" :
      /^(0|3)/.test(s.Code) ? "sz" : "sh";
    return { code: s.Code, name: s.Name, market };
  }
  // 东财全市场搜索（JSONP 绕过 CORS；支持名称/拼音/代码）→ 只返回 A 股
  let _jsonpSeq = 0;
  function searchOnline(q) {
    return new Promise(resolve => {
      const cbName = "__stSrch_" + (++_jsonpSeq) + "_" + Date.now();
      const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(q.trim())}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=15&cb=${cbName}`;
      const script = document.createElement("script");
      let done = false;
      function cleanup() {
        if (done) return; done = true;
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[cbName] = function(json) {
        cleanup();
        const rows = (json && json.QuotationCodeTable && json.QuotationCodeTable.Data) || [];
        const aStocks = rows
          .filter(r => r.Classify === "AStock")          // 只取 A 股
          .slice(0, 12)
          .map(normalizeSuggest);
        resolve(aStocks);
      };
      script.onerror = function() { cleanup(); resolve([]); };
      setTimeout(function() { cleanup(); resolve([]); }, 6000);   // 6s 超时兜底
      script.src = url;
      document.head.appendChild(script);
    });
  }
  let searchSeq = 0;   // 防竞态：只渲染最后一次请求
  function renderSearchResult(q) {
    const box = $("#stSearchResult");
    if (!q) { box.innerHTML = ""; return; }
    // 1) 本地字典即时命中
    const local = searchLocal(q);
    // 2) 在线搜索（异步）
    const my = ++searchSeq;
    const u = q.toUpperCase();
    box.innerHTML = `<span class="st-searching">🔍 正在搜索「${q}」...</span>`;
    searchOnline(q).then(online => {
      if (my !== searchSeq) return;            // 已被更新的输入覆盖
      // 合并：本地优先，在线去重补全
      const seen = new Set(local.map(x => x.market + "|" + x.code));
      const all = [...local];
      online.forEach(o => {
        const k = o.market + "|" + o.code;
        if (!seen.has(k)) { seen.add(k); all.push(o); }
      });
      if (!all.length) {
        box.innerHTML = `<span class="st-hint-inline">无匹配 A 股，试试输入名称（如 茅台）或代码（如 600519）</span>`;
        return;
      }
      const mt = { sh: "沪", sz: "深" };
      box.innerHTML = all.map(a => {
        const inSel = quotes.some(x => x.code === a.code);
        return `<span class="st-search-chip ${inSel ? "st-chip-done" : ""}" data-add="${a.code}" data-name="${a.name}" data-mkt="${a.market}">
          <span class="st-chip-mkt">${mt[a.market] || "A"}</span>${a.name} <b>${a.code}</b> ${inSel ? "✓" : "+"}
        </span>`;
      }).join("");
      $$(".st-search-chip", box).forEach(chip => {
        chip.addEventListener("click", () => addQuote(chip.getAttribute("data-add"), chip.getAttribute("data-name"), chip.getAttribute("data-mkt")));
      });
    });
  }
  // 把用户输入解析成 {code, name, market}——本地字典 + 在线兜底
  function resolveInputToCode(v) {
    if (!v) return null;
    const u = v.toUpperCase();
    // 1) 直接就是 A 股代码（6 位数字，0/3/6 开头）
    if (/^\d{6}$/.test(u) && /^[036]/.test(u)) return { code: u, name: NAME_HINT[u] || "", market: /^(0|3)/.test(u) ? "sz" : "sh" };
    // 2) 名称反查本地字典（仅 A 股）：精确 > 包含
    const qq = v.trim();
    const all = Object.entries(NAME_HINT).filter(([c]) => /^\d{6}$/.test(c) && /^[036]/.test(c));
    let exact = all.find(([c, n]) => n === qq || n.toUpperCase() === u);
    if (exact) return { code: exact[0], name: exact[1], market: detectMarket(exact[0]) };
    let partial = all.find(([c, n]) => nameMatch(n, qq, u));
    if (partial) return { code: partial[0], name: partial[1], market: detectMarket(partial[0]) };
    return null;   // 非本地字典名称 → 交给在线搜索 chips
  }
  function addQuote(code, name, market) {
    if (quotes.find(q => q.code === code)) { appToast("已在自选股中", 1600, "info"); return; }
    const m = market || detectMarket(code);
    if (!m) { appToast("无法识别该股票的市场", 2200, "warn"); return; }
    const realName = NAME_HINT[code];
    const placeholder = realName || (m === "hk" ? "港股" : m === "us" ? "美股" : "A 股");
    const q = { code, name: name || placeholder, market: m };
    quotes.push(q);
    lsSet(LS_KEYS.quotes, quotes);
    $("#stSearchResult").innerHTML = "";
    $("#stSearchInput").value = "";
    appToast(`已加入自选：${q.name === placeholder ? code : q.name}`, 1800, "ok");
    renderQuotes();
    renderIndiSel();
    /* 如果存的是占位名，异步拉取真实名称并回写存储 + 重渲染 */
    // 搜索/解析通常已提供真实中文名，仅当确为占位占位或空名、且本地字典也查不到时才需回源补名
    const needName = !name || !realName || /^(A 股|港股|美股|A股|)$/.test(q.name.trim());
    if (needName && (name || !NAME_HINT[code])) {
      fetchQuotesBatch([q]).then(map => {
        const d = map[q.code];
        if (d && d.name) {
          q.name = d.name;
          lsSet(LS_KEYS.quotes, quotes);
          renderQuotes();
          renderIndiSel();
        }
      });
    }
  }

  // 通用 JSONP 请求（东财 push2 接口 fetch 不稳定时的兜底）———— 复用 _jsonpSeq
  function jsonpFetch(urlBase, parseFn, timeoutMs = 8000) {
    return new Promise(resolve => {
      const cbName = "__stJp_" + (++_jsonpSeq) + "_" + Date.now();
      const url = urlBase + (urlBase.includes("?") ? "&" : "?") + "cb=" + cbName;
      const script = document.createElement("script");
      let done = false;
      function cleanup() {
        if (done) return; done = true;
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[cbName] = function(json) {
        cleanup();
        try { resolve(parseFn(json)); } catch (e) { resolve([]); }
      };
      script.onerror = function() { cleanup(); resolve([]); };
      setTimeout(function() { cleanup(); resolve([]); }, timeoutMs);
      script.src = url;
      document.head.appendChild(script);
    });
  }

  /* ========== 指数概览：沪深创科 + 资金流向 + 成交额 ==========
     数据源：东财 push2 ulist.np（浏览器 fetch CORS 可用）
     secids: 1.000001 上证指数 / 0.399001 深证成指 / 0.399006 创业板指 / 1.000688 科创50
     f3 涨跌幅 f6 成交额(元) f12 代码 f14 名称 f62 主力净流入 f66 超大单净流入
     f69 超大单占比 f184 主力净流入占比 */
  const INDEX_SECIDS = {
    "1.000001":  { name: "上证指数", code: "000001" },
    "0.399001":  { name: "深证成指", code: "399001" },
    "0.399006":  { name: "创业板指", code: "399006" },
    "1.000688":  { name: "科创50",   code: "000688" }
  };
  async function fetchIndexData() {
    const secids = Object.keys(INDEX_SECIDS).join(",");
    const fields = "f2,f3,f4,f6,f12,f14,f62,f66,f69,f72,f75,f78,f184";
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids}&fields=${fields}&fltt=2&invt=2`;
    const parseRows = (json) => {
      if (json && json.data && Array.isArray(json.data.diff)) return json.data.diff;
      if (json && json.data && json.data.diff && !Array.isArray(json.data.diff)) return [json.data.diff];
      return [];
    };
    try {
      const res = await fetch(url, { mode: "cors" });
      return parseRows(await res.json());
    } catch (e) {
      console.warn("[stock] 指数 fetch 失败，尝试 JSONP：", e.message);
      return jsonpFetch(url, parseRows);
    }
  }
  function renderIndex() {
    const list = $("#stIndexList");
    const loading = $("#stIndexLoading");
    if (!list) return;
    const idx = INDEX_SECIDS;
    const secidByName = {};
    Object.keys(idx).forEach(s => { secidByName[idx[s].name] = s; });
    if (loading) loading.style.display = "block";
    fetchIndexData().then(rows => {
      if (loading) loading.style.display = "none";
      if (!rows.length) {
        list.innerHTML = `<div class="st-board-empty">指数数据暂不可用，请稍后重试</div>`;
        return;
      }
      // 组装成规范对象
      const items = rows.map(r => {
        const secid = String(r.f12 || "").length >= 6 && Object.keys(idx).find(s => s.endsWith(r.f12))
                      || (r.f12 === "000001" ? "1.000001" : null) || (r.f12 === "399001" ? "0.399001" : null)
                      || (r.f12 === "399006" ? "0.399006" : null) || (r.f12 === "000688" ? "1.000688" : "");
        return {
          name: r.f14 || idx[secid]?.name || r.f12,
          code: r.f12,
          cur: r.f2, chg: r.f4, pct: r.f3,
          amount: r.f6,            // 成交额（元）
          main: r.f62,             // 主力净流入（元）
          mainPct: r.f184,         // 主力净流入占比 %
        };
      });
      list.innerHTML = items.map(it => {
        const cls = it.pct > 0 ? "up" : it.pct < 0 ? "down" : "flat";
        const pctS = (it.pct == null || isNaN(it.pct)) ? "--" : (it.pct > 0 ? "+" : "") + it.pct.toFixed(2) + "%";
        const chgS = (it.chg == null || isNaN(it.chg)) ? "--" : (it.chg > 0 ? "+" : "") + it.chg.toFixed(2);
        const amtS = fmtMoney(it.amount);
        const mainS = fmtMoney(it.main);
        const mainPctS = (it.mainPct == null || isNaN(it.mainPct)) ? "--" : (it.mainPct > 0 ? "+" : "") + it.mainPct.toFixed(1) + "%";
        const mainColor = (it.main == null || it.main === 0) ? "flat" : (it.main > 0 ? "up" : "down");
        return `<div class="st-index-card3">
          <div class="st-index-top">
            <div class="st-index-badge st-${cls}">${pctS}</div>
            <div class="st-index-nm">
              <div class="st-index-name">${it.name}</div>
              <div class="st-index-code">${it.code}</div>
            </div>
          </div>
          <div class="st-index-price st-${cls}">${(it.cur==null||isNaN(it.cur))?"--":it.cur.toFixed(2)}</div>
          <div class="st-index-meta">
            <div class="st-index-amt"><label>成交额</label><span>${amtS}</span></div>
            <div class="st-index-main st-${mainColor}"><label>主力净流入</label><span>${mainS} <em>${mainPctS}</em></span></div>
          </div>
        </div>`;
      }).join("");
    });
  }
  function fmtMoney(v) {
    if (v == null || isNaN(v) || v === 0) return "--";
    const a = Math.abs(v), sign = v < 0 ? "-" : "";
    if (a >= 1e12) return sign + (a / 1e12).toFixed(2) + "万亿";
    if (a >= 1e8)  return sign + (a / 1e8).toFixed(2) + "亿";
    if (a >= 1e4)  return sign + (a / 1e4).toFixed(2) + "万";
    return sign + a.toFixed(0);
  }

  /* ========== 行业板块涨跌幅排行 + 领涨股加入自选 ==========
     数据源：东财 push2 clist 行业板块 Top10（fs=m:90+t:2）
     f3 板块涨幅 f6 板块成交额 f14 板块名 f62 板块主力净流入 f184 主力占比
     领涨股：f128 名称 f140 代码 f136 涨幅；f141 市场标记(0/1 需结合代码判断) */
  async function fetchBoards(pz = 10) {
    const fields = "f2,f3,f4,f6,f8,f12,f14,f62,f184,f128,f136,f140,f141";
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${pz}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=${fields}`;
    const parseRows = (json) => {
      if (json && json.data && Array.isArray(json.data.diff)) return json.data.diff;
      if (json && json.data && json.data.diff && !Array.isArray(json.data.diff)) return [json.data.diff];
      return [];
    };
    try {
      const res = await fetch(url, { mode: "cors" });
      return parseRows(await res.json());
    } catch (e) {
      console.warn("[stock] 板块 fetch 失败，尝试 JSONP：", e.message);
      return jsonpFetch(url, parseRows);
    }
  }
  // 根据领涨股代码判断市场（字母 LSHB 前缀→去掉；数字开头按 A 股规则）
  function leaderMarketOf(code) {
    if (!code) return "a";
    let c = String(code);
    c = c.replace(/^(SH|SZ|HK|US)/i, "");
    if (/^\d{6}$/.test(c)) return "a";
    if (/^\d{5}$/.test(c)) return "hk";
    return "a";
  }
  function renderBoards() {
    const list = $("#stBoardList");
    const loading = $("#stBoardLoading");
    if (!list) return;
    if (loading) loading.style.display = "block";
    fetchBoards(30).then(rows => {
      if (loading) loading.style.display = "none";
      if (!rows.length) {
        list.innerHTML = `<div class="st-board-empty">板块数据暂不可用，请稍后重试</div>`;
        return;
      }
      // 按涨跌幅排序，生成热力图瓦片
      rows.sort((a, b) => (b.f3 || -999) - (a.f3 || -999));
      const maxAbs = Math.max(...rows.map(r => Math.abs(r.f3 || 0)), 1);
      list.innerHTML = rows.map(b => {
        const pct = b.f3;
        const pctS = (pct==null||isNaN(pct)) ? "--" : (pct>0?"+":"") + pct.toFixed(2) + "%";
        const intensity = Math.min(1, Math.abs(pct || 0) / maxAbs); // 0~1
        const cls = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
        const leaderName = b.f128 || "";
        const leaderCode = b.f140 || "";
        // 热力图色阶强度: opacity 0.15 ~ 0.85
        const opacity = (0.15 + intensity * 0.7).toFixed(2);
        return `<div class="st-tile st-tile-${cls}" style="--tile-opacity:${opacity}" data-code="${leaderCode}" data-name="${leaderName}">
          <div class="st-tile-pct">${pctS}</div>
          <div class="st-tile-name">${b.f14||"--"}</div>
          ${leaderName ? `<div class="st-tile-leader">${leaderName}</div>` : ""}
        </div>`;
      }).join("");
      // 点击瓦片→领涨股加入自选
      list.querySelectorAll(".st-tile").forEach(tile => {
        tile.addEventListener("click", () => {
          const code = tile.getAttribute("data-code");
          const nm = tile.getAttribute("data-name");
          if (!code) { appToast("该板块暂无领涨股", 1800, "warn"); return; }
          addQuote(code, nm === "--" ? "" : nm, leaderMarketOf(code));
        });
      });
    });
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    $("#stSearchBtn").addEventListener("click", () => renderSearchResult($("#stSearchInput").value.trim()));
    $("#stSearchInput").addEventListener("input", e => renderSearchResult(e.target.value.trim()));
    $("#stSearchInput").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        const v = $("#stSearchInput").value.trim();
        const resolved = resolveInputToCode(v);
        if (resolved) addQuote(resolved.code, resolved.name);
        else renderSearchResult(v);
      }
    });
    $("#stAddByCode").addEventListener("click", () => {
      const v = $("#stSearchInput").value.trim();
      if (!v) { renderSearchResult(""); return; }
      const resolved = resolveInputToCode(v);
      if (resolved) {
        addQuote(resolved.code, resolved.name);
      } else {
        // 不是代码也不是已知名称 → 提示去搜索结果里选
        renderSearchResult(v);
        const hint = $("#stSearchHint");
        if (hint) { hint.textContent = "未识别，请从下方候选里点 + 或输入代码"; setTimeout(() => { hint.textContent = "支持 A 股名称（如 茅台）或代码（如 600519）"; }, 3500); }
      }
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
      if (!t.code || !t.price || !t.qty) { appToast("请填写代码、价格、数量", 2400, "warn"); return; }
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
      appToast("✅ 阈值已保存", 1800, "ok");
    });

    /* ========== 尾盘选股：尾盘涨幅 + 量比/换手/市值 + 全天跑赢大盘 ==========
       第一步：clist 全A股初筛（量比>1 / 换手5-10% / 市值50-200亿 / 日涨幅≥1%）
       第二步：trends2 分时数据 → 尾盘(14:30→15:00)整段时间当日涨幅保持 3%-5%
       第三步：个股分时全天走势 vs 上证综指 → 筛选跑赢大盘（≥60%时间跑赢） */

    let _screenResults = [];
    let _screenRunning = false;

    function getSecId(code) {
      return (code.startsWith("6") ? "1." : "0.") + code;
    }

    /* ---- Step 1: clist 全市场初筛（量比/换手/市值，涨幅放宽后续精筛） ---- */
    async function fetchScreenCandidates() {
      const url = "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5000&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f8,f10,f12,f14,f21";
      const parse = (json) => {
        if (json && json.data && Array.isArray(json.data.diff)) return json.data.diff;
        return [];
      };
      const rows = await jsonpFetch(url, parse);
      return rows.filter(function(s) {
        var chg = parseFloat(s.f3) || 0;
        var volRatio = parseFloat(s.f10) || 0;
        var turnover = parseFloat(s.f8) || 0;
        var circMv = (parseFloat(s.f21) || 0) / 1e8;
        /* 初筛放宽涨幅至 ≥1%，后续用 14:30→收盘 精确涨幅 3-5% 筛选 */
        return chg >= 1 && volRatio > 1 && turnover >= 5 && turnover <= 10 && circMv >= 50 && circMv <= 200;
      }).map(function(s) {
        return {
          code: s.f12, name: s.f14,
          dayChg: parseFloat(s.f3) || 0,
          volRatio: parseFloat(s.f10) || 0,
          turnover: parseFloat(s.f8) || 0,
          circMv: (parseFloat(s.f21) || 0) / 1e8,
          price: parseFloat(s.f2) || 0
        };
      });
    }

    /* ---- Step 2: trends2 分时 → 尾盘(14:30→15:00)整段时间内当日涨幅保持 3%-5% ---- */
    /* 注意：这里衡量的是「相对昨收的当日涨跌幅」在整个尾盘时间段一直落在 3%-5% 区间内，
     * 而非「尾盘段内的价格变化」。即 14:30 起每个时刻的 (price - preClose)/preClose 都 ∈ [3%,5%]。 */
    async function validateTailRise(candidates) {
      var passed = [];
      var batchSize = 8;
      var total = candidates.length;
      var statusEl = $("#stScreenStatus");

      for (var i = 0; i < total; i += batchSize) {
        var batch = candidates.slice(i, i + batchSize);
        var promises = batch.map(function(c) {
          var secid = getSecId(c.code);
          var url = "https://push2.eastmoney.com/api/qt/stock/trends2/get?secid=" + secid +
            "&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13" +
            "&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&ndays=1";
          return jsonpFetch(url, function(json) {
            if (!json || !json.data || !json.data.trends) return null;
            return { candidate: c, trends: json.data.trends, preClose: parseFloat(json.data.preClose) || 0 };
          });
        });
        var results = await Promise.all(promises);

        for (var j = 0; j < results.length; j++) {
          var r = results[j];
          if (!r || !r.trends || !r.trends.length || !r.preClose) continue;

          /* 分时数据格式："2026-08-05 14:30,price,avg,..."
           * 收集 14:30(含) 之后所有点的价格，逐个计算相对昨收的当日涨幅，
           * 要求所有点都落在 3%-5% 区间内 */
          var tailPrices = [];
          for (var k = 0; k < r.trends.length; k++) {
            var timeStr = r.trends[k].split(",")[0];
            var hhmm = timeStr.split(" ")[1] || "";
            if (hhmm >= "14:30") {
              var px = parseFloat(r.trends[k].split(",")[1]) || 0;
              if (px) tailPrices.push(px);
            }
          }
          /* 需要至少覆盖到收盘点，才算有完整尾盘段 */
          if (tailPrices.length < 2) continue;

          /* 逐点检查：相对昨收的当日涨幅必须一直∈[3%,5%] */
          var inRange = true;
          var pctMin = Infinity, pctMax = -Infinity;
          for (var m = 0; m < tailPrices.length; m++) {
            var pct = (tailPrices[m] - r.preClose) / r.preClose * 100;
            if (pct < pctMin) pctMin = pct;
            if (pct > pctMax) pctMax = pct;
            if (pct < 3 || pct > 5) { inRange = false; break; }
          }
          if (!inRange) continue;

          /* 用收盘点的当日涨幅作为该股的代表涨幅 */
          var closePrice = tailPrices[tailPrices.length - 1];
          var tailRise = (closePrice - r.preClose) / r.preClose * 100;

          r.candidate.tailRise = tailRise;
          r.candidate.tailStart = (tailPrices[0] - r.preClose) / r.preClose * 100;
          r.candidate.tailEnd = (tailPrices[tailPrices.length - 1] - r.preClose) / r.preClose * 100;
          passed.push(r.candidate);
        }

        if (statusEl) statusEl.innerHTML = "<span class=\"st-screen-spin\"></span> 尾盘涨幅(14:30-15:00 保持 3-5%)验证中 "
          + Math.min(i + batchSize, total) + "/" + total + "，已通过 " + passed.length + " 只…";
      }

      return passed;
    }

    /* ---- Step 3: 分时走势全天 vs 上证综指 → 跑赢大盘 ---- */
    async function validateVsIndex(tailPassed) {
      if (!tailPassed.length) return [];
      var statusEl = $("#stScreenStatus");
      if (statusEl) statusEl.innerHTML = "<span class=\"st-screen-spin\"></span> 正在获取上证综指分时走势…";

      /* 获取上证综指分时 */
      var idxData = await jsonpFetch(
        "https://push2.eastmoney.com/api/qt/stock/trends2/get?secid=1.000001&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&ndays=1",
        function(json) {
          if (!json || !json.data || !json.data.trends) return null;
          return { trends: json.data.trends, preClose: parseFloat(json.data.preClose) || 0 };
        }
      );

      var idxReturns = [];
      if (idxData && idxData.trends && idxData.trends.length && idxData.preClose) {
        idxReturns = idxData.trends.map(function(line) {
          return (parseFloat(line.split(",")[1]) - idxData.preClose) / idxData.preClose;
        });
      }

      var finalResults = [];
      var batchSize = 8;
      var total = tailPassed.length;

      for (var i = 0; i < total; i += batchSize) {
        var batch = tailPassed.slice(i, i + batchSize);
        var promises = batch.map(function(s) {
          var secid = getSecId(s.code);
          return jsonpFetch(
            "https://push2.eastmoney.com/api/qt/stock/trends2/get?secid=" + secid + "&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&ndays=1",
            function(json) {
              if (!json || !json.data || !json.data.trends) return Object.assign({}, s, { trendsData: null });
              return Object.assign({}, s, { trendsData: { trends: json.data.trends, preClose: parseFloat(json.data.preClose) || 0 } });
            }
          );
        });
        var results = await Promise.all(promises);

        for (var j = 0; j < results.length; j++) {
          var r = results[j];
          if (!r) continue;
          var stk = Object.assign({}, r);
          delete stk.trendsData;

          if (!r.trendsData || !r.trendsData.trends.length || !r.trendsData.preClose || !idxReturns.length) {
            stk.vsIndex = "--";
            stk.vsPct = 0;
            finalResults.push(stk);
            continue;
          }

          var stockReturns = r.trendsData.trends.map(function(line) {
            return (parseFloat(line.split(",")[1]) - r.trendsData.preClose) / r.trendsData.preClose;
          });

          var minLen = Math.min(stockReturns.length, idxReturns.length);
          var beatCount = 0;
          for (var k = 0; k < minLen; k++) {
            if (stockReturns[k] >= idxReturns[k] - 0.001) beatCount++;
          }
          var beatPct = minLen > 0 ? beatCount / minLen : 0;
          stk.vsIndex = beatPct >= 0.6 ? "跑赢" : beatPct >= 0.45 ? "基本" : "跑输";
          stk.vsPct = beatPct;
          finalResults.push(stk);
        }

        if (statusEl) statusEl.innerHTML = "<span class=\"st-screen-spin\"></span> 对比大盘中 "
          + Math.min(i + batchSize, total) + "/" + total + "，已通过 " + finalResults.length + " 只…";
      }

      /* 只保留跑赢大盘的（≥60%） */
      return finalResults.filter(function(s) { return s.vsPct >= 0.6; });
    }

    async function screenStocks() {
      if (_screenRunning) return;
      _screenRunning = true;
      var statusEl = $("#stScreenStatus");
      var resultsEl = $("#stScreenResults");
      var btn = $("#stScreenBtn");
      if (btn) { btn.disabled = true; btn.textContent = "筛选中…"; }
      if (statusEl) statusEl.innerHTML = "<span class=\"st-screen-spin\"></span> 正在获取全市场股票数据…";
      if (resultsEl) resultsEl.innerHTML = "";

      try {
        // Step 1: clist 初筛（量比/换手/市值）
        var candidates = await fetchScreenCandidates();
        if (!candidates.length) {
          if (statusEl) statusEl.innerHTML = "<span class=\"st-screen-empty\">暂无符合条件的股票（量比>1 / 换手5-10% / 市值50-200亿）</span>";
          _screenRunning = false;
          if (btn) { btn.disabled = false; btn.textContent = "开始选股"; }
          return;
        }
        if (statusEl) statusEl.innerHTML = "<span class=\"st-screen-spin\"></span> 初筛通过 " + candidates.length + " 只，正在获取分时数据计算尾盘涨幅…";

        // Step 2: 尾盘段（14:30→收盘）涨幅 3-5% 精确筛选
        var tailPassed = await validateTailRise(candidates);
        if (!tailPassed.length) {
          if (statusEl) statusEl.innerHTML = "<span class=\"st-screen-empty\">尾盘(14:30-15:00)整段时间涨幅未保持在 3-5%，暂无符合条件的股票</span>";
          _screenRunning = false;
          if (btn) { btn.disabled = false; btn.textContent = "开始选股"; }
          return;
        }
        if (statusEl) statusEl.innerHTML = "<span class=\"st-screen-spin\"></span> 尾盘涨幅通过 " + tailPassed.length + " 只，正在对比当日分时是否跑赢大盘…";

        // Step 3: 全天分时 vs 上证综指（跑赢大盘）
        var finalResults = await validateVsIndex(tailPassed);
        _screenResults = finalResults;
        renderScreenResults(finalResults);

        if (statusEl) {
          if (finalResults.length) {
            statusEl.innerHTML = "✅ 选股完成，共 " + finalResults.length + " 只（" + new Date().toLocaleTimeString() + "）";
          } else {
            statusEl.innerHTML = "<span class=\"st-screen-empty\">无股票同时满足所有条件</span>";
          }
        }
      } catch (e) {
        if (statusEl) statusEl.innerHTML = "<span class=\"st-screen-err\">选股出错：" + e.message + "</span>";
        console.error("[screen] error:", e);
      } finally {
        _screenRunning = false;
        if (btn) { btn.disabled = false; btn.textContent = "开始选股"; }
      }
    }

    function renderScreenResults(results) {
      var el = $("#stScreenResults");
      if (!el) return;
      if (!results || !results.length) {
        el.innerHTML = "";
        return;
      }

      var sorted = results.slice().sort(function(a, b) { return b.tailRise - a.tailRise; });
      var fmtMv = function(mv) { return mv >= 100 ? Math.round(mv) + "亿" : mv.toFixed(1) + "亿"; };
      var fmtPct = function(v) { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; };
      var vsClass = function(label) {
        if (label === "跑赢") return "st-up";
        if (label === "跑输") return "st-down";
        return "";
      };

      el.innerHTML = '<div class="st-screen-table">'
        + '<div class="st-screen-head">'
        + '<span class="col-code">代码</span>'
        + '<span class="col-name">名称</span>'
        + '<span class="col-chg">尾盘涨</span>'
        + '<span class="col-daychg">日涨</span>'
        + '<span class="col-vol">量比</span>'
        + '<span class="col-turn">换手</span>'
        + '<span class="col-mv">市值</span>'
        + '<span class="col-vs">跑赢大盘</span>'
        + '<span class="col-act">操作</span>'
        + '</div>'
        + sorted.map(function(s) {
          return '<div class="st-screen-row" data-code="' + s.code + '">'
            + '<span class="col-code">' + s.code + '</span>'
            + '<span class="col-name">' + s.name + '</span>'
            + '<span class="col-chg st-up">' + fmtPct(s.tailRise) + '</span>'
            + '<span class="col-daychg st-up">' + fmtPct(s.dayChg) + '</span>'
            + '<span class="col-vol">' + s.volRatio.toFixed(2) + '</span>'
            + '<span class="col-turn">' + s.turnover.toFixed(2) + '%</span>'
            + '<span class="col-mv">' + fmtMv(s.circMv) + '</span>'
            + '<span class="col-vs ' + vsClass(s.vsIndex) + '">' + s.vsIndex + " " + Math.round(s.vsPct * 100) + '%</span>'
            + '<span class="col-act"><button class="st-sc-add" data-code="' + s.code + '" data-name="' + s.name + '">＋自选</button></span>'
            + '</div>';
        }).join("")
        + '</div>';

      // 绑定"加入自选"按钮
      el.querySelectorAll(".st-sc-add").forEach(function(btn) {
        btn.addEventListener("click", function() {
          var code = this.dataset.code;
          var name = this.dataset.name;
          var exists = quotes.find(function(q) { return q.code === code; });
          if (exists) {
            appToast(name + " 已在自选中", 1800, "info");
            return;
          }
          addQuote({ code: code, name: name || code });
          appToast("✅ 已加入自选：" + name, 2000, "ok");
        });
      });
    }

    // 绑定"开始选股"按钮
    $("#stScreenBtn").addEventListener("click", screenStocks);

    /* ---- 自动选股：从 WORKBENCH_DATA.stockScreen 加载今日结果 ---- */
    function loadAutoScreen() {
      if (_screenResults && _screenResults.length) return; // 用户已手动跑过，不覆盖
      var ss = (window.WORKBENCH_DATA && window.WORKBENCH_DATA.stockScreen) || null;
      if (!ss || !ss.date) return;
      // 只加载今天的数据
      var now = new Date();
      var today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
      if (ss.date !== today) return;

      if (ss.results && ss.results.length) {
        _screenResults = ss.results;
        renderScreenResults(ss.results);
        var statusEl = $("#stScreenStatus");
        if (statusEl) {
          statusEl.innerHTML = "📋 <strong>自动选股</strong>（" + (ss.time || "") + "）共 " + ss.count + " 只"
            + ' · <button id="stReScreen" class="st-rescreen-btn">重新手动选股</button>';
          var reBtn = $("#stReScreen");
          if (reBtn) reBtn.addEventListener("click", function() {
            _screenResults = [];
            if (statusEl) statusEl.innerHTML = "";
            screenStocks();
          });
        }
      } else {
        // 今日已自动选股但无结果
        var statusEl2 = $("#stScreenStatus");
        if (statusEl2) {
          statusEl2.innerHTML = "📋 <strong>自动选股</strong>（" + (ss.time || "") + "）" + (ss.note || "无符合条件股票")
            + ' · <button id="stReScreen2" class="st-rescreen-btn">重新手动选股</button>';
          var reBtn2 = $("#stReScreen2");
          if (reBtn2) reBtn2.addEventListener("click", function() {
            _screenResults = [];
            if (statusEl2) statusEl2.innerHTML = "";
            screenStocks();
          });
        }
      }
    }

    loadAutoScreen();

    // 监听侧边栏切到 stock 时刷新
    const link = document.querySelector('.menu a[data-page="stock"]');
    if (link) link.addEventListener("click", () => {
      setTimeout(() => { renderIndex(); renderBoards(); renderScreenResults(_screenResults); renderQuotes(); renderIndiSel(); renderTrades(); renderReviews(); renderNews(); }, 50);
    });
  }

  bind();
  renderIndiSel();
  // 初次进入不渲染行情，等切到页面再拉
  // 每 30 秒自动刷新一次自选股行情（保持最新涨跌），页面在后台时不打扰
  setInterval(() => {
    if (document.hidden) return;             // 页面在后台则不打扰
    if (!document.getElementById("stQuoteList")) return;
    renderIndex();                            // 指数概览持续刷新
    renderBoards();                           // 行业板块持续刷新
    renderScreenResults(_screenResults);      // 尾盘选股结果保持显示
    if (!quotes.length) return;
    renderQuotes();
  }, 30 * 1000);
})();

/* ==========================================================================
 * 碎片阅读 · 收藏机制（我的收藏）
 * 存储：localStorage[wb_frag_favorites_v1] = [{type, key, savedAt, snapshot}]
 *   type: 'classic' | 'history' | 'fragment' | 'deep'
 *   snapshot: 收藏时把内容快照下来（即使源数据更新或被删除，收藏页仍能展示）
 * ========================================================================== */
(function () {
  // 手绘图标工具（定义于首块 IIFE，经 window 暴露；本块跨作用域复用）
  const hbIcon = window.hbIcon, hbLabel = window.hbLabel, hbSet = window.hbSet, hbSetLabel = window.hbSetLabel;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const D = window.WORKBENCH_DATA || {};
  const fr = D.fragmentReading || {};
  const KEY = fr.favoritesKey || "wb_frag_favorites_v1";
  const appToast = window.appToast;  /* 复用全局 appToast */

  function loadFavs() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]") || []; }
    catch (e) { return []; }
  }
  function saveFavs(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function isFav(type, key) {
    return loadFavs().some(x => x.type === type && x.key === key);
  }
  function addFav(type, key, snapshot) {
    const arr = loadFavs();
    if (arr.some(x => x.type === type && x.key === key)) return false;
    arr.unshift({ type, key, savedAt: new Date().toISOString(), snapshot: snapshot || null });
    saveFavs(arr);
    return true;
  }
  function removeFav(type, key) {
    const arr = loadFavs().filter(x => !(x.type === type && x.key === key));
    saveFavs(arr);
    return true;
  }
  function findSourceByKey(type, key) {
    if (type === "classic") return (fr.classics || []).find(x => x.id === key) || null;
    if (type === "history") return (fr.history || []).find(x => x.id === key) || null;
    if (type === "deep") return (fr.deep || []).find(x => (x.title + "|" + x.source) === key) || null;
    if (type === "fragment") {
      const weeks = fr.weeks || [];
      for (const w of weeks) for (const d of (w.days || [])) {
        const head = (d.passage || "").replace(/\s+/g, "").slice(0, 20);
        const k = (d.category || "") + "|" + (d.source || "") + "|" + head;
        if (k === key) return Object.assign({}, d, { _origKey: k });
      }
    }
    return null;
  }

  function buildSnapshot(type, key) {
    const src = findSourceByKey(type, key);
    if (!src) return null;
    if (type === "classic") {
      return {
        title: src.title, poet: src.poet, era: src.era,
        original: src.original, translation: src.translation,
        history: src.history, appreciation: src.appreciation, prompt: src.prompt,
      };
    }
    if (type === "history") {
      return {
        title: src.title, year: src.year, region: src.region, summary: src.summary,
        background: src.background, event: src.event, impact: src.impact, prompt: src.prompt,
      };
    }
    if (type === "fragment") {
      return {
        category: src.category, source: src.source, passage: src.passage,
        analysis: src.analysis, prompt: src.prompt,
      };
    }
    if (type === "deep") {
      return {
        title: src.title, source: src.source, tag: src.tag, readingTime: src.readingTime,
        intro: src.intro, structure: src.structure, theme: src.theme, takeaway: src.takeaway,
      };
    }
    return null;
  }

  /* ---- 自动归类：复用摘抄模块的 exClassify 智能引擎 ---- */
  function classifySnapshot(type, snap) {
    if (!snap) return "其他";
    // 如果已有 category（fragment 类型自带的写作类别），直接作为 hint
    let text = "";
    if (type === "classic") {
      text = [snap.title, snap.poet, snap.original, snap.translation, snap.history, snap.appreciation].filter(Boolean).join(" ");
    } else if (type === "history") {
      text = [snap.title, snap.summary, snap.background, snap.event, snap.impact].filter(Boolean).join(" ");
    } else if (type === "fragment") {
      text = [snap.category, snap.source, snap.passage, snap.analysis].filter(Boolean).join(" ");
    } else if (type === "deep") {
      text = [snap.title, snap.source, snap.tag, snap.intro, snap.theme, snap.takeaway].filter(Boolean).join(" ");
    }
    if (!text.trim()) return "其他";
    if (window.exClassify) {
      try {
        const r = window.exClassify({ text: text, tags: snap.category || snap.tag || "" });
        return (r && r.cat) || "其他";
      } catch (e) { return "其他"; }
    }
    return "其他";
  }

  // 筛选状态："" = 全部，其余为类别名
  let favFilter = "";

  function relTime(iso) {
    try {
      const t = new Date(iso).getTime();
      const diff = (Date.now() - t) / 1000;
      if (diff < 60) return "刚刚";
      if (diff < 3600) return Math.floor(diff / 60) + " 分钟前";
      if (diff < 86400) return Math.floor(diff / 3600) + " 小时前";
      if (diff < 86400 * 7) return Math.floor(diff / 86400) + " 天前";
      return new Date(iso).toLocaleDateString("zh-CN");
    } catch (e) { return ""; }
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function renderFavItem(item) {
    const s = item.snapshot || {};
    const savedAt = relTime(item.savedAt);
    const typeLabel = item.type === "classic" ? "📜 古诗文" : item.type === "history" ? "🏯 历史事件" : item.type === "deep" ? "📚 深度阅读" : "✨ 碎片";
    const cat = s._category || "其他";
    const catBadge = `<span class="frag-cat-badge" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</span>`;
    let body = "";
    if (item.type === "classic") {
      body = `
        <div class="frag-classic-original">${escapeHtml(s.original || "")}</div>
        <div class="frag-block"><div class="frag-block-title">📜 现代汉语译文</div><div class="frag-block-body">${escapeHtml(s.translation || "")}</div></div>
        <div class="frag-block"><div class="frag-block-title">🏯 历史背景</div><div class="frag-block-body">${escapeHtml(s.history || "")}</div></div>
        <div class="frag-block"><div class="frag-block-title">🌿 诗文赏析</div><div class="frag-block-body">${escapeHtml(s.appreciation || "")}</div></div>
        <div class="frag-block frag-prompt-block"><div class="frag-block-title">✍️ 练笔</div><div class="frag-prompt">${escapeHtml(s.prompt || "")}</div></div>`;
    } else if (item.type === "history") {
      body = `
        <div class="frag-history-summary">${escapeHtml(s.summary || "")}</div>
        <div class="frag-block"><div class="frag-block-title">🌍 历史背景</div><div class="frag-block-body">${escapeHtml(s.background || "")}</div></div>
        <div class="frag-block"><div class="frag-block-title">⚙️ 事件经过</div><div class="frag-block-body">${escapeHtml(s.event || "")}</div></div>
        <div class="frag-block"><div class="frag-block-title">💥 历史影响</div><div class="frag-block-body">${escapeHtml(s.impact || "")}</div></div>
        <div class="frag-block frag-prompt-block"><div class="frag-block-title">✍️ 练笔</div><div class="frag-prompt">${escapeHtml(s.prompt || "")}</div></div>`;
    } else if (item.type === "fragment") {
      body = `
        <div class="frag-passage">${escapeHtml(s.passage || "")}</div>
        <div class="frag-block"><div class="frag-block-title">✒️ 文笔解析</div><div class="frag-analysis">${escapeHtml(s.analysis || "")}</div></div>
        <div class="frag-block frag-prompt-block"><div class="frag-block-title">✍️ 练笔</div><div class="frag-prompt">${escapeHtml(s.prompt || "")}</div></div>`;
    } else if (item.type === "deep") {
      body = `
        <div class="frag-history-summary">${escapeHtml(s.intro || "")}</div>
        <div class="frag-block"><div class="frag-block-title">🧭 结构拆解</div><div class="frag-block-body">${escapeHtml(s.structure || "")}</div></div>
        <div class="frag-block"><div class="frag-block-title">💡 主题提炼</div><div class="frag-block-body">${escapeHtml(s.theme || "")}</div></div>
        <div class="frag-block deep-takeaway"><div class="frag-block-title">🎯 今日带走</div><div class="frag-block-body">${escapeHtml(s.takeaway || "")}</div></div>`;
    }
    const titleLine = item.type === "classic"
      ? `<div class="frag-classic-title">${escapeHtml(s.title || "")} <span class="frag-fav-meta">${escapeHtml(s.era || "")} · ${escapeHtml(s.poet || "")}</span></div>`
      : item.type === "history"
        ? `<div class="frag-history-title">${escapeHtml(s.title || "")} <span class="frag-fav-meta">${escapeHtml(s.year || "")} · ${escapeHtml(s.region || "")}</span></div>`
        : item.type === "deep"
          ? `<div class="frag-history-title">${escapeHtml(s.title || "")} <span class="frag-fav-meta">${escapeHtml(s.source || "")} · ${escapeHtml(s.tag || "")}</span></div>`
          : `<div class="frag-classic-title">${escapeHtml((s.category || "") + " · " + (s.source || ""))}</div>`;
    return `<div class="frag-fav-card" data-fav-type="${item.type}" data-fav-key="${item.key}" data-cat="${escapeHtml(cat)}">
      <div class="frag-fold-head-row">
        <span class="frag-fav-type">${typeLabel}</span>
        ${catBadge}
        <span class="frag-fav-time">收藏于 ${savedAt}</span>
        <button type="button" class="frag-fav-btn is-fav" data-fav-action="unfav" data-fav-type="${item.type}" data-fav-key="${item.key}" title="取消收藏">★</button>
      </div>
      ${titleLine}
      ${body}
    </div>`;
  }

  // 6 大类别配置（与摘抄模块一致）
  const FAV_CATS = ["写人", "写事", "写景", "观点", "情感", "其他"];
  const CAT_COLORS = {
    "写人": "#e8a87c", "写事": "#c38d9e", "写景": "#85c1a0",
    "观点": "#7eb8d4", "情感": "#e0a3b0", "其他": "#b0b0b0",
  };

  function getItemCat(item) {
    return (item.snapshot && item.snapshot._category) || "其他";
  }

  function paintFavorites() {
    const listEl = document.getElementById("fragFavoritesList");
    const countEl = document.getElementById("fragFavoritesCount");
    if (!listEl) return;
    const arr = loadFavs();
    if (countEl) countEl.textContent = `已收藏 ${arr.length} 条`;
    if (!arr.length) {
      listEl.innerHTML = `<div class="frag-empty">还没有收藏哦～点击卡片右上角的 ☆ 收藏喜欢的内容</div>`;
      return;
    }

    // 统计每个类别数量
    const catCounts = {};
    FAV_CATS.forEach(c => catCounts[c] = 0);
    arr.forEach(item => { const c = getItemCat(item); catCounts[c] = (catCounts[c] || 0) + 1; });

    // 渲染筛选条
    let filterHtml = `<div class="frag-filter-bar">`;
    filterHtml += `<button type="button" class="frag-filter-chip${favFilter === "" ? " active" : ""}" data-filter="">全部 ${arr.length}</button>`;
    FAV_CATS.forEach(c => {
      if (catCounts[c] > 0) {
        const color = CAT_COLORS[c] || "#b0b0b0";
        filterHtml += `<button type="button" class="frag-filter-chip${favFilter === c ? " active" : ""}" data-filter="${escapeHtml(c)}" style="--chip-c:${color}">${escapeHtml(c)} ${catCounts[c]}</button>`;
      }
    });
    filterHtml += `</div>`;

    // 按筛选过滤
    const filtered = favFilter ? arr.filter(item => getItemCat(item) === favFilter) : arr;

    // 渲染列表
    const listHtml = filtered.length
      ? filtered.map(renderFavItem).join("")
      : `<div class="frag-empty">「${escapeHtml(favFilter)}」分类下还没有收藏</div>`;

    listEl.innerHTML = filterHtml + listHtml;
  }

  // 刷新所有页面上的星标按钮状态（根据当前收藏列表）
  function paintStars() {
    const arr = loadFavs();
    const set = new Set(arr.map(x => x.type + "|" + x.key));
    document.querySelectorAll(".frag-fav-btn[data-fav-type][data-fav-key]").forEach(btn => {
      const k = btn.dataset.favType + "|" + btn.dataset.favKey;
      if (set.has(k)) { btn.classList.add("is-fav"); btn.textContent = "★"; }
      else { btn.classList.remove("is-fav"); btn.textContent = "☆"; }
    });
  }

  // 首次：绘制收藏区 + 同步所有星标
  paintFavorites();
  paintStars();

  // 素材库等动态重渲染后，重绘星标状态
  document.addEventListener("frag:repaint", paintStars);

  // 委托：点击筛选条
  document.addEventListener("click", e => {
    const chip = e.target.closest(".frag-filter-chip[data-filter]");
    if (!chip) return;
    e.preventDefault();
    e.stopPropagation();
    favFilter = chip.dataset.filter || "";
    paintFavorites();
  });

  // 委托：点击星标按钮
  document.addEventListener("click", e => {
    const btn = e.target.closest(".frag-fav-btn[data-fav-type][data-fav-key]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const type = btn.dataset.favType;
    const key = btn.dataset.favKey;
    const isFaved = btn.classList.contains("is-fav") || isFav(type, key);
    if (isFaved) {
      removeFav(type, key);
    } else {
      const snap = buildSnapshot(type, key);
      if (!snap) { appToast("内容已不存在，无法收藏", 2400, "warn"); return; }
      const cat = classifySnapshot(type, snap);
      snap._category = cat;
      addFav(type, key, snap);
      appToast("已收藏 · 自动归入「" + cat + "」", 2400, "ok");
    }
    paintFavorites();
    paintStars();
  });

  /* ================= 桌面页 ================= */
  (function renderDesk() {
    const quoteBox = document.getElementById("deskQuote");
    if (quoteBox) {
      // 每日一句话：中英双语，按一年第几天轮换
      const DAILY_QUOTES = [
        ["与其等风来，不如追风去。", "Rather than wait for the wind, chase it."],
        ["慢慢来，一切都会如约而至。", "Take it slow — everything arrives in its own time."],
        ["今天也要闪闪发光。", "Shine bright today."],
        ["种一棵树最好的时间是十年前，其次是现在。", "The best time to plant a tree was ten years ago; the second best time is now."],
        ["你若盛开，蝴蝶自来。", "Bloom, and the butterflies will come."],
        ["心之所向，素履以往。", "Where the heart leads, follow even in plain shoes."],
        ["保持热爱，奔赴山海。", "Keep your passion, and journey toward the mountains and seas."],
        ["生活原本沉闷，但跑起来就有风。", "Life may feel dull, but once you run, the wind picks up."],
        ["所有的努力都会开花结果。", "Every effort blooms into its own fruit."],
        ["愿你眼里有光，心中有爱。", "May your eyes hold light and your heart hold love."],
        ["昨天是历史，明天是谜团，今天是礼物。", "Yesterday is history, tomorrow is a mystery, today is a gift."],
        ["好运藏在努力里。", "Good luck hides inside hard work."],
        ["只要方向对了，路就不会太远。", "As long as your direction is right, the road won't be too long."],
        ["未来的你会感谢现在努力的自己。", "Your future self will thank you for your effort today."],
        ["把平凡的日子过成诗。", "Turn ordinary days into poetry."],
        ["万物皆有裂痕，那是光照进来的地方。", "There is a crack in everything — that's how the light gets in."],
        ["梦想不会逃跑，逃跑的只有自己。", "Dreams don't run away; only you can."],
        ["星光不负赶路人。", "The stars never let down those who keep moving."],
        ["越努力，越幸运。", "The harder you work, the luckier you get."],
        ["向阳而生，逐光而行。", "Grow toward the sun and walk by the light."],
        ["每一次坚持，都是向未来迈进。", "Every moment of persistence is a step toward the future."],
        ["路虽远，行则将至。", "The road is long, but walking brings you there."],
        ["以梦为马，不负韶华。", "Ride your dreams like a horse and live up to your youth."],
        ["成为更好的自己，去遇见更好的世界。", "Become a better you to meet a better world."],
        ["今天一点一滴的积累，都是明天的底气。", "Every little step today builds tomorrow's confidence."],
        ["好事多磨，未来可期。", "Good things take time; the future holds promise."],
        ["心若向阳，无谓悲伤。", "With a heart facing the sun, there is no room for sorrow."],
        ["你不必光芒万丈，只要始终温暖有光。", "You don't need to blaze — just stay warm and bright."],
        ["每一次跌倒，都是为了跳得更高。", "Every fall prepares you to jump higher."],
        ["所有的惊艳，都来自长久的努力。", "Every brilliance comes from long-lasting effort."],
        ["世界很大，你值得去看看。", "The world is big — you deserve to go see it."],
        ["温柔且坚定，知足而上进。", "Gentle yet firm, content yet ambitious."],
        ["把期待值放在自己身上，你会活得更自由。", "Place your expectations on yourself and you'll live more freely."],
        ["今天不为昨天叹息，明天不为今天懊悔。", "Don't sigh for yesterday, don't regret today tomorrow."],
        ["你的坚持，终将美好。", "Your persistence will eventually be beautiful."],
        ["生活不止眼前的苟且，还有诗和远方。", "Life is more than the mundane present — there's also poetry and faraway places."]
      ];
      function dayOfYear(d) {
        const start = new Date(d.getFullYear(), 0, 0);
        return Math.floor((d - start) / 86400000);
      }
      const idx = dayOfYear(new Date()) % DAILY_QUOTES.length;
      const q = DAILY_QUOTES[idx];
      quoteBox.innerHTML =
        '<p class="dq-cn">"' + q[0] + '"</p>' +
        '<p class="dq-en">"' + q[1] + '"</p>' +
        '<button type="button" class="dq-play" id="dqPlayBtn" title="朗读英文">' + hbLabel("speak", "听听英文") + '</button>';
      // 朗读英文按钮
      var dqBtn = document.getElementById("dqPlayBtn");
      if (dqBtn && window.speechSynthesis) {
        var dqState = 0; // 0=idle 1=speaking 2=paused
        dqBtn.onclick = function () {
          var synth = window.speechSynthesis;
          if (dqState === 1) { synth.pause(); dqState = 2; hbSetLabel(dqBtn, "play", "继续"); dqBtn.classList.remove("speaking"); return; }
          if (dqState === 2) { synth.resume(); dqState = 1; hbSetLabel(dqBtn, "pause", "暂停"); dqBtn.classList.add("speaking"); return; }
          synth.cancel();
          var enText = q[1];
          if (!enText.trim()) return;
          var u = new SpeechSynthesisUtterance(enText);
          u.lang = "en-US"; u.rate = 0.9;
          var voices = synth.getVoices() || [];
          var enVoice = voices.find(function (v) { return /en(-US)?/i.test(v.lang) && !/zh/i.test(v.lang); });
          if (enVoice) u.voice = enVoice;
          u.onend = function () { dqState = 0; hbSetLabel(dqBtn, "speak", "播放"); dqBtn.classList.remove("speaking"); };
          u.onerror = function () { dqState = 0; hbSetLabel(dqBtn, "speak", "播放"); dqBtn.classList.remove("speaking"); };
          dqState = 1; hbSetLabel(dqBtn, "pause", "暂停"); dqBtn.classList.add("speaking");
          synth.speak(u);
        };
      } else if (dqBtn) { dqBtn.style.display = "none"; }
    }

    /* 概览渲染：读取各模块 localStorage，构建今日速览（统计图形式）。
       抽成独立函数，页面加载 + 每次切回首页 + 跨标签页 storage 变化时重新渲染，
       保证计划/日记/收藏/心理练习等操作后概览"完成情况"及时刷新 */
    function renderDeskOverview() {
    const ovBox = document.getElementById("deskOverview");
    if (ovBox) {
      const today = new Date().toISOString().slice(0, 10);

      // 收集各模块数据
      let planTotal = 0, planDone = 0;
      try {
        planTotal = (JSON.parse(localStorage.getItem("wb_plan_" + today)) || []).length;
      } catch (e) {}
      try {
        const doneMap = JSON.parse(localStorage.getItem("wb_plan_done_" + today)) || {};
        planDone = Object.values(doneMap).filter(function (v) { return v === true; }).length;
      } catch (e) {}

      let favs = 0, diary = 0, mf = 0, ex = 0;
      try { favs = (JSON.parse(localStorage.getItem("wb_frag_favorites_v1")) || []).length; } catch (e) {}
      try { diary = (JSON.parse(localStorage.getItem("wb_diary_records")) || []).length; } catch (e) {}
      try { mf = (JSON.parse(localStorage.getItem("wb_manifest_records")) || []).length; } catch (e) {}
      try { ex = (JSON.parse(localStorage.getItem("wb_excerpt_personal_v1")) || []).length; } catch (e) {}

      // 各模块柱状数据
      var bars = [
        { icon: "⭐", label: "我的收藏", num: favs, color: "#F5B800", hint: favs > 0 ? "条精彩" : "去收藏" },
        { icon: "📓", label: "觉察日记", num: diary, color: "#7E93A9", hint: diary > 0 ? "条记录" : "写第一篇" },
        { icon: "✨", label: "显化日记", num: mf, color: "#C98A5E", hint: mf > 0 ? "条心愿" : "许个愿" },
        { icon: "🖋️", label: "摘抄笔记", num: ex, color: "#3C8E72", hint: ex > 0 ? "条摘抄" : "记第一条" }
      ];
      var maxNum = Math.max.apply(null, bars.map(function (b) { return b.num; }).concat([5]));

      // 计划完成 mini-card（与英语/心理同格式，三卡并列）
      var pct = planTotal > 0 ? Math.round(planDone / planTotal * 100) : 0;
      var pR = 28, pCirc = 2 * Math.PI * pR, pDash = pCirc * pct / 100;
      var planCard =
        '<div class="ov-mini-card ov-mini-plan">' +
          '<div class="ov-mini-hd"><span class="ov-mini-ic">📋</span><span class="ov-mini-title">计划完成</span></div>' +
          '<div class="ov-mini-body">' +
            '<svg class="ov-mini-ring" viewBox="0 0 72 72" width="72" height="72">' +
              '<circle cx="36" cy="36" r="' + pR + '" fill="none" stroke="rgba(60,142,114,.12)" stroke-width="5"/>' +
              '<circle cx="36" cy="36" r="' + pR + '" fill="none" stroke="#3C8E72" stroke-width="5" stroke-linecap="round" ' +
                'stroke-dasharray="' + pDash + ' ' + pCirc + '" transform="rotate(-90 36 36)"/>' +
              '<text x="36" y="33" text-anchor="middle" class="ov-mini-ring-num">' + pct + '%</text>' +
              '<text x="36" y="48" text-anchor="middle" class="ov-mini-ring-sub">完成率</text>' +
            '</svg>' +
            '<div class="ov-mini-stats">' +
              '<div class="ov-mini-stat"><span class="ov-ms-num">' + planDone + '</span><span class="ov-ms-lbl">已完成</span></div>' +
              '<div class="ov-mini-stat"><span class="ov-ms-num">' + planTotal + '</span><span class="ov-ms-lbl">今日任务</span></div>' +
            '</div>' +
          '</div>' +
        '</div>';

      // 柱状条
      var barsHtml = bars.map(function (b) {
        var w = maxNum > 0 ? Math.max(b.num / maxNum * 100, b.num > 0 ? 6 : 2) : 2;
        return '<div class="ov-bar-item">' +
          '<div class="ov-bar-top"><span class="ov-bar-ic">' + b.icon + '</span>' +
            '<span class="ov-bar-label">' + b.label + '</span>' +
            '<span class="ov-bar-val">' + b.num + '<small>' + (b.num > 0 ? " " + b.hint : " " + b.hint) + '</small></span>' +
          '</div>' +
          '<div class="ov-bar-track"><span class="ov-bar-fill" style="width:' + w + '%;background:' + b.color + '"></span></div>' +
        '</div>';
      }).join("");

      ovBox.innerHTML = '<div class="ov-bars">' + barsHtml + '</div>';

      // 英语学习统计
      var enStatsHtml = "";
      if (D && D.englishDaily) {
        var enDays = D.englishDaily.days || [];
        var enVocabTotal = 0, enKeysTotal = 0;
        enDays.forEach(function (d) {
          enVocabTotal += (d.vocab || []).length;
          if (d.spoken && d.spoken.keys) enKeysTotal += d.spoken.keys.length;
        });
        var enPct = enDays.length ? Math.round(Math.min(enDays.length / 7 * 100, 100)) : 0;
        var enR2 = 28, enC2 = 2 * Math.PI * enR2, enDash2 = enC2 * enPct / 100;
        enStatsHtml =
          '<div class="ov-mini-card ov-mini-en">' +
            '<div class="ov-mini-hd"><span class="ov-mini-ic">🔤</span><span class="ov-mini-title">英语学习</span></div>' +
            '<div class="ov-mini-body">' +
              '<svg class="ov-mini-ring" viewBox="0 0 72 72" width="72" height="72">' +
                '<circle cx="36" cy="36" r="' + enR2 + '" fill="none" stroke="rgba(60,142,114,.12)" stroke-width="5"/>' +
                '<circle cx="36" cy="36" r="' + enR2 + '" fill="none" stroke="#3C8E72" stroke-width="5" stroke-linecap="round" ' +
                  'stroke-dasharray="' + enDash2 + ' ' + enC2 + '" transform="rotate(-90 36 36)"/>' +
                '<text x="36" y="33" text-anchor="middle" class="ov-mini-ring-num">' + enPct + '%</text>' +
                '<text x="36" y="48" text-anchor="middle" class="ov-mini-ring-sub">周进度</text>' +
              '</svg>' +
              '<div class="ov-mini-stats">' +
                '<div class="ov-mini-stat"><span class="ov-ms-num">' + enVocabTotal + '</span><span class="ov-ms-lbl">单词</span></div>' +
                '<div class="ov-mini-stat"><span class="ov-ms-num">' + enKeysTotal + '</span><span class="ov-ms-lbl">口语</span></div>' +
                '<div class="ov-mini-stat"><span class="ov-ms-num">' + enDays.length + '</span><span class="ov-ms-lbl">课件</span></div>' +
              '</div>' +
            '</div>' +
          '</div>';
      }

      // 心理学统计
      var psychStatsHtml = "";
      if (D && D.psychology) {
        var psychCards = D.psychology.cards || [];
        var psychTotal = psychCards.length;
        var psychMastered = 0, psychUnderstood = 0;
        try {
          var psychProg = JSON.parse(localStorage.getItem("wb_psych_progress_v1")) || {};
          psychCards.forEach(function (c) {
            if (psychProg[c.id] && psychProg[c.id].applied) psychMastered++;
            if (psychProg[c.id] && psychProg[c.id].understood) psychUnderstood++;
          });
        } catch (e) {}
        // 今日测验进度
        var quizProg = { done: 0, total: 0 };
        try {
          var quizDay = localStorage.getItem("wb_psych_quiz_day_v1");
          if (quizDay === today) {
            var qp = JSON.parse(localStorage.getItem("wb_psych_quiz_v1")) || {};
            quizProg.done = (qp.done || []).length;
            quizProg.total = (qp.questions || []).length;
          }
        } catch (e) {}
        var psychPct = psychTotal ? Math.round(psychMastered / psychTotal * 100) : 0;
        var prR = 28, prC = 2 * Math.PI * prR, prDash = prC * psychPct / 100;
        psychStatsHtml =
          '<div class="ov-mini-card ov-mini-psych">' +
            '<div class="ov-mini-hd"><img class="ov-mini-ic-img" src="assets/icons/icon-psych.png?v=b97" alt="心理学"><span class="ov-mini-title">心理学</span></div>' +
            '<div class="ov-mini-body">' +
              '<svg class="ov-mini-ring" viewBox="0 0 72 72" width="72" height="72">' +
                '<circle cx="36" cy="36" r="' + prR + '" fill="none" stroke="rgba(201,138,94,.12)" stroke-width="5"/>' +
                '<circle cx="36" cy="36" r="' + prR + '" fill="none" stroke="#C98A5E" stroke-width="5" stroke-linecap="round" ' +
                  'stroke-dasharray="' + prDash + ' ' + prC + '" transform="rotate(-90 36 36)"/>' +
                '<text x="36" y="33" text-anchor="middle" class="ov-mini-ring-num">' + psychPct + '%</text>' +
                '<text x="36" y="48" text-anchor="middle" class="ov-mini-ring-sub">掌握率</text>' +
              '</svg>' +
              '<div class="ov-mini-stats">' +
                '<div class="ov-mini-stat"><span class="ov-ms-num">' + psychMastered + '</span><span class="ov-ms-lbl">已掌握</span></div>' +
                '<div class="ov-mini-stat"><span class="ov-ms-num">' + psychUnderstood + '</span><span class="ov-ms-lbl">已看懂</span></div>' +
                (quizProg.total > 0
                  ? '<div class="ov-mini-stat"><span class="ov-ms-num">' + quizProg.done + '/' + quizProg.total + '</span><span class="ov-ms-lbl">今日练习</span></div>'
                  : '<div class="ov-mini-stat"><span class="ov-ms-num">' + psychTotal + '</span><span class="ov-ms-lbl">总知识点</span></div>') +
              '</div>' +
            '</div>' +
          '</div>';
      }

      // 概览区：计划完成 + 英语 + 心理学 三卡并列（作为概览第一部分，置于柱状图之上）
      var miniRow = document.createElement("div");
      miniRow.className = "ov-mini-row";
      miniRow.innerHTML = (planCard || "") + (enStatsHtml || "") + (psychStatsHtml || "");
      ovBox.insertBefore(miniRow, ovBox.firstChild);
    }
    }

    /* 首次渲染 */
    renderDeskOverview();
    /* 切回首页时重新渲染概览（各模块数据变更后回首页要看到最新完成情况） */
    document.addEventListener("wb:pagechange", function (ev) {
      if (ev.detail && ev.detail.page === "desk") {
        renderDeskOverview();
      }
    });
    /* 跨标签页同步：其他标签页写入数据时刷新概览 */
    window.addEventListener("storage", function (ev) {
      if (!ev.key) return;
      if (/wb_plan|wb_diary|wb_manifest|wb_excerpt|wb_frag|wb_psych|wb_kb|wb_pod/.test(ev.key)) {
        renderDeskOverview();
      }
    });
  })();

  /* ================= 正念练习 ================= */
  (function renderMindful() {
    function dayOfYear(d) {
      const start = new Date(d.getFullYear(), 0, 0);
      return Math.floor((d - start) / 86400000);
    }
    const dayIdx = dayOfYear(new Date());

    /* ---------- 1) 呼吸引导 ---------- */
    const orb = document.getElementById("mfOrb");
    const orbText = document.getElementById("mfOrbText");
    const orbCount = document.getElementById("mfOrbCount");
    const btn = document.getElementById("mfBreatheBtn");
    const roundEl = document.getElementById("mfRound");
    const patternBox = document.getElementById("mfPattern");
    if (orb && btn && patternBox) {
      // 创建会被缩放的光球（文字不缩放）
      const ball = document.createElement("div");
      ball.className = "mf-orb-ball";
      orb.insertBefore(ball, orb.firstChild);

      const PATTERNS = {
        "478": [["吸气", 4, "in"], ["屏息", 7, "holdTop"], ["呼气", 8, "out"]],
        "box": [["吸气", 4, "in"], ["屏息", 4, "holdTop"], ["呼气", 4, "out"], ["屏息", 4, "holdBottom"]],
        "calm": [["吸气", 4, "in"], ["屏息", 2, "holdTop"], ["呼气", 6, "out"]]
      };
      let current = "478";
      let phases = PATTERNS[current];
      let cycleDur = phases.reduce((s, p) => s + p[1], 0);
      let running = false;
      let startTs = 0;
      let elapsedBase = 0;   // 本轮已累积秒（含暂停）
      let round = 0;
      let timer = null;

      const lerp = (a, b, t) => a + (b - a) * t;
      const setScale = s => { ball.style.transform = "scale(" + s + ")"; };

      function tick() {
        const now = Date.now();
        const t = (elapsedBase + (now - startTs) / 1000) % cycleDur;
        let acc = 0, ph = phases[0], local = 0;
        for (const p of phases) {
          if (t < acc + p[1]) { ph = p; local = t - acc; break; }
          acc += p[1];
          ph = p; local = p[1];
        }
        const type = ph[2], dur = ph[1];
        const remain = Math.ceil(dur - local);
        let scale;
        if (type === "in") scale = lerp(1, 1.85, local / dur);
        else if (type === "out") scale = lerp(1.85, 1, local / dur);
        else if (type === "holdTop") scale = 1.85;
        else scale = 1;
        setScale(scale);
        if (orbText.textContent !== ph[0]) orbText.textContent = ph[0];
        orbCount.textContent = remain > 0 ? remain : "";
      }

      function start() {
        running = true;
        hbSetLabel(btn, "pause", "暂停");
        startTs = Date.now();
        timer = setInterval(() => {
          tick();
          const t = elapsedBase + (Date.now() - startTs) / 1000;
          const nr = Math.floor(t / cycleDur);
          if (nr > round) { round = nr; roundEl.textContent = "第 " + round + " 轮"; }
        }, 80);
        tick();
      }
      function pause() {
        running = false;
        hbSetLabel(btn, "play", "继续");
        clearInterval(timer); timer = null;
        elapsedBase += (Date.now() - startTs) / 1000;
      }
      function reset() {
        clearInterval(timer); timer = null;
        running = false; elapsedBase = 0; round = 0;
        hbSetLabel(btn, "play", "开始");
        roundEl.textContent = "第 0 轮";
        orbText.textContent = "准备好了吗";
        orbCount.textContent = "";
        setScale(1);
      }

      btn.addEventListener("click", () => {
        if (!running) {
          if (elapsedBase >= cycleDur) { elapsedBase = 0; round = 0; roundEl.textContent = "第 0 轮"; }
          start();
        } else pause();
      });
      patternBox.addEventListener("click", e => {
        const b = e.target.closest(".mf-pat");
        if (!b) return;
        $$(".mf-pat", patternBox).forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        current = b.dataset.pat;
        phases = PATTERNS[current];
        cycleDur = phases.reduce((s, p) => s + p[1], 0);
        reset();
      });
      setScale(1);
    }

    /* ---------- 2) 正念引导语（每日轮换） ---------- */
    const guideBox = document.getElementById("mfGuideText");
    if (guideBox) {
      const GUIDES = [
        ["把注意力带回呼吸", "找一个舒服的姿势坐下，轻轻闭上眼睛。把注意力放到鼻端，感受空气进入时微微凉、离开时微微暖。不必改变它，只是看着。"],
        ["与念头共处", "脑海里冒出念头时，别急着赶走它。像看云飘过天空一样，看着它来，也看着它走。你不是那些念头，你是看云的人。"],
        ["身体里的锚", "把注意力放到脚底，感受它们与大地的接触。当你心乱时，回到脚底这个锚点，让它把你轻轻拉回此刻。"],
        ["五感落地", "说出你此刻能看到的 5 样东西、听到的 4 种声音、能触摸到的 3 种质感。让感官带你从纷乱中落地。"],
        ["允许一切发生", "此刻升起的任何情绪，都给它一点空间。不评判、不抗拒，只是承认：哦，它在这里。然后让呼吸继续。"],
        ["吃饭也正念", "夹起一口，看清它的颜色与形状，慢慢送入口中。感受味道在舌尖展开，咀嚼、吞咽，一次只做这一件事。"],
        ["一行禅师的一步", "走路时，知道自己在走路；站着时，知道自己在站着。把百分之百的自己，交给正在做的这一件事。"],
        ["慈心练习", "在心里默念：愿我平安，愿我健康，愿我自在。然后把这份祝愿，轻轻送往你爱的人，再送往所有人。"],
        ["接纳不完美的此刻", "不必等到万事俱备才开始平静。就在此刻，带着所有的不完美，深深地吸一口气——这已经足够好。"],
        ["给心一个休止符", "像音乐里的休止，沉默也是旋律的一部分。每天留几分钟什么都不做，只是呼吸，让心从一直运转里歇一歇。"]
      ];
      const g = GUIDES[dayIdx % GUIDES.length];
      guideBox.innerHTML = '<div class="mf-guide-title">' + escapeHtml(g[0]) + '</div><p class="mf-guide-text">' + escapeHtml(g[1]) + '</p>';
    }

    /* ---------- 3) 正念语录（中英双语，每日轮换） ---------- */
    const quoteBox = document.getElementById("mfQuote");
    if (quoteBox) {
      const MF_QUOTES = [
        ["此刻，便是全部。", "This moment is everything."],
        ["你不需要逃离当下，只需要回到当下。", "You don't need to escape the present, only return to it."],
        ["深呼吸，是把平静请进身体的方式。", "A deep breath is how you invite calm into the body."],
        ["静下来，答案会自己浮现。", "Be still, and the answer will surface on its own."],
        ["心若安定，世界自清。", "When the mind is at peace, the world becomes clear."],
        ["不追过去，不迎未来，只在现在。", "Chase not the past, invite not the future — rest in the now."],
        ["允许自己只是存在，不必总在做。", "Allow yourself simply to be, not always to do."],
        ["每一次呼吸，都是一次重新开始。", "Every breath is a chance to begin again."],
        ["温柔地对待此刻的自己。", "Be gentle with yourself in this moment."],
        ["慢一点，风景才看得清。", "Slow down, and the view becomes clear."],
        ["天空从不为云而改变，你也一样。", "The sky never changes for the clouds, and neither should you."],
        ["把注意力轻轻放在此处，就在此处。", "Place your attention softly here, right here."]
      ];
      const q = MF_QUOTES[dayIdx % MF_QUOTES.length];
      quoteBox.innerHTML = '<p class="mfq-cn">“' + escapeHtml(q[0]) + '”</p><p class="mfq-en">“' + escapeHtml(q[1]) + '”</p>';
    }

    /* ---------- 4) 身体扫描 / 觉察（步骤清单 + 进度 + 引导语音） ---------- */
    const scanBox = document.getElementById("mfScan");
    const scanSub = document.getElementById("mfScanSub");
    const guideBtn = document.getElementById("mfScanGuide");
    const guideHint = document.getElementById("mfScanGuideHint");
    if (scanBox) {
      const STEPS = ["双脚与脚踝", "小腿与膝盖", "大腿", "臀部与骨盆", "腹部与后腰", "胸口与背", "双手与手臂", "肩膀与颈", "面部与五官", "头顶与整身放松"];
      /* 引导语：每步一段轻柔指令，朗读完自动勾选进入下一步 */
      const GUIDE_SCRIPT = [
        "让我们开始身体扫描。找一个舒服的姿势，坐下或躺下都可以。轻轻闭上眼睛，做三次深呼吸。吸气——呼气。吸气——呼气。再吸气——呼气。现在，把注意力带到你的双脚与脚踝。感受脚底与地面或床面的接触，感受袜子的触感、温度。不评判，只是感受。",
        "现在把注意力慢慢移到小腿与膝盖。感受小腿前方和后方的肌肉，感受膝盖关节。如果你感觉到任何紧绷，不急着改变它，只是注意到它在那里。",
        "注意力继续上移，来到大腿。感受大腿前侧和后侧的肌肉，感受它们与大地的接触。让它们慢慢沉下去，越来越放松。",
        "现在感受你的臀部与骨盆。感受身体坐着的重量，感受骨盆与椅子或地面的接触。这里是你的根基，让它稳稳地扎根。",
        "注意力移到腹部与后腰。感受腹部随着呼吸轻轻起伏。吸气时腹部微微隆起，呼气时轻轻回落。后腰贴着地面或椅背，让它放松。",
        "现在把注意力带到胸口与背部。感受胸口随着呼吸的起伏，感受心跳的节奏。背部从上到下，感受每一节脊椎。让整个后背舒展开来。",
        "注意力移到你的双手与手臂。从指尖开始，感受手指的每一个关节。然后手掌、手腕、前臂、上臂。让双手完全放松，自然地放在身体两侧。",
        "现在感受你的肩膀与颈部。这里是常常紧绷的地方。注意到此刻肩膀是上耸的还是下沉的？让它自然下沉。感受颈部后方的肌肉，让它松开。",
        "注意力来到面部与五官。感受你的额头，让它舒展，不要皱眉。感受眼周、脸颊。微微放松下颌，让舌头轻轻抵在上颚。让嘴唇微微分开。",
        "最后，把注意力带到头顶，然后像一道温暖的光，从头顶慢慢扫过全身。从头顶到脚趾，感受整个身体是一个整体。你已经完成了身体扫描。深深地吸一口气，慢慢地呼出。当你准备好了，轻轻睁开眼睛。"
      ];
      const KEY = "wb_mindful_scan_v1";
      let done = {};
      try { done = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { done = {}; }

      function save() {
        try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {}
      }
      function render() {
        const n = STEPS.filter((_, i) => done[i]).length;
        const pct = Math.round(n / STEPS.length * 100);
        scanBox.innerHTML =
          STEPS.map((s, i) => {
            const on = done[i] ? " checked" : "";
            return '<label class="mf-scan-item' + (done[i] ? " on" : "") + '">' +
              '<input type="checkbox" data-i="' + i + '"' + on + '>' +
              '<span class="mf-scan-dot"></span>' +
              '<span class="mf-scan-label">' + escapeHtml(s) + '</span></label>';
          }).join("") +
          '<div class="mf-scan-bar"><span style="width:' + pct + '%"></span></div>' +
          '<div class="mf-scan-count">已完成 ' + n + ' / ' + STEPS.length + '</div>';
        if (scanSub) scanSub.textContent = n >= STEPS.length ? "已完成全部 ✨" : "逐处停留，感受当下";
        /* 同步引导高亮 */
        syncGuideHighlight();
      }
      scanBox.addEventListener("change", e => {
        const cb = e.target.closest('input[type="checkbox"]');
        if (!cb) return;
        const i = +cb.dataset.i;
        if (cb.checked) done[i] = true; else delete done[i];
        save();
        render();
      });

      /* === 引导语音（中文 TTS） === */
      let guideState = "idle";   /* idle | speaking | paused */
      let guideStepIdx = 0;

      /* 女声关键词（治愈柔和） */
      const FEMALE_HINTS = /tingting|ting-ting|mei|huihui|yaoyao|xiaoxiao|xiaoyi|yaoyao|sunshine|female|女|婉|樱|晓|悦/i;
      /* 男声关键词（排除） */
      const MALE_HINTS = /lihsiang|liang-liang|kangkang|yunyang|male|男|康|亮|云/i;
      function pickZhVoice() {
        const vs = (window.speechSynthesis && window.speechSynthesis.getVoices) ? window.speechSynthesis.getVoices() : [];
        /* 1) 精准匹配中文女声（Tingting / Huihui / Yaoyao 等）*/
        let v = vs.find(v => /zh/i.test(v.lang) && FEMALE_HINTS.test(v.name) && !MALE_HINTS.test(v.name));
        if (v) return v;
        /* 2) macOS Tingting */
        v = vs.find(v => /tingting/i.test(v.name));
        if (v) return v;
        /* 3) Google 中文女声 */
        v = vs.find(v => /google/i.test(v.name) && /zh/i.test(v.lang) && !MALE_HINTS.test(v.name));
        if (v) return v;
        /* 4) Microsoft 女声 */
        v = vs.find(v => /microsoft/i.test(v.name) && /zh/i.test(v.lang) && /huihui|yaoyao|xiaoxiao/i.test(v.name));
        if (v) return v;
        /* 5) 任意中文女声 */
        v = vs.find(v => /zh[-_]CN/i.test(v.lang) && !MALE_HINTS.test(v.name));
        if (v) return v;
        /* 6) 兜底：任意中文声 */
        return vs.find(v => /^zh/i.test(v.lang)) || null;
      }

      function syncGuideHighlight() {
        scanBox.querySelectorAll(".mf-scan-item").forEach((el, i) => {
          el.classList.toggle("guide-current", guideState !== "idle" && i === guideStepIdx);
        });
      }

      function updateGuideUI() {
        if (!guideBtn) return;
        if (guideState === "idle") {
          hbSetLabel(guideBtn, "play", "开始引导");
          guideBtn.classList.remove("guide-active");
          if (guideHint) { guideHint.textContent = "点击后闭上眼睛，跟随语音从头到脚感受身体"; guideHint.classList.remove("guide-active"); }
          if (scanSub) scanSub.textContent = "逐处停留，感受当下";
          syncGuideHighlight();
        } else if (guideState === "speaking") {
          hbSetLabel(guideBtn, "pause", "暂停");
          guideBtn.classList.add("guide-active");
          if (guideHint) { guideHint.textContent = "正在引导：" + STEPS[guideStepIdx]; guideHint.classList.add("guide-active"); }
          syncGuideHighlight();
        } else { /* paused */
          hbSetLabel(guideBtn, "play", "继续");
          guideBtn.classList.add("guide-active");
          if (guideHint) { guideHint.textContent = "已暂停 · " + STEPS[guideStepIdx]; guideHint.classList.add("guide-active"); }
        }
      }

      function speakStep(idx) {
        if (!("speechSynthesis" in window)) {
          appToast("当前浏览器不支持语音朗读，请换 Chrome / Edge / Safari 试试。", 3500, "warn");
          guideState = "idle";
          updateGuideUI();
          return;
        }
        if (idx >= STEPS.length) {
          /* 全部完成 */
          guideState = "idle";
          guideStepIdx = 0;
          updateGuideUI();
          if (scanSub) scanSub.textContent = "已完成全部 ✨";
          appToast("身体扫描引导已完成 🌿", 3000, "ok");
          return;
        }
        const u = new SpeechSynthesisUtterance(GUIDE_SCRIPT[idx]);
        u.lang = "zh-CN";
        u.rate = 0.62;     /* 更慢，适合冥想引导 */
        u.pitch = 1.12;    /* 略高音调，温暖治愈的女声感 */
        u.volume = 0.85;   /* 略低音量，更柔和 */
        const v = pickZhVoice();
        if (v) u.voice = v;
        u.onend = function () {
          /* 这一步朗读完，自动勾选 */
          done[idx] = true;
          save();
          render();
          guideStepIdx = idx + 1;
          if (guideState === "speaking") {
            updateGuideUI();
            /* 间隔 1.2 秒后继续下一步 */
            setTimeout(function () { speakStep(guideStepIdx); }, 1200);
          }
        };
        u.onerror = function () {
          guideState = "idle";
          updateGuideUI();
        };
        window.speechSynthesis.speak(u);
      }

      if (guideBtn) {
        guideBtn.addEventListener("click", function () {
          if (!("speechSynthesis" in window)) {
            appToast("当前浏览器不支持语音朗读，请换 Chrome / Edge / Safari 试试。", 3500, "warn");
            return;
          }
          var synth = window.speechSynthesis;
          if (guideState === "idle") {
            /* 开始引导 */
            synth.cancel();
            guideState = "speaking";
            guideStepIdx = 0;
            updateGuideUI();
            speakStep(0);
          } else if (guideState === "speaking") {
            /* 暂停 */
            synth.pause();
            guideState = "paused";
            updateGuideUI();
          } else {
            /* 继续 */
            synth.resume();
            guideState = "speaking";
            updateGuideUI();
          }
        });
        /* 页面离开（关闭/刷新）时停止语音 */
        window.addEventListener("beforeunload", function () {
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        });
        /* 切换到其他模块时停止语音（showPage 会派发 pagechange 事件） */
        document.addEventListener("wb:pagechange", function () {
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          guideState = "idle";
          guideStepIdx = 0;
          updateGuideUI();
        });
      }

      render();
    }
  })();

  /* ==================== 知识库 (KB) ==================== */
  (function () {
    var LS_KB = "wb_kb_notes_v1";
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
    var lsGet = function (k, fb) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } };
    var lsSet = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

    /* ---------- DOM 缓存 ---------- */
    var textPanel, urlPanel, filePanel;
    var textArea, urlInput, urlNotice, fileInput, fileDrop;
    var titleInput, tagInput, catSelect, saveBtn;
    var listEl, countEl, searchBox, catFilter, sortSelect;

    /* ---------- State ---------- */
    var currentInput = { type: "text", content: "", title: "", tags: "", cat: "" };
    var notes = [];

    function initDOME() {
      textPanel  = document.querySelector('[data-kb-panel="text"]');
      urlPanel   = document.querySelector('[data-kb-panel="url"]');
      filePanel  = document.querySelector('[data-kb-panel="file"]');
      textArea   = document.getElementById("kbTextInput");
      urlInput   = document.getElementById("kbUrlInput");
      urlNotice  = document.getElementById("kbUrlNotice");
      fileInput  = document.getElementById("kbFileInput");
      fileDrop   = document.getElementById("kbFileDrop");
      titleInput = document.getElementById("kbTitleInput");
      tagInput   = document.getElementById("kbTagInput");
      catSelect  = document.getElementById("kbCatSelect");
      saveBtn    = document.getElementById("kbSaveBtn");
      listEl     = document.getElementById("kbList");
      countEl    = document.getElementById("kbCount");
      searchBox  = document.getElementById("kbSearch");
      catFilter  = document.getElementById("kbFilterCat");
      sortSelect = document.getElementById("kbSort");
    }

    /* ---------- 工具 ---------- */
    function escapeHtml(s) {
      return String(s || "").replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    function nowTime() {
      var d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    }

    function extractTags(text) {
      var tags = [];
      var patterns = [
        /#(\w+)/g,
        /@(\w+)/g
      ];
      patterns.forEach(function (p) {
        var m;
        while ((m = p.exec(text)) !== null) tags.push(m[1]);
      });
      /* 去重 */
      var seen = {};
      return tags.filter(function (t) { if (seen[t]) return false; seen[t] = true; return true; });
    }

    function extractTitle(text) {
      /* 取第一行非空 */
      var lines = text.trim().split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
      if (lines.length > 0) {
        var first = lines[0].replace(/^#+\s*/, "").slice(0, 60);
        return first || "未命名笔记";
      }
      return "未命名笔记";
    }

    function extractPreview(text, maxLen) {
      maxLen = maxLen || 200;
      var stripped = text.replace(/<[^>]+>/g, "").replace(/[ \t]+/g, " ");
      if (stripped.length > maxLen) {
        return stripped.slice(0, maxLen) + " ...";
      }
      return stripped || "（暂无内容）";
    }

    /* ---------- 文件读取 ---------- */
    function readFileContent(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (e) { resolve(e.target.result); };
        reader.onerror = function (e) { reject(e); };
        reader.readAsText(file);
      });
    }

    function handleFileSelect(evt) {
      var files = evt.target.files;
      if (!files || files.length === 0) return;
      handleFile(files[0]);
    }

    function handleFile(file) {
      if (!file) return;
      var allowed = ["text/plain", "text/markdown", "text/csv", "application/json", "text/html", "application/xml"];
      var ext = file.name.split(".").pop().toLowerCase();
      var okExt = ["txt", "md", "csv", "json", "html", "htm"];
      if (!okExt.includes(ext) && !allowed.includes(file.type)) {
        appToast("不支持的文件类型：" + file.name, 2400, "warn");
        return;
      }
      readFileContent(file).then(function (content) {
        currentInput.type = "file";
        currentInput.content = content;
        currentInput.sourceFile = file.name;
        if (!currentInput.title) currentInput.title = file.name.replace(/\.[^.]+$/, "") || "未命名笔记";
        appToast("已加载文件：" + file.name, 2000, "ok");
      }).catch(function () {
        appToast("文件读取失败", 2400, "err");
      });
    }

    /* ---------- 内容提取 (URL 文本) ---------- */
    function extractTextFromHtml(html) {
      var div = document.createElement("div");
      div.innerHTML = html;
      /* 移除 script / style */
      var scripts = div.querySelectorAll("script, style, noscript, iframe, svg");
      scripts.forEach(function (el) { el.remove(); });
      /* 优先 article/main */
      var article = div.querySelector("article, main, .post, .article, .content, #content");
      var container = article || div;
      var text = container.innerText || container.textContent || "";
      return text.trim().replace(/\n{3,}/g, "\n\n");
    }

    function fetchUrlText(url) {
      /* 尝试 fetch 到公共代理；若失败则提示 */
      return fetch("https://r.jina.ai/" + url, {
        headers: { "Accept": "text/plain" }
      }).then(function (resp) {
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        return resp.text();
      }).catch(function (err) {
        appToast("链接内容提取失败：" + (err.message || err), 3000, "err");
        throw err;
      });
    }

    /* ---------- 保存笔记 ---------- */
    function saveNote() {
      var content = "";
      var sourceType = currentInput.type;
      var url = "";
      var sourceFile = "";

      if (sourceType === "text") {
        content = textArea ? textArea.value : "";
      } else if (sourceType === "url") {
        url = urlInput ? urlInput.value.trim() : "";
        if (!url) { appToast("请输入链接地址", 2200, "warn"); return; }
        if (!isValidUrl(url)) { appToast("链接格式不正确", 2200, "warn"); return; }
        saveBtn.disabled = true;
        saveBtn.textContent = "⏳ 提取中...";
        fetchUrlText(url).then(function (text) {
          content = text;
          saveBtn.disabled = false;
          saveBtn.textContent = "📥 归档";
          doSave(content, sourceType, url, sourceFile);
        }).catch(function () {
          saveBtn.disabled = false;
          saveBtn.textContent = "📥 归档";
          var pn = detectSocialPlatform(url);
          if (pn) {
            /* 抖音/小红书：提示走对话流程，不落"提取失败"占位 */
            updateUrlNotice(url);
            appToast(pn === "douyin" ? "抖音链接请在对话中提取分析" : "小红书链接请在对话中提取分析", 3200, "warn");
            return;
          }
          /* 提取失败也保存 URL */
          content = "来源：" + url + "\n\n（内容提取失败，请手动打开链接查看）";
          doSave(content, sourceType, url, sourceFile);
        });
        return;
      } else if (sourceType === "file") {
        content = currentInput.content || "";
        sourceFile = currentInput.sourceFile || "";
        if (!content) { appToast("请先选择文件", 2200, "warn"); return; }
      }

      doSave(content, sourceType, url, sourceFile);
    }

    function doSave(content, sourceType, url, sourceFile) {
      if (!content || content.trim().length === 0) {
        appToast("请输入内容或上传文件后再归档", 2200, "warn");
        return;
      }

      var title = titleInput ? titleInput.value.trim() : "";
      if (!title) title = currentInput.title || extractTitle(content);
      var tags = (tagInput ? tagInput.value.trim() : "") || "";
      var tagArr = tags ? tags.split(",").map(function (t) { return t.trim(); }).filter(function (t) { return t; }) : extractTags(content);
      var cat = catSelect ? catSelect.value : "";

      var source = "手动输入";
      if (sourceType === "url") source = url;
      else if (sourceType === "file") source = sourceFile || "上传文件";

      var note = {
        id: dateNow() + "_" + Math.random().toString(36).slice(2, 8),
        title: title,
        content: content,
        tags: tagArr,
        category: cat || "其他",
        type: sourceType,
        url: url,
        source: source,
        createdAt: nowTime(),
        updatedAt: nowTime()
      };

      notes.unshift(note);
      lsSet(LS_KB, notes);
      appToast("已归档到知识库：" + title, 2000, "ok");
      resetInput();
      renderList();
    }

    function dateNow() {
      return Date.now();
    }

    function resetInput() {
      currentInput = { type: "text", content: "", title: "", tags: "", cat: "" };
      if (textArea) textArea.value = "";
      if (urlInput) urlInput.value = "";
      if (fileInput) fileInput.value = "";
      if (titleInput) titleInput.value = "";
      if (tagInput) tagInput.value = "";
      if (catSelect) catSelect.value = "";
    }

    /* ---------- 渲染列表 ---------- */
    function renderList() {
      if (!listEl) return;
      notes = lsGet(LS_KB, []);

      /* 搜索过滤 */
      var kw = (searchBox ? searchBox.value.trim().toLowerCase() : "");
      /* 分类过滤 */
      var cf = catFilter ? catFilter.value : "";
      /* 排序 */
      var sortVal = sortSelect ? sortSelect.value : "newest";

      var filtered = notes.filter(function (n) {
        var matchKw = !kw || (n.title && n.title.toLowerCase().includes(kw)) || (n.content && n.content.toLowerCase().includes(kw)) || (n.tags && n.tags.some(function (t) { return t.toLowerCase().includes(kw); }));
        var matchCat = !cf || n.category === cf;
        return matchKw && matchCat;
      });

      filtered.sort(function (a, b) {
        if (sortVal === "newest") return b.createdAt.localeCompare(a.createdAt);
        if (sortVal === "oldest") return a.createdAt.localeCompare(b.createdAt);
        if (sortVal === "title") return a.title.localeCompare(b.title);
        return 0;
      });

      updateCount(filtered.length, notes.length, kw, cf);

      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="kb-empty">📭 ' + (kw || cf ? "没有匹配的笔记" : "还没有知识笔记，从上方添加第一条吧") + "</div>";
        return;
      }

      var html = filtered.map(function (n) {
        return renderNoteCard(n);
      }).join("");
      listEl.innerHTML = html;

      /* 绑定事件 */
      bindNoteEvents();
    }

    function updateCount(filtered, total, kw, cf) {
      if (!countEl) return;
      var label = "全部";
      if (cf) {
        var opt = catFilter ? catFilter.options[catFilter.selectedIndex] : null;
        label = opt ? opt.text : cf;
      }
      if (kw && cf) countEl.textContent = filtered + " / " + total + " 条 · 「" + label + "」 · 搜索“" + kw + "”";
      else if (kw) countEl.textContent = filtered + " / " + total + " 条 · 搜索“" + kw + "”";
      else if (cf) countEl.textContent = filtered + " / " + total + " 条 · 「" + label + "」";
      else countEl.textContent = total + " 条笔记";
    }

    function renderNoteCard(n) {
      var title = escapeHtml(n.title || "未命名笔记");
      var cat = escapeHtml(n.category || "其他");
      var source = escapeHtml(n.source || "");
      var preview = escapeHtml(extractPreview(n.content));
      var date = escapeHtml(n.createdAt);
      var tags = (n.tags || []).map(function (t) {
        return '<span class="kb-note-tag">' + escapeHtml(t) + '</span>';
      }).join("");

      var sourceHtml = "";
      if (source) {
        if (n.type === "url" && n.url) {
          sourceHtml = '<div class="kb-note-source"><a href="' + escapeHtml(n.url) + '" target="_blank" rel="noopener">' + source + "</a></div>";
        } else {
          sourceHtml = '<div class="kb-note-source">' + source + "</div>";
        }
      }

      var parts = [
        '<div class="kb-note-card" data-kb-id="' + escapeHtml(n.id) + '">',
        '  <div class="kb-note-head">',
        '    <div class="kb-note-title" title="查看详情">' + title + "</div>",
        '    <span class="kb-note-cat">' + cat + "</span>",
        "  </div>",
        sourceHtml,
        '  <div class="kb-note-preview" title="展开/折叠"><span class="kb-preview-text">' + preview + '</span></div>',
        '  <div class="kb-note-tags">' + tags + "</div>",
        '  <div class="kb-note-foot">',
        '    <span class="kb-note-date">' + date + "</span>",
        '    <div class="kb-note-actions">',
        '      <button class="kb-note-btn" data-kb-action="view" title="查看">👁</button>',
        '      <button class="kb-note-btn" data-kb-action="delete" title="删除">🗑</button>',
        "    </div>",
        "  </div>",
        "</div>"
      ];
      return parts.join("\n");
    }

    function bindNoteEvents() {
      /* 查看详情 */
      $$("[data-kb-action='view']").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var card = this.closest(".kb-note-card");
          var id = card.getAttribute("data-kb-id");
          var note = notes.find(function (n) { return n.id === id; });
          if (note) showNoteDetail(note);
        });
      });
      /* 删除 */
      $$("[data-kb-action='delete']").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var card = this.closest(".kb-note-card");
          var id = card.getAttribute("data-kb-id");
          var note = notes.find(function (n) { return n.id === id; });
          if (confirm("确定删除笔记「" + (note ? note.title : "") + "」？")) {
            notes = notes.filter(function (n) { return n.id !== id; });
            lsSet(LS_KB, notes);
            appToast("已删除笔记", 1600, "ok");
            renderList();
          }
        });
      });
    }

    function showNoteDetail(note) {
      var title = escapeHtml(note.title || "未命名笔记");
      var content = escapeHtml(note.content || "");
      var cat = escapeHtml(note.category || "其他");
      var tags = (note.tags || []).map(function (t) {
        return '<span class="kb-note-tag">' + escapeHtml(t) + '</span>';
      }).join("");
      var source = escapeHtml(note.source || "");
      var date = escapeHtml(note.createdAt || "");

      var sourceHtml = "";
      if (source && note.url) {
        sourceHtml = '<div class="kb-note-source"><a href="' + escapeHtml(note.url) + '" target="_blank" rel="noopener">' + source + "</a></div>";
      } else if (source) {
        sourceHtml = '<div class="kb-note-source">' + source + "</div>";
      }

      var body = '<div style="font-size:13px;line-height:1.8;white-space:pre-wrap;word-break:break-word;">' + content + "</div>";

      var modal = document.getElementById("kbModal") || createKbModal();
      var bodyEl = modal.querySelector(".kb-modal-body");
      var titleEl = modal.querySelector(".kb-modal-title");
      titleEl.textContent = title;
      bodyEl.innerHTML = '<div class="kb-modal-meta">' + sourceHtml + '<div style="font-size:11px;color:var(--ink-faint);margin-top:6px;">分类：' + cat + " · 更新：" + date + "</div>" + (tags ? '<div style="margin-top:6px;">' + tags + "</div>" : "") + "</div>" + body;
      modal.hidden = false;
    }

    function createKbModal() {
      var overlay = document.createElement("div");
      overlay.id = "kbModal";
      overlay.className = "mf-modal-overlay";
      overlay.innerHTML = [
        '<div class="mf-modal" role="dialog" aria-modal="true" aria-label="知识笔记详情">',
        '  <div class="mf-modal-head">',
        '    <div class="kb-modal-title">笔记详情</div>',
        '    <button class="mf-modal-close" type="button" title="关闭">✕</button>',
        "  </div>",
        '  <div class="kb-modal-body"></div>',
        "</div>"
      ].join("\n");
      overlay.querySelector(".mf-modal-close").addEventListener("click", function () { overlay.hidden = true; });
      overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.hidden = true; });
      document.body.appendChild(overlay);
      return overlay;
    }

    /* ---------- Tab 切换 ---------- */
    function bindTabs() {
      var tabs = $$("[data-kb-tab]");
      tabs.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var tab = this.getAttribute("data-kb-tab");
          tabs.forEach(function (t) {
            var isActive = t.getAttribute("data-kb-tab") === tab;
            t.classList.toggle("active", isActive);
          });
          var panels = $$("[data-kb-panel]");
          panels.forEach(function (p) {
            var isActive = p.getAttribute("data-kb-panel") === tab;
            p.hidden = !isActive;
            p.classList.toggle("active", isActive);
          });
          currentInput.type = tab;
        });
      });
    }

    /* ---------- 文件拖拽 ---------- */
    function bindFileDrop() {
      if (!fileDrop || !fileInput) return;
      ["dragenter", "dragover"].forEach(function (ev) {
        fileDrop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); fileDrop.classList.add("dragover"); });
      });
      ["dragleave", "drop"].forEach(function (ev) {
        fileDrop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); fileDrop.classList.remove("dragover"); });
      });
      fileDrop.addEventListener("drop", function (e) {
        var dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          handleFile(dt.files[0]);
          fileInput.files = dt.files;
        }
      });
      fileDrop.addEventListener("click", function () { fileInput.click(); });
      fileInput.addEventListener("change", handleFileSelect);
    }

    /* ---------- 绑定主事件 ---------- */
    function bindMainEvents() {
      if (saveBtn) saveBtn.addEventListener("click", saveNote);

      /* URL 输入框回车 */
      if (urlInput) {
        urlInput.addEventListener("blur", function () {
          var u = urlInput.value.trim();
          if (u && isValidUrl(u)) {
            currentInput.type = "url";
            currentInput.url = u;
            currentInput.content = "";
            urlInput.value = u;
            /* 自动提取标题 */
            var t = getDomain(u);
            if (!titleInput.value && t) titleInput.value = t;
            /* 检测抖音/小红书等反爬平台 */
            updateUrlNotice(u);
            if (!isSocialBlockedUrl(u)) {
              appToast("链接已记录，点击「归档」提取内容", 1800, "info");
            }
          } else if (!u) {
            hideUrlNotice();
          }
        });
        /* 输入变化时也实时检测提示 */
        urlInput.addEventListener("input", function () {
          var u = urlInput.value.trim();
          if (u) updateUrlNotice(u); else hideUrlNotice();
        });
      }

      /* 搜索 + 筛选 */
      if (searchBox) searchBox.addEventListener("input", debounce(renderList, 300));
      if (catFilter) catFilter.addEventListener("change", renderList);
      if (sortSelect) sortSelect.addEventListener("change", renderList);

      /* 监听页面切换到知识库时重新渲染 */
      document.addEventListener("wb:pagechange", function (e) {
        if (e.detail && e.detail.page === "kb") {
          notes = lsGet(LS_KB, []);
          renderList();
        }
      });
    }

    function isValidUrl(string) {
      try { new URL(string); return true; } catch (e) { return false; }
    }

    function getDomain(url) {
      try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
    }

    /* 检测抖音/小红书等公共代理无法提取正文的社交平台 */
    function detectSocialPlatform(url) {
      var d = getDomain(url) + " " + url;
      if (/v\.douyin\.com|douyin\.com|iesdouyin\.com/i.test(d)) return "douyin";
      if (/xhslink\.com|xiaohongshu\.com/i.test(d)) return "xhs";
      if (/weidian|taobao|tmall/i.test(d)) return "";
      return "";
    }
    function isSocialBlockedUrl(url) { return !!detectSocialPlatform(url); }

    function updateUrlNotice(url) {
      if (!urlNotice) return;
      var p = detectSocialPlatform(url);
      var map = {
        "douyin": {
          color: "#2a2a2a",
          html: '<div class="kb-un-title">🎬 抖音视频链接</div>' +
                '<div class="kb-un-body">抖音为强反爬站点（<b>需登录短链跳转 + JS 渲染</b>），普通链接提取拿不到视频正文。' +
                '<b>请点击下方按钮，在对话中由 AI 为你提取内容并深挖整理成笔记。</b></div>' +
                '<button class="kb-un-btn" type="button" onclick="window.__kbOpenSocial&&window.__kbOpenSocial(\'douyin\')">与我对话提取·深度分析</button>'
        },
        "xhs": {
          color: "#2a2a2a",
          html: '<div class="kb-un-title">📕 小红书笔记链接</div>' +
                '<div class="kb-un-body">小红书为强反爬站点（<b>需登录 + JS 渲染</b>），普通链接提取拿不到正文。' +
                '<b>请复制笔记内容，或点击下方按钮，在对话中由 AI 为你提取内容并深挖整理成笔记。</b></div>' +
                '<button class="kb-un-btn" type="button" onclick="window.__kbOpenSocial&&window.__kbOpenSocial(\'xhs\')">与我对话提取·深度分析</button>'
        }
      };
      var info = map[p];
      if (info) {
        urlNotice.innerHTML = info.html;
        urlNotice.hidden = false;
      } else {
        hideUrlNotice();
      }
    }
    function hideUrlNotice() {
      if (urlNotice) { urlNotice.hidden = true; urlNotice.innerHTML = ""; }
    }

    function debounce(fn, ms) {
      var timer;
      return function () {
        var args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function () { fn.apply(null, args); }, ms);
      };
    }

    /* ---------- 初始化 ---------- */
    function init() {
      initDOME();
      if (!saveBtn) return; /* 页面未加载，跳过 */
      notes = lsGet(LS_KB, []);
      bindTabs();
      bindFileDrop();
      bindMainEvents();
      renderList();
    }

    /* DOM ready 或延迟初始化 */
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      setTimeout(init, 0);
    }

    /* 暴露供调试 */
    window.__kb = { refresh: renderList, notes: function () { return lsGet(LS_KB, []); }, set: function (arr) { lsSet(LS_KB, arr); renderList(); } };
    /* 供知识库链接提示"与我对话"按钮触发外部提取流程 */
    window.__kbOpenSocial = function (platform) {
      /* 复制提交流程说明到剪贴板，引导用户到对话 */
      var msg = platform === "douyin"
        ? "🎬 抖音视频链接处理流程：\n1. 请把抖音链接发给我；\n2. 我会尝试提取视频文案/简介；\n3. 深度分析内容脉络；\n4. 整理成结构化 Markdown 笔记给你，复制后到知识库「粘贴文本」归档。"
        : "📕 小红书笔记处理流程：\n1. 请把小红书链接发给我；\n2. 我会尝试提取笔记正文/图片；\n3. 深度分析内容脉络；\n4. 整理成结构化 Markdown 笔记给你，复制后到知识库「粘贴文本」归档。";
      var ta = document.createElement("textarea");
      ta.value = msg;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      appToast("已复制处理说明，请在对话框粘贴@" + platform + "链接", 3200, "info");
    };
  })();
})();
