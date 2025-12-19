import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../bots.json');
const SETTINGS_PATH = path.join(__dirname, '../../settings.json');

export class ConfigLoader {
    static async loadBots() {
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
        await fs.writeFile(CONFIG_PATH, JSON.stringify(bots, null, 2));
    }

    static async addBotConfig(config) {
        const bots = await this.loadBots();
        // Check if exists
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
        try {
            const data = await fs.readFile(SETTINGS_PATH, 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            return null; // Return null if not found
        }
    }

    static async saveSettings(settings) {
        // Merge with existing settings
        const current = await this.loadSettings() || {};
        const newSettings = { ...current, ...settings };
        await fs.writeFile(SETTINGS_PATH, JSON.stringify(newSettings, null, 2));
    }
}
