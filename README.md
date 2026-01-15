# 🚴 运动轨迹热力图生成器 (Web Version)

一个基于Web的GPS轨迹热力图生成器，专注于骑行，同时支持徒步、跑步等所有GPS轨迹。将GPX轨迹文件转换为Strava风格的交互式热力图。

**当前版本：** v1.01

> **版本信息：** 版本号显示在页面底部左侧。每次成功push后，版本号会自动递增（从1.00开始，每次增加0.01，如1.01、1.02等）。版本号更新由Git pre-push hook自动处理，无需手动操作。

### 📌 稳定版本标记

**v1.01 (commit: 336fbf8)** - **稳定版本** ✅

> **标记日期：** 2024年（移动端导出功能回退后）
> 
> **版本说明：** 此版本已标记为稳定版本，移动端导出功能已回退到之前可用的配置。如果后续版本出现问题，可以通过以下命令回退到此稳定版本：
> 
> ```bash
> git checkout 336fbf8
> ```
> 
> **主要特性：**
> - ✅ 移动端导出功能正常工作（已回退优化配置）
> - ✅ PC端导出功能正常
> - ✅ 视频生成功能正常
> - ✅ 所有回归测试通过（40/40）
> 
> **已知问题：**
> - 无

## ✨ 特性

- 🌐 **纯Web应用** - 无需安装，打开浏览器即可使用
- 🔒 **隐私保护** - 所有文件在浏览器本地处理，不上传到服务器
- 🎨 **Strava风格** - 绿→黄→红渐变，完美复刻Strava热力图样式
- 📱 **响应式设计** - 支持手机、平板、电脑等各种设备
- ⚡ **实时预览** - 拖动参数滑块实时更新热力图（带防抖优化）
- 🗺️ **多地图样式** - 支持暗色/浅色地图，中英文地图切换
- 📊 **统计信息** - 显示轨迹统计数据和日期范围
- 🎯 **日期过滤** - 可选择显示特定时间范围的轨迹
- 📖 **GPX获取指南** - 详细的设备和应用导出教程
- ⌨️ **键盘快捷键** - 支持快捷键操作，提升使用效率
- 💾 **设置保存** - 自动保存用户设置，下次打开自动恢复
- 🎛️ **参数折叠** - 高级参数默认折叠，界面更简洁
- 📈 **进度显示** - 文件处理时显示详细进度和剩余时间
- 🛡️ **错误处理** - 完善的错误捕获和用户提示
- 📤 **移动端导出优化** - 优先使用Web Share API，支持高质量图片分享
- 🔍 **缩放自适应** - 根据地图缩放级别自动调整线条粗细，低缩放时自动变细避免过度糊在一起
- 💝 **捐赠支持** - 支持项目持续发展
- 🆓 **零门槛使用** - 默认使用免费英文地图，无需任何配置即可使用

## 🚀 快速开始

### 在线使用（基础功能）
1. 直接打开 `index.html` 文件
2. **步骤1：选择文件** - 拖拽或点击"1 选择文件"按钮上传轨迹记录（GPX/FIT格式）
3. **步骤2：生成热力图** - 点击"2 🗺️ 生成热力图"按钮生成热力图
4. 调整参数设置（可选）
5. **步骤3：导出热力图** - 点击地图右上角的"3 📷 导出热力图"按钮保存图片

**注意：** 视频生成功能需要在HTTP服务器环境下运行，请参考下面的"本地部署"部分。

### 本地部署（视频生成功能必需）

**重要提示：** 视频生成功能需要在HTTP服务器环境下运行，不能直接在本地文件（file://）打开。基础热力图功能可以直接打开 `index.html` 使用。

#### 快速启动（推荐）

**Windows:**
```bash
# 方法1: 双击运行（最简单）
快速启动.bat

# 方法2: 使用启动脚本（自动检测端口）
start-server.bat

# 方法3: 手动启动
npx http-server . -p 3000
```

**Linux/Mac:**
```bash
# 方法1: 使用启动脚本（自动检测端口）
chmod +x start-server.sh
./start-server.sh

# 方法2: 手动启动
npx http-server . -p 3000
# 或
python -m http.server 3000
```

#### 其他启动方法

**使用Python:**
```bash
# Python 3
python -m http.server 3000

# Python 2
python -m SimpleHTTPServer 3000
```

**使用VS Code Live Server扩展:**
1. 安装"Live Server"扩展
2. 右键点击 `index.html`
3. 选择 "Open with Live Server"
4. 自动打开 `http://localhost:5500`

**使用PHP（如果已安装）:**
```bash
php -S localhost:3000
```

#### 访问应用

启动服务器后，在浏览器中访问：
- 默认端口: `http://localhost:3000`
- 其他端口: `http://localhost:8000` 或 `http://localhost:8080`
- VS Code Live Server: `http://localhost:5500`

**注意：** 
- 确保使用 `http://` 而不是 `file://`，否则视频生成功能无法使用
- 如果端口被占用，启动脚本会自动尝试其他端口（3000, 8000, 8080, 5000）

## 📁 项目结构

```
cycling-heatmap-web/
├── index.html              # 主页面
├── donate.JPEG             # 微信赞赏码
├── css/
│   └── style.css          # 样式文件
├── js/
│   ├── main.js            # 主应用逻辑
│   ├── gpx-parser.js      # GPX文件解析器
│   ├── fit-parser.js      # FIT文件解析器
│   ├── heatmap-renderer.js # 热力图渲染器
│   ├── map-config.js      # 地图配置
│   └── utils.js           # 工具函数
├── scripts/
│   ├── check-syntax.js    # 语法检查脚本
│   ├── check-files.js     # 文件完整性检查
│   ├── check-quality.js   # 代码质量检查
│   ├── test/              # 测试系统目录
│   │   ├── unit/          # 单元测试
│   │   ├── regression/    # 回归测试
│   │   │   └── test-all-regression.js  # 统一回归测试入口
│   │   ├── fixtures/      # 测试数据
│   │   ├── utils/          # 测试工具
│   │   └── test-all.js    # 运行所有测试
│   ├── pre-commit-hook.js        # Pre-commit hook（Node.js，跨平台）
│   ├── pre-push-hook.js          # Pre-push hook（Node.js，跨平台）
│   ├── setup-git-hooks.bat       # Git hooks设置脚本（Windows）
│   └── setup-git-hooks.sh        # Git hooks设置脚本（Linux/Mac）
│   └── README.md          # 脚本使用说明
├── doc/
│   ├── TESTING_GUIDE.md   # 测试指南
│   ├── DEVELOPER_GUIDE.md # 开发指南
│   ├── BUG_ANALYSIS_AND_PREVENTION.md # 错误分析
│   └── OPTIMIZATION_SUGGESTIONS.md    # 优化建议
├── assets/
│   └── demo/              # 示例轨迹记录GPX
│       ├── README.md      # 示例文件说明
│       ├── sample_beijing_ride.gpx
│       └── sample_shanghai_ride.gpx
├── js/
│   └── video-generator.js # 视频生成器（新增）
├── start-server.bat       # Windows服务器启动脚本
├── start-server.sh        # Linux/Mac服务器启动脚本
└── 快速启动.bat            # Windows快速启动脚本（推荐）
```

### 依赖库 (通过CDN加载)
- Leaflet.js - 地图库
- Leaflet.heat - 热力图插件
- html2canvas - 地图导出功能

## 🎨 界面预览

### 主界面
- **左侧面板**: 文件上传、参数控制、统计信息
- **右侧面板**: 交互式地图显示区域
- **响应式布局**: 自动适配不同屏幕尺寸

### 功能区域
1. **文件上传区** - 支持拖拽和点击上传
2. **参数控制面板** - 实时调节热力图参数
3. **统计信息面板** - 显示轨迹数据统计
4. **交互式地图** - 显示热力图结果

## ⚙️ 参数说明

### 地图样式
- **暗色地图** (推荐) - CartoDB Dark，高对比度
- **浅色地图** - CartoDB Positron，淡雅清爽

### 地图语言
- **English Map** - CartoDB英文地图，国际通用，**完全免费，无需配置**（推荐）
- **中文地图(矢量)** - 天地图矢量底图，中文标注（需要API密钥，可选功能）
- **中文卫星图** - 天地图影像底图，中文标注（需要API密钥，可选功能）

> 💡 **提示**：默认使用免费英文地图，无需任何配置即可使用所有核心功能。中文地图是可选的高级功能，需要配置天地图API密钥。

### 热力图参数
- **地图样式** - 暗色/浅色地图切换
- **地图语言** - 英文地图（免费）/ 中文地图（需API密钥）
- **线条粗细** (1-10) - 控制热力图线条的粗细程度（高级参数，默认折叠）
- **模糊程度** (1-20) - 控制热力图的模糊效果（高级参数，默认折叠）
- **透明度** (0.1-1.0) - 控制热力图的透明度（高级参数，默认折叠）
- **时间范围** - 过滤显示特定时间段的轨迹

> 💡 **提示**：高级参数（线条粗细、模糊程度、透明度）默认折叠，需要精细调节时可点击"🎨 高级参数设置"展开。

### 推荐设置
```
线条粗细: 1-2 (最细，最像Strava)
模糊程度: 1-3 (最清晰)
透明度: 0.8 (高对比度)
地图样式: 暗色地图
```

### 热力图渲染优化

- **智能插值** - 自动在轨迹点之间插值，确保热力图显示为连续线条而非离散点
- **轨迹边界保护** - 只在真实轨迹段内部插值，不在不同轨迹之间生成虚假连接
- **Douglas-Peucker算法** - 智能简化大数据集，保持轨迹形状的同时减少点数
- **缩放自适应** - 根据地图缩放级别自动调整线条粗细，低缩放时自动变细避免过度糊在一起

### FIT文件解析特性

- **智能坐标格式检测** - 自动识别semicircles和degrees格式，确保正确转换
- **全局离群点过滤** - 使用统计方法过滤地理位置上异常的GPS点（如非洲的点）
- **相邻点距离检测** - 检测并过滤跨洲异常点，保持轨迹连续性
- **多消息类型支持** - 支持所有FIT消息类型，不限制消息类型20（Record）
- **降级方案** - 如果外部库不可用，自动使用内置手动解析器

### 键盘快捷键
- `Ctrl/Cmd + O` - 打开文件选择对话框
- `Ctrl/Cmd + G` - 生成热力图（按钮可用时）
- `Esc` - 关闭所有打开的模态框

### 设置自动保存
应用会自动保存您的设置（地图样式、语言、参数等），下次打开时会自动恢复，无需重复配置。

## 📊 支持的文件格式

- **轨迹记录GPX** (.gpx) - GPS Exchange Format
- **轨迹记录FIT** (.fit) - Garmin 等码表常用的二进制轨迹格式
- **批量上传** - 支持同时上传多个文件（可混合 GPX 和 FIT 格式）
- **自动解析** - 提取轨迹点、时间戳、海拔等信息
- **文件大小限制** - 单个文件最大50MB，总大小最大200MB
- **文件验证** - 自动验证文件格式和大小，超大文件会提示跳过

> **提示**：如果您有 `.fit.gz` 压缩文件，请先解压为 `.fit` 格式后再上传。可以使用 7-Zip、WinRAR 等解压工具，或在线解压服务。

## 📖 轨迹记录GPX获取指南

应用内置了详细的轨迹记录GPX获取指南，涵盖各种设备和应用：

### 🚴 码表设备
- **迈金码表 (MEILAN)** - 通过顽鹿竞技App导出
- **iGPSPORT码表** - 通过官方App导出
- **Garmin码表** - 通过Garmin Connect导出
- **Wahoo码表** - 通过ELEMNT App导出
- **其他品牌** - 猫眼、速腾、百锐腾等

### ⌚ 智能手表
- **Apple Watch** - 通过第三方App导出
- **Garmin手表** - 通过Garmin Connect导出
- **华为/小米手表** - 通过运动健康App导出

### 📱 手机应用
- **国际应用** - Strava、Komoot、MapMyRide等
- **国内骑行应用** - 顽鹿竞技、骑记、行者、咕咚等
- **国内徒步应用** - 两步路（户外助手）、六只脚等
- **运动健身应用** - 悦跑圈、Keep等

### 🔍 智能搜索
点击"📖 如何获取轨迹记录GPX？"按钮，使用搜索功能快速找到你的设备：
- 搜索"迈金"找到迈金码表的导出方法
- 搜索"Strava"找到Strava的导出步骤
- 搜索"Apple Watch"找到手表的导出方式

## 🎯 技术特点

### 核心技术
- **纯前端实现** - HTML5 + CSS3 + ES6 JavaScript
- **Leaflet.js** - 轻量级地图库
- **Leaflet.heat** - 热力图插件
- **DOMParser** - XML解析（GPX文件）
- **二进制解析** - 手动FIT文件解析（支持所有消息类型）
- **File API** - 文件处理
- **ArrayBuffer** - 二进制数据处理
- **GeoUtils** - 地理计算工具类（Haversine距离计算、角度转换等）

### 性能优化
- **分块处理** - 大文件分批解析
- **防抖优化** - 参数调节使用防抖，避免频繁更新
- **动态参数** - 根据缩放级别自动调整
- **内存管理** - 及时清理不需要的数据，防止内存泄漏
- **文件大小验证** - 防止超大文件导致内存溢出
- **进度显示** - 实时显示处理进度和剩余时间估算
- **代码优化** - 提取公共工具函数（GeoUtils），减少代码重复
- **函数拆分** - 大函数拆分为小函数，提升可维护性和性能
- **魔法数字提取** - 将硬编码数字提取为常量，提升代码可读性
- **遍历优化** - 合并多次遍历，减少循环次数，提升处理速度
- **导出性能优化** - html2canvas配置优化，禁用foreignObject渲染，忽略不必要元素，减少图片加载超时，预计提升20-30%导出速度

### 浏览器兼容性
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 🔧 自定义配置

### 修改默认参数
编辑 `js/heatmap-renderer.js` 中的默认配置：

```javascript
this.heatmapOptions = {
    radius: 1,        // 默认半径
    blur: 1,          // 默认模糊度
    minOpacity: 0.8,  // 默认透明度
    maxZoom: 18       // 最大缩放级别
};
```

### 修改颜色渐变
编辑 `getStravaGradient()` 函数：

```javascript
getStravaGradient() {
    return {
        0.0: '#00ff00',    // 绿色 - 低频率
        0.3: '#80ff00',    // 黄绿色
        0.5: '#ffff00',    // 黄色 - 中频率
        0.7: '#ff8000',    // 橙色
        1.0: '#ff0000'     // 红色 - 高频率
    };
}
```

### 添加新的地图样式
在 `setMapStyle()` 函数中添加新的瓦片层：

```javascript
case 'satellite':
    tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });
    break;
```

### 配置天地图API密钥（可选）

> ⚠️ **重要提示**：这是可选功能！默认使用免费英文地图（CartoDB），无需任何配置即可使用所有核心功能。中文地图是可选的高级功能。

如果您想使用中文地图，需要配置天地图API密钥：

1. **获取API密钥**：
   - 访问 [天地图官网](http://lbs.tianditu.gov.cn/)
   - 注册账号并登录
   - 进入控制台，创建应用
   - 获取API密钥（Key）

2. **配置密钥**：
   - 在应用界面中，点击参数设置区域的"⚙️ API设置（可选，用于中文地图）"链接
   - 输入您的天地图API密钥
   - 点击"保存密钥"

3. **使用中文地图**：
   - 配置完成后，在地图语言选项中选择"中文地图"或"中文卫星图"
   - 密钥保存在浏览器本地，不会上传到服务器

#### 🚀 快速设置书签（推荐）

为了方便重复使用，您可以生成一个浏览器书签，点击一次即可自动设置API密钥：

**方式一：自动设置书签（最方便）**
1. 在API密钥配置页面输入您的密钥
2. 点击"🔖 生成自动设置书签"按钮
3. 将生成的链接拖拽到浏览器书签栏
4. 每次访问此应用时，点击书签即可自动设置密钥并刷新页面
   - ✅ 优点：一键设置，无需重复输入
   - ⚠️ 注意：书签包含您的密钥，请妥善保管

**方式二：输入式书签（更安全）**
1. 在API密钥配置页面点击"📝 生成输入式书签"按钮
2. 将生成的链接拖拽到浏览器书签栏
3. 每次访问时点击书签，会弹出输入框让您输入密钥
   - ✅ 优点：不包含密钥，更安全
   - ⚠️ 缺点：每次需要输入密钥

> 💡 **推荐**：如果您是个人使用，推荐使用"自动设置书签"，方便快捷！

> 💡 **提示**：
> - 个人开发者每日有10,000次免费调用限制
> - 如果未配置密钥，选择中文地图时会自动切换回英文地图
> - 英文地图功能完全相同，推荐使用
> - 书签中的密钥经过编码，相对安全，但仍建议不要分享书签

## 🚀 部署选项

### 1. GitHub Pages (推荐)
```bash
# 1. 创建GitHub仓库
# 2. 上传项目文件
# 3. 在Settings -> Pages中启用GitHub Pages
# 4. 选择main分支作为源
```

### 2. Netlify
```bash
# 1. 注册Netlify账号
# 2. 连接GitHub仓库或直接拖拽文件夹
# 3. 自动部署完成
```

### 3. Vercel
```bash
# 1. 安装Vercel CLI
npm i -g vercel

# 2. 在项目目录运行
vercel

# 3. 按提示完成部署
```

### 4. 自托管
```bash
# 使用Nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/bike_heat_web_version;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
}
```

## 🔍 故障排除

### 常见问题

**Q: 地图显示空白？**
A: 检查网络连接，确保能访问地图瓦片服务器

**Q: 轨迹记录GPX解析失败？**
A: 确保文件格式正确，包含有效的轨迹点数据

**Q: 热力图不显示？**
A: 检查轨迹点数量，确保有足够的数据点

**Q: 参数调节无效？**
A: 先生成热力图，然后调节参数会实时更新

### 调试模式
打开浏览器开发者工具 (F12)，查看控制台输出：

```javascript
// 查看应用状态
console.log(window.app);

// 查看加载的轨迹数据
console.log(window.app.loadedTracks);

// 查看地图实例
console.log(window.app.heatmapRenderer.map);
```

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发环境设置
```bash
# 1. Fork项目
# 2. 克隆到本地
git clone <your-fork-url>

# 3. 创建功能分支
git checkout -b feature/new-feature

# 4. 提交更改
git commit -m "Add new feature"

# 5. 推送到GitHub
git push origin feature/new-feature

# 6. 创建Pull Request
```

### 代码规范
- 使用ES6+语法
- 添加适当的注释
- 保持代码整洁
- 测试新功能

### 提交前测试

项目包含自动测试系统，提交前会自动运行：

```bash
# 手动运行所有测试（推荐）
npm test
# 或
node scripts/test/test-all.js

# 单独运行各项测试
node scripts/check-syntax.js      # 语法检查
node scripts/check-files.js       # 文件完整性
node scripts/check-quality.js     # 代码质量
```

**Git Hooks：** 每次 `git commit` 和 `git push` 会自动运行测试，失败时阻止操作。

**设置Git Hooks：**
```bash
# Windows（推荐）
scripts\setup-git-hooks.bat

# Linux/Mac（推荐）
chmod +x scripts/setup-git-hooks.sh
./scripts/setup-git-hooks.sh
```

**注意：** Git hooks使用Node.js脚本（.js文件），可以跨平台工作，Git可以直接执行。

**测试内容：**
- ✅ JavaScript语法检查
- ✅ 括号配对验证
- ✅ 文件完整性检查
- ✅ HTML结构验证
- ✅ 代码质量检查
- ✅ 单元测试（GeoUtils、GPX解析器）
- ✅ 回归测试（导出功能、FIT解析、视频生成）

详细说明请参考：`doc/TESTING_GUIDE.md`

## 📌 版本信息

### 版本号格式
- 版本号格式：`主版本号.次版本号`（如 `1.01`、`1.02`）
- 初始版本：`1.00`
- 递增规则：每次成功push后自动递增 `0.01`

### 自动递增机制
版本号由Git pre-push hook自动管理：

1. **自动更新**：每次成功push后，版本号会自动递增
2. **自动提交**：版本号更新后会自动创建commit并包含在push中
3. **智能检查**：如果未推送的commit中已包含版本号更新，则跳过以避免重复
4. **显示位置**：版本号显示在页面底部左侧

### 版本号文件
- `VERSION`：文本文件，存储当前版本号
- `package.json`：同时更新version字段

### 手动更新（不推荐）
如果需要手动更新版本号，可以：
1. 编辑 `VERSION` 文件
2. 运行 `node scripts/bump-version.js`
3. 提交更改

**注意**：手动更新版本号后，下次push时不会自动递增，直到版本号与远程同步。

## 📖 文档

### 主要文档
- **README.md** (本文件) - 项目概述和快速开始
- **doc/DEVELOPER_GUIDE.md** - 完整开发指南，包含架构设计、代码结构、开发流程等
- **doc/TESTING_GUIDE.md** - 测试指南，包含测试系统使用说明
- **doc/BUG_ANALYSIS_AND_PREVENTION.md** - Bug分析和预防指南
- **doc/OPTIMIZATION_SUGGESTIONS.md** - 性能优化建议

### 代码审查
- **CODE_REVIEW_VIDEO_FEATURE.md** - 视频生成功能代码审查报告

### 测试文档
- **scripts/test/REGRESSION_TEST_SUMMARY.md** - 回归测试总结
- **scripts/test/README.md** - 测试系统说明
- **scripts/README.md** - 脚本使用说明

### 示例文件
- **assets/demo/README.md** - 示例GPX文件说明

## 📄 许可证

MIT License - 详见 [LICENSE](../LICENSE) 文件

## 🙏 致谢

- [Leaflet.js](https://leafletjs.com/) - 优秀的地图库
- [CartoDB](https://carto.com/) - 提供地图瓦片服务
- [Strava](https://www.strava.com/) - 热力图设计灵感

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 📧 **Email**: dadongshangu@outlook.com
- 🌐 **个人网页**: https://dadongshangu.github.io
- 🐛 **GitHub Issues**: [项目Issues页面]

---

**享受你的运动轨迹热力图之旅！** 🚴‍♂️✨
