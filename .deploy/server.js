/**
 * JOJO发财之路 · 静态文件服务器（CloudStudio 部署用）
 * ------------------------------------------------------------
 * 云同步说明：前端 sync.js 已改为【浏览器直连 Supabase REST API】
 *   （supabase.co CORS 已放行 *），不经过本服务器代理。
 * 因此本 server 仅负责托管 index.html + assets/ 等静态资源，
 * 不再包含任何代理/自定义 DNS/诊断逻辑。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

const server = http.createServer((req, res) => {
  // 允许跨域（前端直连 Supabase 不受影响，这里仅便利调试）
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // 静态文件：默认回退到 index.html（SPA）
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'index.html');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('JOJO发财之路 静态服务器已启动，端口', PORT);
  console.log('云同步：前端直连 Supabase（无需本服务器中转）');
});
