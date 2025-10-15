const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');

module.exports = {
    name: 'shuffle',
    category: 'music',
    aliases: ['sh', 'mix'],
    description: 'Shuffle the queue',
    async execute(client, message, args) {
        const player = client.manager.get(message.guild.id);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} No music is currently playing.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!message.member.voice.channel) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need to be in a voice channel.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (message.member.voice.channel.id !== player.voiceId) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need to be in the same voice channel as me.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (player.queue.length < 2) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Need at least 2 songs in queue to shuffle.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const tracks = [];
        for (let i = 0; i < player.queue.length; i++) {
            tracks.push(player.queue[i]);
        }

        for (let i = tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }

        player.queue.clear();
        tracks.forEach(track => player.queue.add(track));

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${emoji.success} Queue shuffled! **${tracks.length}** tracks randomized.`);

        const reply = await message.reply({ embeds: [embed] });
        safeDeleteMultiple([reply], config.autoDeleteTime);
    }
};
