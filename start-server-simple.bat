@echo off
REM 简单启动脚本 - 使用端口3000（通常不会被占用）

echo 启动HTTP服务器（端口3000）...
echo.
echo 服务器地址: http://localhost:3000
echo 按 Ctrl+C 停止服务器
echo.

REM 优先使用Python
python --version >nul 2>&1
if %errorlevel% == 0 (
    python -m http.server 3000
    exit /b
)

REM 如果Python不可用，使用Node.js
node --version >nul 2>&1
if %errorlevel% == 0 (
    npx --yes http-server . -p 3000 -c-1
    exit /b
)

echo 错误: 未找到Python或Node.js
pause
