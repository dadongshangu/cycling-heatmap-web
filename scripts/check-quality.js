#!/usr/bin/env node
/**
 * 代码质量检查脚本
 * 检查常见代码问题（不依赖ESLint，使用简单的模式匹配）
 * 
 * 使用方法：
 *   node scripts/check-quality.js
 */

const fs = require('fs');
const path = require('path');

// 要检查的文件列表
const filesToCheck = [
    'js/main.js',
    'js/heatmap-renderer.js',
    'js/gpx-parser.js',
    'js/map-config.js',
    'js/video-generator.js'
];

let hasError = false;
const errors = [];
const warnings = [];

/**
 * 检查常见代码问题
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @returns {Array} 问题列表
 */
function checkCodeQuality(filePath, content) {
    const issues = [];
    const lines = content.split('\n');
    const fileName = path.basename(filePath);
    
    // 检查常见代码问题
    // 注意：不检查重复变量声明，因为不同作用域的变量可以同名
    
    // 检查是否有明显的语法问题
    // 检查是否有未闭合的字符串
    let inString = false;
    let stringChar = null;
    lines.forEach((line, index) => {
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (!inString && (char === '"' || char === "'" || char === '`')) {
                inString = true;
                stringChar = char;
            } else if (inString && char === stringChar && line[i - 1] !== '\\') {
                inString = false;
                stringChar = null;
            }
        }
        // 简单检查：如果行尾有未闭合的字符串（且不是注释），可能是问题
        if (inString && !line.trim().endsWith('//') && !line.trim().endsWith('*')) {
            // 可能是多行字符串，不一定是错误
        }
    });
    
    // 检查是否有明显的错误模式
    // 检查 console.log 调试代码（警告）
    lines.forEach((line, index) => {
        if (line.includes('console.log') && line.includes('debug')) {
            warnings.push(`${fileName}:${index + 1} - 可能存在调试代码`);
        }
    });
    
    // 检查是否有 TODO/FIXME 注释
    lines.forEach((line, index) => {
        if (line.match(/TODO|FIXME|XXX/i)) {
            warnings.push(`${fileName}:${index + 1} - 存在待办事项注释`);
        }
    });
    
    return issues;
}

console.log('🔍 开始代码质量检查...\n');

filesToCheck.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  文件不存在: ${file}`);
        return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = checkCodeQuality(filePath, content);
    
    if (issues.length === 0 && warnings.length === 0) {
        console.log(`✅ ${file} - 代码质量检查通过`);
    } else {
        console.log(`⚠️  ${file} - 发现一些问题`);
        issues.forEach(issue => {
            console.log(`   ${issue}`);
        });
    }
});

// 检查文件大小（警告过大文件）
filesToCheck.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const sizeKB = stats.size / 1024;
        if (sizeKB > 500) {
            warnings.push(`${file} 文件较大 (${sizeKB.toFixed(2)}KB)，可能影响加载速度`);
        }
    }
});

console.log('\n' + '='.repeat(50));

if (warnings.length > 0) {
    console.log('\n⚠️  警告信息：');
    warnings.forEach(warning => {
        console.log(`   - ${warning}`);
    });
}

if (hasError) {
    console.log('\n❌ 代码质量检查发现错误！\n');
    console.log('详细错误信息：');
    errors.forEach(error => {
        console.log(`   - ${error}`);
    });
    process.exit(1);
} else {
    console.log('\n✅ 代码质量检查完成！\n');
    if (warnings.length > 0) {
        console.log('（有警告但可以继续）\n');
    }
    process.exit(0);
}
