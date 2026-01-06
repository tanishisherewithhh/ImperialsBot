import { BaseFeature } from './BaseFeature.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { pathfinder, goals } = require('mineflayer-pathfinder');
const { plugin: movement, Heuristics } = require('mineflayer-movement');
import { ConfigLoader } from '../config/ConfigLoader.js';

export class Navigation extends BaseFeature {
    async init() {
        this.botClient.bot.loadPlugin(pathfinder);
        this.botClient.bot.loadPlugin(movement);

        const settings = await ConfigLoader.loadSettings() || {};
        this.currentProfile = settings.navigationProfile || 'Shortest';

        // Wait for bot to be ready to setup movements
        if (this.botClient.bot.movement) {
            this.setupHeuristics();
        } else {
            this.botClient.bot.once('spawn', () => this.setupHeuristics());
        }
    }

    setupHeuristics() {
        if (!this.botClient.bot.movement) return;

        const { Distance, Danger, Proximity, Conformity } = Heuristics;

        let profile;
        switch (this.currentProfile) {
            case 'Safest':
                profile = {
                    danger: 1.0,
                    distance: 0.8,
                    proximity: 0.4,
                    conformity: 0.2
                };
                break;
            case 'Easiest':
                profile = {
                    danger: 0.4,
                    distance: 0.2,
                    proximity: 0.8,
                    conformity: 0.6
                };
                break;
            case 'Shortest':
            default:
                profile = {
                    danger: 0.3,
                    distance: 0.5,
                    proximity: 1.0,
                    conformity: 0.6
                };
                break;
        }

        const heuristics = [
            new Distance({ weight: profile.distance }),
            new Danger({ weight: profile.danger }),
            new Proximity({ weight: profile.proximity }),
            new Conformity({ weight: profile.conformity })
        ];

        this.botClient.bot.movement.setHeuristics(heuristics);
        this.botClient.log(`Navigation heuristics applied for profile: ${this.currentProfile}`, 'info');
    }

    setProfile(profileName) {
        this.currentProfile = profileName;
        this.setupHeuristics();
        this.botClient.log(`Navigation profile switched to: ${profileName}`, 'info');
    }

    moveTo(x, y, z) {
        if (!this.botClient.bot.movement) {
            this.botClient.log('Movement plugin not ready', 'error');
            return;
        }

        const goal = new goals.GoalBlock(x, y, z);
        this.botClient.bot.movement.setGoal(goal);

        this.botClient.updateStatus(`Moving to ${x},${y},${z}`);
        this.botClient.log(`Starting navigation to ${x}, ${y}, ${z} (${this.currentProfile})`);

        if (this.navInterval) clearInterval(this.navInterval);

        let startTime = Date.now();
        let lastPos = this.botClient.bot.entity.position.clone();
        let speeds = [];

        this.navInterval = setInterval(() => {
            if (!this.botClient.bot || !this.botClient.bot.entity) {
                this.stop();
                return;
            }
            const pos = this.botClient.bot.entity.position;
            const targetPos = new (require('vec3'))(x, y, z);
            const dist = pos.distanceTo(targetPos);

            // Calculate speed for ETA
            const currentSpeed = pos.distanceTo(lastPos); // distance moved since last second
            speeds.push(currentSpeed);
            if (speeds.length > 5) speeds.shift(); // 5-second rolling average

            const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
            let etaStr = '--:--';

            if (avgSpeed > 0.1) {
                const remainingSeconds = dist / avgSpeed;
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = Math.floor(remainingSeconds % 60);
                etaStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }

            lastPos = pos.clone();

            this.botClient.updateStatus(`Moving: ${dist.toFixed(0)} blocks away | ETA: ${etaStr}`);

            if (dist < 1.5) {
                this.stop();
                this.botClient.updateStatus('Arrived');
                this.botClient.log(`Arrived at ${x}, ${y}, ${z}`, 'success');
            }
        }, 1000);
    }

    stop() {
        if (this.navInterval) clearInterval(this.navInterval);

        if (this.botClient.bot.movement) {
            this.botClient.bot.movement.setGoal(null);
            this.botClient.updateStatus('Navigation Stopped');
            this.botClient.log('Navigation stopped', 'warning');
        }
    }

    follow(target) {
        if (!this.botClient.bot.movement) return;
        const goal = new goals.GoalFollow(target, 2);
        this.botClient.bot.movement.setGoal(goal);
    }
}
