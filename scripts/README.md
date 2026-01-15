# 开发工具脚本

本目录包含用于代码质量检查和测试的脚本。

## 📋 脚本列表

### check-syntax.js

JavaScript 语法检查脚本，用于在提交代码前检查所有 JS 文件的语法错误。

### 系统要求

- **Node.js 版本：** 14.0.0 或更高版本
- 检查版本：`node --version`

### 使用方法

#### 方法1：直接运行
```bash
node scripts/check-syntax.js
```

#### 方法2：在 PowerShell 中运行
```powershell
node scripts/check-syntax.js
```

**注意：** 如果您的 Node.js 版本较旧（< 14），脚本可能会报告可选链操作符 `?.` 的语法错误。这是正常的，因为：
- 可选链操作符在现代浏览器中完全支持
- 代码在浏览器中运行，不需要 Node.js 14+
- 如果只是可选链的警告，可以忽略（代码在浏览器中正常工作）

### 检查的文件

- `js/main.js`
- `js/heatmap-renderer.js`
- `js/gpx-parser.js`
- `js/map-config.js`

### 输出说明

- ✅ 表示文件语法正确
- ❌ 表示文件有语法错误，会显示详细错误信息

### 集成到 Git Hooks（可选）

创建 `.git/hooks/pre-commit` 文件：

```bash
#!/bin/sh
node scripts/check-syntax.js
```

然后设置执行权限：
```bash
chmod +x .git/hooks/pre-commit
```

这样每次提交前会自动检查语法。

---

## 建议的工作流程

1. **修改代码后**
   ```bash
   node scripts/check-syntax.js
   ```

2. **确认语法无误后提交**
   ```bash
   git add .
   git commit -m "Your commit message"
   ```

3. **提交前检查清单**
   - [ ] 运行语法检查脚本
   - [ ] 在浏览器中实际测试
   - [ ] 检查控制台没有错误
   - [ ] 核心功能正常工作

---

## check-files.js

文件完整性检查脚本，验证必需文件是否存在，检查HTML结构完整性。

### 使用方法

```bash
node scripts/check-files.js
```

### 检查内容

- 必需文件是否存在
- HTML中必需的元素ID
- 脚本引用是否正确
- HTML基本结构完整性

---

## check-quality.js

代码质量检查脚本，检查常见代码问题。

### 使用方法

```bash
node scripts/check-quality.js
```

### 检查内容

- 文件大小检查
- TODO/FIXME 注释
- 调试代码检查

---

## test-all.js

综合测试脚本，运行所有检查并生成测试报告。

### 使用方法

```bash
node scripts/test-all.js
```

### 功能

- 按顺序运行所有测试
- 汇总测试结果
- 生成详细报告
- 返回适当的退出码（用于Git hooks）

**推荐：** 在每次提交前运行此脚本。

---

## 🔧 Git Pre-commit Hook

项目已配置 Git pre-commit hook，每次提交前自动运行测试。

**位置：** `.git/hooks/pre-commit`

**工作原理：**
- 执行 `git commit` 时自动触发
- 运行 `scripts/test-all.js`
- 测试失败时阻止提交
- 测试通过时允许提交

---

## 🔄 版本号管理

### bump-version.js

版本号自动递增脚本，由Git pre-push hook自动调用。

**工作原理：**
1. 读取 `VERSION` 文件中的当前版本号
2. 将次版本号递增1（如 1.01 -> 1.02）
3. 如果次版本号超过99，则主版本号递增（如 1.99 -> 2.00）
4. 同时更新 `package.json` 中的version字段

**自动调用：**
- 在 `git push` 时，pre-push hook会在测试通过后自动调用
- 版本号更新后会自动创建commit并包含在push中

**手动调用：**
```bash
node scripts/bump-version.js
```

## 📚 相关文档

- `doc/TESTING_GUIDE.md` - 完整的测试指南
- `doc/BUG_ANALYSIS_AND_PREVENTION.md` - 错误分析和预防
