@echo off
REM Git Hook 设置脚本 (Windows)
REM 用于设置 pre-commit hook

echo Setting up Git pre-commit hook...

REM 检查是否在Git仓库中
if not exist ".git" (
    echo Error: Not in a Git repository
    exit /b 1
)

REM 复制pre-commit hook
copy /Y "scripts\pre-commit-template" ".git\hooks\pre-commit" >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo Git pre-commit hook installed successfully!
    echo.
    echo The hook will automatically run tests before each commit.
) else (
    echo.
    echo Note: Git hooks directory may not exist yet.
    echo You can manually copy the hook file:
    echo   copy scripts\pre-commit-template .git\hooks\pre-commit
)

pause
