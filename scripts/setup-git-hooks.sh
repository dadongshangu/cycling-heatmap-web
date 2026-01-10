#!/bin/bash
# Git Hooks 设置脚本 (Linux/Mac)
# 用于设置 pre-commit 和 pre-push hooks

echo "正在设置 Git Hooks..."

# 检查是否在Git仓库中
if [ ! -d ".git" ]; then
    echo "错误: 不在Git仓库中"
    exit 1
fi

# 确保hooks目录存在
mkdir -p .git/hooks

# 复制pre-commit hook（使用Node.js脚本）
cp "scripts/pre-commit-hook.js" ".git/hooks/pre-commit"
if [ $? -eq 0 ]; then
    chmod +x .git/hooks/pre-commit
    echo "✅ Pre-commit hook 已安装"
else
    echo "❌ Pre-commit hook 安装失败"
    exit 1
fi

# 复制pre-push hook（使用Node.js脚本）
cp "scripts/pre-push-hook.js" ".git/hooks/pre-push"
if [ $? -eq 0 ]; then
    chmod +x .git/hooks/pre-push
    echo "✅ Pre-push hook 已安装"
else
    echo "❌ Pre-push hook 安装失败"
    exit 1
fi

echo ""
echo "✅ Git Hooks 设置完成！"
echo ""
echo "Pre-commit hook 会在每次提交前运行快速测试"
echo "Pre-push hook 会在每次推送前运行完整测试"
echo ""
