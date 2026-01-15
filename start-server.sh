#!/bin/bash
# 启动本地HTTP服务器（Linux/Mac）
# 用于测试视频生成功能

echo "========================================"
echo "启动本地HTTP服务器"
echo "========================================"
echo ""

# 检查Python是否可用
if command -v python3 &> /dev/null; then
    echo "使用Python启动HTTP服务器..."
    echo "服务器地址: http://localhost:8000"
    echo ""
    echo "按 Ctrl+C 停止服务器"
    echo ""
    python3 -m http.server 8000
    exit 0
fi

# 检查Python 2是否可用
if command -v python &> /dev/null; then
    echo "使用Python启动HTTP服务器..."
    echo "服务器地址: http://localhost:8000"
    echo ""
    echo "按 Ctrl+C 停止服务器"
    echo ""
    python -m SimpleHTTPServer 8000
    exit 0
fi

# 检查Node.js是否可用
if command -v node &> /dev/null; then
    echo "使用Node.js启动HTTP服务器..."
    echo "正在安装http-server（如果未安装）..."
    npx --yes http-server . -p 8000 -c-1
    exit 0
fi

echo "错误: 未找到Python或Node.js"
echo ""
echo "请安装以下任一工具:"
echo "1. Python 3: https://www.python.org/downloads/"
echo "2. Node.js: https://nodejs.org/"
echo ""
exit 1
