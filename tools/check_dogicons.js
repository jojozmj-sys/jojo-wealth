/* 验证 DOG_ICONS 每个页面图标是否齐全可注入 */
const fs = require('fs');
let src = fs.readFileSync('assets/dog_icons.js', 'utf8');
eval(src.replace('const DOG_ICONS', 'globalThis.DOG_ICONS'));
const ICONS = globalThis.DOG_ICONS;
const pages = ['plan','english','selfmedia','films','hot','podcast','fragment','notes','weekly','excerpt','manifest'];
console.log('=== 各页面图标注入检查 ===');
for (const p of pages) {
  const icon = ICONS[p];
  console.log(p.padEnd(10) + ' icon存在=' + !!icon + ' 含dog-ic=' + (icon ? icon.includes('dog-ic') : false) + ' 长度=' + (icon ? icon.length : 0));
}
