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
    async exportMapAsImage() {
        return new Promise((resolve, reject) => {
            try {
                const mapContainer = this.map.getContainer();
                
                // 使用html2canvas截图
                html2canvas(mapContainer, {
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: null,
                    scale: 1,
                    logging: false,
                    width: mapContainer.offsetWidth,
                    height: mapContainer.offsetHeight,
                    onclone: (clonedDoc) => {
                        // 确保克隆的文档中的样式正确
                        const clonedMapContainer = clonedDoc.querySelector('#map');
                        if (clonedMapContainer) {
                            clonedMapContainer.style.width = mapContainer.offsetWidth + 'px';
                            clonedMapContainer.style.height = mapContainer.offsetHeight + 'px';
                        }
                    }
                }).then(canvas => {
                    // 转换为base64
                    const dataURL = canvas.toDataURL('image/png', 1.0);
                    resolve(dataURL);
                }).catch(error => {
                    console.error('导出地图失败:', error);
                    reject(error);
                });
                
            } catch (error) {
                console.error('导出地图时出错:', error);
                reject(error);
            }
        });
    }

    /**
     * 下载导出的图片
     * @param {string} dataURL - Base64图片数据
     * @param {string} filename - 文件名
     */
    downloadImage(dataURL, filename = 'cycling-heatmap.png') {
        try {
            // 创建下载链接
            const link = document.createElement('a');
            link.download = filename;
            link.href = dataURL;
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('✓ 图片下载成功:', filename);
        } catch (error) {
            console.error('下载图片失败:', error);
            throw error;
        }
    }

    /**
     * 导出并下载地图图片
     * @param {string} filename - 可选的文件名
     * @returns {Promise<void>}
     */
    async exportAndDownload(filename) {
        try {
            // 生成时间戳文件名
            if (!filename) {
                const now = new Date();
                const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
                filename = `cycling-heatmap-${timestamp}.png`;
            }
            
            // 导出图片
            const dataURL = await this.exportMapAsImage();
            
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
