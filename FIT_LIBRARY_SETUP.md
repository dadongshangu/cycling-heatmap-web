# FIT 库文件设置说明

## 重要提示

**当前代码已实现自动降级方案**：如果 `fit-file-parser` 库未找到，系统会自动使用手动解析方案。因此，下载库文件是**可选的**，但推荐下载以获得更好的准确性和性能。

## 获取 fit-file-parser 库文件

由于 `fit-file-parser` 库主要用于 Node.js 环境，需要获取浏览器兼容版本。以下是几种获取方式：

### 方式1：从 npm 安装后复制（推荐）

1. 在项目根目录创建临时目录并安装库：
   ```bash
   npm install fit-file-parser
   ```

2. 从 `node_modules/fit-file-parser` 目录中找到浏览器构建文件：
   - 查找 `dist/` 或 `build/` 目录
   - 或者查找 `.min.js` 文件
   - 检查 `package.json` 中的 `main` 或 `browser` 字段

3. 将文件复制到项目的 `js/` 目录，命名为 `fit-file-parser.min.js`

4. 清理临时文件：
   ```bash
   npm uninstall fit-file-parser
   rm -rf node_modules package-lock.json
   ```

### 方式2：从 GitHub 下载

1. 访问 fit-file-parser 的 GitHub 仓库：https://github.com/jimmykane/fit-parser
2. 查看 releases 页面，下载浏览器构建版本
3. 或从源码构建浏览器版本（需要 Node.js 和构建工具）

### 方式3：使用 CDN（临时方案）

如果无法下载到本地，可以临时使用 CDN（但可能加载较慢）：

在 `index.html` 中，将：
```html
<script src="js/fit-file-parser.min.js" ...></script>
```

替换为：
```html
<script src="https://cdn.jsdelivr.net/npm/fit-file-parser@latest/dist/fit-file-parser.min.js"></script>
```

**注意**：需要确认 CDN 上是否有该文件。

### 方式4：继续使用手动解析（当前默认）

如果无法获取库文件，代码会自动使用手动解析方案。虽然可能不如库准确，但功能仍然可用。

## 验证库文件

下载后，库文件应该：
- 可以在浏览器中直接使用（UMD 或 IIFE 格式）
- 暴露全局变量（如 `FitParser` 或 `FitFileParser`）
- 支持 `new FitParser().parse(arrayBuffer, callback)` 方法

## 库的预期 API

```javascript
const fitParser = new FitParser({
  force: true,
  speedUnit: 'km/h',
  lengthUnit: 'km',
  temperatureUnit: 'celsius',
  mode: 'cascade'
});

fitParser.parse(arrayBuffer, (error, data) => {
  if (error) {
    console.error('Parse error:', error);
  } else {
    // data.records 包含解析后的记录
    // 每个记录可能包含：position_lat, position_long, timestamp, altitude 等
  }
});
```

## 测试库是否加载成功

1. 打开浏览器开发者工具（F12）
2. 在 Console 中输入：`typeof FitParser` 或 `typeof FitFileParser`
3. 如果返回 `"function"`，说明库加载成功
4. 如果返回 `"undefined"`，说明库未加载，将使用降级方案
