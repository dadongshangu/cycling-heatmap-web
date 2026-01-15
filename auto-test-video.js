#!/usr/bin/env node
/**
 * 自动化测试视频生成功能
 * 自动启动服务器并测试关键功能
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORTS = [3000, 8000, 8080, 5000, 4000];
let currentPort = PORTS[0];
let serverProcess = null;

console.log('🧪 开始自动化测试视频生成功能...\n');

// 清理函数
function cleanup() {
    if (serverProcess) {
        console.log('\n🛑 停止服务器...');
        serverProcess.kill();
    }
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// 测试1: 检查关键文件
function testFiles() {
    console.log('📁 测试1: 检查关键文件...');
    const files = [
        'index.html',
        'js/video-generator.js',
        'js/main.js',
        'js/heatmap-renderer.js',
        'assets/demo/sample_beijing_ride.gpx'
    ];
    
    let allExist = true;
    files.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`   ✅ ${file}`);
        } else {
            console.log(`   ❌ ${file} - 文件不存在`);
            allExist = false;
        }
    });
    
    return allExist;
}

// 测试2: 检查代码功能
function testCode() {
    console.log('\n💻 测试2: 检查代码功能...');
    
    const videoGeneratorPath = path.join(__dirname, 'js/video-generator.js');
    const mainJsPath = path.join(__dirname, 'js/main.js');
    
    if (!fs.existsSync(videoGeneratorPath) || !fs.existsSync(mainJsPath)) {
        console.log('   ❌ 无法读取代码文件');
        return false;
    }
    
    const videoGeneratorContent = fs.readFileSync(videoGeneratorPath, 'utf8');
    const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
    
    const checks = [
        {
            name: 'VideoGenerator类存在',
            test: videoGeneratorContent.includes('class VideoGenerator')
        },
        {
            name: 'checkSupport方法存在',
            test: videoGeneratorContent.includes('checkSupport()')
        },
        {
            name: 'loadFFmpeg方法存在',
            test: videoGeneratorContent.includes('async loadFFmpeg()')
        },
        {
            name: 'generateVideo方法存在',
            test: videoGeneratorContent.includes('async generateVideo(')
        },
        {
            name: 'main.js集成视频生成',
            test: mainJsContent.includes('generateVideo()')
        },
        {
            name: 'file://协议检测',
            test: videoGeneratorContent.includes('file:') || videoGeneratorContent.includes('location.protocol')
        },
        {
            name: '默认时间范围（最近一年）',
            test: mainJsContent.includes('oneYearAgo') || mainJsContent.includes('setFullYear')
        },
        {
            name: '多CDN降级',
            test: videoGeneratorContent.includes('jsdelivr') && videoGeneratorContent.includes('unpkg')
        }
    ];
    
    let allPass = true;
    checks.forEach(check => {
        if (check.test) {
            console.log(`   ✅ ${check.name}`);
        } else {
            console.log(`   ❌ ${check.name}`);
            allPass = false;
        }
    });
    
    return allPass;
}

// 测试3: 检查示例GPX文件
function testSampleGPX() {
    console.log('\n📄 测试3: 检查示例GPX文件...');
    
    const gpxPath = path.join(__dirname, 'assets/demo/sample_beijing_ride.gpx');
    if (!fs.existsSync(gpxPath)) {
        console.log('   ❌ 示例GPX文件不存在');
        return false;
    }
    
    const content = fs.readFileSync(gpxPath, 'utf8');
    const hasTime = content.includes('<time>');
    const hasPoints = content.includes('<trkpt');
    
    if (hasTime && hasPoints) {
        const pointCount = (content.match(/<trkpt/g) || []).length;
        const timeCount = (content.match(/<time>/g) || []).length;
        console.log(`   ✅ 示例GPX文件有效 (${pointCount} 个轨迹点, ${timeCount} 个时间戳)`);
        return true;
    } else {
        console.log('   ❌ 示例GPX文件格式不正确');
        return false;
    }
}

// 测试4: 启动服务器
function startServer() {
    return new Promise((resolve, reject) => {
        console.log('\n🚀 测试4: 启动HTTP服务器...');
        
        // 检查Node.js
        const nodeCheck = spawn('node', ['--version'], { shell: true });
        nodeCheck.on('close', (code) => {
            if (code === 0) {
                console.log('   ✅ 检测到Node.js');
                tryStartServer(0, resolve);
            } else {
                // 尝试Python
                const pythonCheck = spawn('python', ['--version'], { shell: true });
                pythonCheck.on('close', (pyCode) => {
                    if (pyCode === 0) {
                        console.log('   ✅ 检测到Python');
                        tryStartServer(0, resolve, true);
                    } else {
                        console.log('   ❌ 未找到Node.js或Python');
                        resolve(false);
                    }
                });
            }
        });
    });
}

function tryStartServer(portIndex, resolve, usePython = false) {
    if (portIndex >= PORTS.length) {
        console.log('   ❌ 所有端口都不可用');
        resolve(false);
        return;
    }
    
    currentPort = PORTS[portIndex];
    console.log(`   📡 正在启动服务器 (端口 ${currentPort})...`);
    
    const args = usePython 
        ? ['-m', 'http.server', currentPort.toString()]
        : ['--yes', 'http-server', '.', '-p', currentPort.toString(), '-c-1'];
    const command = usePython ? 'python' : 'npx';
    
    if (serverProcess) {
        serverProcess.kill();
    }
    
    serverProcess = spawn(command, args, {
        shell: true,
        stdio: 'pipe'
    });
    
    let serverReady = false;
    
    serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Available on') || output.includes('Hit CTRL-C') || output.includes('Serving')) {
            if (!serverReady) {
                serverReady = true;
                console.log(`   ✅ 服务器启动成功！`);
                console.log(`   🌐 服务器地址: http://localhost:${currentPort}`);
                resolve(true);
            }
        }
    });
    
    serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('EADDRINUSE') || output.includes('address already in use')) {
            console.log(`   ⚠️  端口 ${currentPort} 已被占用，尝试下一个端口...`);
            if (serverProcess) {
                serverProcess.kill();
            }
            // 尝试下一个端口
            setTimeout(() => {
                tryStartServer(portIndex + 1, resolve, usePython);
            }, 500);
            return;
        }
    });
    
    // 定期检查服务器是否就绪
    let checkCount = 0;
    const maxChecks = 8; // 最多检查8次，每次1秒
    
    const checkInterval = setInterval(() => {
        if (serverReady) {
            clearInterval(checkInterval);
            return;
        }
        
        checkCount++;
        testServerConnection(currentPort).then(success => {
            if (success && !serverReady) {
                serverReady = true;
                clearInterval(checkInterval);
                console.log(`   ✅ 服务器已启动（通过连接测试确认）`);
                console.log(`   🌐 服务器地址: http://localhost:${currentPort}`);
                resolve(true);
            } else if (checkCount >= maxChecks && !serverReady) {
                clearInterval(checkInterval);
                // 尝试下一个端口
                if (serverProcess) {
                    serverProcess.kill();
                }
                tryStartServer(portIndex + 1, resolve, usePython);
            }
        });
    }, 1000);
}

// 测试5: 测试服务器连接
function testServerConnection(port = currentPort) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        
        req.on('error', () => {
            resolve(false);
        });
        
        req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// 测试6: 检查HTML结构
function testHTMLStructure() {
    console.log('\n📄 测试6: 检查HTML结构...');
    
    const htmlPath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(htmlPath)) {
        console.log('   ❌ index.html不存在');
        return false;
    }
    
    const content = fs.readFileSync(htmlPath, 'utf8');
    
    const checks = [
        { name: 'video-generator.js脚本引用', test: content.includes('video-generator.js') },
        { name: '生成视频按钮', test: content.includes('generateVideoBtn') || content.includes('生成视频') },
        { name: '视频配置模态框', test: content.includes('videoConfigModal') },
        { name: '视频进度模态框', test: content.includes('videoProgressModal') }
    ];
    
    let allPass = true;
    checks.forEach(check => {
        if (check.test) {
            console.log(`   ✅ ${check.name}`);
        } else {
            console.log(`   ❌ ${check.name}`);
            allPass = false;
        }
    });
    
    return allPass;
}

// 运行所有测试
async function runTests() {
    const results = {
        files: testFiles(),
        code: testCode(),
        sample: testSampleGPX(),
        html: testHTMLStructure()
    };
    
    // 启动服务器
    results.server = await startServer();
    
    // 等待服务器完全启动
    if (results.server) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        results.connection = await testServerConnection(currentPort);
    } else {
        results.connection = false;
    }
    
    // 显示结果
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(50));
    console.log(`关键文件: ${results.files ? '✅' : '❌'}`);
    console.log(`代码功能: ${results.code ? '✅' : '❌'}`);
    console.log(`示例数据: ${results.sample ? '✅' : '❌'}`);
    console.log(`HTML结构: ${results.html ? '✅' : '❌'}`);
    console.log(`服务器启动: ${results.server ? '✅' : '❌'}`);
    console.log(`服务器连接: ${results.connection ? '✅' : '❌'}`);
    console.log('='.repeat(50));
    
    const allPass = Object.values(results).every(r => r);
    
    if (allPass) {
        console.log('\n✅ 所有测试通过！');
        console.log('\n🎬 下一步：');
        console.log(`1. 在浏览器中打开: http://localhost:${currentPort}`);
        console.log('2. 上传示例GPX文件: assets/demo/sample_beijing_ride.gpx');
        console.log('3. 生成热力图');
        console.log('4. 点击"生成视频"按钮');
        console.log('5. 选择时间范围（默认最近一年）');
        console.log('6. 开始生成视频');
        console.log('\n💡 服务器正在运行，按 Ctrl+C 停止服务器和测试\n');
    } else {
        console.log('\n⚠️  部分测试失败，请检查上述问题');
        if (!results.server) {
            console.log('\n💡 可以手动启动服务器:');
            console.log('   npx http-server . -p 3000');
        }
        cleanup();
    }
    
    // 保持服务器运行
    if (results.server && results.connection) {
        console.log('\n⏳ 服务器保持运行中，等待手动测试...');
        console.log('   按 Ctrl+C 停止服务器\n');
    }
}

// 运行测试
runTests().catch(err => {
    console.error('❌ 测试运行失败:', err);
    cleanup();
});
