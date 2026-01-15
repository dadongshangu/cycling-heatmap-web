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
    // 先更新版本号（在测试之前，这样如果测试失败，版本号不会更新）
    // 但为了确保版本号更新，我们在测试通过后更新
    let versionUpdated = false;
    
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
        versionUpdated = true;
        
        // 版本号更新后，自动添加到暂存区并amend到当前commit
        try {
            execSync(`git add VERSION package.json`, {
                stdio: 'inherit',
                cwd: projectRoot
            });
            // 自动amend到当前commit（如果当前有未推送的commit）
            try {
                execSync(`git commit --amend --no-edit`, {
                    stdio: 'inherit',
                    cwd: projectRoot
                });
                console.log('\n✅ 版本号已更新并自动添加到当前commit');
            } catch (amendError) {
                // 如果没有可amend的commit，则创建新commit
                try {
                    execSync(`git commit -m "chore: Bump version"`, {
                        stdio: 'inherit',
                        cwd: projectRoot
                    });
                    console.log('\n✅ 版本号已更新并创建新commit');
                } catch (commitError) {
                    console.log('\n📝 版本号已更新并添加到暂存区，请手动提交');
                }
            }
        } catch (gitError) {
            console.warn('\n⚠️  版本号文件添加到暂存区失败:', gitError.message);
        }
    } catch (versionError) {
        console.warn('\n⚠️  版本号更新失败，但不影响推送:', versionError.message);
    }
    
    process.exit(0);
} catch (error) {
    console.log('\n❌ 完整测试失败，请修复后再推送');
    process.exit(1);
}
