/**
 * 工具类 - 提供通用的工具方法
 */

/**
 * 日志管理器 - 统一管理日志输出
 */
class Logger {
    constructor() {
        // 检测是否为开发环境
        this.isDevelopment = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname.includes('dev');
        
        // 日志级别: 'debug' | 'info' | 'warn' | 'error'
        this.level = this.isDevelopment ? 'debug' : 'warn';
        
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
    }
    
    /**
     * 设置日志级别
     * @param {string} level - 日志级别
     */
    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.level = level;
        }
    }
    
    /**
     * 检查是否应该输出日志
     * @param {string} level - 日志级别
     * @returns {boolean}
     */
    shouldLog(level) {
        return this.levels[level] >= this.levels[this.level];
    }
    
    /**
     * 输出调试日志
     */
    debug(...args) {
        if (this.shouldLog('debug')) {
            console.log('[DEBUG]', ...args);
        }
    }
    
    /**
     * 输出信息日志
     */
    info(...args) {
        if (this.shouldLog('info')) {
            console.log('[INFO]', ...args);
        }
    }
    
    /**
     * 输出警告日志
     */
    warn(...args) {
        if (this.shouldLog('warn')) {
            console.warn('[WARN]', ...args);
        }
    }
    
    /**
     * 输出错误日志
     */
    error(...args) {
        if (this.shouldLog('error')) {
            // 过滤掉浏览器跟踪防护警告（不影响功能）
            const message = args.join(' ');
            if (message.includes('Tracking Prevention') || 
                message.includes('blocked access to storage')) {
                // 这些警告不影响功能，静默忽略
                return;
            }
            console.error('[ERROR]', ...args);
        }
    }
    
    /**
     * 成功日志（始终输出）
     */
    success(...args) {
        console.log('[SUCCESS]', ...args);
    }
}

// 创建全局日志实例
const logger = new Logger();

/**
 * DOM 查询缓存 - 缓存常用的 DOM 元素引用
 */
class DOMCache {
    constructor() {
        this.cache = new Map();
    }
    
    /**
     * 获取 DOM 元素（带缓存）
     * @param {string} id - 元素 ID
     * @param {boolean} forceRefresh - 是否强制刷新缓存
     * @returns {HTMLElement|null}
     */
    getElement(id, forceRefresh = false) {
        if (forceRefresh || !this.cache.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.cache.set(id, element);
            } else {
                this.cache.delete(id);
            }
            return element;
        }
        return this.cache.get(id) || null;
    }
    
    /**
     * 清除缓存
     * @param {string} id - 要清除的元素 ID，不传则清除所有
     */
    clear(id = null) {
        if (id) {
            this.cache.delete(id);
        } else {
            this.cache.clear();
        }
    }
    
    /**
     * 批量获取元素
     * @param {Array<string>} ids - 元素 ID 数组
     * @returns {Object} 元素对象，键为 ID，值为元素
     */
    getElements(ids) {
        const elements = {};
        ids.forEach(id => {
            elements[id] = this.getElement(id);
        });
        return elements;
    }
}

// 创建全局 DOM 缓存实例
const domCache = new DOMCache();

/**
 * 错误处理工具 - 统一错误处理逻辑
 */
class ErrorHandler {
    /**
     * 处理错误并记录
     * @param {Error|string} error - 错误对象或错误消息
     * @param {string} context - 错误上下文
     * @param {Object} options - 选项
     * @returns {Object} 错误信息对象
     */
    static handle(error, context = '', options = {}) {
        const {
            showMessage = false,
            message = null,
            logLevel = 'error',
            silent = false
        } = options;
        
        const errorInfo = {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : null,
            context: context,
            timestamp: new Date().toISOString()
        };
        
        if (!silent) {
            logger[logLevel](`[${context}]`, errorInfo.message, errorInfo.stack);
        }
        
        if (showMessage) {
            const displayMessage = message || errorInfo.message || '发生了一个错误，请刷新页面重试';
            if (window.app && window.app.showMessage) {
                window.app.showMessage(displayMessage, 'error');
            } else {
                logger.error('无法显示错误消息，showMessage 方法不可用');
            }
        }
        
        return errorInfo;
    }
    
    /**
     * 安全执行函数，捕获错误
     * @param {Function} fn - 要执行的函数
     * @param {string} context - 上下文
     * @param {*} defaultValue - 出错时的默认返回值
     * @returns {*} 函数返回值或默认值
     */
    static safeExecute(fn, context = '', defaultValue = null) {
        try {
            return fn();
        } catch (error) {
            ErrorHandler.handle(error, context, { silent: true });
            return defaultValue;
        }
    }
    
    /**
     * 安全执行异步函数，捕获错误
     * @param {Function} fn - 要执行的异步函数
     * @param {string} context - 上下文
     * @param {*} defaultValue - 出错时的默认返回值
     * @returns {Promise<*>} 函数返回值或默认值
     */
    static async safeExecuteAsync(fn, context = '', defaultValue = null) {
        try {
            return await fn();
        } catch (error) {
            ErrorHandler.handle(error, context, { silent: true });
            return defaultValue;
        }
    }
}

/**
 * 地理工具类 - 提供地理坐标相关的计算方法
 */
class GeoUtils {
    /**
     * Haversine距离计算公式
     * @param {number} lat1 - 纬度1
     * @param {number} lon1 - 经度1
     * @param {number} lat2 - 纬度2
     * @param {number} lon2 - 经度2
     * @returns {number} 距离（公里）
     */
    static haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // 地球半径（公里）
        const dLat = GeoUtils.toRadians(lat2 - lat1);
        const dLon = GeoUtils.toRadians(lon2 - lon1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(GeoUtils.toRadians(lat1)) * Math.cos(GeoUtils.toRadians(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c;
    }

    /**
     * 角度转弧度
     * @param {number} degrees - 角度
     * @returns {number} 弧度
     */
    static toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
}

/**
 * 工具函数集合 - 提供常用的工具方法
 */
class Utils {
    /**
     * 检查值是否已定义（不是 undefined）
     * @param {*} value - 要检查的值
     * @returns {boolean} 是否已定义
     */
    static isDefined(value) {
        return typeof value !== 'undefined';
    }
    
    /**
     * 检查值是否为函数
     * @param {*} value - 要检查的值
     * @returns {boolean} 是否为函数
     */
    static isFunction(value) {
        return typeof value === 'function';
    }
}

/**
 * 数组工具类 - 提供数组相关的工具方法
 */
class ArrayUtils {
    /**
     * 检查数组是否为空
     * @param {Array} arr - 要检查的数组
     * @returns {boolean} 数组是否为空
     */
    static isEmpty(arr) {
        return !Array.isArray(arr) || arr.length === 0;
    }
    
    /**
     * 检查数组是否非空
     * @param {Array} arr - 要检查的数组
     * @returns {boolean} 数组是否非空
     */
    static isNotEmpty(arr) {
        return Array.isArray(arr) && arr.length > 0;
    }
}

/**
 * 配置常量 - 统一管理所有配置值
 */
const APP_CONFIG = {
    // 延迟时间（毫秒）
    DELAY: {
        ZOOM_UPDATE: 50,
        DEBOUNCE_SHORT: 150,
        DEBOUNCE_MEDIUM: 200,
        DEBOUNCE_LONG: 300,
        SCROLL: 300,
        EXPORT_RETRY: 500,
        PROCESS_TRACK: 0  // 用于让出控制权
    },
    
    // 数据限制
    LIMITS: {
        MAX_POINTS: 50000,
        SPATIAL_INDEX_THRESHOLD: 100000,
        INTERPOLATION_THRESHOLD: 0.0005,
        MIN_TRACK_POINTS: 1000
    },
    
    // 文件大小限制（字节）
    FILE_SIZE: {
        MAX_SINGLE: 50 * 1024 * 1024,  // 50MB
        MAX_TOTAL: 200 * 1024 * 1024    // 200MB
    },
    
    // 热力图默认参数
    HEATMAP: {
        DEFAULT_RADIUS: 1,
        DEFAULT_BLUR: 1,
        DEFAULT_OPACITY: 0.8,
        MAX_ZOOM: 18
    },
    
    // 空间索引配置
    SPATIAL_INDEX: {
        CELL_SIZE: 0.01,
        PADDING_MULTIPLIER: 2
    }
};

// 导出工具类
window.Logger = Logger;
window.logger = logger;
window.DOMCache = DOMCache;
window.domCache = domCache;
window.ErrorHandler = ErrorHandler;
window.GeoUtils = GeoUtils;
window.Utils = Utils;
window.ArrayUtils = ArrayUtils;
window.APP_CONFIG = APP_CONFIG;
