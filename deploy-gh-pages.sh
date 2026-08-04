#!/bin/bash
# ============================================================
# 固定链接一键部署脚本 (GitHub Pages)
# 用法: bash deploy-gh-pages.sh <你的GitHub用户名> [仓库名]
#   仓库名默认 jojo-wealth，链接固定为:
#   https://<用户名>.github.io/<仓库名>/
#
# 前置条件: 已通过 `gh auth login` 登录 GitHub
# ============================================================
set -e

GH_USER="${1:-}"
REPO="${2:-jojo-wealth}"

if [ -z "$GH_USER" ]; then
  echo "❌ 请传入你的 GitHub 用户名，例如: bash deploy-gh-pages.sh jojo"
  echo "   查看用户名: gh api user --jq .login"
  exit 1
fi

# 检查 gh 是否登录
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ 尚未登录 GitHub，请先运行: gh auth login"
  exit 1
fi

SRC=".gh-pages"          # 发布目录（资源均为相对路径，适配子路径）
REPO_FULL="$GH_USER/$REPO"

echo "════════════════════════════════════════"
echo "  固定链接部署 → https://$GH_USER.github.io/$REPO/"
echo "════════════════════════════════════════"

# 1. 创建仓库（若不存在）
echo "① 检查/创建仓库 $REPO_FULL ..."
if gh repo view "$REPO_FULL" >/dev/null 2>&1; then
  echo "   ✓ 仓库已存在，复用"
else
  gh repo create "$REPO_FULL" --public --source="$SRC" --push 2>/dev/null \
    || gh repo create "$REPO_FULL" --public 2>/dev/null \
    || echo "   ⚠️ 仓库创建可能有提示，继续"
  echo "   ✓ 仓库已创建"
fi

# 2. 初始化 git 并提交推送
echo "② 提交并推送文件 ..."
cd "$SRC"
if [ ! -d .git ]; then
  git init -q
  git checkout -q -b main
fi
git add -A
# 仅在确有改动时提交
if git diff --cached --quiet; then
  echo "   ✓ 无改动，跳过提交"
else
  git -c user.name="$GH_USER" -c user.email="$GH_USER@users.noreply.github.com" \
      commit -q -m "update $(date '+%Y-%m-%d %H:%M')"
fi
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$REPO_FULL.git"
git push -q -u origin main 2>/dev/null || git push -q -u origin main --force
echo "   ✓ 已推送到 main 分支"
cd ..

# 3. 开启 GitHub Pages（从 main 分支 / 根目录）
echo "③ 开启 GitHub Pages ..."
gh api "repos/$REPO_FULL/pages" \
  -X POST \
  -f source[branch]=main -f source[path]=/ >/dev/null 2>&1 \
  || echo "   (Pages 可能已开启或需等待，稍后自动生效)"

echo ""
echo "✅ 完成！固定链接（约1分钟内生效）:"
echo "   https://$GH_USER.github.io/$REPO/"
echo ""
echo "   📌 以后每次改版，只需重新运行:"
echo "      bash deploy-gh-pages.sh $GH_USER $REPO"
echo "      改完 push 后刷新页面即见最新版，链接永不变化。"
