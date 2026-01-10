@echo off
REM Git pre-commit hook - 快速测试 (Windows)
REM 运行快速测试（单元测试和回归测试）

echo 🔍 运行提交前快速测试...

REM 运行语法检查
node scripts\check-syntax.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 语法检查失败，请修复后再提交
    exit /b 1
)

REM 运行文件完整性检查
node scripts\check-files.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 文件完整性检查失败，请修复后再提交
    exit /b 1
)

REM 运行单元测试
node scripts\test\unit\test-geo-utils.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 单元测试失败，请修复后再提交
    exit /b 1
)

REM 运行GPX解析器测试（如果依赖已安装）
node scripts\test\unit\test-gpx-parser.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ GPX解析器测试失败，请修复后再提交
    exit /b 1
)

REM 运行回归测试
node scripts\test\regression\test-export-regression.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 导出功能回归测试失败，请修复后再提交
    exit /b 1
)

node scripts\test\regression\test-fit-regression.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ FIT解析回归测试失败，请修复后再提交
    exit /b 1
)

echo ✅ 所有快速测试通过！
exit /b 0
