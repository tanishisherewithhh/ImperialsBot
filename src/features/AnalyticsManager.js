import { BaseFeature } from './BaseFeature.js';

export class AnalyticsManager extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.metrics = {};
        this.trackers = new Map();
        this.trackingInterval = null;

        this.lastAge = 0;
        this.lastAgeTime = 0;
        this.tpsSamples = [];
        this.currentTps = 20;

        this.registerMetric('ping', () => {
            return this.botClient.bot.player ? this.botClient.bot.player.ping : 0;
        });

        this.registerMetric('tps', () => {
            return this.currentTps;
        });
    }

    registerMetric(name, fetchFunction) {
        this.metrics[name] = [];
        this.trackers.set(name, fetchFunction);
    }

    init() {
        this.botClient.bot.on('spawn', () => {
            if (this.trackingInterval) clearInterval(this.trackingInterval);
            this.lastAge = 0;
            this.lastAgeTime = 0;
            this.tpsSamples = [];
            this.currentTps = 20;
            this.startTracking();
        });

        this.botClient.bot.on('time', () => {
            if (!this.botClient.bot.time) return;
            const now = Date.now();
            const currentAge = this.botClient.bot.time.age;

            if (this.lastAge === 0 || this.lastAgeTime === 0) {
                this.lastAge = currentAge;
                this.lastAgeTime = now;
                return;
            }

            const ageDelta = currentAge - this.lastAge;
            const timeDelta = (now - this.lastAgeTime) / 1000;

            if (timeDelta > 0 && ageDelta >= 0) {
                const sample = ageDelta / timeDelta;
                const clampedSample = Math.max(0, Math.min(20, sample));
                this.tpsSamples.push(clampedSample);
                if (this.tpsSamples.length > 5) this.tpsSamples.shift();
                const avg = this.tpsSamples.reduce((a, b) => a + b, 0) / this.tpsSamples.length;
                this.currentTps = Math.round(avg * 10) / 10;
            }

            this.lastAge = currentAge;
            this.lastAgeTime = now;
        });

        this.botClient.bot.on('end', () => {
            if (this.trackingInterval) {
                clearInterval(this.trackingInterval);
                this.trackingInterval = null;
            }
        });
    }

    startTracking() {
        this.trackingInterval = setInterval(() => {
            if (!this.botClient.bot || !this.botClient.bot.entity) return;

            const now = Date.now();
            const stat = { timestamp: now };

            for (const [name, fetcher] of this.trackers.entries()) {
                const val = fetcher();
                stat[name] = val;

                this.metrics[name].push({ t: now, v: val });

                if (this.metrics[name].length > 1800) {
                    this.metrics[name].shift();
                }
            }

            this.botClient.emit('analyticsUpdate', stat);
        }, 2000);
    }

    getStats() {
        return this.metrics;
    }

    exportData() {
        return JSON.stringify(this.metrics, null, 2);
    }
}
