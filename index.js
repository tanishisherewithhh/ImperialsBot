import { ExpressServer } from './src/server/ExpressServer.js';
import { SocketServer } from './src/server/SocketServer.js';
import { botManager } from './src/core/BotManager.js';
import { ConfigLoader } from './src/config/ConfigLoader.js';
import { Logger } from './src/utils/Logger.js';
import { AuditLogger } from './src/utils/AuditLogger.js';
import { UpdateChecker } from './src/utils/UpdateChecker.js';
import { setViewerBasePort } from './src/features/Viewer.js';
import readline from 'readline';

const start = async () => {
    Logger.initGlobalLogging();
    await UpdateChecker.check();

    process.on('uncaughtException', (err) => {
        // Suppress known library-level TypeErrors that shouldn't crash the whole app
        const isInventoryCrash = err.message && err.message.includes("reading 'id'") && err.stack && err.stack.includes('mineflayer-web-inventory');

        if (isInventoryCrash) {
            Logger.originalConsole.error('SUPPRESSED RECOVERABLE CRASH (Inventory):', err.message);
            Logger.log(`Recovered from Inventory Viewer crash: ${err.message}`, 'WARNING');
            return;
        }

        Logger.originalConsole.error('UNCAUGHT EXCEPTION:', err);
        Logger.log(`UNCAUGHT EXCEPTION: ${err.stack || err.message}`, 'CRITICAL');    });

    process.on('unhandledRejection', (reason, promise) => {
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

    setViewerBasePort(port);

    botManager.loadSavedBots();
    server.start();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'ImperialsBot > '
    });

    console.log('\x1b[36mImperialsBot CLI Ready. Type "help" for commands.\x1b[0m');
    rl.prompt();

    AuditLogger.init();

    rl.on('line', async (line) => {
        const trimmed = line.trim();
        if (!trimmed) {
            rl.prompt();
            return;
        }

        AuditLogger.log('CLI', 'admin', `Command executed: ${trimmed}`);

        const parts = trimmed.split(/\s+/);
        const cmd = parts[0]?.toLowerCase();
        const args = parts.slice(1);

        if (cmd === 'help') {
            console.log('\nAvailable Commands:');
            console.log('  status             - Show status of all bots');
            console.log('  list               - Detailed bot list');
            console.log('  chat <bot> <msg>   - Send message from bot');
            console.log('  chatall <msg>      - Send message from all bots');
            console.log('  stop <bot>         - Disconnect a bot');
            console.log('  start <bot>        - Start a disconnected bot');
            console.log('  reconnect <bot>    - Reconnect a bot');
            console.log('  spammer <bot>      - Toggle spammer for bot');
            console.log('  autoauth <bot>     - Toggle auto-auth for bot');
            console.log('  antiafk <bot>      - Toggle antiafk for bot');
            console.log('  headless           - Enable Global Headless');
            console.log('  gui                - Disable Global Headless');
            console.log('  clear              - Clear terminal');
            console.log('  exit               - Shutdown and exit\n');
        } else if (cmd === 'status') {
            const bots = botManager.getAllBots();
            console.log(`\nBots Status (${bots.length}):`);
            bots.forEach(b => {
                const color = b.status === 'Online' ? '\x1b[32m' : (b.status.includes('Error') ? '\x1b[31m' : '\x1b[33m');
                console.log(`  ${b.username}: ${color}${b.status}\x1b[0m`);
            });
            console.log('');
        } else if (cmd === 'list') {
            const bots = botManager.getAllBots();
            console.log('\n' + ''.padEnd(60, '-'));
            console.log(`${'Username'.padEnd(20)} | ${'Status'.padEnd(15)} | ${'Server'.padEnd(20)}`);
            console.log(''.padEnd(60, '-'));
            bots.forEach(b => {
                console.log(`${b.username.padEnd(20)} | ${b.status.padEnd(15)} | ${`${b.host}:${b.port}`.padEnd(20)}`);
            });
            console.log(''.padEnd(60, '-') + '\n');
        } else if (cmd === 'chat' && args.length >= 2) {
            const bot = botManager.getBot(args[0]);
            if (bot && bot.bot) {
                bot.bot.chat(args.slice(1).join(' '));
                console.log(`[${args[0]}] Sent: ${args.slice(1).join(' ')}`);
            } else {
                console.log(`Bot "${args[0]}" not found or not connected.`);
            }
        } else if (cmd === 'chatall' && args.length >= 1) {
            const msg = args.join(' ');
            const bots = Array.from(botManager.bots.values());
            bots.forEach(b => {
                if (b.bot) b.bot.chat(msg);
            });
            console.log(`Sent to ${bots.length} bots: ${msg}`);
        } else if (cmd === 'stop' && args[0]) {
            botManager.stopBot(args[0]);
            console.log(`Stopping ${args[0]}...`);
        } else if (cmd === 'start' && args[0]) {
            const bot = botManager.getBot(args[0]);
            if (bot) {
                bot.init();
                console.log(`Starting ${args[0]}...`);
            } else {
                console.log(`Bot "${args[0]}" not found.`);
            }
        } else if (cmd === 'reconnect' && args[0]) {
            const bot = botManager.getBot(args[0]);
            if (bot) {
                bot.rejoin();
            } else {
                console.log(`Bot "${args[0]}" not found.`);
            }
        } else if (cmd === 'spammer' && args[0]) {
            const bot = botManager.getBot(args[0]);
            if (bot) {
                const spammer = bot.featureManager.getFeature('spammer');
                if (spammer) {
                    spammer.toggle();
                    console.log(`Spammer for ${args[0]} is now ${spammer.enabled ? 'ENABLED' : 'DISABLED'}`);
                }
            } else {
                console.log(`Bot "${args[0]}" not found.`);
            }
        } else if (cmd === 'autoauth' && args[0]) {
            const bot = botManager.getBot(args[0]);
            if (bot) {
                const auth = bot.featureManager.getFeature('autoauth');
                if (auth) {
                    auth.enabled = !auth.enabled;
                    bot.savePluginStates();
                    console.log(`AutoAuth for ${args[0]} is now ${auth.enabled ? 'ENABLED' : 'DISABLED'}`);
                }
            }
        } else if (cmd === 'antiafk' && args[0]) {
            const bot = botManager.getBot(args[0]);
            if (bot) {
                const afk = bot.featureManager.getFeature('antiafk');
                if (afk) {
                    afk.enabled = !afk.enabled;
                    bot.savePluginStates();
                    console.log(`AntiAFK for ${args[0]} is now ${afk.enabled ? 'ENABLED' : 'DISABLED'}`);
                }
            }
        } else if (cmd === 'headless') {
            botManager.setGlobalHeadless(true);
            console.log('\n\x1b[33mGLOBAL HEADLESS MODE: ACTIVE\x1b[0m\n');
        } else if (cmd === 'gui') {
            botManager.setGlobalHeadless(false);
            console.log('\n\x1b[32mGLOBAL HEADLESS MODE: INACTIVE\x1b[0m\n');
        } else if (cmd === 'clear') {
            console.clear();
        } else if (cmd === 'exit') {
            console.log('Shutting down...');
            botManager.shutdown();
            setTimeout(() => process.exit(0), 1000);
        }
        rl.prompt();
    });
};

start();
