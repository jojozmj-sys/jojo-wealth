/* ============================================================
 * JOJO发财之路 · 手动备份（零后端 / 零注册）
 * ------------------------------------------------------------
 * 当未配置云同步（LeanCloud 等）时，提供「导出 / 导入」按钮，
 * 把本地 localStorage 业务数据打包成 JSON 文件，通过任意方式
 * （微信文件传输 / AirDrop / 邮件 / U盘）在手机和电脑间搬运。
 * 一旦配置了云端（WB_SYNC.appId 不是占位符），本模块自动让位给 sync.js。
 * ============================================================ */
(function () {
  var CFG = window.WB_SYNC || {};
  var hasRealCloud = !!(CFG.enabled && (
    (CFG.supabaseUrl && CFG.supabaseUrl.indexOf("REPLACE") !== 0) ||
    (CFG.SecretId && CFG.SecretId.indexOf("REPLACE") !== 0) ||
    (CFG.envId && CFG.envId.indexOf("REPLACE") !== 0) ||
    (CFG.appId && CFG.appId.indexOf("REPLACE") !== 0)
  ));
  // 云端已配置时：不接管状态芯片，但仍在同步条里保留「导出 / 导入」按钮做兜底备份

  function bizSnapshot() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("wb_") === 0) out[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return out;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function exportData() {
    var data = bizSnapshot();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var d = new Date();
    a.download = "jojo-sync-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    flash("已导出 " + Object.keys(data).length + " 项数据");
  }

  function importData(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        if (typeof obj !== "object" || !obj) throw new Error("格式错误");
        var n = 0;
        Object.keys(obj).forEach(function (k) {
          if (k.indexOf("wb_") === 0) { localStorage.setItem(k, obj[k]); n++; }
        });
        flash("已导入 " + n + " 项，正在刷新…");
        setTimeout(function () { location.reload(); }, 700);
      } catch (e) {
        flash("导入失败：文件不是有效备份");
      }
    };
    reader.readAsText(file);
  }

  function flash(msg) {
    var bar = document.getElementById("wbSyncBar");
    var s = bar ? bar.querySelector(".wb-sync-status") : null;
    if (s) s.textContent = msg;
  }

  function init() {
    var bar = document.getElementById("wbSyncBar");
    var chip = document.getElementById("wbSyncChip");
    if (!bar) return;

    if (!hasRealCloud) {
      if (chip) {
        chip.textContent = "💾 数据备份 ▾";
        chip.className = "wb-sync-chip offline";
      }
      bar.hidden = false;
      bar.classList.add("manual");
      bar.classList.add("offline");
      bar.classList.add("open");          // 初始展开
      bar.style.display = "flex";         // 覆盖 .manual 的常显规则，交给内联控制

      // 隐藏云端按钮（未配置云端时无意义）
      var cloudBtn = bar.querySelector(".wb-sync-btn");
      if (cloudBtn) cloudBtn.style.display = "none";
      var pullBtn = bar.querySelector(".wb-sync-btn-pull");
      if (pullBtn) pullBtn.style.display = "none";

      var status = bar.querySelector(".wb-sync-status");
      if (status) status.textContent = "未连接云端 · 用下方按钮在设备间手动搬运数据";
    }

    var exp = document.createElement("button");
    exp.type = "button"; exp.className = "wb-sync-btn"; exp.textContent = "⬇ 导出备份";
    var imp = document.createElement("button");
    imp.type = "button"; imp.className = "wb-sync-btn"; imp.textContent = "⬆ 导入备份";
    var fileInput = document.createElement("input");
    fileInput.type = "file"; fileInput.accept = "application/json"; fileInput.hidden = true;

    bar.appendChild(exp);
    bar.appendChild(imp);
    bar.appendChild(fileInput);

    exp.addEventListener("click", exportData);
    imp.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
    });

    // 折叠：点击芯片切换展开/收起（仅无云端时接管，有云端时由 sync.js 负责）
    if (chip && !hasRealCloud) {
      chip.addEventListener("click", function () {
        var open = bar.classList.toggle("open");
        bar.style.display = open ? "flex" : "none";
        chip.textContent = open ? "💾 数据备份 ▾" : "💾 数据备份 ▴";
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
