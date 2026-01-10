/**
 * 地图配置文件 - 天地图API配置
 */

const MAP_CONFIG = {
    // 默认地图设置 (上海)
    DEFAULT_CENTER: [31.2304, 121.4737], // 上海市中心
    DEFAULT_ZOOM: 11,
    
    // API配额限制 (个人开发者)
    VECTOR_DAILY_LIMIT: 10000,    // 矢量底图每日限制
    LABEL_DAILY_LIMIT: 10000,     // 矢量注记每日限制
    IMAGE_DAILY_LIMIT: 10000,     // 影像底图每日限制
    
    // 警告阈值
    WARNING_THRESHOLD: 8000,      // 80% 警告
    DANGER_THRESHOLD: 9000,       // 90% 危险警告
    AUTO_SWITCH_THRESHOLD: 9500,  // 95% 自动切换
    
    // 天地图子域名
    TIANDITU_SUBDOMAINS: '01234567',
    
    /**
     * 获取天地图API密钥
     * @returns {string} API密钥，如果未配置则返回空字符串
     */
    getApiKey() {
        return localStorage.getItem('tianditu_api_key') || '';
    },
    
    /**
     * 设置天地图API密钥
     * @param {string} key - API密钥
     */
    setApiKey(key) {
        if (key && key.trim()) {
            localStorage.setItem('tianditu_api_key', key.trim());
        } else {
            localStorage.removeItem('tianditu_api_key');
        }
    },
    
    /**
     * 检查是否已配置API密钥
     * @returns {boolean} 是否已配置密钥
     */
    hasApiKey() {
        const key = this.getApiKey();
        return key && key.trim().length > 0;
    },
    
    /**
     * 构建天地图URL
     * @param {string} layerType - 图层类型 ('vector', 'vector_label', 'image', 'image_label')
     * @returns {string} 完整的URL模板
     */
    buildTiandituUrl(layerType) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            return '';
        }
        
        const baseUrl = 'https://t{s}.tianditu.gov.cn';
        const urlTemplates = {
            'vector': `${baseUrl}/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${apiKey}`,
            'vector_label': `${baseUrl}/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${apiKey}`,
            'image': `${baseUrl}/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${apiKey}`,
            'image_label': `${baseUrl}/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${apiKey}`
        };
        
        return urlTemplates[layerType] || '';
    },
    
    /**
     * 获取天地图服务URL（向后兼容）
     * @returns {Object} URL对象
     */
    get TIANDITU_URLS() {
        return {
            VECTOR: this.buildTiandituUrl('vector'),
            VECTOR_LABEL: this.buildTiandituUrl('vector_label'),
            IMAGE: this.buildTiandituUrl('image'),
            IMAGE_LABEL: this.buildTiandituUrl('image_label')
        };
    }
};

/**
 * 天地图API使用量跟踪器
 */
class TiandituUsageTracker {
    constructor() {
        this.loadUsageFromStorage();
        this.autoSwitched = false;
    }
    
    /**
     * 从本地存储加载使用量数据
     */
    loadUsageFromStorage() {
        const today = new Date().toDateString();
        const lastResetDate = localStorage.getItem('tianditu_last_reset') || today;
        
        // 检查是否需要重置计数
        if (today !== lastResetDate) {
            this.resetDailyUsage();
        } else {
            this.vectorUsage = parseInt(localStorage.getItem('tianditu_vector_count') || '0');
            this.labelUsage = parseInt(localStorage.getItem('tianditu_label_count') || '0');
            this.imageUsage = parseInt(localStorage.getItem('tianditu_image_count') || '0');
        }
        
        this.lastResetDate = lastResetDate;
    }
    
    /**
     * 重置每日使用量
     */
    resetDailyUsage() {
        this.vectorUsage = 0;
        this.labelUsage = 0;
        this.imageUsage = 0;
        this.autoSwitched = false;
        
        const today = new Date().toDateString();
        localStorage.setItem('tianditu_last_reset', today);
        localStorage.setItem('tianditu_vector_count', '0');
        localStorage.setItem('tianditu_label_count', '0');
        localStorage.setItem('tianditu_image_count', '0');
        
        this.lastResetDate = today;
    }
    
    /**
     * 跟踪矢量底图请求
     */
    trackVectorRequest() {
        this.vectorUsage++;
        localStorage.setItem('tianditu_vector_count', this.vectorUsage.toString());
        this.updateUsageDisplay();
        this.checkAutoSwitch();
        return this.vectorUsage;
    }
    
    /**
     * 跟踪标注请求
     */
    trackLabelRequest() {
        this.labelUsage++;
        localStorage.setItem('tianditu_label_count', this.labelUsage.toString());
        this.updateUsageDisplay();
        this.checkAutoSwitch();
        return this.labelUsage;
    }
    
    /**
     * 跟踪影像请求
     */
    trackImageRequest() {
        this.imageUsage++;
        localStorage.setItem('tianditu_image_count', this.imageUsage.toString());
        this.updateUsageDisplay();
        this.checkAutoSwitch();
        return this.imageUsage;
    }
    
    /**
     * 检查是否需要自动切换
     */
    checkAutoSwitch() {
        if (this.autoSwitched) return false;
        
        const shouldSwitch = this.vectorUsage >= MAP_CONFIG.AUTO_SWITCH_THRESHOLD || 
                           this.labelUsage >= MAP_CONFIG.AUTO_SWITCH_THRESHOLD ||
                           this.imageUsage >= MAP_CONFIG.AUTO_SWITCH_THRESHOLD;
        
        if (shouldSwitch) {
            this.autoSwitched = true;
            this.triggerAutoSwitch();
            return true;
        }
        
        return false;
    }
    
    /**
     * 触发自动切换事件
     */
    triggerAutoSwitch() {
        // 触发自定义事件，通知地图渲染器切换
        const event = new CustomEvent('tiandituAutoSwitch', {
            detail: {
                reason: 'API配额接近限制',
                vectorUsage: this.vectorUsage,
                labelUsage: this.labelUsage,
                imageUsage: this.imageUsage
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 更新使用量显示
     */
    updateUsageDisplay() {
        // 更新矢量使用量
        const vectorCountEl = document.getElementById('vectorCount');
        const vectorBarEl = document.getElementById('vectorBar');
        if (vectorCountEl) {
            vectorCountEl.textContent = this.vectorUsage.toLocaleString();
        }
        if (vectorBarEl) {
            const percentage = (this.vectorUsage / MAP_CONFIG.VECTOR_DAILY_LIMIT) * 100;
            vectorBarEl.style.width = Math.min(percentage, 100) + '%';
            
            // 根据使用量设置颜色
            if (percentage >= 95) {
                vectorBarEl.className = 'usage-fill danger';
            } else if (percentage >= 90) {
                vectorBarEl.className = 'usage-fill warning';
            } else if (percentage >= 80) {
                vectorBarEl.className = 'usage-fill caution';
            } else {
                vectorBarEl.className = 'usage-fill normal';
            }
        }
        
        // 更新标注使用量
        const labelCountEl = document.getElementById('labelCount');
        const labelBarEl = document.getElementById('labelBar');
        if (labelCountEl) {
            labelCountEl.textContent = this.labelUsage.toLocaleString();
        }
        if (labelBarEl) {
            const percentage = (this.labelUsage / MAP_CONFIG.LABEL_DAILY_LIMIT) * 100;
            labelBarEl.style.width = Math.min(percentage, 100) + '%';
            
            // 根据使用量设置颜色
            if (percentage >= 95) {
                labelBarEl.className = 'usage-fill danger';
            } else if (percentage >= 90) {
                labelBarEl.className = 'usage-fill warning';
            } else if (percentage >= 80) {
                labelBarEl.className = 'usage-fill caution';
            } else {
                labelBarEl.className = 'usage-fill normal';
            }
        }
    }
    
    /**
     * 获取使用量统计
     */
    getUsageStats() {
        return {
            vector: {
                count: this.vectorUsage,
                limit: MAP_CONFIG.VECTOR_DAILY_LIMIT,
                percentage: (this.vectorUsage / MAP_CONFIG.VECTOR_DAILY_LIMIT) * 100
            },
            label: {
                count: this.labelUsage,
                limit: MAP_CONFIG.LABEL_DAILY_LIMIT,
                percentage: (this.labelUsage / MAP_CONFIG.LABEL_DAILY_LIMIT) * 100
            },
            image: {
                count: this.imageUsage,
                limit: MAP_CONFIG.IMAGE_DAILY_LIMIT,
                percentage: (this.imageUsage / MAP_CONFIG.IMAGE_DAILY_LIMIT) * 100
            },
            autoSwitched: this.autoSwitched
        };
    }
    
    /**
     * 检查是否可以使用天地图服务
     */
    canUseTianditu(serviceType = 'vector') {
        switch (serviceType) {
            case 'vector':
                return this.vectorUsage < MAP_CONFIG.VECTOR_DAILY_LIMIT;
            case 'label':
                return this.labelUsage < MAP_CONFIG.LABEL_DAILY_LIMIT;
            case 'image':
                return this.imageUsage < MAP_CONFIG.IMAGE_DAILY_LIMIT;
            default:
                return this.vectorUsage < MAP_CONFIG.VECTOR_DAILY_LIMIT && 
                       this.labelUsage < MAP_CONFIG.LABEL_DAILY_LIMIT;
        }
    }
}

// 导出配置和类
window.MAP_CONFIG = MAP_CONFIG;
window.TiandituUsageTracker = TiandituUsageTracker;
