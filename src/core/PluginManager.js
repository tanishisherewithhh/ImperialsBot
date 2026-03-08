import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { PluginWrapper } from './PluginWrapper.js';
import { PluginAPI } from './PluginAPI.js';

export class PluginManager extends EventEmitter {
    constructor(botClient) {
        super();
        this.botClient = botClient;
        this.plugins = new Map();
        this.pluginsDir = path.join(process.cwd(), 'src', 'plugins');
        this.watcher = null;
    }

    async loadPlugins() {
        if (!fs.existsSync(this.pluginsDir)) {
            fs.mkdirSync(this.pluginsDir, { recursive: true });
        }

        const files = fs.readdirSync(this.pluginsDir).filter(f => f.endsWith('.js'));
        this.botClient.log(`Scanning plugins in plugins folder...`, 'info');

        for (const file of files) {
            await this.loadPlugin(file);
        }

        this.emit('pluginsUpdated', { username: this.botClient.username, plugins: this.getAllPlugins() });
        this.startWatcher();
    }

    startWatcher() {
        if (this.watcher) return;

        let debounceTimer = null;

        this.watcher = fs.watch(this.pluginsDir, (eventType, filename) => {
            if (!filename || !filename.endsWith('.js')) return;

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.handleFileChange(eventType, filename);
            }, 5000);
        });

        console.log('Plugin watcher started.');
    }

    async handleFileChange(eventType, filename) {
        const filePath = path.join(this.pluginsDir, filename);

        if (!fs.existsSync(filePath)) {
            this.unloadPlugin(filename);
            this.botClient.log(`Plugin ${filename} deleted.`, 'warning');
        } else {
            this.botClient.log(`Reloading plugin: ${filename}...`, 'info');
            await this.loadPlugin(filename, true);
        }

        if (this.botClient.emit) {
            this.botClient.emit('pluginsUpdated');
        }
    }

    unloadPlugin(filename) {
        for (const [name, wrapper] of this.plugins.entries()) {
            if (wrapper.filename === filename) {
                wrapper.disable();
                this.plugins.delete(name);
                console.log(`Unloaded plugin: ${name}`);
                break;
            }
        }
    }

    async loadPlugin(file, isReload = false) {
        try {
            const filePath = path.join(this.pluginsDir, file);
            const fileUrl = pathToFileURL(filePath).href + '?t=' + Date.now();

            const module = await import(fileUrl);
            const PluginClass = module.default || module.Plugin;

            if (!PluginClass) {
                console.error(`Plugin ${file} has no default export or 'Plugin' export.`);
                return;
            }

            if (isReload) this.unloadPlugin(file);

            const pluginInstance = new PluginClass();
            const api = new PluginAPI(this.botClient);

            const wrapper = new PluginWrapper(pluginInstance, this.botClient, api);
            wrapper.filename = file;

            if (this.plugins.has(wrapper.name)) {
                const old = this.plugins.get(wrapper.name);
                wrapper.enabled = old.enabled;
                wrapper.config = old.config;
                old.disable();
                this.plugins.delete(wrapper.name);
            } else {
                const savedStates = this.botClient.config.plugins || {};
                const saved = savedStates[wrapper.name];
                if (saved) {
                    wrapper.enabled = !!saved.enabled;
                    if (saved.config) wrapper.config = { ...wrapper.config, ...saved.config };
                } else {
                    wrapper.enabled = false;
                }
            }

            this.plugins.set(wrapper.name, wrapper);

            if (this.botClient.bot) {
                wrapper.init();
                api._bindPlugin(pluginInstance);
                if (wrapper.enabled) {
                    wrapper.enable();
                }
            }

            console.log(`Loaded plugin: ${wrapper.name}`);
            if (isReload) {
                this.botClient.log(`Hot Reload: ${wrapper.name} updated.`, 'success');
            }

        } catch (err) {
            console.error(`Failed to load plugin ${file}:`, err);
            this.botClient.log(`Failed to load plugin ${file}: ${err.message}`, 'error');
        }
    }

    async runPreJoinHooks() {
        for (const wrapper of this.plugins.values()) {
            if (wrapper.enabled) {
                try {
                    await wrapper.safeCall('beforeJoin', wrapper.api, this.botClient);
                } catch (err) {
                    this.botClient.log(`PreJoin hook failed for ${wrapper.name}: ${err.message}`, 'error');
                }
            }
        }
    }

    saveStates() {
        if (!this.botClient.config.plugins) this.botClient.config.plugins = {};
        for (const [name, wrapper] of this.plugins.entries()) {
            this.botClient.config.plugins[name] = wrapper.toJSON();
        }
        if (typeof this.botClient.savePluginStates === 'function') {
            this.botClient.savePluginStates();
        }
    }

    onBotSpawn() {
        this.plugins.forEach(wrapper => {
            wrapper.safeCall('onSpawn');
        });
    }

    onBotCreated() {
        this.plugins.forEach(wrapper => {
            wrapper.init();
            wrapper.api._bindPlugin(wrapper.plugin);
            if (wrapper.enabled) {
                wrapper.enable();
            }
        });
    }

    onTick() {
        this.plugins.forEach(wrapper => wrapper.onTick());
    }

    getPlugin(name) {
        return this.plugins.get(name);
    }

    getAllPlugins() {
        return Array.from(this.plugins.values()).map(wrapper => ({
            name: wrapper.name,
            description: wrapper.description,
            enabled: wrapper.enabled,
            hasError: wrapper.hasError,
            settings: wrapper.settings,
            config: wrapper.config
        }));
    }

    togglePlugin(name, enabled) {
        const wrapper = this.plugins.get(name);
        if (wrapper) {
            if (enabled) wrapper.enable();
            else wrapper.disable();
            this.saveStates();
            return true;
        }
        return false;
    }

    updatePluginConfig(name, config) {
        const wrapper = this.plugins.get(name);
        if (wrapper) {
            wrapper.updateConfig(config);
            this.saveStates();
        }
    }
}
