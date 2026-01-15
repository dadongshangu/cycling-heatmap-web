#!/usr/bin/env node
/**
 * 版本号自动递增脚本
 * 在 git push 后自动增加版本号（从 1.00 开始，每次增加 0.01）
 */

const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '../VERSION');

try {
    // 读取当前版本号
    let currentVersion = '1.00';
    if (fs.existsSync(versionFile)) {
        currentVersion = fs.readFileSync(versionFile, 'utf8').trim();
    }
    
    // 解析版本号
    const versionParts = currentVersion.split('.');
    let major = parseInt(versionParts[0]) || 1;
    let minor = parseInt(versionParts[1]) || 0;
    
    // 增加版本号（小版本号 +1）
    minor += 1;
    
    // 如果小版本号超过 99，则增加主版本号
    if (minor > 99) {
        major += 1;
        minor = 0;
    }
    
    // 格式化新版本号（保持两位小数）
    const newVersion = `${major}.${minor.toString().padStart(2, '0')}`;
    
    // 写入新版本号
    fs.writeFileSync(versionFile, newVersion + '\n', 'utf8');
    
    console.log(`✅ 版本号已更新: ${currentVersion} -> ${newVersion}`);
    
    // 同时更新 package.json 中的版本号（如果存在）
    const packageJsonPath = path.join(__dirname, '../package.json');
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        packageJson.version = newVersion;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
        console.log(`✅ package.json 版本号已更新: ${newVersion}`);
    }
    
    process.exit(0);
} catch (error) {
    console.error('❌ 版本号更新失败:', error);
    process.exit(1);
}
