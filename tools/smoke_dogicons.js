/* 验证 initDogIcons 图标注入：mock 侧边栏菜单，执行 app.js，确认 .micon 被替换为 dog-ic SVG */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

// 1. 加载 data.js
const dataSrc = fs.readFileSync(path.join(root, 'assets/data.js'), 'utf8');
const jsonText = dataSrc.replace(/^window\.WORKBENCH_DATA\s*=\s*/, '').replace(/;\s*$/, '');
const WORKBENCH_DATA = eval('(' + jsonText + ')');

// 2. 预定义 11 个侧边栏菜单项（data-page + .micon）
const pages = ['plan','english','selfmedia','films','hot','podcast','fragment','notes','weekly','excerpt','manifest'];
const menuItems = pages.map(p => {
  const micon = {
    id: 'micon-' + p, textContent: '', innerHTML: '', dataset: {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    querySelector(){ return null; }, querySelectorAll(){ return []; }
  };
  const a = {
    id: 'menu-' + p, dataset: { page: p }, textContent: '', innerHTML: '',
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    querySelector(sel){ return sel === '.micon' ? micon : null; },
    querySelectorAll(){ return []; }
  };
  return a;
});

// 3. 元素缓存
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

// brand-emoji 元素
const brandEmoji = makeEl('brand-emoji');
elements['brand-emoji'] = brandEmoji;

global.document = {
  getElementById(id){ return get(id); },
  querySelector(sel){ return get(sel); },
  // 侧边栏菜单：返回 11 个 menu item
  querySelectorAll(sel){
    if (sel === '.menu a[data-page]') return menuItems;
    if (sel === '.menu a') return menuItems;
    return [];
  },
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

// 4. 先加载 dog_icons.js 注入 DOG_ICONS
const dogSrc = fs.readFileSync(path.join(root, 'assets/dog_icons.js'), 'utf8');
global.window.DOG_ICONS = null;
eval(dogSrc); // const DOG_ICONS + window.DOG_ICONS = DOG_ICONS

// 5. 执行 app.js
const appSrc = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
try {
  eval(appSrc);
  console.log('OK app.js 完整初始化成功');
} catch (e) {
  console.log('FAIL app.js 异常:', e.message);
  console.log(e.stack);
  process.exit(1);
}

// 6. 验证图标注入
console.log('\n=== 侧边栏图标注入验证 ===');
let allInjected = true;
for (let i = 0; i < menuItems.length; i++) {
  const a = menuItems[i];
  const micon = a.querySelector('.micon');
  const injected = micon.innerHTML.includes('dog-ic');
  if (!injected) allInjected = false;
  console.log(`${a.dataset.page.padEnd(10)} 注入=${injected} 内容前缀=${String(micon.innerHTML).slice(0, 40)}`);
}
console.log('\n全部注入:', allInjected ? 'PASS' : 'FAIL');
if (allInjected) console.log('PASS 侧边栏 11 个图标全部替换为线条小狗贴纸');
else process.exit(1);
