const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple, safeDelete } = require('../../utils/messageUtils');
const { getIndianTimestamp } = require('../../utils/timeUtils');
const firebaseState = require('../../services/FirebaseStateManager');

module.exports = {
    name: 'leave',
    category: 'music',
    aliases: ['l', 'disconnect', 'dc'],
    description: 'Leave the voice channel and stop the music',
    async execute(client, message, args) {
        const player = client.manager.players.get(message.guild.id);

        if (!player) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} I'm not in a voice channel.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const voiceChannelId = player.voiceChannel || player.voiceId;
        if (!message.member.voice.channel || message.member.voice.channel.id !== voiceChannelId) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need to be in the same voice channel as me.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (player.preloadTimer) {
            clearTimeout(player.preloadTimer);
            player.preloadTimer = null;
        }

        if (player.nowPlayingMessage) {
            await safeDelete(player.nowPlayingMessage);
            player.nowPlayingMessage = null;
        }

        if (player.autoplayStatusMessage) {
            await safeDelete(player.autoplayStatusMessage);
            player.autoplayStatusMessage = null;
        }

        const channelName = message.member.voice.channel.name;
        
        await firebaseState.saveDisconnectHistory(message.guild.id, 'user_command_leave', {
            voiceChannelId: voiceChannelId,
            voiceChannelName: channelName,
            textChannelId: message.channel.id,
            currentTrack: player.queue?.current || player.currentTrack,
            position: player.position || 0,
            queueLength: player.queue?.length || player.queue?.size || 0,
            wasPlaying: player.playing || false,
            reason: 'User requested to leave voice channel',
            executedBy: message.author.tag,
            executedById: message.author.id
        });
        
        player.destroy();

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${emoji.stop} Left **${channelName}** and cleared the queue.`);

        const reply = await message.reply({ embeds: [embed] });
        safeDeleteMultiple([reply], config.autoDeleteTime);
    }
};
