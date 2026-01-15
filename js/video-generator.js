/**
 * Video Generator - 热力图增长变化视频生成器
 * 生成展示轨迹随时间逐渐点亮过程的视频
 */

class VideoGenerator {
    constructor(heatmapRenderer) {
        this.heatmapRenderer = heatmapRenderer;
        this.ffmpeg = null;
        this.ffmpegLoaded = false;
        this.ffmpegLoading = false;
        this.isGenerating = false;
        this.cancelRequested = false;
        this.currentGenerationId = null; // 当前生成任务的ID
        this.generationStartTime = null; // 生成开始时间
    }

    /**
     * 检查是否支持视频生成（包括协议检查）
     * @returns {Object} {supported: boolean, reason: string}
     */
    static checkSupport() {
        // 检查基本支持
        if (typeof Worker === 'undefined' || typeof fetch === 'undefined' || typeof Blob === 'undefined') {
            return { supported: false, reason: '浏览器不支持Web Worker或Fetch API' };
        }
        
        // 检查是否在file://协议下（会导致CORS问题）
        if (window.location.protocol === 'file:') {
            return { 
                supported: false, 
                reason: 'file://协议限制',
                message: '视频生成功能需要在HTTP服务器环境下运行。\n\n' +
                         '解决方法：\n' +
                         '1. 使用本地HTTP服务器（如Python: python -m http.server 8000）\n' +
                         '2. 或部署到GitHub Pages等在线服务\n' +
                         '3. 或使用VS Code的Live Server扩展'
            };
        }
        
        return { supported: true };
    }

    /**
     * 加载FFmpeg.wasm库
     * @returns {Promise<void>}
     */
    async loadFFmpeg() {
        if (this.ffmpegLoaded && this.ffmpeg) {
            return;
        }

        if (this.ffmpegLoading) {
            // 如果正在加载，等待加载完成
            while (this.ffmpegLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }

        // 检查支持情况
        const supportCheck = VideoGenerator.checkSupport();
        if (!supportCheck.supported) {
            throw new Error(supportCheck.message || supportCheck.reason);
        }

        this.ffmpegLoading = true;

        try {
            // 尝试动态导入FFmpeg模块
            let FFmpeg, fetchFile, toBlobURL;
            
            try {
                // 使用jsDelivr CDN（通常更可靠）
                const ffmpegModule = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js');
                const utilModule = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js');
                FFmpeg = ffmpegModule.FFmpeg;
                fetchFile = utilModule.fetchFile;
                toBlobURL = utilModule.toBlobURL;
            } catch (jsdelivrError) {
                // 如果jsDelivr失败，尝试unpkg
                try {
                    if (logger && logger.warn) {
                        logger.warn('jsDelivr加载失败，尝试unpkg:', jsdelivrError);
                    }
                    const ffmpegModule = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js');
                    const utilModule = await import('https://unpkg.com/@ffmpeg/util@0.12.2/dist/esm/index.js');
                    FFmpeg = ffmpegModule.FFmpeg;
                    fetchFile = utilModule.fetchFile;
                    toBlobURL = utilModule.toBlobURL;
                } catch (unpkgError) {
                    // 如果都失败，抛出详细错误
                    if (logger && logger.error) {
                        logger.error('所有CDN加载失败:', { jsdelivrError, unpkgError });
                    }
                    throw new Error('无法从CDN加载FFmpeg库。请检查网络连接或使用支持ES模块的现代浏览器。');
                }
            }

            if (!FFmpeg || !toBlobURL) {
                throw new Error('无法加载FFmpeg模块');
            }

            this.ffmpeg = new FFmpeg();
            
            // 设置日志回调
            this.ffmpeg.on('log', ({ message }) => {
                if (logger && logger.debug) {
                    logger.debug('FFmpeg:', message);
                }
            });

            // 加载FFmpeg核心文件（优先使用jsDelivr，失败则使用unpkg）
            let coreJS, coreWASM;
            const baseURLs = [
                'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
                'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
            ];
            
            let loadSuccess = false;
            for (const baseURL of baseURLs) {
                try {
                    if (fetchFile) {
                        coreJS = await fetchFile(`${baseURL}/ffmpeg-core.js`);
                        coreWASM = await fetchFile(`${baseURL}/ffmpeg-core.wasm`);
                        loadSuccess = true;
                        break;
                    } else {
                        coreJS = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
                        coreWASM = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
                        loadSuccess = true;
                        break;
                    }
                } catch (loadError) {
                    if (logger && logger.warn) {
                        logger.warn(`从${baseURL}加载失败，尝试下一个CDN:`, loadError);
                    }
                    continue;
                }
            }
            
            if (!loadSuccess) {
                throw new Error('无法加载FFmpeg核心文件。请检查网络连接。');
            }
            
            // 尝试加载Worker文件（修复CORS问题）
            let workerURL = null;
            try {
                // 尝试从CDN加载Worker并转换为Blob URL（解决CORS问题）
                const workerBaseURLs = [
                    'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js',
                    'https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js'
                ];
                
                for (const workerBaseURL of workerBaseURLs) {
                    try {
                        if (fetchFile) {
                            const workerData = await fetchFile(workerBaseURL);
                            // 创建Blob URL以解决CORS问题
                            const workerBlob = new Blob([workerData], { type: 'application/javascript' });
                            workerURL = URL.createObjectURL(workerBlob);
                            break;
                        } else if (toBlobURL) {
                            workerURL = await toBlobURL(workerBaseURL, 'application/javascript');
                            break;
                        }
                    } catch (workerError) {
                        logger.warn(`从${workerBaseURL}加载Worker失败，尝试下一个:`, workerError);
                        continue;
                    }
                }
            } catch (workerError) {
                logger.warn('Worker加载失败，将使用默认配置:', workerError);
                // Worker加载失败不影响核心功能，继续使用默认配置
            }
            
            // 配置FFmpeg加载选项
            const loadOptions = {
                coreURL: coreJS,
                wasmURL: coreWASM,
            };
            
            // 如果成功加载了Worker，使用它
            if (workerURL) {
                loadOptions.workerURL = workerURL;
            }
            
            await this.ffmpeg.load(loadOptions);

            this.ffmpegLoaded = true;
            if (logger && logger.info) {
                logger.info('FFmpeg.wasm 加载成功');
            }
        } catch (error) {
            if (logger && logger.error) {
                logger.error('FFmpeg.wasm 加载失败:', error);
            }
            // 提供更详细的错误信息
            const errorMsg = error.message || '未知错误';
            
            // 检查是否是file://协议问题
            if (errorMsg.includes('origin \'null\'') || 
                errorMsg.includes('SecurityError') || 
                errorMsg.includes('Failed to construct \'Worker\'')) {
                throw new Error(
                    '视频生成功能需要在HTTP服务器环境下运行，不能直接在本地文件打开。\n\n' +
                    '解决方法：\n' +
                    '1. 使用Python启动本地服务器：python -m http.server 8000\n' +
                    '2. 使用VS Code的Live Server扩展\n' +
                    '3. 使用Node.js的http-server：npx http-server\n' +
                    '4. 或部署到GitHub Pages等在线服务\n\n' +
                    '然后在浏览器中访问 http://localhost:8000'
                );
            } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('network')) {
                throw new Error('FFmpeg加载失败：网络连接问题。请检查网络连接或稍后重试。');
            } else if (errorMsg.includes('module') || errorMsg.includes('import')) {
                throw new Error('FFmpeg加载失败：浏览器不支持ES模块。请使用现代浏览器（Chrome、Firefox、Edge最新版本）。');
            } else {
                throw new Error(`FFmpeg加载失败：${errorMsg}。请检查网络连接或使用现代浏览器。`);
            }
        } finally {
            this.ffmpegLoading = false;
        }
    }

    /**
     * 自动选择时间粒度
     * @param {number} timeRange - 时间范围（毫秒）
     * @param {number} totalPoints - 总点数
     * @returns {string} 时间粒度 ('day' | 'week' | 'month')
     */
    selectTimeGranularity(timeRange, totalPoints) {
        const days = timeRange / (1000 * 60 * 60 * 24);
        const pointsPerDay = totalPoints / days;

        // 限制最大帧数（最多500帧）
        const maxFrames = 500;
        let granularity;

        if (days < 30) {
            granularity = 'day';
        } else if (days < 365) {
            granularity = 'week';
        } else {
            granularity = 'month';
        }

        // 检查帧数是否过多
        let estimatedFrames;
        if (granularity === 'day') {
            estimatedFrames = days;
        } else if (granularity === 'week') {
            estimatedFrames = days / 7;
        } else {
            estimatedFrames = days / 30;
        }

        // 如果帧数过多，自动提升粒度
        if (estimatedFrames > maxFrames) {
            if (granularity === 'day') {
                granularity = 'week';
            } else if (granularity === 'week') {
                granularity = 'month';
            }
        }

        return granularity;
    }

    /**
     * 按时间戳排序轨迹点
     * @param {Array} tracks - 轨迹数组
     * @returns {Array} 排序后的点数组，每个点包含 {lat, lon, timestamp}
     */
    sortPointsByTime(tracks) {
        const allPoints = [];

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            for (let j = 0; j < track.points.length; j++) {
                const point = track.points[j];
                if (point.timestamp) {
                    allPoints.push({
                        lat: point.lat,
                        lon: point.lon,
                        timestamp: point.timestamp
                    });
                }
            }
        }

        // 按时间戳排序
        allPoints.sort((a, b) => a.timestamp - b.timestamp);

        return allPoints;
    }

    /**
     * 按时间窗口分组轨迹点
     * @param {Array} sortedPoints - 排序后的点数组
     * @param {string} granularity - 时间粒度 ('day' | 'week' | 'month')
     * @param {number} startTime - 开始时间（时间戳）
     * @param {number} endTime - 结束时间（时间戳）
     * @returns {Array} 分组后的点数组，每个元素是 [时间窗口开始时间, 该窗口及之前的所有点]
     */
    groupPointsByTimeWindow(sortedPoints, granularity, startTime, endTime) {
        const groups = [];
        let currentWindowStart = startTime;
        let accumulatedPoints = [];

        const getNextWindowStart = (current) => {
            const date = new Date(current);
            if (granularity === 'day') {
                date.setDate(date.getDate() + 1);
            } else if (granularity === 'week') {
                date.setDate(date.getDate() + 7);
            } else {
                date.setMonth(date.getMonth() + 1);
            }
            return date.getTime();
        };

        for (let i = 0; i < sortedPoints.length; i++) {
            const point = sortedPoints[i];

            // 如果点的时间超过当前窗口，保存当前窗口并开始新窗口
            while (point.timestamp >= getNextWindowStart(currentWindowStart) && currentWindowStart < endTime) {
                groups.push([currentWindowStart, [...accumulatedPoints]]);
                currentWindowStart = getNextWindowStart(currentWindowStart);
            }

            // 如果点在时间范围内，添加到累积点
            if (point.timestamp >= startTime && point.timestamp <= endTime) {
                accumulatedPoints.push([point.lat, point.lon]);
            }
        }

        // 添加最后一个窗口
        if (accumulatedPoints.length > 0) {
            groups.push([currentWindowStart, [...accumulatedPoints]]);
        }

        return groups;
    }

    /**
     * 生成单帧图片
     * @param {Array} points - 轨迹点数组 [[lat, lon], ...]
     * @returns {Promise<string>} Base64图片数据
     */
    async generateFrame(points) {
        if (this.cancelRequested) {
            throw new Error('生成已取消');
        }

        // 使用时间过滤渲染方法渲染热力图（用于视频生成，不调整地图视图）
        if (this.heatmapRenderer.renderHeatmapWithTimeFilter) {
            this.heatmapRenderer.renderHeatmapWithTimeFilter(points);
        } else {
            // 降级到普通渲染方法
            this.heatmapRenderer.renderHeatmap(points);
        }

        // 等待地图渲染完成
        await new Promise(resolve => setTimeout(resolve, 300));

        // 使用html2canvas截图
        if (typeof html2canvas === 'undefined' || typeof html2canvas !== 'function') {
            throw new Error('html2canvas 未加载');
        }

        const mapContainer = this.heatmapRenderer.map.getContainer();
        const canvas = await html2canvas(mapContainer, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            scale: 1.0,
            logging: false,
            width: mapContainer.offsetWidth,
            height: mapContainer.offsetHeight
        });

        return canvas.toDataURL('image/png', 1.0);
    }

    /**
     * 将DataURL转换为Uint8Array
     * @param {string} dataURL - Base64图片数据
     * @returns {Uint8Array}
     */
    dataURLToUint8Array(dataURL) {
        const base64 = dataURL.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * 初始化IndexedDB（用于保存视频生成进度）
     * @returns {Promise<IDBDatabase>}
     */
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('VideoGeneratorDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('videoGenerations')) {
                    const store = db.createObjectStore('videoGenerations', { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    /**
     * 保存视频生成进度到IndexedDB
     * @param {string} generationId - 生成任务ID
     * @param {Object} progressData - 进度数据
     */
    async saveProgress(generationId, progressData) {
        try {
            const db = await this.initIndexedDB();
            const transaction = db.transaction(['videoGenerations'], 'readwrite');
            const store = transaction.objectStore('videoGenerations');
            
            const data = {
                id: generationId,
                timestamp: Date.now(),
                ...progressData
            };
            
            await store.put(data);
        } catch (error) {
            logger.warn('保存进度失败:', error);
        }
    }

    /**
     * 获取视频生成进度
     * @param {string} generationId - 生成任务ID
     * @returns {Promise<Object|null>}
     */
    async getProgress(generationId) {
        try {
            const db = await this.initIndexedDB();
            const transaction = db.transaction(['videoGenerations'], 'readonly');
            const store = transaction.objectStore('videoGenerations');
            const request = store.get(generationId);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            logger.warn('获取进度失败:', error);
            return null;
        }
    }

    /**
     * 删除视频生成进度
     * @param {string} generationId - 生成任务ID
     */
    async deleteProgress(generationId) {
        try {
            const db = await this.initIndexedDB();
            const transaction = db.transaction(['videoGenerations'], 'readwrite');
            const store = transaction.objectStore('videoGenerations');
            await store.delete(generationId);
        } catch (error) {
            logger.warn('删除进度失败:', error);
        }
    }

    /**
     * 生成唯一的任务ID
     * @returns {string}
     */
    generateTaskId() {
        return `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 估算视频生成时间（秒）
     * @param {number} totalFrames - 总帧数
     * @returns {number} 估算时间（秒）
     */
    estimateGenerationTime(totalFrames) {
        // 每帧大约需要0.5-1秒（包括渲染和编码）
        const secondsPerFrame = 0.8;
        return Math.ceil(totalFrames * secondsPerFrame);
    }

    /**
     * 生成视频
     * @param {Array} tracks - 轨迹数组
     * @param {Date} startDate - 开始日期
     * @param {Date} endDate - 结束日期
     * @param {Function} progressCallback - 进度回调函数 (progress) => void
     * @param {boolean} backgroundMode - 是否后台模式（默认false）
     * @returns {Promise<Blob>} 视频Blob
     */
    async generateVideo(tracks, startDate, endDate, progressCallback, backgroundMode = false) {
        if (this.isGenerating) {
            throw new Error('视频生成正在进行中');
        }

        this.isGenerating = true;
        this.cancelRequested = false;
        
        // 生成任务ID
        const generationId = this.generateTaskId();
        this.currentGenerationId = generationId;
        this.generationStartTime = Date.now();

        // 保存原始热力图状态，以便生成完成后恢复
        const originalHeatLayer = this.heatmapRenderer.heatLayer;
        const originalPoints = this.heatmapRenderer.currentPoints ? [...this.heatmapRenderer.currentPoints] : null;
        let originalBounds = null;
        try {
            if (this.heatmapRenderer.map && this.heatmapRenderer.map.getBounds) {
                originalBounds = this.heatmapRenderer.map.getBounds();
            }
        } catch (e) {
            // 如果获取边界失败，忽略
        }

        try {
            // 验证输入
            if (!tracks || tracks.length === 0) {
                throw new Error('没有轨迹数据');
            }

            if (startDate >= endDate) {
                throw new Error('开始时间必须早于结束时间');
            }

            const startTime = startDate.getTime();
            const endTime = endDate.getTime();

            // 按时间排序所有点
            if (progressCallback) {
                progressCallback({ stage: 'sorting', progress: 0, message: '正在排序轨迹点...' });
            }
            const sortedPoints = this.sortPointsByTime(tracks);

            if (sortedPoints.length === 0) {
                throw new Error('没有带时间戳的轨迹点');
            }

            // 自动选择时间粒度
            const timeRange = endTime - startTime;
            const granularity = this.selectTimeGranularity(timeRange, sortedPoints.length);

            if (progressCallback) {
                progressCallback({ 
                    stage: 'grouping', 
                    progress: 10, 
                    message: `时间粒度: ${granularity === 'day' ? '天' : granularity === 'week' ? '周' : '月'}` 
                });
            }

            // 按时间窗口分组
            const timeWindows = this.groupPointsByTimeWindow(sortedPoints, granularity, startTime, endTime);

            if (timeWindows.length === 0) {
                throw new Error('在指定时间范围内没有轨迹点');
            }

            // 估算生成时间
            const estimatedTime = this.estimateGenerationTime(timeWindows.length);
            
            // 保存初始进度
            await this.saveProgress(generationId, {
                stage: 'initializing',
                progress: 0,
                totalFrames: timeWindows.length,
                estimatedTime: estimatedTime,
                startTime: this.generationStartTime,
                status: 'running'
            });

            // 加载FFmpeg
            if (progressCallback) {
                progressCallback({ stage: 'loading', progress: 20, message: '正在加载视频处理库...' });
            }
            await this.loadFFmpeg();
            
            // 如果估算时间超过30秒，建议后台模式
            if (!backgroundMode && estimatedTime > 30) {
                // 触发事件，让主应用决定是否切换到后台模式
                const event = new CustomEvent('videoGenerationLongTime', {
                    detail: {
                        generationId: generationId,
                        estimatedTime: estimatedTime,
                        totalFrames: timeWindows.length
                    }
                });
                document.dispatchEvent(event);
            }

            // 生成帧序列
            const frames = [];
            const totalFrames = timeWindows.length;

            for (let i = 0; i < timeWindows.length; i++) {
                if (this.cancelRequested) {
                    throw new Error('生成已取消');
                }

                const [windowStart, points] = timeWindows[i];
                const progress = 20 + (i / totalFrames) * 60;

                if (progressCallback) {
                    progressCallback({ 
                        stage: 'generating', 
                        progress: progress, 
                        message: `正在生成第 ${i + 1}/${totalFrames} 帧...`,
                        current: i + 1,
                        total: totalFrames
                    });
                }

                // 生成帧
                const frameDataURL = await this.generateFrame(points);
                const frameData = this.dataURLToUint8Array(frameDataURL);
                frames.push(frameData);

                // 定期保存进度（每10帧保存一次）
                if (i % 10 === 0 || i === totalFrames - 1) {
                    await this.saveProgress(generationId, {
                        stage: 'generating',
                        progress: progress,
                        currentFrame: i + 1,
                        totalFrames: totalFrames,
                        status: 'running',
                        framesGenerated: frames.length
                    });
                }

                // 让出控制权，避免阻塞UI
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            // 合成视频
            if (progressCallback) {
                progressCallback({ stage: 'encoding', progress: 80, message: '正在合成视频...' });
            }
            
            await this.saveProgress(generationId, {
                stage: 'encoding',
                progress: 80,
                status: 'running'
            });

            // 将帧写入FFmpeg文件系统
            for (let i = 0; i < frames.length; i++) {
                const frameNumber = String(i).padStart(6, '0');
                await this.ffmpeg.writeFile(`frame${frameNumber}.png`, frames[i]);
            }

            // 生成视频
            const fps = 24;
            await this.ffmpeg.exec([
                '-framerate', String(fps),
                '-i', 'frame%06d.png',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-crf', '23',
                '-y',
                'output.mp4'
            ]);

            // 读取生成的视频
            const videoData = await this.ffmpeg.readFile('output.mp4');
            const videoBlob = new Blob([videoData.buffer], { type: 'video/mp4' });

            // 清理临时文件
            for (let i = 0; i < frames.length; i++) {
                const frameNumber = String(i).padStart(6, '0');
                await this.ffmpeg.deleteFile(`frame${frameNumber}.png`);
            }
            await this.ffmpeg.deleteFile('output.mp4');

            // 保存完成的视频到IndexedDB
            const videoArrayBuffer = await videoBlob.arrayBuffer();
            await this.saveProgress(generationId, {
                stage: 'complete',
                progress: 100,
                status: 'completed',
                videoData: videoArrayBuffer,
                completedTime: Date.now()
            });

            if (progressCallback) {
                progressCallback({ stage: 'complete', progress: 100, message: '视频生成完成！' });
            }

            return videoBlob;

        } catch (error) {
            logger.error('视频生成失败:', error);
            
            // 保存错误状态
            await this.saveProgress(generationId, {
                stage: 'error',
                progress: 0,
                status: 'failed',
                error: error.message,
                failedTime: Date.now()
            });
            
            throw error;
        } finally {
            // 恢复原始热力图状态
            try {
                if (originalPoints && originalPoints.length > 0) {
                    // 恢复原始热力图
                    this.heatmapRenderer.renderHeatmap(originalPoints);
                    // 恢复地图视图
                    if (originalBounds && this.heatmapRenderer.map && this.heatmapRenderer.map.fitBounds) {
                        this.heatmapRenderer.map.fitBounds(originalBounds);
                    }
                } else if (originalHeatLayer && this.heatmapRenderer.map) {
                    // 如果原始热力图层存在，尝试恢复
                    // 但如果没有原始点数据，只能保持当前状态
                    logger.warn('无法恢复原始热力图：缺少原始点数据');
                }
            } catch (restoreError) {
                logger.error('恢复原始热力图失败:', restoreError);
                // 即使恢复失败，也不影响视频生成结果
            }
            
            this.isGenerating = false;
            this.cancelRequested = false;
            this.currentGenerationId = null;
            this.generationStartTime = null;
        }
    }

    /**
     * 从IndexedDB恢复并下载已完成的视频
     * @param {string} generationId - 生成任务ID
     * @returns {Promise<Blob|null>} 视频Blob，如果不存在则返回null
     */
    async recoverVideo(generationId) {
        const progress = await this.getProgress(generationId);
        if (!progress || progress.status !== 'completed' || !progress.videoData) {
            return null;
        }
        
        return new Blob([progress.videoData], { type: 'video/mp4' });
    }

    /**
     * 检查是否有未完成的视频生成任务
     * @returns {Promise<Array>} 未完成的任务列表
     */
    async getPendingGenerations() {
        try {
            const db = await this.initIndexedDB();
            const transaction = db.transaction(['videoGenerations'], 'readonly');
            const store = transaction.objectStore('videoGenerations');
            const index = store.index('timestamp');
            const request = index.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const all = request.result || [];
                    // 过滤出未完成的任务
                    const pending = all.filter(item => 
                        item.status === 'running' || item.status === 'completed'
                    );
                    resolve(pending);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            logger.warn('获取待处理任务失败:', error);
            return [];
        }
    }

    /**
     * 取消视频生成
     */
    cancel() {
        this.cancelRequested = true;
    }

    /**
     * 检查是否支持视频生成
     * @returns {boolean}
     */
    static isSupported() {
        const supportCheck = VideoGenerator.checkSupport();
        return supportCheck.supported;
    }
}

// 导出VideoGenerator类
window.VideoGenerator = VideoGenerator;
