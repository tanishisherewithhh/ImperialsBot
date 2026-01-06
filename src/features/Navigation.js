import { BaseFeature } from './BaseFeature.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { pathfinder } = require('mineflayer-pathfinder');
const { plugin: movement } = require('mineflayer-movement');
const Vec3 = require('vec3');
import { ConfigLoader } from '../config/ConfigLoader.js';

export class Navigation extends BaseFeature {
    async init() {
        this.botClient.bot.loadPlugin(pathfinder);
        this.botClient.bot.loadPlugin(movement);

        const settings = await ConfigLoader.loadSettings() || {};
        this.currentProfile = settings.navigationProfile || 'Shortest';

        this.active = false;
        this.targetPos = null;
        this.navInterval = null;

        // Steering loop
        this.botClient.bot.on('physicsTick', () => this.onTick());
    }

    getProfileWeights() {
        switch (this.currentProfile) {
            case 'Safest':
                return { danger: 1.0, distance: 0.8, proximity: 0.4, conformity: 0.2 };
            case 'Easiest':
                return { danger: 0.4, distance: 0.2, proximity: 0.8, conformity: 0.6 };
            case 'Shortest':
            default:
                return { danger: 0.3, distance: 0.5, proximity: 1.0, conformity: 0.6 };
        }
    }

    setProfile(profileName) {
        this.currentProfile = profileName;
        if (this.active) {
            // Re-apply goal with new heuristics if active
            this.applyGoal();
        }
        this.botClient.log(`Navigation profile switched to: ${profileName}`, 'info');
    }

    applyGoal() {
        const bot = this.botClient.bot;
        if (!bot.movement || !this.targetPos) return;

        const weights = this.getProfileWeights();

        try {
            // Create heuristics as per documentation
            const distance = bot.movement.heuristic.new('distance')
                .weight(weights.distance)
                .radius(4)
                .height(2)
                .count(8);

            const danger = bot.movement.heuristic.new('danger')
                .weight(weights.danger)
                .radius(2)
                .depth(3);

            const proximity = bot.movement.heuristic.new('proximity')
                .weight(weights.proximity)
                .target(this.targetPos);

            const conformity = bot.movement.heuristic.new('conformity')
                .weight(weights.conformity);

            // Create and set Goal
            const goal = new bot.movement.Goal({
                distance,
                danger,
                proximity,
                conformity
            });

            bot.movement.setGoal(goal);
        } catch (err) {
            this.botClient.log(`Error setting navigation goal: ${err.message}`, 'error');
        }
    }

    onTick() {
        const bot = this.botClient.bot;
        if (!bot.entity || !bot.movement || !this.active || !this.targetPos) return;

        try {
            // Steering
            const yaw = bot.movement.getYaw();
            if (yaw !== null && !isNaN(yaw)) {
                bot.movement.steer(yaw);
                bot.setControlState('forward', true);
                bot.setControlState('jump', bot.entity.isCollidedHorizontally);
                bot.setControlState('sprint', this.currentProfile === 'Shortest');
            }
        } catch (err) {
            // Silent catch for ticking errors
        }
    }

    moveTo(x, y, z) {
        const bot = this.botClient.bot;
        if (!bot.movement) {
            this.botClient.log('Movement plugin not ready', 'error');
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
        this.botClient.log(`Starting navigation to ${x}, ${y}, ${z} (${this.currentProfile})`);

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

            // Speed calculation
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

            if (dist < 1.8) {
                const target = this.targetPos;
                this.stop(true);
                this.botClient.updateStatus('Arrived');
                this.botClient.log(`Arrived at ${target.x.toFixed(0)}, ${target.y.toFixed(0)}, ${target.z.toFixed(0)}`, 'success');
            }
        }, 1000);
    }

    stop(silent = false) {
        this.active = false;
        if (this.navInterval) {
            clearInterval(this.navInterval);
            this.navInterval = null;
        }

        const bot = this.botClient.bot;
        if (bot) {
            bot.clearControlStates();
            if (bot.movement) bot.movement.setGoal(null);
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
