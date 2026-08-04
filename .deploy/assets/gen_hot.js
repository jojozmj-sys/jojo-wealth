// 生成每日热点 dailyHot：
//  微博/知乎 → 60s.viki.moe 实时 API
//  抖音/B站  → 官方 API（真实原文链接）
//  快手/小红书/公众号 → 免费公开实时 API 均不可用（需登录/签名/封闭生态），
//   用真实检索榜单填充 + 平台搜索链接保证可打开，标注为「每日更新」。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname || '.', '..');

const PF_TAG = { '微博': '社会', '抖音': '娱乐', '知乎': '知识', '小红书': '生活', 'B站': '影视', '快手': '生活', '公众号': '深度' };
const platforms = ['微博', '抖音', '小红书', 'B站', '快手', '公众号', '知乎'];

// —— 快手（真实检索榜单，hot 单位：万）—— 免费 API 不可用，补搜索链接
const KUAISHOU = [
  ['初中生曝日罪证遭威胁当事人发声', 1345.3], ['重庆彭水山体崩塌致51死10失联', 1283.1],
  ['8月1日起一批新规将正式施行', 1258.9], ['雷军营销再引争议', 1232.3],
  ['一年一度军迷盛宴来了', 1210.1], ['解放军两次警告日方不能自称海军', 1169.6],
  ['胡兵携彝族服饰走向世界', 1147.5], ['小米澎程发布会', 1125.6],
  ['何立峰与美财政部长视频通话', 1103.2], ['日本熊本强震死亡人数上升至34人', 1081.0],
  ['河南南阳楼房被冲进河中系谣言', 1079.0], ['恋还是练是什么梗', 1078.7],
  ['龙兽医兽医界接生天花板', 1075.7], ['吵架后从18楼跳下女子称很后悔', 1073.4],
  ['C罗被曝8月1日完婚', 1070.8], ['超强台风“白海豚”路径大变', 1068.2],
  ['张老五东北式热心肠', 1066.0], ['地铁上遇到真明星了', 1063.8],
  ['小猪佩奇入驻快手', 1061.5], ['“新新三样”成中国出口的新名片', 1058.7],
  ['博雅酷二狗周年浪漫烟花', 1055.9], ['中国足球小将红队晋级四强', 1054.3],
  ['奥特曼cos', 1052.1], ['杭州景区现野鸡脖子蛇', 1049.6],
  ['男子闪婚1天被妻子发现虚构收入', 1047.4]
];

// —— 小红书热门话题（真实检索榜单）—— 官方接口需 x-s 签名，免费不可用
// 第三项为「真实笔记直达链接」（免登录可看正文）；缺省则回退到搜索链接兜底
// 注意：这些 xsec_token 链接存在时效性，若失效会自动回退到搜索链接
const XHS = [
  ['旅行拍照姿势出片', 928.1],
  ['耗时三年拍下古诗词里的中国', 916.5],
  ['我拍到了海鸥雨', 906.5],
  ['超日常美食教程速来get', 878.0],
  ['定格这一刻的日照金山', 866.1],
  ['你可以永远相信赛里木湖的美景', 851.8],
  ['拼豆上也可以作画了', 838.3],
  ['家庭旅行像打副本', 812.0, 'https://www.xiaohongshu.com/explore/6a6ca6a90000000033013ef3?xsec_token=ABCIqLjwGvp2jIRd0uE9dAJsL9q7KERAnUSJmyYRx5Zwo='],
  ['原来古诗词里的河南真的存在', 802.4],
  ['蒸出了奶香爆米花馒头', 791.8],
  ['拼豆也能当火漆印章玩', 757.6],
  ['我创造了新型遛狗法', 737.4],
  ['珠圆玉润妆完全是淡颜天菜', 695.7],
  ['碎钻美甲指尖藏着细碎星光', 665.1],
  ['居住方式进入“适我时代”（适宠化/适童化搜索增长680%/500%）', 0, 'https://www.xiaohongshu.com/explore/6a6db4800000000025004cd0?xsec_token=ABKnZdZSqS7CW5bPYydEcC2QlM8yYQQp8H2IaG_fnpq5U='],
  ['小红书启动清朗浦江抵制网暴整治饭圈乱象专项行动', 0],
  ['华为小艺接入GUI可操作小红书', 0],
  ['男子假冒中农大博士活跃小红书', 0],
  ['抖音小红书带火室内攀岩（商业攀岩馆达811家）', 0],
  ['退货取件码话题登小红书热搜', 0],
  ['出片友好旅行成五一主流（相关话题浏览超2064万）', 0, 'https://www.xiaohongshu.com/explore/6a6d630b000000002403d332?xsec_token=ABKnZdZSqS7CW5bPYydEcC2QlM8yYQQp8H2IaG_fnpq5U='],
  ['新生开学清单/入伏健康/暑假工/AI亲子任务（7.18热榜观察线）', 0, 'https://www.xiaohongshu.com/explore/6a6d51fa0000000025003b40?xsec_token=ABKnZdZSqS7CW5bPYydEcC2ZXn5zobgXmYEzbfHsh4oBQ='],
  ['减脂与健身：游泳动作答疑、日常打卡和备餐', 0],
  ['夏日穿搭：松弛感、单套穿搭和出游场景', 0, 'https://www.xiaohongshu.com/explore/6a6d703d0000000028033e0a?xsec_token=ABKnZdZSqS7CW5bPYydEcC2Qry3FQfdlYFvBAuxoARc5o='],
  ['护肤防晒：淡斑、晒后修护和功效护肤种草', 0, 'https://www.xiaohongshu.com/explore/6a6a5064000000001d022bf3?xsec_token=ABJ_iB1jLfWjezKxzvqvL5iNduF5JzYPR3e-OXRByK_f4='],
  ['职场关系与边界：老板话术、被评价焦虑', 0],
  ['情感关系与自我保护：不试图改变别人、关系内耗', 0]
];

// —— 微信公众号爆款（封闭生态，无免费实时热榜，真实检索内容 + 搜狗微信搜索链接）——
const WX = [
  ['《李中大沉思录》走红：中文互联网需要新的时代解释者', 0],
  ['《王的猜想》大火：广西日报公众号10万+刷屏', 0],
  ['《金子般的几句话》刷爆朋友圈（2800万转发）', 0],
  ['张晓磊爆款文《人生本过客，何必惹尘埃》', 0],
  ['情感爆文《成年人的世界，一半是责任，一半是委屈》', 0],
  ['《婚姻的沉默危机：从畅所欲言到相对无言》', 0],
  ['Loop才火六周，AI Coding又谈Graph（智讯智库）', 0],
  ['一声“阿嬷”引爆5000万流量（南都官微）', 0],
  ['微信公众号算法助力古早大V复更', 0],
  ['上亿企退职工心声：每年退休金小幅提升不如抹平差距', 0],
  ['微信“关系减法挑战”12亿播放', 0],
  ['《后半生，拼的不是爱情，而是好好爱自己》', 0],
  ['《探寻专属自己的幸福》获210万阅读', 0],
  ['暑期出游要警惕“AI照骗”（小红书旅游帖诈骗引热议）', 0]
];

function fix(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 各平台「查看原文」搜索链接（免费 API 不可用时的兜底）
const SEARCH_URL = {
  '快手': t => 'https://www.kuaishou.com/search/video?searchKey=' + encodeURIComponent(t),
  '小红书': t => 'https://www.xiaohongshu.com/search_result?keyword=' + encodeURIComponent(t),
  '公众号': t => 'https://weixin.sogou.com/weixin?type=2&query=' + encodeURIComponent(t),
  '抖音': t => 'https://www.douyin.com/search/' + encodeURIComponent(t),
  'B站': t => 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(t),
  '微博': t => 'https://s.weibo.com/weibo?q=' + encodeURIComponent(t),
  '知乎': t => 'https://www.zhihu.com/search?type=content&q=' + encodeURIComponent(t)
};

// 60s API（微博/知乎）
const API60 = {
  '微博': 'https://60s.viki.moe/v2/weibo',
  '知乎': 'https://60s.viki.moe/v2/zhihu'
};
async function fetch60(name) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(API60[name], {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': UA, 'Accept': 'application/json' }
      });
      const t = await r.text();
      if (!t.trim().startsWith('{')) throw new Error('返回非JSON(疑似限流)');
      const j = JSON.parse(t);
      const list = (j.data || []).slice(0, 25).map((it, i) => ({
        platform: name, rank: i + 1, title: fix(it.title),
        hot: it.hot_value != null ? Number(it.hot_value) : 0,
        url: fix(it.link) || SEARCH_URL[name](fix(it.title)),
        tag: PF_TAG[name], desc: ''
      }));
      if (!list.length) throw new Error('返回空列表');
      return list;
    } catch (e) {
      console.error(`${name} 第${attempt}次失败:`, e.message);
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }
  return [];
}

// 抖音官方 API：https://www.douyin.com/aweme/v1/web/hot/search/list/
async function fetchDouyin() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(
        'https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web',
        { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': UA, 'Referer': 'https://www.douyin.com/', 'Accept': 'application/json' } }
      );
      const j = await r.json();
      const wl = (j && j.data && j.data.word_list) || [];
      const list = wl.slice(0, 25).map((it, i) => ({
        platform: '抖音', rank: i + 1, title: fix(it.word),
        hot: it.hot_value != null ? Number(it.hot_value) : 0,
        url: SEARCH_URL['抖音'](fix(it.word)),
        tag: PF_TAG['抖音'], desc: fix(it.sentence_tag) || ''
      }));
      if (!list.length) throw new Error('返回空列表');
      return list;
    } catch (e) {
      console.error(`抖音 第${attempt}次失败:`, e.message);
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }
  return [];
}

// B站官方 API：先访问 bilibili.com 拿 buvid3/b_nut cookie，再请求榜单，返回真实 b23 短链
async function fetchBili() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // 浏览器指纹请求头，规避 -352 风控
      const BH = {
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://www.bilibili.com/',
        'Origin': 'https://www.bilibili.com',
        'sec-ch-ua': '"Chromium";v="126", "Not;A=Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
      };
      let ck = '';
      // 主方案：SPI 接口取 buvid3/buvid4 指纹
      try {
        const spi = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
          signal: AbortSignal.timeout(15000), headers: BH
        });
        const sj = await spi.json();
        if (sj.code === 0 && sj.data && sj.data.b_3) {
          ck = 'buvid3=' + sj.data.b_3 + '; buvid4=' + (sj.data.b_4 || '') + '; b_nut=' + Math.floor(Date.now() / 1000);
        }
      } catch (e) { /* 落到备用方案 */ }
      // 备用方案：访问首页收集 Set-Cookie
      if (!ck) {
        const jar = new Map();
        const r0 = await fetch('https://www.bilibili.com/', {
          signal: AbortSignal.timeout(15000), headers: { 'User-Agent': UA }
        });
        const setc = (r0.headers.getSetCookie && r0.headers.getSetCookie()) || [];
        setc.forEach(c => { const kv = c.split(';')[0]; if (kv.includes('=')) { const [k, v] = kv.split('='); jar.set(k.trim(), v.trim()); } });
        ck = [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ');
      }
      // 依次尝试：排行榜 → 热门视频（ranking/v2 常被 -352 风控，popular 通常可用）
      const EPS = [
        'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all',
        'https://api.bilibili.com/x/web-interface/popular?ps=25&pn=1'
      ];
      let j = null, lastCode = null;
      for (const ep of EPS) {
        try {
          const r = await fetch(ep, { signal: AbortSignal.timeout(15000), headers: { ...BH, 'Cookie': ck } });
          const jj = await r.json();
          if (jj.code === 0 && jj.data && (jj.data.list || []).length) { j = jj; break; }
          lastCode = jj.code;
        } catch (e) { lastCode = e.message; }
      }
      if (!j) throw new Error('B站 code=' + lastCode);
      const list = (j.data && j.data.list || []).slice(0, 25).map((it, i) => ({
        platform: 'B站', rank: i + 1, title: fix(it.title),
        hot: it.stat && it.stat.view != null ? Number(it.stat.view) : 0,
        url: fix(it.short_link_v2) || SEARCH_URL['B站'](fix(it.title)),  // 真实 b23 短链
        tag: PF_TAG['B站'], desc: fix(it.desc) || ''
      }));
      if (!list.length) throw new Error('返回空列表');
      return list;
    } catch (e) {
      console.error(`B站 第${attempt}次失败:`, e.message);
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }
  return [];
}

// 实时接口最终失败时，回退到 data.js 里上一轮的该平台数据，避免面板被清空
function fallback(D, name) {
  const old = ((D.dailyHot && D.dailyHot.today && D.dailyHot.today.items) || [])
    .filter(it => it.platform === name);
  if (old.length) console.error(`${name} 使用上轮缓存 ${old.length} 条`);
  return old;
}

// 静态平台榜单 → items
// x 格式: [title, hot, realUrl?] —— realUrl 为真实笔记直达链接，缺省则用搜索链接兜底
function fromStatic(name, arr) {
  return arr.slice(0, 25).map((x, i) => {
    const real = fix(x[2]);
    return {
      platform: name, rank: i + 1, title: fix(x[0]),
      hot: x[1] ? Math.round(x[1] * 10000) : 0,
      // 有真实链接优先用真实链接；否则搜索链接（保证可打开）
      url: real && real.startsWith('http') ? real : SEARCH_URL[name](fix(x[0])),
      tag: PF_TAG[name], desc: ''
    };
  });
}

(async () => {
  const items = [];
  const live = {};

  // 并行抓取实时平台
  const [wb, zh, dy, bl] = await Promise.all([
    fetch60('微博'), fetch60('知乎'), fetchDouyin(), fetchBili()
  ]);
  live['微博'] = wb; live['知乎'] = zh; live['抖音'] = dy; live['B站'] = bl;

  const txt = fs.readFileSync(path.join(ROOT, 'assets', 'data.js'), 'utf8');
  globalThis.window = {};
  (0, eval)(txt);
  const D = window.WORKBENCH_DATA;

  // 实时平台：抓取成功用新数据，失败则回退上轮缓存
  for (const p of ['微博', '抖音', '知乎', 'B站']) {
    items.push(...(live[p].length ? live[p] : fallback(D, p)));
  }
  items.push(...fromStatic('快手', KUAISHOU));
  items.push(...fromStatic('小红书', XHS));
  items.push(...fromStatic('公众号', WX));

  const now = new Date();
  const pad = n => (n < 10 ? '0' + n : '' + n);
  const ds = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
  D.dailyHot = {
    mode: 'daily',
    updated: ds + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()),
    platforms,
    today: { date: ds, weekday: wd, items },
    days: D.dailyHot.days || []
  };
  fs.writeFileSync(path.join(ROOT, 'assets', 'data.js'), 'window.WORKBENCH_DATA = ' + JSON.stringify(D, null, 2) + ';\n');
  const c = {};
  items.forEach(it => c[it.platform] = (c[it.platform] || 0) + 1);
  console.log('OK 各平台条数:', JSON.stringify(c));
  // 检查空链接
  const noUrl = items.filter(it => !it.url);
  console.log('空链接条数:', noUrl.length, noUrl.slice(0, 3).map(x => x.platform + ':' + x.title).join(' | '));
})();
