#!/usr/bin/env node
/**
 * 导出功能回归测试
 * 确保之前修复的导出问题不会再次出现
 */

const fs = require('fs');
const path = require('path');

const TestRunner = require('../utils/test-runner');
const runner = new TestRunner();

// 检查关键文件是否存在
const heatmapRendererPath = path.join(__dirname, '../../../js/heatmap-renderer.js');
const mainJsPath = path.join(__dirname, '../../../js/main.js');

runner.test('导出功能回归: heatmap-renderer.js应该存在', () => {
    runner.assert(fs.existsSync(heatmapRendererPath), 'heatmap-renderer.js文件应该存在');
});

runner.test('导出功能回归: exportMapAsImage方法应该直接使用html2canvas', () => {
    const content = fs.readFileSync(heatmapRendererPath, 'utf8');
    
    // 检查不应该有loadHtml2Canvas调用
    const hasLoadHtml2Canvas = content.includes('await this.loadHtml2Canvas()');
    runner.assert(!hasLoadHtml2Canvas, 'exportMapAsImage不应该调用loadHtml2Canvas()');
    
    // 检查应该直接使用html2canvas
    const hasDirectHtml2Canvas = content.includes('html2canvas(mapContainer') || 
                                                   content.includes('html2canvasFn(mapContainer');
    runner.assert(hasDirectHtml2Canvas, '应该直接使用html2canvas函数');
});

runner.test('导出功能回归: 移动端正常模式imageTimeout应该是12000', () => {
    const content = fs.readFileSync(heatmapRendererPath, 'utf8');
    
    // 检查移动端正常模式的imageTimeout配置
    const mobileNormalModePattern = /imageTimeout:\s*12000/;
    const hasCorrectTimeout = mobileNormalModePattern.test(content);
    
    runner.assert(hasCorrectTimeout, '移动端正常模式imageTimeout应该是12000（12秒）');
});

runner.test('导出功能回归: 移动端正常模式不应该有ignoreElements', () => {
    const content = fs.readFileSync(heatmapRendererPath, 'utf8');
    
    // 查找移动端正常模式的配置块
    const mobileNormalModeStart = content.indexOf('// 正常模式：scale=1.0');
    if (mobileNormalModeStart === -1) {
        runner.assert(false, '找不到移动端正常模式配置');
        return;
    }
    
    // 查找下一个模式或else块
    const nextMode = content.indexOf('} else {', mobileNormalModeStart);
    const mobileNormalModeBlock = content.substring(mobileNormalModeStart, nextMode !== -1 ? nextMode : content.length);
    
    // 检查是否有ignoreElements
    const hasIgnoreElements = mobileNormalModeBlock.includes('ignoreElements:');
    runner.assert(!hasIgnoreElements, '移动端正常模式不应该有ignoreElements配置');
});

runner.test('导出功能回归: PC端配置应该简化（只有基本配置）', () => {
    const content = fs.readFileSync(heatmapRendererPath, 'utf8');
    
    // 查找PC端配置块
    const pcConfigStart = content.indexOf('// PC端：完全使用原有配置');
    if (pcConfigStart === -1) {
        runner.assert(false, '找不到PC端配置');
        return;
    }
    
    // 查找下一个块
    const nextBlock = content.indexOf('}', pcConfigStart + 50);
    const pcConfigBlock = content.substring(pcConfigStart, nextBlock !== -1 ? nextBlock : content.length);
    
    // PC端不应该有这些配置
    const shouldNotHave = ['scrollX', 'scrollY', 'windowWidth', 'windowHeight', 'imageTimeout', 'foreignObjectRendering', 'ignoreElements'];
    shouldNotHave.forEach(config => {
        const hasConfig = pcConfigBlock.includes(config + ':');
        runner.assert(!hasConfig, `PC端配置不应该包含${config}`);
    });
    
    // PC端应该有这些基本配置
    const shouldHave = ['useCORS', 'allowTaint', 'backgroundColor', 'scale', 'logging', 'width', 'height'];
    shouldHave.forEach(config => {
        const hasConfig = pcConfigBlock.includes(config + ':');
        runner.assert(hasConfig, `PC端配置应该包含${config}`);
    });
});

runner.test('导出功能回归: main.js中移动端导出应该直接显示模态框', () => {
    const content = fs.readFileSync(mainJsPath, 'utf8');
    
    // 检查移动端导出流程
    const mobileExportStart = content.indexOf('// 移动端：新的导出流程');
    if (mobileExportStart === -1) {
        runner.assert(false, '找不到移动端导出流程');
        return;
    }
    
    // 查找Web Share API失败后的处理
    const afterWebShare = content.indexOf('// Web Share API不支持或失败', mobileExportStart);
    if (afterWebShare === -1) {
        runner.assert(false, '找不到Web Share API失败后的处理');
        return;
    }
    
    // 检查是否直接显示模态框
    const nextBlock = content.indexOf('} catch (error)', afterWebShare);
    const exportBlock = content.substring(afterWebShare, nextBlock !== -1 ? nextBlock : content.length);
    
    // 应该直接调用showImageInModal，不应该先调用downloadImage
    const hasDirectModal = exportBlock.includes('showImageInModal');
    runner.assert(hasDirectModal, 'Web Share失败后应该直接显示模态框');
});

runner.test('导出功能回归: PC端超时应该由main.js统一管理（20秒）', () => {
    const mainContent = fs.readFileSync(mainJsPath, 'utf8');
    const rendererContent = fs.readFileSync(heatmapRendererPath, 'utf8');
    
    // 检查main.js中PC端超时设置为20秒
    const pcTimeoutPattern = /totalTimeout\s*=\s*20000/;
    const hasCorrectTimeout = pcTimeoutPattern.test(mainContent);
    runner.assert(hasCorrectTimeout, 'main.js中PC端超时应该设置为20000（20秒）');
    
    // 检查heatmap-renderer.js中PC端不应该有超时设置
    const pcConfigStart = rendererContent.indexOf('// PC端：完全使用原有配置');
    if (pcConfigStart !== -1) {
        const nextBlock = rendererContent.indexOf('}', pcConfigStart + 50);
        const pcConfigBlock = rendererContent.substring(pcConfigStart, nextBlock !== -1 ? nextBlock : rendererContent.length);
        
        // PC端配置块中不应该有timeout变量或setTimeout设置EXPORT_TIMEOUT
        const hasTimeoutVar = /timeout\s*=/.test(pcConfigBlock);
        const hasTimeoutSet = /setTimeout.*EXPORT_TIMEOUT/.test(pcConfigBlock);
        runner.assert(!hasTimeoutVar && !hasTimeoutSet, 'heatmap-renderer.js中PC端不应该有超时设置');
    }
});

runner.test('导出功能回归: exportMapAsImage不应该有内部超时设置', () => {
    const content = fs.readFileSync(heatmapRendererPath, 'utf8');
    
    // 查找exportMapAsImage方法
    const methodStart = content.indexOf('async exportMapAsImage(');
    if (methodStart === -1) {
        runner.assert(false, '找不到exportMapAsImage方法');
        return;
    }
    
    // 查找方法结束（下一个方法或类结束）
    const methodEnd = content.indexOf('async ', methodStart + 1);
    const methodContent = content.substring(methodStart, methodEnd !== -1 ? methodEnd : content.length);
    
    // 不应该有setTimeout设置EXPORT_TIMEOUT
    const hasTimeoutSet = /setTimeout.*EXPORT_TIMEOUT/.test(methodContent);
    runner.assert(!hasTimeoutSet, 'exportMapAsImage方法内部不应该有EXPORT_TIMEOUT超时设置');
});

runner.test('导出功能回归: index.html应该正确加载Leaflet库', () => {
    const indexHtmlPath = path.join(__dirname, '../../../index.html');
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    
    // 检查是否有 Leaflet CSS
    const hasLeafletCSS = content.includes('leaflet.css') || content.includes('leaflet@');
    runner.assert(hasLeafletCSS, 'index.html应该包含Leaflet CSS引用');
    
    // 检查是否有 Leaflet JS 加载逻辑
    const hasLeafletJS = content.includes('leaflet.js') || content.includes('leaflet@');
    runner.assert(hasLeafletJS, 'index.html应该包含Leaflet JS引用');
    
    // 检查是否有备用CDN方案
    const hasFallback = content.includes('jsdelivr') && content.includes('unpkg');
    runner.assert(hasFallback, 'index.html应该有备用CDN方案（jsdelivr和unpkg）');
    
    // 检查是否有等待Leaflet加载的逻辑
    const hasWaitLogic = content.includes('typeof L') || content.includes('checkAndInitApp') || content.includes('leafletLoaded');
    runner.assert(hasWaitLogic, 'index.html应该等待Leaflet加载完成后再初始化应用');
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
