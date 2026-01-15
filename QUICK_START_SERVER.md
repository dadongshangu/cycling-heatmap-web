# 快速启动本地服务器

## 🚀 最简单的方法（推荐）

### 如果您有Node.js（已检测到）

在项目根目录打开命令行，运行：

```bash
npx http-server . -p 8000
```

然后在浏览器中访问：**http://localhost:8000**

### 如果您有Python

在项目根目录打开命令行，运行：

```bash
python -m http.server 8000
```

然后在浏览器中访问：**http://localhost:8000**

## 📝 详细步骤

1. **打开命令行/终端**
   - Windows: 按 `Win+R`，输入 `cmd`，回车
   - Mac: 打开"终端"应用
   - Linux: 打开终端

2. **进入项目目录**
   ```bash
   cd E:\3.github\repositories\cycling-heatmap-web
   ```

3. **启动服务器**
   ```bash
   # 方法1: Node.js（推荐）
   npx http-server . -p 8000
   
   # 方法2: Python
   python -m http.server 8000
   ```

4. **打开浏览器**
   - 访问：`http://localhost:8000`
   - **重要：** 确保地址栏显示 `http://` 而不是 `file://`

5. **测试视频生成**
   - 上传轨迹文件
   - 生成热力图
   - 点击"生成视频"按钮

## ⚠️ 注意事项

- ✅ 服务器运行期间，命令行窗口不要关闭
- ✅ 停止服务器：按 `Ctrl+C`
- ✅ 如果端口8000被占用，可以改用其他端口（如8080）

## 🎯 验证是否成功

打开浏览器访问 `http://localhost:8000`，如果能看到应用界面，说明服务器启动成功！

## 📚 更多信息

详细说明请查看：`LOCAL_SERVER_GUIDE.md`
