/**
 * GPX Parser - 解析GPX文件并提取轨迹点
 */

/**
 * 类型检查工具类
 * 提供常用的类型验证方法
 */
class TypeChecker {
    /**
     * 检查值是否为有效数字
     * @param {*} value - 要检查的值
     * @returns {boolean} 是否为有效数字
     */
    static isNumber(value) {
        return typeof value === 'number' && !isNaN(value) && isFinite(value);
    }
    
    /**
     * 检查坐标是否有效
     * @param {number} lat - 纬度
     * @param {number} lon - 经度
     * @returns {boolean} 坐标是否有效
     */
    static isValidCoordinate(lat, lon) {
        return this.isNumber(lat) && this.isNumber(lon) &&
               lat >= -90 && lat <= 90 &&
               lon >= -180 && lon <= 180;
    }
    
    /**
     * 检查日期是否有效
     * @param {Date|number} date - 日期对象或时间戳
     * @returns {boolean} 日期是否有效
     */
    static isValidDate(date) {
        if (date instanceof Date) {
            return !isNaN(date.getTime());
        }
        if (typeof date === 'number') {
            return date > 0 && date < Number.MAX_SAFE_INTEGER;
        }
        return false;
    }
    
    /**
     * 检查数组是否非空
     * @param {Array} arr - 要检查的数组
     * @returns {boolean} 数组是否非空
     */
    static isNonEmptyArray(arr) {
        return Array.isArray(arr) && arr.length > 0;
    }
}

class GPXParser {
    constructor() {
        this.tracks = [];
        this.totalPoints = 0;
        this.dateRange = { min: null, max: null };
        this.totalDistance = 0;
    }

    /**
     * 解析单个GPX文件
     * @param {File} file - GPX文件
     * @returns {Promise<Object>} 解析结果
     */
    async parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const xmlText = e.target.result;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                    
                    // 检查解析错误
                    const parseError = xmlDoc.querySelector('parsererror');
                    if (parseError) {
                        throw new Error('GPX文件格式错误');
                    }
                    
                    const result = this.extractTrackPoints(xmlDoc, file.name);
                    resolve(result);
                } catch (error) {
                    reject(new Error(`解析文件 ${file.name} 失败: ${error.message}`));
                }
            };
            
            reader.onerror = () => {
                reject(new Error(`读取文件 ${file.name} 失败`));
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * 从XML文档中提取轨迹点
     * @param {Document} xmlDoc - XML文档
     * @param {string} filename - 文件名
     * @returns {Object} 提取结果
     */
    extractTrackPoints(xmlDoc, filename) {
        const points = [];
        let trackDistance = 0;
        let trackDates = [];

        // 查找所有轨迹点 (trkpt)
        const trackPoints = xmlDoc.querySelectorAll('trkpt');
        
        if (trackPoints.length === 0) {
            // 如果没有轨迹点，尝试查找路径点 (rtept) 或航点 (wpt)
            const routePoints = xmlDoc.querySelectorAll('rtept');
            const wayPoints = xmlDoc.querySelectorAll('wpt');
            
            if (routePoints.length > 0) {
                this.processPoints(routePoints, points, trackDates);
            } else if (wayPoints.length > 0) {
                this.processPoints(wayPoints, points, trackDates);
            } else {
                throw new Error('未找到有效的GPS轨迹点');
            }
        } else {
            this.processPoints(trackPoints, points, trackDates);
        }

        // 计算轨迹距离
        trackDistance = this.calculateDistance(points);

        // 更新统计信息
        this.totalPoints += points.length;
        this.totalDistance += trackDistance;
        
        // 更新日期范围
        if (trackDates.length > 0) {
            const minDate = new Date(Math.min(...trackDates));
            const maxDate = new Date(Math.max(...trackDates));
            
            if (!this.dateRange.min || minDate < this.dateRange.min) {
                this.dateRange.min = minDate;
            }
            if (!this.dateRange.max || maxDate > this.dateRange.max) {
                this.dateRange.max = maxDate;
            }
        }

        return {
            filename,
            points,
            pointCount: points.length,
            distance: trackDistance,
            dates: trackDates
        };
    }

    /**
     * 处理轨迹点
     * @param {NodeList} pointNodes - 轨迹点节点列表
     * @param {Array} points - 输出点数组
     * @param {Array} trackDates - 轨迹日期数组
     */
    processPoints(pointNodes, points, trackDates) {
        pointNodes.forEach(point => {
            const lat = parseFloat(point.getAttribute('lat'));
            const lon = parseFloat(point.getAttribute('lon'));
            
            // 使用TypeChecker验证坐标有效性
            if (!TypeChecker.isValidCoordinate(lat, lon)) {
                console.warn(`Invalid coordinate: lat=${lat}, lon=${lon}`);
                return; // 跳过无效坐标
            }

            // 提取时间信息
            let timestamp = null;
            const timeElement = point.querySelector('time');
            if (timeElement && timeElement.textContent) {
                try {
                    const dateObj = new Date(timeElement.textContent);
                    if (TypeChecker.isValidDate(dateObj)) {
                        timestamp = dateObj.getTime(); // 存储为时间戳数字
                        trackDates.push(timestamp);
                    }
                } catch (e) {
                    // 忽略时间解析错误
                }
            }

            // 提取海拔信息（可选）
            let elevation = null;
            const eleElement = point.querySelector('ele');
            if (eleElement && eleElement.textContent) {
                const eleValue = parseFloat(eleElement.textContent);
                if (TypeChecker.isNumber(eleValue)) {
                    elevation = eleValue;
                }
            }

            points.push({
                lat,
                lon,
                timestamp,
                elevation
            });
        });
    }

    /**
     * 计算轨迹总距离（使用Haversine公式）
     * @param {Array} points - 轨迹点数组
     * @returns {number} 距离（公里）
     */
    calculateDistance(points) {
        if (points.length < 2) return 0;

        let totalDistance = 0;
        
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            
            const distance = this.haversineDistance(
                prev.lat, prev.lon,
                curr.lat, curr.lon
            );
            
            totalDistance += distance;
        }

        return totalDistance;
    }

    /**
     * Haversine距离计算公式
     * @param {number} lat1 - 纬度1
     * @param {number} lon1 - 经度1
     * @param {number} lat2 - 纬度2
     * @param {number} lon2 - 经度2
     * @returns {number} 距离（公里）
     */
    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // 地球半径（公里）
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c;
    }

    /**
     * 角度转弧度
     * @param {number} degrees - 角度
     * @returns {number} 弧度
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * 批量解析多个GPX文件
     * @param {FileList} files - 文件列表
     * @param {Function} progressCallback - 进度回调函数
     * @returns {Promise<Array>} 解析结果数组
     */
    async parseFiles(files, progressCallback) {
        const results = [];
        const totalFiles = files.length;
        
        // 重置统计信息
        this.totalPoints = 0;
        this.totalDistance = 0;
        this.dateRange = { min: null, max: null };

        for (let i = 0; i < totalFiles; i++) {
            const file = files[i];
            
            try {
                // 更新进度
                if (progressCallback) {
                    progressCallback({
                        current: i + 1,
                        total: totalFiles,
                        filename: file.name,
                        status: 'processing'
                    });
                }

                const result = await this.parseFile(file);
                results.push(result);
                
                // 更新进度
                if (progressCallback) {
                    progressCallback({
                        current: i + 1,
                        total: totalFiles,
                        filename: file.name,
                        status: 'completed',
                        points: result.pointCount
                    });
                }
                
            } catch (error) {
                console.error(`解析文件 ${file.name} 失败:`, error);
                
                // 添加错误结果
                results.push({
                    filename: file.name,
                    error: error.message,
                    points: [],
                    pointCount: 0,
                    distance: 0
                });
                
                // 更新进度
                if (progressCallback) {
                    progressCallback({
                        current: i + 1,
                        total: totalFiles,
                        filename: file.name,
                        status: 'error',
                        error: error.message
                    });
                }
            }
        }

        return results;
    }

    /**
     * 根据日期范围过滤轨迹点
     * @param {Array} tracks - 轨迹数组
     * @param {number} days - 天数（0表示不过滤）
     * @returns {Array} 过滤后的轨迹点
     */
    filterByDateRange(tracks, days) {
        const filteredPoints = [];
        
        if (days === 0) {
            // 返回所有点，使用分批处理避免栈溢出
            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                for (let j = 0; j < track.points.length; j++) {
                    const point = track.points[j];
                    filteredPoints.push([point.lat, point.lon]);
                }
            }
            return filteredPoints;
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffTime = cutoffDate.getTime();
        
        // 使用传统for循环避免栈溢出
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            for (let j = 0; j < track.points.length; j++) {
                const point = track.points[j];
                if (point.timestamp && point.timestamp >= cutoffTime) {
                    filteredPoints.push([point.lat, point.lon]);
                } else if (!point.timestamp) {
                    // 如果没有时间戳，包含该点
                    filteredPoints.push([point.lat, point.lon]);
                }
            }
        }

        return filteredPoints;
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStatistics() {
        return {
            totalPoints: this.totalPoints,
            totalDistance: Math.round(this.totalDistance * 100) / 100, // 保留2位小数
            dateRange: this.dateRange
        };
    }

    /**
     * 格式化日期范围文本
     * @returns {string} 格式化的日期范围
     */
    getDateRangeText() {
        if (!this.dateRange.min || !this.dateRange.max) {
            return '-';
        }

        const formatDate = (date) => {
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        };

        const minStr = formatDate(this.dateRange.min);
        const maxStr = formatDate(this.dateRange.max);

        if (minStr === maxStr) {
            return minStr;
        } else {
            return `${minStr} ~ ${maxStr}`;
        }
    }

    /**
     * 清除所有数据
     */
    clear() {
        this.tracks = [];
        this.totalPoints = 0;
        this.totalDistance = 0;
        this.dateRange = { min: null, max: null };
    }
}

// 导出GPXParser类
window.GPXParser = GPXParser;
