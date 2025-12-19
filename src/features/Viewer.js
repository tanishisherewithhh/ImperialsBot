import { BaseFeature } from './BaseFeature.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { mineflayer: viewer } = require('prismarine-viewer');

import net from 'net';

export class Viewer extends BaseFeature {
    init() {
        this.botClient.bot.once('spawn', () => {
            // Delay Start: Helps prevent connection spam/lag on join which can cause kicks
            setTimeout(() => {
                if (this.botClient.bot && this.botClient.bot.entity) {
                    this.startViewer();
                }
            }, 3000);
        });
    }

    async startViewer() {
        if (!this.botClient.config.viewerPort) {
            // Assign a random port if not set
            this.botClient.config.viewerPort = 3000 + Math.floor(Math.random() * 5000);
        }

        try {
            const port = await this.findFreePort(this.botClient.config.viewerPort);

            // Close existing if we can (though prismarine-viewer is tricky)

            viewer(this.botClient.bot, {
                port: port,
                firstPerson: !!this.botClient.config.firstPerson
            });

            this.botClient.config.viewerPort = port; // Update config with actual port
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

    findFreePort(startPort) {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.unref();
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    // Port in use, try next
                    resolve(this.findFreePort(startPort + 1));
                } else {
                    reject(err);
                }
            });
            server.listen(startPort, () => {
                server.close(() => {
                    resolve(startPort);
                });
            });
        });
    }
}
