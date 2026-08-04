const http = require('http');
const https = require('https');
const dns = require('dns');
const fs = require('fs');
const path = require('path');

/* ---- 自定义 DNS 解析（国内 DNS 污染 Supabase API 域名时的回退方案） ---- */
// 缓存：避免每次都走 DNS 查询
let _supabaseIpCache = null;
let _supabaseIpCacheTime = 0;
const DNS_CACHE_TTL = 300000; // 5 分钟

/**
 * 获取 Supabase API 的实际 IP 地址
 * 回退链：系统 DNS → 8.8.8.8 → 1.1.1.1
 */
function resolveSupabaseIP() {
  return new Promise((resolve, reject) => {
    if (_supabaseIpCache && Date.now() - _supabaseIpCacheTime < DNS_CACHE_TTL) {
      return resolve(_supabaseIpCache);
    }

    const hostname = SUPABASE_HOST;

    function trySystemDNS() {
      dns.resolve4(hostname, (err, addrs) => {
        if (!err && addrs && addrs.length > 0) {
          console.log('  [DNS] 系统DNS成功:', addrs[0]);
          _supabaseIpCache = addrs[0];
          _supabaseIpCacheTime = Date.now();
          return resolve(addrs[0]);
        }
        console.log('  [DNS] 系统DNS失败:', err ? err.code : 'no addresses');
        tryGoogleDNS();
      });
    }

    function tryGoogleDNS() {
      const r = new dns.Resolver();
      r.setServers(['8.8.8.8']);
      r.resolve4(hostname, (err, addrs) => {
        if (!err && addrs && addrs.length > 0) {
          console.log('  [DNS] 8.8.8.8成功:', addrs[0]);
          _supabaseIpCache = addrs[0];
          _supabaseIpCacheTime = Date.now();
          return resolve(addrs[0]);
        }
        console.log('  [DNS] 8.8.8.8失败:', err ? err.code : 'no addresses');
        tryCloudflareDNS();
      });
    }

    function tryCloudflareDNS() {
      const r = new dns.Resolver();
      r.setServers(['1.1.1.1']);
      r.resolve4(hostname, (err, addrs) => {
        if (!err && addrs && addrs.length > 0) {
          console.log('  [DNS] 1.1.1.1成功:', addrs[0]);
          _supabaseIpCache = addrs[0];
          _supabaseIpCacheTime = Date.now();
          return resolve(addrs[0]);
        }
        console.log('  [DNS] 1.1.1.1失败:', err ? err.code : 'no addresses');
        reject(new Error('所有 DNS 服务器都无法解析 ' + hostname + '（项目可能已被暂停）'));
      });
    }

    trySystemDNS();
  });
}

/* ---- Supabase 配置 ---- */
const SUPABASE_HOST = 'aefawbbiwgrjunkqocnu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_X2ADXQr-rLZ5ZnksXJAGtA_TbjxW3DW';
// 管理密钥（server 端用，不会暴露给前端）
// 注意：这个 service_role key 需要从 Supabase 控制台 → Project Settings → API → service_role
// 如果没有填，就用 anon key（单用户场景够用，只要 RLS 正确配置）
const SUPABASE_SERVICE_KEY = SUPABASE_KEY;

/* ---- 本地文件存储（备用） ---- */
const DATA_FILE = path.join(__dirname, 'data', 'sync.json');
function ensureDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function readData() {
  ensureDir();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { return {}; }
}
function writeData(data) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const mime = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

/**
 * 代理请求到 Supabase REST API
 * 使用自定义 DNS 解析 IP，通过 SNI（servername）指定域名
 */
function supabaseProxy(method, restPath, body) {
  return new Promise((resolve, reject) => {
    const url = restPath.startsWith('/') ? restPath : '/' + restPath;

    async function doRequest(ip) {
      const opts = {
        hostname: ip,
        servername: SUPABASE_HOST,  // SNI: TLS 握手时告诉服务器访问哪个域名
        port: 443,
        path: url,
        method: method,
        headers: {
          'Host': SUPABASE_HOST,
          'apikey': SUPABASE_SERVICE_KEY || SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY || SUPABASE_KEY}`,
          'Content-Type': undefined,
          'Prefer': 'return=representation',
          'Accept': 'application/json'
        },
        rejectUnauthorized: true  // 严格验证证书
      };

      Object.keys(opts.headers).forEach(k => {
        if (opts.headers[k] === undefined) delete opts.headers[k];
      });

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        const bodyStr = JSON.stringify(body);
        opts.headers['Content-Type'] = 'application/json';
        opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
      }

      const proxyReq = https.request(opts, (proxyRes) => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          resolve({
            status: proxyRes.statusCode,
            headers: proxyRes.headers,
            body: data
          });
        });
      });

      proxyReq.on('error', (err) => {
        console.error('[proxy] Supabase 代理失败:', err.message);
        reject(err);
      });

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        proxyReq.write(JSON.stringify(body));
      }

      proxyReq.end();
    }

    // 先尝试直接域名请求（系统 DNS），成功就不走 IP 模式
    const directOpts = {
      hostname: SUPABASE_HOST,
      port: 443,
      path: url,
      method: method,
      headers: {
        'apikey': SUPABASE_SERVICE_KEY || SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY || SUPABASE_KEY}`,
        'Accept': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    Object.keys(directOpts.headers).forEach(k => {
      if (directOpts.headers[k] === undefined) delete directOpts.headers[k];
    });

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      const bodyStr = JSON.stringify(body);
      directOpts.headers['Content-Type'] = 'application/json';
      directOpts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const directReq = https.request(directOpts, (proxyRes) => {
      let data = '';
      proxyRes.on('data', chunk => data += chunk);
      proxyRes.on('end', () => {
        resolve({
          status: proxyRes.statusCode,
          headers: proxyRes.headers,
          body: data
        });
      });
    });

    directReq.on('error', async (err) => {
      // 系统 DNS 失败 → 尝试自定义 DNS 解析 → IP 直连
      console.log('[proxy] 系统 DNS 请求失败:', err.message, '→ 尝试自建 DNS...');
      try {
        const ip = await resolveSupabaseIP();
        console.log('[proxy] 使用 IP 直连:', ip);
        await doRequest(ip);
      } catch (dnsErr) {
        reject(dnsErr);
      }
    });

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      directReq.write(JSON.stringify(body));
    }
    directReq.end();
  });
}

const server = http.createServer((req, res) => {
  // CORS
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  };
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);

  /* ---- Supabase API 代理 ---- */
  if (url.pathname.startsWith('/api/supabase/')) {
    const supabasePath = url.pathname.replace('/api/supabase', '') + url.search;
    const method = req.method;

    console.log(`[Supabase] ${method} ${supabasePath}`);

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      let bodyObj = null;
      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        try { bodyObj = JSON.parse(body); } catch (e) {}
      }

      try {
        const result = await supabaseProxy(method, supabasePath, bodyObj);
        // 返回代理结果
        const resultHeaders = { 'Content-Type': result.headers['content-type'] || 'application/json' };
        // 透传一些关键 header
        if (result.headers['content-range']) resultHeaders['Content-Range'] = result.headers['content-range'];
        if (result.headers['location']) resultHeaders['Location'] = result.headers['location'];

        res.writeHead(result.status, resultHeaders);
        res.end(result.body);
      } catch (err) {
        console.error('[Supabase] 代理异常:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Supabase proxy error', detail: err.message }));
      }
    });
    return;
  }

  /* ---- 原有本地 API（备用） ---- */
  if (url.pathname.startsWith('/api/sync/')) {
    const id = url.pathname.replace('/api/sync/', '').replace(/\/$/, '') || 'jojo';
    if (req.method === 'GET') {
      const all = readData();
      const row = all[id] || null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(row ? JSON.stringify(row) : 'null');
      return;
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          JSON.parse(body);
          const all = readData();
          all[id] = JSON.parse(body);
          writeData(all);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
      return;
    }
  }

  /* ---- Supabase 连通性诊断端点（用于调试） ---- */
  if (url.pathname === '/api/diag-supabase') {
    const start = Date.now();

    // 先尝试系统 DNS
    const directReq = https.request({
      hostname: SUPABASE_HOST,
      port: 443, path: '/rest/v1/', method: 'HEAD',
      headers: { 'apikey': SUPABASE_KEY }
    }, (proxyRes) => {
      respond(true, proxyRes.statusCode, Date.now() - start, 'system-dns');
    });

    directReq.on('error', async (err) => {
      // 系统 DNS 失败 → 尝试自建 DNS
      try {
        const ip = await resolveSupabaseIP();
        const req2 = https.request({
          hostname: ip, servername: SUPABASE_HOST,
          port: 443, path: '/rest/v1/', method: 'HEAD',
          headers: { 'Host': SUPABASE_HOST, 'apikey': SUPABASE_KEY },
          rejectUnauthorized: true
        }, (proxyRes) => {
          respond(true, proxyRes.statusCode, Date.now() - start, 'ip-direct:' + ip);
        });
        req2.on('error', (e2) => {
          respond(false, 0, Date.now() - start, e2.message);
        });
        req2.end();
      } catch (dnsErr) {
        respond(false, 0, Date.now() - start, dnsErr.message);
      }
    });

    directReq.end();

    function respond(ok, status, latency, via) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: ok,
        supabase_reachable: ok,
        status: status,
        latency_ms: latency,
        via: via
      }));
    }
    return;
  }

  /* ---- 静态文件 ---- */
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
  console.log('JOJO发财之路 Server running on port', PORT);
  console.log('Supabase proxy:', SUPABASE_HOST);
  console.log('Testing Supabase connectivity (multi-DNS)...');
  
  const directReq = https.request({
    hostname: SUPABASE_HOST,
    port: 443, path: '/rest/v1/', method: 'HEAD',
    headers: { 'apikey': SUPABASE_KEY }
  }, (r) => {
    console.log(`✅ Supabase API 连通！状态: ${r.statusCode} (系统DNS)`);
  });
  directReq.on('error', async () => {
    try {
      const ip = await resolveSupabaseIP();
      const r2 = https.request({
        hostname: ip, servername: SUPABASE_HOST,
        port: 443, path: '/rest/v1/', method: 'HEAD',
        headers: { 'Host': SUPABASE_HOST, 'apikey': SUPABASE_KEY },
        rejectUnauthorized: true
      }, (rr) => {
        console.log(`✅ Supabase API 连通！状态: ${rr.statusCode} (IP直连: ${ip})`);
      });
      r2.on('error', (e2) => {
        console.log(`❌ Supabase API 不可达: ${e2.message}`);
        console.log('   → 云同步将不可用，自动退化为本地存储');
      });
      r2.end();
    } catch (e) {
      console.log(`❌ Supabase API 不可达: ${e.message}`);
      console.log('   → 云同步将不可用，自动退化为本地存储');
    }
  });
  directReq.end();
});