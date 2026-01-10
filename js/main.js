/**
 * Main Application - 运动轨迹热力图生成器主程序
 */

class CyclingHeatmapApp {
    constructor() {
        this.gpxParser = new GPXParser();
        this.heatmapRenderer = null;
        this.loadedTracks = [];
        this.isProcessing = false;
        this.startTime = null; // 用于计算处理时间
        
        this.initializeApp();
    }

    /**
     * 初始化应用
     */
    initializeApp() {
        // 初始化全局错误处理
        this.initErrorHandling();
        
        // 检查是否从书签传入API密钥
        this.setApiKeyFromBookmarklet();
        
        // 初始化热力图渲染器
        this.heatmapRenderer = new HeatmapRenderer('map');
        
        // 根据设备类型配置文件输入
        this.configureFileInput();
        
        // 绑定事件监听器
        this.bindEventListeners();
        
        // 加载保存的设置
        this.loadSettings();
        
        // 初始化UI状态
        this.updateUI();
        
        console.log('🚴 Cycling Heatmap Generator 已启动');
    }

    /**
     * 初始化全局错误处理
     */
    initErrorHandling() {
        // 捕获全局JavaScript错误
        window.addEventListener('error', (event) => {
            console.error('Global JavaScript error:', event.error);
            this.logError('JavaScript Error', {
                message: event.error?.message || event.message,
                stack: event.error?.stack,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
            
            // 显示用户友好的错误提示
            if (!event.error || !event.error.message || !event.error.message.includes('Script error')) {
                this.showMessage('发生了一个错误，请刷新页面重试', 'error');
            }
        });
        
        // 捕获未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.logError('Unhandled Promise Rejection', {
                reason: event.reason?.toString() || String(event.reason),
                stack: event.reason?.stack
            });
            
            // 显示用户友好的错误提示
            const errorMsg = event.reason?.message || String(event.reason);
            if (errorMsg && !errorMsg.includes('abort')) {
                this.showMessage('处理过程中发生错误，请重试', 'error');
            }
        });
    }

    /**
     * 记录错误日志
     */
    logError(type, details) {
        const errorLog = {
            type,
            details,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        // 在开发环境或调试模式下输出详细错误信息
        if (console && console.error) {
            console.error(`[ErrorHandler] ${type}:`, errorLog);
        }
        
        // 可以在这里添加错误上报逻辑（如发送到错误监控服务）
        // 例如：if (window.Sentry) { window.Sentry.captureException(error); }
    }

    /**
     * 配置文件输入 - PC端保留GPX筛选，移动端移除限制
     */
    configureFileInput() {
        const fileInput = document.getElementById('fileInput');
        if (!fileInput) return;
        
        // 检测是否为移动设备
        const isMobile = this.isMobileDevice();
        
        if (isMobile) {
            // 移动端：移除 accept 限制，避免文件显示为灰色
            fileInput.removeAttribute('accept');
        } else {
            // PC端：保留 GPX 文件筛选，方便用户选择
            fileInput.setAttribute('accept', '.gpx,.GPX');
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        // 文件上传相关
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const selectFileBtn = document.getElementById('selectFileBtn');
        const clearFilesBtn = document.getElementById('clearFiles');

        // 检查必需元素是否存在
        if (!uploadArea || !fileInput) {
            console.error('必需的上传元素未找到');
            return;
        }

        // 拖拽上传
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));

        // 只在上传区域的空白部分点击时触发文件选择
        uploadArea.addEventListener('click', (e) => {
            // 如果点击的是按钮（包括上传按钮和帮助按钮），不触发文件选择
            if (e.target.closest('.upload-btn') || e.target.closest('.help-btn')) {
                return;
            }
            fileInput.click();
        });

        // 选择文件按钮
        if (selectFileBtn) {
            selectFileBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                fileInput.click();
            });
        }

        // 文件选择
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // 清除文件
        if (clearFilesBtn) {
            clearFilesBtn.addEventListener('click', this.clearAllFiles.bind(this));
        }

        // 参数控制
        this.bindParameterControls();

        // 生成按钮
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', this.generateHeatmap.bind(this));
        }

        // 地图控制按钮
        const exportBtn = document.getElementById('exportBtn');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', this.exportMap.bind(this));
        }
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', this.enterFullscreen.bind(this));
        }
        
        // 检测全屏API支持，如果不支持则隐藏全屏按钮
        this.checkFullscreenSupport(fullscreenBtn);
        
        // 绑定键盘快捷键
        this.bindKeyboardShortcuts();
    }

    /**
     * 绑定键盘快捷键
     */
    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + O: 打开文件选择对话框
            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                const fileInput = document.getElementById('fileInput');
                if (fileInput) {
                    fileInput.click();
                }
            }
            
            // Ctrl/Cmd + G: 生成热力图
            if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
                e.preventDefault();
                const generateBtn = document.getElementById('generateBtn');
                if (generateBtn && !generateBtn.disabled) {
                    this.generateHeatmap();
                }
            }
            
            // Esc: 关闭所有打开的模态框
            if (e.key === 'Escape') {
                const modals = document.querySelectorAll('.modal');
                modals.forEach(modal => {
                    if (modal.style.display !== 'none' && modal.style.display !== '') {
                        modal.style.display = 'none';
                    }
                });
            }
        });
    }

    /**
     * 防抖函数
     * @param {Function} func - 要防抖的函数
     * @param {number} wait - 等待时间（毫秒）
     * @returns {Function} 防抖后的函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 绑定参数控制事件
     */
    bindParameterControls() {
        // 地图样式
        const mapStyleSelect = document.getElementById('mapStyle');
        if (!mapStyleSelect) {
            console.error('mapStyle元素未找到');
            return;
        }
        mapStyleSelect.addEventListener('change', (e) => {
            this.heatmapRenderer.setMapStyle(e.target.value);
            this.saveSettings(); // 保存设置
        });

        // 地图语言
        const mapLanguageSelect = document.getElementById('mapLanguage');
        if (!mapLanguageSelect) {
            console.error('mapLanguage元素未找到');
            return;
        }
        mapLanguageSelect.addEventListener('change', (e) => {
            let selectedLanguage = e.target.value;
            
            // 如果选择中文地图，检查API密钥
            if ((selectedLanguage === 'zh-vector' || selectedLanguage === 'zh-satellite') && 
                !MAP_CONFIG.hasApiKey()) {
                // 显示友好的提示模态框
                this.showApiKeyPrompt();
                // 自动切换回英文地图
                e.target.value = 'en';
                selectedLanguage = 'en';
            }
            
            this.heatmapRenderer.setMapLanguage(selectedLanguage);
            
            // 更新API使用量面板的显示状态
            this.updateApiUsagePanelVisibility(selectedLanguage);
            
            this.saveSettings(); // 保存设置
        });
        
        // 监听API密钥缺失事件
        document.addEventListener('tiandituApiKeyMissing', () => {
            // 如果当前选择的是中文地图，显示提示
            const currentLanguage = document.getElementById('mapLanguage').value;
            if (currentLanguage === 'zh-vector' || currentLanguage === 'zh-satellite') {
                this.showApiKeyPrompt();
                // 自动切换回英文地图
                document.getElementById('mapLanguage').value = 'en';
                this.heatmapRenderer.setMapLanguage('en');
                this.updateApiUsagePanelVisibility('en');
            }
        });

        // 滑块控件 - 使用防抖优化性能
        const controls = ['radius', 'blur', 'opacity'];
        controls.forEach(control => {
            const slider = document.getElementById(control);
            const valueDisplay = document.getElementById(control + 'Value');
            
            if (!slider || !valueDisplay) {
                console.warn(`参数控件 ${control} 未找到`);
                return;
            }
            
            // 立即更新显示值（无延迟）
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                valueDisplay.textContent = value;
            });
            
            // 防抖更新热力图（300ms延迟）
            const debouncedUpdate = this.debounce(() => {
                if (this.loadedTracks.length > 0 && this.heatmapRenderer) {
                    this.updateHeatmapParameters();
                }
                this.saveSettings(); // 保存设置
            }, 300);
            
            slider.addEventListener('change', debouncedUpdate);
        });

        // 日期范围
        const dateRangeSelect = document.getElementById('dateRange');
        if (!dateRangeSelect) {
            console.error('dateRange元素未找到');
            return;
        }
        dateRangeSelect.addEventListener('change', () => {
            if (this.loadedTracks.length > 0) {
                this.updateHeatmapWithDateFilter();
            }
            this.saveSettings(); // 保存设置
        });
    }

    /**
     * 处理拖拽悬停
     */
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('uploadArea').classList.add('dragover');
    }

    /**
     * 处理拖拽离开
     */
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('uploadArea').classList.remove('dragover');
    }

    /**
     * 处理文件拖拽放置
     */
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('uploadArea').classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files).filter(file => 
            file.name.toLowerCase().endsWith('.gpx')
        );
        
        if (files.length > 0) {
            this.processFiles(files);
        } else {
            this.showMessage('请选择轨迹记录GPX', 'warning');
        }
    }

    /**
     * 检查文件是否可读
     */
    async checkFileReadability(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            let isResolved = false;
            
            // 设置超时，避免长时间等待
            const timeout = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    resolve({ readable: false, error: '文件读取超时' });
                }
            }, 5000);
            
            reader.onload = () => {
                if (!isResolved) {
                    isResolved = true;
                    clearTimeout(timeout);
                    resolve({ readable: true });
                }
            };
            
            reader.onerror = () => {
                if (!isResolved) {
                    isResolved = true;
                    clearTimeout(timeout);
                    resolve({ readable: false, error: '文件无法读取，可能是权限问题' });
                }
            };
            
            // 尝试读取文件（只读取一小部分来检测）
            reader.readAsArrayBuffer(file.slice(0, 1024));
        });
    }

    /**
     * 检查是否为移动设备
     */
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    }

    /**
     * 处理文件选择
     */
    async handleFileSelect(e) {
        const allFiles = Array.from(e.target.files);
        
        if (allFiles.length === 0) {
            return;
        }
        
        // 在 JavaScript 中验证文件类型（替代 accept 属性）
        const gpxFiles = allFiles.filter(file => 
            file.name.toLowerCase().endsWith('.gpx')
        );
        
        // 如果有非 GPX 文件，给出提示
        if (gpxFiles.length === 0 && allFiles.length > 0) {
            this.showMessage('请选择轨迹记录GPX文件（.gpx格式）', 'warning');
            return;
        }
        
        // 检查文件可读性（特别是移动端）
        const isMobile = this.isMobileDevice();
        if (isMobile && gpxFiles.length > 0) {
            this.showMessage('正在检查文件...', 'info');
            
            const readabilityResults = await Promise.all(
                gpxFiles.map(file => this.checkFileReadability(file))
            );
            
            const readableFiles = [];
            const unreadableFiles = [];
            
            gpxFiles.forEach((file, index) => {
                if (readabilityResults[index].readable) {
                    readableFiles.push(file);
                } else {
                    unreadableFiles.push({ file, error: readabilityResults[index].error });
                }
            });
            
            if (unreadableFiles.length > 0) {
                // 显示移动端帮助
                this.showMobileFileHelp();
                this.showMessage(
                    `${unreadableFiles.length} 个文件无法读取。请查看帮助提示。`,
                    'error'
                );
            }
            
            if (readableFiles.length > 0) {
                this.processFiles(readableFiles);
            }
        } else {
            // 桌面端直接处理
            this.processFiles(gpxFiles);
        }
    }

    /**
     * 处理文件
     */
    async processFiles(files) {
        if (this.isProcessing) {
            this.showMessage('正在处理文件，请稍候...', 'info');
            return;
        }

        // 文件大小验证
        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 单个文件最大50MB
        const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 总大小最大200MB
        const validFiles = [];
        const oversizedFiles = [];
        
        // 验证单个文件大小
        files.forEach(file => {
            if (file.size > MAX_FILE_SIZE) {
                oversizedFiles.push({
                    name: file.name,
                    size: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
                });
            } else {
                validFiles.push(file);
            }
        });
        
        // 验证总大小
        if (validFiles.length > 0) {
            const totalSize = validFiles.reduce((sum, file) => sum + file.size, 0);
            if (totalSize > MAX_TOTAL_SIZE) {
                this.showMessage(
                    `文件总大小超过限制（${(MAX_TOTAL_SIZE / (1024 * 1024)).toFixed(0)}MB），请分批上传`,
                    'error'
                );
                return;
            }
        }
        
        if (oversizedFiles.length > 0) {
            const fileList = oversizedFiles.map(f => `${f.name} (${f.size})`).join(', ');
            this.showMessage(
                `${oversizedFiles.length} 个文件超过大小限制（50MB）：${fileList}。已跳过这些文件。`,
                'warning'
            );
        }
        
        if (validFiles.length === 0) {
            this.showMessage('没有有效的文件可以处理', 'error');
            return;
        }

        // 记录开始时间，用于估算剩余时间
        this.startTime = Date.now();
        this.isProcessing = true;
        this.showLoading(true);
        
        try {
            // 解析文件
            const results = await this.gpxParser.parseFiles(validFiles, this.updateProgress.bind(this));
            
            // 过滤成功解析的文件
            const successfulTracks = results.filter(result => !result.error);
            const failedTracks = results.filter(result => result.error);
            
            // 分析失败原因
            const permissionErrors = [];
            const formatErrors = [];
            const otherErrors = [];
            
            failedTracks.forEach(track => {
                const errorMsg = track.error?.toLowerCase() || '';
                if (errorMsg.includes('permission') || errorMsg.includes('权限') || 
                    errorMsg.includes('无法读取') || errorMsg.includes('read')) {
                    permissionErrors.push(track);
                } else if (errorMsg.includes('format') || errorMsg.includes('格式') || 
                          errorMsg.includes('invalid') || errorMsg.includes('parse')) {
                    formatErrors.push(track);
                } else {
                    otherErrors.push(track);
                }
            });
            
            if (successfulTracks.length > 0) {
                this.loadedTracks = this.loadedTracks.concat(successfulTracks);
                this.updateFileList();
                this.updateStatistics();
                this.enableGenerateButton();
                
                this.showMessage(
                    `成功加载 ${successfulTracks.length} 个文件${failedTracks.length > 0 ? `，${failedTracks.length} 个文件失败` : ''}`,
                    'success'
                );
            } else {
                // 所有文件都失败了
                const isMobile = this.isMobileDevice();
                if (permissionErrors.length > 0 && isMobile) {
                    // 移动端权限错误，显示帮助
                    this.showMobileFileHelp();
                    this.showMessage('文件无法读取，可能是权限问题。请查看帮助提示。', 'error');
                } else if (formatErrors.length > 0) {
                    this.showMessage('文件格式错误，请确保选择的是有效的GPX文件', 'error');
                } else {
                    this.showMessage('没有成功解析的文件', 'error');
                }
            }
            
            if (failedTracks.length > 0) {
                console.warn('解析失败的文件:', failedTracks);
                
                // 如果是移动端且有权限错误，记录日志
                const isMobile = this.isMobileDevice();
                if (permissionErrors.length > 0 && isMobile) {
                    console.warn('移动端文件权限错误:', permissionErrors);
                }
            }
            
        } catch (error) {
            console.error('处理文件时出错:', error);
            const errorMsg = error.message?.toLowerCase() || '';
            const isMobile = this.isMobileDevice();
            
            if ((errorMsg.includes('permission') || errorMsg.includes('权限') || 
                 errorMsg.includes('无法读取')) && isMobile) {
                this.showMobileFileHelp();
                this.showMessage('文件读取失败，可能是权限问题。请查看帮助提示。', 'error');
            } else {
                this.showMessage('处理文件时出错: ' + error.message, 'error');
            }
        } finally {
            this.isProcessing = false;
            this.showLoading(false);
        }
    }

    /**
     * 更新进度
     */
    updateProgress(progress) {
        const loadingText = document.getElementById('loadingText');
        const progressFill = document.getElementById('progressFill');
        
        const percentage = (progress.current / progress.total) * 100;
        progressFill.style.width = percentage + '%';
        
        if (progress.status === 'processing') {
            // 估算剩余时间
            let timeText = '';
            if (this.startTime && progress.current > 0) {
                const elapsed = Date.now() - this.startTime;
                const avgTimePerFile = elapsed / progress.current;
                const remaining = Math.ceil((progress.total - progress.current) * avgTimePerFile / 1000);
                
                if (remaining > 0) {
                    if (remaining < 60) {
                        timeText = ` - 预计剩余 ${remaining}秒`;
                    } else {
                        const minutes = Math.floor(remaining / 60);
                        const seconds = remaining % 60;
                        timeText = ` - 预计剩余 ${minutes}分${seconds}秒`;
                    }
                }
            }
            
            loadingText.textContent = `正在处理: ${progress.filename} (${progress.current}/${progress.total})${timeText}`;
        } else if (progress.status === 'completed') {
            loadingText.textContent = `已完成: ${progress.filename} - ${progress.points} 个点`;
        } else if (progress.status === 'error') {
            loadingText.textContent = `错误: ${progress.filename} - ${progress.error}`;
        }
    }

    /**
     * 更新文件列表显示
     */
    updateFileList() {
        const fileList = document.getElementById('fileList');
        const fileListItems = document.getElementById('fileListItems');
        const fileCountText = document.getElementById('fileCountText');
        
        if (this.loadedTracks.length === 0) {
            fileList.style.display = 'none';
            return;
        }
        
        fileList.style.display = 'block';
        
        // 更新文件数量显示
        const totalPoints = this.loadedTracks.reduce((sum, track) => sum + track.pointCount, 0);
        fileCountText.textContent = `${this.loadedTracks.length} 个文件 (${totalPoints.toLocaleString()} 点)`;
        
        // 更新文件列表
        fileListItems.innerHTML = '';
        this.loadedTracks.forEach(track => {
            const li = document.createElement('li');
            li.textContent = `${track.filename} (${track.pointCount.toLocaleString()} 点)`;
            fileListItems.appendChild(li);
        });
    }

    /**
     * 更新统计信息
     */
    updateStatistics() {
        const stats = this.gpxParser.getStatistics();
        
        document.getElementById('fileCount').textContent = this.loadedTracks.length;
        document.getElementById('pointCount').textContent = stats.totalPoints.toLocaleString();
        document.getElementById('totalDistance').textContent = stats.totalDistance + ' km';
        document.getElementById('dateRangeText').textContent = this.gpxParser.getDateRangeText();
        
        document.getElementById('statsSection').style.display = 'block';
    }

    /**
     * 启用生成按钮
     */
    enableGenerateButton() {
        const generateBtn = document.getElementById('generateBtn');
        generateBtn.disabled = false;
    }

    /**
     * 清除所有文件
     */
    clearAllFiles() {
        // 清除数据
        this.loadedTracks = [];
        this.gpxParser.clear();
        
        // 清除热力图和释放内存
        if (this.heatmapRenderer) {
            this.heatmapRenderer.clearHeatmap();
            // 清理当前点数据
            if (this.heatmapRenderer.currentPoints) {
                this.heatmapRenderer.currentPoints = [];
            }
        }
        
        // 重置处理状态
        this.isProcessing = false;
        this.startTime = null;
        
        // 重置UI
        document.getElementById('fileList').style.display = 'none';
        document.getElementById('statsSection').style.display = 'none';
        document.getElementById('generateBtn').disabled = true;
        document.getElementById('exportBtn').disabled = true;
        
        // 重置文件输入
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }
        
        // 隐藏加载状态
        this.showLoading(false);
        
        this.showMessage('已清除所有文件', 'info');
    }

    /**
     * 保存用户设置到本地存储
     */
    saveSettings() {
        try {
            const settings = {
                mapStyle: document.getElementById('mapStyle')?.value || 'dark',
                mapLanguage: document.getElementById('mapLanguage')?.value || 'en',
                radius: document.getElementById('radius')?.value || '1',
                blur: document.getElementById('blur')?.value || '1',
                opacity: document.getElementById('opacity')?.value || '0.8',
                dateRange: document.getElementById('dateRange')?.value || '365'
            };
            
            localStorage.setItem('heatmap_settings', JSON.stringify(settings));
        } catch (error) {
            console.warn('保存设置失败:', error);
        }
    }

    /**
     * 从本地存储加载用户设置
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('heatmap_settings');
            if (!saved) return;
            
            const settings = JSON.parse(saved);
            
            // 验证并应用设置
            if (settings.mapStyle && ['dark', 'light'].includes(settings.mapStyle)) {
                const mapStyleEl = document.getElementById('mapStyle');
                if (mapStyleEl) {
                    mapStyleEl.value = settings.mapStyle;
                    if (this.heatmapRenderer) {
                        this.heatmapRenderer.setMapStyle(settings.mapStyle);
                    }
                }
            }
            
            if (settings.mapLanguage && ['en', 'zh-vector', 'zh-satellite'].includes(settings.mapLanguage)) {
                const mapLanguageEl = document.getElementById('mapLanguage');
                if (mapLanguageEl) {
                    // 检查中文地图是否需要API密钥
                    if ((settings.mapLanguage === 'zh-vector' || settings.mapLanguage === 'zh-satellite') && 
                        !MAP_CONFIG.hasApiKey()) {
                        // 如果没有API密钥，使用英文地图
                        mapLanguageEl.value = 'en';
                    } else {
                        mapLanguageEl.value = settings.mapLanguage;
                        if (this.heatmapRenderer) {
                            this.heatmapRenderer.setMapLanguage(settings.mapLanguage);
                            this.updateApiUsagePanelVisibility(settings.mapLanguage);
                        }
                    }
                }
            }
            
            if (settings.radius) {
                const radiusEl = document.getElementById('radius');
                const radiusValueEl = document.getElementById('radiusValue');
                if (radiusEl && radiusValueEl) {
                    const radius = Math.max(1, Math.min(10, parseInt(settings.radius) || 1));
                    radiusEl.value = radius;
                    radiusValueEl.textContent = radius;
                }
            }
            
            if (settings.blur) {
                const blurEl = document.getElementById('blur');
                const blurValueEl = document.getElementById('blurValue');
                if (blurEl && blurValueEl) {
                    const blur = Math.max(1, Math.min(20, parseInt(settings.blur) || 1));
                    blurEl.value = blur;
                    blurValueEl.textContent = blur;
                }
            }
            
            if (settings.opacity) {
                const opacityEl = document.getElementById('opacity');
                const opacityValueEl = document.getElementById('opacityValue');
                if (opacityEl && opacityValueEl) {
                    const opacity = Math.max(0.1, Math.min(1.0, parseFloat(settings.opacity) || 0.8));
                    opacityEl.value = opacity;
                    opacityValueEl.textContent = opacity;
                }
            }
            
            if (settings.dateRange) {
                const dateRangeEl = document.getElementById('dateRange');
                if (dateRangeEl && ['30', '90', '180', '365', '0'].includes(settings.dateRange)) {
                    dateRangeEl.value = settings.dateRange;
                }
            }
        } catch (error) {
            console.warn('加载设置失败:', error);
        }
    }

    /**
     * 生成热力图
     */
    async generateHeatmap() {
        if (this.loadedTracks.length === 0) {
            this.showMessage('请先上传轨迹记录GPX', 'warning');
            return;
        }

        this.showLoading(true, '正在生成热力图...');
        
        try {
            // 获取日期过滤参数
            const dateRange = parseInt(document.getElementById('dateRange').value);
            
            // 对每个轨迹段分别处理，保持轨迹边界，避免在不同轨迹之间插值
            const maxPoints = 50000; // 最大点数限制
            const finalPoints = await this.processTracksAsync(this.loadedTracks, dateRange, maxPoints);
            
            if (finalPoints.length === 0) {
                this.showMessage('在指定时间范围内没有找到轨迹点', 'warning');
                return;
            }
            
            // 更新热力图参数
            this.updateHeatmapParameters();
            
            // 渲染热力图
            this.heatmapRenderer.renderHeatmap(finalPoints);
            
            // 启用导出按钮
            document.getElementById('exportBtn').disabled = false;
            
            this.showMessage(`热力图生成成功！显示 ${finalPoints.length.toLocaleString()} 个轨迹点`, 'success');
            
            // 移动端自动滚动到地图
            const isMobile = this.heatmapRenderer.isMobileDevice();
            if (isMobile) {
                // 等待一小段时间确保地图渲染完成
                setTimeout(() => {
                    const mapContainer = document.querySelector('.map-container') || document.getElementById('map');
                    if (mapContainer) {
                        mapContainer.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start',
                            inline: 'nearest'
                        });
                    }
                }, 300);
            }
            
        } catch (error) {
            console.error('生成热力图时出错:', error);
            this.showMessage('生成热力图时出错: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 异步处理所有轨迹段，保持轨迹边界，避免在不同轨迹之间插值
     * @param {Array} tracks - 轨迹数组
     * @param {number} dateRange - 日期范围（天数）
     * @param {number} maxPoints - 最大点数限制
     * @returns {Promise<Array>} 处理后的轨迹点数组
     */
    async processTracksAsync(tracks, dateRange, maxPoints) {
        return new Promise((resolve) => {
            const finalPoints = [];
            const cutoffDate = dateRange > 0 ? new Date() : null;
            if (cutoffDate) {
                cutoffDate.setDate(cutoffDate.getDate() - dateRange);
            }
            const cutoffTime = cutoffDate ? cutoffDate.getTime() : null;
            let totalBeforeSampling = 0;
            let totalAfterSampling = 0;
            let trackIndex = 0;
            
            // 使用异步处理，避免阻塞UI
            const processNextTrack = () => {
                if (trackIndex >= tracks.length) {
                    // 所有轨迹处理完成
                    if (totalBeforeSampling > maxPoints) {
                        this.showMessage(`为了性能优化，已使用Douglas-Peucker算法将 ${totalBeforeSampling.toLocaleString()} 个点优化为 ${totalAfterSampling.toLocaleString()} 个点，保持轨迹形状`, 'info');
                    }
                    resolve(finalPoints);
                    return;
                }
                
                const track = tracks[trackIndex];
                
                // 更新进度提示
                if (tracks.length > 1) {
                    this.showLoading(true, `正在处理轨迹 ${trackIndex + 1}/${tracks.length}...`);
                }
                
                // 根据日期范围过滤当前轨迹的点
                const filteredTrackPoints = track.points
                    .filter(point => {
                        if (cutoffTime === null) return true;
                        if (point.timestamp && point.timestamp >= cutoffTime) return true;
                        if (!point.timestamp) return true; // 没有时间戳的点包含在内
                        return false;
                    })
                    .map(point => [point.lat, point.lon]);
                
                if (filteredTrackPoints.length > 0) {
                    totalBeforeSampling += filteredTrackPoints.length;
                    
                    // 对当前轨迹段进行采样（如果需要）
                    let sampledPoints = filteredTrackPoints;
                    if (filteredTrackPoints.length > maxPoints / tracks.length) {
                        // 为每个轨迹段分配合理的点数配额
                        const trackMaxPoints = Math.max(1000, Math.floor(maxPoints / tracks.length));
                        sampledPoints = this.samplePoints(filteredTrackPoints, trackMaxPoints);
                    }
                    
                    totalAfterSampling += sampledPoints.length;
                    
                    // 对当前轨迹段进行插值（只在轨迹段内部插值，不跨轨迹段）
                    const interpolatedPoints = this.interpolateTrackPoints([{ points: sampledPoints }], 0.0005);
                    
                    // 将当前轨迹段的点添加到最终数组
                    finalPoints.push(...interpolatedPoints);
                }
                
                trackIndex++;
                
                // 使用setTimeout让出控制权，避免阻塞UI
                setTimeout(processNextTrack, 0);
            };
            
            // 开始处理
            processNextTrack();
        });
    }

    /**
     * 异步过滤轨迹点，避免阻塞UI
     * @param {Array} tracks - 轨迹数组
     * @param {number} days - 天数
     * @returns {Promise<Array>} 过滤后的轨迹点
     */
    async filterPointsAsync(tracks, days) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const filteredPoints = this.gpxParser.filterByDateRange(tracks, days);
                resolve(filteredPoints);
            }, 0);
        });
    }

    /**
     * 计算两点之间的距离（Haversine公式，用于地理坐标）
     * @param {Array} point1 - [lat, lon]
     * @param {Array} point2 - [lat, lon]
     * @returns {number} 距离（米）
     */
    calculateDistance(point1, point2) {
        const R = 6371000; // 地球半径（米）
        const lat1 = point1[0] * Math.PI / 180;
        const lat2 = point2[0] * Math.PI / 180;
        const deltaLat = (point2[0] - point1[0]) * Math.PI / 180;
        const deltaLon = (point2[1] - point1[1]) * Math.PI / 180;
        
        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c;
    }

    /**
     * 计算点到线段的垂直距离（简化版，用于Douglas-Peucker算法）
     * @param {Array} point - [lat, lon] 要计算距离的点
     * @param {Array} lineStart - [lat, lon] 线段起点
     * @param {Array} lineEnd - [lat, lon] 线段终点
     * @returns {number} 垂直距离（度）
     */
    perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd[1] - lineStart[1];
        const dy = lineEnd[0] - lineStart[0];
        
        if (dx === 0 && dy === 0) {
            // 起点和终点相同，计算到点的距离
            return Math.sqrt(
                Math.pow(point[1] - lineStart[1], 2) +
                Math.pow(point[0] - lineStart[0], 2)
            );
        }
        
        // 计算点到直线的距离
        const numerator = Math.abs(
            dy * point[1] - dx * point[0] +
            lineEnd[1] * lineStart[0] - lineEnd[0] * lineStart[1]
        );
        const denominator = Math.sqrt(dx * dx + dy * dy);
        
        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * Douglas-Peucker算法简化轨迹
     * @param {Array} points - 原始轨迹点 [[lat, lon], ...]
     * @param {number} tolerance - 容差（度），值越小保留的点越多
     * @returns {Array} 简化后的轨迹点
     */
    simplifyTrack(points, tolerance = 0.0001) {
        if (points.length <= 2) {
            return points;
        }
        
        // 找到距离起点和终点连线最远的点
        let maxDistance = 0;
        let maxIndex = 0;
        const end = points.length - 1;
        
        for (let i = 1; i < end; i++) {
            const distance = this.perpendicularDistance(
                points[i],
                points[0],
                points[end]
            );
            
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }
        
        // 如果最远点距离大于容差，递归简化
        if (maxDistance > tolerance) {
            const left = this.simplifyTrack(points.slice(0, maxIndex + 1), tolerance);
            const right = this.simplifyTrack(points.slice(maxIndex), tolerance);
            
            // 合并结果，去除重复的中间点
            return left.slice(0, -1).concat(right);
        } else {
            // 所有点都在容差范围内，只保留起点和终点
            return [points[0], points[end]];
        }
    }

    /**
     * 在轨迹点之间进行线性插值，确保连续性
     * 只在同一轨迹段内的点之间插值，不在不同轨迹段之间插值
     * @param {Array} tracks - 轨迹数组，每个轨迹包含points数组
     * @param {number} maxDistance - 最大距离阈值（度），超过此距离的点对之间会插值
     * @returns {Array} 插值后的轨迹点 [[lat, lon], ...]
     */
    interpolateTrackPoints(tracks, maxDistance = 0.0005) {
        if (!tracks || tracks.length === 0) {
            return [];
        }
        
        const allInterpolatedPoints = [];
        
        // 对每个轨迹段分别进行插值
        for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
            const track = tracks[trackIndex];
            const points = track.points || track; // 兼容两种数据结构
            
            if (!points || points.length < 2) {
                // 如果轨迹点少于2个，直接添加（如果有的话）
                if (points && points.length === 1) {
                    allInterpolatedPoints.push(points[0]);
                }
                continue;
            }
            
            // 在当前轨迹段内进行插值
            const interpolatedPoints = [points[0]]; // 保留第一个点
            
            for (let i = 1; i < points.length; i++) {
                const prevPoint = points[i - 1];
                const currPoint = points[i];
                
                // 确保点是数组格式 [lat, lon]
                const prev = Array.isArray(prevPoint) ? prevPoint : [prevPoint.lat, prevPoint.lon];
                const curr = Array.isArray(currPoint) ? currPoint : [currPoint.lat, currPoint.lon];
                
                // 计算两点间的距离（度）
                const latDiff = curr[0] - prev[0];
                const lonDiff = curr[1] - prev[1];
                const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
                
                // 如果距离超过阈值，进行插值
                if (distance > maxDistance) {
                    // 计算需要插入的点数
                    const numInterpolated = Math.ceil(distance / maxDistance);
                    
                    // 在两点之间插入中间点
                    for (let j = 1; j <= numInterpolated; j++) {
                        const ratio = j / (numInterpolated + 1);
                        const interpolatedPoint = [
                            prev[0] + latDiff * ratio,
                            prev[1] + lonDiff * ratio
                        ];
                        interpolatedPoints.push(interpolatedPoint);
                    }
                }
                
                // 添加当前点
                interpolatedPoints.push(curr);
            }
            
            // 将当前轨迹段的插值点添加到总数组
            allInterpolatedPoints.push(...interpolatedPoints);
        }
        
        return allInterpolatedPoints;
    }

    /**
     * 对轨迹点进行智能采样，减少数据量
     * 优先使用Douglas-Peucker算法保持轨迹形状，如果还不够则进行均匀采样
     * @param {Array} points - 原始轨迹点 [[lat, lon], ...]
     * @param {number} maxPoints - 最大点数
     * @returns {Array} 采样后的轨迹点
     */
    samplePoints(points, maxPoints) {
        if (points.length <= maxPoints) {
            return points;
        }
        
        // 首先尝试使用Douglas-Peucker算法简化
        // 从较小的容差开始，逐步增大直到点数符合要求
        let tolerance = 0.00001; // 初始容差（约1米）
        let simplified = points;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (simplified.length > maxPoints && attempts < maxAttempts) {
            simplified = this.simplifyTrack(points, tolerance);
            tolerance *= 2; // 增大容差
            attempts++;
        }
        
        // 如果Douglas-Peucker简化后仍然超过最大点数，进行均匀采样
        if (simplified.length > maxPoints) {
            const sampledPoints = [];
            const step = simplified.length / maxPoints;
            
            for (let i = 0; i < simplified.length; i += step) {
                sampledPoints.push(simplified[Math.floor(i)]);
            }
            
            return sampledPoints;
        }
        
        return simplified;
    }

    /**
     * 更新热力图参数
     */
    updateHeatmapParameters() {
        const radius = parseInt(document.getElementById('radius').value);
        const blur = parseInt(document.getElementById('blur').value);
        const opacity = parseFloat(document.getElementById('opacity').value);
        
        this.heatmapRenderer.updateHeatmapOptions({
            radius: radius,
            blur: blur,
            minOpacity: opacity
        });
    }

    /**
     * 根据日期过滤更新热力图
     */
    updateHeatmapWithDateFilter() {
        if (this.loadedTracks.length === 0) return;
        
        const dateRange = parseInt(document.getElementById('dateRange').value);
        const filteredPoints = this.gpxParser.filterByDateRange(this.loadedTracks, dateRange);
        
        if (filteredPoints.length > 0) {
            this.heatmapRenderer.renderHeatmap(filteredPoints);
        } else {
            this.heatmapRenderer.clearHeatmap();
            this.showMessage('在指定时间范围内没有找到轨迹点', 'warning');
        }
    }

    /**
     * 导出地图
     */
    async exportMap() {
        if (!this.heatmapRenderer.heatLayer) {
            this.showMessage('请先生成热力图再导出', 'warning');
            return;
        }

        try {
            // 检测是否为移动设备（复用heatmapRenderer的方法）
            const isMobile = this.heatmapRenderer.isMobileDevice();
            
            // PC端：完全使用原有逻辑（保持不变）
            if (!isMobile) {
                this.showLoading(true, '正在导出热力图...');
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const totalTimeout = 20000;
                const exportPromise = this.heatmapRenderer.exportAndDownload(undefined, false);
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('EXPORT_TIMEOUT')), totalTimeout);
                });
                
                await Promise.race([exportPromise, timeoutPromise]);
                this.showMessage('热力图导出成功！', 'success');
                return;
            }
            
            // 移动端：新的导出流程（优先Web Share API，保持高质量）
            this.showLoading(true, '正在生成高质量图片...');
            
            // 确保地图完全渲染
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 生成时间戳文件名
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `cycling-heatmap-${timestamp}.png`;
            
            // 生成高质量图片（scale=1.0，不使用fastMode）
            this.showLoading(true, '正在导出热力图（高质量）...');
            const totalTimeout = 25000; // 移动端高质量导出可能需要更长时间
            const exportPromise = this.heatmapRenderer.exportMapAsImage(false, 0);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('EXPORT_TIMEOUT')), totalTimeout);
            });
            
            const dataURL = await Promise.race([exportPromise, timeoutPromise]);
            
            // 尝试Web Share API（优先）
            this.showLoading(true, '正在准备分享...');
            const shared = await this.heatmapRenderer.shareImageWithWebShare(dataURL, filename);
            
            if (shared) {
                this.showMessage('热力图已分享，请选择保存到相册', 'success');
                return;
            }
            
            // Web Share API不支持或失败，降级到下载
            this.showLoading(true, '正在保存图片...');
            try {
                this.heatmapRenderer.downloadImage(dataURL, filename);
                this.showMessage('热力图已打开，请长按图片保存到相册', 'success');
            } catch (downloadError) {
                // 下载也失败，显示模态框
                console.warn('下载失败，显示图片模态框:', downloadError);
                this.heatmapRenderer.showImageInModal(dataURL, filename, '长按图片保存到相册');
                this.showMessage('图片已显示，请长按保存', 'success');
            }
            
        } catch (error) {
            console.error('导出地图时出错:', error);
            const isMobile = this.heatmapRenderer.isMobileDevice();
            const errorMsg = error.message || '';
            
            // 移动端失败时显示截屏指南或图片模态框
            if (isMobile) {
                if (errorMsg === 'EXPORT_TIMEOUT' || errorMsg === 'EXPORT_FAILED_MOBILE' || errorMsg.includes('超时') || errorMsg.includes('失败')) {
                    // 如果已经生成了图片，尝试显示
                    try {
                        // 这里无法获取dataURL，所以显示截屏指南
                        this.showScreenshotGuide();
                        this.showMessage('导出超时，已显示截屏指南', 'error');
                    } catch (e) {
                        this.showScreenshotGuide();
                        this.showMessage('导出失败，已显示截屏指南', 'error');
                    }
                } else {
                    this.showMessage('导出失败: ' + (errorMsg || '未知错误'), 'error');
                }
            } else {
                // PC端错误处理（保持不变）
                const displayMsg = errorMsg === 'EXPORT_TIMEOUT' ? '导出超时，请稍后重试' : (errorMsg || '导出失败，请重试');
                this.showMessage('导出地图时出错: ' + displayMsg, 'error');
            }
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 显示截屏指南
     */
    showScreenshotGuide() {
        const modal = document.getElementById('screenshotGuideModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    /**
     * 关闭截屏指南
     */
    closeScreenshotGuide() {
        const modal = document.getElementById('screenshotGuideModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 显示移动端文件选择帮助
     */
    showMobileFileHelp() {
        const modal = document.getElementById('mobileFileHelpModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    /**
     * 关闭移动端文件选择帮助
     */
    closeMobileFileHelp() {
        const modal = document.getElementById('mobileFileHelpModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 检测全屏API支持
     * @param {HTMLElement} fullscreenBtn - 全屏按钮元素
     */
    checkFullscreenSupport(fullscreenBtn) {
        if (!fullscreenBtn) return;
        
        // 检测是否支持全屏API
        const element = document.documentElement;
        const hasFullscreenSupport = !!(
            element.requestFullscreen ||
            element.webkitRequestFullscreen ||
            element.mozRequestFullScreen ||
            element.msRequestFullscreen
        );
        
        // 如果不支持全屏API，隐藏按钮
        if (!hasFullscreenSupport) {
            fullscreenBtn.style.display = 'none';
        }
    }

    /**
     * 进入全屏模式
     */
    enterFullscreen() {
        this.heatmapRenderer.enterFullscreen();
    }

    /**
     * 显示加载状态
     */
    showLoading(show, text = '正在处理...') {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        const progressFill = document.getElementById('progressFill');
        
        if (show) {
            loadingText.textContent = text;
            progressFill.style.width = '0%';
            loadingOverlay.style.display = 'flex';
        } else {
            loadingOverlay.style.display = 'none';
        }
    }

    /**
     * 显示消息
     */
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;
        
        // 添加样式
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 400px;
            word-wrap: break-word;
            animation: slideInRight 0.3s ease;
        `;
        
        // 设置背景色
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        messageDiv.style.backgroundColor = colors[type] || colors.info;
        
        // 添加到页面
        document.body.appendChild(messageDiv);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    messageDiv.remove();
                }, 300);
            }
        }, 3000);
        
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    /**
     * 更新API使用量面板的显示状态
     * @param {string} mapLanguage - 地图语言类型
     */
    updateApiUsagePanelVisibility(mapLanguage) {
        const apiUsagePanel = document.getElementById('apiUsagePanel');
        if (!apiUsagePanel) return;
        
        // 只有使用天地图时才显示API使用量面板
        if (mapLanguage === 'zh-vector' || mapLanguage === 'zh-satellite') {
            apiUsagePanel.style.display = 'block';
        } else {
            apiUsagePanel.style.display = 'none';
        }
    }

    /**
     * 显示API密钥提示模态框
     */
    showApiKeyPrompt() {
        const promptModal = document.getElementById('apiKeyPromptModal');
        if (promptModal) {
            promptModal.style.display = 'flex';
        }
    }

    /**
     * 关闭API密钥提示模态框
     */
    closeApiKeyPrompt() {
        const promptModal = document.getElementById('apiKeyPromptModal');
        if (promptModal) {
            promptModal.style.display = 'none';
        }
    }

    /**
     * 显示API密钥配置模态框
     */
    showApiKeyConfig() {
        const configModal = document.getElementById('apiKeyConfigModal');
        const apiKeyInput = document.getElementById('apiKeyInput');
        
        if (configModal && apiKeyInput) {
            // 加载已保存的密钥（如果有）
            const savedKey = MAP_CONFIG.getApiKey();
            apiKeyInput.value = savedKey;
            configModal.style.display = 'flex';
        }
    }

    /**
     * 关闭API密钥配置模态框
     */
    closeApiKeyConfig() {
        const configModal = document.getElementById('apiKeyConfigModal');
        if (configModal) {
            configModal.style.display = 'none';
        }
    }

    /**
     * 保存API密钥
     */
    saveApiKey() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        if (!apiKeyInput) return;

        const apiKey = apiKeyInput.value.trim();
        
        if (apiKey) {
            MAP_CONFIG.setApiKey(apiKey);
            this.showMessage('API密钥已保存！', 'success');
            this.closeApiKeyConfig();
            
            // 如果当前选择的是中文地图，重新加载地图
            const currentLanguage = document.getElementById('mapLanguage').value;
            if (currentLanguage === 'zh-vector' || currentLanguage === 'zh-satellite') {
                this.heatmapRenderer.setMapLanguage(currentLanguage);
            }
        } else {
            // 清除密钥
            MAP_CONFIG.setApiKey('');
            this.showMessage('API密钥已清除', 'info');
            this.closeApiKeyConfig();
        }
    }

    /**
     * 生成自动设置书签（包含密钥）
     */
    generateBookmarklet() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        if (!apiKeyInput) return;

        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            this.showMessage('请先输入API密钥', 'warning');
            return;
        }

        // 创建书签JavaScript代码
        // 使用Base64编码密钥，避免URL特殊字符问题
        const encodedKey = btoa(apiKey);
        const bookmarkletCode = `javascript:(function(){try{const key=atob('${encodedKey}');if(typeof MAP_CONFIG!=='undefined'){MAP_CONFIG.setApiKey(key);alert('✅ API密钥已设置！\\n\\n页面将自动刷新以应用更改。');location.reload();}else{localStorage.setItem('tianditu_api_key',key);alert('✅ API密钥已保存！\\n\\n请刷新页面。');location.reload();}}catch(e){alert('❌ 设置失败：'+e.message);}})();`;

        // 显示书签链接
        const bookmarkletContainer = document.getElementById('bookmarkletContainer');
        const bookmarkletLink = document.getElementById('bookmarkletLink');
        
        if (bookmarkletContainer && bookmarkletLink) {
            bookmarkletLink.href = bookmarkletCode;
            bookmarkletLink.textContent = '🔑 设置API密钥';
            bookmarkletContainer.style.display = 'block';
            
            // 滚动到书签区域
            bookmarkletContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            this.showMessage('✅ 自动设置书签已生成！请拖拽链接到浏览器书签栏', 'success');
        }
    }

    /**
     * 显示输入式书签（弹出输入框）
     */
    showInputBookmarklet() {
        // 输入式书签代码（不包含密钥，点击后弹出输入框）
        const inputBookmarkletCode = `javascript:(function(){const key=prompt('请输入天地图API密钥：','');if(key&&key.trim()){if(typeof MAP_CONFIG!=='undefined'){MAP_CONFIG.setApiKey(key.trim());alert('✅ API密钥已设置！\\n\\n页面将自动刷新以应用更改。');location.reload();}else{localStorage.setItem('tianditu_api_key',key.trim());alert('✅ API密钥已保存！\\n\\n请刷新页面。');location.reload();}}else if(key!==null){alert('❌ 密钥不能为空');}})();`;

        // 创建临时模态框显示书签
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'display: flex; z-index: 3000;';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                <h2>📝 输入式书签</h2>
                <div style="padding: 10px 0;">
                    <p style="margin-bottom: 15px; line-height: 1.6; color: #6c757d;">
                        这个书签不包含密钥，点击后会弹出输入框让您输入密钥。更安全，但需要每次输入。
                    </p>
                    <div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 15px; border: 1px solid #dee2e6;">
                        <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: #6c757d; font-weight: 600;">📌 拖拽下面的链接到浏览器书签栏：</p>
                        <a href="${inputBookmarkletCode}" 
                           style="display: inline-block; padding: 8px 12px; background: #17a2b8; color: white; text-decoration: none; border-radius: 4px; font-size: 0.85rem; cursor: move;">
                            📝 输入API密钥
                        </a>
                    </div>
                    <button class="upload-btn" onclick="this.closest('.modal').remove()" style="width: 100%;">
                        关闭
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 点击外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * 从URL参数设置API密钥（用于书签）
     */
    setApiKeyFromBookmarklet() {
        // 检查URL中是否有密钥参数
        const urlParams = new URLSearchParams(window.location.search);
        const keyParam = urlParams.get('apikey');
        
        if (keyParam) {
            try {
                // 如果是Base64编码的，尝试解码
                const decodedKey = atob(keyParam);
                if (decodedKey && decodedKey.length > 0) {
                    MAP_CONFIG.setApiKey(decodedKey);
                    // 移除URL参数，保护隐私
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return true;
                }
            } catch (e) {
                // 如果不是Base64，直接使用
                MAP_CONFIG.setApiKey(keyParam);
                window.history.replaceState({}, document.title, window.location.pathname);
                return true;
            }
        }
        
        return false;
    }

    /**
     * 更新UI状态
     */
    updateUI() {
        // 初始状态下禁用生成和导出按钮
        document.getElementById('generateBtn').disabled = true;
        document.getElementById('exportBtn').disabled = true;
        
        // 隐藏文件列表和统计信息
        document.getElementById('fileList').style.display = 'none';
        document.getElementById('statsSection').style.display = 'none';
        
        // 初始化API使用量面板显示状态
        const mapLanguageSelect = document.getElementById('mapLanguage');
        if (mapLanguageSelect) {
            this.updateApiUsagePanelVisibility(mapLanguageSelect.value);
        }
    }
}

// 帮助模态框相关函数
function showHelp() {
    console.log('showHelp() called - showing help modal');
    document.getElementById('helpModal').style.display = 'flex';
}

function closeHelp() {
    console.log('closeHelp() called - closing help modal');
    document.getElementById('helpModal').style.display = 'none';
}

// GPX指南模态框相关函数
function showGpxGuide() {
    console.log('showGpxGuide() called - showing GPX guide modal');
    document.getElementById('gpxGuideModal').style.display = 'flex';
}

function closeGpxGuide() {
    console.log('closeGpxGuide() called - closing GPX guide modal');
    document.getElementById('gpxGuideModal').style.display = 'none';
}

// 搜索过滤功能
function filterGuide() {
    const searchTerm = document.getElementById('guideSearch').value.toLowerCase();
    const sections = document.querySelectorAll('.guide-section');
    const deviceItems = document.querySelectorAll('.device-item');
    
    // 如果搜索框为空，显示所有内容
    if (searchTerm === '') {
        sections.forEach(section => {
            section.classList.remove('hidden');
        });
        deviceItems.forEach(item => {
            item.classList.remove('hidden');
        });
        return;
    }
    
    // 搜索匹配
    sections.forEach(section => {
        const keywords = section.getAttribute('data-keywords') || '';
        const textContent = section.textContent.toLowerCase();
        
        if (keywords.toLowerCase().includes(searchTerm) || textContent.includes(searchTerm)) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    });
    
    // 搜索设备项
    deviceItems.forEach(item => {
        const textContent = item.textContent.toLowerCase();
        const parentSection = item.closest('.guide-section');
        
        if (textContent.includes(searchTerm)) {
            item.classList.remove('hidden');
            // 如果设备项匹配，确保父级section也显示
            if (parentSection) {
                parentSection.classList.remove('hidden');
            }
        } else {
            item.classList.add('hidden');
        }
    });
}

// 捐赠模态框相关函数
function showDonate() {
    console.log('showDonate() called - showing donate modal');
    document.getElementById('donateModal').style.display = 'flex';
}

function closeDonate() {
    console.log('closeDonate() called - closing donate modal');
    document.getElementById('donateModal').style.display = 'none';
}

// 点击模态框外部关闭
window.addEventListener('click', (e) => {
    const helpModal = document.getElementById('helpModal');
    const gpxGuideModal = document.getElementById('gpxGuideModal');
    const donateModal = document.getElementById('donateModal');
    const apiKeyPromptModal = document.getElementById('apiKeyPromptModal');
    const apiKeyConfigModal = document.getElementById('apiKeyConfigModal');
    
    if (e.target === helpModal) {
        closeHelp();
    }
    
    if (e.target === gpxGuideModal) {
        closeGpxGuide();
    }
    
    if (e.target === donateModal) {
        closeDonate();
    }
    
    if (e.target === apiKeyPromptModal && window.app) {
        window.app.closeApiKeyPrompt();
    }
    
    if (e.target === apiKeyConfigModal && window.app) {
        window.app.closeApiKeyConfig();
    }
});

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CyclingHeatmapApp();
});

// 导出应用类
window.CyclingHeatmapApp = CyclingHeatmapApp;
