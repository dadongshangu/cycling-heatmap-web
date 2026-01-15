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
    
    // 测试通过后，检查并更新版本号
    try {
        // 首先检查工作区是否有未提交的更改（非VERSION文件）
        // 如果有，不影响版本号更新，但会在push时一起推送
        let hasUncommittedChanges = false;
        try {
            const allStatus = execSync(`git status --porcelain`, { 
                encoding: 'utf8',
                cwd: projectRoot,
                stdio: 'pipe'
            }).trim();
            // 过滤掉VERSION和package.json的更改
            const otherChanges = allStatus.split('\n').filter(line => {
                const file = line.trim().split(/\s+/).pop();
                return file && !file.includes('VERSION') && !file.includes('package.json');
            });
            hasUncommittedChanges = otherChanges.length > 0;
        } catch (e) {
            // 忽略错误
        }
        
        // 检查是否有未推送的commit
        let localCommits = '';
        try {
            localCommits = execSync(`git log origin/main..HEAD --oneline`, { 
                encoding: 'utf8',
                cwd: projectRoot,
                stdio: 'pipe'
            }).trim();
        } catch (e) {
            // 如果origin/main不存在（首次push），检查是否有任何commit
            try {
                localCommits = execSync(`git log --oneline -1`, { 
                    encoding: 'utf8',
                    cwd: projectRoot,
                    stdio: 'pipe'
                }).trim();
            } catch (e2) {
                // 忽略错误
            }
        }
        
        // 检查所有未推送的commit中是否包含VERSION更新
        let versionInUnpushedCommits = false;
        if (localCommits) {
            try {
                // 检查所有未推送的commit中是否包含VERSION文件
                const unpushedFiles = execSync(`git log origin/main..HEAD --name-only --pretty=format:`, { 
                    encoding: 'utf8',
                    cwd: projectRoot,
                    stdio: 'pipe'
                });
                versionInUnpushedCommits = unpushedFiles.includes('VERSION');
            } catch (e) {
                // 如果origin/main不存在，检查最近的commit
                try {
                    const recentFiles = execSync(`git log -1 --name-only --pretty=format:`, { 
                        encoding: 'utf8',
                        cwd: projectRoot,
                        stdio: 'pipe'
                    });
                    versionInUnpushedCommits = recentFiles.includes('VERSION');
                } catch (e2) {
                    // 忽略错误
                }
            }
        }
        
        // 检查工作区是否有未提交的VERSION更改（包括暂存区）
        let versionInWorkingTree = false;
        try {
            const status = execSync(`git status --porcelain VERSION package.json`, { 
                encoding: 'utf8',
                cwd: projectRoot,
                stdio: 'pipe'
            }).trim();
            versionInWorkingTree = status.length > 0;
        } catch (e) {
            // 忽略错误
        }
        
        // 判断是否需要更新版本号：
        // 1. 如果有未推送的commit，且这些commit中已经包含VERSION更新，则跳过
        // 2. 如果工作区有未提交的VERSION更改，则跳过（避免覆盖用户的更改）
        // 3. 否则，更新版本号
        const shouldUpdateVersion = !versionInUnpushedCommits && !versionInWorkingTree;
        
        if (shouldUpdateVersion) {
            // 更新版本号
            execSync(`node "${path.join(projectRoot, 'scripts/bump-version.js')}"`, {
                stdio: 'inherit',
                cwd: projectRoot
            });
            versionUpdated = true;
            
            // 添加到暂存区
            execSync(`git add VERSION package.json`, {
                stdio: 'inherit',
                cwd: projectRoot
            });
            
            // 自动创建commit
            execSync(`git commit -m "chore: Bump version"`, {
                stdio: 'inherit',
                cwd: projectRoot
            });
            
            console.log('\n✅ 版本号已更新并自动提交');
            if (hasUncommittedChanges) {
                console.log('💡 提示: 工作区有其他未提交的更改，这些更改将在push时一起推送');
            }
        } else {
            if (versionInWorkingTree) {
                console.log('\n⚠️  工作区有未提交的VERSION更改，跳过自动版本号更新');
                console.log('💡 提示: 如果这是您手动更新的版本号，请确保已提交');
            } else if (versionInUnpushedCommits) {
                console.log('\nℹ️  版本号已在未推送的commit中更新，跳过');
            }
        }
    } catch (versionError) {
        console.warn('\n⚠️  版本号更新失败，但不影响推送:', versionError.message);
    }
    
    process.exit(0);
} catch (error) {
    console.log('\n❌ 完整测试失败，请修复后再推送');
    process.exit(1);
}
