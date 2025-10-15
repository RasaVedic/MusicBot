const { EmbedBuilder, Events } = require('discord.js');
const config = require('../config/config.json');

module.exports = {
    name: Events.GuildCreate,
    async execute(client, guild) {
        console.log(`Joined new guild: ${guild.name} (${guild.id})`);
        
        try {
            const owner = await guild.fetchOwner();
            
            const welcomeEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('🎉 Thank You for Adding Me!')
                .setDescription(
                    `Thank you for adding me to **${guild.name}**!\n\n` +
                    `I'm a feature-rich music bot with advanced playback controls, lyrics support, and moderation tools.\n\n` +
                    `**Getting Started:**\n` +
                    `• Default prefix: \`${config.defaultPrefix}\`\n` +
                    `• Use \`${config.defaultPrefix}help\` to see all commands\n` +
                    `• Use \`${config.defaultPrefix}play <song>\` to start playing music\n` +
                    `• Use \`${config.defaultPrefix}prefix <new_prefix>\` to change the prefix\n\n` +
                    `**Key Features:**\n` +
                    `🎵 High-quality music playback\n` +
                    `📝 Lyrics with live sync support\n` +
                    `🎛️ Advanced music controls\n` +
                    `🔨 Moderation commands\n` +
                    `🌙 Silent mode (10 PM - 6 AM IST)\n\n` +
                    `Need help? Join our support server or contact the bot developer.\n\n` +
                    `Enjoy using the bot! 🎶`
                )
                .setThumbnail(client.user.displayAvatarURL())
                .setFooter({ text: `Added to ${guild.memberCount} member server` })
                .setTimestamp();
            
            await owner.send({ embeds: [welcomeEmbed] });
            console.log(`Successfully sent welcome DM to ${owner.user.tag}`);
        } catch (error) {
            console.error('Error sending guild join DM:', error);
        }
    }
};
