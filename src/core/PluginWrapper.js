/**
 * Minecraft Color & Formatting Codes Reference
 * Use these codes with the '§' symbol (e.g., '§c' for Red) in api.log or chat.
 *
 * Colors:
 * §0 - Black
 * §1 - Dark Blue
 * §2 - Dark Green
 * §3 - Dark Aqua
 * §4 - Dark Red
 * §5 - Dark Purple
 * §6 - Gold
 * §7 - Gray
 * §8 - Dark Gray
 * §9 - Blue
 * §a - Green
 * §b - Aqua
 * §c - Red
 * §d - Light Purple
 * §e - Yellow
 * §f - White
 *
 * Formatting:
 * §k - Obfuscated
 * §l - Bold
 * §m - Strikethrough
 * §n - Underline
 * §o - Italic
 * §r - Reset
 */
export class PluginWrapper {
    constructor(plugin, botClient, api) {
        this.plugin = plugin;
        this.botClient = botClient;
        this.api = api;
        this.name = plugin.name || 'Unnamed Plugin';
        this.description = plugin.description || 'No description';
        this.enabled = false;
        this.hasError = false;
        this.settings = plugin.settings || {}; // Definition
        this.config = {}; // Runtime values
    }

    safeCall(method, ...args) {
        if (this.hasError) return;
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
        const msg = `Plugin '${this.name}' crashed in ${context}: ${err.message}`;
        console.error(msg);

        // Notify via BotClient log which goes to Socket -> UI
        this.botClient.log(msg, 'error');

        // Emit specific plugin error event
        if (this.botClient.emit) {
            this.botClient.emit('pluginError', { name: this.name, error: err.message });
        }
    }

    init() {
        this.safeCall('init', this.botClient.bot, this.api); // Pass safe API here if needed
    }

    enable() {
        if (this.hasError) return;
        this.enabled = true;
        this.safeCall('enable');
        this.botClient.log(`Plugin '${this.name}' enabled`, 'success');
    }

    disable() {
        this.enabled = false;
        this.safeCall('disable');
        this.botClient.log(`Plugin '${this.name}' disabled`, 'warning');
    }

    onTick() {
        if (this.enabled && !this.hasError) {
            this.safeCall('onTick');
        }
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.safeCall('onConfigUpdate', this.config);
    }
}
