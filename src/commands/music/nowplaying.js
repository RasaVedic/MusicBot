const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple, safeDelete } = require('../../utils/messageUtils');
const { replySilentAware } = require('../../utils/timeUtils');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const https = require('https');

async function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : require('http');
        protocol.get(url, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                loadImage(buffer).then(resolve).catch(reject);
            });
        }).on('error', (err) => {
            console.error('Image load error:', err);
            reject(err);
        });
    });
}

function formatDuration(ms) {
    if (!ms || ms === 0 || isNaN(ms)) {
        return 'Live Stream';
    }
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function createNowPlayingImage(track, player, botName) {
    const width = 900;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    const background = await loadImage(path.join(__dirname, '../../assets/npbgimage.jpg'));
    ctx.drawImage(background, 0, 0, width, height);

    // Bot name with shadow effect
    ctx.font = '900 45px "Impact", "Arial Black", sans-serif';
    ctx.fillStyle = '#000000';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.textAlign = 'left';
    ctx.fillText(botName.toUpperCase(), 32, 62);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(botName.toUpperCase(), 30, 60);

    let thumbnailLoaded = false;
    try {
        let thumbnailUrl = track.thumbnail || track.artworkUrl;

        if (!thumbnailUrl && track.identifier) {
            thumbnailUrl = `https://img.youtube.com/vi/${track.identifier}/maxresdefault.jpg`;
        }

        if (thumbnailUrl) {
            const thumbnail = await loadImageFromUrl(thumbnailUrl);
            const thumbX = 40;
            const thumbY = 85;
            const thumbSize = 190;

            // Outer glow/shadow for thumbnail
            ctx.shadowColor = 'rgba(0, 255, 255, 0.6)';
            ctx.shadowBlur = 20;

            // Rounded square thumbnail with gradient border
            const borderRadius = 15;
            const borderWidth = 4;

            // Draw gradient border
            const gradient = ctx.createLinearGradient(thumbX, thumbY, thumbX + thumbSize, thumbY + thumbSize);
            gradient.addColorStop(0, '#FF00FF');
            gradient.addColorStop(0.5, '#00FFFF');
            gradient.addColorStop(1, '#FF00FF');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(thumbX - borderWidth, thumbY - borderWidth, thumbSize + borderWidth * 2, thumbSize + borderWidth * 2, borderRadius + borderWidth);
            ctx.fill();

            // Reset shadow
            ctx.shadowBlur = 0;

            // Draw thumbnail with rounded corners
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, borderRadius);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(thumbnail, thumbX, thumbY, thumbSize, thumbSize);
            ctx.restore();

            thumbnailLoaded = true;
        }
    } catch (error) {
        console.error('Error loading thumbnail:', error);
    }

    const textX = thumbnailLoaded ? 260 : 50;

    // Song title with gradient and shadow
    const songTitle = track.title.length > 28 ? track.title.substring(0, 28) + '...' : track.title;
    ctx.font = '900 32px "Arial Black", sans-serif';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const titleGradient = ctx.createLinearGradient(textX, 0, textX + 600, 0);
    titleGradient.addColorStop(0, '#00FFFF');
    titleGradient.addColorStop(1, '#FF00FF');
    ctx.fillStyle = titleGradient;
    ctx.textAlign = 'left';
    ctx.fillText(songTitle, textX, 125);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Author with bold font
    ctx.font = '800 22px "Arial Black", sans-serif';
    ctx.fillStyle = '#FFEB3B';
    ctx.fillText(`🎤 ${track.author || 'Unknown Artist'}`, textX, 160);

    // Requester
    const requesterName = track.requester?.username || 'Unknown';
    ctx.font = '700 19px "Arial Black", sans-serif';
    ctx.fillStyle = '#FF69B4';
    ctx.fillText(`👤 ${requesterName}`, textX, 190);

    // Duration
    const trackDuration = track.length || track.duration || 0;
    const playerPosition = player.position || 0;
    const duration = formatDuration(trackDuration);
    const position = formatDuration(playerPosition);
    const progressText = `${position} / ${duration}`;
    ctx.font = '700 19px "Arial Black", sans-serif';
    ctx.fillStyle = '#90EE90';
    ctx.fillText(`⏱️ ${progressText}`, textX, 218);

    // Platform
    const platform = track.sourceName || track.source || 'YouTube';
    ctx.font = '700 17px "Arial Black", sans-serif';
    ctx.fillStyle = '#FFA500';
    ctx.fillText(`📡 ${platform}`, textX, 245);

    // Enhanced progress bar with rounded corners
    const progressBarWidth = 600;
    const progressBarHeight = 12;
    const progressBarX = textX;
    const progressBarY = 260;
    const barRadius = 6;

    // Background bar with shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.roundRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight, barRadius);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Progress bar with gradient
    if (trackDuration && trackDuration > 0) {
        const progress = (playerPosition / trackDuration) * progressBarWidth;
        const progressGradient = ctx.createLinearGradient(progressBarX, 0, progressBarX + progress, 0);
        progressGradient.addColorStop(0, '#FF00FF');
        progressGradient.addColorStop(0.5, '#00FFFF');
        progressGradient.addColorStop(1, '#FF00FF');
        ctx.fillStyle = progressGradient;
        ctx.beginPath();
        ctx.roundRect(progressBarX, progressBarY, progress, progressBarHeight, barRadius);
        ctx.fill();
    }

    return canvas.toBuffer('image/png');
}

module.exports = {
    name: 'nowplaying',
    category: 'music',
    aliases: ['np', 'current'],
    description: 'Show the currently playing song',
    async execute(client, message, args) {
        const player = client.manager.players.get(message.guild.id);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Nothing is currently playing.`);

            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const track = player.queue.current;

        try {
            const imageBuffer = await createNowPlayingImage(track, player, client.user.username);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'nowplaying.png' });

            const reply = await replySilentAware(message, { 
                files: [attachment]
            });

            safeDelete(message, config.autoDeleteTime);
        } catch (error) {
            console.error('Error creating now playing image:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to create now playing image.`);

            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};