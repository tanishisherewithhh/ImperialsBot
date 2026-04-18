import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../bots.json');
const SETTINGS_PATH = path.join(__dirname, '../../settings.json');

function getJsonFromEnv(varName) {
    try {
        const envData = process.env[varName];
        if (envData) {
            return JSON.parse(Buffer.from(envData, 'base64').toString('utf-8'));
        }
    } catch (e) { }
    return null;
}

function setJsonInEnv(varName, data) {
    if (process.env.IMPERIALS_CLOUD_MODE === 'true') {
        return;
    }
    const str = JSON.stringify(data, null, 2);
    const encoded = Buffer.from(str).toString('base64');
    process.env[varName] = encoded;
}

export class ConfigLoader {
    static async loadBots() {
        if (process.env.IMPERIALS_CLOUD_MODE === 'true') {
            const envData = getJsonFromEnv('IMPERIALS_BOTS');
            if (envData) return envData;
        }
        try {
            const data = await fs.readFile(CONFIG_PATH, 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return [];
            }
            throw err;
        }
    }

    static async saveBots(bots) {
        if (process.env.IMPERIALS_CLOUD_MODE === 'true') {
            setJsonInEnv('IMPERIALS_BOTS', bots);
            return;
        }
        await fs.writeFile(CONFIG_PATH, JSON.stringify(bots, null, 2));
    }

    static async addBotConfig(config) {
        const bots = await this.loadBots();

        const index = bots.findIndex(b => b.username === config.username);
        if (index !== -1) {
            bots[index] = config;
        } else {
            bots.push(config);
        }
        await this.saveBots(bots);
    }

    static async removeBotConfig(username) {
        const bots = await this.loadBots();
        const newBots = bots.filter(b => b.username !== username);
        await this.saveBots(newBots);
    }

    static async loadSettings() {
        if (process.env.IMPERIALS_CLOUD_MODE === 'true') {
            const envData = getJsonFromEnv('IMPERIALS_SETTINGS');
            if (envData) return envData;
        }
        try {
            const data = await fs.readFile(SETTINGS_PATH, 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            return {};
        }
    }

    static async saveSettings(settings) {
        if (process.env.IMPERIALS_CLOUD_MODE === 'true') {
            const current = await this.loadSettings();
            const newSettings = { ...current, ...settings };
            setJsonInEnv('IMPERIALS_SETTINGS', newSettings);
            return;
        }
        const current = await this.loadSettings() || {};
        const newSettings = { ...current, ...settings };
        await fs.writeFile(SETTINGS_PATH, JSON.stringify(newSettings, null, 2));
    }

    static async removeProxyFromGlobal(proxyUrl) {
        const settings = await this.loadSettings();
        if (settings && settings.proxyList) {
            const proxies = settings.proxyList.split('\n').map(p => p.trim());
            const filtered = proxies.filter(p => p !== proxyUrl && p.length > 0);
            if (filtered.length !== proxies.length) {
                settings.proxyList = filtered.join('\n');
                await this.saveSettings(settings);
            }
        }
    }
}
