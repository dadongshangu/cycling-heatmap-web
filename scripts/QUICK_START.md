# 测试脚本快速参考

## 🚀 快速命令

```bash
# 运行所有测试（推荐）
node scripts/test-all.js

# 单独运行各项测试
node scripts/check-syntax.js      # 语法检查
node scripts/check-files.js       # 文件完整性
node scripts/check-quality.js     # 代码质量
```

## ✅ 提交前检查

在每次 `git commit` 前，建议运行：

```bash
node scripts/test-all.js
```

如果所有测试通过，可以安全提交。

## 🔧 Git Hook

Git hook 已配置，提交时会自动运行测试。

**如果测试失败：**
- 查看错误信息
- 修复问题
- 重新运行测试
- 再次提交

**跳过测试（不推荐）：**
```bash
git commit --no-verify -m "Your message"
```

## 📊 测试结果说明

- ✅ **通过** - 检查通过，可以继续
- ❌ **失败** - 发现错误，需要修复
- ⚠️  **警告** - 有警告但可以继续（不影响提交）

---

*详细文档请参考：`doc/TESTING_GUIDE.md`*
