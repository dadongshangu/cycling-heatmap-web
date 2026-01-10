#!/usr/bin/env node
/**
 * GPX解析器单元测试
 * 测试GPX文件解析功能
 */

const path = require('path');
const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');

// 模拟浏览器环境的GPXParser
class GPXParser {
    constructor() {
        this.tracks = [];
        this.totalPoints = 0;
        this.dateRange = { min: null, max: null };
        this.totalDistance = 0;
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
        const trackPoints = xmlDoc.getElementsByTagName('trkpt');
        
        if (trackPoints.length === 0) {
            throw new Error('未找到有效的GPS轨迹点');
        }

        for (let i = 0; i < trackPoints.length; i++) {
            const trkpt = trackPoints[i];
            const lat = parseFloat(trkpt.getAttribute('lat'));
            const lon = parseFloat(trkpt.getAttribute('lon'));
            
            if (isNaN(lat) || isNaN(lon)) {
                continue;
            }

            // 检查坐标有效性
            if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                continue;
            }

            let ele = null;
            let time = null;

            // 提取海拔
            const eleNode = trkpt.getElementsByTagName('ele')[0];
            if (eleNode && eleNode.textContent) {
                ele = parseFloat(eleNode.textContent);
                if (isNaN(ele)) ele = null;
            }

            // 提取时间
            const timeNode = trkpt.getElementsByTagName('time')[0];
            if (timeNode && timeNode.textContent) {
                time = new Date(timeNode.textContent).getTime();
                if (isNaN(time)) time = null;
                else trackDates.push(time);
            }

            points.push({ lat, lon, ele, time });

            // 计算距离
            if (i > 0) {
                const prevPoint = points[i - 1];
                const dist = this.haversineDistance(prevPoint.lat, prevPoint.lon, lat, lon);
                trackDistance += dist;
            }
        }

        if (points.length === 0) {
            throw new Error('未找到有效的GPS轨迹点');
        }

        // 更新日期范围
        if (trackDates.length > 0) {
            trackDates.sort((a, b) => a - b);
            if (!this.dateRange.min || trackDates[0] < this.dateRange.min) {
                this.dateRange.min = trackDates[0];
            }
            if (!this.dateRange.max || trackDates[trackDates.length - 1] > this.dateRange.max) {
                this.dateRange.max = trackDates[trackDates.length - 1];
            }
        }

        this.tracks.push({
            name: filename,
            points: points,
            distance: trackDistance,
            pointCount: points.length
        });

        this.totalPoints += points.length;
        this.totalDistance += trackDistance;

        return {
            tracks: this.tracks,
            totalPoints: this.totalPoints,
            totalDistance: this.totalDistance,
            dateRange: this.dateRange
        };
    }

    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}

const TestRunner = require('../utils/test-runner');
const runner = new TestRunner();

// 测试用例
runner.test('GPX解析: 应该能解析有效的GPX文件', () => {
    const gpxPath = path.join(__dirname, '../fixtures/sample.gpx');
    const gpxContent = fs.readFileSync(gpxPath, 'utf8');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
    
    const gpxParser = new GPXParser();
    const result = gpxParser.extractTrackPoints(xmlDoc, 'test.gpx');
    
    runner.assertNotEmpty(result.tracks, '应该提取到轨迹');
    runner.assert(result.tracks.length > 0, '应该有至少一条轨迹');
});

runner.test('GPX解析: 应该提取正确的轨迹点数量', () => {
    const gpxPath = path.join(__dirname, '../fixtures/sample.gpx');
    const gpxContent = fs.readFileSync(gpxPath, 'utf8');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
    
    const gpxParser = new GPXParser();
    const result = gpxParser.extractTrackPoints(xmlDoc, 'test.gpx');
    
    runner.assertEqual(result.totalPoints, 3, '应该提取3个轨迹点');
});

runner.test('GPX解析: 坐标应该在合理范围内（中国境内）', () => {
    const gpxPath = path.join(__dirname, '../fixtures/sample.gpx');
    const gpxContent = fs.readFileSync(gpxPath, 'utf8');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
    
    const gpxParser = new GPXParser();
    const result = gpxParser.extractTrackPoints(xmlDoc, 'test.gpx');
    
    const firstTrack = result.tracks[0];
    const firstPoint = firstTrack.points[0];
    
    // 北京坐标范围：纬度约39-40，经度约116-117
    runner.assertInRange(firstPoint.lat, 35, 45, '纬度应该在35-45之间（中国北方）');
    runner.assertInRange(firstPoint.lon, 110, 125, '经度应该在110-125之间（中国东部）');
});

runner.test('GPX解析: 应该计算距离', () => {
    const gpxPath = path.join(__dirname, '../fixtures/sample.gpx');
    const gpxContent = fs.readFileSync(gpxPath, 'utf8');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
    
    const gpxParser = new GPXParser();
    const result = gpxParser.extractTrackPoints(xmlDoc, 'test.gpx');
    
    const firstTrack = result.tracks[0];
    runner.assert(firstTrack.distance >= 0, '距离应该大于等于0');
    // 3个点，每个点间隔约0.01度，距离应该约为1-2公里
    runner.assertInRange(firstTrack.distance, 0.1, 3, '距离应该在0.1-3公里之间');
});

runner.test('GPX解析: 空文件应该抛出错误', () => {
    const emptyGpx = '<?xml version="1.0"?><gpx version="1.1"></gpx>';
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(emptyGpx, 'text/xml');
    
    const gpxParser = new GPXParser();
    let errorThrown = false;
    try {
        gpxParser.extractTrackPoints(xmlDoc, 'empty.gpx');
    } catch (error) {
        errorThrown = true;
        runner.assert(error.message.includes('未找到有效的GPS轨迹点'), '应该抛出正确的错误消息');
    }
    runner.assert(errorThrown, '应该抛出错误');
});

// 运行测试
if (require.main === module) {
    // 检查是否有xmldom依赖
    try {
        require.resolve('@xmldom/xmldom');
    } catch (e) {
        console.log('⚠️  需要安装 @xmldom/xmldom 依赖才能运行GPX解析测试');
        console.log('   运行: npm install @xmldom/xmldom --save-dev');
        process.exit(0);
    }
    
    runner.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('测试运行失败:', error);
        process.exit(1);
    });
}

module.exports = { runner, GPXParser };
