@echo off
REM Git pre-push hook - 完整测试 (Windows)
REM 运行所有测试（包括集成测试）

echo 🚀 运行推送前完整测试...

REM 运行所有测试
node scripts\test\test-all.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 完整测试失败，请修复后再推送
    exit /b 1
)

echo ✅ 所有测试通过！可以安全推送。
exit /b 0
