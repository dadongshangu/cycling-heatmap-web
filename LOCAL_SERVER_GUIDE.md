# 本地HTTP服务器启动指南

视频生成功能需要在HTTP服务器环境下运行，不能直接在本地文件（file://）打开。本指南提供多种启动本地服务器的方法。

## 🚀 快速启动

### Windows用户

**方法1: 使用启动脚本（最简单）**
```bash
# 双击运行或在命令行执行
start-server.bat
```

**方法2: 手动启动**
```bash
# 如果已安装Python
python -m http.server 8000

# 如果已安装Node.js
npx http-server . -p 8000
```

### Linux/Mac用户

**方法1: 使用启动脚本（最简单）**
```bash
# 添加执行权限（首次运行）
chmod +x start-server.sh

# 运行脚本
./start-server.sh
```

**方法2: 手动启动**
```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js
npx http-server . -p 8000
```

## 📋 详细方法说明

### 方法1: Python HTTP服务器（推荐）

**优点：** 简单、无需安装额外工具、Python通常已预装

**步骤：**
1. 打开命令行/终端
2. 进入项目目录
3. 执行命令：
   ```bash
   # Python 3
   python -m http.server 8000
   
   # 或 Python 2
   python -m SimpleHTTPServer 8000
   ```
4. 在浏览器中访问：`http://localhost:8000`

**停止服务器：** 按 `Ctrl+C`

### 方法2: Node.js http-server

**优点：** 功能丰富、支持自动刷新

**步骤：**
1. 打开命令行/终端
2. 进入项目目录
3. 执行命令：
   ```bash
   npx http-server . -p 8000
   ```
4. 在浏览器中访问：`http://localhost:8000`

**停止服务器：** 按 `Ctrl+C`

**可选参数：**
- `-p 8000`: 指定端口（默认8080）
- `-c-1`: 禁用缓存
- `-o`: 自动打开浏览器

### 方法3: VS Code Live Server（推荐给开发者）

**优点：** 自动刷新、集成在编辑器中

**步骤：**
1. 安装VS Code扩展 "Live Server"
2. 在VS Code中打开项目
3. 右键点击 `index.html`
4. 选择 "Open with Live Server"
5. 自动打开 `http://localhost:5500`

### 方法4: PHP内置服务器

**步骤：**
```bash
php -S localhost:8000
```

### 方法5: 其他工具

**使用serve（Node.js包）:**
```bash
npx serve . -p 8000
```

**使用http-server（全局安装）:**
```bash
# 全局安装
npm install -g http-server

# 运行
http-server . -p 8000
```

## ✅ 验证服务器是否运行

1. 打开浏览器
2. 访问 `http://localhost:8000`（或您设置的端口）
3. 应该能看到应用界面
4. 检查地址栏：应该是 `http://` 开头，**不是** `file://`

## 🎬 测试视频生成功能

1. 确保服务器正在运行
2. 在浏览器中访问应用
3. 上传轨迹文件并生成热力图
4. 点击"生成视频"按钮
5. 选择时间范围（默认最近一年）
6. 开始生成视频

## ⚠️ 常见问题

**Q: 端口被占用怎么办？**
A: 使用其他端口，例如：
```bash
python -m http.server 8080
# 然后访问 http://localhost:8080
```

**Q: 如何知道服务器是否启动成功？**
A: 命令行会显示类似信息：
```
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

**Q: 仍然出现SecurityError？**
A: 
- 确保使用 `http://localhost:8000` 而不是 `file://`
- 检查浏览器控制台，确认协议是 `http:`
- 尝试清除浏览器缓存

**Q: 如何在同一网络的其他设备访问？**
A: 
- 找到您的IP地址（Windows: `ipconfig`，Mac/Linux: `ifconfig`）
- 使用 `http://您的IP:8000` 访问
- 确保防火墙允许该端口

## 📝 注意事项

- ✅ 使用 `http://` 协议（不是 `file://`）
- ✅ 确保端口未被占用
- ✅ 视频生成需要良好的网络连接（加载FFmpeg.wasm库）
- ✅ 建议使用现代浏览器（Chrome、Firefox、Edge最新版本）

## 🔗 相关链接

- [Python官网](https://www.python.org/downloads/)
- [Node.js官网](https://nodejs.org/)
- [VS Code Live Server扩展](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
