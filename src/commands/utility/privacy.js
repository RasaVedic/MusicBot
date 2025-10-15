const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');

module.exports = {
    name: 'privacy',
    aliases: ['privacypolicy', 'gdpr', 'data'],
    description: 'View the bot\'s Privacy Policy and data handling information',
    usage: 'privacy',
    category: 'utility',
    
    async execute(client, message, args, serverSettings) {
        const embed = new EmbedBuilder()
            .setColor(config.embedColor || '#FF4B32')
            .setTitle(`${emoji.info || '🔒'} Privacy Policy`)
            .setDescription(
                '**Your privacy matters to us. Here\'s how we handle your data:**\n\n' +
                '**What We Collect:**\n' +
                '• Server ID & settings (prefix, configurations)\n' +
                '• User ID (for command execution only)\n' +
                '• Command usage (for functionality)\n' +
                '• Temporary queue data (deleted after playback)\n\n' +
                '**What We DON\'T Collect:**\n' +
                '❌ Message content (except direct commands)\n' +
                '❌ Personal information (names, emails)\n' +
                '❌ Voice recordings or audio data\n' +
                '❌ Private conversations or DMs\n\n' +
                '**Your Rights:**\n' +
                '• Access your server\'s stored data\n' +
                '• Delete data by removing the bot\n' +
                '• Opt-out anytime\n\n' +
                '**Data Storage:**\n' +
                '• Server settings: Firebase (persistent)\n' +
                '• Queue data: Temporary (auto-deleted)\n' +
                '• All data secured with industry standards\n\n' +
                '**Full Privacy Policy:**\n' +
                '[Read Complete Policy](https://github.com/your-repo/blob/main/PRIVACY_POLICY.md)\n\n' +
                '**Questions?** Contact us through our support server.'
            )
            .setFooter({ 
                text: 'Last Updated: October 13, 2025 | GDPR & Discord Compliant' 
            })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};
