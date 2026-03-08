
export class PluginWrapper {
    constructor(plugin, botClient, api) {
        this.plugin = plugin;
        this.botClient = botClient;
        this.api = api;
        this.name = plugin.name || 'Unnamed Plugin';
        this.description = plugin.description || 'No description';
        this.enabled = false;
        this.hasError = false;
        this.settings = plugin.settings || {};
        this.config = {};
    }

    safeCall(method, ...args) {
        if (this.hasError) return;

        // Lifecycle methods are always callable
        const isLifecycle = ['init', 'beforeJoin', 'enable', 'disable', 'onConfigUpdate'].includes(method);

        if (!isLifecycle && !this.enabled) return;

        if (typeof this.plugin[method] !== 'function') return;

        try {
            return this.plugin[method].apply(this.plugin, args);
        } catch (err) {
            this.handleError(method, err);
        }
    }

    handleError(context, err) {
        this.hasError = true;
        this.enabled = false;
        if (this.api && typeof this.api._cleanup === 'function') {
            this.api._cleanup();
        }
        const msg = `Plugin '${this.name}' crashed in ${context}: ${err.message}`;
        console.error(msg);
        this.botClient.log(msg, 'error');

        if (this.botClient.emit) {
            this.botClient.emit('pluginError', { name: this.name, error: err.message });
        }
    }

    init() {
        if (this.api && typeof this.api._setWrapper === 'function') {
            this.api._setWrapper(this);
        }
        this.safeCall('init', this.botClient.bot, this.api);
    }

    enable() {
        if (this.hasError) return;
        this.enabled = true;
        this.safeCall('enable');
        this.botClient.log(`Plugin '${this.name}' enabled`, 'success');

        // Notify frontend
        if (this.botClient.emit) this.botClient.emit('pluginsUpdated');
    }

    disable() {
        this.enabled = false;
        this.safeCall('disable');

        // Cleanup guarded listeners
        if (this.api && typeof this.api._cleanup === 'function') {
            this.api._cleanup();
        }

        this.botClient.log(`Plugin '${this.name}' disabled`, 'warning');

        // Notify frontend
        if (this.botClient.emit) this.botClient.emit('pluginsUpdated');
    }

    onTick() {
        this.safeCall('onTick');
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.safeCall('onConfigUpdate', this.config);
    }

    toJSON() {
        return {
            enabled: this.enabled,
            config: this.config
        };
    }
}
