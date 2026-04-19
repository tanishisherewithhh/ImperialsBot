import { BaseFeature } from './BaseFeature.js';

export class AnalyticsManager extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.metrics = {};
        this.trackers = new Map();
        this.trackingInterval = null;
        this.enabled = true;

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

        this.bytesReceived = 0;
        this.bytesSent = 0;
        this.registerMetric('network', () => {
            const rx = this.bytesReceived / 1024 / 2; // KB/s (since polling is 2s)
            const tx = this.bytesSent / 1024 / 2;
            this.bytesReceived = 0;
            this.bytesSent = 0;
            return { rx: Math.round(rx * 10) / 10, tx: Math.round(tx * 10) / 10 };
        });

        this.registerMetric('ram', () => {
            return Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 10) / 10;
        });

        let lastCpuUsage = process.cpuUsage();
        let lastCpuTime = Date.now();
        this.registerMetric('cpu', () => {
            const currentUsage = process.cpuUsage(lastCpuUsage);
            const currentTime = Date.now();
            const timeDiff = currentTime - lastCpuTime;
            lastCpuUsage = process.cpuUsage();
            lastCpuTime = currentTime;
            
            const userPct = currentUsage.user / 1000 / timeDiff;
            const systemPct = currentUsage.system / 1000 / timeDiff;
            const totalPct = (userPct + systemPct) * 100;
            return Math.round(Math.min(100, totalPct) * 10) / 10;
        });
        
        this.eventsData = { kills: 0, deaths: 0, itemsCollected: 0 };
        this.registerMetric('events', () => {
            return { ...this.eventsData };
        });

        this.registerMetric('position', () => {
            if (!this.botClient.bot || !this.botClient.bot.entity) return null;
            const pos = this.botClient.bot.entity.position;
            return { x: Math.round(pos.x), z: Math.round(pos.z) };
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

        this.botClient.bot.on('inject_allowed', () => {
            if (this.botClient.bot && this.botClient.bot._client) {
                this.botClient.bot._client.on('packet', (data, meta, buffer, fullBuffer) => {
                    if (fullBuffer) this.bytesReceived += fullBuffer.length;
                    else if (buffer) this.bytesReceived += buffer.length;
                });

                const originalWrite = this.botClient.bot._client.write.bind(this.botClient.bot._client);
                this.botClient.bot._client.write = (name, params) => {
                    try {
                        let size = 1 + name.length;
                        if (params) {
                            size += JSON.stringify(params).length;
                        }
                        this.bytesSent += size;
                    } catch (e) { }
                    return originalWrite(name, params);
                };
            }
        });

        this.botClient.bot.on('death', () => {
            this.eventsData.deaths++;
            this.botClient.emit('analyticsEvent', { type: 'death', message: 'Bot died' });
        });

        this.botClient.bot.on('playerCollect', (collector, collected) => {
            if (collector === this.botClient.bot.entity) {
                this.eventsData.itemsCollected++;
            }
        });

        this.botClient.bot.on('entityDead', (entity) => {
            if (this.botClient.bot.pvp && this.botClient.bot.pvp.target === entity) {
                this.eventsData.kills++;
                this.botClient.emit('analyticsEvent', { type: 'kill', message: `Killed entity` });
            }
        });

        this.botClient.bot.on('time', () => {
            if (!this.botClient.bot || !this.botClient.bot.time) return;
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
        if (!this.enabled) return;
        this.trackingInterval = setInterval(() => {
            if (!this.botClient.bot || !this.botClient.bot.entity) return;

            const now = Date.now();
            const stat = { timestamp: now };

            for (const [name, fetcher] of this.trackers.entries()) {
                const val = fetcher();
                stat[name] = val;

                this.metrics[name].push({ t: now, v: val });

                if (this.metrics[name].length > 43200) { // 24 hours at 2s interval
                    this.metrics[name].shift();
                }
            }

            this.botClient.emit('analyticsUpdate', stat);
        }, 5000);
    }

    getStats() {
        return this.metrics;
    }

    exportData() {
        return JSON.stringify(this.metrics, null, 2);
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled && this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        } else if (enabled && !this.trackingInterval && this.botClient.bot) {
            this.startTracking();
        }
    }
}
