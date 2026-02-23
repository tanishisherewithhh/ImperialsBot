import { BaseFeature } from './BaseFeature.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { mineflayer: viewer } = require('prismarine-viewer');

import net from 'net';
import { NetworkUtils } from '../utils/NetworkUtils.js';

export class Viewer extends BaseFeature {
    init() {
        this.botClient.bot.once('spawn', () => {

            setTimeout(() => {
                if (this.botClient.bot && this.botClient.bot.entity) {
                    this.startViewer();
                }
            }, 3000);
        });
    }

    async startViewer() {
        if (!this.botClient.config.viewerPort) {

            this.botClient.config.viewerPort = 3000 + Math.floor(Math.random() * 5000);
        }

        try {
            const port = await NetworkUtils.findFreePort(this.botClient.config.viewerPort);



            viewer(this.botClient.bot, {
                port: port,
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


}
