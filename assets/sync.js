/* ============================================================
 * JOJO发财之路 · 云端同步层（Supabase 直连 REST API）
 * ------------------------------------------------------------
 * 机制：
 *   - 前端直接 fetch Supabase REST API（CORS 已放行）
 *   - 透明 hook Storage.prototype，业务代码无需改动
 *   - 本地优先 + 防抖上传 + 云端合并（不覆盖别的设备）
 *   - 定时自动备份（默认 3 分钟）+ 回到页面时自动拉取
 *   - 四态连接标识：已连接 / 同步中 / 未连接 / 同步异常
 * ============================================================ */
(function () {
  var CFG = window.WB_SYNC || {};

  var TABLE = CFG.table || "user_data";
  var DATA_ID = CFG.dataId || "jojo";
  var API_BASE = (CFG.supabaseUrl || "").replace(/\/$/, "");
  var API_KEY = CFG.supabaseKey || "";
  var LS_KEY = "wb_sync_meta";
  var AUTO_BACKUP_MS = CFG.autoBackupMs || 3 * 60 * 1000; // 定时自动备份周期

  /* ---- 辅助函数 ---- */
  function isBizKey(k) {
    return typeof k === "string" && k.indexOf("wb_") === 0 && k !== LS_KEY;
  }
  function snapshot() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (isBizKey(k)) out[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return out;
  }

  /* 合并：云端已有数据 + 本地数据（本地优先，云端独有 key 保留） */
  function mergeData(cloud, local) {
    var base = {};
    try {
      base = (typeof cloud === "string") ? JSON.parse(cloud) : (cloud || {});
    } catch (e) { base = {}; }
    var merged = {};
    Object.keys(base).forEach(function (k) { merged[k] = base[k]; });
    Object.keys(local).forEach(function (k) { merged[k] = local[k]; });
    return merged;
  }

  /* ---- UI ---- */
  var elBar = null, elText = null, elBtn = null, elBtnPull = null, elStatus = null, elChip = null;
  var _curState = "";
  /* 四态文案：已连接 / 同步中 / 未连接 / 同步异常 */
  var STATE_TEXT = {
    ok:      { chip: "已连接",  bar: "云端已连接 · 数据实时同步" },
    syncing: { chip: "同步中",  bar: "正在与云端同步…" },
    offline: { chip: "未连接",  bar: "未连接云端 · 数据只存在本机" },
    error:   { chip: "连接失败", bar: "云端连接失败 · 数据只存在本机" },
    idle:    { chip: "连接中",  bar: "正在连接云端…" }
  };

  function ensureUI() {
    if (elChip && elBar) return;
    elBar = document.getElementById("wbSyncBar");
    elChip = document.getElementById("wbSyncChip");
    if (elChip && !elChip.querySelector(".wb-chip-dot")) {
      elChip.innerHTML = '<span class="wb-chip-dot"></span><span class="wb-chip-txt">连接中</span>';
    }
    if (elBar) {
      elBar.hidden = false;
      elText = elBar.querySelector(".wb-sync-text");
      elBtn = elBar.querySelector(".wb-sync-btn");
      elBtnPull = elBar.querySelector(".wb-sync-btn-pull");
      elStatus = elBar.querySelector(".wb-sync-status");
    }
  }

  function setState(st, msg) {
    ensureUI();
    _curState = st || "idle";
    var t = STATE_TEXT[_curState] || STATE_TEXT.idle;
    if (elChip) {
      var txt = elChip.querySelector(".wb-chip-txt");
      if (txt) txt.textContent = t.chip; else elChip.textContent = t.chip;
      elChip.className = "wb-sync-chip " + _curState;
      elChip.setAttribute("title", t.bar + (msg ? "（" + msg + "）" : "") + " — 点击查看详情");
    }
    if (!elBar) return;
    elBar.className = "wb-sync-bar " + _curState + (elBar.classList.contains("open") ? " open" : "");
    if (elBar.classList.contains("open")) elBar.style.display = "flex";
    if (elStatus) elStatus.textContent = msg || "";
    if (elText) elText.textContent = t.bar;
  }

  /* 未配置云同步：直接标红未连接，不再执行后续逻辑 */
  if (!CFG.enabled || !API_BASE || !API_KEY) {
    var showOff = function () { setState("offline", "尚未配置云同步（仅本机保存）"); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showOff);
    else showOff();
    window.WBSync = { init: showOff, push: function () {}, pull: function () {} };
    return;
  }

  function getMeta() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; } }
  function setMeta(m) { try { localStorage.setItem(LS_KEY, JSON.stringify(m)); } catch (e) {} }

  var _pushing = false;
  function applyCloud(cloudData) {
    if (!cloudData) return false;
    var changed = false;
    _pushing = true;
    try {
      Object.keys(cloudData).forEach(function (k) {
        var cv = cloudData[k];
        var lv = localStorage.getItem(k);
        if (lv !== cv) { localStorage.setItem(k, cv); changed = true; }
      });
    } finally { _pushing = false; }
    return changed;
  }

  /* ---- Supabase REST API 操作（前端直连） ---- */

  /**
   * 直接 fetch https://<项目>.supabase.co/rest/v1/<table>
   * 不再经过 server.js 代理（CORS 已放行 *）
   */
  function apiRequest(method, restPath, body) {
    var url = API_BASE + restPath;
    var opts = {
      method: method,
      headers: {
        "Content-Type": "application/json",
        "apikey": API_KEY,
        "Authorization": "Bearer " + API_KEY,
        "Prefer": "return=representation",
        "Accept": "application/json"
      }
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (r) {
      var contentType = r.headers.get("content-type") || "";
      if (!r.ok) {
        return r.text().then(function (t) {
          var detail = t;
          try { var j = JSON.parse(t); detail = j.message || j.error || t; } catch (e) {}
          throw new Error("[Supabase " + r.status + "] " + detail);
        });
      }
      if (contentType.indexOf("application/json") === -1) return r.text();
      return r.json();
    });
  }

  /**
   * 从云端读取整行
   */
  function readCloud() {
    // GET /rest/v1/user_data?id=eq.jojo&select=data,updated_at
    return apiRequest("GET", "/rest/v1/" + TABLE + "?id=eq." + DATA_ID + "&select=data,updated_at")
      .then(function (rows) {
        if (!rows || rows.length === 0) return null;
        var row = rows[0];
        // data 字段是 JSONB，Supabase 返回时已经解析过了
        if (typeof row.data === "string") {
          try { row.data = JSON.parse(row.data); } catch (e) { return null; }
        }
        return row;
      });
  }

  /**
   * 写入/更新云端行（upsert）
   */
  function writeCloud(data) {
    return apiRequest("POST", "/rest/v1/" + TABLE, {
      id: DATA_ID,
      data: data,
      updated_at: new Date().toISOString()
    }).catch(function (e) {
      // 如果 POST 返回 409（冲突），用 upsert 模式
      if (e.message.indexOf("409") >= 0) {
        return apiRequest("PATCH", "/rest/v1/" + TABLE + "?id=eq." + DATA_ID, {
          data: data,
          updated_at: new Date().toISOString()
        });
      }
      throw e;
    }).then(function (r) {
      // PATCH 返回 204 No Content 时 r 可能是空
      return r;
    });
  }

  /* ---- 推送到云端（防抖） ---- */
  var _timer = null;
  var _dirty = false;       // 有未上传的本地改动
  var _lastOkAt = 0;        // 上次同步成功时间戳

  function hhmm(ts) {
    return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  /* 区分「连不上云端」和「云端接口报错」：
     只有服务器真的响应了（消息以 [Supabase 状态码] 开头）才算接口异常，
     其余一律视为未连接（断网 / DNS / CORS / 项目被暂停…）。 */
  function failState(e, prefix) {
    var m = (e && e.message ? e.message : String(e || ""));
    if (/^\[Supabase \d+\]/.test(m)) { setState("error", prefix + m); return; }
    setState("offline", "连不上云端 · 会自动重试" + (_lastOkAt ? "（上次成功 " + hhmm(_lastOkAt) + "）" : ""));
  }

  function schedulePush(reason) {
    _dirty = true;
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(function () { doPush(reason); }, 1500);
  }
  async function doPush(reason) {
    if (navigator.onLine === false) { setState("offline", "设备离线，恢复网络后自动上传"); return; }
    setState("syncing", reason || "本地有改动，正在同步…");
    try {
      var local = snapshot();
      // 先读取云端当前数据，合并后再写回，避免覆盖另一台设备的数据
      var row = null;
      try { row = await readCloud(); } catch (e) { row = null; }
      var base = (row && row.data) ? row.data : {};
      var merged = mergeData(base, local);
      await writeCloud(merged);
      _lastOkAt = Date.now();
      _dirty = false;
      setMeta({ updatedAt: _lastOkAt });
      setState("ok", "已备份到云端 " + hhmm(_lastOkAt));
    } catch (e) {
      console.warn("[wb-sync] push fail:", e);
      failState(e, "同步失败：");
    }
  }

  /* ---- 定时自动备份 ---- */
  function autoBackup() {
    if (document.hidden) return;                    // 页面不可见时跳过，回来会补
    if (navigator.onLine === false) { setState("offline", "设备离线，恢复网络后自动上传"); return; }
    doPush("定时自动备份");
  }

  /**
   * 从云端拉取
   */
  async function pull(cb) {
    setState("syncing", "正在从云端加载…");
    try {
      var row = await readCloud();
      _lastOkAt = Date.now();
      if (row && row.data) {
        var changed = applyCloud(row.data);
        // 双向：若本地有云端没有的 key，补推一次（避免某设备不主动改动时数据滞留本地）
        var localSnap = snapshot();
        var cloudKeys = Object.keys(mergeData(row.data, {}));
        var hasLocalOnly = Object.keys(localSnap).some(function (k) { return cloudKeys.indexOf(k) < 0; });
        if (hasLocalOnly) schedulePush("补充本地独有数据到云端");
        setState("ok", "云端已连接 · 数据更新于 " + (row.updated_at ? hhmm(row.updated_at) : hhmm(_lastOkAt)));
        if (changed) {
          try { window.dispatchEvent(new Event("wb-cloud-applied")); } catch (e) {}
          // 拉到新数据后自动刷新页面以展示（正在输入则不刷新，等下次）
          var ae = document.activeElement;
          var editing = ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
          if (!editing) {
            setTimeout(function () { location.reload(); }, 400);
          }
        }
        if (cb) cb(true);
      } else {
        // 云端为空 → 首次使用，推送本地数据上去
        doPush("首次初始化云端");
        if (cb) cb(false);
      }
    } catch (e) {
      console.warn("[wb-sync] pull fail:", e);
      failState(e, "无法连接云端：");
      if (cb) cb(false, e);
    }
  }

  /* ---- Hook localStorage ---- */
  function hookStorage() {
    var origSet = Storage.prototype.setItem;
    var origRemove = Storage.prototype.removeItem;
    var origClear = Storage.prototype.clear;
    Storage.prototype.setItem = function (k, v) {
      var r = origSet.call(this, k, v);
      if (this === window.localStorage && !_pushing && isBizKey(k)) schedulePush("检测到修改");
      return r;
    };
    Storage.prototype.removeItem = function (k) {
      var r = origRemove.call(this, k);
      if (this === window.localStorage && !_pushing && isBizKey(k)) schedulePush("检测到删除");
      return r;
    };
    Storage.prototype.clear = function () {
      var r = origClear.call(this);
      if (this === window.localStorage && !_pushing) schedulePush("检测到清空");
      return r;
    };
  }

  /* ---- 初始化 ---- */
  var _inited = false;
  function init() {
    if (_inited) return;
    _inited = true;
    hookStorage();
    ensureUI();

    if (navigator.onLine === false) setState("offline", "设备当前离线");
    pull();

    /* 网络状态：断网立刻标红，恢复立刻拉取 */
    window.addEventListener("online", function () {
      setState("syncing", "网络恢复，正在重新连接…");
      pull();
    });
    window.addEventListener("offline", function () {
      setState("offline", "网络已断开 · 数据暂存本机");
    });

    /* 定时自动备份 */
    setInterval(autoBackup, AUTO_BACKUP_MS);

    /* 回到本页面时：拉一次云端，确保看到别的设备最新数据 */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (_dirty) doPush("离开页面前备份");
      } else {
        pull();
      }
    });

    /* 关闭前尽力把未上传的改动推上去 */
    window.addEventListener("pagehide", function () {
      if (!_dirty || navigator.onLine === false) return;
      try {
        var payload = JSON.stringify({ id: DATA_ID, data: snapshot(), updated_at: new Date().toISOString() });
        fetch(API_BASE + "/rest/v1/" + TABLE + "?on_conflict=id", {
          method: "POST", keepalive: true,
          headers: {
            "Content-Type": "application/json",
            "apikey": API_KEY,
            "Authorization": "Bearer " + API_KEY,
            "Prefer": "resolution=merge-duplicates"
          },
          body: payload
        });
      } catch (e) {}
    });

    if (elBtn) elBtn.addEventListener("click", function () { doPush("手动同步"); });
    if (elBtnPull) elBtnPull.addEventListener("click", function () { pull(); });
    if (elChip && elBar) {
      elChip.addEventListener("click", function () {
        var open = elBar.classList.toggle("open");
        elBar.style.display = open ? "flex" : "none";
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.WBSync = {
    init: init,
    push: function () { doPush("手动"); },
    pull: pull,
    state: function () { return _curState; }
  };
})();