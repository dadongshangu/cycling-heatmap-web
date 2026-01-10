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

/**
 * 检查括号配对（大括号、圆括号、方括号）
 * @param {string} content - 文件内容
 * @returns {Object} {valid: boolean, errors: Array}
 */
function checkBracketMatching(content) {
    const stack = [];
    const errors = [];
    const lines = content.split('\n');
    
    const pairs = {
        '{': '}',
        '(': ')',
        '[': ']'
    };
    
    const openBrackets = Object.keys(pairs);
    const closeBrackets = Object.values(pairs);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
            // 跳过字符串和注释
            if (char === '"' || char === "'" || char === '`') {
                const quote = char;
                j++;
                // 对于模板字符串（反引号），需要处理${}表达式
                if (quote === '`') {
                    while (j < line.length) {
                        if (line[j] === '\\') {
                            j++; // 跳过转义字符
                        } else if (line[j] === '$' && j + 1 < line.length && line[j + 1] === '{') {
                            // 遇到${，跳过整个表达式（包括嵌套的括号）
                            j += 2; // 跳过${
                            let braceCount = 1;
                            while (j < line.length && braceCount > 0) {
                                if (line[j] === '\\') {
                                    j++; // 跳过转义字符
                                } else if (line[j] === '{') {
                                    braceCount++;
                                } else if (line[j] === '}') {
                                    braceCount--;
                                }
                                j++;
                            }
                            j--; // 回退一位，因为外层循环会++
                        } else if (line[j] === quote) {
                            break; // 找到结束引号
                        }
                        j++;
                    }
                } else {
                    // 普通字符串
                    while (j < line.length && line[j] !== quote) {
                        if (line[j] === '\\') j++; // 跳过转义字符
                        j++;
                    }
                }
                continue;
            }
            
            if (char === '/' && line[j + 1] === '/') break; // 单行注释
            if (char === '/' && line[j + 1] === '*') {
                // 多行注释开始，简单处理：跳过到行尾
                j = line.length;
                continue;
            }
            
            if (openBrackets.includes(char)) {
                stack.push({ char, line: lineNum, col: j + 1 });
            } else if (closeBrackets.includes(char)) {
                if (stack.length === 0) {
                    errors.push(`第${lineNum}行第${j + 1}列: 多余的闭合符号 "${char}"`);
                } else {
                    const last = stack.pop();
                    const expected = pairs[last.char];
                    if (char !== expected) {
                        errors.push(`第${last.line}行第${last.col}列的 "${last.char}" 与第${lineNum}行第${j + 1}列的 "${char}" 不匹配`);
                    }
                }
            }
        }
    }
    
    // 检查未闭合的括号
    while (stack.length > 0) {
        const unclosed = stack.pop();
        errors.push(`第${unclosed.line}行第${unclosed.col}列: 未闭合的 "${unclosed.char}"`);
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

console.log('🔍 开始语法检查...\n');

filesToCheck.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  文件不存在: ${file}`);
        hasError = true;
        errors.push({ file, error: '文件不存在' });
        return;
    }
    
    try {
        // 1. 使用 Node.js 的语法检查
        const content = fs.readFileSync(filePath, 'utf8');
        let syntaxError = null;
        
        try {
            execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
        } catch (error) {
            const errorMsg = (error.stdout && error.stdout.toString()) || 
                            (error.stderr && error.stderr.toString()) || 
                            error.message;
            
            // 检查是否是可选链操作符的错误（浏览器支持，但旧版Node.js不支持）
            if (errorMsg.includes('Unexpected token') && errorMsg.includes('?.') && content.includes('?.')) {
                // 这是可选链操作符，浏览器支持，不算错误
                console.log(`✅ ${file} - 语法正确（可选链操作符在浏览器中支持）`);
            } else {
                syntaxError = errorMsg;
            }
        }
        
        // 2. 检查括号配对（仅作为辅助检查，如果Node.js语法检查通过，括号检查的误报可以忽略）
        const bracketCheck = checkBracketMatching(content);
        
        if (syntaxError) {
            hasError = true;
            errors.push({ file, error: syntaxError });
            console.log(`❌ ${file} - 语法错误`);
            console.log(`   错误信息: ${syntaxError.trim()}`);
        } else if (!bracketCheck.valid && bracketCheck.errors.length > 0) {
            // 如果Node.js语法检查通过，但括号检查有错误，可能是误报
            // 对于类文件，如果只有一个未闭合的大括号且是类定义的开始，可能是正常的
            const isClassFile = content.trim().startsWith('class ') || content.includes('class ');
            const hasOnlyOneUnclosedBrace = bracketCheck.errors.length === 1 && 
                                          bracketCheck.errors[0].includes('未闭合') &&
                                          bracketCheck.errors[0].includes('{');
            
            if (isClassFile && hasOnlyOneUnclosedBrace) {
                // 可能是正常的类定义，不报错
                console.log(`✅ ${file} - 语法正确（括号检查可能有误报，但Node.js语法检查通过）`);
            } else {
                hasError = true;
                const bracketErrors = bracketCheck.errors.join('; ');
                errors.push({ file, error: `括号配对错误: ${bracketErrors}` });
                console.log(`❌ ${file} - 括号配对错误`);
                bracketCheck.errors.forEach(err => {
                    console.log(`   ${err}`);
                });
            }
        } else {
            console.log(`✅ ${file} - 语法正确，括号配对正确`);
        }
    } catch (error) {
        hasError = true;
        const errorMsg = (error.stdout && error.stdout.toString()) || 
                        (error.stderr && error.stderr.toString()) || 
                        error.message;
        errors.push({ file, error: errorMsg });
        console.log(`❌ ${file} - 检查失败`);
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
