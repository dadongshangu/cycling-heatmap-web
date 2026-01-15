/**
 * Main Application - 运动轨迹热力图生成器主程序
 */

class CyclingHeatmapApp {
    constructor() {
        this.gpxParser = new GPXParser();
        this.fitParser = new FITParser();
        this.heatmapRenderer = null;
        this.loadedTracks = [];
        this.isProcessing = false;
        this.startTime = null; // 用于计算处理时间
        this.videoGenerator = null; // 视频生成器（延迟初始化）
        
        // 缓存常用 DOM 元素
        this.domElements = {};
        this.cacheDOMElements();
        
        this.initializeApp();
    }
    
    /**
     * 缓存常用的 DOM 元素
     */
    cacheDOMElements() {
        const elementIds = [
            'fileInput', 'selectFileBtn', 'clearFilesBtn', 'generateBtn', 
            'exportBtn', 'fullscreenBtn', 'generateVideoBtn', 'dateRange', 'mapStyle', 
            'mapLanguage', 'radius', 'blur', 'opacity', 'fileList',
            'loadingOverlay', 'loadingText', 'progressFill', 'apiUsagePanel'
        ];
        this.domElements = domCache.getElements(elementIds);
    }
    
    /**
     * 获取 DOM 元素（带缓存）
     * @param {string} id - 元素 ID
     * @returns {HTMLElement|null}
     */
    getElement(id) {
        if (this.domElements[id]) {
            return this.domElements[id];
        }
        const element = domCache.getElement(id);
        if (element) {
            this.domElements[id] = element;
        }
        return element;
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
        
        logger.info('🚴 Cycling Heatmap Generator 已启动');
    }

    /**
     * 初始化全局错误处理
     */
    initErrorHandling() {
        // 捕获全局JavaScript错误
        window.addEventListener('error', (event) => {
            // 忽略某些已知的、不影响功能的错误
            const errorMessage = event.error?.message || event.message || '';
            const errorSource = event.filename || '';
            
            // 忽略浏览器跟踪防护警告（不影响功能）
            if (errorMessage.includes('Tracking Prevention') || 
                errorMessage.includes('blocked access to storage')) {
                // 这些警告不影响功能，静默忽略
                return;
            }
            
            // 忽略 leaflet-heat 库中的某些内部错误（如果图层正在更新）
            if (errorSource.includes('leaflet-heat') && 
                (errorMessage.includes('getSize') || errorMessage.includes('null'))) {
                logger.warn('Ignored leaflet-heat internal error during layer update:', errorMessage);
                return;
            }
            
            logger.error('Global JavaScript error:', event.error || event.message);
            this.logError('JavaScript Error', {
                message: errorMessage,
                stack: event.error?.stack || '',
                filename: errorSource,
                lineno: event.lineno,
                colno: event.colno
            });
            
            // 显示用户友好的错误提示（仅对严重错误）
            if (event.error && event.error.message && 
                !errorMessage.includes('getSize') && 
                !errorMessage.includes('leaflet-heat')) {
                this.showMessage('发生了一个错误，请刷新页面重试', 'error');
            }
        });
        
        // 捕获未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            logger.error('Unhandled promise rejection:', event.reason);
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
            logger.error(`[ErrorHandler] ${type}:`, errorLog);
        }
        
        // 可以在这里添加错误上报逻辑（如发送到错误监控服务）
        // 例如：if (window.Sentry) { window.Sentry.captureException(error); }
    }

    /**
     * 配置文件输入 - PC端保留GPX筛选，移动端移除限制
     */
    configureFileInput() {
        const fileInput = this.getElement('fileInput');
        if (!fileInput) return;
        
        // 检测是否为移动设备
        const isMobile = this.isMobileDevice();
        
        if (isMobile) {
            // 移动端：移除 accept 限制，避免文件显示为灰色
            fileInput.removeAttribute('accept');
        } else {
            // PC端：保留文件筛选，支持 GPX 和 FIT 格式，方便用户选择
            fileInput.setAttribute('accept', '.gpx,.GPX,.fit,.FIT');
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        // 文件上传相关
        const uploadArea = this.getElement('uploadArea');
        const fileInput = this.getElement('fileInput');
        const selectFileBtn = this.getElement('selectFileBtn');
        const clearFilesBtn = this.getElement('clearFiles');

        // 检查必需元素是否存在
        if (!uploadArea || !fileInput) {
            logger.error('必需的上传元素未找到');
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
        const generateBtn = this.getElement('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', this.generateHeatmap.bind(this));
        }

        // 地图控制按钮
        const exportBtn = this.getElement('exportBtn');
        const fullscreenBtn = this.getElement('fullscreenBtn');
        const generateVideoBtn = this.getElement('generateVideoBtn');
        const checkVideoBtn = this.getElement('checkVideoBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', this.exportMap.bind(this));
        }
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', this.enterFullscreen.bind(this));
        }
        if (generateVideoBtn) {
            generateVideoBtn.addEventListener('click', this.showVideoConfigModal.bind(this));
        }
        if (checkVideoBtn) {
            checkVideoBtn.addEventListener('click', this.checkCompletedVideos.bind(this));
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
                const fileInput = this.getElement('fileInput');
                if (fileInput) {
                    fileInput.click();
                }
            }
            
            // Ctrl/Cmd + G: 生成热力图
            if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
                e.preventDefault();
                const generateBtn = this.getElement('generateBtn');
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
        const mapStyleSelect = this.getElement('mapStyle');
        if (!mapStyleSelect) {
            logger.error('mapStyle元素未找到');
            return;
        }
        mapStyleSelect.addEventListener('change', (e) => {
            this.heatmapRenderer.setMapStyle(e.target.value);
            this.saveSettings(); // 保存设置
        });

        // 地图语言
        const mapLanguageSelect = this.getElement('mapLanguage');
        if (!mapLanguageSelect) {
            logger.error('mapLanguage元素未找到');
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
                const mapLanguageEl = this.getElement('mapLanguage');
                if (mapLanguageEl) mapLanguageEl.value = 'en';
                this.heatmapRenderer.setMapLanguage('en');
                this.updateApiUsagePanelVisibility('en');
            }
        });

        // 滑块控件 - 使用防抖优化性能
        const controls = ['radius', 'blur', 'opacity'];
        controls.forEach(control => {
            const slider = this.getElement(control);
            const valueDisplay = this.getElement(control + 'Value');
            
            if (!slider || !valueDisplay) {
                logger.warn(`参数控件 ${control} 未找到`);
                return;
            }
            
            // 立即更新显示值（无延迟）
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                valueDisplay.textContent = value;
            });
            
            // 防抖更新热力图
            const debouncedUpdate = this.debounce(() => {
                if (this.loadedTracks.length > 0 && this.heatmapRenderer) {
                    this.updateHeatmapParameters();
                }
                this.saveSettings(); // 保存设置
            }, APP_CONFIG.DELAY.DEBOUNCE_LONG);
            
            slider.addEventListener('change', debouncedUpdate);
        });

        // 日期范围
        const dateRangeSelect = this.getElement('dateRange');
        if (!dateRangeSelect) {
            logger.error('dateRange元素未找到');
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
        const uploadArea = this.getElement('uploadArea');
        if (uploadArea) uploadArea.classList.add('dragover');
    }

    /**
     * 处理拖拽离开
     */
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = this.getElement('uploadArea');
        if (uploadArea) uploadArea.classList.remove('dragover');
    }

    /**
     * 处理文件拖拽放置
     */
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = this.getElement('uploadArea');
        if (uploadArea) uploadArea.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files).filter(file => {
            const name = file.name.toLowerCase();
            const ext = name.split('.').pop();
            // 支持 .gpx 和 .fit 格式
            return ext === 'gpx' || ext === 'fit';
        });
        
        if (files.length > 0) {
            this.processFiles(files);
        } else {
            this.showMessage('请选择轨迹记录文件（GPX 或 FIT 格式）', 'warning');
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
     * 验证文件大小
     * @param {FileList|Array} files - 文件列表
     * @returns {Object} 验证结果 { validFiles, oversizedFiles, error }
     */
    validateFileSizes(files) {
        const MAX_FILE_SIZE = APP_CONFIG.FILE_SIZE.MAX_SINGLE;
        const MAX_TOTAL_SIZE = APP_CONFIG.FILE_SIZE.MAX_TOTAL;
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
        let error = null;
        if (validFiles.length > 0) {
            const totalSize = validFiles.reduce((sum, file) => sum + file.size, 0);
            if (totalSize > MAX_TOTAL_SIZE) {
                error = `文件总大小超过限制（${(MAX_TOTAL_SIZE / (1024 * 1024)).toFixed(0)}MB），请分批上传`;
            }
        }
        
        return {
            validFiles,
            oversizedFiles,
            error
        };
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
        const supportedFiles = allFiles.filter(file => {
            const name = file.name.toLowerCase();
            const ext = name.split('.').pop();
            // 支持 .gpx 和 .fit 格式
            return ext === 'gpx' || ext === 'fit';
        });
        
        // 如果有不支持的文件，给出提示
        if (supportedFiles.length === 0 && allFiles.length > 0) {
            this.showMessage('请选择轨迹记录文件（.gpx 或 .fit 格式）', 'warning');
            return;
        }
        
        // 检查文件可读性（特别是移动端）
        const isMobile = this.isMobileDevice();
        if (isMobile && supportedFiles.length > 0) {
            this.showMessage('正在检查文件...', 'info');
            
            const readabilityResults = await Promise.all(
                supportedFiles.map(file => this.checkFileReadability(file))
            );
            
            const readableFiles = [];
            const unreadableFiles = [];
            
            supportedFiles.forEach((file, index) => {
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
            this.processFiles(supportedFiles);
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

        // 文件大小验证（使用统一的方法）
        const validation = this.validateFileSizes(files);
        
        if (validation.error) {
            this.showMessage(validation.error, 'error');
            return;
        }
        
        if (validation.oversizedFiles.length > 0) {
            const fileList = validation.oversizedFiles.map(f => `${f.name} (${f.size})`).join(', ');
            const maxSizeMB = (APP_CONFIG.FILE_SIZE.MAX_SINGLE / (1024 * 1024)).toFixed(0);
            this.showMessage(
                `${validation.oversizedFiles.length} 个文件超过大小限制（${maxSizeMB}MB）：${fileList}。已跳过这些文件。`,
                'warning'
            );
        }
        
        if (validation.validFiles.length === 0) {
            this.showMessage('没有有效的文件可以处理', 'error');
            return;
        }
        
        const validFiles = validation.validFiles;

        // 记录开始时间，用于估算剩余时间
        this.startTime = Date.now();
        this.isProcessing = true;
        this.showLoading(true);
        
        try {
            // 根据文件扩展名分组
            const gpxFiles = [];
            const fitFiles = [];
            const unsupportedFiles = [];
            
            validFiles.forEach(file => {
                const name = file.name.toLowerCase();
                const ext = name.split('.').pop();
                if (ext === 'gpx') {
                    gpxFiles.push(file);
                } else if (ext === 'fit') {
                    // 支持 .fit 格式
                    fitFiles.push(file);
                } else {
                    unsupportedFiles.push(file);
                }
            });
            
            if (unsupportedFiles.length > 0) {
                logger.warn('不支持的文件格式:', unsupportedFiles.map(f => f.name));
                this.showMessage(
                    `${unsupportedFiles.length} 个文件格式不支持（仅支持 .gpx 和 .fit 格式）`,
                    'warning'
                );
            }
            
            // 分别解析 GPX 和 FIT 文件
            const allResults = [];
            
            if (gpxFiles.length > 0) {
                const gpxResults = await this.gpxParser.parseFiles(gpxFiles, this.updateProgress.bind(this));
                // 使用循环添加，避免展开操作符导致栈溢出
                for (let i = 0; i < gpxResults.length; i++) {
                    allResults.push(gpxResults[i]);
                }
            }
            
            if (fitFiles.length > 0) {
                // 使用内置的简化版 FIT 解析器（不依赖外部库）
                const fitResults = await this.fitParser.parseFiles(fitFiles, this.updateProgress.bind(this));
                // 使用循环添加，避免展开操作符导致栈溢出
                for (let i = 0; i < fitResults.length; i++) {
                    allResults.push(fitResults[i]);
                }
            }
            
            const results = allResults;
            
            // 过滤成功解析的文件
            const successfulTracks = results.filter(result => !result.error);
            const failedTracks = results.filter(result => result.error);
            
            // 分析失败原因
            const permissionErrors = [];
            const formatErrors = [];
            const libraryErrors = []; // FIT 库加载失败
            const otherErrors = [];
            
            failedTracks.forEach(track => {
                const errorMsg = track.error?.toLowerCase() || '';
                if (errorMsg.includes('permission') || errorMsg.includes('权限') || 
                    errorMsg.includes('无法读取') || errorMsg.includes('read')) {
                    permissionErrors.push(track);
                } else if (errorMsg.includes('fit解析库') || errorMsg.includes('fit 解析库') || 
                          errorMsg.includes('fit-file-parser') || errorMsg.includes('fit解析库未加载')) {
                    libraryErrors.push(track);
                } else if (errorMsg.includes('format') || errorMsg.includes('格式') || 
                          errorMsg.includes('invalid') || errorMsg.includes('parse')) {
                    formatErrors.push(track);
                } else {
                    otherErrors.push(track);
                }
            });
            
            // 如果有 FIT 库加载失败的文件，已经在上面显示过提示了，这里只记录日志
            if (libraryErrors.length > 0) {
                logger.warn(`FIT 库加载失败，影响 ${libraryErrors.length} 个文件`);
            }
            
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
                    this.showMessage('文件格式错误，请确保选择的是有效的GPX或FIT文件', 'error');
                } else {
                    this.showMessage('没有成功解析的文件', 'error');
                }
            }
            
            if (failedTracks.length > 0) {
                logger.warn('解析失败的文件:', failedTracks);
                
                // 如果是移动端且有权限错误，记录日志
                const isMobile = this.isMobileDevice();
                if (permissionErrors.length > 0 && isMobile) {
                    logger.warn('移动端文件权限错误:', permissionErrors);
                }
            }
            
        } catch (error) {
            ErrorHandler.handle(error, 'handleFiles', {
                showMessage: true
            });
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
        const loadingText = this.getElement('loadingText');
        const progressFill = this.getElement('progressFill');
        
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
        const fileList = this.getElement('fileList');
        const fileListItems = this.getElement('fileListItems');
        const fileCountText = this.getElement('fileCountText');
        
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
        // 合并两个解析器的统计信息
        const gpxStats = this.gpxParser.getStatistics();
        const fitStats = this.fitParser.getStatistics();
        
        const combinedStats = {
            totalPoints: gpxStats.totalPoints + fitStats.totalPoints,
            totalDistance: gpxStats.totalDistance + fitStats.totalDistance,
            dateRange: this.combineDateRanges(gpxStats.dateRange, fitStats.dateRange)
        };
        
        const fileCountEl = this.getElement('fileCount');
        const pointCountEl = this.getElement('pointCount');
        const totalDistanceEl = this.getElement('totalDistance');
        
        if (fileCountEl) fileCountEl.textContent = this.loadedTracks.length;
        if (pointCountEl) pointCountEl.textContent = combinedStats.totalPoints.toLocaleString();
        if (totalDistanceEl) totalDistanceEl.textContent = combinedStats.totalDistance + ' km';
        
        // 格式化日期范围文本
        const dateRangeText = this.formatDateRangeText(combinedStats.dateRange);
        const dateRangeTextEl = document.getElementById('dateRangeText');
        if (dateRangeTextEl) dateRangeTextEl.textContent = dateRangeText;
        
        document.getElementById('statsSection').style.display = 'block';
    }

    /**
     * 合并两个日期范围
     * @param {Object} range1 - 第一个日期范围
     * @param {Object} range2 - 第二个日期范围
     * @returns {Object} 合并后的日期范围
     */
    combineDateRanges(range1, range2) {
        const combined = { min: null, max: null };
        
        const dates = [];
        if (range1.min) dates.push(range1.min);
        if (range1.max) dates.push(range1.max);
        if (range2.min) dates.push(range2.min);
        if (range2.max) dates.push(range2.max);
        
        if (dates.length > 0) {
            // 使用循环计算最小最大值，避免展开操作符导致栈溢出
            let minTime = dates[0].getTime();
            let maxTime = dates[0].getTime();
            for (let i = 1; i < dates.length; i++) {
                const time = dates[i].getTime();
                if (time < minTime) minTime = time;
                if (time > maxTime) maxTime = time;
            }
            combined.min = new Date(minTime);
            combined.max = new Date(maxTime);
        }
        
        return combined;
    }

    /**
     * 格式化日期范围文本
     * @param {Object} dateRange - 日期范围对象
     * @returns {string} 格式化的日期范围文本
     */
    formatDateRangeText(dateRange) {
        if (!dateRange.min || !dateRange.max) {
            return '-';
        }

        const formatDate = (date) => {
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        };

        const minStr = formatDate(dateRange.min);
        const maxStr = formatDate(dateRange.max);

        if (minStr === maxStr) {
            return minStr;
        } else {
            return `${minStr} ~ ${maxStr}`;
        }
    }

    /**
     * 启用生成按钮
     */
    enableGenerateButton() {
        const generateBtn = this.getElement('generateBtn');
        if (generateBtn) generateBtn.disabled = false;
    }

    /**
     * 清除所有文件
     */
    clearAllFiles() {
        // 清除数据
        this.loadedTracks = [];
        this.gpxParser.clear();
        this.fitParser.clear();
        
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
        const generateBtn = this.getElement('generateBtn');
        const exportBtn = this.getElement('exportBtn');
        const generateVideoBtn = this.getElement('generateVideoBtn');
        if (generateBtn) generateBtn.disabled = true;
        if (exportBtn) exportBtn.disabled = true;
        if (generateVideoBtn) generateVideoBtn.disabled = true;
        
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
            const mapStyleEl = this.getElement('mapStyle');
            const mapLanguageEl = this.getElement('mapLanguage');
            const radiusEl = this.getElement('radius');
            const blurEl = this.getElement('blur');
            const opacityEl = this.getElement('opacity');
            const dateRangeEl = this.getElement('dateRange');
            
            const settings = {
                mapStyle: mapStyleEl?.value || 'dark',
                mapLanguage: mapLanguageEl?.value || 'en',
                radius: radiusEl?.value || '1',
                blur: blurEl?.value || '1',
                opacity: opacityEl?.value || '0.8',
                dateRange: dateRangeEl?.value || '365'
            };
            
            localStorage.setItem('heatmap_settings', JSON.stringify(settings));
        } catch (error) {
            logger.warn('保存设置失败:', error);
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
                const dateRangeEl = this.getElement('dateRange');
                if (dateRangeEl && ['30', '90', '180', '365', '0'].includes(settings.dateRange)) {
                    dateRangeEl.value = settings.dateRange;
                }
            }
        } catch (error) {
            logger.warn('加载设置失败:', error);
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
            const dateRangeEl = this.getElement('dateRange');
            if (!dateRangeEl) {
                throw new Error('日期范围选择器未找到');
            }
            const dateRange = parseInt(dateRangeEl.value);
            
            // 对每个轨迹段分别处理，保持轨迹边界，避免在不同轨迹之间插值
            const maxPoints = APP_CONFIG.LIMITS.MAX_POINTS;
            const finalPoints = await this.processTracksAsync(this.loadedTracks, dateRange, maxPoints);
            
            if (finalPoints.length === 0) {
                this.showMessage('在指定时间范围内没有找到轨迹点', 'warning');
                return;
            }
            
            // 更新热力图参数
            this.updateHeatmapParameters();
            
            // 渲染热力图
            this.heatmapRenderer.renderHeatmap(finalPoints);
            
            // 启用导出按钮和视频生成按钮
            const exportBtn = this.getElement('exportBtn');
            const generateVideoBtn = this.getElement('generateVideoBtn');
            if (exportBtn) {
                exportBtn.disabled = false;
            }
            if (generateVideoBtn) {
                generateVideoBtn.disabled = false;
            }
            
            this.showMessage(`热力图生成成功！显示 ${finalPoints.length.toLocaleString()} 个轨迹点`, 'success');
            
            // 移动端自动滚动到地图
            const isMobile = this.heatmapRenderer.isMobileDevice();
            if (isMobile) {
                // 等待一小段时间确保地图渲染完成
                setTimeout(() => {
                    const mapContainer = document.querySelector('.map-container') || this.getElement('map');
                    if (mapContainer) {
                        mapContainer.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start',
                            inline: 'nearest'
                        });
                    }
                }, APP_CONFIG.DELAY.SCROLL);
            }
            
        } catch (error) {
            ErrorHandler.handle(error, 'generateHeatmap', {
                showMessage: true,
                message: '生成热力图时出错: ' + (error.message || '未知错误')
            });
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
                        logger.info(`为了性能优化，已使用Douglas-Peucker算法将 ${totalBeforeSampling.toLocaleString()} 个点优化为 ${totalAfterSampling.toLocaleString()} 个点，保持轨迹形状`);
                        this.showMessage(`为了性能优化，已使用Douglas-Peucker算法将 ${totalBeforeSampling.toLocaleString()} 个点优化为 ${totalAfterSampling.toLocaleString()} 个点，保持轨迹形状`, 'info');
                    }
                    resolve(finalPoints);
                    return;
                }
                
                const track = tracks[trackIndex];
                
                // 更新进度提示
                if (tracks.length > 1) {
                    const progressText = `正在处理轨迹 ${trackIndex + 1}/${tracks.length}...`;
                    this.showLoading(true, progressText);
                }
                
                // 根据日期范围过滤当前轨迹的点（合并 filter 和 map，减少中间数组）
                const filteredTrackPoints = [];
                for (let j = 0; j < track.points.length; j++) {
                    const point = track.points[j];
                    // 日期过滤逻辑
                    if (cutoffTime === null || 
                        (point.timestamp && point.timestamp >= cutoffTime) || 
                        !point.timestamp) {
                        // 同时进行映射
                        filteredTrackPoints.push([point.lat, point.lon]);
                    }
                }
                
                if (filteredTrackPoints.length > 0) {
                    totalBeforeSampling += filteredTrackPoints.length;
                    
                    // 对当前轨迹段进行采样（如果需要）
                    let sampledPoints = filteredTrackPoints;
                    
                    // 性能优化：如果点数太多，直接进行均匀采样，跳过Douglas-Peucker算法
                    const trackMaxPoints = Math.max(1000, Math.floor(maxPoints / tracks.length));
                    if (filteredTrackPoints.length > trackMaxPoints) {
                        // 如果点数超过配额，直接进行快速均匀采样
                        if (filteredTrackPoints.length > 10000) {
                            // 如果点数超过10000，使用更激进的采样策略
                            sampledPoints = this.quickSample(filteredTrackPoints, trackMaxPoints);
                        } else {
                            // 使用智能采样（但限制Douglas-Peucker的尝试次数）
                            sampledPoints = this.samplePointsFast(filteredTrackPoints, trackMaxPoints);
                        }
                    }
                    
                    totalAfterSampling += sampledPoints.length;
                    
                    // 智能插值：在点稀疏时进行插值，填充轨迹间隙
                    let interpolatedPoints = sampledPoints;
                    
                    // 如果采样后的点数较少，进行插值
                    if (sampledPoints.length < maxPoints * 0.7 && sampledPoints.length > 2) {
                        // 计算平均相邻点距离
                        let avgDistance = 0;
                        for (let i = 0; i < sampledPoints.length - 1; i++) {
                            // 使用GPXParser的haversineDistance方法
                            const dist = GeoUtils.haversineDistance(
                                sampledPoints[i][0], sampledPoints[i][1],
                                sampledPoints[i + 1][0], sampledPoints[i + 1][1]
                            ) * 1000; // 转为米
                            avgDistance += dist;
                        }
                        avgDistance /= (sampledPoints.length - 1);
                        
                        // 如果平均距离较大（> 50米），进行插值（降低阈值，填充更多稀疏区域）
                        if (avgDistance > 50) {
                            // 使用较小的插值阈值，填充稀疏区域
                            // 将米转换为度：1度约等于111公里，所以1米约等于0.000009度
                            const interpolationThreshold = Math.min(avgDistance * 0.000009, 0.0008); // 约90米
                            interpolatedPoints = this.interpolateTrackPoints([{ points: sampledPoints }], interpolationThreshold);
                        }
                    }
                    
                    // 将当前轨迹段的点添加到最终数组
                    // 使用循环添加，避免展开操作符导致栈溢出
                    for (let i = 0; i < interpolatedPoints.length; i++) {
                        finalPoints.push(interpolatedPoints[i]);
                    }
                }
                
                trackIndex++;
                
                // 使用setTimeout让出控制权，避免阻塞UI
                // 对于最后一条轨迹，稍微增加延迟，确保UI更新
                const delay = trackIndex >= tracks.length ? 10 : APP_CONFIG.DELAY.PROCESS_TRACK;
                setTimeout(processNextTrack, delay);
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
                // 统一使用GPX解析器的filterByDateRange方法
                // 因为GPX和FIT解析器返回的数据格式是统一的，所以可以通用
                const filteredPoints = this.gpxParser.filterByDateRange(tracks, days);
                resolve(filteredPoints);
            }, 0);
        });
    }
    
    /**
     * 统一的日期范围过滤方法（支持GPX和FIT文件）
     * @param {Array} tracks - 轨迹数组（可能包含GPX和FIT文件）
     * @param {number} days - 天数（0表示不过滤）
     * @returns {Array} 过滤后的轨迹点数组 [[lat, lon], ...]
     */
    filterTracksByDateRange(tracks, days) {
        // 由于GPX和FIT解析器返回的数据格式是统一的，可以使用任一解析器的方法
        // 优先使用GPX解析器的方法（因为它是主要格式）
        return this.gpxParser.filterByDateRange(tracks, days);
    }

    /**
     * 计算两点之间的距离（Haversine公式，用于地理坐标）
     * @param {Array} point1 - [lat, lon]
     * @param {Array} point2 - [lat, lon]
     * @returns {number} 距离（米）
     */
    calculateDistance(point1, point2) {
        // 使用 GeoUtils.haversineDistance（返回公里），转换为米
        return GeoUtils.haversineDistance(point1[0], point1[1], point2[0], point2[1]) * 1000;
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
            const diffX = point[1] - lineStart[1];
            const diffY = point[0] - lineStart[0];
            return Math.sqrt(diffX * diffX + diffY * diffY);
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
        const MAX_INTERPOLATED_POINTS = 5000; // 适度的最大插值点数，填充稀疏区域
        
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
            
            // 性能优化：如果点数太多，先进行采样
            let pointsToInterpolate = points;
            if (points.length > 2000) {
                // 如果点数超过2000，先采样到2000个点
                pointsToInterpolate = this.samplePoints(points, 2000);
            }
            
            // 在当前轨迹段内进行插值
            const interpolatedPoints = [pointsToInterpolate[0]]; // 保留第一个点
            
            for (let i = 1; i < pointsToInterpolate.length; i++) {
                // 性能优化：如果插值后的点已经很多，跳过后续插值
                if (allInterpolatedPoints.length + interpolatedPoints.length >= MAX_INTERPOLATED_POINTS) {
                    // 添加剩余的点，不进行插值
                    for (let k = i; k < pointsToInterpolate.length; k++) {
                        const point = pointsToInterpolate[k];
                        const p = Array.isArray(point) ? point : [point.lat, point.lon];
                        interpolatedPoints.push(p);
                    }
                    break;
                }
                
                const prevPoint = pointsToInterpolate[i - 1];
                const currPoint = pointsToInterpolate[i];
                
                // 确保点是数组格式 [lat, lon]
                const prev = Array.isArray(prevPoint) ? prevPoint : [prevPoint.lat, prevPoint.lon];
                const curr = Array.isArray(currPoint) ? currPoint : [currPoint.lat, currPoint.lon];
                
                // 计算两点间的距离（度）
                const latDiff = curr[0] - prev[0];
                const lonDiff = curr[1] - prev[1];
                const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
                
                // 如果距离超过阈值，进行插值
                if (distance > maxDistance) {
                    // 计算需要插入的点数，但限制最大插值点数
                    const remainingCapacity = MAX_INTERPOLATED_POINTS - allInterpolatedPoints.length - interpolatedPoints.length;
                    const numInterpolated = Math.min(
                        Math.ceil(distance / maxDistance),
                        Math.max(1, Math.floor(remainingCapacity / (pointsToInterpolate.length - i)))
                    );
                    
                    // 限制单次插值的点数，但允许更多点以填充稀疏区域
                    const maxSingleInterpolation = 8; // 单次最多插入8个点
                    const actualInterpolated = Math.min(numInterpolated, maxSingleInterpolation);
                    
                    // 在两点之间插入中间点
                    for (let j = 1; j <= actualInterpolated; j++) {
                        const ratio = j / (actualInterpolated + 1);
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
            // 使用循环添加，避免展开操作符导致栈溢出
            for (let i = 0; i < interpolatedPoints.length; i++) {
                allInterpolatedPoints.push(interpolatedPoints[i]);
            }
        }
        
        return allInterpolatedPoints;
    }

    /**
     * 快速均匀采样（用于大量点的情况）
     * @param {Array} points - 原始轨迹点 [[lat, lon], ...]
     * @param {number} maxPoints - 最大点数
     * @returns {Array} 采样后的轨迹点
     */
    quickSample(points, maxPoints) {
        if (points.length <= maxPoints) {
            return points;
        }
        
        const sampledPoints = [];
        const step = points.length / maxPoints;
        
        // 确保保留第一个和最后一个点
        sampledPoints.push(points[0]);
        
        for (let i = step; i < points.length - step; i += step) {
            sampledPoints.push(points[Math.floor(i)]);
        }
        
        // 确保保留最后一个点
        if (points.length > 1) {
            sampledPoints.push(points[points.length - 1]);
        }
        
        return sampledPoints;
    }
    
    /**
     * 快速采样（限制Douglas-Peucker算法的使用）
     * @param {Array} points - 原始轨迹点 [[lat, lon], ...]
     * @param {number} maxPoints - 最大点数
     * @returns {Array} 采样后的轨迹点
     */
    samplePointsFast(points, maxPoints) {
        if (points.length <= maxPoints) {
            return points;
        }
        
        // 如果点数不是特别多，尝试一次Douglas-Peucker简化
        if (points.length < 5000) {
            const tolerance = 0.0001; // 使用较大的容差，快速简化
            const simplified = this.simplifyTrack(points, tolerance);
            
            if (simplified.length <= maxPoints) {
                return simplified;
            }
        }
        
        // 如果Douglas-Peucker简化后仍然超过最大点数，或点数太多，直接均匀采样
        return this.quickSample(points, maxPoints);
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
        
        // 对于大量点，直接使用快速采样
        if (points.length > 5000) {
            return this.quickSample(points, maxPoints);
        }
        
        // 首先尝试使用Douglas-Peucker算法简化
        // 从较小的容差开始，逐步增大直到点数符合要求
        let tolerance = 0.00001; // 初始容差（约1米）
        let simplified = points;
        let attempts = 0;
        const maxAttempts = 5; // 减少尝试次数，避免卡死
        
        while (simplified.length > maxPoints && attempts < maxAttempts) {
            simplified = this.simplifyTrack(points, tolerance);
            tolerance *= 2; // 增大容差
            attempts++;
            
            // 如果简化后点数仍然很多，提前退出
            if (simplified.length > maxPoints * 2) {
                break;
            }
        }
        
        // 如果Douglas-Peucker简化后仍然超过最大点数，进行均匀采样
        if (simplified.length > maxPoints) {
            return this.quickSample(simplified, maxPoints);
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
        // 使用统一的过滤方法，支持GPX和FIT文件
        const filteredPoints = this.filterTracksByDateRange(this.loadedTracks, dateRange);
        
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
        // 检查视频生成是否正在进行中（防止状态冲突）
        const isVideoGenerating = this.videoGenerator && 
                                   typeof this.videoGenerator.isGenerating !== 'undefined' && 
                                   this.videoGenerator.isGenerating;
        if (isVideoGenerating) {
            this.showMessage('视频生成正在进行中，请稍后再导出', 'warning');
            return;
        }
        
        if (!this.heatmapRenderer.heatLayer) {
            this.showMessage('请先生成热力图再导出', 'warning');
            return;
        }

        try {
            // 检测是否为移动设备（复用heatmapRenderer的方法）
            const isMobile = this.heatmapRenderer.isMobileDevice();
            
            // 检查 html2canvas 是否已加载，如果未加载则尝试加载
            const checkHtml2Canvas = () => {
                try {
                    // 先检查 window.html2canvas（更安全）
                    if (typeof window !== 'undefined' && window.html2canvas && typeof window.html2canvas === 'function') {
                        return true;
                    }
                    // 再检查全局 html2canvas（可能抛出错误，所以用 try-catch）
                    if (typeof html2canvas !== 'undefined' && typeof html2canvas === 'function') {
                        return true;
                    }
                } catch (e) {
                    // 如果访问 html2canvas 抛出错误，说明未定义
                    return false;
                }
                return false;
            };
            
            if (!this.heatmapRenderer.html2canvasLoaded || !checkHtml2Canvas()) {
                this.showLoading(true, '正在加载导出功能...');
                try {
                    await this.heatmapRenderer.loadHtml2Canvas();
                    // 加载后再次验证
                    if (!checkHtml2Canvas()) {
                        throw new Error('html2canvas is not defined');
                    }
                } catch (loadError) {
                    this.showLoading(false);
                    const errorMsg = loadError.message || '未知错误';
                    this.showMessage('导出功能加载失败: ' + errorMsg + '。请检查网络连接或使用截屏功能', 'error');
                    // 移动端显示截屏指南
                    if (isMobile) {
                        this.showScreenshotGuide();
                    }
                    return;
                }
            }
            
            // PC端：优化导出流程以提升速度
            if (!isMobile) {
                this.showLoading(true, '正在导出热力图...');
                // 优化：减少延迟时间到100ms，地图通常已经渲染完成
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 增加超时时间到 30 秒，因为 html2canvas 处理大图可能需要更长时间
                const totalTimeout = 30000;
                try {
                    const exportPromise = this.heatmapRenderer.exportAndDownload(undefined, false);
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('EXPORT_TIMEOUT')), totalTimeout);
                    });
                    
                    await Promise.race([exportPromise, timeoutPromise]);
                    this.showLoading(false);
                    this.showMessage('热力图导出成功！', 'success');
                } catch (exportError) {
                    this.showLoading(false);
                    const errorMsg = exportError.message || '未知错误';
                    if (errorMsg === 'EXPORT_TIMEOUT') {
                        this.showMessage('导出超时，请稍后重试或使用截屏功能', 'error');
                    } else {
                        this.showMessage('导出失败: ' + errorMsg, 'error');
                    }
                    logger.error('导出失败:', exportError);
                }
                return;
            }
            
            // 移动端：新的导出流程（优先Web Share API，保持高质量）
            this.showLoading(true, '正在生成高质量图片...');
            
            // 优化：减少延迟时间到200ms，地图通常已经渲染完成
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 生成时间戳文件名
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `cycling-heatmap-${timestamp}.png`;
            
            // 生成高质量图片（scale=1.0，不使用fastMode）
            this.showLoading(true, '正在导出热力图（高质量）...');
            const totalTimeout = 25000; // 移动端高质量导出可能需要更长时间
            let dataURL;
            try {
                const exportPromise = this.heatmapRenderer.exportMapAsImage(false, 0);
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('EXPORT_TIMEOUT')), totalTimeout);
                });
                
                dataURL = await Promise.race([exportPromise, timeoutPromise]);
            } catch (exportError) {
                this.showLoading(false);
                const errorMsg = exportError.message || '未知错误';
                if (errorMsg === 'EXPORT_TIMEOUT') {
                    this.showMessage('导出超时，请稍后重试或使用截屏功能', 'error');
                } else {
                    this.showMessage('导出失败: ' + errorMsg, 'error');
                }
                logger.error('导出失败:', exportError);
                this.showScreenshotGuide();
                return;
            }
            
            // 尝试Web Share API（优先）
            this.showLoading(true, '正在准备分享...');
            const shared = await this.heatmapRenderer.shareImageWithWebShare(dataURL, filename);
            
            if (shared) {
                this.showLoading(false);
                this.showMessage('热力图已分享，请选择保存到相册', 'success');
                return;
            }
            
            // Web Share API不支持或失败，降级到下载
            // 注意：在移动端，downloadImage可能不会抛出错误，但实际可能没有成功
            // 所以我们需要直接显示模态框，这是最可靠的方式
            this.showLoading(false);
            this.heatmapRenderer.showImageInModal(dataURL, filename, '长按图片保存到相册');
            this.showMessage('图片已显示，请长按保存', 'success');
            
        } catch (error) {
            ErrorHandler.handle(error, 'exportMap', {
                showMessage: true
            });
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
     * 显示视频配置模态框
     */
    showVideoConfigModal() {
        if (this.loadedTracks.length === 0) {
            this.showMessage('请先上传并生成热力图', 'warning');
            return;
        }

        if (!this.heatmapRenderer.heatLayer) {
            this.showMessage('请先生成热力图', 'warning');
            return;
        }

        // 检查是否支持视频生成
        const supportCheck = VideoGenerator.checkSupport();
        if (!supportCheck.supported) {
            const message = supportCheck.message || supportCheck.reason || '您的浏览器不支持视频生成功能';
            this.showMessage(message, 'error');
            return;
        }

        const modal = document.getElementById('videoConfigModal');
        if (!modal) {
            this.showMessage('视频配置界面未找到', 'error');
            return;
        }

        // 计算时间范围
        const allDates = [];
        for (let i = 0; i < this.loadedTracks.length; i++) {
            const track = this.loadedTracks[i];
            for (let j = 0; j < track.points.length; j++) {
                if (track.points[j].timestamp) {
                    allDates.push(track.points[j].timestamp);
                }
            }
        }

        if (allDates.length === 0) {
            this.showMessage('没有带时间戳的轨迹点，无法生成视频', 'error');
            return;
        }

        // 设置默认时间范围（使用循环避免展开运算符导致堆栈溢出）
        let minTimestamp = allDates[0];
        let maxTimestamp = allDates[0];
        for (let i = 1; i < allDates.length; i++) {
            if (allDates[i] < minTimestamp) minTimestamp = allDates[i];
            if (allDates[i] > maxTimestamp) maxTimestamp = allDates[i];
        }
        const minDate = new Date(minTimestamp);
        const maxDate = new Date(maxTimestamp);

        // 默认选择最近一年（如果数据超过一年）
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const defaultStartDate = oneYearAgo > minDate ? oneYearAgo : minDate;
        const defaultEndDate = maxDate;

        const startDateInput = document.getElementById('videoStartDate');
        const endDateInput = document.getElementById('videoEndDate');

        if (startDateInput) {
            startDateInput.value = defaultStartDate.toISOString().split('T')[0];
            startDateInput.min = minDate.toISOString().split('T')[0];
            startDateInput.max = maxDate.toISOString().split('T')[0];
        }

        if (endDateInput) {
            endDateInput.value = defaultEndDate.toISOString().split('T')[0];
            endDateInput.min = minDate.toISOString().split('T')[0];
            endDateInput.max = maxDate.toISOString().split('T')[0];
        }

        modal.style.display = 'flex';
    }

    /**
     * 关闭视频配置模态框
     */
    closeVideoConfigModal() {
        const modal = document.getElementById('videoConfigModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 生成视频
     */
    async generateVideo() {
        const startDateInput = document.getElementById('videoStartDate');
        const endDateInput = document.getElementById('videoEndDate');

        if (!startDateInput || !endDateInput) {
            this.showMessage('时间选择器未找到', 'error');
            return;
        }

        const startDate = new Date(startDateInput.value);
        const endDate = new Date(endDateInput.value);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            this.showMessage('请选择有效的时间范围', 'error');
            return;
        }

        if (startDate >= endDate) {
            this.showMessage('开始时间必须早于结束时间', 'error');
            return;
        }

        // 关闭配置模态框
        this.closeVideoConfigModal();

        // 初始化视频生成器（如果尚未初始化）
        if (!this.videoGenerator) {
            this.videoGenerator = new VideoGenerator(this.heatmapRenderer);
        }

        // 在视频生成过程中禁用导出按钮，避免状态冲突
        const exportBtn = this.getElement('exportBtn');
        const originalExportDisabled = exportBtn ? exportBtn.disabled : false;
        if (exportBtn) {
            exportBtn.disabled = true;
        }

        // 监听长时间生成事件（必须在generateVideo调用之前注册，因为事件会在loadFFmpeg之前触发）
        let longTimeHandler = null;
        longTimeHandler = (event) => {
            const { generationId, estimatedTime, totalFrames } = event.detail;
            this.handleLongTimeGeneration(generationId, estimatedTime, totalFrames);
        };
        document.addEventListener('videoGenerationLongTime', longTimeHandler);

        try {
            // 显示视频生成进度模态框
            const progressModal = document.getElementById('videoProgressModal');
            if (progressModal) {
                progressModal.style.display = 'flex';
            }

            const progressBar = document.getElementById('videoProgressBar');
            const progressText = document.getElementById('videoProgressText');

            // 进度回调
            const progressCallback = (progress) => {
                if (progressBar) {
                    progressBar.style.width = progress.progress + '%';
                }
                if (progressText) {
                    progressText.textContent = progress.message || '处理中...';
                }
            };

            // 生成视频
            const videoBlob = await this.videoGenerator.generateVideo(
                this.loadedTracks,
                startDate,
                endDate,
                progressCallback
            );

            // 下载视频
            const url = URL.createObjectURL(videoBlob);
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `cycling-heatmap-video-${timestamp}.mp4`;

            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // 关闭进度模态框
            if (progressModal) {
                progressModal.style.display = 'none';
            }

            this.showMessage('视频生成成功！', 'success');

        } catch (error) {
            logger.error('视频生成失败:', error);

            // 关闭进度模态框
            const progressModal = document.getElementById('videoProgressModal');
            if (progressModal) {
                progressModal.style.display = 'none';
            }

            const errorMsg = error.message || '未知错误';
            if (errorMsg === '生成已取消') {
                this.showMessage('视频生成已取消', 'info');
            } else if (errorMsg.includes('FFmpeg加载失败') || errorMsg.includes('无法加载FFmpeg')) {
                // FFmpeg加载失败，提供更详细的提示
                this.showMessage(
                    '视频处理库加载失败。可能原因：\n' +
                    '1. 网络连接问题，请检查网络后重试\n' +
                    '2. 浏览器不支持ES模块，请使用Chrome、Firefox或Edge最新版本\n' +
                    '3. 浏览器安全策略阻止了外部资源加载\n\n' +
                    '建议：使用现代浏览器（Chrome/Edge/Firefox最新版本）并确保网络连接正常。',
                    'error'
                );
            } else {
                this.showMessage('视频生成失败: ' + errorMsg, 'error');
            }
        } finally {
            // 移除事件监听器
            if (longTimeHandler) {
                document.removeEventListener('videoGenerationLongTime', longTimeHandler);
            }
            
            // 恢复导出按钮状态
            if (exportBtn) {
                exportBtn.disabled = originalExportDisabled;
            }
        }
    }

    /**
     * 处理长时间视频生成
     * @param {string} generationId - 生成任务ID
     * @param {number} estimatedTime - 估算时间（秒）
     * @param {number} totalFrames - 总帧数
     */
    handleLongTimeGeneration(generationId, estimatedTime, totalFrames) {
        const minutes = Math.ceil(estimatedTime / 60);
        const message = `视频生成预计需要约 ${minutes} 分钟（${totalFrames} 帧）。\n\n` +
                       `视频生成过程中会显示进度，您可以继续使用其他功能。\n\n` +
                       `如果生成失败，请检查浏览器控制台的错误信息。`;
        
        // 显示提示信息（不再询问是否后台生成，因为后台生成功能尚未完全实现）
        this.showMessage(message, 'info');
    }

    /**
     * 检查并下载已完成的视频
     */
    async checkCompletedVideos() {
        if (!this.videoGenerator) {
            this.showMessage('视频生成器未初始化', 'warning');
            return;
        }

        try {
            // 获取待处理的任务
            const pendingTasks = JSON.parse(localStorage.getItem('pendingVideoTasks') || '[]');
            
            if (pendingTasks.length === 0) {
                this.showMessage('没有待处理的视频任务', 'info');
                return;
            }

            this.showLoading(true, '正在检查已完成的视频...');

            let foundCompleted = false;
            const remainingTasks = [];

            for (const task of pendingTasks) {
                const videoBlob = await this.videoGenerator.recoverVideo(task.id);
                
                if (videoBlob) {
                    // 视频已完成，下载它
                    foundCompleted = true;
                    const url = URL.createObjectURL(videoBlob);
                    const now = new Date();
                    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
                    const filename = `cycling-heatmap-video-${timestamp}.mp4`;

                    const link = document.createElement('a');
                    link.download = filename;
                    link.href = url;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    // 删除任务记录
                    await this.videoGenerator.deleteProgress(task.id);
                    this.showMessage(`视频已下载: ${filename}`, 'success');
                } else {
                    // 检查任务状态
                    const progress = await this.videoGenerator.getProgress(task.id);
                    if (progress) {
                        if (progress.status === 'failed') {
                            this.showMessage(
                                `任务 ${task.id} 生成失败: ${progress.error || '未知错误'}\n\n` +
                                `请检查浏览器控制台获取详细错误信息。`,
                                'error'
                            );
                            // 删除失败的任务
                            await this.videoGenerator.deleteProgress(task.id);
                        } else if (progress.status === 'running') {
                            // 仍在运行中，保留任务
                            remainingTasks.push(task);
                        }
                    } else {
                        // 任务不存在，可能是已删除或过期
                        remainingTasks.push(task);
                    }
                }
            }

            // 更新待处理任务列表
            localStorage.setItem('pendingVideoTasks', JSON.stringify(remainingTasks));

            if (!foundCompleted) {
                if (remainingTasks.length > 0) {
                    this.showMessage(
                        `有 ${remainingTasks.length} 个任务仍在处理中，请稍后再试`,
                        'info'
                    );
                } else {
                    this.showMessage('没有找到已完成的视频', 'info');
                }
            }

        } catch (error) {
            logger.error('检查已完成视频失败:', error);
            this.showMessage('检查视频失败: ' + (error.message || '未知错误'), 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 取消视频生成
     */
    cancelVideoGeneration() {
        if (this.videoGenerator) {
            this.videoGenerator.cancel();
        }

        const progressModal = document.getElementById('videoProgressModal');
        if (progressModal) {
            progressModal.style.display = 'none';
        }

        // 延迟恢复导出按钮，确保视频生成器的finally块已执行
        setTimeout(() => {
            const exportBtn = this.getElement('exportBtn');
            if (exportBtn && this.heatmapRenderer.heatLayer && 
                (!this.videoGenerator || !this.videoGenerator.isGenerating)) {
                exportBtn.disabled = false;
            }
        }, 100);

        this.showMessage('正在取消视频生成...', 'info');
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
        const inputBookmarkletCode = `javascript:(function(){const key=prompt('请输入天地图API密钥：','');if(key&&key.trim()){if(typeof MAP_CONFIG!=='undefined'&&MAP_CONFIG.setApiKey){MAP_CONFIG.setApiKey(key.trim());alert('✅ API密钥已设置！\\n\\n页面将自动刷新以应用更改。');location.reload();}else{localStorage.setItem('tianditu_api_key',key.trim());alert('✅ API密钥已保存！\\n\\n请刷新页面。');location.reload();}}else if(key!==null){alert('❌ 密钥不能为空');}})();`;

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
        // 初始状态下禁用生成、导出和视频生成按钮
        const generateBtn = this.getElement('generateBtn');
        const exportBtn = this.getElement('exportBtn');
        const generateVideoBtn = this.getElement('generateVideoBtn');
        if (generateBtn) generateBtn.disabled = true;
        if (exportBtn) exportBtn.disabled = true;
        if (generateVideoBtn) generateVideoBtn.disabled = true;
        
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
    const modal = domCache.getElement('helpModal');
    if (modal) modal.style.display = 'flex';
}

function closeHelp() {
    const modal = domCache.getElement('helpModal');
    if (modal) modal.style.display = 'none';
}

// GPX指南模态框相关函数
function showGpxGuide() {
    const modal = domCache.getElement('gpxGuideModal');
    if (modal) modal.style.display = 'flex';
}

function closeGpxGuide() {
    const modal = domCache.getElement('gpxGuideModal');
    if (modal) modal.style.display = 'none';
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
    const modal = domCache.getElement('donateModal');
    if (modal) modal.style.display = 'flex';
}

function closeDonate() {
    const modal = domCache.getElement('donateModal');
    if (modal) modal.style.display = 'none';
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
// 应用初始化已移至 index.html 中的脚本，确保 Leaflet 加载完成后再初始化
// 这里只作为备用初始化方案，如果 index.html 中的初始化失败
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // 检查是否已经初始化（防止重复初始化）
        if (window.app) {
            return;
        }
        
        // 检查 Leaflet 是否已加载
        if (typeof L !== 'undefined') {
            if (!window.app) {
                try {
                    window.app = new CyclingHeatmapApp();
                } catch (error) {
                    console.error('❌ 备用初始化失败:', error);
                }
            }
        } else {
            // Leaflet 未加载，等待加载完成（最多等待10秒）
            let attempts = 0;
            const maxAttempts = 100; // 10秒
            const checkLeaflet = setInterval(() => {
                attempts++;
                if (typeof L !== 'undefined') {
                    clearInterval(checkLeaflet);
                    if (!window.app) {
                        try {
                            window.app = new CyclingHeatmapApp();
                        } catch (error) {
                            console.error('❌ 备用初始化失败:', error);
                        }
                    }
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkLeaflet);
                    console.error('❌ Leaflet 库加载超时，请检查网络连接');
                }
            }, 100);
        }
    });
} else {
    // DOM 已准备好，但需要检查 Leaflet 和是否已初始化
    if (typeof L !== 'undefined' && !window.app) {
        try {
            window.app = new CyclingHeatmapApp();
        } catch (error) {
            console.error('❌ 备用初始化失败:', error);
        }
    }
}

// 导出应用类
window.CyclingHeatmapApp = CyclingHeatmapApp;
