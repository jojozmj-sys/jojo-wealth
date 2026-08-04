// 完整 smoke 测试：加载真实 data.js + 最小 DOM mock，验证 app.js 初始化与今日要闻
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const dataSrc = fs.readFileSync(path.join(root, 'assets/data.js'), 'utf8');
const jsonText = dataSrc.replace(/^window\.WORKBENCH_DATA\s*=\s*/, '').replace(/;\s*$/, '');
const WORKBENCH_DATA = eval('(' + jsonText + ')');

// 最小 DOM mock（按 selector/id 缓存，保证 app.js 内局部 $ 也能取到写入结果）
const elements = {};
function makeEl(id) {
  return {
    id, textContent: '', innerHTML: '', value: '', hidden: false, style: {},
    dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(){}, setAttribute(){}, addEventListener(){}, removeEventListener(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    children: []
  };
}
function get(sel) {
  const key = String(sel).replace(/^[#.]/, '');
  if (!elements[key]) elements[key] = makeEl(key);
  return elements[key];
}
global.document = {
  getElementById(id){ return get(id); },
  querySelector(sel){ return get(sel); },
  querySelectorAll(){ return []; },
  createElement(){ return makeEl(''); },
  addEventListener(){}
};
global.window = {
  WORKBENCH_DATA,
  addEventListener(){}, location:{}, matchMedia(){ return { matches:false }; },
  localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} }
};
global.localStorage = global.window.localStorage;
global.setInterval = () => 0;
global.setTimeout = () => 0;
global.AbortSignal = { timeout: () => ({}) };
global.fetch = () => Promise.reject(new Error('no-net'));

// 执行 app.js（内部使用局部 $ 走 document.querySelector）
const appSrc = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
try {
  eval(appSrc);
  console.log('OK app.js 完整初始化成功（无异常）');
  const list = elements['newsHeadlineList'];
  const head = elements['newsHeadline'];
  if (!list) { console.log('FAIL 未找到 newsHeadlineList'); process.exit(1); }
  const n = (list.innerHTML.match(/news-hl-item/g) || []).length;
  const openN = (list.innerHTML.match(/news-hl-item open/g) || []).length;
  const hasMain = list.innerHTML.includes('news-hl-head main');
  console.log('今日要闻条目:', n, '| open条目:', openN, '| 主显示 main:', hasMain, '| hidden:', head.hidden);
  if (n >= 10 && openN === 1 && hasMain) { console.log('PASS 今日要闻 10 条 + 主显示 1 条验证通过'); }
  else { console.log('FAIL 今日要闻数量/主显示异常'); process.exit(1); }
} catch (e) {
  console.log('FAIL app.js 初始化异常:', e.message);
  console.log(e.stack);
  process.exit(1);
}
