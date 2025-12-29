import { Server } from 'socket.io';
import { botManager } from '../core/BotManager.js';
import { ConfigLoader } from '../config/ConfigLoader.js';

export class SocketServer {
    constructor(httpServer) {
        this.io = new Server(httpServer);
        this.bindGlobalEvents();
        this.bindEvents();
    }

    bindGlobalEvents() {
        botManager.on('botLog', (data) => {
            this.io.emit('logs', data);
        });

        botManager.on('botData', (data) => {
            this.io.emit('botData', data);
        });

        botManager.on('botInventory', (data) => {
            this.io.emit('botInventory', data);
        });

        botManager.on('botPlayers', (data) => {
            this.io.emit('botPlayers', data);
        });

        botManager.on('botSpawn', (username) => {
            // updates handled by botList
        });
    }

    bindEvents() {
        this.io.on('connection', async (socket) => {
            console.log('Client connected');
            const settings = await ConfigLoader.loadSettings() || {};
            socket.emit('settings', settings);
            socket.emit('botList', botManager.getAllBots());

            socket.on('saveSettings', async (newSettings) => {
                try {
                    await ConfigLoader.saveSettings(newSettings);
                    this.io.emit('settings', await ConfigLoader.loadSettings());
                } catch (err) {
                    console.error('Failed to save settings:', err);
                }
            });

            socket.on('createBot', async (config) => {
                try {
                    await botManager.createBot(config);
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

            socket.on('requestBotData', ({ username }) => {
                const bot = botManager.getBot(username);
                if (!bot) return;

                this.broadcastToggles(username);

                // Return early if bot instance not ready
                if (!bot.bot) return;

                if (bot.bot.entity) {
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
                }

                if (bot.bot.players) {
                    const players = Object.values(bot.bot.players).map(p => ({
                        username: p.username,
                        uuid: p.uuid,
                        ping: p.ping
                    }));
                    socket.emit('botPlayers', { username, players });
                }

                if (bot.bot.inventory) {
                    const items = bot.bot.inventory.items().map(item => ({
                        slot: item.slot,
                        name: item.name,
                        displayName: item.displayName,
                        count: item.count
                    }));
                    socket.emit('botInventory', { username, items });
                }

                if (bot.config.spammer) {
                    socket.emit('spammerConfig', { username, config: bot.config.spammer });
                }
            });

            socket.on('botAction', async (data) => {
                const { username, action, payload } = data;
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
                    case 'toggleSpammer':
                        const spammer = bot.featureManager.getFeature('spammer');
                        if (spammer) {
                            if (payload.enabled) {
                                spammer.setConfig(payload.config);
                                spammer.start();
                            } else {
                                spammer.stop();
                            }

                            // Persist Spammer Config
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
                    case 'click':
                        if (payload.type === 'left') {
                            bot.bot.swingArm('right'); // Attack/Main Hand
                        } else if (payload.type === 'right') {
                            bot.bot.activateItem(); // Use Item
                        }
                        break;
                    case 'toggleView':
                        const viewerFeature = bot.featureManager.getFeature('viewer');
                        if (viewerFeature) {
                            viewerFeature.toggleView();
                        }
                        break;
                }
            });

            socket.on('requestBotData', (data) => {
                const { username } = data;
                const bot = botManager.getBot(username);

                if (bot) {
                    socket.emit('chatHistory', { username: bot.username, history: bot.chatHistory || [] });

                    if (bot.pluginManager) {
                        socket.emit('pluginList', { username: bot.username, plugins: bot.pluginManager.getAllPlugins() });
                    }

                    const combat = bot.featureManager.getFeature('combat');
                    const antiafk = bot.featureManager.getFeature('antiafk');
                    const autoauth = bot.featureManager.getFeature('autoauth');
                    const spammer = bot.featureManager.getFeature('spammer');

                    socket.emit('botToggles', {
                        username: bot.username,
                        toggles: {
                            killaura: combat ? combat.killauraEnabled : false,
                            antiAfk: antiafk ? antiafk.enabled : false,
                            autoAuth: autoauth ? autoauth.enabled : false,
                            spammer: spammer ? spammer.config.enabled : false,
                            autoReconnect: bot.config.autoReconnect !== false
                        }
                    });

                    if (spammer && spammer.config) {
                        socket.emit('spammerConfig', {
                            username: bot.username,
                            config: spammer.config
                        });
                    }

                    if (bot.bot && bot.bot.entity) {
                        socket.emit('botData', {
                            username: bot.username,
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
                            ping: p.ping
                        }));
                        socket.emit('botPlayers', { username: bot.username, data: players });

                        const inventory = bot.bot.inventory.items().map(item => ({
                            slot: item.slot,
                            name: item.name,
                            displayName: item.displayName,
                            count: item.count
                        }));
                        socket.emit('botInventory', { username: bot.username, data: inventory });
                    }
                }
            });

            socket.on('control', (data) => {
                const { username, control, state } = data;
                const botClient = botManager.getBot(username);
                if (botClient && botClient.bot && botClient.bot.entity) {
                    try {
                        botClient.bot.setControlState(control, state);
                    } catch (error) {
                        // Ignore
                    }
                }
            });
        });

        botManager.on('botCreated', (username) => {
            this.io.emit('botStatus', { username, status: 'Created' });

            const bot = botManager.getBot(username);
            if (!bot) return;

            bot.on('status', (status) => {
                this.io.emit('botStatus', { username, status });
            });

            bot.on('dataUpdate', (data) => {
                this.io.emit('botData', { username, data });
            });

            bot.on('inventoryUpdate', (data) => {
                this.io.emit('botInventory', { username, data });
            });

            bot.on('playersUpdate', (data) => {
                this.io.emit('botPlayers', { username, data });
            });

            bot.on('chat', (data) => {
                this.io.emit('botChat', { username, message: data.message, sender: data.username });
            });

            bot.on('log', (data) => {
                this.io.emit('botLog', { username, message: data.message, type: data.type });
            });

            bot.on('viewerStarted', (data) => {
                this.io.emit('botViewer', {
                    username,
                    port: data.port,
                    firstPerson: !!bot.config.firstPerson
                });
            });

            botManager.on('pluginsUpdated', () => {
                if (bot.pluginManager) {
                    this.io.emit('pluginList', { username: bot.username, plugins: bot.pluginManager.getAllPlugins() });
                }
            });

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
            spammerEnabled: spammer ? spammer.config.enabled : false,
            autoReconnectEnabled: bot.config.autoReconnect !== false
        });
    }
}
