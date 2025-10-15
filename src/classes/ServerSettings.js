const { db } = require('../config/firebase');

class ServerSettings {
    constructor() {
        this.cache = new Map();
    }

    async getPrefix(guildId) {
        if (this.cache.has(guildId)) {
            return this.cache.get(guildId).prefix;
        }

        try {
            const doc = await db.collection('guilds').doc(guildId).get();
            const data = doc.exists ? doc.data() : { prefix: '+' };
            this.cache.set(guildId, data);
            return data.prefix || '+';
        } catch (error) {
            console.error('Error fetching prefix:', error);
            return '+';
        }
    }

    async setPrefix(guildId, prefix) {
        try {
            await db.collection('guilds').doc(guildId).set({ prefix }, { merge: true });
            const cached = this.cache.get(guildId) || {};
            cached.prefix = prefix;
            this.cache.set(guildId, cached);
            return true;
        } catch (error) {
            console.error('Error setting prefix:', error);
            return false;
        }
    }

    async getSettings(guildId) {
        if (this.cache.has(guildId)) {
            return this.cache.get(guildId);
        }

        try {
            const doc = await db.collection('guilds').doc(guildId).get();
            const data = doc.exists ? doc.data() : { 
                prefix: '+',
                volume: 80,
                djRole: null,
                autoDelete: true
            };
            this.cache.set(guildId, data);
            return data;
        } catch (error) {
            console.error('Error fetching settings:', error);
            return { prefix: '+', volume: 80, djRole: null, autoDelete: true };
        }
    }

    async updateSettings(guildId, settings) {
        try {
            await db.collection('guilds').doc(guildId).set(settings, { merge: true });
            const cached = this.cache.get(guildId) || {};
            Object.assign(cached, settings);
            this.cache.set(guildId, cached);
            return true;
        } catch (error) {
            console.error('Error updating settings:', error);
            return false;
        }
    }

    clearCache(guildId) {
        this.cache.delete(guildId);
    }
}

module.exports = ServerSettings;
