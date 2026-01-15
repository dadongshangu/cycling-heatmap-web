# 新Agent对话启动提示词

> 复制以下内容到新的Cursor对话中，快速恢复项目上下文

---

## 🚀 项目上下文恢复

你好！这是一个**运动轨迹热力图生成器**项目（Cycling Heatmap Web），我需要继续开发工作。

### 📋 项目基本信息

**项目类型**: 纯前端Web应用（HTML + CSS + JavaScript）  
**主要功能**: 将GPX/FIT轨迹文件转换为Strava风格的交互式热力图  
**仓库地址**: https://github.com/dadongshangu/cycling-heatmap-web  
**部署方式**: GitHub Pages

### 🎯 核心功能

1. **热力图生成** - 核心功能，将轨迹点渲染为热力图
2. **热力图导出** - 导出为PNG图片（PC端和移动端优化）
3. **视频生成** - 生成展示轨迹随时间逐渐点亮过程的视频（新增功能）

### 📁 关键文件位置

- **主应用**: `js/main.js` - CyclingHeatmapApp类
- **热力图渲染**: `js/heatmap-renderer.js` - HeatmapRenderer类
- **视频生成**: `js/video-generator.js` - VideoGenerator类（新增）
- **主页面**: `index.html`
- **样式文件**: `css/style.css`

### ⚠️ 重要设计原则（必须遵守）

1. **不破坏原有功能** - 所有新功能必须完全独立实现
2. **状态恢复** - 任何修改状态的操作必须在`finally`块中恢复
3. **功能隔离** - 不能修改`renderHeatmap()`方法，新功能使用新方法
4. **测试覆盖** - 新功能必须添加回归测试

### 🔑 关键方法（不能修改）

- `HeatmapRenderer.renderHeatmap(points)` - 原有方法，不能修改
- `CyclingHeatmapApp.exportMap()` - 主要导出功能，不能破坏

### 📚 重要文档

请先阅读以下文档了解项目：
- `CONTEXT.md` - 项目完整上下文（**必读**）
- `.cursorrules` - Cursor规则和开发规范（**必读**）
- `README.md` - 项目说明和使用指南
- `doc/DEVELOPER_GUIDE.md` - 完整开发指南
- `CODE_REVIEW_VIDEO_FEATURE.md` - 视频功能代码审查报告

### 🧪 测试系统

```bash
npm test                    # 运行所有测试
npm run test:regression     # 运行回归测试
npm run check:syntax        # 语法检查
npm run check:files         # 文件完整性检查
```

### 🎨 UI设计原则

- **导出热力图按钮**: 主要功能，使用`.map-control-btn-primary`样式（橙色渐变，突出）
- **视频按钮**: 次要功能，使用`.map-control-btn-secondary`样式（白色背景，不突出）
- 按钮文字: "导出热力图" 和 "视频"

### 📝 当前项目状态

- ✅ 所有核心功能正常
- ✅ 所有回归测试通过（26个用例）
- ✅ 文档完整且最新
- ✅ 代码审查完成

### 🚀 快速开始

1. 先阅读 `CONTEXT.md` 了解完整上下文
2. 查看 `.cursorrules` 了解开发规范
3. 运行 `npm test` 确保所有测试通过
4. 根据任务需求开始工作

### 💡 工作提示

- 修改代码前先运行测试确保环境正常
- 新功能必须添加回归测试
- 提交前运行 `npm test` 确保所有测试通过
- 遵循"不破坏原有功能"原则

---

**请先阅读 `CONTEXT.md` 和 `.cursorrules` 文件，然后告诉我你准备好了，我们可以开始工作！**
