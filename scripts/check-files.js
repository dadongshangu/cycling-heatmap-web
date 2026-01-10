#!/usr/bin/env node
/**
 * 文件完整性检查脚本
 * 检查必需文件是否存在，验证HTML结构完整性
 * 
 * 使用方法：
 *   node scripts/check-files.js
 */

const fs = require('fs');
const path = require('path');

// 必需的文件列表
const requiredFiles = [
    'index.html',
    'css/style.css',
    'js/main.js',
    'js/heatmap-renderer.js',
    'js/gpx-parser.js',
    'js/map-config.js'
];

// HTML中必需的元素ID
const requiredElementIds = [
    'map',              // 地图容器
    'fileInput',        // 文件输入
    'selectFileBtn',    // 选择文件按钮
    'generateBtn',      // 生成按钮
    'exportBtn',       // 导出按钮
    'uploadArea',      // 上传区域
    'clearFiles',      // 清除文件按钮
    'mapStyle',        // 地图样式选择
    'mapLanguage',     // 地图语言选择
    'dateRange',       // 日期范围选择
    'radius',          // 线条粗细
    'blur',            // 模糊程度
    'opacity'          // 透明度
];

// HTML中必需的脚本引用
const requiredScripts = [
    'js/map-config.js',
    'js/gpx-parser.js',
    'js/heatmap-renderer.js',
    'js/main.js'
];

let hasError = false;
const errors = [];
const warnings = [];

console.log('🔍 开始文件完整性检查...\n');

// 检查必需文件是否存在
console.log('📁 检查必需文件...');
requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file} - 存在`);
    } else {
        hasError = true;
        errors.push(`必需文件不存在: ${file}`);
        console.log(`❌ ${file} - 不存在`);
    }
});

// 检查HTML结构
console.log('\n📄 检查HTML结构...');
const htmlPath = path.join(__dirname, '..', 'index.html');
if (fs.existsSync(htmlPath)) {
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // 检查必需的元素ID
    requiredElementIds.forEach(id => {
        const regex = new RegExp(`id=["']${id}["']`, 'i');
        if (regex.test(htmlContent)) {
            console.log(`✅ 元素 #${id} - 存在`);
        } else {
            hasError = true;
            errors.push(`HTML中缺少必需的元素ID: ${id}`);
            console.log(`❌ 元素 #${id} - 不存在`);
        }
    });
    
    // 检查脚本引用
    console.log('\n📜 检查脚本引用...');
    requiredScripts.forEach(script => {
        const scriptName = path.basename(script);
        const regex = new RegExp(scriptName.replace(/\./g, '\\.'), 'i');
        if (regex.test(htmlContent)) {
            console.log(`✅ 脚本 ${scriptName} - 已引用`);
        } else {
            hasError = true;
            errors.push(`HTML中缺少必需的脚本引用: ${script}`);
            console.log(`❌ 脚本 ${scriptName} - 未引用`);
        }
    });
    
    // 检查HTML基本结构
    console.log('\n🏗️  检查HTML基本结构...');
    if (htmlContent.includes('<!DOCTYPE html>')) {
        console.log('✅ DOCTYPE声明 - 存在');
    } else {
        warnings.push('HTML缺少DOCTYPE声明');
        console.log('⚠️  DOCTYPE声明 - 缺失（警告）');
    }
    
    if (htmlContent.includes('<html')) {
        console.log('✅ <html>标签 - 存在');
    } else {
        hasError = true;
        errors.push('HTML缺少<html>标签');
        console.log('❌ <html>标签 - 不存在');
    }
    
    if (htmlContent.includes('<head>') && htmlContent.includes('</head>')) {
        console.log('✅ <head>标签 - 完整');
    } else {
        hasError = true;
        errors.push('HTML的<head>标签不完整');
        console.log('❌ <head>标签 - 不完整');
    }
    
    if (htmlContent.includes('<body>') && htmlContent.includes('</body>')) {
        console.log('✅ <body>标签 - 完整');
    } else {
        hasError = true;
        errors.push('HTML的<body>标签不完整');
        console.log('❌ <body>标签 - 不完整');
    }
} else {
    hasError = true;
    errors.push('index.html文件不存在');
    console.log('❌ index.html - 不存在');
}

// 检查CSS文件
console.log('\n🎨 检查CSS文件...');
const cssPath = path.join(__dirname, '..', 'css/style.css');
if (fs.existsSync(cssPath)) {
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    if (cssContent.length > 0) {
        console.log('✅ style.css - 文件非空');
    } else {
        warnings.push('style.css文件为空');
        console.log('⚠️  style.css - 文件为空（警告）');
    }
}

console.log('\n' + '='.repeat(50));

if (warnings.length > 0) {
    console.log('\n⚠️  警告信息：');
    warnings.forEach(warning => {
        console.log(`   - ${warning}`);
    });
}

if (hasError) {
    console.log('\n❌ 文件完整性检查失败！\n');
    console.log('详细错误信息：');
    errors.forEach(error => {
        console.log(`   - ${error}`);
    });
    process.exit(1);
} else {
    console.log('\n✅ 所有文件完整性检查通过！\n');
    if (warnings.length > 0) {
        console.log('（有警告但可以继续）\n');
    }
    process.exit(0);
}
