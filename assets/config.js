/* JOJO发财之路 · 云同步配置
 * 后端：Supabase（前端直连 REST API）
 * ------------------------------------------------------------
 * 架构：
 *   前端 sync.js → 浏览器直接 fetch https://<项目>.supabase.co/rest/v1/...
 *   → Supabase REST API（CORS 已放行 *，不受前端 DNS 污染影响）
 *   → 不再经过 server.js 代理（proxyBase 字段已废弃，保留仅为兼容旧注释）
 *
 * 前置条件（关键！）：
 *   ① 确保 Supabase 项目处于 Active 状态（非 Paused）
 *     - 免费项目超过 7 天不活跃会自动暂停（DNS 变为 NXDOMAIN）
 *     - 登录 https://supabase.com/dashboard → 找到项目 → Resume/恢复
 *     - 恢复后约 1-2 分钟 DNS 生效
 *   ② 确保 user_data 表已创建（SQL 见 supabase-setup.sql，在 SQL Editor 执行）
 * ------------------------------------------------------------ */
window.WB_SYNC = {
  enabled: true,
  provider: "supabase",

  /* 你的 Supabase 项目信息（前端直连用） */
  supabaseUrl: "https://aefawbbiwgrjunkqocnu.supabase.co",
  supabaseKey: "sb_publishable_X2ADXQr-rLZ5ZnksXJAGtA_TbjxW3DW",

  /* 同步粒度 */
  dataId: "jojo",
  table: "user_data",

  /* ⚠️ 已废弃：直连模式下 sync.js 不再使用该字段（旧代理架构遗留） */
  proxyBase: "/api/supabase"
};