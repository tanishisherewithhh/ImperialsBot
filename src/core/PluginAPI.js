export class PluginAPI {
    constructor(botClient) {
        this.botClient = botClient;
        this.pluginWrapper = null;
        this.eventListeners = []; // Track listeners for cleanup
    }

    get bot() {
        return this.botClient.bot;
    }

    /**
     * Internal: Binds the API to the wrapper for state checking
     */
    _setWrapper(wrapper) {
        this.pluginWrapper = wrapper;
        return this;
    }

    _bindPlugin(instance) {
        this.pluginInstance = instance;
        return this;
    }

    /**
     * Guarded event listener: Only runs if plugin is enabled.
     * Automatically cleaned up when plugin is disabled.
     */
    on(event, listener) {
        const wrappedListener = (...args) => {
            if (this.pluginWrapper && this.pluginWrapper.enabled && !this.pluginWrapper.hasError) {
                listener(...args);
            }
        };
        this.botClient.on(event, wrappedListener);
        this.eventListeners.push({ event, original: listener, wrapped: wrappedListener });
        return this;
    }

    /**
     * Guarded once listener: Only runs if plugin is enabled.
     */
    once(event, listener) {
        const wrappedListener = (...args) => {
            if (this.pluginWrapper && this.pluginWrapper.enabled && !this.pluginWrapper.hasError) {
                listener(...args);
            }
        };
        this.botClient.once(event, wrappedListener);
        this.eventListeners.push({ event, original: listener, wrapped: wrappedListener });
        return this;
    }

    /**
     * Internal: Cleanup all listeners registered via this API
     */
    _cleanup() {
        this.eventListeners.forEach(({ event, wrapped }) => {
            this.botClient.removeListener(event, wrapped);
        });
        this.eventListeners = [];
    }

    // System
    log(msg, type = 'info') {
        const color = this.pluginInstance?.color || 'f';
        this.botClient.log(`§${color}[${this.pluginInstance?.name || 'Plugin'}]§r ${msg}`, type);
    }

    chat(msg) {
        try {
            if (this.bot && this.bot._client && this.bot._client.connected && typeof this.bot.chat === 'function') {
                this.bot.chat(msg);
            } else {
                this.log('Chat failed: Bot client not ready or disconnected.', 'warning');
            }
        } catch (err) {
            this.log(`Critical Chat Error: ${err.message}`, 'error');
        }
    }

    reconnect() {
        if (this.bot) this.bot.quit();
        this.botClient.init();
    }

    setPlugin(name, enabled) {
        return this.botClient.pluginManager.togglePlugin(name, enabled);
    }

    // Movement
    move(x, y, z) {
        const nav = this.botClient.featureManager.getFeature('navigation');
        if (nav) nav.moveTo(x, y, z);
    }

    stop() {
        const nav = this.botClient.featureManager.getFeature('navigation');
        if (nav) nav.stop();
        this.bot?.clearControlStates();
    }

    jump(active = true) {
        this.bot?.setControlState('jump', active);
    }

    sprint(active = true) {
        this.bot?.setControlState('sprint', active);
    }

    sneak(active = true) {
        this.bot?.setControlState('sneak', active);
    }

    setControlState(control, active) {
        this.bot?.setControlState(control, active);
    }

    getPos() {
        return this.bot?.entity?.position?.clone() || null;
    }

    // Combat & Interactions
    attack(entity) {
        if (!entity) return;
        this.bot?.pvp?.attack(entity);
    }

    use(entity) {
        if (!entity) return;
        this.bot?.activateEntity(entity);
    }

    async equip(item, destination = 'hand') {
        if (!this.bot || !item) return;
        try {
            await this.bot.equip(item, destination);
        } catch (err) {
            this.log(`Equip error: ${err.message}`, 'error');
        }
    }

    breakBlock(block, direction = 'down') {
        if (!block) return;
        this.bot?.dig(block, direction);
    }

    lookAt(pos) {
        if (!pos) return;
        this.bot?.lookAt(pos);
    }

    // Features
    setKillaura(enabled) {
        const combat = this.botClient.featureManager.getFeature('combat');
        if (combat) combat.toggleKillaura(enabled);
    }

    setSpammer(enabled, config) {
        const spammer = this.botClient.featureManager.getFeature('spammer');
        if (spammer) {
            if (config) spammer.setConfig(config);
            if (enabled) spammer.start();
            else spammer.stop();
        }
    }

    setAntiAFK(enabled) {
        const antiafk = this.botClient.featureManager.getFeature('antiafk');
        if (antiafk) {
            if (enabled) antiafk.enable();
            else antiafk.disable();
        }
    }

    setAutoAuth(enabled) {
        const autoauth = this.botClient.featureManager.getFeature('autoauth');
        if (autoauth) {
            if (enabled) autoauth.enable();
            else autoauth.disable();
        }
    }

    // Information
    getHealth() {
        return this.bot?.health || 0;
    }

    getFood() {
        return this.bot?.food || 0;
    }

    getInventory() {
        return this.bot?.inventory?.items()?.map(item => ({
            name: item.name,
            count: item.count,
            slot: item.slot
        })) || [];
    }

    getEntities(range = 32) {
        if (!this.bot?.entity) return [];
        return Object.values(this.bot.entities).filter(e =>
            e !== this.bot.entity &&
            e.position.distanceTo(this.bot.entity.position) <= range
        );
    }

    // Internal helper to bind plugin context
    _bindPlugin(pluginInstance) {
        this.pluginInstance = pluginInstance;
        return this;
    }
}
