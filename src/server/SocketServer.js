import { Server } from 'socket.io';
import { botManager } from '../core/BotManager.js';
import { ConfigLoader } from '../config/ConfigLoader.js';
import { AuditLogger } from '../utils/AuditLogger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGINS_DIR = path.join(__dirname, '../plugins');

export class SocketServer {
    constructor(httpServer) {
        this.io = new Server(httpServer);
        this.activeProxyChecks = new Map(); // Tracks AbortControllers by socket.id
        this.bindGlobalEvents();
        this.bindEvents();
        AuditLogger.init();
    }

    bindGlobalEvents() {
        botManager.on('botLog', (data) => {
            this.io.to(`bot:${data.username}`).emit('logs', data);
        });

        botManager.on('botData', (data) => {
            if (!botManager.isGlobalHeadless) {
                this.io.to(`bot:${data.username}`).emit('botData', data);
            }
        });

        botManager.on('botInventory', (data) => {
            this.io.to(`bot:${data.username}`).emit('botInventory', data);
        });

        botManager.on('botPlayers', (data) => {
            if (!botManager.isGlobalHeadless) {
                this.io.to(`bot:${data.username}`).emit('botPlayers', data);
            }
        });

        botManager.on('botChat', (data) => {
            if (!botManager.isGlobalHeadless) {
                this.io.to(`bot:${data.username}`).emit('botChat', data);
            }
        });

        botManager.on('botStatus', (data) => {
            // Status is global for the sidebar/bot list
            this.io.emit('botStatus', data);
        });

        botManager.on('botSpawn', (username) => {
            // Global update for bot list
            this.io.emit('botList', botManager.getAllBots());
        });

        botManager.on('botViewer', (data) => {
            if (!botManager.isGlobalHeadless) {
                this.io.to(`bot:${data.username}`).emit('botViewer', data);
            }
        });

        botManager.on('analyticsUpdate', (data) => {
            if (!botManager.isGlobalHeadless) {
                this.io.to(`bot:${data.username}`).emit('analyticsUpdate', data);
            }
        });

        botManager.on('pluginsUpdated', (data) => {
            this.io.to(`bot:${data.username}`).emit('pluginList', data);
        });

        botManager.on('botRemoved', (username) => {
            this.io.emit('botRemoved', username);
            this.io.emit('botList', botManager.getAllBots());
        });

        botManager.on('botEnd', (username) => {
            this.io.emit('botList', botManager.getAllBots());
        });

        botManager.on('watchlistAlert', (data) => {
            this.io.to(`bot:${data.username}`).emit('watchlistAlert', data);
        });

        botManager.on('packetDebug', (data) => {
            if (!botManager.isGlobalHeadless) {
                this.io.to(`bot:${data.username}`).emit('packetDebug', data);
            }
        });

        botManager.on('globalHeadlessChanged', (isHeadless) => {
            this.io.emit('globalHeadlessChanged', isHeadless);
        });
    }

    bindEvents() {
        this.io.on('connection', async (socket) => {
            console.log('Client connected');
            const settings = await ConfigLoader.loadSettings() || {};
            socket.emit('settings', settings);
            socket.emit('globalHeadlessChanged', botManager.isGlobalHeadless);
            socket.emit('botList', botManager.getAllBots());

            socket.on('disconnect', () => {
                const controller = this.activeProxyChecks.get(socket.id);
                if (controller) {
                    controller.abort();
                    this.activeProxyChecks.delete(socket.id);
                }
                console.log('Client disconnected');
            });

            socket.on('setGlobalHeadless', (enabled) => {
                botManager.setGlobalHeadless(enabled);
            });

            socket.on('saveSettings', async (newSettings) => {
                AuditLogger.log('Dashboard', socket.id, 'Saved Global Settings');
                try {
                    await ConfigLoader.saveSettings(newSettings);
                    const updatedSettings = await ConfigLoader.loadSettings();
                    this.io.emit('settings', updatedSettings);

                    if (newSettings.navigationProfile) {
                        botManager.updateAllNavigationProfiles(newSettings.navigationProfile);
                    }
                    if (newSettings.globalFriends) {
                        botManager.updateAllFriends(newSettings.globalFriends);
                    }
                    if (newSettings.hasOwnProperty('globalAnalytics')) {
                        botManager.updateAllAnalytics(newSettings.globalAnalytics);
                    }
                } catch (err) {
                    console.error('Failed to save settings:', err);
                }
            });

            socket.on('selectBot', (username) => {
                // Leave all bot rooms first
                for (const room of socket.rooms) {
                    if (room.startsWith('bot:')) {
                        socket.leave(room);
                    }
                }
                // Join new bot room if username provided
                if (username) {
                    socket.join(`bot:${username}`);
                    console.log(`Client ${socket.id} joined room bot:${username}`);
                }
            });

            socket.on('shutdownServer', () => {
                console.log('Safe Shutdown initiated...');
                try {
                    botManager.shutdown();
                } catch (err) {
                    console.error('Error during shutdown:', err);
                }

                // Allow a moment for bots to disconnect before exiting
                setTimeout(() => {
                    console.log('Server process exiting.');
                    process.exit(0);
                }, 1000);
            });

            socket.on('createBot', async (config) => {
                AuditLogger.log('Dashboard', socket.id, `Created bot: ${config.username}`);
                try {
                    await botManager.createBot(config, true, false);
                    socket.emit('notification', { type: 'success', message: `Bot ${config.username} created` });
                    this.io.emit('botList', botManager.getAllBots());
                } catch (err) {
                    socket.emit('notification', { type: 'error', message: err.message });
                }
            });

            socket.on('editBot', async (config) => {
                try {
                    await botManager.updateBot(config);
                    socket.emit('notification', { type: 'success', message: `Bot ${config.username} updated` });
                    this.io.emit('botList', botManager.getAllBots());
                } catch (err) {
                    socket.emit('notification', { type: 'error', message: err.message });
                }
            });

            socket.on('bulkCreateBots', async (configs) => {
                let created = 0;
                let errors = 0;
                for (const config of configs) {
                    try {
                        await botManager.createBot(config, true, false);
                        created++;
                    } catch (err) {
                        console.error(`Bulk creation error for ${config.username}:`, err);
                        errors++;
                    }
                }
                socket.emit('notification', {
                    type: errors > 0 ? 'warning' : 'success',
                    message: `Bulk creation finished: ${created} created, ${errors} failed.`
                });
                this.io.emit('botList', botManager.getAllBots());
            });

            socket.on('bulkDelete', async (usernames) => {
                AuditLogger.log('Dashboard', socket.id, `Bulk Delete on ${usernames?.length || 0} bots`);
                if (!Array.isArray(usernames)) return;
                let deletedCount = 0;
                for (const username of usernames) {
                    try {
                        await botManager.removeBot(username);
                        deletedCount++;
                    } catch (err) {
                        console.error(`Failed to bulk delete ${username}:`, err);
                    }
                }
                socket.emit('notification', {
                    type: 'success',
                    message: `Successfully deleted ${deletedCount} bots.`
                });
                this.io.emit('botList', botManager.getAllBots());
            });

            socket.on('updateWatchlist', (list) => {
                botManager.updateAllWatchlists(list);
                this.io.emit('watchlistUpdate', list);
            });

            socket.on('bulkSequentialChat', async (data) => {
                const { usernames, message } = data;
                if (!usernames || !Array.isArray(usernames) || !message) return;

                const words = message.split(' ').filter(w => w.length > 0);
                if (words.length === 0) return;

                for (let i = 0; i < words.length; i++) {
                    const botIndex = i % usernames.length;
                    const botUsername = usernames[botIndex];
                    const bot = botManager.getBot(botUsername);
                    const word = words[i];

                    if (bot) {
                        bot.chat(word);
                    }

                    // Stagger: wait 800ms between messages to bypass some spam filters and look coordinated
                    if (i < words.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
                }
            });

            socket.on('getAvailablePlugins', async () => {
                try {
                    const files = await fs.readdir(PLUGINS_DIR);
                    const plugins = [];
                    for (const file of files) {
                        if (!file.endsWith('.js')) continue;
                        try {
                            const filePath = path.join(PLUGINS_DIR, file);
                            const fileUrl = pathToFileURL(filePath).href + '?t=' + Date.now();
                            const module = await import(fileUrl);
                            const PluginClass = module.default || module.Plugin;
                            if (!PluginClass) {
                                console.warn(`Plugin ${file} has no export (neither default nor Plugin)`);
                                continue;
                            }
                            const p = new PluginClass();
                            plugins.push({
                                name: p.name || file.replace('.js', ''),
                                description: p.description || ''
                            });
                        } catch (e) {
                            console.error(`Failed to parse plugin ${file} for list:`, e);
                        }
                    }
                    socket.emit('availablePlugins', plugins);
                } catch (err) {
                    console.error('Failed to get available plugins:', err);
                }
            });
            socket.on('requestAnalyticsHistory', (payload) => {
                const bot = botManager.getBot(payload.username);
                if (bot) {
                    const analyticsFeature = bot.featureManager.getFeature('analytics');
                    if (analyticsFeature) {
                        socket.emit('analyticsHistory', {
                            username: bot.username,
                            history: analyticsFeature.getStats()
                        });
                    }
                }
            });

            socket.on('requestBotData', (data) => {
                const { username } = data;
                const bot = botManager.getBot(username);
                if (!bot) return;

                socket.emit('chatHistory', { username: bot.username, history: bot.chatHistory || [] });
                this.broadcastToggles(username);

                if (bot.pluginManager) {
                    socket.emit('pluginList', { username: bot.username, plugins: bot.pluginManager.getAllPlugins() });
                }

                if (bot.config.spammer) {
                    socket.emit('spammerConfig', { username, config: bot.config.spammer });
                }

                if (bot.bot && bot.bot.entity) {
                    socket.emit('botData', {
                        username,
                        data: {
                            position: bot.bot.entity.position,
                            health: bot.bot.health,
                            food: bot.bot.food,
                            yaw: bot.bot.entity.yaw,
                            pitch: bot.bot.entity.pitch
                        }
                    });

                    const players = Object.values(bot.bot.players).map(p => ({
                        username: p.username,
                        uuid: p.uuid,
                        ping: p.ping
                    }));
                    socket.emit('botPlayers', { username, players });

                    const inventory = bot.bot.inventory.items().map(item => ({
                        slot: item.slot,
                        name: item.name,
                        displayName: item.displayName,
                        count: item.count
                    }));
                    socket.emit('botInventory', { username, items: inventory });

                    socket.emit('botStatus', { username, status: bot.status, inventoryPort: bot.inventoryPort });

                    if (bot.viewerPort) {
                        socket.emit('botViewer', {
                            username,
                            port: bot.viewerPort,
                            firstPerson: !!bot.config.firstPerson
                        });
                    }
                }
            });

            socket.on('botAction', async (data) => {
                const { username, action, payload } = data;
                AuditLogger.log('Dashboard', socket.id, `Bot Action ${action} ${username ? `on bot ${username}` : '(Global)'}`);

                // Global Actions (No bot required)
                if (action === 'checkProxies') {
                    console.log(`[SocketServer] Starting proxy check for socket ${socket.id}. Count: ${payload?.proxies?.length}`);
                    try {
                        const controller = new AbortController();
                        this.activeProxyChecks.set(socket.id, controller);

                        const { ProxyChecker } = await import('../utils/ProxyChecker.js');
                        const results = await ProxyChecker.checkList(payload.proxies, (progress) => {
                            socket.emit('proxyCheckProgress', progress);
                        }, controller.signal);

                        this.activeProxyChecks.delete(socket.id);
                        socket.emit('proxyCheckResults', results);
                    } catch (err) {
                        console.error(`[SocketServer] Proxy check error:`, err.message);
                        this.activeProxyChecks.delete(socket.id);
                        socket.emit('notification', { type: 'error', message: `Proxy check failed: ${err.message}` });
                    }
                    return;
                }

                if (action === 'stopCheckProxies') {
                    const controller = this.activeProxyChecks.get(socket.id);
                    if (controller) {
                        controller.abort();
                        this.activeProxyChecks.delete(socket.id);
                        socket.emit('notification', { type: 'info', message: 'Proxy check stopped.' });
                    }
                    return;
                }

                if (action === 'scrapeProxies') {
                    try {
                        const { ProxyChecker } = await import('../utils/ProxyChecker.js');
                        const proxies = await ProxyChecker.scrapeAll((progress) => {
                            socket.emit('proxyScrapeProgress', progress);
                        });
                        socket.emit('proxyScrapeResults', proxies);
                    } catch (err) {
                        socket.emit('notification', { type: 'error', message: `Proxy scraping failed: ${err.message}` });
                    }
                    return;
                }

                // Bot-Specific Actions
                const bot = botManager.getBot(username);
                if (!bot) return;

                switch (action) {
                    case 'chat':
                        bot.featureManager.getFeature('chat').send(payload.message);
                        break;
                    case 'move':
                        const navigation = bot.featureManager.getFeature('navigation');
                        if (navigation) {
                            navigation.moveTo(payload.x, payload.y, payload.z);
                        } else {
                            socket.emit('notification', { type: 'error', message: 'Navigation feature not available' });
                        }
                        break;
                    case 'toggleKillaura':
                        const combat = bot.featureManager.getFeature('combat');
                        if (combat) {
                            combat.toggleKillaura(payload.enabled);
                            this.broadcastToggles(username);
                        }
                        break;
                    case 'updateKillauraConfig':
                        const combatForConfig = bot.featureManager.getFeature('combat');
                        if (combatForConfig) {
                            combatForConfig.updateConfig(payload.config);
                            this.io.emit('killauraConfig', {
                                username: bot.username,
                                config: combatForConfig.getConfig()
                            });
                        }
                        break;
                    case 'toggleSpammer':
                        const spammer = bot.featureManager.getFeature('spammer');
                        if (spammer) {
                            if (payload.enabled) {
                                spammer.setConfig(payload.config);
                                spammer.start();
                            } else {
                                spammer.stop();
                            }

                            if (payload.config) {
                                if (!bot.config.spammer) bot.config.spammer = {};
                                bot.config.spammer = { ...bot.config.spammer, ...payload.config };
                                try {
                                    await botManager.updateBot(bot.config);
                                } catch (err) {
                                    console.error('Failed to save spammer config:', err);
                                }
                            }

                            this.broadcastToggles(username);
                        }
                        break;
                    case 'toggleAntiAFK':
                        const antiafk = bot.featureManager.getFeature('antiafk');
                        if (antiafk) {
                            if (payload.enabled) antiafk.enable();
                            else antiafk.disable();
                            this.broadcastToggles(username);
                        }
                        break;
                    case 'toggleAutoAuth':
                        const autoauth = bot.featureManager.getFeature('autoauth');
                        if (autoauth) {
                            if (payload.enabled) autoauth.enable();
                            else autoauth.disable();
                            this.broadcastToggles(username);
                        }
                        break;
                    case 'toggleAutoEat':
                        const autoeat = bot.featureManager.getFeature('autoeat');
                        if (autoeat) {
                            if (payload.enabled) autoeat.enable();
                            else autoeat.disable();
                            this.broadcastToggles(username);
                        }
                        break;
                    case 'toggleAutoReconnect':
                        bot.config.autoReconnect = payload.enabled;
                        bot.log(`Auto Reconnect ${payload.enabled ? 'enabled' : 'disabled'}`, 'info');
                        this.broadcastToggles(username);
                        break;
                    case 'togglePlugin':
                        if (bot.pluginManager) {
                            bot.pluginManager.togglePlugin(payload.pluginName, payload.enabled);
                            this.io.emit('pluginList', { username: bot.username, plugins: bot.pluginManager.getAllPlugins() });
                        }
                        break;
                    case 'updatePluginConfig':
                        if (bot.pluginManager) {
                            bot.pluginManager.updatePluginConfig(payload.pluginName, payload.config);
                            this.io.emit('pluginList', { username: bot.username, plugins: bot.pluginManager.getAllPlugins() });
                        }
                        break;
                    case 'stopNavigation':
                        const navFeature = bot.featureManager.getFeature('navigation');
                        if (navFeature) {
                            navFeature.stop();
                        }
                        break;
                    case 'rejoin':
                        bot.rejoin();
                        break;
                    case 'setLook':
                        bot.setLook(payload.yaw, payload.pitch);
                        break;
                    case 'respawn':
                        bot.bot.respawn();
                        break;
                    case 'click':
                        if (payload.type === 'left') {
                            bot.bot.swingArm('right');

                            // Find nearest entity first
                            const entity = bot.bot.nearestEntity(e =>
                                (e.type === 'player' || e.type === 'mob') &&
                                bot.bot.entity.position.distanceTo(e.position) < 4
                            );

                            if (entity) {
                                bot.bot.attack(entity);
                            } else {
                                // Fallback to digging
                                const block = bot.bot.blockAtCursor(5);
                                if (block) {
                                    if (bot.bot.targetDigBlock) bot.bot.stopDigging();
                                    bot.bot.dig(block, false).catch(err => {
                                        if (err.message !== 'Digging aborted') console.error('Digging error:', err);
                                    });
                                }
                            }
                        } else if (payload.type === 'right') {
                            bot.bot.activateItem();
                        }
                        break;
                    case 'toggleView':
                        const viewerFeature = bot.featureManager.getFeature('viewer');
                        if (viewerFeature) {
                            viewerFeature.toggleView();
                        }
                        break;
                    case 'suicide':
                        const combatForSuicide = bot.featureManager.getFeature('combat');
                        if (combatForSuicide) {
                            combatForSuicide.suicide();
                        }
                        break;
                    case 'stop':
                        botManager.stopBot(username);
                        break;
                    case 'delete':
                        botManager.removeBot(username);
                        break;
                    case 'togglePacketDebug':
                        if (payload.enabled) 
                            bot.enablePacketDebug();
                        else 
                            bot.disablePacketDebug();
                        break;
                        break;
                }
            });

            socket.on('control', (data) => {
                const { username, control, state } = data;
                const botClient = botManager.getBot(username);
                if (botClient && botClient.bot && botClient.bot.entity) {
                    try {
                        botClient.bot.setControlState(control, state);
                    } catch (error) {
                    }
                }
            });

            socket.on('bulkAction', (data) => {
                AuditLogger.log('Dashboard', socket.id, `Bulk Action ${data.action} on ${data.usernames?.length || 0} bots`);
                const { usernames, action, payload } = data;
                usernames.forEach(username => {
                    const bot = botManager.getBot(username);
                    if (!bot) return;

                    switch (action) {
                        case 'move':
                            const nav = bot.featureManager.getFeature('navigation');
                            if (nav) nav.moveTo(payload.x, payload.y, payload.z);
                            break;
                        case 'chat':
                            const chat = bot.featureManager.getFeature('chat');
                            if (chat) chat.send(payload.message);
                            break;
                        case 'toggleSpammer':
                            const spammer = bot.featureManager.getFeature('spammer');
                            if (spammer) {
                                if (spammer.config.enabled) spammer.stop();
                                else spammer.start();
                                this.broadcastToggles(username);
                            }
                            break;
                        case 'rejoin':
                            bot.rejoin();
                            break;
                        case 'stop':
                            bot.stop();
                            break;
                    }
                });
            });
        });

        botManager.on('botCreated', (username) => {
            this.io.emit('botStatus', { username, status: 'Created' });
            const bot = botManager.getBot(username);
            if (!bot) return;

            bot.on('pluginError', (data) => {
                this.io.emit('notification', {
                    type: 'error',
                    message: `Plugin '${data.name}' crashed: ${data.error}`
                });
                if (bot.pluginManager) {
                    this.io.emit('pluginList', { username: bot.username, plugins: bot.pluginManager.getAllPlugins() });
                }
            });
        });

        botManager.on('botSpawn', (username) => {
            const bot = botManager.getBot(username);
            if (!bot) return;

            this.io.emit('botStatus', { username, status: 'Online' });

            if (bot.pluginManager) {
                this.io.emit('pluginList', { username: bot.username, plugins: bot.pluginManager.getAllPlugins() });
            }

            if (bot.chatHistory) {
                this.io.emit('chatHistory', { username: bot.username, history: bot.chatHistory });
            }

            if (bot.viewerPort) {
                this.io.emit('botViewer', {
                    username: bot.username,
                    port: bot.viewerPort,
                    firstPerson: !!bot.config.firstPerson
                });
            }

            const killaura = bot.featureManager.getFeature('combat');
            const antiafk = bot.featureManager.getFeature('antiafk');
            const autoauth = bot.featureManager.getFeature('autoauth');

            this.io.emit('botToggles', {
                username: bot.username,
                killauraEnabled: killaura ? killaura.killauraEnabled : false,
                antiAfkEnabled: antiafk ? antiafk.enabled : false,
                autoAuthEnabled: autoauth ? autoauth.enabled : false,
                autoEatEnabled: bot.featureManager.getFeature('autoeat') ? bot.featureManager.getFeature('autoeat').enabled : false,
                autoReconnectEnabled: bot.config.autoReconnect,
                spammerEnabled: bot.featureManager.getFeature('spammer') ? bot.featureManager.getFeature('spammer').config.enabled : false
            });

            const spammer = bot.featureManager.getFeature('spammer');
            if (spammer) {
                this.io.emit('spammerConfig', {
                    username: bot.username,
                    enabled: spammer.config.enabled,
                    config: spammer.config
                });
            }
        });

        botManager.on('botEnd', (username) => {
            this.io.emit('botStatus', { username, status: 'Offline' });
        });

        botManager.on('botRemoved', (username) => {
            this.io.emit('botRemoved', username);
        });
    }

    broadcastToggles(username) {
        const bot = botManager.getBot(username);
        if (!bot) return;

        const killaura = bot.featureManager.getFeature('combat');
        const antiafk = bot.featureManager.getFeature('antiafk');
        const autoauth = bot.featureManager.getFeature('autoauth');
        const spammer = bot.featureManager.getFeature('spammer');

        this.io.emit('botToggles', {
            username: bot.username,
            killauraEnabled: killaura ? killaura.killauraEnabled : false,
            antiAfkEnabled: antiafk ? antiafk.enabled : false,
            autoAuthEnabled: autoauth ? autoauth.enabled : false,
            autoEatEnabled: bot.featureManager.getFeature('autoeat') ? bot.featureManager.getFeature('autoeat').enabled : false,
            spammerEnabled: spammer ? spammer.config.enabled : false,
            autoReconnectEnabled: bot.config.autoReconnect !== false
        });
    }
}
