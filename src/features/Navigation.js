import { BaseFeature } from './BaseFeature.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const Vec3 = require('vec3');

export class Navigation extends BaseFeature {
    async init() {
        this.botClient.bot.once('spawn', () => {
            try {
                this.botClient.bot.loadPlugin(pathfinder);
            } catch (err) {
                this.botClient.log(`Pathfinder plugin failed to load: ${err.message}`, 'error');
            }
        });

        this.active = false;
        this.targetPos = null;
        this.navInterval = null;

        this.botClient.bot.on('goal_reached', () => {
            if (this.active && this.targetPos) {
                const target = this.targetPos;
                this.stop(true);
                this.botClient.updateStatus('Arrived');
                this.botClient.emit('navArrived', target);
                this.botClient.log(`Arrived at ${target.x.toFixed(0)}, ${target.y.toFixed(0)}, ${target.z.toFixed(0)}`, 'success');
            }
        });

        this.botClient.bot.on('path_update', (r) => {
            if (this.active && r.status === 'noPath') {
                this.botClient.log('Navigation: No path found', 'error');
                this.stop(true);
            }
        });
    }

    applyGoal() {
        const bot = this.botClient.bot;
        if (!bot.pathfinder || !this.targetPos) return;

        try {
            const defaultMove = new Movements(bot);
            bot.pathfinder.setMovements(defaultMove);
            bot.pathfinder.setGoal(new goals.GoalNear(this.targetPos.x, this.targetPos.y, this.targetPos.z, 1));
        } catch (err) {
            this.botClient.log(`Error setting navigation goal: ${err.message}`, 'error');
        }
    }

    moveTo(x, y, z) {
        const bot = this.botClient.bot;
        if (!bot.pathfinder) {
            this.botClient.log('Pathfinder plugin not ready', 'error');
            return;
        }

        if (!bot.entity) {
            this.botClient.log('Bot not spawned yet', 'error');
            return;
        }

        this.targetPos = new Vec3(x, y, z);
        this.active = true;

        this.applyGoal();

        this.botClient.updateStatus('Moving');
        this.botClient.log(`Starting navigation to ${x}, ${y}, ${z}`);

        if (this.navInterval) clearInterval(this.navInterval);

        let lastPos = bot.entity.position.clone();
        let speeds = [];

        this.navInterval = setInterval(() => {
            if (!this.botClient.bot || !this.botClient.bot.entity || !this.targetPos) {
                this.stop(true);
                return;
            }

            const pos = this.botClient.bot.entity.position;
            const dist = pos.distanceTo(this.targetPos);

            const currentSpeed = pos.distanceTo(lastPos);
            speeds.push(currentSpeed);
            if (speeds.length > 5) speeds.shift();
            const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

            let etaStr = '--:--';
            if (avgSpeed > 0.1) {
                const remainingSeconds = dist / avgSpeed;
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = Math.floor(remainingSeconds % 60);
                etaStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }

            lastPos = pos.clone();
            this.botClient.updateStatus(`Moving: ${dist.toFixed(0)}m away (ETA: ${etaStr})`);
        }, 1000);
    }

    stop(silent = false) {
        this.active = false;
        if (this.navInterval) {
            clearInterval(this.navInterval);
            this.navInterval = null;
        }

        const bot = this.botClient.bot;
        if (bot && bot.pathfinder) {
            try {
                bot.pathfinder.stop();
            } catch (err) { }
        }

        if (!silent) {
            this.botClient.updateStatus('Online');
            this.botClient.log('Navigation stopped', 'warning');
        }

        this.targetPos = null;
    }

    follow(target) {
        if (!target || !target.position) return;
        this.targetPos = target.position;
        this.active = true;
        this.applyGoal();
    }
}
