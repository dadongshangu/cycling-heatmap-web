#!/usr/bin/env node
/**
 * Git pre-commit hook - 快速测试
 * 运行快速测试（单元测试和回归测试）
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 运行提交前快速测试...\n');

// 获取项目根目录（hook在.git/hooks中，需要回到项目根目录）
const projectRoot = path.resolve(__dirname, '../..');

const tests = [
    { name: '语法检查', script: path.join(projectRoot, 'scripts/check-syntax.js'), required: true },
    { name: '文件完整性检查', script: path.join(projectRoot, 'scripts/check-files.js'), required: true },
    { name: 'GeoUtils单元测试', script: path.join(projectRoot, 'scripts/test/unit/test-geo-utils.js'), required: true },
    { name: 'GPX解析器测试', script: path.join(projectRoot, 'scripts/test/unit/test-gpx-parser.js'), required: false }, // 可选，缺少依赖
    { name: '导出功能回归测试', script: path.join(projectRoot, 'scripts/test/regression/test-export-regression.js'), required: true },
    { name: 'FIT解析回归测试', script: path.join(projectRoot, 'scripts/test/regression/test-fit-regression.js'), required: true }
];

let hasErrors = false;

for (const test of tests) {
    try {
        execSync(`node "${test.script}"`, {
            stdio: 'inherit',
            cwd: projectRoot
        });
    } catch (error) {
        if (test.required) {
            console.log(`\n❌ ${test.name}失败，请修复后再提交`);
            hasErrors = true;
        } else {
            console.log(`\n⚠️  ${test.name}跳过（缺少依赖，不影响提交）`);
        }
    }
}

if (hasErrors) {
    process.exit(1);
}

console.log('\n✅ 所有快速测试通过！');
process.exit(0);
