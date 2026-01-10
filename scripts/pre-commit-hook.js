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
    { name: '语法检查', script: path.join(projectRoot, 'scripts/check-syntax.js') },
    { name: '文件完整性检查', script: path.join(projectRoot, 'scripts/check-files.js') },
    { name: 'GeoUtils单元测试', script: path.join(projectRoot, 'scripts/test/unit/test-geo-utils.js') },
    { name: 'GPX解析器测试', script: path.join(projectRoot, 'scripts/test/unit/test-gpx-parser.js') },
    { name: '导出功能回归测试', script: path.join(projectRoot, 'scripts/test/regression/test-export-regression.js') },
    { name: 'FIT解析回归测试', script: path.join(projectRoot, 'scripts/test/regression/test-fit-regression.js') }
];

for (const test of tests) {
    try {
        execSync(`node "${test.script}"`, {
            stdio: 'inherit',
            cwd: projectRoot
        });
    } catch (error) {
        console.log(`\n❌ ${test.name}失败，请修复后再提交`);
        process.exit(1);
    }
}

console.log('\n✅ 所有快速测试通过！');
process.exit(0);
