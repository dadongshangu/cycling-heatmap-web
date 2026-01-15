@echo off
REM 最简单的启动方式 - 使用端口3000

echo 正在启动HTTP服务器...
echo.
echo 服务器地址: http://localhost:3000
echo 按 Ctrl+C 停止服务器
echo.

REM 优先尝试Node.js
node --version >nul 2>&1
if %errorlevel% == 0 (
    npx --yes http-server . -p 3000 -c-1
    exit /b
)

REM 如果Node.js不可用，尝试Python
python --version >nul 2>&1
if %errorlevel% == 0 (
    python -m http.server 3000
    exit /b
)

echo 错误: 未找到Node.js或Python
echo 请安装Node.js: https://nodejs.org/
pause
