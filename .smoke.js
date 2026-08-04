/* 冒烟测试：用 jsdom 加载页面，检查是否有 JS 报错，并验证三大功能的关键 DOM */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push("[jsdomError] " + (e.stack || e.message)));
vc.on("error", (...a) => errors.push("[console.error] " + a.join(" ")));

// 预置一些历史数据，验证归档渲染
const seed = {
  "wb_plan_text_2026-08-01": "9:00 晨会\n背单词30分钟\n重要: 写周报",
  "wb_plan_done_2026-08-01": JSON.stringify({ i0: 1, i1: 1, i2: 1 }),
  "wb_plan_text_2026-08-02": "健身1小时\n14:00-15:00 项目评审\n低: 买菜",
  "wb_plan_done_2026-08-02": JSON.stringify({ i0: 1 }),
  "wb_plan_text_2026-08-03": "读论文45分钟\n整理笔记",
  "wb_plan_done_2026-08-03": JSON.stringify({})
};

const dom = new JSDOM(html, {
  url: "http://localhost/",
  runScripts: "dangerously",
  resources: undefined,
  pretendToBeVisual: true,
  virtualConsole: vc
});

// 注入 seed 数据（在脚本执行前 localStorage 已可用）
Object.keys(seed).forEach(k => dom.window.localStorage.setItem(k, seed[k]));

// 手动按顺序执行本地脚本（jsdom 默认不加载外链）
const scripts = ["assets/data.js", "assets/config.js", "assets/sync.js", "assets/manual-sync.js", "assets/app.js"];
for (const s of scripts) {
  try {
    dom.window.eval(fs.readFileSync(path.join(root, s), "utf8"));
  } catch (e) {
    errors.push("[" + s + "] " + (e.stack || e.message));
  }
}

setTimeout(() => {
  const d = dom.window.document;
  const out = [];
  const chip = d.getElementById("wbSyncChip");
  out.push("同步芯片 class = " + (chip ? chip.className : "N/A") + " / 文案 = " + (chip ? chip.textContent.trim() : "N/A"));
  const ph = d.getElementById("planHistory");
  const days = ph ? ph.querySelectorAll("details.ph-day") : [];
  out.push("历史归档天数 = " + days.length);
  days.forEach(x => {
    const date = x.getAttribute("data-date");
    const stat = x.querySelector(".ph-stat");
    const n = x.querySelectorAll(".ph-tasks li").length;
    out.push("  · " + date + " → " + (stat ? stat.textContent : "?") + "，条目 " + n + (x.className.includes("all-done") ? "（全部完成）" : "") + (x.hasAttribute("open") ? " [展开]" : " [收起]"));
  });
  out.push("归档副标题 = " + (d.getElementById("phSub") ? d.getElementById("phSub").textContent : "N/A"));
  out.push("收起已完成开关存在 = " + !!d.getElementById("planHideDone"));

  // 自动保存：模拟在觉察日记里输入
  const djOne = d.getElementById("djOne");
  if (djOne) {
    djOne.value = "今天的一句话觉察";
    djOne.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  }
  const mfWish = d.getElementById("mfWish");
  if (mfWish) {
    mfWish.value = "我拥有自己的工作室";
    mfWish.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  }

  setTimeout(() => {
    const dj = dom.window.localStorage.getItem("wb_diary_records");
    const mf = dom.window.localStorage.getItem("wb_manifest_records");
    out.push("觉察日记自动保存 = " + (dj && dj.indexOf("今天的一句话觉察") >= 0 ? "✅ 已写入" : "❌ 未写入 → " + dj));
    out.push("显化日记自动保存 = " + (mf && mf.indexOf("我拥有自己的工作室") >= 0 ? "✅ 已写入" : "❌ 未写入 → " + mf));
    out.push("djMsg = " + (d.getElementById("djMsg") ? d.getElementById("djMsg").textContent : "N/A"));
    out.push("mfMsg = " + (d.getElementById("mfMsg") ? d.getElementById("mfMsg").textContent : "N/A"));

    console.log(out.join("\n"));
    console.log("\n--- 错误 (" + errors.length + ") ---");
    console.log(errors.slice(0, 12).join("\n") || "无");
    process.exit(0);
  }, 1200);
}, 600);
