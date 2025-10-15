const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');

module.exports = {
    name: 'terms',
    aliases: ['tos', 'termsofservice'],
    description: 'View the bot\'s Terms of Service',
    usage: 'terms',
    category: 'utility',
    
    async execute(client, message, args, serverSettings) {
        const prefix = serverSettings ? await serverSettings.getPrefix(message.guild.id) : config.prefix;
        
        const embed = new EmbedBuilder()
            .setColor(config.embedColor || '#FF4B32')
            .setTitle(`${emoji.info || '📋'} Terms of Service`)
            .setDescription(
                '**By using this bot, you agree to our Terms of Service.**\n\n' +
                '**Key Points:**\n' +
                '• Use the bot in compliance with Discord\'s Terms of Service\n' +
                '• Do not abuse, exploit, or disrupt bot functionality\n' +
                '• Respect copyright and intellectual property rights\n' +
                '• Admin commands require appropriate Discord permissions\n' +
                '• We reserve the right to modify or discontinue the service\n\n' +
                '**Full Terms of Service:**\n' +
                '[Read Complete Terms](https://github.com/your-repo/blob/main/TERMS_OF_SERVICE.md)\n\n' +
                '**Privacy Policy:**\n' +
                `Use \`${prefix}privacy\` to view our Privacy Policy`
            )
            .setFooter({ 
                text: 'Last Updated: October 13, 2025 | Your use indicates acceptance of these terms' 
            })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};
