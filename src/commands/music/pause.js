const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { replySilentAware } = require('../../utils/timeUtils');

module.exports = {
    name: 'pause',
    category: 'music',
    aliases: ['pa'],
    description: 'Pause the current song',
    async execute(client, message, args) {
        if (!message.member.voice.channel) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need to be in a voice channel.`);
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const player = client.manager.get(message.guild.id);
        
        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Nothing is currently playing.`);
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (player.paused) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.info} The player is already paused.`);
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        player.pause(true);
        
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${emoji.success} ⏸️ Paused the music.`);
        
        const reply = await message.reply({ embeds: [embed] });
        safeDeleteMultiple([reply], config.autoDeleteTime);
    }
};
