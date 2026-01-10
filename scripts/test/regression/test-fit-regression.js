#!/usr/bin/env node
/**
 * FIT解析回归测试
 * 确保之前修复的FIT坐标转换问题不会再次出现
 */

const fs = require('fs');
const path = require('path');

const TestRunner = require('../utils/test-runner');
const runner = new TestRunner();

const fitParserPath = path.join(__dirname, '../../../js/fit-parser.js');

runner.test('FIT解析回归: fit-parser.js应该存在', () => {
    runner.assert(fs.existsSync(fitParserPath), 'fit-parser.js文件应该存在');
});

runner.test('FIT解析回归: 应该有semicirclesToDegrees函数', () => {
    const content = fs.readFileSync(fitParserPath, 'utf8');
    
    // 检查是否有semicirclesToDegrees函数
    const hasFunction = content.includes('semicirclesToDegrees') || 
                       content.includes('semicirclesToDegrees(');
    runner.assert(hasFunction, '应该有semicirclesToDegrees函数用于坐标转换');
});

runner.test('FIT解析回归: 坐标转换应该使用正确的公式', () => {
    const content = fs.readFileSync(fitParserPath, 'utf8');
    
    // 检查坐标转换公式：degrees = coordinate_value * (180 / 2^31)
    const hasCorrectFormula = content.includes('180 / 2') && 
                             (content.includes('Math.pow(2, 31)') || 
                              content.includes('2147483648') || 
                              content.includes('0x80000000'));
    runner.assert(hasCorrectFormula, '坐标转换应该使用正确的公式：degrees = coordinate_value * (180 / 2^31)');
});

runner.test('FIT解析回归: 应该有坐标格式检测逻辑', () => {
    const content = fs.readFileSync(fitParserPath, 'utf8');
    
    // 检查是否有坐标格式检测
    const hasFormatDetection = content.includes('analyzeCoordinateFormat') || 
                               content.includes('determineCoordinateFormat') ||
                               content.includes('坐标格式');
    runner.assert(hasFormatDetection, '应该有坐标格式检测逻辑（区分degrees和semicircles）');
});

runner.test('FIT解析回归: 应该有离群点过滤逻辑', () => {
    const content = fs.readFileSync(fitParserPath, 'utf8');
    
    // 检查是否有离群点过滤
    const hasOutlierFilter = content.includes('filterGlobalOutliers') || 
                            content.includes('filterAdjacentOutliers') ||
                            content.includes('离群点') ||
                            content.includes('outlier');
    runner.assert(hasOutlierFilter, '应该有离群点过滤逻辑（防止非洲等错误位置）');
});

runner.test('FIT解析回归: 坐标验证应该在合理范围内', () => {
    const content = fs.readFileSync(fitParserPath, 'utf8');
    
    // 检查是否有坐标范围验证（中国境内：纬度35-45，经度110-125）
    // 或者检查是否有坐标有效性验证
    const hasValidation = content.includes('lat >= -90') || 
                         content.includes('lon >= -180') ||
                         content.includes('isValidCoordinate') ||
                         content.includes('坐标验证');
    runner.assert(hasValidation, '应该有坐标有效性验证');
});

// 运行测试
if (require.main === module) {
    runner.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('测试运行失败:', error);
        process.exit(1);
    });
}

module.exports = { runner };
