import { BaseFeature } from './BaseFeature.js';

export class DataTracker extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.lastPosition = null;
    }

    init() {
        this.botClient.bot.once('spawn', () => {
            this.botClient.bot.on('move', () => this.emitData());
            this.botClient.bot.on('health', () => this.emitData());
            this.botClient.bot.on('food', () => this.emitData());

            if (this.botClient.bot.inventory) {
                this.botClient.bot.inventory.on('updateSlot', () => this.emitInventory());
            }

            this.botClient.bot.on('playerJoined', () => this.emitPlayers());
            this.botClient.bot.on('playerLeft', () => this.emitPlayers());

            this.emitData();
            this.emitInventory();
            this.emitPlayers();
        });
    }

    emitData() {
        if (!this.botClient.bot || !this.botClient.bot.entity) return;

        const pos = this.botClient.bot.entity.position;
        const data = {
            position: { x: pos.x.toFixed(1), y: pos.y.toFixed(1), z: pos.z.toFixed(1) },
            health: this.botClient.bot.health,
            food: this.botClient.bot.food,
            yaw: this.botClient.bot.entity.yaw,
            pitch: this.botClient.bot.entity.pitch
        };

        this.botClient.emit('dataUpdate', data);
    }

    emitInventory() {
        if (!this.botClient.bot) return;

        const items = this.botClient.bot.inventory.items().map(item => ({
            name: item.name,
            count: item.count,
            displayName: item.displayName
        }));

        this.botClient.emit('inventoryUpdate', items);
    }

    emitPlayers() {
        if (!this.botClient.bot || !this.botClient.bot.players) return;

        const players = Object.values(this.botClient.bot.players).map(p => ({
            username: p.username,
            ping: p.ping,
            uuid: p.uuid
        }));

        this.botClient.emit('playersUpdate', players);
    }
}
