import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { PluginWrapper } from './PluginWrapper.js';

export class PluginManager {
    constructor(botClient) {
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

        this.startWatcher();
    }

    startWatcher() {
        if (this.watcher) return;

        let debounceTimer = null;

        this.watcher = fs.watch(this.pluginsDir, (eventType, filename) => {
            if (!filename || !filename.endsWith('.js')) return;

            // Debounce to prevent double-firing on some OSs
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.handleFileChange(eventType, filename);
            }, 100);
        });

        console.log('Plugin watcher started.');
    }

    async handleFileChange(eventType, filename) {
        const filePath = path.join(this.pluginsDir, filename);

        if (!fs.existsSync(filePath)) {
            // Deleted
            this.unloadPlugin(filename);
            this.botClient.log(`Plugin ${filename} deleted.`, 'warning');
        } else {
            // Created or Modified
            this.botClient.log(`Reloading plugin: ${filename}...`, 'info');
            await this.loadPlugin(filename, true);
        }

        if (this.botClient.emit) {
            //custom event from BotClient that SocketServer handles.
            this.botClient.emit('pluginsUpdated');
        }
    }

    unloadPlugin(filename) {
        // Find plugin by filename (need to map filename to plugin name or store filename)
        // For simplicity, let's assume one plugin per file and we search.
        // Or store filename in wrapper.
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
            // Cache busting for hot reload
            const fileUrl = pathToFileURL(filePath).href + '?t=' + Date.now();

            // Dynamic Import
            const module = await import(fileUrl);
            const PluginClass = module.default || module.Plugin;

            if (!PluginClass) {
                console.error(`Plugin ${file} has no default export or 'Plugin' export.`);
                return;
            }

            // Unload previous version if exists (by checking active plugins for same filename or name)
            // If we reload, we might have a name collision if the name didn't change.
            // Best to unload by filename first if we are reloading a specific file.
            if (isReload) this.unloadPlugin(file);

            const pluginInstance = new PluginClass();
            // API Helper for plugins
            const api = {
                log: (msg, type) => {
                    const color = pluginInstance.color || 'f';
                    this.botClient.log(`§${color}[${pluginInstance.name || 'Plugin'}]§r ${msg}`, type);
                },
                chat: (msg) => this.botClient.bot?.chat(msg)
            };

            const wrapper = new PluginWrapper(pluginInstance, this.botClient, api);
            wrapper.filename = file; // Store filename for unloading

            // Check if we effectively replaced an existing one by name (if unload by filename missed it or logic differs)
            if (this.plugins.has(wrapper.name)) {
                this.plugins.get(wrapper.name).disable();
                this.plugins.delete(wrapper.name);
            }

            this.plugins.set(wrapper.name, wrapper);

            if (this.botClient.bot) {
                wrapper.init();
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

    onBotSpawn() {
        this.plugins.forEach(wrapper => {
            wrapper.safeCall('onSpawn');
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
            return true;
        }
        return false;
    }

    updatePluginConfig(name, config) {
        const wrapper = this.plugins.get(name);
        if (wrapper) {
            wrapper.updateConfig(config);
        }
    }
}
