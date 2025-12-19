export class BaseFeature {
    constructor(botClient) {
        this.botClient = botClient;
        this.bot = botClient.bot;
    }

    init() {
        // Override this to bind events or initialize logic
    }

    dispose() {
        // Override in subclasses to clean up listeners attached to botClient
    }

    enable() {
        // Optional: Enable feature
    }

    disable() {
        // Optional: Disable feature
    }
}
