const { EmbedBuilder } = require('discord.js');
const config = require('../config/config.json');
const emoji = require('../config/emoji.json');
const { createMusicButtons } = require('../utils/buttons');
const { getIndianTimestamp } = require('../utils/timeUtils');

class MusicPlayer {
    constructor(client) {
        this.client = client;
    }

    createNowPlayingEmbed(track, player, requester) {
        const songTitle = track.title.length > 20 ? track.title.substring(0, 20) + '...' : track.title;
        const songUrl = track.uri || track.url || (track.identifier ? `https://www.youtube.com/watch?v=${track.identifier}` : '');
        const clickableTitle = songUrl ? `[${songTitle}](${songUrl})` : songTitle;
        
        const authorName = track.author || 'Unknown Artist';
        const trackDuration = track.length || track.duration || 0;
        const duration = this.formatTime(trackDuration);
        const platform = track.sourceName || track.source || 'YouTube';
        const thumbnail = track.thumbnail || track.artworkUrl || 'https://via.placeholder.com/300x300.png?text=No+Thumbnail';
        
        let requesterDisplay;
        if (requester === 'autoplay' || requester?.id === 'autoplay' || requester?.username === 'Autoplay') {
            requesterDisplay = 'Autoplay';
        } else if (typeof requester === 'string' && requester.startsWith('<@')) {
            requesterDisplay = requester;
        } else if (requester?.id) {
            requesterDisplay = `<@${requester.id}>`;
        } else if (typeof requester === 'string') {
            requesterDisplay = `<@${requester}>`;
        } else {
            requesterDisplay = 'Unknown';
        }
        
        const description = `**• Song :** ${clickableTitle}\n**• Author :** ${authorName}\n**• Duration :** ${duration}\n**• Platform/Source :** ${platform}\n**• Requester :** ${requesterDisplay}`;
        
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle('🎵 Now Playing...')
            .setDescription(description)
            .setThumbnail(thumbnail)
            .setFooter({ 
                text: 'Music Player'
            });

        if (songUrl) {
            embed.setURL(songUrl);
        }

        return embed;
    }

    createQueueEmbed(track, requester) {
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${emoji.success} **Added to queue:** ${track.title}`)
            .setThumbnail(track.thumbnail);

        return embed;
    }

    createControlButtons(player = null) {
        return createMusicButtons(player);
    }

    createProgressBar(current, total, barLength = 20) {
        if (!total || total === 0) {
            return '—'.repeat(barLength);
        }
        
        const percentage = current / total;
        const progress = Math.round(barLength * percentage);
        const emptyProgress = barLength - progress;

        const progressText = '▇'.repeat(progress);
        const emptyProgressText = '—'.repeat(emptyProgress);
        const bar = `${progressText}${emptyProgressText}`;

        return bar || '—'.repeat(barLength);
    }

    formatTime(ms) {
        if (!ms || ms === 0 || isNaN(ms)) {
            return 'Live Stream';
        }
        
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        }
        return `${minutes}m ${seconds}s`;
    }

    async deleteMessageAfterDelay(message, delay = config.autoDeleteTime) {
        setTimeout(async () => {
            try {
                await message.delete();
            } catch (error) {
                console.error('Error deleting message:', error);
            }
        }, delay);
    }
}

module.exports = MusicPlayer;
