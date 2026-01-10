# 🚴 运动轨迹热力图生成器 (Web Version)

一个基于Web的GPS轨迹热力图生成器，专注于骑行，同时支持徒步、跑步等所有GPS轨迹。将GPX轨迹文件转换为Strava风格的交互式热力图。

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
- 💝 **捐赠支持** - 支持项目持续发展
- 🆓 **零门槛使用** - 默认使用免费英文地图，无需任何配置即可使用

## 🚀 快速开始

### 在线使用
1. 直接打开 `index.html` 文件
2. 拖拽或选择轨迹记录GPX上传
3. 调整参数设置（可选）
4. 点击"生成热力图"按钮
5. 在地图上查看结果

### 本地部署
```bash
# 克隆项目
git clone <repository-url>

# 进入Web版本目录
cd bike_heat_web_version

# 使用任意HTTP服务器运行
# 方法1: 使用Python
python -m http.server 8000

# 方法2: 使用Node.js
npx serve .

# 方法3: 使用Live Server (VS Code扩展)
# 右键index.html -> Open with Live Server
```

然后在浏览器中访问 `http://localhost:8000`

## 📁 项目结构

```
cycling-heatmap-web/
├── index.html              # 主页面
├── donate.JPEG             # 微信赞赏码
├── css/
│   └── style.css          # 样式文件
├── js/
│   ├── main.js            # 主应用逻辑
│   ├── gpx-parser.js      # 轨迹记录GPX解析器
│   ├── heatmap-renderer.js # 热力图渲染器
│   └── map-config.js      # 地图配置
├── scripts/
│   ├── check-syntax.js    # 语法检查脚本
│   ├── check-files.js     # 文件完整性检查
│   ├── check-quality.js   # 代码质量检查
│   ├── test-all.js        # 综合测试脚本
│   └── README.md          # 脚本使用说明
├── doc/
│   ├── TESTING_GUIDE.md   # 测试指南
│   ├── DEVELOPER_GUIDE.md # 开发指南
│   └── BUG_ANALYSIS_AND_PREVENTION.md # 错误分析
├── assets/
│   └── demo/              # 示例轨迹记录GPX
│       ├── README.md      # 示例文件说明
│       ├── sample_beijing_ride.gpx
│       └── sample_shanghai_ride.gpx
└── README.md              # 项目说明
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

### 键盘快捷键
- `Ctrl/Cmd + O` - 打开文件选择对话框
- `Ctrl/Cmd + G` - 生成热力图（按钮可用时）
- `Esc` - 关闭所有打开的模态框

### 设置自动保存
应用会自动保存您的设置（地图样式、语言、参数等），下次打开时会自动恢复，无需重复配置。

## 📊 支持的文件格式

- **轨迹记录GPX** (.gpx) - GPS Exchange Format
- **批量上传** - 支持同时上传多个文件
- **自动解析** - 提取轨迹点、时间戳、海拔等信息
- **文件大小限制** - 单个文件最大50MB，总大小最大200MB
- **文件验证** - 自动验证文件格式和大小，超大文件会提示跳过

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
- **DOMParser** - XML解析
- **File API** - 文件处理

### 性能优化
- **分块处理** - 大文件分批解析
- **防抖优化** - 参数调节使用防抖，避免频繁更新
- **动态参数** - 根据缩放级别自动调整
- **内存管理** - 及时清理不需要的数据，防止内存泄漏
- **文件大小验证** - 防止超大文件导致内存溢出
- **进度显示** - 实时显示处理进度和剩余时间估算

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
# 手动运行所有测试
node scripts/test-all.js

# 单独运行各项测试
node scripts/check-syntax.js      # 语法检查
node scripts/check-files.js       # 文件完整性
node scripts/check-quality.js     # 代码质量
```

**Git Pre-commit Hook：** 每次 `git commit` 会自动运行测试，失败时阻止提交。

**测试内容：**
- ✅ JavaScript语法检查
- ✅ 括号配对验证
- ✅ 文件完整性检查
- ✅ HTML结构验证
- ✅ 代码质量检查

详细说明请参考：`doc/TESTING_GUIDE.md`

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
