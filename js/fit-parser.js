/**
 * FIT Parser - 解析FIT文件并提取轨迹点
 * 使用 fit-file-parser 库进行解析，只提取必要的GPS信息
 */

class FITParser {
    constructor() {
        this.tracks = [];
        this.totalPoints = 0;
        this.dateRange = { min: null, max: null };
        this.totalDistance = 0;
        
        // 检测 fit-file-parser 库是否可用
        this.fitFileParserAvailable = this.checkFitFileParserLibrary();
        
        if (!this.fitFileParserAvailable) {
            logger.warn('fit-file-parser 库未加载，将使用手动解析（可能不够准确）。请参考 FIT_LIBRARY_SETUP.md 下载库文件。');
        }
        
        // 预计算 semicircles 转度的常量（降级方案使用）
        // 度数 = semicircles * (180 / 2^31)
        this.SEMICIRCLES_TO_DEGREES = 180 / Math.pow(2, 31);
    }
    
    /**
     * 检测 fit-file-parser 库是否可用
     * @returns {boolean} 库是否可用
     */
    checkFitFileParserLibrary() {
        // 尝试多种可能的全局变量名
        if (typeof FitParser !== 'undefined' && typeof FitParser === 'function') {
            return true;
        }
        if (typeof FitFileParser !== 'undefined' && typeof FitFileParser === 'function') {
            return true;
        }
        if (typeof window !== 'undefined' && window.FitParser && typeof window.FitParser === 'function') {
            return true;
        }
        if (typeof window !== 'undefined' && window.FitFileParser && typeof window.FitFileParser === 'function') {
            return true;
        }
        return false;
    }
    
    /**
     * 获取 FitParser 构造函数
     * @returns {Function|null} FitParser 构造函数或 null
     */
    getFitParser() {
        if (typeof FitParser !== 'undefined' && typeof FitParser === 'function') {
            return FitParser;
        }
        if (typeof FitFileParser !== 'undefined' && typeof FitFileParser === 'function') {
            return FitFileParser;
        }
        if (typeof window !== 'undefined' && window.FitParser && typeof window.FitParser === 'function') {
            return window.FitParser;
        }
        if (typeof window !== 'undefined' && window.FitFileParser && typeof window.FitFileParser === 'function') {
            return window.FitFileParser;
        }
        return null;
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
            return { isSemicircles: true, maxAdjacentDistance: 5000, avgAdjacentDistance: 100, validRatio: 0 };
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
            if (absLat < 10 && absLon < 10) {
                return; // 跳过这个采样点
            }

            // 格式1：作为度数（如果值在合理范围内）
            // 但需要更严格的判断：值必须在 -90 到 90 和 -180 到 180 范围内
            // 并且不能太小（< 1），因为semicircles转换后的值也可能在这个范围内
            if (absLat <= 90 && absLon <= 180 && absLat >= 1 && absLon >= 1) {
                const lat = latValue;
                const lon = lonValue;
                // 额外检查：不能接近原点
                if (TypeChecker.isValidCoordinate(lat, lon) && Math.abs(lat) >= 0.001 && Math.abs(lon) >= 0.001) {
                    degreesResults.push({ lat, lon, raw: sample });
                }
            }

            // 格式2：作为semicircles转换（总是尝试）
            const lat = this.semicirclesToDegrees(latValue);
            const lon = this.semicirclesToDegrees(lonValue);
            // 额外检查：不能接近原点
            if (TypeChecker.isValidCoordinate(lat, lon) && Math.abs(lat) >= 0.001 && Math.abs(lon) >= 0.001) {
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
        if (semicirclesResults.length > degreesResults.length * 2) {
            useSemicircles = true;
        } else if (degreesRatio < 0.2 && semicirclesRatio > 0.5) {
            useSemicircles = true;
        } else if (degreesResults.length === 0 && semicirclesResults.length > 0) {
            useSemicircles = true;
        } else {
            // 计算相邻点距离统计，选择距离更合理的格式
            const degreesStats = this.calculateAdjacentDistanceStats(degreesResults);
            const semicirclesStats = this.calculateAdjacentDistanceStats(semicirclesResults);
            
            // 如果semicircles格式的相邻点平均距离更小（更合理），使用semicircles
            if (semicirclesStats.avgDistance < degreesStats.avgDistance && semicirclesStats.avgDistance < 1000) {
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
            const dist = this.haversineDistance(
                points[i].lat, points[i].lon,
                points[i + 1].lat, points[i + 1].lon
            ) * 1000; // 转为米
            distances.push(dist);
        }

        // 计算平均距离和最大距离
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        const maxAdjacentDistance = Math.max(...distances);

        return {
            avgDistance,
            maxAdjacentDistance
        };
    }

    /**
     * 从解析后的FIT数据中提取轨迹点
     * @param {Object} fitData - FIT解析后的数据
     * @param {string} filename - 文件名
     * @returns {Object} 提取结果
     */
    extractTrackPoints(fitData, filename) {
        const points = [];
        let trackDistance = 0;
        let trackDates = [];

        // FIT 文件中的记录在 records 数组中
        if (!fitData.records || !Array.isArray(fitData.records)) {
            throw new Error('FIT文件中未找到有效的轨迹记录');
        }

        // 第一步：收集所有原始坐标值
        // 需要更智能地过滤无效的GPS坐标
        const rawCoordinates = [];
        fitData.records.forEach(record => {
            if (record.position_lat !== undefined && record.position_long !== undefined) {
                const absLat = Math.abs(record.position_lat);
                const absLon = Math.abs(record.position_long);
                
                // 过滤明显无效的坐标对：
                // 1. 值为0或null（已经在上面检查了undefined）
                if (record.position_lat === 0 && record.position_long === 0) {
                    return; // 跳过(0,0)坐标
                }
                
                // 2. 经度太小（< 10）但纬度看起来像semicircles（> 100），可能是无效数据
                // 例如：(4492341, 1), (1651364, 1) 等
                if (absLon < 10 && absLon > 0 && absLat > 100) {
                    // 跳过明显无效的坐标对（经度太小但纬度像semicircles）
                    return; // 跳过明显无效的坐标对
                }
                
                // 保留所有其他值，让后续处理来判断
                rawCoordinates.push({
                    lat: record.position_lat,
                    lon: record.position_long,
                    record: record // 保存原始记录以便后续使用
                });
            }
        });

        if (rawCoordinates.length === 0) {
            throw new Error('FIT文件中未找到有效的GPS坐标');
        }

        // 第二步：采样分析（使用前50个点或所有点，取较小值）
        const sampleSize = Math.min(50, rawCoordinates.length);
        const samples = rawCoordinates.slice(0, sampleSize);
        
        // 先检查原始值的范围，判断是否可能是semicircles
        // FIT文件格式标准：GPS坐标总是以semicircles格式存储
        // 但某些库或转换工具可能会输出度数格式，所以需要兼容两种格式
        
        // 过滤明显无效的坐标对（如经度为1或非常小的值）
        const validSamples = samples.filter(sample => {
            const absLat = Math.abs(sample.lat);
            const absLon = Math.abs(sample.lon);
            // 过滤掉明显无效的坐标：
            // 1. 经度为1或非常小的值（如1, 2, 3等），这些不是有效的GPS坐标
            // 2. 但保留所有可能的有效值，让后续的格式判断来处理
            if (absLon < 10 && absLon > 0 && absLat > 100) {
                // 经度太小但纬度看起来像semicircles，可能是无效数据
                return false;
            }
            return true;
        });
        
        // 如果过滤后样本太少，使用原始样本
        const analysisSamples = validSamples.length >= 3 ? validSamples : samples;
        
        let likelySemicircles = false;
        let semicirclesCount = 0;
        let degreesCount = 0;
        
        analysisSamples.forEach(sample => {
            const absLat = Math.abs(sample.lat);
            const absLon = Math.abs(sample.lon);
            // 如果值 > 1000，很可能是semicircles（FIT标准格式）
            if (absLat > 1000 || absLon > 1000) {
                semicirclesCount++;
            } else if (absLat <= 90 && absLon <= 180 && absLat >= 0.1 && absLon >= 0.1) {
                // 值在度数范围内，且不是太小（避免误判接近0的semicircles值）
                degreesCount++;
            }
        });
        
        // 更保守的策略：如果大部分值都 > 1000，或者semicircles特征明显，直接使用semicircles格式
        // 这样可以避免误判，因为FIT标准格式就是semicircles
        if (semicirclesCount > 0 && (semicirclesCount > degreesCount * 1.5 || semicirclesCount > analysisSamples.length * 0.3)) {
            likelySemicircles = true;
        } else if (semicirclesCount === 0 && degreesCount > analysisSamples.length * 0.8) {
            // 只有在完全没有semicircles特征，且大部分值都在度数范围内时，才考虑使用度数格式
        } else {
            // 默认使用semicircles格式（FIT标准）
            likelySemicircles = true;
        }
        
        let formatAnalysis;
        if (likelySemicircles) {
            // 直接使用semicircles格式，计算统计信息
            const semicirclesResults = [];
            samples.forEach(sample => {
                const lat = this.semicirclesToDegrees(sample.lat);
                const lon = this.semicirclesToDegrees(sample.lon);
                if (TypeChecker.isValidCoordinate(lat, lon)) {
                    semicirclesResults.push({ lat, lon });
                }
            });
            const stats = this.calculateAdjacentDistanceStats(semicirclesResults);
            formatAnalysis = {
                isSemicircles: true,
                maxAdjacentDistance: stats.maxAdjacentDistance,
                avgAdjacentDistance: stats.avgDistance,
                validRatio: semicirclesResults.length / samples.length
            };
        } else {
            // 尝试两种转换方式，找出哪种格式产生的点更集中
            formatAnalysis = this.analyzeCoordinateFormat(samples);
        }
        
        // 第三步：使用确定的格式处理所有点，并基于相邻点距离剔除离群点
        const maxSamples = 10; // 记录前10个点的详细信息用于调试
        const debugSamples = []; // 存储调试信息
        
        // 先转换所有点，然后基于相邻点距离过滤
        const convertedPoints = [];
        const maxAdjacentDistance = Math.max(formatAnalysis.maxAdjacentDistance * 5, 5000); // 允许的最大相邻点距离（米），5倍平均距离或至少5公里
        
        
        // 第一步：转换所有点
        rawCoordinates.forEach((coord, index) => {
            const record = coord.record;
            const latValue = coord.lat;
            const lonValue = coord.lon;
            
            // 预检查：过滤明显无效的数据
            // 注意：某些设备可能使用非标准格式，所以阈值要宽松
            const absLat = Math.abs(latValue);
            const absLon = Math.abs(lonValue);
            
            // 过滤明显无效的坐标对：
            // 1. 值为0（已经在收集时过滤了）
            // 2. 经度太小（< 10）但纬度看起来像semicircles（> 100），可能是无效数据
            // 3. 值太小（< 1）且是正数，可能是无效数据
            // 但保留负数，因为某些semicircles值可能是负数
            if (absLat < 1 && absLon < 1 && latValue >= 0 && lonValue >= 0) {
                // 跳过明显无效的坐标点（值太小）
                return; // 跳过明显无效的坐标
            }
            
            // 如果经度太小（< 10）但纬度看起来像semicircles（> 100），很可能是无效数据
            if (absLon < 10 && absLon > 0 && absLat > 100) {
                // 跳过明显无效的坐标点（经度太小但纬度像semicircles）
                return; // 跳过明显无效的坐标
            }
            
            let lat, lon;
            
            // 使用分析结果确定的格式进行转换
            if (formatAnalysis.isSemicircles) {
                lat = this.semicirclesToDegrees(latValue);
                lon = this.semicirclesToDegrees(lonValue);
            } else {
                // 如果判断为度数格式，但值不在合理范围内，尝试作为semicircles转换
                if (absLat > 90 || absLon > 180) {
                    // 值超出度数范围，尝试semicircles转换
                    lat = this.semicirclesToDegrees(latValue);
                    lon = this.semicirclesToDegrees(lonValue);
                } else {
                    lat = latValue;
                    lon = lonValue;
                }
            }
            
            // 验证转换后的坐标有效性
            if (!TypeChecker.isValidCoordinate(lat, lon)) {
                // 跳过无效坐标点
                return; // 跳过无效坐标
            }
            
            // 额外检查：如果转换后的坐标接近 (0, 0)，很可能是无效数据
            if (Math.abs(lat) < 0.001 && Math.abs(lon) < 0.001) {
                // 跳过接近原点的坐标点
                return; // 跳过接近原点的坐标
            }
            
            // 提取时间戳
            let timestamp = null;
            if (record.timestamp) {
                let dateObj;
                if (record.timestamp instanceof Date) {
                    dateObj = record.timestamp;
                } else if (typeof record.timestamp === 'string') {
                    dateObj = new Date(record.timestamp);
                } else if (typeof record.timestamp === 'number') {
                    dateObj = new Date(record.timestamp > 1e12 ? record.timestamp : record.timestamp * 1000);
                }

                if (dateObj && TypeChecker.isValidDate(dateObj)) {
                    timestamp = dateObj.getTime();
                }
            }

            // 提取海拔信息（可选）
            let elevation = null;
            if (record.altitude !== undefined && record.altitude !== null) {
                const altValue = parseFloat(record.altitude);
                if (TypeChecker.isNumber(altValue)) {
                    elevation = altValue;
                }
            }
            
            convertedPoints.push({
                lat,
                lon,
                timestamp,
                elevation,
                rawIndex: index,
                rawLat: latValue,
                rawLon: lonValue
            });
        });
        
        if (convertedPoints.length === 0) {
            throw new Error('FIT文件中未找到有效的GPS轨迹点');
        }
        
        // 第二步：基于相邻点距离和中心位置过滤异常点
        const validIndices = new Set(); // 记录有效点的索引
        
        // 先标记所有点
        for (let i = 0; i < convertedPoints.length; i++) {
            validIndices.add(i);
        }
        
        // 第一步：迭代式全局异常点检测 - 更严格地过滤跨洲异常点
        // 使用迭代方法：先过滤明显异常点，重新计算中心，再过滤
        let iteration = 0;
        const maxIterations = 3;
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
            
            // 计算所有点到中心的距离
            const distancesToCenter = [];
            for (let i = 0; i < convertedPoints.length; i++) {
                if (validIndices.has(i)) {
                    const dist = this.haversineDistance(
                        centerLat, centerLon,
                        convertedPoints[i].lat, convertedPoints[i].lon
                    ) * 1000; // 转为米
                    distancesToCenter.push({ index: i, distance: dist });
                }
            }
            
            if (distancesToCenter.length === 0) break;
            
            // 计算距离的统计信息
            const distances = distancesToCenter.map(d => d.distance);
            const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
            const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
            const stdDistance = Math.sqrt(variance);
            
            // 更严格的阈值：只过滤跨洲的异常点
            // 第一次迭代使用更严格的阈值，后续迭代放宽
            // 但阈值不能太小，避免删除正常的轨迹点
            const thresholdMultiplier = iteration === 0 ? 2.5 : 3;
            const minThreshold = iteration === 0 ? 1000000 : 500000; // 第一次至少1000公里，后续500公里
            const globalOutlierThreshold = Math.max(stdDistance * thresholdMultiplier, minThreshold);
            
            // 额外保护：如果阈值太小（小于500公里），使用更大的阈值
            // 这样可以避免删除正常的轨迹点
            const finalThreshold = Math.max(globalOutlierThreshold, 500000); // 至少500公里
            
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
                // 没有发现更多异常点，可以提前退出
                break;
            }
            
            iteration++;
        }
        
        
        // 第二步：基于相邻点距离过滤 - 只过滤明显跨洲的异常点
        // 几乎不删除相邻点，只删除距离非常大的点（可能是跨洲异常点）
        // 这样可以保持轨迹的连续性，避免热力图断开
        let adjacentOutliersRemoved = 0;
        
        // 只检查开头和末尾各3个点，且只删除距离非常大的点（至少1000公里）
        const checkEndPoints = Math.min(3, Math.floor(convertedPoints.length * 0.01)); // 只检查开头和末尾各1%的点
        
        // 检查开头的点（非常保守，只删除跨洲异常点）
        for (let i = 0; i < checkEndPoints && i < convertedPoints.length - 1; i++) {
            if (!validIndices.has(i) || !validIndices.has(i + 1)) continue; // 跳过已标记为无效的点
            
            const dist = this.haversineDistance(
                convertedPoints[i].lat, convertedPoints[i].lon,
                convertedPoints[i + 1].lat, convertedPoints[i + 1].lon
            ) * 1000; // 转为米
            
            // 只删除距离非常大的点（至少1000公里，可能是跨洲异常点）
            const extremeThreshold = 1000000; // 1000公里
            
            if (dist > extremeThreshold) {
                // 如果距离非常大，判断哪个点是异常点
                if (i + 2 < convertedPoints.length && validIndices.has(i + 2)) {
                    const distToNext = this.haversineDistance(
                        convertedPoints[i].lat, convertedPoints[i].lon,
                        convertedPoints[i + 2].lat, convertedPoints[i + 2].lon
                    ) * 1000;
                    const distFromNext = this.haversineDistance(
                        convertedPoints[i + 1].lat, convertedPoints[i + 1].lon,
                        convertedPoints[i + 2].lat, convertedPoints[i + 2].lon
                    ) * 1000;
                    
                    // 只删除距离非常大的点
                    if (distToNext > extremeThreshold && distToNext > distFromNext) {
                        validIndices.delete(i);
                        adjacentOutliersRemoved++;
                        // 跳过开头跨洲异常点
                    } else if (distFromNext > extremeThreshold && distFromNext > distToNext) {
                        validIndices.delete(i + 1);
                        adjacentOutliersRemoved++;
                        // 跳过开头跨洲异常点
                    }
                } else if (dist > extremeThreshold * 2) {
                    // 只有距离非常大时才删除
                    validIndices.delete(i + 1);
                    adjacentOutliersRemoved++;
                    // 跳过末尾跨洲异常点
                }
            }
        }
        
        // 检查末尾的点（从后往前，非常保守）
        for (let i = convertedPoints.length - 1; i >= convertedPoints.length - checkEndPoints && i > 0; i--) {
            if (!validIndices.has(i) || !validIndices.has(i - 1)) continue; // 跳过已标记为无效的点
            
            const dist = this.haversineDistance(
                convertedPoints[i - 1].lat, convertedPoints[i - 1].lon,
                convertedPoints[i].lat, convertedPoints[i].lon
            ) * 1000; // 转为米
            
            // 只删除距离非常大的点（至少1000公里）
            const extremeThreshold = 1000000; // 1000公里
            
            if (dist > extremeThreshold) {
                // 如果距离非常大，判断哪个点是异常点
                if (i - 2 >= 0 && validIndices.has(i - 2)) {
                    const distToPrev = this.haversineDistance(
                        convertedPoints[i].lat, convertedPoints[i].lon,
                        convertedPoints[i - 2].lat, convertedPoints[i - 2].lon
                    ) * 1000;
                    const distFromPrev = this.haversineDistance(
                        convertedPoints[i - 1].lat, convertedPoints[i - 1].lon,
                        convertedPoints[i - 2].lat, convertedPoints[i - 2].lon
                    ) * 1000;
                    
                    // 只删除距离非常大的点
                    if (distToPrev > extremeThreshold && distToPrev > distFromPrev) {
                        validIndices.delete(i);
                        adjacentOutliersRemoved++;
                        // 跳过末尾跨洲异常点
                    } else if (distFromPrev > extremeThreshold && distFromPrev > distToPrev) {
                        validIndices.delete(i - 1);
                        adjacentOutliersRemoved++;
                        // 跳过末尾跨洲异常点
                    }
                } else if (dist > extremeThreshold * 2) {
                    // 只有距离非常大时才删除
                    validIndices.delete(i);
                    adjacentOutliersRemoved++;
                    logger.warn(`跳过末尾跨洲异常点 [${i}]: 距离上一个点=${dist.toFixed(0)}米`);
                }
            }
        }
        
        
        // 不再检查中间的点，保持轨迹连续性
        
        // 第三步：构建最终的点数组
        let sampleCount = 0;
        convertedPoints.forEach((point, index) => {
            if (!validIndices.has(index)) {
                // 记录调试信息（被跳过的点）
                if (sampleCount < maxSamples) {
                    debugSamples.push({
                        index: sampleCount,
                        rawLat: point.rawLat,
                        rawLon: point.rawLon,
                        convertedLat: point.lat,
                        convertedLon: point.lon,
                        skipped: true,
                        skipReason: '相邻点距离过大'
                    });
                }
                return; // 跳过被标记为无效的点
            }
            
            // 记录调试信息
            if (sampleCount < maxSamples) {
                debugSamples.push({
                    index: sampleCount,
                    rawLat: point.rawLat,
                    rawLon: point.rawLon,
                    convertedLat: point.lat,
                    convertedLon: point.lon,
                    isSemicircles: formatAnalysis.isSemicircles
                });
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
            
            sampleCount++;
        });

        if (points.length === 0) {
            throw new Error('FIT文件中未找到有效的GPS轨迹点');
        }

        // 计算轨迹距离
        trackDistance = this.calculateDistance(points);

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
        
        // 将调试信息附加到结果中（用于测试工具）
        if (debugSamples.length > 0) {
            result.debugSamples = debugSamples;
        }
        
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
