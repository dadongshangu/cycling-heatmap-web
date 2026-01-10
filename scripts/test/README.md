# 测试系统说明

## 📋 概述

本项目包含一套完整的自动测试系统，用于确保代码质量和功能稳定性。

## 🚀 快速开始

### 运行所有测试

```bash
node scripts/test/test-all.js
```

### 运行特定测试套件

```bash
# 单元测试
node scripts/test/unit/test-geo-utils.js
node scripts/test/unit/test-gpx-parser.js

# 回归测试
node scripts/test/regression/test-export-regression.js
node scripts/test/regression/test-fit-regression.js
```

## 📁 测试结构

```
scripts/test/
  unit/              # 单元测试
    test-geo-utils.js      # GeoUtils工具函数测试
    test-gpx-parser.js     # GPX解析器测试（需要@xmldom/xmldom）
  regression/        # 回归测试
    test-export-regression.js  # 导出功能回归测试
    test-fit-regression.js     # FIT解析回归测试
  fixtures/          # 测试数据
    sample.gpx       # 示例GPX文件
  utils/             # 测试工具
    test-runner.js   # 测试运行器
  test-all.js        # 运行所有测试
```

## 🧪 测试类型

### 1. 单元测试

测试独立的函数和类：
- **GeoUtils测试** - 地理计算工具函数（haversineDistance、toRadians）
- **GPX解析器测试** - GPX文件解析功能（需要@xmldom/xmldom依赖）

### 2. 回归测试

确保之前修复的问题不会再次出现：
- **导出功能回归测试** - 验证导出功能配置正确
- **FIT解析回归测试** - 验证FIT坐标转换逻辑正确

## 🔧 依赖

### 必需依赖

无（使用Node.js原生模块）

### 可选依赖

- `@xmldom/xmldom` - 用于GPX解析器测试（Node.js环境需要）
  ```bash
  npm install @xmldom/xmldom --save-dev
  ```

## 📝 编写新测试

### 示例

```javascript
const TestRunner = require('../utils/test-runner');
const runner = new TestRunner();

runner.test('测试名称', () => {
    const result = myFunction();
    runner.assertEqual(result, expected, '结果应该等于期望值');
});

if (require.main === module) {
    runner.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}
```

### 可用的断言方法

- `assert(condition, message)` - 基本断言
- `assertEqual(actual, expected, message)` - 相等断言
- `assertAlmostEqual(actual, expected, tolerance, message)` - 近似相等（浮点数）
- `assertInRange(value, min, max, message)` - 范围断言
- `assertNotEmpty(value, message)` - 非空断言

## 🔗 Git Hooks

### Pre-commit Hook（快速测试）

每次提交前自动运行快速测试：
- 语法检查
- 文件完整性检查
- 单元测试
- 回归测试

**设置（Windows）：**
```bash
copy scripts\pre-commit-fast-test.bat .git\hooks\pre-commit
```

**设置（Linux/Mac）：**
```bash
cp scripts/pre-commit-fast-test.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Pre-push Hook（完整测试）

推送前运行完整测试套件。

**设置（Windows）：**
```bash
copy scripts\pre-push-full-test.bat .git\hooks\pre-push
```

## 📊 测试报告

测试运行后会显示：
- ✅ 通过的测试
- ❌ 失败的测试（显示详细错误信息）
- ⚠️ 跳过的测试（缺少依赖）

## 🐛 故障排除

### GPX解析器测试失败

如果看到 `Cannot find module '@xmldom/xmldom'` 错误：

```bash
npm install @xmldom/xmldom --save-dev
```

或者跳过该测试（不影响其他测试）。

### Git Hook 不工作

1. 检查 `.git/hooks/pre-commit` 文件是否存在
2. 确保文件有执行权限（Linux/Mac）
3. 手动运行测试：`node scripts/test/test-all.js`

## 📚 更多信息

查看 `doc/TESTING_GUIDE.md` 了解完整的测试指南。
