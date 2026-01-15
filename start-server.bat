@echo off
REM 启动本地HTTP服务器（Windows）
REM 用于测试视频生成功能

echo ========================================
echo 启动本地HTTP服务器
echo ========================================
echo.

REM 尝试多个端口
set PORT=8000
set MAX_ATTEMPTS=5
set ATTEMPT=1

:try_port
echo 尝试使用端口 %PORT%...

REM 检查Python是否可用
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo 使用Python启动HTTP服务器...
    echo 服务器地址: http://localhost:%PORT%
    echo.
    echo 按 Ctrl+C 停止服务器
    echo.
    python -m http.server %PORT%
    goto :end
)

REM 检查Node.js是否可用
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo 使用Node.js启动HTTP服务器...
    echo 正在安装http-server（如果未安装）...
    echo 服务器地址: http://localhost:%PORT%
    echo.
    echo 按 Ctrl+C 停止服务器
    echo.
    npx --yes http-server . -p %PORT% -c-1
    goto :end
)

REM 如果端口被占用，尝试下一个端口
if %ATTEMPT% LSS %MAX_ATTEMPTS% (
    set /a PORT+=100
    set /a ATTEMPT+=1
    echo 端口可能被占用，尝试下一个端口...
    goto :try_port
)

echo 错误: 未找到Python或Node.js
echo.
echo 请安装以下任一工具:
echo 1. Python 3: https://www.python.org/downloads/
echo 2. Node.js: https://nodejs.org/
echo.
echo 或者手动运行:
echo   npx http-server . -p 3000
echo   或
echo   python -m http.server 3000
echo.
pause
:end
