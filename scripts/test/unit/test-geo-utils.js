#!/usr/bin/env node
/**
 * GeoUtils 单元测试
 * 测试地理计算工具函数
 */

const path = require('path');
const fs = require('fs');

// 加载GeoUtils（需要模拟浏览器环境）
// 由于GeoUtils是在浏览器环境中定义的，我们需要在Node.js中模拟它
class GeoUtils {
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

    static toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
}

const TestRunner = require('../utils/test-runner');
const runner = new TestRunner();

// 测试用例
runner.test('toRadians: 0度应该等于0弧度', () => {
    const result = GeoUtils.toRadians(0);
    runner.assertAlmostEqual(result, 0, 0.0001);
});

runner.test('toRadians: 90度应该等于π/2弧度', () => {
    const result = GeoUtils.toRadians(90);
    runner.assertAlmostEqual(result, Math.PI / 2, 0.0001);
});

runner.test('toRadians: 180度应该等于π弧度', () => {
    const result = GeoUtils.toRadians(180);
    runner.assertAlmostEqual(result, Math.PI, 0.0001);
});

runner.test('haversineDistance: 相同点距离应该为0', () => {
    const distance = GeoUtils.haversineDistance(39.9042, 116.4074, 39.9042, 116.4074);
    runner.assertAlmostEqual(distance, 0, 0.001);
});

runner.test('haversineDistance: 北京到上海的距离应该约为1068公里', () => {
    // 北京: 39.9042°N, 116.4074°E
    // 上海: 31.2304°N, 121.4737°E
    const distance = GeoUtils.haversineDistance(39.9042, 116.4074, 31.2304, 121.4737);
    // 实际距离约为1068公里，允许±50公里的误差
    runner.assertInRange(distance, 1018, 1118, `北京到上海距离应该在1018-1118公里之间，实际为${distance}公里`);
});

runner.test('haversineDistance: 短距离计算（1公里左右）', () => {
    // 测试两个相近点的距离（约1公里）
    const lat1 = 39.9042;
    const lon1 = 116.4074;
    // 向北移动约0.009度（约1公里）
    const lat2 = 39.9132;
    const lon2 = 116.4074;
    const distance = GeoUtils.haversineDistance(lat1, lon1, lat2, lon2);
    runner.assertInRange(distance, 0.8, 1.2, `短距离应该在0.8-1.2公里之间，实际为${distance}公里`);
});

runner.test('haversineDistance: 负坐标处理（南半球、西经）', () => {
    // 测试负坐标（南半球、西经）
    const distance = GeoUtils.haversineDistance(-33.8688, 151.2093, -37.8136, 144.9631);
    // 悉尼到墨尔本，实际距离约为713公里
    runner.assertInRange(distance, 663, 763, `悉尼到墨尔本距离应该在663-763公里之间，实际为${distance}公里`);
});

// 运行测试
if (require.main === module) {
    runner.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('测试运行失败:', error);
        process.exit(1);
    });
}

module.exports = { runner, GeoUtils };
