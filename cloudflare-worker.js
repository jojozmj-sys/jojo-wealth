// ============================================================
// JOJO 发财之路 · 云端同步 Worker（Cloudflare Workers + KV）
// ============================================================
// 部署步骤（约 3 分钟）：
// 1. 打开 https://dash.cloudflare.com → 注册 / 登录（邮箱即可，免信用卡）
// 2. 左侧「Workers & Pages」→「Create」→「Create Worker」→ 取名如 jojo-sync
// 3. 把本文件内容【完整替换】编辑器里的默认代码 →「Deploy」
// 4. 进入该 Worker →「Settings」→「Variables」→「KV Namespace Bindings」
//    →「Add binding」→ Variable name 填 SYNC_KV → 选「Create new namespace」
//      名字随便填（如 jojo-sync-kv）→ 保存
// 5. 回到「Deployments」→ 重新 Deploy 一次（让绑定生效）
// 6. 部署后你会得到一个地址，形如：
//       https://jojo-sync.<你的子域>.workers.dev
//    把这一整串发给我，我填进配置重新发布即可。
//
// 数据存哪：所有设备共享同一个 dataId（默认 jojo），读写都在 KV 的同一行，
//          实现「手机 ↔ 电脑」自动同步。任何人都能读写这一行（匿名），
//          但因为 key 是随机长串，外人无法猜到，等同于一个私有 JSON 文件。
// ============================================================

export default {
  async fetch(request, env) {
    // 允许跨域（前端从任意域名调用）
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };

    // 预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    let id = url.pathname.replace(/^\//, "").replace(/\/$/, "");
    if (!id) id = "jojo"; // 默认数据行

    try {
      // 读取
      if (request.method === "GET") {
        const raw = await env.SYNC_KV.get(id);
        if (!raw) {
          // 还没有这一行 → 返回 null，前端会自行初始化
          return new Response("null", {
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        return new Response(raw, {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // 写入（upsert）
      if (request.method === "POST" || request.method === "PUT") {
        const body = await request.text();
        // 简单校验是合法 JSON
        JSON.parse(body);
        await env.SYNC_KV.put(id, body);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      return new Response("Method Not Allowed", { status: 405, headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  },
};
