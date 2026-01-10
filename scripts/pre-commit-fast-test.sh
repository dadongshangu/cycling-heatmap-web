#!/bin/bash
# Git pre-commit hook - 快速测试
# 运行快速测试（单元测试和回归测试）

echo "🔍 运行提交前快速测试..."

# 运行语法检查
node scripts/check-syntax.js
if [ $? -ne 0 ]; then
    echo "❌ 语法检查失败，请修复后再提交"
    exit 1
fi

# 运行文件完整性检查
node scripts/check-files.js
if [ $? -ne 0 ]; then
    echo "❌ 文件完整性检查失败，请修复后再提交"
    exit 1
fi

# 运行单元测试
node scripts/test/unit/test-geo-utils.js
if [ $? -ne 0 ]; then
    echo "❌ 单元测试失败，请修复后再提交"
    exit 1
fi

# 运行回归测试
node scripts/test/regression/test-export-regression.js
if [ $? -ne 0 ]; then
    echo "❌ 导出功能回归测试失败，请修复后再提交"
    exit 1
fi

node scripts/test/regression/test-fit-regression.js
if [ $? -ne 0 ]; then
    echo "❌ FIT解析回归测试失败，请修复后再提交"
    exit 1
fi

echo "✅ 所有快速测试通过！"
exit 0
