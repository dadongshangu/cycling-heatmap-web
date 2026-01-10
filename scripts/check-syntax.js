#!/usr/bin/env node
/**
 * JavaScript 语法检查脚本
 * 用于在提交前检查所有 JS 文件的语法错误
 * 
 * 使用方法：
 *   node scripts/check-syntax.js
 *   或
 *   npm run check-syntax
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 要检查的文件列表
const filesToCheck = [
    'js/main.js',
    'js/heatmap-renderer.js',
    'js/gpx-parser.js',
    'js/map-config.js'
];

let hasError = false;
const errors = [];

console.log('🔍 开始语法检查...\n');

filesToCheck.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  文件不存在: ${file}`);
        return;
    }
    
    try {
        // 使用 Node.js 的语法检查
        execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
        console.log(`✅ ${file} - 语法正确`);
    } catch (error) {
        hasError = true;
        const errorMsg = (error.stdout && error.stdout.toString()) || 
                        (error.stderr && error.stderr.toString()) || 
                        error.message;
        errors.push({ file, error: errorMsg });
        console.log(`❌ ${file} - 语法错误`);
        console.log(`   错误信息: ${errorMsg.trim()}`);
    }
});

console.log('\n' + '='.repeat(50));

if (hasError) {
    console.log('\n❌ 发现语法错误！请修复后再提交。\n');
    console.log('详细错误信息：');
    errors.forEach(({ file, error }) => {
        console.log(`\n文件: ${file}`);
        console.log(`错误: ${error}`);
    });
    process.exit(1);
} else {
    console.log('\n✅ 所有文件语法检查通过！\n');
    process.exit(0);
}
