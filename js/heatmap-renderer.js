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
        this.usageTracker = (Utils.isDefined(TiandituUsageTracker) && Utils.isFunction(TiandituUsageTracker))
            ? new TiandituUsageTracker() 
            : null;
        this.heatmapOptions = {
            radius: APP_CONFIG.HEATMAP.DEFAULT_RADIUS,
            blur: APP_CONFIG.HEATMAP.DEFAULT_BLUR,
            minOpacity: APP_CONFIG.HEATMAP.DEFAULT_OPACITY,
            maxZoom: APP_CONFIG.HEATMAP.MAX_ZOOM
        };
        
        // 空间索引相关
        this.spatialIndex = null;
        this.useSpatialIndex = false;
        this.spatialIndexThreshold = 100000; // 超过10万点才启用空间索引
        this.updateVisibleHeatmapDebounced = null;
        this.updateVisibleHeatmapTimeout = null; // 保存 timeout ID 以便清理
        
        // html2canvas 延迟加载相关
        this.html2canvasLoaded = false;
        this.html2canvasLoading = false;
        this.html2canvasLoadPromise = null;
        
        this.initializeMap();
        this.bindAutoSwitchEvent();
    }

    /**
     * 初始化地图
     */
    initializeMap() {
        // 使用默认值，防止MAP_CONFIG未加载的情况
        const defaultCenter = (Utils.isDefined(MAP_CONFIG) && MAP_CONFIG.DEFAULT_CENTER) 
            ? MAP_CONFIG.DEFAULT_CENTER 
            : [31.2304, 121.4737]; // 上海
        const defaultZoom = (Utils.isDefined(MAP_CONFIG) && MAP_CONFIG.DEFAULT_ZOOM) 
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
            // 如果使用空间索引，缩放后更新可见点（延迟执行，确保地图状态稳定）
            if (this.useSpatialIndex) {
                setTimeout(() => {
                    this.updateVisibleHeatmap();
                }, APP_CONFIG.DELAY.ZOOM_UPDATE);
            }
        });
    }

    /**
     * 绑定自动切换事件
     */
    bindAutoSwitchEvent() {
        document.addEventListener('tiandituAutoSwitch', (event) => {
            logger.info('天地图API配额接近限制，自动切换到英文地图');
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
            logger.warn(message);
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
     * 创建瓦片图层（公共方法，统一处理错误和配置）
     * @param {string} url - 瓦片图层URL
     * @param {Object} options - 配置选项
     * @param {string} options.attribution - 版权信息
     * @param {string} options.subdomains - 子域名
     * @param {number} options.maxZoom - 最大缩放级别
     * @param {Function} options.onError - 错误回调函数
     * @param {Function} options.onTileLoad - 瓦片加载回调函数
     * @returns {L.TileLayer} 瓦片图层对象
     */
    createTileLayer(url, options = {}) {
        const defaultOptions = {
            attribution: options.attribution || '',
            subdomains: options.subdomains || 'abcd',
            maxZoom: options.maxZoom || 18
        };
        
        const layer = L.tileLayer(url, { ...defaultOptions, ...options });
        
        // 统一错误处理
        layer.on('tileerror', (e) => {
            if (options.onError) {
                options.onError(e);
            } else {
                logger.warn('Tile loading error:', e);
            }
        });
        
        // 瓦片加载回调
        if (options.onTileLoad) {
            layer.on('tileload', options.onTileLoad);
        }
        
        return layer;
    }

    /**
     * 创建天地图矢量图层
     */
    createTiandituVectorLayers() {
        // 检查MAP_CONFIG是否可用
        if (typeof MAP_CONFIG === 'undefined') {
            logger.warn('MAP_CONFIG未加载，切换到英文地图');
            this.createEnglishLayers();
            this.triggerApiKeyMissingEvent();
            return;
        }

        // 检查API密钥是否已配置
        if (!MAP_CONFIG.hasApiKey()) {
            logger.warn('未配置天地图API密钥，切换到英文地图');
            this.createEnglishLayers();
            this.triggerApiKeyMissingEvent();
            return;
        }

        if (this.usageTracker && (!this.usageTracker.canUseTianditu('vector') || !this.usageTracker.canUseTianditu('label'))) {
            logger.warn('天地图API配额已用完，切换到英文地图');
            this.createEnglishLayers();
            return;
        }

        const vectorUrl = MAP_CONFIG.buildTiandituUrl('vector');
        const labelUrl = MAP_CONFIG.buildTiandituUrl('vector_label');

        if (!vectorUrl || !labelUrl) {
            logger.warn('无法构建天地图URL，切换到英文地图');
            this.createEnglishLayers();
            this.triggerApiKeyMissingEvent();
            return;
        }

        // 创建矢量底图层
        const vectorLayer = this.createTileLayer(vectorUrl, {
            attribution: '&copy; <a href="http://www.tianditu.gov.cn/">天地图</a>',
            subdomains: MAP_CONFIG.TIANDITU_SUBDOMAINS,
            maxZoom: 18,
            onError: (e) => logger.warn('天地图矢量底图加载失败:', e),
            onTileLoad: this.usageTracker ? () => this.usageTracker.trackVectorRequest() : null
        });

        // 创建中文标注层
        const labelLayer = this.createTileLayer(labelUrl, {
            attribution: '',
            subdomains: MAP_CONFIG.TIANDITU_SUBDOMAINS,
            maxZoom: 18,
            onError: (e) => logger.warn('天地图标注层加载失败:', e),
            onTileLoad: this.usageTracker ? () => this.usageTracker.trackLabelRequest() : null
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
            logger.warn('MAP_CONFIG未加载，切换到英文地图');
            this.createEnglishLayers();
            this.triggerApiKeyMissingEvent();
            return;
        }

        // 检查API密钥是否已配置
        if (!MAP_CONFIG.hasApiKey()) {
            logger.warn('未配置天地图API密钥，切换到英文地图');
            this.createEnglishLayers();
            this.triggerApiKeyMissingEvent();
            return;
        }

        if (this.usageTracker && (!this.usageTracker.canUseTianditu('image') || !this.usageTracker.canUseTianditu('label'))) {
            logger.warn('天地图API配额已用完，切换到英文地图');
            this.createEnglishLayers();
            return;
        }

        const imageUrl = MAP_CONFIG.buildTiandituUrl('image');
        const imageLabelUrl = MAP_CONFIG.buildTiandituUrl('image_label');

        if (!imageUrl || !imageLabelUrl) {
            logger.warn('无法构建天地图URL，切换到英文地图');
            this.createEnglishLayers();
            this.triggerApiKeyMissingEvent();
            return;
        }

        // 创建影像底图层
        const imageLayer = this.createTileLayer(imageUrl, {
            attribution: '&copy; <a href="http://www.tianditu.gov.cn/">天地图</a>',
            subdomains: MAP_CONFIG.TIANDITU_SUBDOMAINS,
            maxZoom: 18,
            onError: (e) => logger.warn('天地图影像底图加载失败:', e),
            onTileLoad: this.usageTracker ? () => this.usageTracker.trackImageRequest() : null
        });

        // 创建影像标注层
        const imageLabelLayer = this.createTileLayer(imageLabelUrl, {
            attribution: '',
            subdomains: MAP_CONFIG.TIANDITU_SUBDOMAINS,
            maxZoom: 18,
            onError: (e) => logger.warn('天地图影像标注层加载失败:', e),
            onTileLoad: this.usageTracker ? () => this.usageTracker.trackLabelRequest() : null
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
        
        const url = this.mapStyle === 'light'
            ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        
        tileLayer = this.createTileLayer(url, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20,
            onError: (e) => logger.warn('英文地图瓦片加载失败:', e)
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
            logger.warn('没有轨迹点数据');
            return;
        }

        this.currentPoints = points;

        // 判断是否需要使用空间索引（只在超大数据集时启用）
        this.useSpatialIndex = points.length > this.spatialIndexThreshold;
        
        if (this.useSpatialIndex) {
            // 构建空间索引
            this.spatialIndex = new HeatmapRenderer.SpatialIndex(points);
            logger.success(`✓ 已构建空间索引，共 ${points.length.toLocaleString()} 个点`);
            
            // 绑定地图移动事件，动态更新可见点
            this.bindMapMoveEvents();
            
            // 初始渲染：先调整地图视图，然后只渲染当前视野范围内的点
            // 先调整视图以显示所有点
            if (!this.map.hasInitialBounds) {
                this.fitMapToPoints(points);
                this.map.hasInitialBounds = true;
            }
            
            // 获取当前视野范围内的点（如果地图已初始化）
            try {
                const bounds = this.map.getBounds();
                if (bounds && bounds.getSouth && bounds.getNorth) {
                    const visiblePoints = this.spatialIndex.getPointsInBounds(bounds);
                    points = visiblePoints;
                    logger.success(`✓ 空间索引：当前视野内 ${visiblePoints.length.toLocaleString()} 个点`);
                } else {
                    logger.warn('地图边界未初始化，使用全部点');
                }
            } catch (error) {
                logger.warn('获取地图边界时出错，使用全部点:', error);
                // 如果获取边界失败，使用全部点
            }
        } else {
            // 小数据集：清除空间索引，移除事件监听
            this.spatialIndex = null;
            this.unbindMapMoveEvents();
        }

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

        // 自动调整地图视图以显示所有点（仅在小数据集或首次渲染时）
        if (!this.useSpatialIndex && !this.map.hasInitialBounds) {
            this.fitMapToPoints(this.currentPoints);
            this.map.hasInitialBounds = true;
        }

        logger.success(`✓ 热力图渲染完成，共 ${points.length.toLocaleString()} 个点`);
    }

    /**
     * 渲染热力图（用于视频生成）
     * 与renderHeatmap的区别：不重新调整地图视图，保持当前视图，禁用空间索引
     * @param {Array} points - 轨迹点数组 [[lat, lon], ...]
     */
    renderHeatmapWithTimeFilter(points) {
        if (!points || points.length === 0) {
            logger.warn('没有轨迹点数据');
            return;
        }

        // 保存当前点（用于视频生成时的累积显示）
        this.currentPoints = points;

        // 对于视频生成，不使用空间索引（需要显示所有点）
        // 但如果是超大数据集，仍然需要优化
        const useSpatialIndexForVideo = false; // 视频生成时禁用空间索引，确保所有点都显示

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

        // 注意：不调整地图视图，保持当前视图（用于视频生成时保持一致的视角）
        // 首次调用时，如果地图还没有初始边界，才调整视图
        if (!this.map.hasInitialBounds && points.length > 0) {
            this.fitMapToPoints(points);
            this.map.hasInitialBounds = true;
        }
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

        // 使用循环计算边界，避免栈溢出（当点数过多时，展开运算符会导致栈溢出）
        let minLat = Infinity, maxLat = -Infinity;
        let minLon = Infinity, maxLon = -Infinity;

        for (let i = 0; i < points.length; i++) {
            const lat = points[i][0];
            const lon = points[i][1];
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
        }

        const bounds = L.latLngBounds([
            [minLat, minLon],
            [maxLat, maxLon]
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
        // 低缩放级别时减小半径和模糊，避免过度糊在一起
        let dynamicRadius = this.heatmapOptions.radius;
        let dynamicBlur = this.heatmapOptions.blur;

        if (currentZoom < 8) {
            // 极低缩放级别：显著减小半径和模糊，让线条更细
            dynamicRadius = Math.max(1, this.heatmapOptions.radius * 0.5);
            dynamicBlur = Math.max(1, this.heatmapOptions.blur * 0.6);
        } else if (currentZoom < 10) {
            // 低缩放级别：适度减小半径和模糊
            dynamicRadius = Math.max(1, this.heatmapOptions.radius * 0.7);
            dynamicBlur = Math.max(1, this.heatmapOptions.blur * 0.8);
        } else if (currentZoom > 15) {
            // 高缩放级别：稍微减小，保持细节
            dynamicRadius = Math.max(1, this.heatmapOptions.radius * 0.9);
            dynamicBlur = Math.max(1, this.heatmapOptions.blur * 0.9);
        } else {
            // 中等缩放级别（10-15）：使用原始参数
            dynamicRadius = this.heatmapOptions.radius;
            dynamicBlur = this.heatmapOptions.blur;
        }

        // 更新热力图选项
        this.heatLayer.setOptions({
            radius: dynamicRadius,
            blur: dynamicBlur
        });
    }

    /**
     * 空间索引类 - 用于优化超大数据集的热力图渲染
     */
    static SpatialIndex = class {
        constructor(points, cellSize = APP_CONFIG.SPATIAL_INDEX.CELL_SIZE) {
            this.cellSize = cellSize;
            this.grid = new Map();
            this.points = points;
            
            // 构建空间网格索引
            points.forEach((point, index) => {
                const key = this.getCellKey(point[0], point[1]);
                if (!this.grid.has(key)) {
                    this.grid.set(key, []);
                }
                this.grid.get(key).push(index);
            });
        }
        
        /**
         * 获取点的网格键
         * @param {number} lat - 纬度
         * @param {number} lon - 经度
         * @returns {string} 网格键
         */
        getCellKey(lat, lon) {
            const latCell = Math.floor(lat / this.cellSize);
            const lonCell = Math.floor(lon / this.cellSize);
            return `${latCell},${lonCell}`;
        }
        
        /**
         * 获取指定边界范围内的点
         * @param {L.LatLngBounds} bounds - 地图边界
         * @returns {Array} 可见点数组
         */
        getPointsInBounds(bounds) {
            const visiblePoints = [];
            const minLat = bounds.getSouth();
            const maxLat = bounds.getNorth();
            const minLon = bounds.getWest();
            const maxLon = bounds.getEast();
            
            // 扩展边界，确保边缘的点也被包含（避免边界切割）
            const padding = this.cellSize * APP_CONFIG.SPATIAL_INDEX.PADDING_MULTIPLIER;
            const expandedMinLat = minLat - padding;
            const expandedMaxLat = maxLat + padding;
            const expandedMinLon = minLon - padding;
            const expandedMaxLon = maxLon + padding;
            
            const minLatCell = Math.floor(expandedMinLat / this.cellSize);
            const maxLatCell = Math.floor(expandedMaxLat / this.cellSize);
            const minLonCell = Math.floor(expandedMinLon / this.cellSize);
            const maxLonCell = Math.floor(expandedMaxLon / this.cellSize);
            
            // 遍历相关网格单元
            for (let lat = minLatCell; lat <= maxLatCell; lat++) {
                for (let lon = minLonCell; lon <= maxLonCell; lon++) {
                    const key = `${lat},${lon}`;
                    if (this.grid.has(key)) {
                        const indices = this.grid.get(key);
                        indices.forEach(idx => {
                            const point = this.points[idx];
                            // 精确检查点是否在边界内
                            if (point[0] >= minLat && point[0] <= maxLat &&
                                point[1] >= minLon && point[1] <= maxLon) {
                                visiblePoints.push(point);
                            }
                        });
                    }
                }
            }
            
            return visiblePoints;
        }
    };

    /**
     * 绑定地图移动事件，用于动态更新可见热力图
     */
    bindMapMoveEvents() {
        if (this.updateVisibleHeatmapDebounced) {
            return; // 已经绑定
        }
        
        // 防抖处理，避免频繁更新
        this.updateVisibleHeatmapDebounced = () => {
            // 清理旧的 timeout
            if (this.updateVisibleHeatmapTimeout !== null) {
                clearTimeout(this.updateVisibleHeatmapTimeout);
            }
            
            this.updateVisibleHeatmapTimeout = setTimeout(() => {
                // 确保地图状态稳定后再更新
                if (this.map && this.map.getBounds && this.useSpatialIndex) {
                    this.updateVisibleHeatmap();
                }
                this.updateVisibleHeatmapTimeout = null; // 执行完成后清空
            }, APP_CONFIG.DELAY.DEBOUNCE_MEDIUM);
        };
        
        this.map.on('moveend', this.updateVisibleHeatmapDebounced);
    }

    /**
     * 解绑地图移动事件
     */
    unbindMapMoveEvents() {
        if (this.updateVisibleHeatmapDebounced) {
            this.map.off('moveend', this.updateVisibleHeatmapDebounced);
            this.updateVisibleHeatmapDebounced = null;
        }
    }

    /**
     * 更新可见热力图（仅渲染当前视野范围内的点）
     */
    updateVisibleHeatmap() {
        if (!this.useSpatialIndex || !this.spatialIndex || !this.heatLayer || !this.map) {
            return;
        }

        // 检查地图是否已初始化
        if (!this.map.getBounds || typeof this.map.getBounds !== 'function') {
            return;
        }

        try {
            const bounds = this.map.getBounds();
            if (!bounds || !bounds.getSouth || !bounds.getNorth) {
                return;
            }

            const visiblePoints = this.spatialIndex.getPointsInBounds(bounds);

            if (visiblePoints.length === 0) {
                return;
            }

            // Leaflet heatLayer 不支持 setLatLngs，需要重新创建图层
            // 但保留当前的选项设置
            const currentOptions = {
                radius: this.heatmapOptions.radius,
                blur: this.heatmapOptions.blur,
                minOpacity: this.heatmapOptions.minOpacity,
                maxZoom: this.heatmapOptions.maxZoom,
                gradient: this.getStravaGradient()
            };
            
            // 移除旧图层（如果存在）
            if (this.heatLayer && this.map.hasLayer(this.heatLayer)) {
                this.map.removeLayer(this.heatLayer);
            }
            
            // 创建新图层
            this.heatLayer = L.heatLayer(visiblePoints, currentOptions);
            this.heatLayer.addTo(this.map);
        } catch (error) {
            logger.warn('更新可见热力图时出错:', error);
            // 出错时不更新，保持当前状态
        }
    }

    /**
     * 清除热力图
     */
    clearHeatmap() {
        // 清除空间索引相关
        this.spatialIndex = null;
        this.useSpatialIndex = false;
        this.unbindMapMoveEvents();
        if (this.map) {
            this.map.hasInitialBounds = false;
        }
        
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
                // 直接使用全局 html2canvas 函数（与之前能工作的版本一致）
                if (typeof html2canvas === 'undefined' || typeof html2canvas !== 'function') {
                    reject(new Error('html2canvas 库未加载，无法导出'));
                    return;
                }

                const mapContainer = this.map.getContainer();
                const isMobile = this.isMobileDevice();
                
                // PC端：保持原有配置（scale=1.0，高质量）
                // 移动端：快速模式使用scale=0.8，正常模式使用scale=0.9
                let scale, html2canvasOptions;
                
                if (isMobile) {
                    // 移动端：保持高质量（scale=1.0），优化其他配置以提升成功率
                    if (fastMode) {
                        // 快速模式：scale=1.0（保持高质量），但优化其他参数
                        scale = 1.0;
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
                            imageTimeout: 8000, // 优化：减少图片加载超时时间（从10秒降到8秒）
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
                        // 正常模式：scale=1.0（高质量），与之前能工作的版本一致
                        scale = 1.0;
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
                            imageTimeout: 12000 // 恢复为12秒（与之前能工作的版本一致）
                        };
                    }
                } else {
                    // PC端：完全使用原有配置（与之前能工作的版本一致）
                    scale = 1.0;
                    // 注意：PC端超时由main.js统一管理，这里不设置超时
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
                
                // 添加onclone处理（PC端和移动端快速模式）
                html2canvasOptions.onclone = (clonedDoc) => {
                    // 确保克隆的文档中的样式正确
                    const clonedMapContainer = clonedDoc.querySelector('#map');
                    if (clonedMapContainer) {
                        clonedMapContainer.style.width = mapContainer.offsetWidth + 'px';
                        clonedMapContainer.style.height = mapContainer.offsetHeight + 'px';
                    }
                    
                    // 移动端快速模式：隐藏不必要的元素以提升速度
                    if (isMobile && fastMode) {
                        const controls = clonedDoc.querySelectorAll('.leaflet-control-container, .api-usage-panel, .map-type-indicator');
                        controls.forEach(el => {
                            if (el) el.style.display = 'none';
                        });
                    }
                };
                
                // 使用html2canvas截图（直接使用全局函数）
                html2canvas(mapContainer, html2canvasOptions).then(canvas => {
                    // 转换为base64（保持高质量，quality=1.0）
                    const dataURL = canvas.toDataURL('image/png', 1.0);
                    resolve(dataURL);
                }).catch(error => {
                    logger.error('导出地图失败:', error);
                    
                    // 移动端：如果失败且未重试，尝试快速模式重试
                    if (isMobile && retryCount === 0 && !fastMode) {
                        logger.info('移动端导出失败，尝试快速模式重试...');
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
                logger.error('导出地图时出错:', error);
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
     * 动态加载 html2canvas 库
     * @returns {Promise<void>}
     */
    loadHtml2Canvas() {
        // 如果已经加载，直接返回（使用安全的检查方式）
        const checkLoaded = () => {
            try {
                if (typeof window !== 'undefined' && window.html2canvas && typeof window.html2canvas === 'function') {
                    return true;
                }
                if (typeof html2canvas !== 'undefined' && typeof html2canvas === 'function') {
                    return true;
                }
            } catch (e) {
                return false;
            }
            return false;
        };
        
        if (this.html2canvasLoaded && checkLoaded()) {
            return Promise.resolve();
        }

        // 如果正在加载，返回现有的 Promise
        if (this.html2canvasLoading && this.html2canvasLoadPromise) {
            return this.html2canvasLoadPromise;
        }

        // 开始加载
        this.html2canvasLoading = true;
        this.html2canvasLoadPromise = new Promise((resolve, reject) => {
            // 检查是否已经存在（可能通过其他方式加载，使用安全的检查方式）
            const checkExists = () => {
                try {
                    if (typeof window !== 'undefined' && window.html2canvas && typeof window.html2canvas === 'function') {
                        return window.html2canvas;
                    }
                    if (typeof html2canvas !== 'undefined' && typeof html2canvas === 'function') {
                        return html2canvas;
                    }
                } catch (e) {
                    return null;
                }
                return null;
            };
            
            const existingLib = checkExists();
            if (existingLib) {
                // 确保设置到 window
                window.html2canvas = existingLib;
                this.html2canvasLoaded = true;
                this.html2canvasLoading = false;
                resolve();
                return;
            }

            // 创建 script 标签动态加载
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js';
            script.async = true;
            
            // 设置超时（30秒）
            const timeoutId = setTimeout(() => {
                script.remove();
                this.html2canvasLoading = false;
                this.html2canvasLoadPromise = null;
                reject(new Error('html2canvas 库加载超时，请检查网络连接'));
            }, 30000);

            // 加载成功
            script.onload = () => {
                clearTimeout(timeoutId);
                // 等待库完全初始化，使用轮询检查（最多等待5秒）
                let attempts = 0;
                const maxAttempts = 50; // 50 * 100ms = 5秒
                const checkInterval = setInterval(() => {
                    attempts++;
                    // 检查多种可能的全局变量名（使用安全的检查方式）
                    let html2canvasLib = null;
                    try {
                        // 优先检查 window.html2canvas
                        if (typeof window !== 'undefined' && window.html2canvas && typeof window.html2canvas === 'function') {
                            html2canvasLib = window.html2canvas;
                        } else if (typeof html2canvas !== 'undefined' && typeof html2canvas === 'function') {
                            html2canvasLib = html2canvas;
                        }
                    } catch (e) {
                        // 如果访问抛出错误，继续等待
                        html2canvasLib = null;
                    }
                    
                    if (html2canvasLib) {
                        clearInterval(checkInterval);
                        // 确保全局可用（无论是否已定义，都设置到 window 和全局）
                        window.html2canvas = html2canvasLib;
                        // 尝试设置全局变量（如果可能）
                        try {
                            if (typeof globalThis !== 'undefined') {
                                globalThis.html2canvas = html2canvasLib;
                            }
                        } catch (e) {
                            // 忽略错误
                        }
                        this.html2canvasLoaded = true;
                        this.html2canvasLoading = false;
                        logger.info('html2canvas 库加载成功');
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        this.html2canvasLoading = false;
                        this.html2canvasLoadPromise = null;
                        reject(new Error('html2canvas 库加载失败：库未正确初始化（超时）'));
                    }
                }, 100);
            };

            // 加载失败
            script.onerror = () => {
                clearTimeout(timeoutId);
                script.remove();
                this.html2canvasLoading = false;
                this.html2canvasLoadPromise = null;
                reject(new Error('html2canvas 库加载失败，请检查网络连接'));
            };

            // 添加到页面
            document.head.appendChild(script);
        });

        return this.html2canvasLoadPromise;
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
                logger.warn('弹窗被阻止，尝试在当前页面显示图片');
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
            logger.error('打开图片窗口失败:', error);
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
                return true; // 用户主动取消，视为成功
            }
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
                        logger.error('分享失败:', error);
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
                logger.success('✓ 图片下载成功:', filename);
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
                logger.success('✓ 图片下载成功:', filename);
                return;
            } catch (e) {
                // 如果下载失败，显示模态框
                logger.warn('下载失败，显示图片模态框:', e);
                this.showImageInModal(dataURL, filename, '长按图片保存');
                return;
            }
        } catch (error) {
            logger.error('下载图片失败:', error);
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
            logger.error('导出和下载失败:', error);
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
