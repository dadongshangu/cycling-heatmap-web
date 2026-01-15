# 自动测试指南

## 📋 概述

本项目包含一套完整的自动测试系统，用于在代码提交前自动检查代码质量、语法错误和文件完整性。

## 🚀 快速开始

### 运行所有测试

```bash
# 运行完整测试套件（包括单元测试和回归测试）
node scripts/test/test-all.js

# 或运行原有的测试（向后兼容）
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

# 单元测试
node scripts/test/unit/test-geo-utils.js
# 注意: GPX解析器测试已移除（需要 @xmldom/xmldom 依赖）

# 回归测试
node scripts/test/regression/test-export-regression.js
node scripts/test/regression/test-fit-regression.js
```

## 🧪 测试套件

### 回归测试
项目包含完整的回归测试套件，确保之前修复的问题不会再次出现：

```bash
# 运行所有回归测试
npm run test:regression

# 运行单个回归测试
npm run test:regression:export  # 导出功能
npm run test:regression:fit     # FIT解析
npm run test:regression:video   # 视频生成
```

回归测试包括：
- **导出功能回归测试**: 6个测试用例，验证导出功能正确性
- **FIT解析回归测试**: 6个测试用例，验证FIT文件解析准确性
- **视频生成回归测试**: 14个测试用例，验证视频生成功能正确性

详细测试报告请参考 `scripts/test/regression/REGRESSION_TEST_SUMMARY.md`。

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

### 4. 单元测试 (`scripts/test/unit/`)

**测试内容：**
- **GeoUtils测试** (`test-geo-utils.js`) - 测试地理计算工具函数
  - `toRadians` 函数测试
  - `haversineDistance` 函数测试
  - 距离计算准确性验证
- **GeoUtils单元测试** (`test-geo-utils.js`) - 测试地理工具函数
  - `toRadians` 函数测试
  - `haversineDistance` 函数测试
  - 距离计算准确性验证

**注意：** GPX解析器测试已移除（需要 `@xmldom/xmldom` 依赖，但项目不需要此依赖）

**运行方式：**
```bash
node scripts/test/unit/test-geo-utils.js
```

### 5. 回归测试 (`scripts/test/regression/`)

**测试内容：**
- **导出功能回归测试** (`test-export-regression.js`) - 确保导出功能不会再次出现问题
  - 检查 `exportMapAsImage` 直接使用 `html2canvas`（不调用 `loadHtml2Canvas`）
  - 验证移动端配置正确（`imageTimeout = 12000`，无 `ignoreElements`）
  - 验证PC端配置简化（只有基本配置）
  - 验证移动端导出流程（Web Share失败后直接显示模态框）
- **FIT解析回归测试** (`test-fit-regression.js`) - 确保FIT坐标转换不会再次出现问题
  - 检查 `semicirclesToDegrees` 函数存在
  - 验证坐标转换公式正确
  - 验证坐标格式检测逻辑存在
  - 验证离群点过滤逻辑存在

**运行方式：**
```bash
node scripts/test/regression/test-export-regression.js
node scripts/test/regression/test-fit-regression.js
```

**重要性：**
这些回归测试确保之前修复的问题不会再次出现，是防止功能退化的关键测试。

## 🔧 Git Hooks

### Pre-commit Hook（快速测试）

项目已配置 Git pre-commit hook，每次提交前会自动运行快速测试。

**工作原理：**
1. 执行 `git commit` 时自动触发
2. 运行快速测试套件（语法检查、文件完整性、单元测试、回归测试）
3. 如果测试失败，阻止提交
4. 如果测试通过，允许提交

**测试内容：**
- 语法检查
- 文件完整性检查
- GeoUtils单元测试
- 导出功能回归测试
- FIT解析回归测试

**设置Hook（Windows）：**
```bash
# 使用设置脚本（推荐）
scripts\setup-git-hooks.bat

# 或手动复制
copy scripts\pre-commit-hook.js .git\hooks\pre-commit
```

**设置Hook（Linux/Mac）：**
```bash
# 使用设置脚本（推荐）
chmod +x scripts/setup-git-hooks.sh
./scripts/setup-git-hooks.sh

# 或手动复制
cp scripts/pre-commit-hook.js .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Pre-push Hook（完整测试）

可选配置 pre-push hook，在推送前运行完整测试套件。

**设置Hook（Windows）：**
```bash
# 使用设置脚本（推荐）
scripts\setup-git-hooks.bat

# 或手动复制
copy scripts\pre-push-hook.js .git\hooks\pre-push
```

**设置Hook（Linux/Mac）：**
```bash
# 使用设置脚本（推荐）
chmod +x scripts/setup-git-hooks.sh
./scripts/setup-git-hooks.sh

# 或手动复制
cp scripts/pre-push-hook.js .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

**注意：** Git hooks现在使用Node.js脚本（.js文件），而不是.bat/.sh文件，这样可以跨平台工作，并且Git可以直接执行。

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

### 已完成

- [x] 添加单元测试（GeoUtils、GPX解析器）
- [x] 添加回归测试（导出功能、FIT解析）
- [x] 创建测试框架和测试运行器
- [x] 集成到Git Hook

### 未来计划

- [ ] 添加浏览器自动化测试（Puppeteer/Playwright）
- [ ] 添加集成测试（端到端流程测试）
- [ ] 集成到 CI/CD 流程（GitHub Actions）
- [ ] 添加测试覆盖率统计

## 📞 支持

如有问题或建议，请：
- 查看 `doc/BUG_ANALYSIS_AND_PREVENTION.md` 了解常见问题
- 提交 Issue 到 GitHub 仓库

---

## 📋 测试框架说明

### 测试运行器 (`scripts/test/utils/test-runner.js`)

自定义的轻量级测试框架，提供：
- `test(name, fn)` - 注册测试用例
- `assert(condition, message)` - 基本断言
- `assertEqual(actual, expected, message)` - 相等断言
- `assertAlmostEqual(actual, expected, tolerance, message)` - 近似相等断言（用于浮点数）
- `assertInRange(value, min, max, message)` - 范围断言
- `assertNotEmpty(value, message)` - 非空断言

### 测试文件结构

```
scripts/test/
  unit/              # 单元测试
    test-geo-utils.js
    # test-gpx-parser.js (已移除，需要 @xmldom/xmldom 依赖)
  regression/        # 回归测试
    test-export-regression.js
    test-fit-regression.js
  fixtures/          # 测试数据
    sample.gpx
  utils/             # 测试工具
    test-runner.js
  test-all.js        # 运行所有测试
```

### 编写新测试

1. 在相应的测试目录创建测试文件
2. 引入测试运行器：`const TestRunner = require('../utils/test-runner')`
3. 创建测试实例：`const runner = new TestRunner()`
4. 编写测试用例：`runner.test('测试名称', () => { ... })`
5. 运行测试：`runner.run()`

**示例：**
```javascript
const TestRunner = require('../utils/test-runner');
const runner = new TestRunner();

runner.test('我的测试', () => {
    const result = myFunction();
    runner.assertEqual(result, expected, '结果应该等于期望值');
});

if (require.main === module) {
    runner.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}
```

---

*最后更新：2026年1月（添加单元测试和回归测试）*
