/* 验证：app.js 初始化 + 侧边栏图标保持 PNG（不再被贴纸覆盖）+ 滑动展开/收起逻辑 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

// 1. data.js
const dataSrc = fs.readFileSync(path.join(root, 'assets/data.js'), 'utf8');
const jsonText = dataSrc.replace(/^window\.WORKBENCH_DATA\s*=\s*/, '').replace(/;\s*$/, '');
const WORKBENCH_DATA = eval('(' + jsonText + ')');

// 2. 侧边栏菜单 mock：micon 内是 img.micon-img（来自 index.html 结构），记录是否被覆盖
const pages = ['plan','english','selfmedia','films','hot','podcast','fragment','notes','weekly','excerpt','manifest'];
const menuItems = pages.map(p => {
  const micon = {
    id: 'micon-' + p, innerHTML: '<img class="micon-img" src="assets/icons/icon-' + p + '.png">',
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    addEventListener(){}
  };
  const a = {
    id: 'menu-' + p, dataset: { page: p }, innerHTML: '',
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    querySelector(sel){ return sel === '.micon' ? micon : null; },
    querySelectorAll(){ return []; }, addEventListener(){}
  };
  return a;
});

// 3. 元素缓存
const elements = {};
function makeEl(id) {
  const listeners = {};
  return {
    id, textContent: '', innerHTML: '', value: '', hidden: false, style: {},
    dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    _listeners: listeners,
    appendChild(){}, setAttribute(){},
    addEventListener(type, cb){ (listeners[type] = listeners[type] || []).push(cb); },
    removeEventListener(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    children: []
  };
}
function get(sel) {
  const key = String(sel).replace(/^[#.]/, '');
  if (!elements[key]) elements[key] = makeEl(key);
  return elements[key];
}
// sidebar 元素 + body.classList 记录
const bodyClass = { has: false, add(){ this.has = true; }, remove(){ this.has = false; }, toggle(){ this.has = !this.has; }, contains(){ return this.has; } };
const sidebarEl = makeEl('sidebar');
elements['sidebar'] = sidebarEl;
elements['sideCollapse'] = makeEl('sideCollapse');
elements['menuToggle'] = makeEl('menuToggle');
elements['overlay'] = makeEl('overlay');
elements['menu'] = makeEl('menu');
elements['pageTitle'] = makeEl('pageTitle');

global.document = {
  getElementById(id){ return get(id); },
  querySelector(sel){ return get(sel); },
  querySelectorAll(sel){ if (sel === '.menu a[data-page]' || sel === '.menu a') return menuItems; return []; },
  body: { classList: bodyClass },
  createElement(){ return makeEl(''); },
  addEventListener(){}
};
global.window = {
  WORKBENCH_DATA, PointerEvent: function(){},
  addEventListener(){}, location:{}, matchMedia(){ return { matches:false }; },
  localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} }
};
global.localStorage = global.window.localStorage;
global.setInterval = () => 0;
global.setTimeout = () => 0;
global.AbortSignal = { timeout: () => ({}) };
global.fetch = () => Promise.reject(new Error('no-net'));

// 4. 执行 app.js
const appSrc = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
try {
  eval(appSrc);
  console.log('OK app.js 完整初始化成功');
} catch (e) {
  console.log('FAIL app.js 异常:', e.message);
  console.log(e.stack);
  process.exit(1);
}

// 5. 验证侧边栏图标不被贴纸覆盖（保持 PNG）
console.log('\n=== 侧边栏图标检查 ===');
let pngKept = true;
for (const a of menuItems) {
  const micon = a.querySelector('.micon');
  const kept = micon.innerHTML.includes('micon-img') && !micon.innerHTML.includes('dog-ic');
  if (!kept) pngKept = false;
  console.log(a.dataset.page.padEnd(10) + ' 保持PNG=' + kept);
}
console.log('全部保持 PNG 抠图图标:', pngKept ? 'PASS' : 'FAIL');

// 6. 验证滑动逻辑：模拟 pointer 事件
console.log('\n=== 侧边栏滑动手势检查 ===');
// 捕获 sidebar 上注册的监听器
const swipeListeners = sidebarEl._listeners || {};
const hasSwipe = !!(swipeListeners['pointerdown'] && swipeListeners['pointerup'] && swipeListeners['pointermove']);
console.log('已注册 pointer 监听:', hasSwipe ? '是' : '否');

// 6.1 模拟滑动行为
console.log('\n=== 滑动行为模拟 ===');
function fire(elm, type, x, y) {
  const ev = { clientX: x, clientY: y, preventDefault(){}, stopPropagation(){} };
  elm._listeners[type] && elm._listeners[type].forEach(cb => cb(ev));
}
// 场景A：当前展开态（collapsed=false），左滑(-dx) → 收起
bodyClass.has = false;
fire(sidebarEl, 'pointerdown', 200, 100);
fire(sidebarEl, 'pointermove', 150, 102);
fire(sidebarEl, 'pointerup', 120, 105);
const A = bodyClass.has === true;
console.log('左滑收起(展开→收起):', A ? 'PASS' : 'FAIL');

// 场景B：当前收起态（collapsed=true），右滑(+dx) → 展开
bodyClass.has = true;
fire(sidebarEl, 'pointerdown', 50, 100);
fire(sidebarEl, 'pointermove', 100, 102);
fire(sidebarEl, 'pointerup', 130, 103);
const B = bodyClass.has === false;
console.log('右滑展开(收起→展开):', B ? 'PASS' : 'FAIL');

// 场景C：纵向滑动（菜单滚动）不应触发
bodyClass.has = false;
fire(sidebarEl, 'pointerdown', 200, 100);
fire(sidebarEl, 'pointermove', 198, 160); // 纵向为主
fire(sidebarEl, 'pointerup', 195, 220);
const C = bodyClass.has === false;
console.log('纵向滚动不触发:', C ? 'PASS' : 'FAIL');

process.exit((pngKept && hasSwipe && A && B && C) ? 0 : 1);
