import { ExpressServer } from './src/server/ExpressServer.js';
import { SocketServer } from './src/server/SocketServer.js';
import { botManager } from './src/core/BotManager.js';
import { ConfigLoader } from './src/config/ConfigLoader.js';
import { Logger } from './src/utils/Logger.js';
import readline from 'readline';

const start = async () => {
    Logger.initGlobalLogging();

    process.on('uncaughtException', (err) => {
        // Suppress known library-level TypeErrors that shouldn't crash the whole app
        const isInventoryCrash = err.message && err.message.includes("reading 'id'") && err.stack && err.stack.includes('mineflayer-web-inventory');

        if (isInventoryCrash) {
            Logger.originalConsole.error('SUPPRESSED RECOVERABLE CRASH (Inventory):', err.message);
            Logger.log(`Recovered from Inventory Viewer crash: ${err.message}`, 'WARNING');
            return;
        }

        Logger.originalConsole.error('UNCAUGHT EXCEPTION:', err);
        Logger.log(`UNCAUGHT EXCEPTION: ${err.stack || err.message}`, 'CRITICAL');
        // We don't exit here to keep other bots running, but this is a serious error
    });

    process.on('unhandledRejection', (reason, promise) => {
        // AggregateError (ETIMEDOUT) is often handled at the bot level but can still bubble up
        const isTimeout = reason && (reason.code === 'ETIMEDOUT' || reason.name === 'AggregateError');

        if (isTimeout) {
            Logger.originalConsole.warn('UNHANDLED TIMEOUT (Network):', reason.message || reason);
            return;
        }

        Logger.originalConsole.error('UNHANDLED REJECTION:', reason);
        Logger.log(`UNHANDLED REJECTION: ${reason}`, 'CRITICAL');
    });

    let settings = await ConfigLoader.loadSettings();
    let port = 3000;

    if (!settings || !settings.port) {

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

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'ImperialsBot > '
    });

    console.log('\x1b[36mImperialsBot CLI Ready. Type "help" for commands.\x1b[0m');
    rl.prompt();

    rl.on('line', (line) => {
        const cmd = line.trim().toLowerCase();
        if (cmd === 'help') {
            console.log('\nAvailable Commands:');
            console.log('  status    - Show status of all bots');
            console.log('  headless  - Toggle Global Headless mode (Dashboard Shutdown)');
            console.log('  gui       - Bring back the Dashboard');
            console.log('  exit      - Safe shutdown and exit');
            console.log('');
        } else if (cmd === 'status') {
            const bots = botManager.getAllBots();
            console.log(`\nBots Status (${bots.length}):`);
            bots.forEach(b => {
                const color = b.status === 'Online' ? '\x1b[32m' : (b.status.includes('Error') ? '\x1b[31m' : '\x1b[33m');
                console.log(`  ${b.username}: ${color}${b.status}\x1b[0m`);
            });
            console.log('');
        } else if (cmd === 'headless') {
            botManager.setGlobalHeadless(true);
            console.log('\n\x1b[33mGLOBAL HEADLESS MODE: ACTIVE\x1b[0m');
            console.log('Dashboard data streams paused. UI is now hidden/frozen.\n');
        } else if (cmd === 'gui' || cmd === 'dashboard') {
            botManager.setGlobalHeadless(false);
            console.log('\n\x1b[32mGLOBAL HEADLESS MODE: INACTIVE\x1b[0m');
            console.log('Dashboard data streams restored.\n');
        } else if (cmd === 'exit') {
            console.log('Closing bots and exiting...');
            botManager.shutdown();
            setTimeout(() => process.exit(0), 1500);
        }
        rl.prompt();
    });
};

start();
