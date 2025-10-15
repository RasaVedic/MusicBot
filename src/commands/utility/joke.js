const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');

module.exports = {
    name: 'joke',
    category: 'utility',
    aliases: ['j', 'funny'],
    description: 'Get a random joke from the internet',
    async execute(client, message, args) {
        await message.channel.sendTyping();
        
        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch('https://official-joke-api.appspot.com/random_joke');
            
            if (!response.ok) {
                throw new Error('API request failed');
            }
            
            const data = await response.json();
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('😂 Random Joke')
                .setDescription(`**${data.setup}**\n\n||${data.punchline}||`)
                .setFooter({ text: 'Click to reveal the punchline!' })
                .setTimestamp();
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime * 3);
        } catch (error) {
            console.error('Error fetching joke:', error);
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to fetch a joke. Please try again later.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
