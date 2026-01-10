#!/usr/bin/env node
/**
 * 综合测试脚本
 * 运行所有测试检查：语法、质量、文件完整性
 * 
 * 使用方法：
 *   node scripts/test-all.js
 */

const { execSync } = require('child_process');
const path = require('path');

const scriptsDir = path.join(__dirname);
let totalErrors = 0;
let totalWarnings = 0;
const results = [];

console.log('🚀 开始运行所有测试...\n');
console.log('='.repeat(60) + '\n');

// 测试1: 语法检查
console.log('📋 测试 1/3: 语法检查\n');
try {
    execSync(`node "${path.join(scriptsDir, 'check-syntax.js')}"`, { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    results.push({ test: '语法检查', status: '✅ 通过' });
} catch (error) {
    totalErrors++;
    results.push({ test: '语法检查', status: '❌ 失败' });
}

console.log('\n' + '='.repeat(60) + '\n');

// 测试2: 文件完整性检查
console.log('📋 测试 2/3: 文件完整性检查\n');
try {
    execSync(`node "${path.join(scriptsDir, 'check-files.js')}"`, { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    results.push({ test: '文件完整性', status: '✅ 通过' });
} catch (error) {
    totalErrors++;
    results.push({ test: '文件完整性', status: '❌ 失败' });
}

console.log('\n' + '='.repeat(60) + '\n');

// 测试3: 代码质量检查
console.log('📋 测试 3/3: 代码质量检查\n');
try {
    execSync(`node "${path.join(scriptsDir, 'check-quality.js')}"`, { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    results.push({ test: '代码质量', status: '✅ 通过' });
} catch (error) {
    // 代码质量检查失败不算严重错误，只记录警告
    totalWarnings++;
    results.push({ test: '代码质量', status: '⚠️  有警告' });
}

console.log('\n' + '='.repeat(60));
console.log('\n📊 测试结果汇总\n');
console.log('='.repeat(60) + '\n');

results.forEach(result => {
    console.log(`${result.status} ${result.test}`);
});

console.log('\n' + '='.repeat(60) + '\n');

if (totalErrors > 0) {
    console.log(`❌ 测试失败！发现 ${totalErrors} 个错误。\n`);
    console.log('请修复错误后重新运行测试。\n');
    process.exit(1);
} else if (totalWarnings > 0) {
    console.log(`⚠️  测试通过，但有 ${totalWarnings} 个警告。\n`);
    console.log('建议检查警告信息，但可以继续提交。\n');
    process.exit(0);
} else {
    console.log('✅ 所有测试通过！可以安全提交代码。\n');
    process.exit(0);
}
