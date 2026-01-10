/**
 * Heatmap Renderer - 使用Leaflet渲染Strava风格热力图
 */

class HeatmapRenderer {
    constructor(mapElementId) {
        this.mapElementId = mapElementId;
        this.map = null;
        this.heatLayer = null;
        this.currentPoints = [];
        this.mapStyle = 'dark';
        this.mapLanguage = 'en'; // 默认英文地图，节省API使用量
        this.currentBaseLayers = []; // 当前基础图层
        // 安全初始化使用量跟踪器
        this.usageTracker = (typeof TiandituUsageTracker !== 'undefined') 
            ? new TiandituUsageTracker() 
            : null;
        this.heatmapOptions = {
            radius: 1,
            blur: 1,
            minOpacity: 0.8,
            maxZoom: 18
        };
        
        this.initializeMap();
        this.bindAutoSwitchEvent();
    }

    /**
     * 初始化地图
     */
    initializeMap() {
        // 使用默认值，防止MAP_CONFIG未加载的情况
        const defaultCenter = (typeof MAP_CONFIG !== 'undefined' && MAP_CONFIG.DEFAULT_CENTER) 
            ? MAP_CONFIG.DEFAULT_CENTER 
            : [31.2304, 121.4737]; // 上海
        const defaultZoom = (typeof MAP_CONFIG !== 'undefined' && MAP_CONFIG.DEFAULT_ZOOM) 
            ? MAP_CONFIG.DEFAULT_ZOOM 
            : 11;

        // 创建地图实例
        this.map = L.map(this.mapElementId, {
            center: defaultCenter,
            zoom: defaultZoom,
            zoomControl: true,
            attributionControl: true
        });

        // 设置默认地图样式
        this.setMapLanguage(this.mapLanguage);

        // 添加地图事件监听
        this.map.on('zoomend', () => {
            this.updateHeatmapZoom();
        });
    }

    /**
     * 绑定自动切换事件
     */
    bindAutoSwitchEvent() {
        document.addEventListener('tiandituAutoSwitch', (event) => {
            console.log('天地图API配额接近限制，自动切换到英文地图');
            this.setMapLanguage('en');
            this.showAutoSwitchMessage(event.detail);
        });
    }

    /**
     * 显示自动切换消息
     */
    showAutoSwitchMessage(detail) {
        // 创建消息提示
        const message = `API使用量接近限制，已自动切换到英文地图\n矢量: ${detail.vectorUsage}/10000, 标注: ${detail.labelUsage}/10000`;
        
        // 如果有全局消息显示函数，使用它
        if (window.app && window.app.showMessage) {
            window.app.showMessage(message, 'warning');
        } else {
            console.warn(message);
            alert(message);
        }
    }

    /**
     * 触发API密钥缺失事件
     */
    triggerApiKeyMissingEvent() {
        // 触发自定义事件，通知主应用显示提示
        const event = new CustomEvent('tiandituApiKeyMissing', {
            detail: {
                reason: '未配置API密钥',
                message: '中文地图需要天地图API密钥，已自动切换到英文地图'
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * 设置地图样式
     * @param {string} style - 地图样式 ('dark' 或 'light')
     */
    setMapStyle(style) {
        this.mapStyle = style;
        this.updateMapTiles();
    }

    /**
     * 设置地图语言
     * @param {string} language - 地图语言 ('zh' 或 'en')
     */
    setMapLanguage(language) {
        this.mapLanguage = language;
        this.updateMapTiles();
    }

    /**
     * 更新地图瓦片层
     */
    updateMapTiles() {
        // 清除现有图层
        this.clearCurrentLayers();
        this.currentBaseLayers = [];

        // 根据地图语言类型创建图层
        if (this.mapLanguage === 'zh-vector') {
            this.createTiandituVectorLayers();
        } else if (this.mapLanguage === 'zh-satellite') {
            this.createTiandituSatelliteLayers();
        } else {
            this.createEnglishLayers();
        }

        // 应用地图样式滤镜
        this.applyMapStyleFilter();

        // 更新地图类型指示器
        this.updateMapTypeIndicator();
        
        console.log(`地图切换: 语言=${this.mapLanguage}, 样式=${this.mapStyle}`);
    }

    /**
     * 清除当前图层
     */
    clearCurrentLayers() {
        this.map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                this.map.removeLayer(layer);
            }
        });
    }

    /**
     * 创建天地图矢量图层
     */
    createTiandituVectorLayers() {
        // 检查MAP_CONFIG是否可用
        if (typeof MAP_CONFIG === 'undefined') {
            console.warn('MAP_CONFIG未加载，切换到英文地图');
            this.createEnglishLayers();
            this.triggerApiKeyMissingEvent();
            return;
        }

        // 检查API密钥是否已配置
        if (!MAP_CONFIG.hasApiKey()) {
            console.warn('未配置天地图API密钥，切换到英文地图');
            this.createEnglishLayers();
            this.triggerApiKeyMissingEvent();
            return;
        }

        if (this.usageTracker && (!this.usageTracker.canUseTianditu('vector') || !this.usageTracker.canUseTianditu('label'))) {
            console.warn('天地图API配额已用完，切换到英文地图');
            this.createEnglishLayers();
            return;
        }

        const vectorUrl = MAP_CONFIG.buildTiandituUrl('vector');
        const labelUrl = MAP_CONFIG.buildTiandituUrl('vector_label');

        if (!vectorUrl || !labelUrl) {
            console.warn('无法构建天地图URL，切换到英文地图');
            this.createEnglishLayers();
            this.triggerApiKeyMissingEvent();
            return;
        }

        // 创建矢量底图层
        const vectorLayer = L.tileLayer(vectorUrl, {
            attribution: '&copy; <a href="http://www.tianditu.gov.cn/">天地图</a>',
            subdomains: MAP_CONFIG.TIANDITU_SUBDOMAINS,
            maxZoom: 18
        });

        // 创建中文标注层
        const labelLayer = L.tileLayer(labelUrl, {
            attribution: '',
            subdomains: MAP_CONFIG.TIANDITU_SUBDOMAINS,
            maxZoom: 18
        });

        // 添加使用量跟踪
        if (this.usageTracker) {
            vectorLayer.on('tileload', () => {
                this.usageTracker.trackVectorRequest();
            });

            labelLayer.on('tileload', () => {
                this.usageTracker.trackLabelRequest();
            });
        }

        // 添加错误处理
        vectorLayer.on('tileerror', (e) => {
            console.warn('天地图矢量底图加载失败:', e);
        });

        labelLayer.on('tileerror', (e) => {
            console.warn('天地图标注层加载失败:', e);
        });

        // 添加到地图
        vectorLayer.addTo(this.map);
        labelLayer.addTo(this.map);

        this.currentBaseLayers = [vectorLayer, labelLayer];
        
        // 应用暗色滤镜（如果是暗色模式）
        this.applyMapStyleFilter();
    }

    /**
     * 创建天地图卫星图层
     */
    createTiandituSatelliteLayers() {
        // 检查MAP_CONFIG是否可用
        if (typeof MAP_CONFIG === 'undefined') {
            console.warn('MAP_CONFIG未加载，切换到英文地图');
            this.createEnglishLayers();
            this.triggerApiKeyMissingEvent();
            return;
        }

        // 检查API密钥是否已配置
        if (!MAP_CONFIG.hasApiKey()) {
            console.warn('未配置天地图API密钥，切换到英文地图');
            this.createEnglishLayers();
            this.triggerApiKeyMissingEvent();
            return;
        }

        if (this.usageTracker && (!this.usageTracker.canUseTianditu('image') || !this.usageTracker.canUseTianditu('label'))) {
            console.warn('天地图API配额已用完，切换到英文地图');
            this.createEnglishLayers();
            return;
        }

        const imageUrl = MAP_CONFIG.buildTiandituUrl('image');
        const imageLabelUrl = MAP_CONFIG.buildTiandituUrl('image_label');

        if (!imageUrl || !imageLabelUrl) {
            console.warn('无法构建天地图URL，切换到英文地图');
            this.createEnglishLayers();
            this.triggerApiKeyMissingEvent();
            return;
        }

        // 创建影像底图层
        const imageLayer = L.tileLayer(imageUrl, {
            attribution: '&copy; <a href="http://www.tianditu.gov.cn/">天地图</a>',
            subdomains: MAP_CONFIG.TIANDITU_SUBDOMAINS,
            maxZoom: 18
        });

        // 创建影像标注层
        const imageLabelLayer = L.tileLayer(imageLabelUrl, {
            attribution: '',
            subdomains: MAP_CONFIG.TIANDITU_SUBDOMAINS,
            maxZoom: 18
        });

        // 添加使用量跟踪
        if (this.usageTracker) {
            imageLayer.on('tileload', () => {
                this.usageTracker.trackImageRequest();
            });

            imageLabelLayer.on('tileload', () => {
                this.usageTracker.trackLabelRequest();
            });
        }

        // 添加错误处理
        imageLayer.on('tileerror', (e) => {
            console.warn('天地图影像底图加载失败:', e);
        });

        imageLabelLayer.on('tileerror', (e) => {
            console.warn('天地图影像标注层加载失败:', e);
        });

        // 添加到地图
        imageLayer.addTo(this.map);
        imageLabelLayer.addTo(this.map);

        this.currentBaseLayers = [imageLayer, imageLabelLayer];
        
        // 应用暗色滤镜（如果是暗色模式）
        this.applyMapStyleFilter();
    }

    /**
     * 创建英文地图图层
     */
    createEnglishLayers() {
        let tileLayer;
        
        if (this.mapStyle === 'light') {
            // CartoDB Positron
            tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            });
        } else {
            // CartoDB Dark Matter
            tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            });
        }

        // 添加错误处理
        tileLayer.on('tileerror', (e) => {
            console.warn('英文地图瓦片加载失败:', e);
        });

        tileLayer.addTo(this.map);
        this.currentBaseLayers = [tileLayer];
    }

    /**
     * 应用地图样式滤镜
     */
    applyMapStyleFilter() {
        const mapContainer = this.map.getContainer();
        
        if (this.mapStyle === 'dark' && (this.mapLanguage === 'zh-vector' || this.mapLanguage === 'zh-satellite')) {
            // 为天地图应用暗色滤镜
            mapContainer.style.filter = 'invert(1) hue-rotate(180deg) brightness(0.8) contrast(1.2)';
            mapContainer.classList.add('dark-map-filter');
        } else {
            // 移除滤镜
            mapContainer.style.filter = '';
            mapContainer.classList.remove('dark-map-filter');
        }
    }

    /**
     * 更新地图类型指示器
     */
    updateMapTypeIndicator() {
        const indicator = document.getElementById('mapTypeIndicator');
        if (!indicator) return;

        let text = '';
        let className = 'map-type-indicator';

        switch (this.mapLanguage) {
            case 'zh-vector':
                text = '🇨🇳 中文地图 (天地图矢量)';
                className += ' chinese-map';
                break;
            case 'zh-satellite':
                text = '🇨🇳 中文卫星图 (天地图影像)';
                className += ' chinese-map';
                break;
            case 'en':
                text = '🇬🇧 英文地图 (CartoDB)';
                className += ' english-map';
                break;
            default:
                text = '🗺️ 地图';
                break;
        }

        indicator.textContent = text;
        indicator.className = className;
    }

    /**
     * 更新热力图参数
     * @param {Object} options - 热力图选项
     */
    updateHeatmapOptions(options) {
        this.heatmapOptions = { ...this.heatmapOptions, ...options };
        
        // 如果已有热力图，重新渲染
        if (this.heatLayer && this.currentPoints.length > 0) {
            this.renderHeatmap(this.currentPoints);
        }
    }

    /**
     * 渲染热力图
     * @param {Array} points - 轨迹点数组 [[lat, lon], ...]
     */
    renderHeatmap(points) {
        if (!points || points.length === 0) {
            console.warn('没有轨迹点数据');
            return;
        }

        this.currentPoints = points;

        // 移除现有的热力图层
        if (this.heatLayer) {
            this.map.removeLayer(this.heatLayer);
        }

        // 创建Strava风格的热力图层
        this.heatLayer = L.heatLayer(points, {
            radius: this.heatmapOptions.radius,
            blur: this.heatmapOptions.blur,
            minOpacity: this.heatmapOptions.minOpacity,
            maxZoom: this.heatmapOptions.maxZoom,
            gradient: this.getStravaGradient()
        });

        // 添加到地图
        this.heatLayer.addTo(this.map);

        // 自动调整地图视图以显示所有点
        this.fitMapToPoints(points);

        console.log(`✓ 热力图渲染完成，共 ${points.length.toLocaleString()} 个点`);
    }

    /**
     * 获取Strava风格的颜色渐变
     * @returns {Object} 颜色渐变配置
     */
    getStravaGradient() {
        return {
            0.0: '#00ff00',    // 绿色 - 低频率
            0.3: '#80ff00',    // 黄绿色
            0.5: '#ffff00',    // 黄色 - 中频率
            0.7: '#ff8000',    // 橙色
            1.0: '#ff0000'     // 红色 - 高频率
        };
    }

    /**
     * 调整地图视图以显示所有轨迹点
     * @param {Array} points - 轨迹点数组
     */
    fitMapToPoints(points) {
        if (!points || points.length === 0) return;

        // 计算边界
        const lats = points.map(p => p[0]);
        const lons = points.map(p => p[1]);
        
        const bounds = L.latLngBounds([
            [Math.min(...lats), Math.min(...lons)],
            [Math.max(...lats), Math.max(...lons)]
        ]);

        // 添加一些边距
        const paddedBounds = bounds.pad(0.1);
        
        // 调整地图视图
        this.map.fitBounds(paddedBounds, {
            padding: [20, 20],
            maxZoom: 15
        });
    }

    /**
     * 更新热力图缩放级别相关设置
     */
    updateHeatmapZoom() {
        if (!this.heatLayer) return;

        const currentZoom = this.map.getZoom();
        
        // 根据缩放级别动态调整热力图参数
        let dynamicRadius = this.heatmapOptions.radius;
        let dynamicBlur = this.heatmapOptions.blur;

        if (currentZoom > 15) {
            // 高缩放级别时，减小半径和模糊
            dynamicRadius = Math.max(1, this.heatmapOptions.radius * 0.8);
            dynamicBlur = Math.max(1, this.heatmapOptions.blur * 0.8);
        } else if (currentZoom < 10) {
            // 低缩放级别时，增大半径和模糊
            dynamicRadius = this.heatmapOptions.radius * 1.5;
            dynamicBlur = this.heatmapOptions.blur * 1.5;
        }

        // 更新热力图选项
        this.heatLayer.setOptions({
            radius: dynamicRadius,
            blur: dynamicBlur
        });
    }

    /**
     * 清除热力图
     */
    clearHeatmap() {
        if (this.heatLayer) {
            this.map.removeLayer(this.heatLayer);
            this.heatLayer = null;
        }
        this.currentPoints = [];
    }

    /**
     * 获取地图中心点
     * @returns {Object} {lat, lng}
     */
    getMapCenter() {
        return this.map.getCenter();
    }

    /**
     * 设置地图中心点
     * @param {number} lat - 纬度
     * @param {number} lng - 经度
     * @param {number} zoom - 缩放级别
     */
    setMapCenter(lat, lng, zoom = 13) {
        this.map.setView([lat, lng], zoom);
    }

    /**
     * 导出地图为图片
     * @returns {Promise<string>} Base64图片数据
     */
    /**
     * 导出地图为图片（支持快速模式和重试机制）
     * @param {boolean} fastMode - 是否使用快速模式（仅移动端）
     * @param {number} retryCount - 重试次数（仅移动端）
     * @returns {Promise<string>} Base64图片数据
     */
    async exportMapAsImage(fastMode = false, retryCount = 0) {
        return new Promise((resolve, reject) => {
            try {
                const mapContainer = this.map.getContainer();
                const isMobile = this.isMobileDevice();
                
                // PC端：保持原有配置（scale=1.0，高质量）
                // 移动端：快速模式使用scale=0.8，正常模式使用scale=0.9
                let scale, timeout, html2canvasOptions;
                
                if (isMobile) {
                    // 移动端：保持高质量（scale=1.0），优化其他配置以提升成功率
                    if (fastMode) {
                        // 快速模式：scale=1.0（保持高质量），但优化其他参数
                        scale = 1.0;
                        timeout = 20000; // 20秒超时（高质量需要更长时间）
                        html2canvasOptions = {
                            useCORS: true,
                            allowTaint: false, // 不允许跨域图片，提升速度
                            backgroundColor: '#1a1a1a', // 设置背景色，避免透明处理
                            scale: scale,
                            logging: false,
                            width: mapContainer.offsetWidth,
                            height: mapContainer.offsetHeight,
                            scrollX: 0,
                            scrollY: 0,
                            windowWidth: mapContainer.offsetWidth,
                            windowHeight: mapContainer.offsetHeight,
                            imageTimeout: 10000, // 增加图片加载超时，确保瓦片加载完成
                            removeContainer: true, // 移除容器，减少处理
                            foreignObjectRendering: false, // 禁用foreignObject，提升速度
                            ignoreElements: (element) => {
                                // 忽略不必要的元素
                                return element.classList && (
                                    element.classList.contains('leaflet-control-container') ||
                                    element.classList.contains('leaflet-control-zoom') ||
                                    element.classList.contains('api-usage-panel') ||
                                    element.classList.contains('map-type-indicator')
                                );
                            }
                        };
                    } else {
                        // 正常模式：scale=1.0（高质量），优化配置
                        scale = 1.0;
                        timeout = 25000; // 25秒超时（高质量需要更长时间）
                        html2canvasOptions = {
                            useCORS: true,
                            allowTaint: true,
                            backgroundColor: null,
                            scale: scale,
                            logging: false,
                            width: mapContainer.offsetWidth,
                            height: mapContainer.offsetHeight,
                            scrollX: 0,
                            scrollY: 0,
                            windowWidth: mapContainer.offsetWidth,
                            windowHeight: mapContainer.offsetHeight,
                            imageTimeout: 12000, // 增加图片加载超时
                            foreignObjectRendering: false
                        };
                    }
                } else {
                    // PC端：保持原有高质量配置（完全不变）
                    scale = 1.0;
                    timeout = 15000; // 15秒超时（保持不变）
                    html2canvasOptions = {
                        useCORS: true,
                        allowTaint: true,
                        backgroundColor: null,
                        scale: scale,
                        logging: false,
                        width: mapContainer.offsetWidth,
                        height: mapContainer.offsetHeight
                    };
                }
                
                let timeoutId = null;
                
                // 设置超时
                timeoutId = setTimeout(() => {
                    reject(new Error('EXPORT_TIMEOUT'));
                }, timeout);
                
                // 添加onclone处理（PC端和移动端都需要）
                html2canvasOptions.onclone = (clonedDoc) => {
                    // 确保克隆的文档中的样式正确
                    const clonedMapContainer = clonedDoc.querySelector('#map');
                    if (clonedMapContainer) {
                        clonedMapContainer.style.width = mapContainer.offsetWidth + 'px';
                        clonedMapContainer.style.height = mapContainer.offsetHeight + 'px';
                    }
                    
                    // 移动端快速模式：隐藏不必要的元素
                    if (isMobile && fastMode) {
                        const controls = clonedDoc.querySelectorAll('.leaflet-control-container, .api-usage-panel, .map-type-indicator');
                        controls.forEach(el => {
                            if (el) el.style.display = 'none';
                        });
                    }
                };
                
                // 使用html2canvas截图
                html2canvas(mapContainer, html2canvasOptions).then(canvas => {
                    // 清除超时
                    if (timeoutId) clearTimeout(timeoutId);
                    // 转换为base64（保持高质量，quality=1.0）
                    const dataURL = canvas.toDataURL('image/png', 1.0);
                    resolve(dataURL);
                }).catch(error => {
                    // 清除超时
                    if (timeoutId) clearTimeout(timeoutId);
                    console.error('导出地图失败:', error);
                    
                    // 移动端：如果失败且未重试，尝试快速模式重试
                    if (isMobile && retryCount === 0 && !fastMode) {
                        console.log('移动端导出失败，尝试快速模式重试...');
                        // 延迟后重试快速模式
                        setTimeout(() => {
                            this.exportMapAsImage(true, 1).then(resolve).catch(reject);
                        }, 500);
                        return;
                    }
                    
                    // 如果是移动端，返回特殊错误标识
                    if (isMobile) {
                        reject(new Error('EXPORT_FAILED_MOBILE'));
                    } else {
                        reject(error);
                    }
                });
                
            } catch (error) {
                console.error('导出地图时出错:', error);
                reject(error);
            }
        });
    }

    /**
     * 检测是否为移动设备
     * @returns {boolean}
     */
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    }

    /**
     * 检测是否为iOS设备
     * @returns {boolean}
     */
    isIOSDevice() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    /**
     * 生成图片查看页面的HTML（移动端优化）
     * @param {string} dataURL - Base64图片数据
     * @param {string} filename - 文件名
     * @param {string} hintText - 提示文字
     * @returns {string} HTML字符串
     */
    generateImageViewerHTML(dataURL, filename, hintText = '长按图片保存到相册') {
        const isMobile = this.isMobileDevice();
        return `
            <html>
                <head>
                    <title>${filename}</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
                    <meta name="apple-mobile-web-app-capable" content="yes">
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body {
                            margin: 0;
                            padding: ${isMobile ? '10px' : '20px'};
                            background: #000;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            touch-action: manipulation;
                        }
                        img {
                            max-width: 100%;
                            height: auto;
                            border-radius: ${isMobile ? '4px' : '8px'};
                            display: block;
                            user-select: none;
                            -webkit-user-select: none;
                            -webkit-touch-callout: default;
                        }
                        .hint {
                            position: fixed;
                            bottom: ${isMobile ? '15px' : '20px'};
                            left: 50%;
                            transform: translateX(-50%);
                            background: rgba(0,0,0,0.85);
                            color: white;
                            padding: ${isMobile ? '8px 16px' : '10px 20px'};
                            border-radius: 20px;
                            font-size: ${isMobile ? '12px' : '14px'};
                            text-align: center;
                            max-width: 90%;
                            z-index: 1000;
                        }
                        .share-hint {
                            position: fixed;
                            top: ${isMobile ? '15px' : '20px'};
                            right: ${isMobile ? '15px' : '20px'};
                            background: rgba(40, 167, 69, 0.9);
                            color: white;
                            padding: ${isMobile ? '6px 12px' : '8px 16px'};
                            border-radius: 15px;
                            font-size: ${isMobile ? '11px' : '13px'};
                            z-index: 1000;
                        }
                    </style>
                </head>
                <body>
                    <div class="share-hint">✅ 导出成功</div>
                    <img src="${dataURL}" alt="${filename}" id="heatmapImage">
                    <div class="hint">${hintText}</div>
                    <script>
                        // 移动端优化：支持双击放大
                        const img = document.getElementById('heatmapImage');
                        let scale = 1;
                        img.addEventListener('dblclick', function(e) {
                            if (scale === 1) {
                                scale = 2;
                                img.style.transform = 'scale(2)';
                                img.style.transformOrigin = e.offsetX + 'px ' + e.offsetY + 'px';
                            } else {
                                scale = 1;
                                img.style.transform = 'scale(1)';
                            }
                        });
                    </script>
                </body>
            </html>
        `;
    }

    /**
     * 在新窗口中打开图片
     * @param {string} dataURL - Base64图片数据
     * @param {string} filename - 文件名
     * @param {string} hintText - 提示文字
     * @returns {boolean} 是否成功打开
     */
    openImageInNewWindow(dataURL, filename, hintText = '长按图片保存到相册') {
        try {
            const newWindow = window.open('', '_blank');
            if (newWindow) {
                newWindow.document.write(this.generateImageViewerHTML(dataURL, filename, hintText));
                newWindow.document.close();
                return true;
            } else {
                // 弹窗被阻止，尝试在当前窗口显示
                console.warn('弹窗被阻止，尝试在当前页面显示图片');
                // 创建一个模态框显示图片
                const modal = document.createElement('div');
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.9);
                    z-index: 10000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    flex-direction: column;
                    padding: 20px;
                `;
                modal.innerHTML = `
                    <img src="${dataURL}" alt="${filename}" style="max-width: 100%; height: auto; border-radius: 8px;">
                    <div style="color: white; margin-top: 20px; text-align: center; padding: 10px 20px; background: rgba(0,0,0,0.8); border-radius: 20px;">
                        ${hintText}
                    </div>
                    <button onclick="this.parentElement.remove()" style="margin-top: 20px; padding: 10px 20px; background: #17a2b8; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        关闭
                    </button>
                `;
                document.body.appendChild(modal);
                return true;
            }
        } catch (error) {
            console.error('打开图片窗口失败:', error);
            return false;
        }
    }

    /**
     * 将DataURL转换为Blob
     * @param {string} dataURL - Base64图片数据
     * @returns {Promise<Blob>}
     */
    async dataURLtoBlob(dataURL) {
        const response = await fetch(dataURL);
        return await response.blob();
    }

    /**
     * 使用Web Share API分享图片（移动端优先）
     * @param {string} dataURL - Base64图片数据
     * @param {string} filename - 文件名
     * @returns {Promise<boolean>} 是否成功分享
     */
    async shareImageWithWebShare(dataURL, filename = 'cycling-heatmap.png') {
        // 检查Web Share API支持
        if (!navigator.share || !navigator.canShare) {
            return false;
        }

        try {
            // 转换dataURL为Blob
            const blob = await this.dataURLtoBlob(dataURL);
            const file = new File([blob], filename, { type: 'image/png' });
            
            // 检查是否可以分享文件
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: '我的骑行热力图',
                    text: '查看我的骑行轨迹热力图'
                });
                return true;
            }
        } catch (error) {
            // 用户取消分享不算错误
            if (error.name === 'AbortError') {
                console.log('用户取消了分享');
                return true; // 用户主动取消，视为成功
            }
            console.log('Web Share API失败，使用备用方案:', error);
        }
        return false;
    }

    /**
     * 在模态框中显示图片（改进版，避免弹窗被阻止）
     * @param {string} dataURL - Base64图片数据
     * @param {string} filename - 文件名
     * @param {string} hintText - 提示文字
     */
    showImageInModal(dataURL, filename = 'cycling-heatmap.png', hintText = '长按图片保存到相册') {
        // 移除已存在的模态框
        const existingModal = document.getElementById('imageExportModal');
        if (existingModal) {
            existingModal.remove();
        }

        const isMobile = this.isMobileDevice();
        const modal = document.createElement('div');
        modal.id = 'imageExportModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.95);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            padding: ${isMobile ? '10px' : '20px'};
        `;

        modal.innerHTML = `
            <div style="position: relative; max-width: 100%; max-height: 90vh; display: flex; flex-direction: column; align-items: center;">
                <div style="position: absolute; top: ${isMobile ? '-40px' : '-50px'}; right: 0; display: flex; gap: 10px;">
                    ${isMobile && navigator.share ? `
                        <button id="shareImageBtn" style="padding: ${isMobile ? '8px 16px' : '10px 20px'}; background: #28a745; color: white; border: none; border-radius: 20px; font-size: ${isMobile ? '12px' : '14px'}; cursor: pointer;">
                            📤 分享
                        </button>
                    ` : ''}
                    <button id="closeImageModalBtn" style="padding: ${isMobile ? '8px 16px' : '10px 20px'}; background: #6c757d; color: white; border: none; border-radius: 20px; font-size: ${isMobile ? '12px' : '14px'}; cursor: pointer;">
                        关闭
                    </button>
                </div>
                <img src="${dataURL}" alt="${filename}" id="exportedImage" style="max-width: 100%; max-height: 80vh; height: auto; border-radius: 8px; display: block; user-select: none; -webkit-user-select: none; -webkit-touch-callout: default;">
                <div style="color: white; margin-top: ${isMobile ? '15px' : '20px'}; text-align: center; padding: ${isMobile ? '8px 16px' : '10px 20px'}; background: rgba(0,0,0,0.8); border-radius: 20px; font-size: ${isMobile ? '12px' : '14px'}; max-width: 90%;">
                    ${hintText}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 关闭按钮
        const closeBtn = document.getElementById('closeImageModalBtn');
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // 分享按钮（如果支持）
        if (isMobile && navigator.share) {
            const shareBtn = document.getElementById('shareImageBtn');
            shareBtn.addEventListener('click', async () => {
                try {
                    const blob = await this.dataURLtoBlob(dataURL);
                    const file = new File([blob], filename, { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: '我的骑行热力图',
                            text: '查看我的骑行轨迹热力图'
                        });
                    }
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        console.error('分享失败:', error);
                    }
                }
            });
        }

        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    /**
     * 下载导出的图片
     * @param {string} dataURL - Base64图片数据
     * @param {string} filename - 文件名
     */
    downloadImage(dataURL, filename = 'cycling-heatmap.png') {
        try {
            // PC端：正常下载（完全不变）
            if (!this.isMobileDevice()) {
                const link = document.createElement('a');
                link.download = filename;
                link.href = dataURL;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                console.log('✓ 图片下载成功:', filename);
                return;
            }
            
            // 移动端：优先使用Web Share API，然后降级
            // 注意：Web Share API是异步的，但downloadImage是同步方法
            // 所以Web Share应该在调用downloadImage之前处理
            // 这里保留原有的降级逻辑作为最后备用
            
            // iOS设备：打开新窗口显示图片，让用户长按保存
            if (this.isIOSDevice()) {
                if (this.openImageInNewWindow(dataURL, filename, '长按图片保存到相册')) {
                    return;
                } else {
                    // 如果新窗口失败，使用模态框
                    this.showImageInModal(dataURL, filename, '长按图片保存到相册');
                    return;
                }
            }
            
            // Android或其他移动设备：尝试下载，如果失败则显示模态框
            try {
                const link = document.createElement('a');
                link.download = filename;
                link.href = dataURL;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                console.log('✓ 图片下载成功:', filename);
                return;
            } catch (e) {
                // 如果下载失败，显示模态框
                console.warn('下载失败，显示图片模态框:', e);
                this.showImageInModal(dataURL, filename, '长按图片保存');
                return;
            }
        } catch (error) {
            console.error('下载图片失败:', error);
            // 移动端失败时显示模态框而不是抛出错误
            if (this.isMobileDevice()) {
                this.showImageInModal(dataURL, filename, '长按图片保存到相册');
            } else {
                throw error;
            }
        }
    }

    /**
     * 导出并下载地图图片
     * @param {string} filename - 可选的文件名
     * @param {boolean} fastMode - 是否使用快速模式（仅移动端）
     * @returns {Promise<string>} Base64图片数据
     */
    async exportAndDownload(filename, fastMode = false) {
        try {
            // 生成时间戳文件名
            if (!filename) {
                const now = new Date();
                const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
                filename = `cycling-heatmap-${timestamp}.png`;
            }
            
            // 导出图片（移动端默认使用快速模式）
            const isMobile = this.isMobileDevice();
            const useFastMode = isMobile && fastMode;
            const dataURL = await this.exportMapAsImage(useFastMode, 0);
            
            // 下载图片
            this.downloadImage(dataURL, filename);
            
            return dataURL;
        } catch (error) {
            console.error('导出和下载失败:', error);
            throw error;
        }
    }

    /**
     * 进入全屏模式
     */
    enterFullscreen() {
        const mapContainer = this.map.getContainer();
        
        if (mapContainer.requestFullscreen) {
            mapContainer.requestFullscreen();
        } else if (mapContainer.webkitRequestFullscreen) {
            mapContainer.webkitRequestFullscreen();
        } else if (mapContainer.msRequestFullscreen) {
            mapContainer.msRequestFullscreen();
        }

        // 监听全屏变化事件
        const handleFullscreenChange = () => {
            // 延迟调整地图大小，确保容器尺寸已更新
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);
    }

    /**
     * 添加地图控件
     * @param {string} position - 控件位置 ('topleft', 'topright', 'bottomleft', 'bottomright')
     * @param {HTMLElement} element - 控件元素
     */
    addControl(position, element) {
        const control = L.control({ position });
        
        control.onAdd = function() {
            return element;
        };
        
        control.addTo(this.map);
        return control;
    }

    /**
     * 获取当前地图边界
     * @returns {Object} 地图边界信息
     */
    getMapBounds() {
        const bounds = this.map.getBounds();
        return {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
        };
    }

    /**
     * 获取地图统计信息
     * @returns {Object} 统计信息
     */
    getMapStats() {
        return {
            center: this.getMapCenter(),
            zoom: this.map.getZoom(),
            bounds: this.getMapBounds(),
            pointCount: this.currentPoints.length,
            mapStyle: this.mapStyle,
            heatmapOptions: this.heatmapOptions
        };
    }

    /**
     * 销毁地图实例
     */
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        this.heatLayer = null;
        this.currentPoints = [];
    }

    /**
     * 重新调整地图大小
     */
    invalidateSize() {
        if (this.map) {
            this.map.invalidateSize();
        }
    }

    /**
     * 添加标记点
     * @param {number} lat - 纬度
     * @param {number} lng - 经度
     * @param {string} popupText - 弹窗文本
     * @returns {L.Marker} 标记对象
     */
    addMarker(lat, lng, popupText) {
        const marker = L.marker([lat, lng]).addTo(this.map);
        
        if (popupText) {
            marker.bindPopup(popupText);
        }
        
        return marker;
    }

    /**
     * 移除所有标记
     */
    clearMarkers() {
        this.map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                this.map.removeLayer(layer);
            }
        });
    }
}

// 导出HeatmapRenderer类
window.HeatmapRenderer = HeatmapRenderer;
