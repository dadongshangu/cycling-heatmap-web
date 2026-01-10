#!/usr/bin/env node
/**
 * 测试运行器 - 简单的测试框架
 * 支持单元测试和功能测试
 */

class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.skipped = 0;
        this.startTime = null;
        this.results = [];
    }

    /**
     * 注册测试用例
     * @param {string} name - 测试名称
     * @param {Function} fn - 测试函数（可以是async）
     */
    test(name, fn) {
        this.tests.push({ name, fn });
    }

    /**
     * 断言函数
     * @param {boolean} condition - 断言条件
     * @param {string} message - 错误消息
     */
    assert(condition, message = 'Assertion failed') {
        if (!condition) {
            throw new Error(message);
        }
    }

    /**
     * 断言相等
     * @param {*} actual - 实际值
     * @param {*} expected - 期望值
     * @param {string} message - 错误消息
     */
    assertEqual(actual, expected, message = null) {
        const msg = message || `Expected ${expected}, but got ${actual}`;
        if (actual !== expected) {
            throw new Error(msg);
        }
    }

    /**
     * 断言近似相等（用于浮点数比较）
     * @param {number} actual - 实际值
     * @param {number} expected - 期望值
     * @param {number} tolerance - 容差
     * @param {string} message - 错误消息
     */
    assertAlmostEqual(actual, expected, tolerance = 0.0001, message = null) {
        const diff = Math.abs(actual - expected);
        const msg = message || `Expected ${expected} ± ${tolerance}, but got ${actual} (diff: ${diff})`;
        if (diff > tolerance) {
            throw new Error(msg);
        }
    }

    /**
     * 断言在范围内
     * @param {number} value - 值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @param {string} message - 错误消息
     */
    assertInRange(value, min, max, message = null) {
        const msg = message || `Expected ${value} to be between ${min} and ${max}`;
        if (value < min || value > max) {
            throw new Error(msg);
        }
    }

    /**
     * 断言不为空
     * @param {*} value - 值
     * @param {string} message - 错误消息
     */
    assertNotEmpty(value, message = null) {
        const msg = message || 'Expected value to be not empty';
        if (!value || (Array.isArray(value) && value.length === 0)) {
            throw new Error(msg);
        }
    }

    /**
     * 运行所有测试
     */
    async run() {
        console.log('🚀 开始运行测试...\n');
        this.startTime = Date.now();

        for (const test of this.tests) {
            try {
                // 检查是否是异步函数
                if (test.fn.constructor.name === 'AsyncFunction') {
                    await test.fn();
                } else {
                    test.fn();
                }
                
                this.passed++;
                this.results.push({ name: test.name, status: 'passed', error: null });
                console.log(`✅ ${test.name}`);
            } catch (error) {
                this.failed++;
                this.results.push({ name: test.name, status: 'failed', error: error.message });
                console.log(`❌ ${test.name}`);
                console.log(`   错误: ${error.message}`);
                if (error.stack) {
                    const stackLines = error.stack.split('\n').slice(0, 3);
                    stackLines.forEach(line => {
                        if (line.trim()) {
                            console.log(`   ${line.trim()}`);
                        }
                    });
                }
            }
        }

        this.printSummary();
        return this.failed === 0;
    }

    /**
     * 打印测试摘要
     */
    printSummary() {
        const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
        console.log('\n' + '='.repeat(60));
        console.log('📊 测试结果摘要');
        console.log('='.repeat(60));
        console.log(`总测试数: ${this.tests.length}`);
        console.log(`✅ 通过: ${this.passed}`);
        console.log(`❌ 失败: ${this.failed}`);
        console.log(`⏭️  跳过: ${this.skipped}`);
        console.log(`⏱️  耗时: ${duration}秒`);
        console.log('='.repeat(60));

        if (this.failed > 0) {
            console.log('\n失败的测试:');
            this.results
                .filter(r => r.status === 'failed')
                .forEach(r => {
                    console.log(`  ❌ ${r.name}`);
                    console.log(`     ${r.error}`);
                });
        }
    }

    /**
     * 获取测试结果（JSON格式）
     */
    getResults() {
        return {
            total: this.tests.length,
            passed: this.passed,
            failed: this.failed,
            skipped: this.skipped,
            duration: Date.now() - this.startTime,
            results: this.results
        };
    }
}

module.exports = TestRunner;
