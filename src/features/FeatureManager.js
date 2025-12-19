import { Navigation } from './Navigation.js';
import { Combat } from './Combat.js';
import { Chat } from './Chat.js';
import { Viewer } from './Viewer.js';
import { AutoEat } from './AutoEat.js';
import { AntiAFK } from './AntiAFK.js';
import { DataTracker } from './DataTracker.js';
import { AutoAuth } from './AutoAuth.js';
import { Spammer } from './Spammer.js';
import { Discord } from './Discord.js';
import { Security } from './Security.js';

export class FeatureManager {
    constructor(botClient) {
        this.botClient = botClient;
        this.features = new Map();
    }

    registerFeature(name, FeatureClass) {
        try {
            if (this.features.has(name)) {
                const oldFeature = this.features.get(name);
                if (typeof oldFeature.dispose === 'function') {
                    oldFeature.dispose();
                }
            }

            const feature = new FeatureClass(this.botClient);
            this.features.set(name, feature);
            feature.init();
        } catch (err) {
            console.error(`Failed to register feature ${name}:`, err);
        }
    }

    loadFeatures() {
        this.registerFeature('navigation', Navigation);
        this.registerFeature('combat', Combat);
        this.registerFeature('chat', Chat);
        this.registerFeature('viewer', Viewer);
        this.registerFeature('autoeat', AutoEat);
        this.registerFeature('antiafk', AntiAFK);
        this.registerFeature('datatracker', DataTracker);
        this.registerFeature('autoauth', AutoAuth);
        this.registerFeature('spammer', Spammer);
        this.registerFeature('discord', Discord);
        this.registerFeature('security', Security);
    }

    getFeature(name) {
        return this.features.get(name);
    }
}
