const fs = require('fs');
const logger = require('../modules/@rasavedic').createModuleLogger('EventHandler');

function loadEvents(client) {
    const eventFiles = fs.readdirSync('./src/events').filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const event = require(`../events/${file}`);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(client, ...args));
        } else {
            client.on(event.name, (...args) => event.execute(client, ...args));
        }
        
        logger.info(`Loaded event: ${event.name}`);
    }
}

module.exports = { loadEvents };
