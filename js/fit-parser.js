/**
 * FIT Parser - 解析FIT文件并提取轨迹点
 * 使用 fit-file-parser 库进行解析，只提取必要的GPS信息
 * 如果库不可用，则使用内置的手动解析器作为降级方案
 */
class FITParser {
    // 离群点过滤阈值（米）
    static OUTLIER_THRESHOLDS = {
        FIRST_ITERATION: 1000000,  // 1000公里 - 第一次迭代的最小阈值
        SUBSEQUENT: 500000,        // 500公里 - 后续迭代的最小阈值
        MINIMUM: 500000,           // 500公里 - 绝对最小阈值
        EXTREME_ADJACENT: 1000000  // 1000公里 - 相邻点极端距离阈值
    };
    
    // 坐标格式检测阈值
    static COORDINATE_THRESHOLDS = {
        SEMICIRCLES_MIN: 1000,      // semicircles格式的最小值
        DEGREES_MAX_LAT: 90,        // 纬度的最大度数
        DEGREES_MAX_LON: 180,       // 经度的最大度数
        DEGREES_MIN: 0.1,           // 度数格式的最小值
        INVALID_SMALL: 10,          // 无效坐标的小值阈值
        INVALID_TINY: 1,            // 无效坐标的极小值阈值
        ORIGIN_NEAR: 0.001          // 接近原点的阈值
    };
    
    // 坐标格式分析阈值
    static FORMAT_ANALYSIS = {
        SAMPLE_SIZE: 50,            // 采样分析的点数
        MIN_SAMPLES: 3,             // 最小有效样本数
        SEMICIRCLES_RATIO: 0.3,     // semicircles格式的最小比率
        DEGREES_RATIO: 0.8,         // degrees格式的最小比率
        SEMICIRCLES_MULTIPLIER: 1.5, // semicircles计数的倍数阈值
        DEGREES_MULTIPLIER: 2,      // degrees计数的倍数阈值
        ADJACENT_DISTANCE_MAX: 1000 // 相邻点距离的最大值（米）
    };
    
    // 离群点过滤参数
    static OUTLIER_FILTERING = {
        MAX_ITERATIONS: 3,          // 最大迭代次数
        THRESHOLD_MULTIPLIER_FIRST: 2.5,  // 第一次迭代的阈值乘数
        THRESHOLD_MULTIPLIER_SUBSEQUENT: 3, // 后续迭代的阈值乘数
        ADJACENT_DISTANCE_MULTIPLIER: 5,   // 相邻点距离的倍数
        MIN_ADJACENT_DISTANCE: 5000,       // 最小相邻点距离（米）
        CHECK_ENDPOINTS_RATIO: 0.01        // 检查端点比例（1%）
    };
    
    // 坐标转换精度
    static PRECISION = {
        DEGREES_DECIMALS: 6,        // 度数的小数位数
        INTERPOLATION_THRESHOLD: 0.0008,  // 插值阈值（度）
        METERS_TO_DEGREES: 0.000009 // 米转度的系数（约1米 = 0.000009度）
    };
    
    // 比率阈值
    static RATIO_THRESHOLDS = {
        INTERPOLATION_POINTS: 0.7,  // 插值触发点数比率
        DEGREES_MIN: 0.2,           // degrees格式的最小比率
        SEMICIRCLES_MIN: 0.5        // semicircles格式的最小比率
    };
    
    // 时间戳相关常量
    static TIMESTAMP = {
        MILLISECONDS_THRESHOLD: 1e12,  // 毫秒时间戳阈值（用于判断是毫秒还是秒）
        MAX_SAFE_TIMESTAMP: Number.MAX_SAFE_INTEGER  // 最大安全时间戳
    };
    
    // 性能优化阈值
    static PERFORMANCE = {
        FOR_LOOP_THRESHOLD: 1000  // 超过此数量使用传统 for 循环
    };
    
    constructor() {
        this.tracks = [];
        this.totalPoints = 0;
        this.dateRange = { min: null, max: null };
        this.totalDistance = 0;
        
        // 默认使用手动解析（不再依赖外部 fit-file-parser 库）
        this.fitFileParserAvailable = false;
        
        // 预计算 semicircles 转度的常量（降级方案使用）
        // 度数 = semicircles * (180 / 2^31)
        this.SEMICIRCLES_TO_DEGREES = 180 / Math.pow(2, 31);
    }
    
    /**
     * 获取 FitParser 构造函数（内部方法，统一检查逻辑）
     * @returns {Function|null} FitParser 构造函数或 null
     */
    getFitParser() {
        // 尝试多种可能的全局变量名（使用 try-catch 避免 ReferenceError）
        const candidates = [
            () => {
                try {
                    return (typeof FitParser !== 'undefined' && typeof FitParser === 'function') ? FitParser : null;
                } catch (e) {
                    return null;
                }
            },
            () => {
                try {
                    return (typeof FitFileParser !== 'undefined' && typeof FitFileParser === 'function') ? FitFileParser : null;
                } catch (e) {
                    return null;
                }
            },
            () => {
                try {
                    return (typeof window !== 'undefined' && window.FitParser && typeof window.FitParser === 'function') ? window.FitParser : null;
                } catch (e) {
                    return null;
                }
            },
            () => {
                try {
                    return (typeof window !== 'undefined' && window.FitFileParser && typeof window.FitFileParser === 'function') ? window.FitFileParser : null;
                } catch (e) {
                    return null;
                }
            }
        ];
        
        for (const candidate of candidates) {
            try {
                const result = candidate();
                if (result) {
                    return result;
                }
            } catch (e) {
                // 忽略错误，继续尝试下一个候选
                continue;
            }
        }
        
        return null;
    }
    
    /**
     * 检测 fit-file-parser 库是否可用
     * @returns {boolean} 库是否可用
     */
    checkFitFileParserLibrary() {
        return this.getFitParser() !== null;
    }

    /**
     * 解析单个FIT文件
     * @param {File} file - FIT文件
     * @returns {Promise<Object>} 解析结果
     */
    async parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    
                    // 优先使用 fit-file-parser 库
                    if (this.fitFileParserAvailable) {
                        try {
                            const result = await this.parseWithLibrary(arrayBuffer, file.name);
                            resolve(result);
                            return;
                        } catch (libraryError) {
                            logger.warn(`使用 fit-file-parser 库解析失败，尝试降级方案: ${libraryError.message}`);
                            // 降级到手动解析
                        }
                    }
                    
                    // 降级方案：使用手动解析
                    const uint8Array = new Uint8Array(arrayBuffer);
                    const records = this.parseFITFile(uint8Array);
                    const fitData = { records: records };
                    const result = this.extractTrackPoints(fitData, file.name);
                    resolve(result);
                } catch (error) {
                    reject(new Error(`解析文件 ${file.name} 失败: ${error.message}`));
                }
            };
            
            reader.onerror = () => {
                reject(new Error(`读取文件 ${file.name} 失败`));
            };
            
            // 读取为 ArrayBuffer（FIT 文件是二进制格式）
            reader.readAsArrayBuffer(file);
        });
    }
    
    /**
     * 使用 fit-file-parser 库解析FIT文件
     * @param {ArrayBuffer} arrayBuffer - FIT文件的ArrayBuffer
     * @param {string} filename - 文件名
     * @returns {Promise<Object>} 解析结果
     */
    async parseWithLibrary(arrayBuffer, filename) {
        return new Promise((resolve, reject) => {
            const FitParserClass = this.getFitParser();
            if (!FitParserClass) {
                reject(new Error('fit-file-parser 库未找到'));
                return;
            }
            
            try {
                // 创建 FitParser 实例
                const fitParser = new FitParserClass({
                    force: true,
                    speedUnit: 'km/h',
                    lengthUnit: 'km',
                    temperatureUnit: 'celsius',
                    mode: 'cascade'
                });
                
                // 解析 FIT 文件
                fitParser.parse(arrayBuffer, (error, data) => {
                    if (error) {
                        reject(new Error(`库解析失败: ${error.message || error}`));
                        return;
                    }
                    
                    if (!data) {
                        reject(new Error('库解析返回空数据'));
                        return;
                    }
                    
                    // 只提取GPS相关记录
                    const gpsRecords = this.extractGPSRecords(data);
                    
                    // 转换为与 extractTrackPoints 兼容的格式
                    const fitData = { records: gpsRecords };
                    
                    // 提取轨迹点
                    const result = this.extractTrackPoints(fitData, filename);
                    resolve(result);
                });
            } catch (error) {
                reject(new Error(`库调用失败: ${error.message || error}`));
            }
        });
    }
    
    /**
     * 从库的解析结果中只提取GPS相关记录
     * @param {Object} data - fit-file-parser 库的解析结果
     * @returns {Array} GPS记录数组
     */
    extractGPSRecords(data) {
        const gpsRecords = [];
        
        // 库可能返回 records 数组或类似结构
        const records = data.records || data.activity || data.sessions || [];
        
        if (!Array.isArray(records)) {
            logger.warn('库返回的数据格式不符合预期，尝试其他结构');
            return [];
        }
        
        // 只提取包含GPS数据的记录
        records.forEach(record => {
            // 检查是否包含GPS数据（可能字段名不同）
            const hasLat = record.position_lat !== undefined || 
                          record.latitude !== undefined || 
                          record.lat !== undefined;
            const hasLon = record.position_long !== undefined || 
                          record.longitude !== undefined || 
                          record.lon !== undefined;
            
            if (hasLat && hasLon) {
                // 统一字段名
                const gpsRecord = {
                    position_lat: record.position_lat !== undefined ? record.position_lat : 
                                 (record.latitude !== undefined ? record.latitude : record.lat),
                    position_long: record.position_long !== undefined ? record.position_long : 
                                  (record.longitude !== undefined ? record.longitude : record.lon),
                    timestamp: record.timestamp || record.time || null,
                    altitude: record.altitude !== undefined ? record.altitude : 
                             (record.enhanced_altitude !== undefined ? record.enhanced_altitude : null)
                };
                
                gpsRecords.push(gpsRecord);
            }
        });
        
        return gpsRecords;
    }
    
    /**
     * 解析 FIT 文件二进制数据
     * @param {Uint8Array} data - FIT 文件二进制数据
     * @returns {Array} 记录数组
     */
    parseFITFile(data) {
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
                    // 例如：20 (Record), 5120 (可能是某种Record变体) 等
                    let hasGPSData = false;
                    for (let i = 0; i < definition.fields.length; i++) {
                        const fieldNum = definition.fields[i].number;
                        if (fieldNum === 0 || fieldNum === 1) {
                            hasGPSData = true;
                            break;
                        }
                    }
                    
                    if (hasGPSData) {
                        const record = this.parseRecordData(data, offset, definition, isCompressedTimestamp);
                        
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
    }
    
    /**
     * 解析 Record 数据消息
     * @param {Uint8Array} data - 数据数组
     * @param {number} offset - 起始偏移量
     * @param {Object} definition - 消息定义
     * @param {boolean} isCompressedTimestamp - 是否压缩时间戳
     * @returns {Object} 记录对象
     */
    parseRecordData(data, offset, definition, isCompressedTimestamp) {
        const record = {};
        let pos = offset;
        
        // FIT 字段号定义（只解析需要的字段以提升性能）
        const FIELD_POSITION_LAT = 0; // position_lat
        const FIELD_POSITION_LONG = 1; // position_long
        const FIELD_TIMESTAMP = 253; // timestamp
        const FIELD_ALTITUDE = 5; // enhanced_altitude（优先）
        const FIELD_ALTITUDE_ALT = 6; // altitude（备选）
        
        // BaseType定义（用于判断GPS字段的数据类型）
        // 133 = sint32 (有符号32位整数) - 标准GPS坐标格式
        // 134 = uint32 (无符号32位整数) - 某些设备可能使用
        // 132 = sint16 (有符号16位整数) - 某些设备可能使用
        const BASE_TYPE_SINT32 = 133;
        const BASE_TYPE_UINT32 = 134;
        const BASE_TYPE_SINT16 = 132;
        
        const isLittleEndian = definition.architecture === 0;
        
        // 只解析需要的字段，跳过其他字段以提升性能
        for (let i = 0; i < definition.fields.length; i++) {
            const field = definition.fields[i];
            
            // 只处理我们需要的字段
            if (field.number !== FIELD_POSITION_LAT && 
                field.number !== FIELD_POSITION_LONG && 
                field.number !== FIELD_TIMESTAMP && 
                field.number !== FIELD_ALTITUDE && 
                field.number !== FIELD_ALTITUDE_ALT) {
                // 跳过不需要的字段，直接移动位置指针
                pos += field.size;
                continue;
            }
            
            if (pos + field.size > data.length) break;
            
            let value = null;
            
            // 对于GPS字段（0和1），需要特殊处理：
            // 1. 标准格式：4字节，baseType 133 (sint32) 或 134 (uint32)
            // 2. 某些设备可能使用其他大小或类型，我们需要尝试读取
            const isGPSField = (field.number === FIELD_POSITION_LAT || field.number === FIELD_POSITION_LONG);
            const isGPSBaseType = (field.baseType === BASE_TYPE_SINT32 || 
                                   field.baseType === BASE_TYPE_UINT32 || 
                                   field.baseType === BASE_TYPE_SINT16);
            
            // 根据字段大小和类型读取值
            if (field.size === 1) {
                value = data[pos];
                // 对于GPS字段，1字节通常不是有效的semicircles值，但先读取
            } else if (field.size === 2) {
                if (isLittleEndian) {
                    const unsigned = data[pos] | (data[pos + 1] << 8);
                    if (isGPSField && isGPSBaseType) {
                        // 对于GPS字段，如果是sint16，需要转换为有符号整数
                        if (field.baseType === BASE_TYPE_SINT16) {
                            const int16View = new Int16Array(1);
                            const uint16View = new Uint16Array(int16View.buffer);
                            uint16View[0] = unsigned;
                            value = int16View[0];
                        } else {
                            value = unsigned;
                        }
                    } else {
                        value = unsigned;
                    }
                } else {
                    const unsigned = (data[pos] << 8) | data[pos + 1];
                    if (isGPSField && isGPSBaseType) {
                        if (field.baseType === BASE_TYPE_SINT16) {
                            const int16View = new Int16Array(1);
                            const uint16View = new Uint16Array(int16View.buffer);
                            uint16View[0] = unsigned;
                            value = int16View[0];
                        } else {
                            value = unsigned;
                        }
                    } else {
                        value = unsigned;
                    }
                }
            } else if (field.size === 4) {
                if (isLittleEndian) {
                    // 读取32位无符号整数
                    const unsigned = data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16) | (data[pos + 3] << 24);
                    // 转换为有符号32位整数
                    // 使用 Int32Array 确保正确的符号扩展
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
            } else if (field.size === 8) {
                // 处理64位整数（时间戳可能是64位）
                if (isLittleEndian) {
                    const low = data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16) | (data[pos + 3] << 24);
                    const high = data[pos + 4] | (data[pos + 5] << 8) | (data[pos + 6] << 16) | (data[pos + 7] << 24);
                    value = low + (high * 0x100000000);
                } else {
                    const high = (data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
                    const low = (data[pos + 4] << 24) | (data[pos + 5] << 16) | (data[pos + 6] << 8) | data[pos + 7];
                    value = (high * 0x100000000) + low;
                }
            }
            
            // 根据字段号存储值
            if (field.number === FIELD_POSITION_LAT && value !== null) {
                // 对于GPS字段，需要验证值是否合理
                // semicircles值的范围大约是 -2^31 到 2^31-1
                // 但如果值太小（如 < 100），可能不是有效的GPS坐标
                // 我们仍然存储它，让后续的验证逻辑来判断
                record.position_lat = value;
            } else if (field.number === FIELD_POSITION_LONG && value !== null) {
                record.position_long = value;
            } else if (field.number === FIELD_TIMESTAMP && value !== null) {
                // FIT 时间戳：秒数，从 UTC 1989-12-31 00:00:00 开始
                const fitEpoch = new Date('1989-12-31T00:00:00Z').getTime() / 1000;
                record.timestamp = new Date((fitEpoch + value) * 1000);
            } else if (field.number === FIELD_ALTITUDE && value !== null) {
                // enhanced_altitude：单位是米，偏移 -500，分辨率 5
                record.altitude = (value / 5) - 500;
            } else if (field.number === FIELD_ALTITUDE_ALT && value !== null && record.altitude === undefined) {
                // altitude：单位是米，偏移 -500，分辨率 5（如果enhanced_altitude不存在则使用）
                record.altitude = (value / 5) - 500;
            }
            
            pos += field.size;
        }
        
        return record;
    }

    /**
     * 分析坐标格式：通过相邻点距离判断是度数还是semicircles
     * @param {Array} samples - 采样点数组 [{lat, lon, record}]
     * @returns {Object} 分析结果 {isSemicircles, maxAdjacentDistance, validRatio}
     */
    analyzeCoordinateFormat(samples) {
        if (samples.length === 0) {
            return { 
                isSemicircles: true, 
                maxAdjacentDistance: FITParser.OUTLIER_FILTERING.MIN_ADJACENT_DISTANCE, 
                avgAdjacentDistance: 100, 
                validRatio: 0 
            };
        }

        // 尝试两种格式，计算相邻点距离
        const degreesResults = [];
        const semicirclesResults = [];

        samples.forEach(sample => {
            const latValue = sample.lat;
            const lonValue = sample.lon;
            const absLat = Math.abs(latValue);
            const absLon = Math.abs(lonValue);

            // 跳过明显无效的数据（值太小）
            // 注意：不能设置太高的阈值，避免误判有效的semicircles值
            if (absLat < FITParser.COORDINATE_THRESHOLDS.INVALID_SMALL && absLon < FITParser.COORDINATE_THRESHOLDS.INVALID_SMALL) {
                return; // 跳过这个采样点
            }

            // 格式1：作为度数（如果值在合理范围内）
            // 但需要更严格的判断：值必须在 -90 到 90 和 -180 到 180 范围内
            // 并且不能太小（< 1），因为semicircles转换后的值也可能在这个范围内
            if (absLat <= FITParser.COORDINATE_THRESHOLDS.DEGREES_MAX_LAT && 
                absLon <= FITParser.COORDINATE_THRESHOLDS.DEGREES_MAX_LON && 
                absLat >= FITParser.COORDINATE_THRESHOLDS.INVALID_TINY && 
                absLon >= FITParser.COORDINATE_THRESHOLDS.INVALID_TINY) {
                const lat = latValue;
                const lon = lonValue;
                // 额外检查：不能接近原点
                if (TypeChecker.isValidCoordinate(lat, lon) && 
                    Math.abs(lat) >= FITParser.COORDINATE_THRESHOLDS.ORIGIN_NEAR && 
                    Math.abs(lon) >= FITParser.COORDINATE_THRESHOLDS.ORIGIN_NEAR) {
                    degreesResults.push({ lat, lon, raw: sample });
                }
            }

            // 格式2：作为semicircles转换（总是尝试）
            const lat = this.semicirclesToDegrees(latValue);
            const lon = this.semicirclesToDegrees(lonValue);
            // 额外检查：不能接近原点
            if (TypeChecker.isValidCoordinate(lat, lon) && 
                Math.abs(lat) >= FITParser.COORDINATE_THRESHOLDS.ORIGIN_NEAR && 
                Math.abs(lon) >= FITParser.COORDINATE_THRESHOLDS.ORIGIN_NEAR) {
                semicirclesResults.push({ lat, lon, raw: sample });
            }
        });

        // 如果semicircles格式的有效点明显更多，优先使用semicircles
        // 或者如果degrees格式的点很少（< 10%），也使用semicircles
        const degreesRatio = degreesResults.length / samples.length;
        const semicirclesRatio = semicirclesResults.length / samples.length;
        
        // 如果semicircles格式的有效点明显更多（至少是degrees的2倍），使用semicircles
        // 或者如果degrees格式的有效点很少（< 20%），使用semicircles
        let useSemicircles = false;
        if (semicirclesResults.length > degreesResults.length * FITParser.FORMAT_ANALYSIS.DEGREES_MULTIPLIER) {
            useSemicircles = true;
        } else if (degreesRatio < FITParser.RATIO_THRESHOLDS.DEGREES_MIN && 
                   semicirclesRatio > FITParser.RATIO_THRESHOLDS.SEMICIRCLES_MIN) {
            useSemicircles = true;
        } else if (degreesResults.length === 0 && semicirclesResults.length > 0) {
            useSemicircles = true;
        } else {
            // 计算相邻点距离统计，选择距离更合理的格式
            const degreesStats = this.calculateAdjacentDistanceStats(degreesResults);
            const semicirclesStats = this.calculateAdjacentDistanceStats(semicirclesResults);
            
            // 如果semicircles格式的相邻点平均距离更小（更合理），使用semicircles
            if (semicirclesStats.avgDistance < degreesStats.avgDistance && 
                semicirclesStats.avgDistance < FITParser.FORMAT_ANALYSIS.ADJACENT_DISTANCE_MAX) {
                useSemicircles = true;
            }
        }

        // 计算选定格式的统计信息
        const selectedResults = useSemicircles ? semicirclesResults : degreesResults;
        const selectedStats = this.calculateAdjacentDistanceStats(selectedResults);
        const validRatio = useSemicircles 
            ? semicirclesRatio
            : degreesRatio;

        return {
            isSemicircles: useSemicircles,
            maxAdjacentDistance: selectedStats.maxAdjacentDistance,
            avgAdjacentDistance: selectedStats.avgDistance,
            validRatio: validRatio
        };
    }

    /**
     * 计算相邻点距离统计信息
     * @param {Array} points - 点数组 [{lat, lon}]
     * @returns {Object} 统计信息 {avgDistance, maxAdjacentDistance}
     */
    calculateAdjacentDistanceStats(points) {
        if (points.length === 0) {
            return { avgDistance: 10000, maxAdjacentDistance: 10000 };
        }

        if (points.length === 1) {
            return { avgDistance: 0, maxAdjacentDistance: 0 };
        }

        // 计算相邻点之间的距离
        const distances = [];
        for (let i = 0; i < points.length - 1; i++) {
            const dist = GeoUtils.haversineDistance(
                points[i].lat, points[i].lon,
                points[i + 1].lat, points[i + 1].lon
            ) * 1000; // 转为米
            distances.push(dist);
        }

        // 计算平均距离和最大距离
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        // 使用 reduce 避免展开运算符导致栈溢出
        const maxAdjacentDistance = distances.reduce((max, dist) => dist > max ? dist : max, 0);

        return {
            avgDistance,
            maxAdjacentDistance
        };
    }

    /**
     * 收集原始坐标值（提前过滤明显无效的数据）
     * @param {Array} records - FIT记录数组
     * @returns {Array} 原始坐标数组 [{lat, lon, record}]
     */
    collectRawCoordinates(records) {
        const rawCoordinates = [];
        records.forEach(record => {
            if (record.position_lat !== undefined && record.position_long !== undefined) {
                const absLat = Math.abs(record.position_lat);
                const absLon = Math.abs(record.position_long);
                
                // 过滤明显无效的坐标对
                if (record.position_lat === 0 && record.position_long === 0) {
                    return; // 跳过(0,0)坐标
                }
                
                // 经度太小但纬度看起来像semicircles，可能是无效数据
                if (absLon < FITParser.COORDINATE_THRESHOLDS.INVALID_SMALL && 
                    absLon > 0 && 
                    absLat > 100) {
                    return; // 跳过明显无效的坐标对
                }
                
                rawCoordinates.push({
                    lat: record.position_lat,
                    lon: record.position_long,
                    record: record
                });
            }
        });
        return rawCoordinates;
    }

    /**
     * 确定坐标格式（semicircles 或 degrees）
     * @param {Array} rawCoordinates - 原始坐标数组
     * @returns {Object} 格式分析结果
     */
    determineCoordinateFormat(rawCoordinates) {
        // 参数验证
        if (!Array.isArray(rawCoordinates) || rawCoordinates.length === 0) {
            logger.warn('determineCoordinateFormat: rawCoordinates 参数无效，返回默认格式');
            return { 
                isSemicircles: true, 
                maxAdjacentDistance: FITParser.OUTLIER_FILTERING.MIN_ADJACENT_DISTANCE, 
                avgAdjacentDistance: 100, 
                validRatio: 0 
            };
        }
        
        const sampleSize = Math.min(FITParser.FORMAT_ANALYSIS.SAMPLE_SIZE, rawCoordinates.length);
        const samples = rawCoordinates.slice(0, sampleSize);
        
        // 过滤明显无效的坐标对
        const validSamples = samples.filter(sample => {
            const absLat = Math.abs(sample.lat);
            const absLon = Math.abs(sample.lon);
            if (absLon < FITParser.COORDINATE_THRESHOLDS.INVALID_SMALL && 
                absLon > 0 && 
                absLat > 100) {
                return false;
            }
            return true;
        });
        
        const analysisSamples = validSamples.length >= FITParser.FORMAT_ANALYSIS.MIN_SAMPLES ? validSamples : samples;
        
        let likelySemicircles = false;
        let semicirclesCount = 0;
        let degreesCount = 0;
        
        analysisSamples.forEach(sample => {
            const absLat = Math.abs(sample.lat);
            const absLon = Math.abs(sample.lon);
            if (absLat > FITParser.COORDINATE_THRESHOLDS.SEMICIRCLES_MIN || 
                absLon > FITParser.COORDINATE_THRESHOLDS.SEMICIRCLES_MIN) {
                semicirclesCount++;
            } else if (absLat <= FITParser.COORDINATE_THRESHOLDS.DEGREES_MAX_LAT && 
                       absLon <= FITParser.COORDINATE_THRESHOLDS.DEGREES_MAX_LON && 
                       absLat >= FITParser.COORDINATE_THRESHOLDS.DEGREES_MIN && 
                       absLon >= FITParser.COORDINATE_THRESHOLDS.DEGREES_MIN) {
                degreesCount++;
            }
        });
        
        if (semicirclesCount > 0 && 
            (semicirclesCount > degreesCount * FITParser.FORMAT_ANALYSIS.SEMICIRCLES_MULTIPLIER || 
             semicirclesCount > analysisSamples.length * FITParser.FORMAT_ANALYSIS.SEMICIRCLES_RATIO)) {
            likelySemicircles = true;
        } else if (semicirclesCount === 0 && 
                   degreesCount > analysisSamples.length * FITParser.FORMAT_ANALYSIS.DEGREES_RATIO) {
            // 只有在完全没有semicircles特征，且大部分值都在度数范围内时，才考虑使用度数格式
        } else {
            likelySemicircles = true; // 默认使用semicircles格式（FIT标准）
        }
        
        if (likelySemicircles) {
            const semicirclesResults = [];
            samples.forEach(sample => {
                const lat = this.semicirclesToDegrees(sample.lat);
                const lon = this.semicirclesToDegrees(sample.lon);
                if (TypeChecker.isValidCoordinate(lat, lon)) {
                    semicirclesResults.push({ lat, lon });
                }
            });
            const stats = this.calculateAdjacentDistanceStats(semicirclesResults);
            return {
                isSemicircles: true,
                maxAdjacentDistance: stats.maxAdjacentDistance,
                avgAdjacentDistance: stats.avgDistance,
                validRatio: semicirclesResults.length / samples.length
            };
        } else {
            return this.analyzeCoordinateFormat(samples);
        }
    }

    /**
     * 转换坐标（根据格式分析结果）
     * @param {Array} rawCoordinates - 原始坐标数组
     * @param {Object} formatAnalysis - 格式分析结果
     * @returns {Array} 转换后的点数组
     */
    convertCoordinates(rawCoordinates, formatAnalysis) {
        // 参数验证
        if (!Array.isArray(rawCoordinates) || !formatAnalysis) {
            logger.warn('convertCoordinates: 无效的参数');
            return [];
        }
        
        const convertedPoints = [];
        const length = rawCoordinates.length;
        
        // 对于大数据集（>1000项），使用传统 for 循环以获得更好性能
        const useForLoop = length > FITParser.PERFORMANCE.FOR_LOOP_THRESHOLD;
        
        // 处理单个坐标的通用逻辑（提取为内部函数避免重复）
        const processCoordinate = (coord, index) => {
            if (!coord) return null;
            
            const record = coord.record;
            const latValue = coord.lat;
            const lonValue = coord.lon;
            // 缓存 Math.abs 计算结果，避免重复计算
            const absLat = Math.abs(latValue);
            const absLon = Math.abs(lonValue);
            
            // 预检查：过滤明显无效的数据
            if (absLat < FITParser.COORDINATE_THRESHOLDS.INVALID_TINY && 
                absLon < FITParser.COORDINATE_THRESHOLDS.INVALID_TINY && 
                latValue >= 0 && lonValue >= 0) {
                return null; // 跳过明显无效的坐标
            }
            
            if (absLon < FITParser.COORDINATE_THRESHOLDS.INVALID_SMALL && 
                absLon > 0 && 
                absLat > 100) {
                return null; // 跳过明显无效的坐标
            }
            
            let lat, lon;
            
            // 使用分析结果确定的格式进行转换
            if (formatAnalysis.isSemicircles) {
                lat = this.semicirclesToDegrees(latValue);
                lon = this.semicirclesToDegrees(lonValue);
            } else {
                if (absLat > FITParser.COORDINATE_THRESHOLDS.DEGREES_MAX_LAT || 
                    absLon > FITParser.COORDINATE_THRESHOLDS.DEGREES_MAX_LON) {
                    lat = this.semicirclesToDegrees(latValue);
                    lon = this.semicirclesToDegrees(lonValue);
                } else {
                    lat = latValue;
                    lon = lonValue;
                }
            }
            
            // 验证转换后的坐标有效性
            if (!TypeChecker.isValidCoordinate(lat, lon)) {
                return null; // 跳过无效坐标
            }
            
            // 额外检查：如果转换后的坐标接近 (0, 0)，很可能是无效数据
            // 缓存 Math.abs 结果，避免重复计算
            const absLatConverted = Math.abs(lat);
            const absLonConverted = Math.abs(lon);
            if (absLatConverted < FITParser.COORDINATE_THRESHOLDS.ORIGIN_NEAR && 
                absLonConverted < FITParser.COORDINATE_THRESHOLDS.ORIGIN_NEAR) {
                return null; // 跳过接近原点的坐标
            }
            
            // 提取时间戳
            let timestamp = null;
            if (record && record.timestamp) {
                let dateObj;
                if (record.timestamp instanceof Date) {
                    dateObj = record.timestamp;
                } else if (typeof record.timestamp === 'string') {
                    dateObj = new Date(record.timestamp);
                } else if (typeof record.timestamp === 'number') {
                    // 判断是毫秒时间戳还是秒时间戳
                    dateObj = new Date(record.timestamp > FITParser.TIMESTAMP.MILLISECONDS_THRESHOLD 
                        ? record.timestamp 
                        : record.timestamp * 1000);
                }
                if (dateObj && TypeChecker.isValidDate(dateObj)) {
                    timestamp = dateObj.getTime();
                }
            }
            
            // 提取海拔信息（可选）
            let elevation = null;
            if (record && record.altitude !== undefined && record.altitude !== null) {
                const altValue = parseFloat(record.altitude);
                if (TypeChecker.isNumber(altValue)) {
                    elevation = altValue;
                }
            }
            
            return {
                lat,
                lon,
                timestamp,
                elevation,
                rawIndex: index,
                rawLat: latValue,
                rawLon: lonValue
            };
        };
        
        if (useForLoop) {
            // 大数据集：使用传统 for 循环
            for (let index = 0; index < length; index++) {
                const coord = rawCoordinates[index];
                const result = processCoordinate(coord, index);
                if (result) {
                    convertedPoints.push(result);
                }
            }
        } else {
            // 小数据集：使用 forEach，代码更简洁
            rawCoordinates.forEach((coord, index) => {
                const result = processCoordinate(coord, index);
                if (result) {
                    convertedPoints.push(result);
                }
            });
        }
        
        return convertedPoints;
    }

    /**
     * 过滤全局离群点（基于中心位置）
     * @param {Array} convertedPoints - 转换后的点数组
     * @param {Set} validIndices - 有效点索引集合
     * @returns {number} 移除的离群点数量
     */
    filterGlobalOutliers(convertedPoints, validIndices) {
        // 参数验证
        if (!Array.isArray(convertedPoints) || convertedPoints.length === 0) {
            logger.warn('filterGlobalOutliers: convertedPoints 参数无效');
            return 0;
        }
        if (!(validIndices instanceof Set)) {
            logger.warn('filterGlobalOutliers: validIndices 参数不是 Set 类型');
            return 0;
        }
        
        let iteration = 0;
        const maxIterations = FITParser.OUTLIER_FILTERING.MAX_ITERATIONS;
        let totalOutliersRemoved = 0;
        
        while (iteration < maxIterations) {
            // 计算当前有效点的中心位置
            let centerLat = 0;
            let centerLon = 0;
            let validCount = 0;
            
            for (let i = 0; i < convertedPoints.length; i++) {
                if (validIndices.has(i)) {
                    centerLat += convertedPoints[i].lat;
                    centerLon += convertedPoints[i].lon;
                    validCount++;
                }
            }
            
            if (validCount === 0) break;
            
            centerLat /= validCount;
            centerLon /= validCount;
            
            // 计算所有点到中心的距离（合并遍历，减少中间数组）
            let sumDistance = 0;
            let count = 0;
            const distancesToCenter = [];
            
            for (let i = 0; i < convertedPoints.length; i++) {
                if (validIndices.has(i)) {
                    const dist = GeoUtils.haversineDistance(
                        centerLat, centerLon,
                        convertedPoints[i].lat, convertedPoints[i].lon
                    ) * 1000; // 转为米
                    distancesToCenter.push({ index: i, distance: dist });
                    sumDistance += dist;
                    count++;
                }
            }
            
            if (distancesToCenter.length === 0 || count === 0) break;
            
            // 计算距离的统计信息（避免创建中间数组）
            // 明确检查 count > 0，防止除零错误
            if (count <= 0) break;
            
            const avgDistance = sumDistance / count;
            let varianceSum = 0;
            for (const item of distancesToCenter) {
                varianceSum += Math.pow(item.distance - avgDistance, 2);
            }
            const variance = varianceSum / count;
            const stdDistance = Math.sqrt(variance);
            
            // 计算阈值
            const thresholdMultiplier = iteration === 0 
                ? FITParser.OUTLIER_FILTERING.THRESHOLD_MULTIPLIER_FIRST 
                : FITParser.OUTLIER_FILTERING.THRESHOLD_MULTIPLIER_SUBSEQUENT;
            const minThreshold = iteration === 0 
                ? FITParser.OUTLIER_THRESHOLDS.FIRST_ITERATION 
                : FITParser.OUTLIER_THRESHOLDS.SUBSEQUENT;
            const globalOutlierThreshold = Math.max(stdDistance * thresholdMultiplier, minThreshold);
            const finalThreshold = Math.max(globalOutlierThreshold, FITParser.OUTLIER_THRESHOLDS.MINIMUM);
            
            // 过滤异常点
            let outliersRemovedThisIteration = 0;
            for (const item of distancesToCenter) {
                if (item.distance > finalThreshold) {
                    validIndices.delete(item.index);
                    outliersRemovedThisIteration++;
                    totalOutliersRemoved++;
                    logger.warn(`跳过全局异常点 [${item.index}]: 距离中心=${item.distance.toFixed(0)}米, 坐标=(${convertedPoints[item.index].lat.toFixed(6)}, ${convertedPoints[item.index].lon.toFixed(6)})`);
                }
            }
            
            if (outliersRemovedThisIteration === 0) {
                break; // 没有发现更多异常点，提前退出
            }
            
            iteration++;
        }
        
        return totalOutliersRemoved;
    }

    /**
     * 过滤相邻点离群点（只检查端点）
     * @param {Array} convertedPoints - 转换后的点数组
     * @param {Set} validIndices - 有效点索引集合
     * @returns {number} 移除的离群点数量
     */
    filterAdjacentOutliers(convertedPoints, validIndices) {
        // 参数验证
        if (!Array.isArray(convertedPoints) || convertedPoints.length === 0) {
            logger.warn('filterAdjacentOutliers: convertedPoints 参数无效');
            return 0;
        }
        if (!(validIndices instanceof Set)) {
            logger.warn('filterAdjacentOutliers: validIndices 参数不是 Set 类型');
            return 0;
        }
        
        let adjacentOutliersRemoved = 0;
        const checkEndPoints = Math.min(3, Math.floor(convertedPoints.length * FITParser.OUTLIER_FILTERING.CHECK_ENDPOINTS_RATIO));
        const extremeThreshold = FITParser.OUTLIER_THRESHOLDS.EXTREME_ADJACENT;
        
        // 检查开头的点
        for (let i = 0; i < checkEndPoints && i < convertedPoints.length - 1; i++) {
            if (!validIndices.has(i) || !validIndices.has(i + 1)) continue;
            
            const dist = GeoUtils.haversineDistance(
                convertedPoints[i].lat, convertedPoints[i].lon,
                convertedPoints[i + 1].lat, convertedPoints[i + 1].lon
            ) * 1000; // 转为米
            
            if (dist > extremeThreshold) {
                if (i + 2 < convertedPoints.length && validIndices.has(i + 2)) {
                    const distToNext = GeoUtils.haversineDistance(
                        convertedPoints[i].lat, convertedPoints[i].lon,
                        convertedPoints[i + 2].lat, convertedPoints[i + 2].lon
                    ) * 1000;
                    const distFromNext = GeoUtils.haversineDistance(
                        convertedPoints[i + 1].lat, convertedPoints[i + 1].lon,
                        convertedPoints[i + 2].lat, convertedPoints[i + 2].lon
                    ) * 1000;
                    
                    if (distToNext > extremeThreshold && distToNext > distFromNext) {
                        validIndices.delete(i);
                        adjacentOutliersRemoved++;
                    } else if (distFromNext > extremeThreshold && distFromNext > distToNext) {
                        validIndices.delete(i + 1);
                        adjacentOutliersRemoved++;
                    }
                } else if (dist > extremeThreshold * 2) {
                    validIndices.delete(i + 1);
                    adjacentOutliersRemoved++;
                }
            }
        }
        
        // 检查末尾的点
        for (let i = convertedPoints.length - 1; i >= convertedPoints.length - checkEndPoints && i > 0; i--) {
            if (!validIndices.has(i) || !validIndices.has(i - 1)) continue;
            
            const dist = GeoUtils.haversineDistance(
                convertedPoints[i - 1].lat, convertedPoints[i - 1].lon,
                convertedPoints[i].lat, convertedPoints[i].lon
            ) * 1000; // 转为米
            
            if (dist > extremeThreshold) {
                if (i - 2 >= 0 && validIndices.has(i - 2)) {
                    const distToPrev = GeoUtils.haversineDistance(
                        convertedPoints[i].lat, convertedPoints[i].lon,
                        convertedPoints[i - 2].lat, convertedPoints[i - 2].lon
                    ) * 1000;
                    const distFromPrev = GeoUtils.haversineDistance(
                        convertedPoints[i - 1].lat, convertedPoints[i - 1].lon,
                        convertedPoints[i - 2].lat, convertedPoints[i - 2].lon
                    ) * 1000;
                    
                    if (distToPrev > extremeThreshold && distToPrev > distFromPrev) {
                        validIndices.delete(i);
                        adjacentOutliersRemoved++;
                    } else if (distFromPrev > extremeThreshold && distFromPrev > distToPrev) {
                        validIndices.delete(i - 1);
                        adjacentOutliersRemoved++;
                    }
                } else if (dist > extremeThreshold * 2) {
                    validIndices.delete(i);
                    adjacentOutliersRemoved++;
                    logger.warn(`跳过末尾跨洲异常点 [${i}]: 距离上一个点=${dist.toFixed(0)}米`);
                }
            }
        }
        
        return adjacentOutliersRemoved;
    }

    /**
     * 构建最终点数组
     * @param {Array} convertedPoints - 转换后的点数组
     * @param {Set} validIndices - 有效点索引集合
     * @returns {Object} {points, trackDates}
     */
    buildFinalPoints(convertedPoints, validIndices) {
        // 参数验证
        if (!Array.isArray(convertedPoints)) {
            logger.warn('buildFinalPoints: convertedPoints 参数不是数组');
            return { points: [], trackDates: [] };
        }
        if (!(validIndices instanceof Set)) {
            logger.warn('buildFinalPoints: validIndices 参数不是 Set 类型');
            return { points: [], trackDates: [] };
        }
        
        const points = [];
        const trackDates = [];
        
        convertedPoints.forEach((point, index) => {
            if (!validIndices.has(index)) {
                return; // 跳过被标记为无效的点
            }
            
            points.push({
                lat: point.lat,
                lon: point.lon,
                timestamp: point.timestamp,
                elevation: point.elevation
            });
            
            if (point.timestamp) {
                trackDates.push(point.timestamp);
            }
        });
        
        return { points, trackDates };
    }

    /**
     * 从解析后的FIT数据中提取轨迹点
     * @param {Object} fitData - FIT解析后的数据
     * @param {string} filename - 文件名
     * @returns {Object} 提取结果
     */
    extractTrackPoints(fitData, filename) {
        // FIT 文件中的记录在 records 数组中
        if (!fitData.records || !Array.isArray(fitData.records)) {
            throw new Error('FIT文件中未找到有效的轨迹记录');
        }

        // 第一步：收集原始坐标（提前过滤明显无效的数据）
        const rawCoordinates = this.collectRawCoordinates(fitData.records);
        if (rawCoordinates.length === 0) {
            throw new Error('FIT文件中未找到有效的GPS坐标');
        }

        // 第二步：确定坐标格式
        const formatAnalysis = this.determineCoordinateFormat(rawCoordinates);
        
        // 第三步：转换所有坐标
        const convertedPoints = this.convertCoordinates(rawCoordinates, formatAnalysis);
        if (ArrayUtils.isEmpty(convertedPoints)) {
            throw new Error('FIT文件中未找到有效的GPS轨迹点');
        }
        
        // 第四步：过滤离群点
        // 使用 Array.from 优化 Set 初始化
        const validIndices = new Set(Array.from({length: convertedPoints.length}, (_, i) => i));
        
        // 过滤全局离群点
        this.filterGlobalOutliers(convertedPoints, validIndices);
        
        // 过滤相邻点离群点
        this.filterAdjacentOutliers(convertedPoints, validIndices);
        
        // 第五步：构建最终点数组
        const { points, trackDates } = this.buildFinalPoints(convertedPoints, validIndices);

        if (ArrayUtils.isEmpty(points)) {
            throw new Error('FIT文件中未找到有效的GPS轨迹点');
        }

        // 计算轨迹距离
        const trackDistance = this.calculateDistance(points);

        // 更新统计信息
        this.totalPoints += points.length;
        this.totalDistance += trackDistance;
        
        // 更新日期范围（使用循环避免栈溢出）
        if (trackDates.length > 0) {
            let minTimestamp = trackDates[0];
            let maxTimestamp = trackDates[0];
            for (let i = 1; i < trackDates.length; i++) {
                if (trackDates[i] < minTimestamp) minTimestamp = trackDates[i];
                if (trackDates[i] > maxTimestamp) maxTimestamp = trackDates[i];
            }
            const minDate = new Date(minTimestamp);
            const maxDate = new Date(maxTimestamp);
            
            if (!this.dateRange.min || minDate < this.dateRange.min) {
                this.dateRange.min = minDate;
            }
            if (!this.dateRange.max || maxDate > this.dateRange.max) {
                this.dateRange.max = maxDate;
            }
        }

        const result = {
            filename,
            points,
            pointCount: points.length,
            distance: trackDistance,
            dates: trackDates
        };
        
        return result;
    }

    /**
     * 将 semicircles（半圆）单位转换为度
     * @param {number} semicircles - semicircles 值（32位有符号整数）
     * @returns {number} 度数值（保留6位小数精度）
     */
    semicirclesToDegrees(semicircles) {
        if (!TypeChecker.isNumber(semicircles)) {
            return NaN;
        }
        
        // 确保 semicircles 是有符号32位整数
        // JavaScript 使用 64 位浮点数，但 FIT 文件使用 32 位有符号整数
        // 如果值超过 32 位有符号整数范围，需要正确处理
        let signedValue = semicircles;
        
        // 转换为 32 位有符号整数
        // 使用位运算确保正确的符号扩展
        signedValue = signedValue | 0;
        
        // 如果值是无符号形式的大于 2^31 的数，转换为有符号
        if (signedValue > 0x7FFFFFFF) {
            signedValue = signedValue - 0x100000000;
        }
        
        // semicircles 转度: degrees = semicircles * (180 / 2^31)
        // 使用预计算的常量，避免重复计算
        const degrees = signedValue * this.SEMICIRCLES_TO_DEGREES;
        
        // 保留6位小数精度（对应约10厘米精度，符合GPS数据规范）
        // 使用 Math.round 而不是 toFixed，避免字符串转换
        return Math.round(degrees * 1000000) / 1000000;
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
            
            const distance = GeoUtils.haversineDistance(
                prev.lat, prev.lon,
                curr.lat, curr.lon
            );
            
            totalDistance += distance;
        }

        return totalDistance;
    }


    /**
     * 批量解析多个FIT文件
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
                logger.error(`解析文件 ${file.name} 失败:`, error);
                
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

// 导出FITParser类
window.FITParser = FITParser;
