# 项目上下文文档

> 本文档用于在新对话中快速恢复项目上下文，帮助 AI 助手快速理解项目状态。

## 📋 项目概述

**项目名称**: 运动轨迹热力图生成器 (Cycling Heatmap Web)  
**项目类型**: 纯前端 Web 应用  
**主要功能**: 将 GPX/FIT 轨迹文件转换为 Strava 风格的交互式热力图  
**部署方式**: GitHub Pages  
**仓库地址**: https://github.com/dadongshangu/cycling-heatmap-web

## 🎯 核心特性

### 主要功能
1. **热力图生成** - 核心功能，将轨迹点渲染为热力图
2. **热力图导出** - 导出为 PNG 图片（PC端和移动端优化）
3. **视频生成** - 生成展示轨迹随时间逐渐点亮过程的视频（新增功能）

### 技术栈
- **前端框架**: 纯 HTML5 + CSS3 + JavaScript (ES6+)
- **地图引擎**: Leaflet.js
- **热力图**: Leaflet.heat 插件
- **视频生成**: FFmpeg.wasm
- **图片导出**: html2canvas
- **文件解析**: 自定义 GPX 和 FIT 解析器

## 🏗️ 项目架构

### 核心文件结构
```
js/
├── main.js              # 主应用逻辑（CyclingHeatmapApp类）
├── heatmap-renderer.js  # 热力图渲染器（HeatmapRenderer类）
├── gpx-parser.js        # GPX文件解析器
├── fit-parser.js        # FIT文件解析器
├── video-generator.js   # 视频生成器（VideoGenerator类，新增）
├── map-config.js        # 地图配置
└── utils.js             # 工具函数
```

### 关键类和方法

#### CyclingHeatmapApp (main.js)
- `generateHeatmap()` - 生成热力图
- `exportMap()` - 导出热力图为PNG（主要功能）
- `generateVideo()` - 生成视频（新增功能）
- `showVideoConfigModal()` - 显示视频配置模态框

#### HeatmapRenderer (heatmap-renderer.js)
- `renderHeatmap(points)` - 渲染热力图（原有方法，保持不变）
- `renderHeatmapWithTimeFilter(points)` - 渲染热力图（用于视频生成，新增）
- `exportAndDownload()` - 导出并下载图片
- `exportMapAsImage()` - 导出为图片数据

#### VideoGenerator (video-generator.js)
- `generateVideo(tracks, startDate, endDate, progressCallback)` - 生成视频
- `loadFFmpeg()` - 加载FFmpeg.wasm库
- `checkSupport()` - 检查是否支持视频生成（检测file://协议）
- `generateFrame(points)` - 生成单帧图片

## ⚠️ 重要设计决策

### 1. 视频生成功能不影响原有导出功能
- **原则**: 完全独立实现，不修改原有代码
- **实现**: 
  - VideoGenerator 类完全独立
  - 使用 `renderHeatmapWithTimeFilter()` 而不是 `renderHeatmap()`
  - 视频生成完成后自动恢复原始热力图状态
  - 视频生成过程中禁用导出按钮

### 2. 状态恢复机制
- **问题**: 视频生成会修改热力图状态
- **解决**: 
  - 在 `generateVideo()` 开始时保存 `originalPoints` 和 `originalBounds`
  - 在 `finally` 块中调用 `renderHeatmap(originalPoints)` 恢复状态
  - 确保即使出错也能恢复

### 3. file://协议检测
- **问题**: 视频生成功能在 file:// 协议下无法工作（CORS限制）
- **解决**: 
  - `VideoGenerator.checkSupport()` 检测协议
  - 提前报错，提供友好的错误提示
  - 引导用户使用 HTTP 服务器

### 4. UI设计原则
- **导出热力图**: 主要功能，使用主要按钮样式（橙色渐变，突出显示）
- **视频生成**: 次要功能，使用次要按钮样式（白色背景，相对不突出）
- **按钮文字**: "导出热力图" 和 "视频"

## 🔧 关键实现细节

### 视频生成流程
1. 用户点击"视频"按钮
2. 显示配置模态框（默认最近一年）
3. 检查支持情况（file://协议检测）
4. 保存原始热力图状态
5. 禁用导出按钮
6. 加载 FFmpeg.wasm
7. 按时间窗口生成帧序列
8. 使用 `renderHeatmapWithTimeFilter()` 渲染每帧
9. 使用 html2canvas 截图
10. FFmpeg 合成视频
11. 恢复原始热力图状态
12. 恢复导出按钮
13. 下载视频文件

### 状态管理
```javascript
// 视频生成前保存状态
const originalPoints = [...this.heatmapRenderer.currentPoints];
const originalBounds = this.heatmapRenderer.map.getBounds();

// 视频生成完成后恢复
try {
    // ... 视频生成逻辑 ...
} finally {
    this.heatmapRenderer.renderHeatmap(originalPoints);
    this.heatmapRenderer.map.fitBounds(originalBounds);
    exportBtn.disabled = false;
}
```

### 按钮样式
- **导出热力图按钮**: `.map-control-btn-primary` - 橙色渐变，更大更突出
- **视频按钮**: `.map-control-btn-secondary` - 白色背景，相对不突出

## 🧪 测试系统

### 测试结构
```
scripts/test/
├── unit/                    # 单元测试
│   ├── test-geo-utils.js
│   └── test-gpx-parser.js
├── regression/              # 回归测试
│   ├── test-export-regression.js
│   ├── test-fit-regression.js
│   ├── test-video-regression.js
│   └── test-all-regression.js  # 统一回归测试入口
├── utils/
│   └── test-runner.js
└── test-all.js              # 运行所有测试
```

### 测试命令
```bash
npm test                    # 运行所有测试
npm run test:regression     # 运行回归测试
npm run test:video          # 测试视频功能
npm run test:compatibility  # 测试兼容性
```

### 关键测试用例
- 导出功能回归测试（6个用例）
- FIT解析回归测试（6个用例）
- 视频生成回归测试（14个用例）
- 兼容性测试（验证导出功能不受视频生成影响）

## 📝 最近的重要变更

### 1. 视频生成功能（已完成）
- ✅ 实现 VideoGenerator 类
- ✅ 添加 `renderHeatmapWithTimeFilter()` 方法
- ✅ 集成到 main.js
- ✅ 添加 UI 元素和事件处理
- ✅ 修复状态恢复问题
- ✅ 修复 file:// 协议检测
- ✅ 添加完整的测试覆盖

### 2. UI优化（已完成）
- ✅ 将"导出"改为"导出热力图"
- ✅ 将"生成视频"改为"视频"
- ✅ 导出按钮使用主要样式（橙色渐变，突出）
- ✅ 视频按钮使用次要样式（白色背景，不突出）

### 3. 文档整理（已完成）
- ✅ 删除6个重复/过时文档
- ✅ 更新README.md、DEVELOPER_GUIDE.md、TESTING_GUIDE.md
- ✅ 创建DOCUMENTATION_SUMMARY.md

## 🐛 已知问题和限制

### 1. GPX解析器测试需要依赖
- **问题**: `test-gpx-parser.js` 需要 `@xmldom/xmldom` 依赖
- **状态**: 测试被标记为可选，不影响主要功能
- **影响**: 回归测试中会被跳过

### 2. 视频生成需要HTTP服务器
- **限制**: 不能在 file:// 协议下运行
- **原因**: Web Worker 和 FFmpeg.wasm 的 CORS 限制
- **解决**: 提供启动脚本和详细说明

### 3. 大文件处理
- **限制**: 单个文件最大50MB，总大小最大200MB
- **原因**: 浏览器内存限制
- **优化**: 使用空间索引优化大数据集渲染

## 🎯 当前项目状态

### 功能完整性
- ✅ 热力图生成 - 完全正常
- ✅ 热力图导出 - 完全正常（PC端和移动端）
- ✅ 视频生成 - 完全正常（需要HTTP服务器）
- ✅ 状态恢复 - 已实现并测试
- ✅ 错误处理 - 完善

### 代码质量
- ✅ 所有语法检查通过
- ✅ 所有回归测试通过（26个用例）
- ✅ 兼容性测试通过
- ✅ 代码审查完成

### 文档完整性
- ✅ README.md - 已更新
- ✅ DEVELOPER_GUIDE.md - 已更新
- ✅ TESTING_GUIDE.md - 已更新
- ✅ CODE_REVIEW_VIDEO_FEATURE.md - 代码审查报告

## 🚀 快速开始（给新对话的提示）

### 如果要继续开发
1. 阅读 `doc/DEVELOPER_GUIDE.md` 了解架构
2. 阅读 `CODE_REVIEW_VIDEO_FEATURE.md` 了解代码审查标准
3. 运行 `npm test` 确保所有测试通过

### 如果要修复问题
1. 检查 `doc/BUG_ANALYSIS_AND_PREVENTION.md`
2. 运行相关回归测试
3. 确保不破坏原有功能

### 如果要添加功能
1. 遵循功能隔离原则（参考视频生成功能的实现）
2. 添加相应的测试用例
3. 更新文档

## 📚 重要文档位置

- **主文档**: `README.md`
- **开发指南**: `doc/DEVELOPER_GUIDE.md`
- **测试指南**: `doc/TESTING_GUIDE.md`
- **代码审查**: `CODE_REVIEW_VIDEO_FEATURE.md`
- **文档总结**: `DOCUMENTATION_SUMMARY.md`
- **回归测试总结**: `scripts/test/REGRESSION_TEST_SUMMARY.md`

## 🔑 关键原则

1. **不破坏原有功能** - 所有新功能必须完全独立
2. **状态恢复** - 任何修改状态的操作都要在 finally 中恢复
3. **错误处理** - 完善的 try-catch-finally 结构
4. **测试覆盖** - 新功能必须添加回归测试
5. **文档更新** - 功能变更时同步更新文档

## 💡 开发提示

### 代码风格
- 使用 ES6+ 语法
- 添加适当的注释
- 保持代码整洁
- 遵循现有代码结构

### 测试要求
- 提交前运行 `npm test`
- 新功能添加回归测试
- 确保不破坏原有测试

### Git工作流
- 使用有意义的提交信息
- 提交前运行测试
- 推送前运行完整测试套件

---

**最后更新**: 2024年（当前日期）  
**维护者**: dadongshangu  
**项目状态**: 稳定，功能完整
