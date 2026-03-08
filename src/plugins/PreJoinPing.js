import { NetworkUtils } from '../utils/NetworkUtils.js';

export class Plugin {
    constructor() {
        this.name = 'Pre-Join Ping';
        this.description = 'Pings the server before joining to bypass some AntiBot systems like EpicGuard';

        this.settings = {
            timeout: {
                type: 'number',
                label: 'Ping Timeout (ms)',
                default: 5000
            },
            retries: {
                type: 'number',
                label: 'Ping Retries',
                default: 1
            },
            delay: {
                type: 'number',
                label: 'Delay after Ping (ms)',
                default: 1000
            }
        };
    }

    init(bot, api) { }

    enable() { }

    disable() { }

    async beforeJoin(api, botClient) {
        if (!api || !botClient || !api.pluginWrapper) return;

        const config = api.pluginWrapper.config;
        const timeout = config.timeout !== undefined ? parseInt(config.timeout) : 5000;
        const retries = config.retries !== undefined ? parseInt(config.retries) : 1;
        const delay = config.delay !== undefined ? parseInt(config.delay) : 1000;

        const botConfig = botClient.config;

        if (botConfig.realms) return;

        api.log(`[Antibot] Performing pre-join ping to ${botConfig.host}:${botConfig.port}...`, 'info');

        const pingResult = await NetworkUtils.pingServer(botConfig.host, botConfig.port, timeout, retries);

        if (!pingResult.success) {
            api.log(`[Antibot] Pre-join ping failed: ${pingResult.error}`, 'error');
            throw new Error(`Ping failed (${pingResult.error})`);
        }

        api.log(`[Antibot] Pre-join ping successful. Waiting ${delay}ms...`, 'success');
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}
