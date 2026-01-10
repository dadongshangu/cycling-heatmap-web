# 开发工具脚本

## check-syntax.js

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

*更多信息请参考：`doc/BUG_ANALYSIS_AND_PREVENTION.md`*
