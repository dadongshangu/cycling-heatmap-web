# 🚴 Cycling Heatmap Generator (Web Version)

一个基于Web的骑行热力图生成器，将GPX轨迹文件转换为Strava风格的交互式热力图。

## ✨ 特性

- 🌐 **纯Web应用** - 无需安装，打开浏览器即可使用
- 🔒 **隐私保护** - 所有文件在浏览器本地处理，不上传到服务器
- 🎨 **Strava风格** - 绿→黄→红渐变，完美复刻Strava热力图样式
- 📱 **响应式设计** - 支持手机、平板、电脑等各种设备
- ⚡ **实时预览** - 拖动参数滑块实时更新热力图
- 🗺️ **多地图样式** - 支持暗色/浅色地图，中英文地图切换
- 📊 **统计信息** - 显示轨迹统计数据和日期范围
- 🎯 **日期过滤** - 可选择显示特定时间范围的轨迹
- 📖 **GPX获取指南** - 详细的设备和应用导出教程
- 💝 **捐赠支持** - 支持项目持续发展

## 🚀 快速开始

### 在线使用
1. 直接打开 `index.html` 文件
2. 拖拽或选择GPX文件上传
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
bike_heat_web_version/
├── index.html              # 主页面
├── donate.JPEG             # 微信赞赏码
├── css/
│   └── style.css          # 样式文件
├── js/
│   ├── main.js            # 主应用逻辑
│   ├── gpx-parser.js      # GPX文件解析器
│   ├── heatmap-renderer.js # 热力图渲染器
│   └── map-config.js      # 地图配置
├── assets/
│   └── demo/              # 示例GPX文件
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
- **English Map** - CartoDB英文地图，国际通用
- **中文地图(矢量)** - 天地图矢量底图，中文标注
- **中文卫星图** - 天地图影像底图，中文标注

### 热力图参数
- **线条粗细** (1-10) - 控制热力图线条的粗细程度
- **模糊程度** (1-20) - 控制热力图的模糊效果
- **透明度** (0.1-1.0) - 控制热力图的透明度
- **时间范围** - 过滤显示特定时间段的轨迹

### 推荐设置
```
线条粗细: 1-2 (最细，最像Strava)
模糊程度: 1-3 (最清晰)
透明度: 0.8 (高对比度)
地图样式: 暗色地图
```

## 📊 支持的文件格式

- **GPX文件** (.gpx) - GPS Exchange Format
- **批量上传** - 支持同时上传多个文件
- **自动解析** - 提取轨迹点、时间戳、海拔等信息

## 📖 GPX文件获取指南

应用内置了详细的GPX文件获取指南，涵盖各种设备和应用：

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
- **国内应用** - 顽鹿竞技、骑记、行者、咕咚等

### 🔍 智能搜索
点击"📖 如何获取GPX文件？"按钮，使用搜索功能快速找到你的设备：
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
- **动态参数** - 根据缩放级别自动调整
- **内存管理** - 及时清理不需要的数据

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

**Q: GPX文件解析失败？**
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

**享受你的骑行热力图之旅！** 🚴‍♂️✨
