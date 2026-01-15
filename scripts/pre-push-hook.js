#!/usr/bin/env node
/**
 * Git pre-push hook - 完整测试
 * 运行所有测试（包括集成测试）
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 运行推送前完整测试...\n');

// 获取项目根目录（hook在.git/hooks中，需要回到项目根目录）
const projectRoot = path.resolve(__dirname, '../..');

try {
    // 运行所有测试
    execSync(`node "${path.join(projectRoot, 'scripts/test/test-all.js')}"`, {
        stdio: 'inherit',
        cwd: projectRoot
    });
    console.log('\n✅ 所有测试通过！可以安全推送。');
    
    // 测试通过后，自动增加版本号
    try {
        execSync(`node "${path.join(projectRoot, 'scripts/bump-version.js')}"`, {
            stdio: 'inherit',
            cwd: projectRoot
        });
    } catch (versionError) {
        console.warn('\n⚠️  版本号更新失败，但不影响推送:', versionError.message);
    }
    
    process.exit(0);
} catch (error) {
    console.log('\n❌ 完整测试失败，请修复后再推送');
    process.exit(1);
}
