@echo off
REM Git Hooks 设置脚本 (Windows)
REM 用于设置 pre-commit 和 pre-push hooks

echo 正在设置 Git Hooks...

REM 检查是否在Git仓库中
if not exist ".git" (
    echo 错误: 不在Git仓库中
    exit /b 1
)

REM 确保hooks目录存在
if not exist ".git\hooks" (
    mkdir ".git\hooks"
)

REM 复制pre-commit hook
copy /Y "scripts\pre-commit-fast-test.bat" ".git\hooks\pre-commit" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Pre-commit hook 已安装
) else (
    echo ❌ Pre-commit hook 安装失败
    exit /b 1
)

REM 复制pre-push hook
copy /Y "scripts\pre-push-full-test.bat" ".git\hooks\pre-push" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Pre-push hook 已安装
) else (
    echo ❌ Pre-push hook 安装失败
    exit /b 1
)

echo.
echo ✅ Git Hooks 设置完成！
echo.
echo Pre-commit hook 会在每次提交前运行快速测试
echo Pre-push hook 会在每次推送前运行完整测试
echo.
pause
