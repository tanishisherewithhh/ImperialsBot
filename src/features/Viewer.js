import { BaseFeature } from './BaseFeature.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { mineflayer: viewer } = require('prismarine-viewer');

import { NetworkUtils } from '../utils/NetworkUtils.js';
import { setBasePort, getBasePort } from '../utils/ConfigBase.js';
import { ConfigLoader } from '../config/ConfigLoader.js';

export function setViewerBasePort(port) {
    setBasePort(port);
}

export class Viewer extends BaseFeature {
    init() {
        this.botClient.bot.on('spawn', () => {
            this.startViewer();
        });
    }

    async startViewer() {
        if (this.viewerInstance) {
            try {
                this.viewerInstance.close();
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) { }
            this.viewerInstance = null;
        }

        let basePort;
        if (ConfigLoader.isCloud) {
            const usernameHash = Array.from(this.botClient.username || '').reduce((a, c) => a + c.charCodeAt(0), 0);
            basePort = getBasePort() + 100 + (usernameHash % 50);
        } else {
            basePort = this.botClient.config.viewerPort || (4000 + Math.floor(Math.random() * 1000));
        }

        try {
            const port = await NetworkUtils.findFreePort(basePort);

            this.viewerInstance = viewer(this.botClient.bot, {
                port: port,
                host: '127.0.0.1',
                firstPerson: !!this.botClient.config.firstPerson
            });

            this.botClient.config.viewerPort = port;
            this.botClient.log(`Viewer started on port ${port} (${this.botClient.config.firstPerson ? '1st' : '3rd'} Person)`, 'success');
            this.botClient.emit('viewerStarted', { port: port });

        } catch (err) {
            this.botClient.log(`Viewer error: ${err.message}`, 'error');
        }
    }

    toggleView() {
        this.botClient.config.firstPerson = !this.botClient.config.firstPerson;
        this.startViewer();
    }

    async dispose() {
        if (this.viewerInstance) {
            try {
                this.viewerInstance.close();
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) { }
            this.viewerInstance = null;
        }
    }


}
