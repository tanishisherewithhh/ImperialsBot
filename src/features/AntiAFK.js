import { BaseFeature } from './BaseFeature.js';

export class AntiAFK extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.enabled = false;
        this.interval = null;
    }

    init() {
    }

    start() {
        if (this.enabled) return;
        this.enabled = true;
        this.botClient.log('AntiAFK started', 'success');
        this.startAFK();
    }

    stop() {
        this.disable();
        this.botClient.log('AntiAFK stopped', 'warning');
    }

    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.startAFK();
    }

    disable() {
        this.enabled = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    startAFK() {
        this.interval = setInterval(() => {
            if (!this.botClient.bot || !this.botClient.bot.entity) return;

            const action = Math.random();
            if (action < 0.25) {
                if (typeof this.botClient.bot.setControlState === 'function') {
                    this.botClient.bot.setControlState('jump', true);
                    setTimeout(() => {
                        if (this.botClient.bot && typeof this.botClient.bot.setControlState === 'function') {
                            this.botClient.bot.setControlState('jump', false);
                        }
                    }, 500);
                }
            } else if (action < 0.5) {
                const yaw = this.botClient.bot.entity.yaw + (Math.random() - 0.5);
                const pitch = this.botClient.bot.entity.pitch + (Math.random() - 0.5) * 0.5;
                this.botClient.bot.look(yaw, pitch, true);
            } else {
                if (typeof this.botClient.bot.swingArm === 'function') {
                    this.botClient.bot.swingArm();
                }
            }
        }, 5000);
    }
}
