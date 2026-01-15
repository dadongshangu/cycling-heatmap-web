@echo off
chcp 65001 >nul
echo ========================================
echo 启动本地HTTP服务器
echo ========================================
echo.

REM 优先使用端口3000
set PORT=3000

REM 检查Node.js
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo 使用Node.js启动服务器...
    echo.
    echo ========================================
    echo 服务器地址: http://localhost:%PORT%
    echo ========================================
    echo.
    echo 按 Ctrl+C 停止服务器
    echo.
    npx --yes http-server . -p %PORT% -c-1
    goto :end
)

REM 检查Python
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo 使用Python启动服务器...
    echo.
    echo ========================================
    echo 服务器地址: http://localhost:%PORT%
    echo ========================================
    echo.
    echo 按 Ctrl+C 停止服务器
    echo.
    python -m http.server %PORT%
    goto :end
)

echo.
echo 错误: 未找到Python或Node.js
echo.
echo 请安装以下任一工具:
echo   1. Python 3: https://www.python.org/downloads/
echo   2. Node.js: https://nodejs.org/
echo.
pause

:end
