/**
 * FIT和GPX文件批量对比脚本
 * 用于诊断FIT文件坐标转换错误
 */

const fs = require('fs');
const path = require('path');

// 配置路径
const FIT_DIR = 'E:\\3.github\\repositories\\doing\\cycling_heat_temp\\activities\\fit_version';
const GPX_DIR = 'E:\\3.github\\repositories\\doing\\cycling_heat_temp\\activities\\gpx_version';
const REPORT_FILE = path.join(__dirname, 'fit-gpx-comparison-report.json');
const REPORT_TXT = path.join(__dirname, 'fit-gpx-comparison-report.txt');

// 对比阈值（米）
const DISTANCE_THRESHOLD = 100;

// 非洲区域范围（用于检测错误坐标）
const AFRICA_BOUNDS = {
    latMin: -35,
    latMax: 35,
    lonMin: -20,
    lonMax: 55
};

// 简化的Logger（Node.js环境）
class Logger {
    constructor() {
        this.level = 'info';
        this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
    }
    
    shouldLog(level) {
        return this.levels[level] >= this.levels[this.level];
    }
    
    debug(...args) {
        if (this.shouldLog('debug')) console.log('[DEBUG]', ...args);
    }
    
    info(...args) {
        if (this.shouldLog('info')) console.log('[INFO]', ...args);
    }
    
    warn(...args) {
        if (this.shouldLog('warn')) console.warn('[WARN]', ...args);
    }
    
    error(...args) {
        if (this.shouldLog('error')) console.error('[ERROR]', ...args);
    }
}

const logger = new Logger();

// TypeChecker工具类
class TypeChecker {
    static isNumber(value) {
        return typeof value === 'number' && !isNaN(value) && isFinite(value);
    }
    
    static isValidCoordinate(lat, lon) {
        return this.isNumber(lat) && this.isNumber(lon) &&
               lat >= -90 && lat <= 90 &&
               lon >= -180 && lon <= 180;
    }
}

// Haversine距离计算
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半径（公里）
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // 返回公里
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

// 检查坐标是否在非洲区域
function isInAfrica(lat, lon) {
    return lat >= AFRICA_BOUNDS.latMin && lat <= AFRICA_BOUNDS.latMax &&
           lon >= AFRICA_BOUNDS.lonMin && lon <= AFRICA_BOUNDS.lonMax;
}

// 解析GPX文件（简化版，只提取第一个点）
function parseGPXFirstPoint(filePath) {
    try {
        const xmlContent = fs.readFileSync(filePath, 'utf8');
        
        // 简单的XML解析，查找第一个trkpt
        const trkptMatch = xmlContent.match(/<trkpt\s+lat=["']([^"']+)["']\s+lon=["']([^"']+)["']/);
        if (trkptMatch) {
            const lat = parseFloat(trkptMatch[1]);
            const lon = parseFloat(trkptMatch[2]);
            
            if (TypeChecker.isValidCoordinate(lat, lon)) {
                return { lat, lon, success: true };
            }
        }
        
        // 如果没有trkpt，尝试rtept或wpt
        const rteptMatch = xmlContent.match(/<rtept\s+lat=["']([^"']+)["']\s+lon=["']([^"']+)["']/);
        if (rteptMatch) {
            const lat = parseFloat(rteptMatch[1]);
            const lon = parseFloat(rteptMatch[2]);
            
            if (TypeChecker.isValidCoordinate(lat, lon)) {
                return { lat, lon, success: true };
            }
        }
        
        const wptMatch = xmlContent.match(/<wpt\s+lat=["']([^"']+)["']\s+lon=["']([^"']+)["']/);
        if (wptMatch) {
            const lat = parseFloat(wptMatch[1]);
            const lon = parseFloat(wptMatch[2]);
            
            if (TypeChecker.isValidCoordinate(lat, lon)) {
                return { lat, lon, success: true };
            }
        }
        
        return { success: false, error: '未找到有效的GPS点' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// semicircles转度
function semicirclesToDegrees(semicircles) {
    return semicircles * (180 / Math.pow(2, 31));
}

// 解析FIT文件，使用与浏览器版本完全相同的逻辑
// 返回所有GPS记录，不限制消息类型
function parseFITFile(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        const data = new Uint8Array(buffer);
        
        if (data.length < 14) {
            throw new Error('FIT 文件太小，无法解析');
        }
        
        // 解析文件头（14 字节）
        const headerSize = data[0];
        if (headerSize !== 14 && headerSize !== 12) {
            throw new Error('无效的 FIT 文件头大小');
        }
        
        // 检查 ".FIT" 标识（字节 8-11）
        const fitSignature = String.fromCharCode(data[8], data[9], data[10], data[11]);
        if (fitSignature !== '.FIT') {
            throw new Error('无效的 FIT 文件签名');
        }
        
        // 获取数据大小（字节 4-7，小端序）
        const dataSize = data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
        
        // 数据从文件头之后开始
        let offset = headerSize;
        const records = [];
        const messageDefinitions = {}; // 存储消息定义
        
        // 解析数据记录
        while (offset < data.length && (offset - headerSize) < dataSize) {
            if (offset >= data.length) break;
            
            const recordHeader = data[offset];
            offset++;
            
            if (offset >= data.length) break;
            
            // 解析记录头
            const localMessageType = recordHeader & 0x0F;
            const isDefinitionMessage = (recordHeader & 0x40) === 0x40;
            const isCompressedTimestamp = (recordHeader & 0x80) === 0x80;
            
            if (isDefinitionMessage) {
                // 定义消息
                if (offset + 5 >= data.length) break;
                
                const reserved = data[offset];
                const architecture = data[offset + 1];
                const globalMessageNumber = data[offset + 2] | (data[offset + 3] << 8);
                const numFields = data[offset + 4];
                
                offset += 5;
                
                // 解析字段定义
                const fields = [];
                for (let i = 0; i < numFields && offset + 3 <= data.length; i++) {
                    const fieldDef = {
                        number: data[offset],
                        size: data[offset + 1],
                        baseType: data[offset + 2]
                    };
                    fields.push(fieldDef);
                    offset += 3;
                }
                
                // 存储消息定义
                messageDefinitions[localMessageType] = {
                    globalMessageNumber: globalMessageNumber,
                    fields: fields,
                    architecture: architecture
                };
            } else {
                // 数据消息
                const definition = messageDefinitions[localMessageType];
                
                if (definition) {
                    // 检查是否包含 GPS 数据字段（position_lat 或 position_long）
                    // 不限制消息类型，因为不同FIT文件可能使用不同的消息类型存储GPS数据
                    let hasGPSData = false;
                    for (let i = 0; i < definition.fields.length; i++) {
                        const fieldNum = definition.fields[i].number;
                        if (fieldNum === 0 || fieldNum === 1) {
                            hasGPSData = true;
                            break;
                        }
                    }
                    
                    if (hasGPSData) {
                        const record = parseRecordData(data, offset, definition, isCompressedTimestamp);
                        
                        if (record && record.position_lat !== undefined && record.position_long !== undefined) {
                            records.push(record);
                        }
                    }
                    
                    // 计算记录大小（所有消息类型都需要跳过）
                    let recordSize = 0;
                    for (let i = 0; i < definition.fields.length; i++) {
                        recordSize += definition.fields[i].size;
                    }
                    offset += recordSize;
                } else {
                    // 没有定义，尝试跳过（可能损坏的文件）
                    offset += 10; // 假设平均大小
                }
            }
            
            if (offset >= data.length) break;
        }
        
        return records;
    } catch (error) {
        throw error;
    }
}

// 解析 Record 数据消息（与浏览器版本完全一致）
function parseRecordData(data, offset, definition, isCompressedTimestamp) {
    const record = {};
    let pos = offset;
    
    const FIELD_POSITION_LAT = 0;
    const FIELD_POSITION_LONG = 1;
    
    const isLittleEndian = definition.architecture === 0;
    
    // 只解析GPS字段，跳过其他字段以提升性能
    for (let i = 0; i < definition.fields.length; i++) {
        const field = definition.fields[i];
        
        // 只处理GPS字段
        if (field.number !== FIELD_POSITION_LAT && field.number !== FIELD_POSITION_LONG) {
            // 跳过不需要的字段，直接移动位置指针
            pos += field.size;
            continue;
        }
        
        if (pos + field.size > data.length) break;
        
        let value = null;
        
        // BaseType定义
        const BASE_TYPE_SINT32 = 133;
        const BASE_TYPE_UINT32 = 134;
        const BASE_TYPE_SINT16 = 132;
        
        const isGPSField = (field.number === FIELD_POSITION_LAT || field.number === FIELD_POSITION_LONG);
        const isGPSBaseType = (field.baseType === BASE_TYPE_SINT32 || 
                               field.baseType === BASE_TYPE_UINT32 || 
                               field.baseType === BASE_TYPE_SINT16);
        
        // 根据字段大小读取值
        // 对于GPS字段，需要处理不同的大小（1, 2, 4字节）
        if (field.size === 1) {
            value = data[pos];
        } else if (field.size === 2) {
            if (isLittleEndian) {
                const unsigned = data[pos] | (data[pos + 1] << 8);
                if (isGPSField && isGPSBaseType && field.baseType === BASE_TYPE_SINT16) {
                    const int16View = new Int16Array(1);
                    const uint16View = new Uint16Array(int16View.buffer);
                    uint16View[0] = unsigned;
                    value = int16View[0];
                } else {
                    value = unsigned;
                }
            } else {
                const unsigned = (data[pos] << 8) | data[pos + 1];
                if (isGPSField && isGPSBaseType && field.baseType === BASE_TYPE_SINT16) {
                    const int16View = new Int16Array(1);
                    const uint16View = new Uint16Array(int16View.buffer);
                    uint16View[0] = unsigned;
                    value = int16View[0];
                } else {
                    value = unsigned;
                }
            }
        } else if (field.size === 4) {
            if (isLittleEndian) {
                // 读取32位无符号整数
                const unsigned = data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16) | (data[pos + 3] << 24);
                // 转换为有符号32位整数（使用与浏览器版本相同的方法）
                const int32View = new Int32Array(1);
                const uint32View = new Uint32Array(int32View.buffer);
                uint32View[0] = unsigned;
                value = int32View[0];
            } else {
                // 大端序
                const unsigned = (data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
                // 转换为有符号32位整数
                const int32View = new Int32Array(1);
                const uint32View = new Uint32Array(int32View.buffer);
                uint32View[0] = unsigned;
                value = int32View[0];
            }
        }
        
        // 根据字段号存储值
        if (field.number === FIELD_POSITION_LAT && value !== null) {
            record.position_lat = value;
        } else if (field.number === FIELD_POSITION_LONG && value !== null) {
            record.position_long = value;
        }
        
        pos += field.size;
    }
    
    return record;
}

// 解析FIT文件，只提取第一个有效GPS点（用于快速对比）
function parseFITFirstPoint(filePath) {
    try {
        const records = parseFITFile(filePath);
        
        if (records.length === 0) {
            return { success: false, error: '未找到有效的GPS点' };
        }
        
        // 遍历所有记录，找到第一个有效的GPS点
        for (const record of records) {
            const lat = semicirclesToDegrees(record.position_lat);
            const lon = semicirclesToDegrees(record.position_long);
            
            if (TypeChecker.isValidCoordinate(lat, lon)) {
                return {
                    success: true,
                    lat,
                    lon,
                    rawLat: record.position_lat,
                    rawLon: record.position_long
                };
            }
        }
        
        // 所有点都无效
        return { success: false, error: '未找到有效的GPS点（所有点坐标无效）' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 解析FIT文件，返回所有GPS点（用于选择最接近的点）
function parseFITAllGPSPoints(filePath) {
    const points = [];
    try {
        const records = parseFITFile(filePath);
        
        // 转换所有记录为GPS点
        for (const record of records) {
            const absLat = Math.abs(record.position_lat);
            const absLon = Math.abs(record.position_long);
            
            // 过滤明显无效的坐标对（如经度为1或非常小的值）
            if (absLon < 10 && absLon > 0 && absLat > 100) {
                // 经度太小但纬度看起来像semicircles，可能是无效数据
                continue;
            }
            
            const lat = semicirclesToDegrees(record.position_lat);
            const lon = semicirclesToDegrees(record.position_long);
            
            if (TypeChecker.isValidCoordinate(lat, lon)) {
                points.push({
                    lat,
                    lon,
                    rawLat: record.position_lat,
                    rawLon: record.position_long
                });
            }
        }
    } catch (error) {
        // 忽略错误
    }
    return points;
}

// 获取文件列表并匹配
function getFilePairs() {
    const fitFiles = fs.readdirSync(FIT_DIR)
        .filter(f => f.toLowerCase().endsWith('.fit'))
        .map(f => ({
            name: f,
            baseName: path.basename(f, '.fit'),
            path: path.join(FIT_DIR, f)
        }));
    
    const gpxFiles = fs.readdirSync(GPX_DIR)
        .filter(f => f.toLowerCase().endsWith('.gpx'))
        .map(f => ({
            name: f,
            baseName: path.basename(f, '.gpx'),
            path: path.join(GPX_DIR, f)
        }));
    
    // 创建GPX文件映射
    const gpxMap = new Map();
    gpxFiles.forEach(f => {
        gpxMap.set(f.baseName, f);
    });
    
    // 匹配文件对
    const pairs = [];
    fitFiles.forEach(fitFile => {
        const gpxFile = gpxMap.get(fitFile.baseName);
        if (gpxFile) {
            pairs.push({
                baseName: fitFile.baseName,
                fitPath: fitFile.path,
                gpxPath: gpxFile.path
            });
        } else {
            logger.warn(`未找到匹配的GPX文件: ${fitFile.name}`);
        }
    });
    
    return pairs;
}

// 对比单个文件对
function compareFilePair(pair) {
    const result = {
        baseName: pair.baseName,
        fitPath: pair.fitPath,
        gpxPath: pair.gpxPath,
        fitPoint: null,
        gpxPoint: null,
        distance: null,
        error: null,
        isError: false,
        isInAfrica: false
    };
    
    try {
        // 解析GPX文件
        const gpxResult = parseGPXFirstPoint(pair.gpxPath);
        if (!gpxResult.success) {
            result.error = `GPX解析失败: ${gpxResult.error}`;
            return result;
        }
        result.gpxPoint = { lat: gpxResult.lat, lon: gpxResult.lon };
        
        // 解析FIT文件
        let fitResult = parseFITFirstPoint(pair.fitPath);
        if (!fitResult.success) {
            result.error = `FIT解析失败: ${fitResult.error}`;
            return result;
        }
        
        // 计算距离
        let distanceKm = haversineDistance(
            gpxResult.lat, gpxResult.lon,
            fitResult.lat, fitResult.lon
        );
        let distance = distanceKm * 1000; // 转为米
        
        // 如果距离太远（>1000公里），可能是读取了错误的GPS点
        // 尝试重新解析，这次收集所有GPS点，选择最接近GPX坐标的点
        if (distance > 1000000) { // 1000公里 = 1000000米
            logger.info(`  ⚠️  距离太远(${(distance/1000).toFixed(2)}km)，尝试查找更接近的GPS点...`);
            const allGPSPoints = parseFITAllGPSPoints(pair.fitPath);
            logger.info(`  找到 ${allGPSPoints.length} 个GPS点`);
            if (allGPSPoints.length > 0) {
                // 找到最接近GPX坐标的点
                let bestPoint = allGPSPoints[0];
                let bestDistance = haversineDistance(
                    gpxResult.lat, gpxResult.lon,
                    allGPSPoints[0].lat, allGPSPoints[0].lon
                ) * 1000;
                
                for (let i = 1; i < allGPSPoints.length; i++) {
                    const dist = haversineDistance(
                        gpxResult.lat, gpxResult.lon,
                        allGPSPoints[i].lat, allGPSPoints[i].lon
                    ) * 1000;
                    if (dist < bestDistance) {
                        bestDistance = dist;
                        bestPoint = allGPSPoints[i];
                    }
                }
                
                // 如果找到更接近的点，使用它
                if (bestDistance < distance) {
                    logger.info(`  ✅ 找到更接近的点，距离从${(distance/1000).toFixed(2)}km减少到${(bestDistance/1000).toFixed(2)}km`);
                    fitResult = bestPoint;
                    distance = bestDistance;
                } else {
                    logger.warn(`  ❌ 未找到更接近的点，最近距离为${(bestDistance/1000).toFixed(2)}km`);
                }
            } else {
                logger.warn(`  ❌ 未找到任何GPS点`);
            }
        }
        
        result.fitPoint = { lat: fitResult.lat, lon: fitResult.lon };
        result.fitRawPoint = { lat: fitResult.rawLat, lon: fitResult.rawLon };
        
        // 检查是否在非洲
        result.isInAfrica = isInAfrica(fitResult.lat, fitResult.lon);
        
        result.distance = distance;
        
        // 判断是否错误
        result.isError = result.distance > DISTANCE_THRESHOLD || result.isInAfrica;
        
    } catch (error) {
        result.error = `对比失败: ${error.message}`;
    }
    
    return result;
}

// 生成报告
function generateReport(results) {
    const total = results.length;
    const errors = results.filter(r => r.isError);
    const africaErrors = results.filter(r => r.isInAfrica);
    const distanceErrors = results.filter(r => r.distance !== null && r.distance > DISTANCE_THRESHOLD);
    const parseErrors = results.filter(r => r.error);
    
    // 按距离分组
    const distanceGroups = {
        '0-100m': [],
        '100-500m': [],
        '500-1000m': [],
        '1-5km': [],
        '5-10km': [],
        '10km+': []
    };
    
    results.forEach(r => {
        if (r.distance !== null) {
            if (r.distance < 100) distanceGroups['0-100m'].push(r);
            else if (r.distance < 500) distanceGroups['100-500m'].push(r);
            else if (r.distance < 1000) distanceGroups['500-1000m'].push(r);
            else if (r.distance < 5000) distanceGroups['1-5km'].push(r);
            else if (r.distance < 10000) distanceGroups['5-10km'].push(r);
            else distanceGroups['10km+'].push(r);
        }
    });
    
    // 生成JSON报告
    const jsonReport = {
        summary: {
            total,
            errors: errors.length,
            africaErrors: africaErrors.length,
            distanceErrors: distanceErrors.length,
            parseErrors: parseErrors.length,
            successRate: ((total - errors.length) / total * 100).toFixed(2) + '%'
        },
        distanceGroups: {
            '0-100m': distanceGroups['0-100m'].length,
            '100-500m': distanceGroups['100-500m'].length,
            '500-1000m': distanceGroups['500-1000m'].length,
            '1-5km': distanceGroups['1-5km'].length,
            '5-10km': distanceGroups['5-10km'].length,
            '10km+': distanceGroups['10km+'].length
        },
        errorFiles: errors.map(r => ({
            baseName: r.baseName,
            distance: r.distance ? r.distance.toFixed(2) + 'm' : 'N/A',
            fitPoint: r.fitPoint,
            gpxPoint: r.gpxPoint,
            fitRawPoint: r.fitRawPoint,
            isInAfrica: r.isInAfrica,
            error: r.error
        })),
        allResults: results
    };
    
    // 生成文本报告
    let txtReport = 'FIT和GPX文件对比报告\n';
    txtReport += '='.repeat(50) + '\n\n';
    txtReport += `总文件数: ${total}\n`;
    txtReport += `错误文件数: ${errors.length}\n`;
    txtReport += `   - 非洲区域坐标: ${africaErrors.length}\n`;
    txtReport += `   - 距离超过${DISTANCE_THRESHOLD}米: ${distanceErrors.length}\n`;
    txtReport += `   - 解析错误: ${parseErrors.length}\n`;
    txtReport += `成功率: ${jsonReport.summary.successRate}\n\n`;
    
    txtReport += '距离分布:\n';
    Object.keys(distanceGroups).forEach(key => {
        txtReport += `  ${key}: ${distanceGroups[key].length} 个文件\n`;
    });
    txtReport += '\n';
    
    if (errors.length > 0) {
        txtReport += '错误文件列表:\n';
        txtReport += '-'.repeat(50) + '\n';
        errors.forEach((r, i) => {
            txtReport += `${i + 1}. ${r.baseName}\n`;
            if (r.error) {
                txtReport += `   错误: ${r.error}\n`;
            } else {
                txtReport += `   FIT坐标: (${r.fitPoint.lat.toFixed(6)}, ${r.fitPoint.lon.toFixed(6)})\n`;
                txtReport += `   GPX坐标: (${r.gpxPoint.lat.toFixed(6)}, ${r.gpxPoint.lon.toFixed(6)})\n`;
                txtReport += `   距离差: ${r.distance ? r.distance.toFixed(2) + 'm' : 'N/A'}\n`;
                txtReport += `   原始值: (${r.fitRawPoint.lat}, ${r.fitRawPoint.lon})\n`;
                txtReport += `   在非洲: ${r.isInAfrica ? '是' : '否'}\n`;
            }
            txtReport += '\n';
        });
    }
    
    return { jsonReport, txtReport };
}

// 主函数
async function main() {
    logger.info('开始对比FIT和GPX文件...');
    logger.info(`FIT目录: ${FIT_DIR}`);
    logger.info(`GPX目录: ${GPX_DIR}`);
    
    // 检查目录是否存在
    if (!fs.existsSync(FIT_DIR)) {
        logger.error(`FIT目录不存在: ${FIT_DIR}`);
        process.exit(1);
    }
    if (!fs.existsSync(GPX_DIR)) {
        logger.error(`GPX目录不存在: ${GPX_DIR}`);
        process.exit(1);
    }
    
    // 获取文件对
    const pairs = getFilePairs();
    logger.info(`找到 ${pairs.length} 个文件对`);
    
    if (pairs.length === 0) {
        logger.error('未找到匹配的文件对');
        process.exit(1);
    }
    
    // 对比所有文件对
    const results = [];
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        logger.info(`[${i + 1}/${pairs.length}] 对比: ${pair.baseName}`);
        
        const result = compareFilePair(pair);
        results.push(result);
        
        if (result.isError) {
            const distanceStr = result.distance !== null ? result.distance.toFixed(2) + 'm' : 'N/A';
            logger.warn(`  ❌ 错误: ${result.error || `距离=${distanceStr}, 在非洲=${result.isInAfrica}`}`);
        } else {
            const distanceStr = result.distance !== null ? result.distance.toFixed(2) + 'm' : 'N/A';
            logger.info(`  ✅ 成功: 距离=${distanceStr}`);
        }
    }
    
    // 生成报告
    logger.info('\n生成报告...');
    const { jsonReport, txtReport } = generateReport(results);
    
    // 保存报告
    fs.writeFileSync(REPORT_FILE, JSON.stringify(jsonReport, null, 2), 'utf8');
    fs.writeFileSync(REPORT_TXT, txtReport, 'utf8');
    
    logger.info(`\n报告已保存:`);
    logger.info(`  JSON: ${REPORT_FILE}`);
    logger.info(`  文本: ${REPORT_TXT}`);
    logger.info(`\n总结:`);
    logger.info(`  总文件数: ${jsonReport.summary.total}`);
    logger.info(`  错误文件数: ${jsonReport.summary.errors}`);
    logger.info(`  成功率: ${jsonReport.summary.successRate}`);
}

// 运行主函数
main().catch(error => {
    logger.error('执行失败:', error);
    process.exit(1);
});
