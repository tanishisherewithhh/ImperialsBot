import { ExpressServer } from './src/server/ExpressServer.js';
import { SocketServer } from './src/server/SocketServer.js';
import { botManager } from './src/core/BotManager.js';
import { ConfigLoader } from './src/config/ConfigLoader.js';
import { Logger } from './src/utils/Logger.js';
import readline from 'readline';

const start = async () => {
    Logger.initGlobalLogging();

    process.on('uncaughtException', (err) => {
        Logger.originalConsole.error('UNCAUGHT EXCEPTION:', err);
        Logger.log(`UNCAUGHT EXCEPTION: ${err.stack || err.message}`, 'CRITICAL');
        // Removed process.exit(1) to keep the application and other bots alive
    });

    process.on('unhandledRejection', (reason, promise) => {
        Logger.originalConsole.error('UNHANDLED REJECTION:', reason);
        Logger.log(`UNHANDLED REJECTION: ${reason}`, 'CRITICAL');
    });

    let settings = await ConfigLoader.loadSettings();
    let port = 3000;

    if (!settings || !settings.port) {
        // Prompt user only if port is missing
        if (!settings) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise(resolve => {
                rl.question('Enter server port (default 3000): ', resolve);
            });

            rl.close();

            if (answer && answer.trim()) {
                const parsed = parseInt(answer.trim());
                if (!isNaN(parsed)) {
                    port = parsed;
                }
            }
            await ConfigLoader.saveSettings({ port });
            console.log(`Port ${port} saved to settings.json.`);
        } else {
            // Settings exist but port might be missing? defaulting to 3000 if so
            await ConfigLoader.saveSettings({ port });
        }

    } else {
        port = settings.port;
        console.log(`Using configured port: ${port}`);
    }

    const server = new ExpressServer(port);
    const socketServer = new SocketServer(server.httpServer);

    botManager.loadSavedBots();
    server.start();
};

start();
