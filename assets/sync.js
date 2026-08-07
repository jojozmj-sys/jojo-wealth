/* ============================================================
 * JOJO发财之路 · 云端同步层（Supabase 直连 REST API）
 * ------------------------------------------------------------
 * 同步模型：双向对等（手机端 / 电脑端都是数据生产者）
 *   - 任何一端写入 localStorage → 记录 per-key 时间戳 → 上传云端
 *   - 另一端（含页面保持打开时）定时/事件触发拉取 → 应用更新
 *   - 冲突解决：按 key 时间戳，较新一方生效（谁最新谁说了算）
 *   - 删除用墓碑同步：本机删 → 云端标记墓碑 → 另一端删除该 key
 *   - 空值保护：某端被清空不传染其他端（空值不覆盖有值端）
 *
 * 数据格式（云端 data JSONB）：
 *   {
 *     "wb_key1": "value1",                        ← 业务数据
 *     "__sync_meta": {                            ← 同步元数据（本文件私有）
 *       "ts":   { "wb_key1": 1720000000000 },      ← 每个 key 最后修改时间戳
 *       "tomb": { "wb_key3": 1720000000500 }       ← 墓碑：云端需删除的 key
 *     }
 *   }
 * ============================================================ */
(function () {
  var CFG = window.WB_SYNC || {};

  var TABLE = CFG.table || "user_data";
  var DATA_ID = CFG.dataId || "jojo";
  var API_BASE = (CFG.supabaseUrl || "").replace(/\/$/, "");
  var API_KEY = CFG.supabaseKey || "";
  var LS_KEY = "wb_sync_meta";
  var AUTO_BACKUP_MS = CFG.autoBackupMs || 3 * 60 * 1000; // 定时自动备份周期
  /* 页面保持打开时主动拉取周期：让另一端更新在本端自动出现 */
  var AUTO_PULL_MS = CFG.autoPullMs || 45000;

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
      return ks.every(function (k) { return isEmptyVal(v[k]); });
    }
    return false;
  }

  /* ---- 同步元数据（per-key 时间戳 + 墓碑） ---- */
  var META_KEY = "__sync_meta";
  function emptyMeta() { return { ts: {}, tomb: {} }; }
  function normalizeMeta(m) {
    if (!m || typeof m !== "object") return emptyMeta();
    return {
      ts: (m.ts && typeof m.ts === "object") ? m.ts : {},
      tomb: (m.tomb && typeof m.tomb === "object") ? m.tomb : {}
    };
  }
  /* 从云端 data 中剥离业务 key 与元数据 */
  function splitCloud(data) {
    var biz = {};
    var meta = emptyMeta();
    if (!data || typeof data !== "object") return { biz: biz, meta: meta };
    Object.keys(data).forEach(function (k) {
      if (k === META_KEY) { meta = normalizeMeta(data[k]); return; }
      if (isBizKey(k)) biz[k] = data[k];
    });
    return { biz: biz, meta: meta };
  }
  function packCloud(biz, meta) {
    var out = {};
    Object.keys(biz).forEach(function (k) { out[k] = biz[k]; });
    out[META_KEY] = normalizeMeta(meta);
    return out;
  }

  /* 本地 per-key 写入时间戳：持久化到 wb_sync_meta（兼容 localStorage 同步） */
  function localTs() {
    var m = getMeta();
    return (m.ts && typeof m.ts === "object") ? m.ts : {};
  }
  function touchLocalTs(k, ts) {
    var m = getMeta();
    if (!m.ts || typeof m.ts !== "object") m.ts = {};
    m.ts[k] = ts || Date.now();
    setMeta(m);
  }
  /* 记录本地墓碑（删除）：key → 删除时刻，持久化，供 doPush 把删除同步上云端 */
  function markLocalTomb(k) {
    var m = getMeta();
    if (!m.tomb || typeof m.tomb !== "object") m.tomb = {};
    m.tomb[k] = Date.now();
    setMeta(m);
  }
  function clearLocalTomb(k) {
    var m = getMeta();
    if (m.tomb && m.tomb[k]) { delete m.tomb[k]; setMeta(m); }
  }
  function localTombTs(k) {
    var m = getMeta();
    return (m.tomb && m.tomb[k]) ? m.tomb[k] : 0;
  }

  /* ---- UI ---- */
  var elBar = null, elText = null, elBtn = null, elBtnPull = null, elBtnOverwrite = null, elStatus = null, elChip = null;
  var _curState = "";
  /* 四态文案：已连接 / 同步中 / 未连接 / 同步异常 */
  var STATE_TEXT = {
    ok:      { chip: "已连接",  bar: "云端已连接 · 双端自动同步" },
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
      elBtnOverwrite = elBar.querySelector(".wb-sync-btn-overwrite");
      elStatus = elBar.querySelector(".wb-sync-status");
    }
  }

  /* 同步看门狗：进入「同步中」后若长时间未离开该状态（默认 60s，须大于请求超时，
   * 避免慢网络下合法请求先被看门狗误判），强制转离线，防止任何请求永久挂起
   * 导致芯片永远显示「同步中」。 */
  var _watchdog = null;
  var SYNC_WATCHDOG_MS = CFG.syncWatchdogMs || (CFG.reqTimeoutMs || 30000) + 30000;

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
          console.warn("[wb-sync] 同步 " + (SYNC_WATCHDOG_MS / 1000) + "s 无响应，强制转离线（将自动重试）");
          _lastFailAt = Date.now();
          _dirty = false;
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
  /* 初始化期保护：sync 首次 pull 完成前发生的本地写入（如 stock IIFE 首次写入默认 5 只股票）不记录时间戳、
   * 不推送，让云端真实数据能正常覆盖默认值恢复 */
  var _syncReady = false;
  var _initPhase = true;
  var _cloudHasData = false;
  var _firstPullDispatched = false;

  /* 拉取完成后，各业务模块重渲染（不只概览），让自选股/知识库即时刷新 */
  function dispatchCloudApplied() {
    try { window.dispatchEvent(new Event("wb-cloud-applied")); } catch (e) {}
    /* 兼容旧版：旧代码监听 storage 事件刷新概览；这里再发一个刷新事件 */
    try { window.dispatchEvent(new Event("wb-cloud-applied-all")); } catch (e) {}
  }

  /* 读取某 key 的本地最后写入时间（持久化在 wb_sync_meta.ts） */
  function localWriteTimeFor(k) {
    var t = localTs()[k];
    return t || 0;
  }

  /* ---- 双向对等合并核心 ----
   * 目标：本地 + 云端都可能有数据，任一端更新都应收敛到云端。
   * 规则（对每个 key 独立判断）：
   *   两端都无此 key → 跳过
   *   仅云端有 → 本地缺失，保持云端（doPush 不推；pull 应用到本地）
   *   仅本地有 → 本端新增，推云端（pushBiz）
   *   两端都有 → 取 ts 较大者：本地新则推本地值，云端新则保留云端
   *   本地墓碑（本端删）→ 云端 ts <= 墓碑时刻则推墓碑删除云端；否则云端更新过，保留云端
   *   云端墓碑（另一端删）→ 本地 ts <= 墓碑时刻则本端删（pull 应用）；否则本地更新过，回传本地
   *   空值保护：某端 key 为空而另一端有值 → 保留有值端（不传染清空）
   * 返回 { pushBiz, pushTs, pushTomb }：需要写回云端的增量（可能为空 = 云端已最新）
   */
  function mergeBidirectional(cloudBiz, cloudMeta, localBiz, localTombMap) {
    var pushBiz = {};
    var pushTs = {};
    var pushTomb = {};
    var cloudTs = cloudMeta.ts || {};
    var cloudTomb = cloudMeta.tomb || {};

    var allKeys = {};
    Object.keys(cloudBiz).forEach(function (k) { allKeys[k] = 1; });
    Object.keys(localBiz).forEach(function (k) { allKeys[k] = 1; });
    Object.keys(cloudTomb).forEach(function (k) { allKeys[k] = 1; });
    Object.keys(localTombMap).forEach(function (k) { allKeys[k] = 1; });

    Object.keys(allKeys).forEach(function (k) {
      var cHas = Object.prototype.hasOwnProperty.call(cloudBiz, k);
      var lHas = Object.prototype.hasOwnProperty.call(localBiz, k);
      var cT = cloudTs[k] || 0;
      var lT = localWriteTimeFor(k);
      var lTomb = localTombMap[k] || 0;   /* 本地删除时刻 */
      var cTomb = cloudTomb[k] || 0;      /* 云端删除时刻 */
      var cVal = cloudBiz[k];
      var lVal = localBiz[k];

      /* A. 本地墓碑：本端删除了该 key */
      if (!lHas && lTomb > 0) {
        /* 云端更新时刻 <= 本地删除时刻 → 云端仍是旧值，推墓碑删除它 */
        if (cHas && cT <= lTomb) { pushTomb[k] = lTomb; pushTs[k] = lTomb; }
        /* 云端更新时刻 > 本地删除时刻 → 云端有更新，保留云端（不推墓碑） */
        /* 若云端本身也是墓碑则已收敛，无需处理 */
        return;
      }

      /* B. 云端墓碑：另一端删除了该 key */
      if (!cHas && cTomb > 0) {
        /* 本地更新时刻 > 云端删除时刻 → 本地有更新的写入，回传本地（复活该 key） */
        if (lHas && lT > cTomb) { pushBiz[k] = lVal; pushTs[k] = lT; }
        /* 否则本地是旧值，由 pull 应用删除到本地 */
        return;
      }

      /* C. 仅云端有 */
      if (!lHas) {
        /* 本地缺失该 key：不推（保留云端），由 pull 应用 */
        return;
      }

      /* D. 仅本地有 */
      if (!cHas) {
        /* 本端新增：推云端 */
        pushBiz[k] = lVal;
        pushTs[k] = Math.max(lT, Date.now());
        return;
      }

      /* E. 两端都有 → 空值保护 + 时间戳较新者胜 */
      if (isEmptyVal(lVal) && !isEmptyVal(cVal)) {
        /* 本地为空 + 云端有值 → 保留云端（不把本端清空传染） */
        return;
      }
      if (isEmptyVal(cVal) && !isEmptyVal(lVal)) {
        /* 云端为空 + 本地有值 → 保留本地并回传（云端清空不传染本端） */
        pushBiz[k] = lVal;
        pushTs[k] = Math.max(lT, cT, Date.now());
        return;
      }
      if (lT >= cT) {
        /* 本地较新（或同刻，本地优先）→ 推本地值 */
        pushBiz[k] = lVal;
        pushTs[k] = lT;
      }
      /* 云端较新 → 保留云端（不推），由 pull 应用 */
    });

    return { pushBiz: pushBiz, pushTs: pushTs, pushTomb: pushTomb };
  }

  /* ---- Supabase REST API 操作（前端直连） ---- */
  var REQ_TIMEOUT_MS = CFG.reqTimeoutMs || 30000;
  var REQ_RETRY = CFG.reqRetry || 2;
  var REQ_RETRY_BACKOFF = CFG.reqRetryBackoffMs || 800;

  function apiRequest(method, restPath, body, _attempt) {
    var attempt = _attempt || 0;
    var url = API_BASE + restPath;
    var timeout = attempt === 0 ? REQ_TIMEOUT_MS : Math.min(REQ_TIMEOUT_MS, 8000);
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
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, timeout) : null;
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
      if (ctl && e && e.name === "AbortError") {
        throw new Error("[Supabase timeout] 云端请求超时（" + (timeout / 1000) + "s），已转入离线，将自动重试");
      }
      throw e;
    }).catch(function (e) {
      var retriable = method === "GET" || method === "PATCH" ||
        (method === "POST" && !body) ||
        /^\[Supabase (timeout|0)\]/.test((e && e.message) ? e.message : "");
      if (retriable && attempt < REQ_RETRY) {
        var wait = REQ_RETRY_BACKOFF * (attempt + 1);
        return new Promise(function (resolve) { setTimeout(resolve, wait); })
          .then(function () { return apiRequest(method, restPath, body, attempt + 1); });
      }
      throw e;
    }).finally(function () { if (timer) clearTimeout(timer); });
  }

  /* 从云端读取整行 */
  function readCloud() {
    return apiRequest("GET", "/rest/v1/" + TABLE + "?id=eq." + DATA_ID + "&select=data,updated_at")
      .then(function (rows) {
        if (!rows || rows.length === 0) return null;
        var row = rows[0];
        if (typeof row.data === "string") {
          try { row.data = JSON.parse(row.data); } catch (e) { return null; }
        }
        return row;
      });
  }

  /* 写入/更新云端行（upsert） */
  function writeCloud(data) {
    return apiRequest("POST", "/rest/v1/" + TABLE, {
      id: DATA_ID,
      data: data,
      updated_at: new Date().toISOString()
    }).catch(function (e) {
      if (e.message.indexOf("409") >= 0) {
        return apiRequest("PATCH", "/rest/v1/" + TABLE + "?id=eq." + DATA_ID, {
          data: data,
          updated_at: new Date().toISOString()
        });
      }
      throw e;
    }).then(function (r) {
      return r;
    });
  }

  /* ---- 推送到云端（防抖 + 双向对等合并） ---- */
  var _timer = null;
  var _dirty = false;
  var _lastOkAt = 0;
  var _lastFailAt = 0;

  function hhmm(ts) {
    return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  function failState(e, prefix) {
    var m = (e && e.message ? e.message : String(e || ""));
    if (/^\[Supabase (\d+|timeout)\]/.test(m)) { setState("error", prefix + m); return; }
    setState("offline", "连不上云端 · 会自动重试" + (_lastOkAt ? "（上次成功 " + hhmm(_lastOkAt) + "）" : ""));
  }

  function schedulePush(reason) {
    _dirty = true;
    if (_timer) clearTimeout(_timer);
    var delay = 1500;
    if (_lastFailAt && (Date.now() - _lastFailAt < 20000)) delay = 5000 + Math.min(15000, Date.now() - _lastFailAt);
    _timer = setTimeout(function () { doPush(reason); }, delay);
  }
  var _pushBusy = false;
  async function doPush(reason) {
    if (navigator.onLine === false) { setState("offline", "设备离线，恢复网络后自动上传"); return; }
    if (_pushBusy) { _dirty = true; return; }
    _pushBusy = true;
    setState("syncing", reason || "本地有改动，正在同步…");
    try {
      var local = snapshot();
      var row = await readCloud();
      if (!row || !row.data) {
        /* 云端为空：整体上传本机快照（含时间戳） */
        var initBiz = {};
        var initTs = {};
        Object.keys(local).forEach(function (k) {
          initBiz[k] = local[k];
          initTs[k] = localWriteTimeFor(k) || Date.now();
        });
        await writeCloud(packCloud(initBiz, { ts: initTs, tomb: {} }));
        _lastOkAt = Date.now();
        _dirty = false;
        setMeta({ updatedAt: _lastOkAt });
        setState("ok", "已同步到云端 " + hhmm(_lastOkAt));
        return;
      }
      var sc = splitCloud(row.data);
      var cloudBiz = sc.biz, cloudMeta = sc.meta;
      var localTombMap = {};
      var m = getMeta();
      if (m.tomb) {
        Object.keys(m.tomb).forEach(function (k) {
          if (isBizKey(k) && !Object.prototype.hasOwnProperty.call(local, k)) localTombMap[k] = m.tomb[k];
        });
      }
      var res = mergeBidirectional(cloudBiz, cloudMeta, local, localTombMap);
      var pushBiz = res.pushBiz, pushTs = res.pushTs, pushTomb = res.pushTomb;

      var hasChanges = Object.keys(pushBiz).length > 0 || Object.keys(pushTs).length > 0 || Object.keys(pushTomb).length > 0;
      if (hasChanges) {
        var newCloud = packCloud(cloudBiz, cloudMeta);
        Object.keys(pushBiz).forEach(function (k) { newCloud[k] = pushBiz[k]; });
        Object.keys(pushTomb).forEach(function (k) {
          delete newCloud[k];
          if (!newCloud[META_KEY]) newCloud[META_KEY] = { ts: {}, tomb: {} };
          newCloud[META_KEY].tomb[k] = pushTomb[k];
          delete newCloud[META_KEY].ts[k];
        });
        Object.keys(pushTs).forEach(function (k) {
          if (!newCloud[META_KEY]) newCloud[META_KEY] = { ts: {}, tomb: {} };
          newCloud[META_KEY].ts[k] = pushTs[k];
        });
        await writeCloud(newCloud);
      }
      _lastOkAt = Date.now();
      _dirty = false;
      setMeta({ updatedAt: _lastOkAt });
      setState("ok", "已同步到云端 " + hhmm(_lastOkAt));
    } catch (e) {
      console.warn("[wb-sync] push fail:", e);
      _lastFailAt = Date.now();
      failState(e, "同步失败：");
    } finally {
      _pushBusy = false;
      if (_dirty) schedulePush("补传新改动");
    }
  }

  /* ---- 本机覆盖云端（应急恢复） ----
   * 不走合并：直接用本机全部 wb_ 数据整体替换云端，
   * 用于云端被默认值/空值污染、需要以某台可信设备为准的恢复场景。 */
  var _overwriteBusy = false;
  async function overwriteCloud(reason) {
    if (navigator.onLine === false) { setState("offline", "设备离线，无法覆盖云端"); return false; }
    if (_pushBusy || _overwriteBusy) {
      if (window.appToast) window.appToast("同步进行中，请稍后再试", 2400, "warn");
      return false;
    }
    _overwriteBusy = true;
    setState("syncing", reason || "正在用本机数据覆盖云端…");
    try {
      var local = snapshot();
      var ts = {};
      Object.keys(local).forEach(function (k) { ts[k] = localWriteTimeFor(k) || Date.now(); });
      await writeCloud(packCloud(local, { ts: ts, tomb: {} }));
      _lastOkAt = Date.now();
      _dirty = false;
      setMeta({ updatedAt: _lastOkAt, overwrittenAt: _lastOkAt });
      setState("ok", "已用本机数据覆盖云端 " + hhmm(_lastOkAt));
      return true;
    } catch (e) {
      console.warn("[wb-sync] overwrite fail:", e);
      _lastFailAt = Date.now();
      failState(e, "覆盖失败：");
      return false;
    } finally {
      _overwriteBusy = false;
    }
  }

  /* ---- 定时自动备份（只推送本地改动到云端） ---- */
  function autoBackup() {
    if (document.hidden) return;
    if (navigator.onLine === false) { setState("offline", "设备离线，恢复网络后自动上传"); return; }
    doPush("定时自动备份");
  }

  /* ---- 定时主动拉取：让另一端更新在本端自动出现（页面保持打开时） ---- */
  function autoPull() {
    if (document.hidden) return;          /* 页面不可见时跳过，回来自动补 */
    if (navigator.onLine === false) return;
    pull("自动拉取另一端更新");
  }

  /* 首次成功拉取完成：通知业务模块云端结果，便于延迟初始化默认值（如自选股默认 5 只）。 */
  function dispatchFirstPull() {
    if (_firstPullDispatched) return;
    _firstPullDispatched = true;
    try {
      window.dispatchEvent(new CustomEvent("wb-sync-first-pull", {
        detail: { ok: true, hasCloud: _cloudHasData }
      }));
    } catch (e) {}
  }

  /**
   * 从云端拉取（双向对等：云端较新则应用到本地）
   */
  var _pullBusy = false;
  var RELOAD_CAP_KEY = "wb_sync_reload_guard";
  var RELOAD_CAP_WINDOW = 30000;
  var RELOAD_CAP_MAX = 2;
  async function pull(reason) {
    if (_pullBusy) { return; }
    _pullBusy = true;
    setState("syncing", reason || "正在从云端加载…");
    try {
      var row = await readCloud();
      _lastOkAt = Date.now();
      _initPhase = false;
      _cloudHasData = !!(row && row.data && !isEmptyVal(row.data));
      if (row && row.data) {
        var sc = splitCloud(row.data);
        var cloudBiz = sc.biz, cloudMeta = sc.meta;
        var cloudTs = cloudMeta.ts || {};
        var cloudTomb = cloudMeta.tomb || {};
        var changed = false;
        var pushNeeded = false;
        var now = Date.now();
        _pushing = true;
        try {
          /* 1) 应用云端"较新"的值到本地（本地较新的 key 不动，稍后由 doPush 回传）
           *    与 mergeBidirectional 决策一致：云端 ts > 本地 ts 才应用；空值保护：云端空值不覆盖本地有值 */
          Object.keys(cloudBiz).forEach(function (k) {
            var cv = cloudBiz[k];
            var lv = localStorage.getItem(k);
            /* 空值保护：云端为空而本地有值 → 不覆盖（防云端清空传染），且本端有值需回传 */
            if (isEmptyVal(cv) && !isEmptyVal(lv)) { pushNeeded = true; return; }
            var lTs = localWriteTimeFor(k);
            var cTs = cloudTs[k] || 0;
            /* 本地该 key 更新较新（时间戳更大）→ 保留本地，稍后回传 */
            if (lTs > cTs && lv !== null) { pushNeeded = true; return; }
            /* 否则应用云端值 */
            if (lv !== cv) { localStorage.setItem(k, cv); changed = true; }
          });
          /* 2) 应用云端墓碑：本端删除被另一端删除的 key（若本地不是更新过的较新值） */
          Object.keys(cloudTomb).forEach(function (k) {
            if (Object.prototype.hasOwnProperty.call(cloudBiz, k)) return; /* 该 key 有值，非墓碑 */
            var lv = localStorage.getItem(k);
            if (lv === null) { clearLocalTomb(k); return; }
            var lTs = localWriteTimeFor(k);
            var cTomb = cloudTomb[k];
            if (lTs <= cTomb) {
              /* 本地是旧值（未更新过）→ 跟随另一端删除 */
              localStorage.removeItem(k);
              changed = true;
              clearLocalTomb(k);
            } else {
              /* 本地较新（删除后又重新写入）→ 保留并回传 */
              pushNeeded = true;
            }
          });
        } finally { _pushing = false; }

        if (pushNeeded) schedulePush("本端有更新的数据回传云端");

        setState("ok", "云端已连接 · 数据更新于 " + (row.updated_at ? hhmm(row.updated_at) : hhmm(_lastOkAt)));
        if (changed) {
          dispatchCloudApplied();
          /* 自动刷新展示（带防无限刷新上限） */
          var rn = 0, rt = 0;
          try { var rm = JSON.parse(sessionStorage.getItem(RELOAD_CAP_KEY) || "{}"); rn = rm.n || 0; rt = rm.t || 0; } catch (e) {}
          if (now - rt > RELOAD_CAP_WINDOW) rn = 0;
          var ae = document.activeElement;
          var editing = ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
          var uiBusy = !!(window.__wbUiBusy);
          if (!editing && !uiBusy && rn < RELOAD_CAP_MAX) {
            try { sessionStorage.setItem(RELOAD_CAP_KEY, JSON.stringify({ n: rn + 1, t: now })); } catch (e) {}
            setTimeout(function () {
              if (window.__wbUiBusy) return;
              location.reload();
            }, 400);
          }
        }
      } else {
        /* 云端为空 → 首次使用，推送本地数据上去 */
        doPush("首次初始化云端");
      }
      dispatchFirstPull();
    } catch (e) {
      console.warn("[wb-sync] pull fail:", e);
      failState(e, "无法连接云端：");
    } finally {
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
        var ts = Date.now();
        /* 写入该 key → 清掉该 key 的本地墓碑（重写 = 复活） */
        clearLocalTomb(k);
        if (_syncReady && !_initPhase) {
          touchLocalTs(k, ts);              /* 记录 per-key 时间戳 */
          schedulePush("检测到修改");
        }
      }
      return r;
    };
    Storage.prototype.removeItem = function (k) {
      var r = origRemove.call(this, k);
      if (this === window.localStorage && !_pushing && isBizKey(k)) {
        if (_syncReady && !_initPhase) {
          markLocalTomb(k);                  /* 记录墓碑（删除时刻） */
          schedulePush("检测到删除");
        }
      }
      return r;
    };
    Storage.prototype.clear = function () {
      var r = origClear.call(this);
      if (this === window.localStorage && !_pushing && !_initPhase) schedulePush("检测到清空");
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

    /* 定时自动备份（推送本地改动） */
    setInterval(autoBackup, AUTO_BACKUP_MS);
    /* 定时主动拉取（让另一端更新在本端自动出现） */
    setInterval(autoPull, AUTO_PULL_MS);

    /* 回到本页面时：拉一次云端，确保看到别的设备最新数据 */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (_dirty) doPush("离开页面前备份");
      } else {
        pull("回到页面，拉取最新");
      }
    });

    /* 关闭前尽力把未上传的改动推上去 */
    window.addEventListener("pagehide", function () {
      if (!_dirty || navigator.onLine === false) return;
      try {
        var payload = JSON.stringify({ id: DATA_ID, data: packCloud(snapshot(), { ts: localTs(), tomb: (getMeta().tomb || {}) }), updated_at: new Date().toISOString() });
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
    if (elBtnPull) elBtnPull.addEventListener("click", function () { pull("手动同步"); });
    if (elBtnOverwrite) elBtnOverwrite.addEventListener("click", function () {
      var sure = window.confirm("确认用本机数据覆盖云端？\n\n云端现有数据将被整体替换，只保留本机内容。请先确认本机自选股、知识库等数据无误后再执行。");
      if (!sure) return;
      overwriteCloud("手动覆盖云端");
    });
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
    push: function () { return doPush("手动"); },
    pull: function () { return pull("手动"); },
    state: function () { return _curState; },
    initialState: function () {
      return { done: !_initPhase, ok: !_initPhase, hasCloud: _cloudHasData };
    },
    overwriteCloud: overwriteCloud
  };
})();
