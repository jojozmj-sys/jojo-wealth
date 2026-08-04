// 生成每日网络热梗 dailyMemes：
//  1) 复用公开热搜 API（微博/抖音/知乎/B站）抓取当日热搜词作为候选池
//  2) 内置「网络热梗基础库」（持续有效的常见热梗，含由来/含义/用法/可蹭热度/平台/分类）作为冷启动
//  3) 输出结构化 dailyMemes，供前端「每日网络热梗」板块展示
//  说明：本脚本保证板块始终有数据；真正的「每日最新热梗 AI 梳理」由每日自动化任务基于
//  抓取到的热搜词 + 网络流行语进一步更新、增补、归类。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname || '.', '..');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fix = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

// —— 网络热梗基础库（持续有效，用于冷启动与每日轮换）——
// name 梗名 | category 分类 | origin 由来 | meaning 含义 | usage 用法/示例
// tip 可蹭热度建议 | platform 来源平台 | heat 热度评分 0-100
const MEME_BASE = [
  // 短视频平台梗
  { name: '松弛感', category: '短视频热梗', platform: '抖音',
    origin: '源自博主分享"不紧绷、从容应对"的生活状态，2022年起在短视频平台持续流行，2024-2026 进一步成为生活方式关键词。',
    meaning: '指面对压力、变故时从容、不慌不忙、不内耗的状态，是对"精致焦虑"的反向流行。',
    usage: '「一到假期就过出了松弛感」「这才是成年人的松弛感」。常用于穿搭、旅行、职场、育儿等场景。',
    tip: '可做"松弛感穿搭/旅行/办公桌"测评、教程，反差对比（紧张vs松弛）有话题性。', heat: 88 },
  { name: '已读乱回', category: '短视频热梗', platform: '抖音',
    origin: '源自网友分享"故意答非所问、敷衍回复"的聊天截图，成为表达无语、摆烂、搞笑回应的流行梗。',
    meaning: '指对对方消息故意乱答、不按常理回应，常用于吐槽无意义问题或制造笑点。',
    usage: '「男朋友已读乱回」「面对亲戚的灵魂拷问，直接已读乱回」。',
    tip: '可做"已读乱回"合集、测试对方耐心的互动视频，容易引发共鸣转发。', heat: 86 },
  { name: '听劝', category: '短视频热梗', platform: '抖音',
    origin: '源自网友自嘲"不听话非要试"，或账号"听劝"系列，指愿意听取网友建议、接受改造。',
    meaning: '表示一个人能听进别人劝告、愿意改变，也用于自嘲或夸赞。',
    usage: '「听劝版减肥第30天」「这波是真听劝了」。',
    tip: '可做"听劝"挑战/改造系列，人设真诚，粘性高。', heat: 82 },
  // 社交平台流行语
  { name: '电子榨菜', category: '社交流行语', platform: '微博',
    origin: '形容吃饭时必备的下饭视频/内容，像"榨菜"一样下饭，2023年起在社交平台高频使用。',
    meaning: '指配饭时看的轻松视频、短剧、综艺等，是"下饭内容"的戏称。',
    usage: '「今日份电子榨菜已就位」「这部短剧是我的电子榨菜」。',
    tip: '可盘点"年度电子榨菜片单"、做饭综/短剧推荐，转化率高。', heat: 84 },
  { name: '班味', category: '社交流行语', platform: '小红书',
    origin: '形容上班后流露出的疲惫、社畜气质，2023年底在社媒爆火，成为打工人自嘲热词。',
    meaning: '指职场打工人身上透出的"上班感"，如疲惫、生无可恋、眼神无光。',
    usage: '「下班后如何去掉一身班味」「地铁上一眼认出班味」。',
    tip: '可做"去班味"攻略、通勤变装，切中打工人情绪。', heat: 83 },
  { name: '情绪价值', category: '社交流行语', platform: '微博',
    origin: '指人际交往中提供的情感满足、精神支持，从心理学词汇变成网络热词，2023-2026持续火热。',
    meaning: '能让人感到被理解、被安慰、心情变好的价值，常用于评价人或关系。',
    usage: '「TA给了我满格的情绪价值」「拒绝无效社交，只要情绪价值」。',
    tip: '可做"高情绪价值话术""情绪价值型服务"测评，女性向内容尤其吃香。', heat: 80 },
  // B站/鬼畜/弹幕梗
  { name: '前方高能', category: 'B站弹幕梗', platform: 'B站',
    origin: '源自 B站/二次元弹幕文化，在剧情高潮、精彩片段前预警，提醒观众集中注意。',
    meaning: '预告接下来有精彩、震撼、刺激的内容，是弹幕文化经典用语。',
    usage: '「前方高能，非战斗人员速撤」「前方高能预警」。',
    tip: '剪辑视频用"前方高能"制造悬念、卡点，提升完播率。', heat: 75 },
  { name: '含金量还在上升', category: 'B站弹幕梗', platform: 'B站',
    origin: '源自 B站弹幕，形容某个作品/预言/人物不断被"考古"验证，价值持续增加。',
    meaning: '指某事物随时间推移被反复证明有价值、有先见之明。',
    usage: '「XX的含金量还在上升」「这波预言含金量还在上升」。',
    tip: '做"考古"系列、预言复盘，用"含金量还在上升"做标题钩子。', heat: 72 },
  { name: '双开门', category: 'B站弹幕梗', platform: 'B站',
    origin: '形容身材宽肩窄腰像"双开门冰箱"一样壮硕，源自 B站对男角色/男演员身材的调侃。',
    meaning: '指肩宽得夸张、身材很有存在感，常用于二次元和影视角色。',
    usage: '「这哥们的双开门程度拉满了」「双开门大叔文学」。',
    tip: '健身、穿搭内容可蹭"双开门"做身材展示与反差。', heat: 68 },
  // 游戏/科技圈梗
  { name: '上线即巅峰', category: '游戏/科技圈梗', platform: 'B站',
    origin: '源自游戏圈，形容游戏/产品上线首日热度爆表，后泛化到各种产品与事件。',
    meaning: '指一发布就达到极高热度，常用于游戏、App、剧集。',
    usage: '「新游上线即巅峰」「这款 App 上线即巅峰」。',
    tip: '可做"上线即巅峰"的产品/游戏测评，蹭新品热度。', heat: 70 },
  { name: '拼多多文学', category: '社交流行语', platform: '小红书',
    origin: '指模仿拼多多砍价、文案风格创作的内容，充满"还差一点"的求生欲和幽默感。',
    meaning: '用拼多多的"求人砍一刀""还差X人"话术玩梗，泛指夸张又卑微的求赞求关注文案。',
    usage: '「求点赞，还差3个就能上热门，拼多多文学启动」。',
    tip: '可玩"拼多多文学"求赞/求关注，互动性强、易上热门。', heat: 74 },
];

// —— 候选池：从热搜词中识别可能是"热梗/流行语"的候选 ——
// 关键词命中判定，用于把当日热搜里疑似玩梗/流行语的条目挑出来
const MEME_HINT = /梗|文学|松弛|听劝|已读|班味|电子|含金量|双开门|爆改|上分|逆天|离谱|摆烂|破防|无语|绝了|入骨|上头|封神|YYDS|情绪价值|发疯|硬控|硬核|松弛感|公主|少爷|人设|恋爱脑|精神状态|I人|E人|打工人|脆皮|搭子|显眼包|多巴胺|美拉德|挖呀挖|科目三|显眼|刺客|雪糕|city|citywalk|特种兵|冲浪|梗图|玩梗|离谱/;
// 排除明显是新闻/时政/非梗的常见词头
const MEME_EXCLUDE = /通报|警方|民警|法院|逮捕|宣判|遇难|身亡|事故|台风|地震|暴雨|发布会|总统|总理|中方|美国|俄|乌|股市|油价|央行|GDP|国务院|卫健委|教育部|考试院|分数线|录取|军演|导弹|冲突|战争|伤亡|罹难|遗骸|纪念/;

// —— 实时热搜候选池（微博/抖音/知乎/B站，复用公开 API）——
const API60 = { '微博': 'https://60s.viki.moe/v2/weibo', '知乎': 'https://60s.viki.moe/v2/zhihu' };
async function fetch60(name) {
  try {
    const r = await fetch(API60[name], { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
    const t = await r.text();
    if (!t.trim().startsWith('{')) throw new Error('非JSON');
    const j = JSON.parse(t);
    return (j.data || []).slice(0, 25).map(it => ({ platform: name, title: fix(it.title), hot: Number(it.hot_value) || 0 }));
  } catch (e) { console.error(`${name} 热搜抓取失败:`, e.message); return []; }
}
async function fetchDouyin() {
  try {
    const r = await fetch('https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web',
      { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': UA, 'Referer': 'https://www.douyin.com/', 'Accept': 'application/json' } });
    const j = await r.json();
    return ((j && j.data && j.data.word_list) || []).slice(0, 25).map(it => ({ platform: '抖音', title: fix(it.word), hot: Number(it.hot_value) || 0 }));
  } catch (e) { console.error('抖音 热搜抓取失败:', e.message); return []; }
}

// 从热搜候选里筛选疑似热梗/流行语的条目
function pickMemeCandidates(hotItems) {
  const seen = new Set();
  const out = [];
  for (const it of hotItems) {
    const t = it.title || '';
    if (seen.has(t)) continue;
    if (MEME_EXCLUDE.test(t)) continue;
    if (MEME_HINT.test(t)) { out.push(it); seen.add(t); }
  }
  return out;
}

(async () => {
  const hotItems = [];
  const [wb, zh, dy] = await Promise.all([fetch60('微博'), fetch60('知乎'), fetchDouyin()]);
  hotItems.push(...wb, ...zh, ...dy);
  const candidates = pickMemeCandidates(hotItems);

  const txt = fs.readFileSync(path.join(ROOT, 'assets', 'data.js'), 'utf8');
  globalThis.window = {};
  (0, eval)(txt);
  const D = window.WORKBENCH_DATA;

  const now = new Date();
  const pad = n => (n < 10 ? '0' + n : '' + n);
  const ds = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // 组装 dailyMemes：基础库（冷启动）+ 当日热搜候选提示词
  const items = MEME_BASE.map((m, i) => ({
    name: m.name, category: m.category, platform: m.platform,
    origin: m.origin, meaning: m.meaning, usage: m.usage, tip: m.tip,
    heat: m.heat, rank: i + 1
  }));

  D.dailyMemes = {
    date: ds,
    updated: ds + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()),
    summary: `覆盖 ${items.length} 个网络热梗${candidates.length ? `，并从当日热搜中识别出 ${candidates.length} 条热门流行语候选` : ''}。`,
    candidates: candidates.slice(0, 15),
    items: items
  };

  fs.writeFileSync(path.join(ROOT, 'assets', 'data.js'), 'window.WORKBENCH_DATA = ' + JSON.stringify(D, null, 2) + ';\n');
  console.log('OK dailyMemes 热梗数:', items.length, '| 热搜候选:', candidates.length);
  if (candidates.length) {
    console.log('—— 当日疑似热梗/流行语候选 ——');
    candidates.forEach((c, i) => console.log(` ${i + 1}. [${c.platform}] ${c.title}`));
  }
})();
