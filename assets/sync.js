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

  /* 判断一个同步值是否为"空"（会被误认成数据被清空的形态） */
  function isEmptyVal(v) {
    if (v == null) return true;
    if (v === "") return true;
    if (typeof v === "string") {
      var t = v.trim();
      if (!t) return true;
      if (t === "null" || t === "undefined") return true;
      if (t === "[]" || t === "{}") return true;
      return false;
    }
    if (typeof v === "object") {
      if (Array.isArray(v)) return v.length === 0;
      var ks = Object.keys(v);
      if (ks.length === 0) return true;
      // 仅含空串/空子对象等"空壳"也视为空
      return ks.every(function (k) { return isEmptyVal(v[k]); });
    }
    return false;
  }

  /* 合并：云端已有数据 + 本地数据（本地优先，云端独有 key 保留）
   * 关键保护：空值（""/[]/{}/null）永远不覆盖有值的一端，
   * 避免「某台设备 localStorage 被清空后，把空数据推上云端、再传播到其他所有设备」的数据丢失。 */
  function mergeData(cloud, local) {
    var base = {};
    try {
      base = (typeof cloud === "string") ? JSON.parse(cloud) : (cloud || {});
    } catch (e) { base = {}; }
    var merged = {};
    Object.keys(base).forEach(function (k) { merged[k] = base[k]; });
    Object.keys(local).forEach(function (k) {
      var lv = local[k];
      var cv = base[k];
      if (isEmptyVal(lv) && !isEmptyVal(cv)) return; /* 本地空 + 云端有值 → 保留云端，防误清空 */
      merged[k] = lv;
    });
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

  /* 同步看门狗：进入「同步中」后 30s 内必须离开该状态，否则强制转离线，
   * 防止任何请求永久挂起导致芯片永远显示「同步中」。 */
  var _watchdog = null;
  var SYNC_WATCHDOG_MS = CFG.syncWatchdogMs || 30000;

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
    /* 看门狗只在 syncing 状态启动 */
    if (_curState === "syncing") {
      clearTimeout(_watchdog);
      _watchdog = setTimeout(function () {
        if (_curState === "syncing") {
          console.warn("[wb-sync] 同步 30s 无响应，强制转离线（将自动重试）");
          setState("offline", "云端长时间无响应 · 自动重试中");
        }
      }, SYNC_WATCHDOG_MS);
    } else {
      clearTimeout(_watchdog);
    }
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
  /* 记录本地 biz key 的写入时间，用于 applyCloud 判断本地是否比云端快照更新（避免 pull 用旧云端值覆盖本地刚写入的数据）
   * catch: 应用云端数据期间（_pushing=true）的写入不记录，避免把"拉取结果"误判为本地新操作 */
  var _localWrites = {};        // { key: timestamp }
  /* 初始化期保护：sync 首次 pull 完成前发生的本地写入（如 stock IIFE 首次写入默认 5 只股票）不享受"本地优先"保护，
   * 让云端真实数据能正常覆盖默认值恢复；首次 pull 完成后才记录用户交互写入 */
  var _syncReady = false;
  var INIT_GUARD_WINDOW = 10000;   // 本地写入保护窗口（毫秒）

  function applyCloud(cloudData) {
    if (!cloudData) return false;
    var changed = false;
    var now = Date.now();
    _pushing = true;
    try {
      Object.keys(cloudData).forEach(function (k) {
        var cv = cloudData[k];
        var lv = localStorage.getItem(k);
        /* 空值保护：云端某 key 为空而本地有值时，不覆盖本地（防云端被别的设备清空后传染到本端） */
        if (isEmptyVal(cv) && !isEmptyVal(lv)) return;
        /* 本地近期写入保护：本地在该 key 上有 10s 内的修改（用户主动操作）且 push 可能尚未完成 →
         * 保留本地值，不被云端旧快照覆盖。
         * 这是"自选股无法储存"Bug 的根因修复：addQuote 写本地 → push 延迟 1.5s →
         * pull 读到云端旧数据 → applyCloud 覆盖 → 刷新后自选股消失。
         * 但初始化期（首次 pull 尚未完成）的本地写入不受保护，以便云端真实数据覆盖默认值完成恢复。 */
        if (_syncReady && _localWrites[k] && (now - _localWrites[k] < INIT_GUARD_WINDOW)) return;
        if (lv !== cv) { localStorage.setItem(k, cv); changed = true; }
      });
    } finally { _pushing = false; }
    return changed;
  }

  /* ---- Supabase REST API 操作（前端直连） ---- */

  /**
   * 直接 fetch https://<项目>.supabase.co/rest/v1/<table>
   * 不再经过 server.js 代理（CORS 已放行 *）
   * 关键防呆：请求带 AbortController 超时（默认 15s）。
   * 此前无超时 → 移动网络下 supabase.co 偶发挂起时 Promise 永不落定，
   * 状态芯片永远停在「同步中」。超时后抛 [Supabase timeout]，由 failState 转为错误态并自动重试。
   */
  var REQ_TIMEOUT_MS = CFG.reqTimeoutMs || 15000;
  function apiRequest(method, restPath, body) {
    var url = API_BASE + restPath;
    var ctl = (typeof AbortController !== "undefined") ? new AbortController() : null;
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
    if (ctl) opts.signal = ctl.signal;
    if (body) opts.body = JSON.stringify(body);
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, REQ_TIMEOUT_MS) : null;
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
    }, function (e) {
      /* fetch 拒绝：区分「主动超时」与「网络层错误」 */
      if (ctl && e && e.name === "AbortError") {
        throw new Error("[Supabase timeout] 云端请求超时（" + (REQ_TIMEOUT_MS / 1000) + "s），已转入离线，将自动重试");
      }
      throw e;
    }).finally(function () { if (timer) clearTimeout(timer); });
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
     只有服务器真的响应了（消息以 [Supabase 状态码] 开头）或明确超时（[Supabase timeout]）才算接口异常，
     其余一律视为未连接（断网 / DNS / CORS / 项目被暂停…）。 */
  function failState(e, prefix) {
    var m = (e && e.message ? e.message : String(e || ""));
    if (/^\[Supabase (\d+|timeout)\]/.test(m)) { setState("error", prefix + m); return; }
    setState("offline", "连不上云端 · 会自动重试" + (_lastOkAt ? "（上次成功 " + hhmm(_lastOkAt) + "）" : ""));
  }

  function schedulePush(reason) {
    _dirty = true;
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(function () { doPush(reason); }, 1500);
  }
  /* 单飞保护：一次只允许一个推送请求在途，防止频繁写入时多个读改写请求并发堆积 */
  var _pushBusy = false;
  async function doPush(reason) {
    if (navigator.onLine === false) { setState("offline", "设备离线，恢复网络后自动上传"); return; }
    if (_pushBusy) { _dirty = true; return; }   /* 已在途：标记脏，由在途推送收尾时补推 */
    _pushBusy = true;
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
    } finally {
      _pushBusy = false;
      /* 推送期间又有新写入 → 收尾后再推一轮，避免漏传 */
      if (_dirty) schedulePush("补传新改动");
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
   * 单飞保护：避免 visibilitychange / 手动按钮并发触发多个 pull 堆积
   */
  var _pullBusy = false;
  var RELOAD_CAP_KEY = "wb_sync_reload_guard";   // sessionStorage 键：本次会话自动刷新次数（防无限刷新循环）
  var RELOAD_CAP_WINDOW = 30000;                 // 时间窗 ms
  var RELOAD_CAP_MAX = 2;                        // 时间窗内最多自动刷新次数
  async function pull(cb) {
    if (_pullBusy) { if (cb) cb(false, new Error("busy")); return; }
    _pullBusy = true;
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
          /* 拉到新数据后自动刷新页面以展示（正在输入则不刷新，等下次）。
           * ⚠️ 防无限刷新：若存在「每次加载都会写差异 wb_ 键」的模块，本地与云端永远有差，
           * 无限制 reload 会造成页面循环刷新、同步状态永远停在「同步中」。
           * 这里用 sessionStorage 计数，30s 内最多自动刷新 2 次，达到上限后只派事件、不再刷新。 */
          var rn = 0, rt = 0;
          try { var rm = JSON.parse(sessionStorage.getItem(RELOAD_CAP_KEY) || "{}"); rn = rm.n || 0; rt = rm.t || 0; } catch (e) {}
          var now = Date.now();
          if (now - rt > RELOAD_CAP_WINDOW) rn = 0;
          var ae = document.activeElement;
          var editing = ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
          var uiBusy = !!(window.__wbUiBusy); // 选股等长任务进行中，不自动刷新打断
          if (!editing && !uiBusy && rn < RELOAD_CAP_MAX) {
            try { sessionStorage.setItem(RELOAD_CAP_KEY, JSON.stringify({ n: rn + 1, t: now })); } catch (e) {}
            setTimeout(function () {
              // 定时器触发前若长任务已开始，取消刷新，避免打断选股等流程
              if (window.__wbUiBusy) return;
              location.reload();
            }, 400);
          } else {
            console.warn("[wb-sync] 云端数据已应用，自动刷新达到上限，跳过刷新（数据事件已派发）");
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
    } finally {
      /* 首次拉取尝试结束（无论成败）：之后用户写入才受本地优先保护，
       * 同时初始化期写下的默认数据已不再阻挡云端恢复 */
      _syncReady = true;
      _pullBusy = false;
    }
  }

  /* ---- Hook localStorage ---- */
  function hookStorage() {
    var origSet = Storage.prototype.setItem;
    var origRemove = Storage.prototype.removeItem;
    var origClear = Storage.prototype.clear;
    Storage.prototype.setItem = function (k, v) {
      var r = origSet.call(this, k, v);
      if (this === window.localStorage && !_pushing && isBizKey(k)) {
        if (_syncReady) _localWrites[k] = Date.now();  /* 记录本地写入时间，applyCloud 据此跳过近期覆盖 */
        schedulePush("检测到修改");
      }
      return r;
    };
    Storage.prototype.removeItem = function (k) {
      var r = origRemove.call(this, k);
      if (this === window.localStorage && !_pushing && isBizKey(k)) {
        if (_syncReady) _localWrites[k] = Date.now();
        schedulePush("检测到删除");
      }
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