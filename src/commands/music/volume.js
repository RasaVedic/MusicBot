const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { replySilentAware } = require('../../utils/timeUtils');
const firebaseState = require('../../services/FirebaseStateManager');

module.exports = {
    name: 'volume',
    category: 'music',
    aliases: ['v', 'vol'],
    description: 'Set the volume (0-100)',
    async execute(client, message, args) {
        const player = client.manager.players.get(message.guild.id);

        if (!player) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Nothing is currently playing.`);
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const voiceChannelId = player.voiceChannel || player.voiceId;
        if (!message.member.voice.channel || message.member.voice.channel.id !== voiceChannelId) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need to be in the same voice channel as me.`);
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!args.length) {
            const currentVolume = player.volume || config.music.defaultVolume;
            const volumeEmoji = currentVolume === 0 ? emoji.volumemute : currentVolume < 50 ? emoji.volumelow : emoji.volume;
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${volumeEmoji} Current volume: **${currentVolume}%**\n\nUsage: \`volume <0-100>\``);
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const volume = parseInt(args[0]);

        if (isNaN(volume) || volume < 0 || volume > 100) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please provide a valid volume between 0 and 100.`);
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        player.setVolume(volume);

        await firebaseState.savePlayerState(message.guild.id, player);

        const volumeEmoji = volume === 0 ? emoji.volumemute : volume < 50 ? emoji.volumelow : emoji.volume;
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${volumeEmoji} Volume set to **${volume}%**`);

        const reply = await message.reply({ embeds: [embed] });
        safeDeleteMultiple([reply], config.autoDeleteTime);
    }
};
