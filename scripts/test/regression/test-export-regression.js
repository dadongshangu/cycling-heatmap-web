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
    
    // 查找移动端正常模式配置（回退到原始配置）
    const mobileConfigStart = content.indexOf('正常模式：scale=1.0（高质量），与之前能工作的版本一致');
    if (mobileConfigStart === -1) {
        runner.assert(false, '找不到移动端正常模式配置');
        return;
    }
    
    // 查找imageTimeout设置
    const nextBlock = content.indexOf('}', mobileConfigStart + 50);
    const mobileConfigBlock = content.substring(mobileConfigStart, nextBlock !== -1 ? nextBlock : content.length);
    
    const timeoutMatch = mobileConfigBlock.match(/imageTimeout:\s*(\d+)/);
    if (timeoutMatch) {
        const timeout = parseInt(timeoutMatch[1]);
        runner.assert(timeout === 12000, `移动端正常模式imageTimeout应该是12000（回退到原始配置），当前是${timeout}`);
    } else {
        runner.assert(false, '找不到移动端正常模式imageTimeout设置');
    }
});

runner.test('导出功能回归: 移动端正常模式不应该有ignoreElements', () => {
    const content = fs.readFileSync(heatmapRendererPath, 'utf8');
    
    // 查找移动端正常模式配置（回退到原始配置）
    const mobileConfigStart = content.indexOf('正常模式：scale=1.0（高质量），与之前能工作的版本一致');
    if (mobileConfigStart === -1) {
        runner.assert(false, '找不到移动端正常模式配置');
        return;
    }
    
    // 查找配置块
    const nextBlock = content.indexOf('}', mobileConfigStart + 50);
    const mobileConfigBlock = content.substring(mobileConfigStart, nextBlock !== -1 ? nextBlock : content.length);
    
    // 移动端正常模式不应该有ignoreElements（回退到原始配置）
    const hasIgnoreElements = mobileConfigBlock.includes('ignoreElements');
    runner.assert(!hasIgnoreElements, '移动端正常模式不应该有ignoreElements（回退到原始配置）');
});

runner.test('导出功能回归: PC端配置应该优化（性能优化选项）', () => {
    const content = fs.readFileSync(heatmapRendererPath, 'utf8');
    
    // 查找PC端配置（已更新为优化配置）
    const pcConfigStart = content.indexOf('PC端：优化配置以提升导出速度');
    if (pcConfigStart === -1) {
        runner.assert(false, '找不到PC端优化配置');
        return;
    }
    
    // 查找配置块
    const nextBlock = content.indexOf('}', pcConfigStart + 100);
    const pcConfigBlock = content.substring(pcConfigStart, nextBlock !== -1 ? nextBlock : content.length);
    
    // PC端应该有性能优化选项
    const hasForeignObjectDisabled = pcConfigBlock.includes('foreignObjectRendering: false');
    runner.assert(hasForeignObjectDisabled, 'PC端应该禁用foreignObjectRendering以提升速度');
    
    const hasIgnoreElements = pcConfigBlock.includes('ignoreElements');
    runner.assert(hasIgnoreElements, 'PC端应该配置ignoreElements以忽略不必要元素');
    
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

runner.test('导出功能回归: PC端超时应该由main.js统一管理（30秒）', () => {
    const mainContent = fs.readFileSync(mainJsPath, 'utf8');
    const rendererContent = fs.readFileSync(heatmapRendererPath, 'utf8');
    
    // 检查main.js中PC端超时设置为30秒（因为 html2canvas 处理大图需要更长时间）
    const pcTimeoutPattern = /totalTimeout\s*=\s*30000/;
    const hasCorrectTimeout = pcTimeoutPattern.test(mainContent);
    runner.assert(hasCorrectTimeout, 'main.js中PC端超时应该设置为30000（30秒）');
    
    // 检查heatmap-renderer.js中PC端不应该有超时设置
    const pcConfigStart = rendererContent.indexOf('// PC端：完全使用原有配置');
    if (pcConfigStart !== -1) {
        const nextBlock = rendererContent.indexOf('}', pcConfigStart + 50);
        const pcConfigBlock = rendererContent.substring(pcConfigStart, nextBlock !== -1 ? nextBlock : rendererContent.length);
        
    // PC端配置块中应该有性能优化选项
    const hasForeignObjectDisabled = pcConfigBlock.includes('foreignObjectRendering: false');
    runner.assert(hasForeignObjectDisabled, 'PC端应该禁用foreignObjectRendering以提升速度');
    
    const hasIgnoreElements = pcConfigBlock.includes('ignoreElements');
    runner.assert(hasIgnoreElements, 'PC端应该配置ignoreElements以忽略不必要元素');
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

runner.test('导出功能回归: index.html不应该引用fit-file-parser.min.js', () => {
    const indexHtmlPath = path.join(__dirname, '../../../index.html');
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    
    // 检查是否还有 fit-file-parser.min.js 的引用
    const hasFitParserRef = content.includes('fit-file-parser.min.js') || 
                           content.includes('fit-file-parser.js');
    runner.assert(!hasFitParserRef, 'index.html不应该引用fit-file-parser.min.js（默认使用手动解析）');
});

runner.test('导出功能回归: PC端导出延迟应该是200ms', () => {
    const mainContent = fs.readFileSync(mainJsPath, 'utf8');
    
    // 直接查找setTimeout(resolve, 200)（PC端延迟）
    const has200msDelay = mainContent.includes('setTimeout(resolve, 200)') || 
                          mainContent.includes('setTimeout(resolve,200)') ||
                          /setTimeout\s*\([^,]+,\s*200\s*\)/.test(mainContent);
    runner.assert(has200msDelay, 'PC端导出延迟应该是200ms');
});

runner.test('导出功能回归: 移动端导出延迟应该是500ms', () => {
    const mainContent = fs.readFileSync(mainJsPath, 'utf8');
    
    // 直接查找setTimeout(resolve, 500)（移动端原始延迟）
    const has500msDelay = mainContent.includes('setTimeout(resolve, 500)') || 
                          mainContent.includes('setTimeout(resolve,500)') ||
                          /setTimeout\s*\([^,]+,\s*500\s*\)/.test(mainContent);
    runner.assert(has500msDelay, '移动端导出延迟应该是500ms（回退到原始配置）');
});

runner.test('导出功能回归: PC端html2canvas应该配置性能优化选项', () => {
    const rendererContent = fs.readFileSync(heatmapRendererPath, 'utf8');
    
    // 查找PC端html2canvas配置
    const pcConfigIndex = rendererContent.indexOf('PC端：优化配置以提升导出速度');
    if (pcConfigIndex === -1) {
        runner.assert(false, '找不到PC端优化配置');
        return;
    }
    
    // 查找配置块结束位置
    const nextBlock = rendererContent.indexOf('}', pcConfigIndex + 100);
    const pcConfigSection = rendererContent.substring(pcConfigIndex, nextBlock !== -1 ? nextBlock : pcConfigIndex + 500);
    
    // 检查是否有性能优化选项
    const hasForeignObjectDisabled = pcConfigSection.includes('foreignObjectRendering: false');
    runner.assert(hasForeignObjectDisabled, 'PC端应该禁用foreignObjectRendering以提升速度');
    
    const hasIgnoreElements = pcConfigSection.includes('ignoreElements');
    runner.assert(hasIgnoreElements, 'PC端应该配置ignoreElements以忽略不必要元素');
});

runner.test('导出功能回归: 移动端html2canvas应该使用原始配置（无性能优化）', () => {
    const rendererContent = fs.readFileSync(heatmapRendererPath, 'utf8');
    
    // 查找移动端正常模式html2canvas配置（回退到原始配置）
    const mobileConfigIndex = rendererContent.indexOf('正常模式：scale=1.0（高质量），与之前能工作的版本一致');
    if (mobileConfigIndex === -1) {
        runner.assert(false, '找不到移动端正常模式配置');
        return;
    }
    
    // 查找配置块结束位置
    const nextBlock = rendererContent.indexOf('}', mobileConfigIndex + 100);
    const mobileConfigSection = rendererContent.substring(mobileConfigIndex, nextBlock !== -1 ? nextBlock : mobileConfigIndex + 500);
    
    // 移动端正常模式不应该有性能优化选项（回退到原始配置）
    const hasForeignObjectDisabled = mobileConfigSection.includes('foreignObjectRendering: false');
    runner.assert(!hasForeignObjectDisabled, '移动端正常模式不应该禁用foreignObjectRendering（回退到原始配置）');
    
    const hasIgnoreElements = mobileConfigSection.includes('ignoreElements');
    runner.assert(!hasIgnoreElements, '移动端正常模式不应该有ignoreElements（回退到原始配置）');
    
    // 检查imageTimeout应该是12000ms（原始配置）
    const timeoutMatch = mobileConfigSection.match(/imageTimeout:\s*(\d+)/);
    if (timeoutMatch) {
        const timeout = parseInt(timeoutMatch[1]);
        runner.assert(timeout === 12000, `移动端imageTimeout应该是12000ms（回退到原始配置），当前是${timeout}ms`);
    } else {
        runner.assert(false, '找不到移动端imageTimeout设置');
    }
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
