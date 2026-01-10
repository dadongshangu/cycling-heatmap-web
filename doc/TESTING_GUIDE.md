# 自动测试指南

## 📋 概述

本项目包含一套完整的自动测试系统，用于在代码提交前自动检查代码质量、语法错误和文件完整性。

## 🚀 快速开始

### 运行所有测试

```bash
node scripts/test-all.js
```

### 单独运行各项测试

```bash
# 语法检查
node scripts/check-syntax.js

# 文件完整性检查
node scripts/check-files.js

# 代码质量检查
node scripts/check-quality.js
```

## 📝 测试内容

### 1. 语法检查 (`check-syntax.js`)

**检查内容：**
- JavaScript文件语法验证（使用 `node -c`）
- 括号配对检查（大括号、圆括号、方括号）
- 处理可选链操作符（浏览器支持，旧版Node.js不支持）

**检查的文件：**
- `js/main.js`
- `js/heatmap-renderer.js`
- `js/gpx-parser.js`
- `js/map-config.js`

**输出：**
- ✅ 语法正确，括号配对正确
- ❌ 语法错误或括号配对错误（会显示详细错误信息）

### 2. 文件完整性检查 (`check-files.js`)

**检查内容：**
- 必需文件是否存在
- HTML结构完整性（必需的元素ID）
- 脚本引用是否正确
- HTML基本结构（DOCTYPE、html、head、body标签）
- CSS文件是否为空

**检查的文件：**
- `index.html`
- `css/style.css`
- 所有 JavaScript 文件

**检查的元素ID：**
- `map` - 地图容器
- `fileInput` - 文件输入
- `selectFileBtn` - 选择文件按钮
- `generateBtn` - 生成按钮
- `exportBtn` - 导出按钮
- `uploadArea` - 上传区域
- `clearFiles` - 清除文件按钮
- `mapStyle` - 地图样式选择
- `mapLanguage` - 地图语言选择
- `dateRange` - 日期范围选择
- `radius` - 线条粗细
- `blur` - 模糊程度
- `opacity` - 透明度

**输出：**
- ✅ 所有检查通过
- ❌ 发现缺失的文件或元素

### 3. 代码质量检查 (`check-quality.js`)

**检查内容：**
- 文件大小检查（警告过大文件）
- TODO/FIXME 注释检查
- 调试代码检查

**输出：**
- ✅ 代码质量检查通过
- ⚠️ 有警告但可以继续（不影响提交）

## 🔧 Git Pre-commit Hook

### 自动运行测试

项目已配置 Git pre-commit hook，每次提交前会自动运行所有测试。

**工作原理：**
1. 执行 `git commit` 时自动触发
2. 运行 `scripts/test-all.js`
3. 如果测试失败，阻止提交
4. 如果测试通过，允许提交

### 手动运行（测试Hook）

```bash
# 在项目根目录
node scripts/test-all.js
```

### 跳过Hook（不推荐）

如果确实需要跳过测试（不推荐），可以使用：

```bash
git commit --no-verify -m "Your message"
```

**⚠️ 警告：** 只有在紧急情况下才应该跳过测试。

## 📊 测试报告

运行 `test-all.js` 会生成详细的测试报告：

```
🚀 开始运行所有测试...

============================================================
📋 测试 1/3: 语法检查
...
============================================================
📋 测试 2/3: 文件完整性检查
...
============================================================
📋 测试 3/3: 代码质量检查
...
============================================================
📊 测试结果汇总
============================================================
✅ 通过 语法检查
✅ 通过 文件完整性
✅ 通过 代码质量
============================================================
✅ 所有测试通过！可以安全提交代码。
```

## 🛠️ 故障排除

### 问题1: 语法检查失败（可选链操作符）

**错误信息：**
```
SyntaxError: Unexpected token '.'
```

**原因：** Node.js 版本 < 14 不支持可选链操作符 `?.`

**解决方案：**
- 代码在浏览器中运行，浏览器支持可选链
- 测试脚本已自动处理这种情况
- 如果仍然失败，检查是否有其他语法错误

### 问题2: 文件完整性检查失败

**可能原因：**
- 文件被删除或移动
- HTML结构被修改
- 元素ID被更改

**解决方案：**
- 检查错误信息中提到的文件或元素
- 确保所有必需文件存在
- 确保HTML中包含所有必需的元素ID

### 问题3: Git Hook 不工作

**Windows用户：**
- Git Bash: Hook应该自动工作
- PowerShell/CMD: 可能需要配置Git使用bash执行hooks
- 检查 `.git/hooks/pre-commit` 文件是否存在
- 如果hook不工作，可以手动运行 `node scripts/test-all.js` 后再提交

**Linux/Mac用户：**
```bash
chmod +x .git/hooks/pre-commit
```

**验证Hook是否工作：**
```bash
# 尝试提交一个测试更改
git commit --allow-empty -m "Test commit"
# 如果看到测试输出，说明hook正常工作
```

## 📚 最佳实践

### 提交前检查清单

- [ ] 运行 `node scripts/test-all.js` 确保所有测试通过
- [ ] 在浏览器中实际测试功能
- [ ] 检查浏览器控制台没有错误
- [ ] 验证核心功能正常工作

### 开发工作流

1. **修改代码**
2. **运行测试** - `node scripts/test-all.js`
3. **修复错误** - 根据测试报告修复问题
4. **再次测试** - 确保所有测试通过
5. **提交代码** - `git commit`（自动运行测试）

## 🔄 持续改进

### 未来计划

- [ ] 集成 ESLint 进行更严格的代码质量检查
- [ ] 添加单元测试
- [ ] 添加浏览器自动化测试（Puppeteer/Playwright）
- [ ] 集成到 CI/CD 流程

## 📞 支持

如有问题或建议，请：
- 查看 `doc/BUG_ANALYSIS_AND_PREVENTION.md` 了解常见问题
- 提交 Issue 到 GitHub 仓库

---

*最后更新：2026年1月*
