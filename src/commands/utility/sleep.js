const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');

const activeSleepTimers = new Map();

module.exports = {
    name: 'sleep',
    category: 'utility',
    aliases: ['sl'],
    description: 'Set a sleep timer - music continues playing until timer ends',
    async execute(client, message, args) {
        const player = client.manager.get(message.guild.id);

        if (!player || !player.playing) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Nothing is currently playing.`);
            
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

        if (!args.length) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('💤 Sleep Timer Command')
                .setDescription('Set a sleep timer - music continues playing until timer ends.')
                .addFields(
                    { name: 'Usage', value: '`!sleep <time>` or `!sl <time>`', inline: false },
                    { name: 'Time Format', value: 'Add a number followed by:\n`s` - seconds\n`m` - minutes\n`h` - hours', inline: false },
                    { name: 'Examples', value: '`!sleep 30s` - Sleep for 30 seconds\n`!sleep 10m` - Sleep for 10 minutes\n`!sleep 1h` - Sleep for 1 hour', inline: false },
                    { name: 'How it works', value: 'Music continues playing. 30 seconds before time ends, you\'ll get a prompt to continue or stop.', inline: false }
                );
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime * 2);
            return;
        }

        if (activeSleepTimers.has(message.guild.id)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} A sleep timer is already active for this server.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const timeArg = args[0].toLowerCase();
        const timeRegex = /^(\d+)(s|m|h)$/;
        const match = timeArg.match(timeRegex);

        if (!match) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Invalid time format. Use: \`<number><s|m|h>\`\nExample: \`30s\`, \`10m\`, \`1h\``);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const amount = parseInt(match[1]);
        const unit = match[2];

        let milliseconds;
        let displayTime;

        switch (unit) {
            case 's':
                if (amount < 30) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Minimum sleep time is 30 seconds.`);
                    
                    const reply = await message.reply({ embeds: [embed] });
                    safeDeleteMultiple([reply], config.autoDeleteTime);
                    return;
                }
                if (amount > 3600) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Maximum sleep time is 1 hour (3600 seconds).`);
                    
                    const reply = await message.reply({ embeds: [embed] });
                    safeDeleteMultiple([reply], config.autoDeleteTime);
                    return;
                }
                milliseconds = amount * 1000;
                displayTime = `${amount} second${amount !== 1 ? 's' : ''}`;
                break;
            case 'm':
                if (amount > 60) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Maximum sleep time is 1 hour (60 minutes).`);
                    
                    const reply = await message.reply({ embeds: [embed] });
                    safeDeleteMultiple([reply], config.autoDeleteTime);
                    return;
                }
                milliseconds = amount * 60 * 1000;
                displayTime = `${amount} minute${amount !== 1 ? 's' : ''}`;
                break;
            case 'h':
                if (amount > 1) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Maximum sleep time is 1 hour.`);
                    
                    const reply = await message.reply({ embeds: [embed] });
                    safeDeleteMultiple([reply], config.autoDeleteTime);
                    return;
                }
                milliseconds = amount * 60 * 60 * 1000;
                displayTime = `${amount} hour${amount !== 1 ? 's' : ''}`;
                break;
        }

        const sleepEmbed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`💤 **Sleep timer activated**\nMusic will continue playing for ${displayTime}.\nYou'll receive a prompt 30 seconds before time ends.`);
        
        const reply = await message.reply({ embeds: [sleepEmbed] });
        safeDeleteMultiple([reply], config.autoDeleteTime);

        const promptTime = Math.max(milliseconds - 30000, 0);
        
        const promptTimer = setTimeout(async () => {
            const currentPlayer = client.manager.get(message.guild.id);
            if (!currentPlayer) {
                activeSleepTimers.delete(message.guild.id);
                return;
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`sleep_continue_${message.guild.id}`)
                        .setLabel('Continue Playing')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(`sleep_stop_${message.guild.id}`)
                        .setLabel('Stop & Leave')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                );

            const promptEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`⏰ **Sleep timer ending soon!**\nDo you want to continue playing music?`);

            const promptMsg = await message.channel.send({ 
                embeds: [promptEmbed], 
                components: [row] 
            });

            const collector = promptMsg.createMessageComponentCollector({
                time: 30000
            });

            let responded = false;

            collector.on('collect', async (interaction) => {
                if (interaction.user.id !== message.author.id) {
                    await interaction.reply({ 
                        content: 'Only the person who set the timer can respond to this.', 
                        flags: MessageFlags.Ephemeral 
                    });
                    return;
                }

                responded = true;
                collector.stop();

                if (interaction.customId === `sleep_continue_${message.guild.id}`) {
                    const continueEmbed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`✅ **Sleep timer cancelled**\nMusic will continue playing.`);

                    await interaction.update({ embeds: [continueEmbed], components: [row] });
                    activeSleepTimers.delete(message.guild.id);
                } else {
                    const stopPlayer = client.manager.get(message.guild.id);
                    if (stopPlayer) {
                        stopPlayer.destroy();
                    }

                    const stopEmbed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`😴 Success! Sleep time is completed. I am leaving now.`);

                    await interaction.update({ embeds: [stopEmbed], components: [row] });
                    activeSleepTimers.delete(message.guild.id);
                }
            });

            collector.on('end', async () => {
                if (!responded) {
                    const timeoutPlayer = client.manager.get(message.guild.id);
                    if (timeoutPlayer) {
                        timeoutPlayer.destroy();
                    }

                    const timeoutEmbed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`😴 Success! Sleep time is completed. I am leaving now.`);

                    await promptMsg.edit({ embeds: [timeoutEmbed], components: [row] });
                    activeSleepTimers.delete(message.guild.id);
                }
            });
        }, promptTime);

        activeSleepTimers.set(message.guild.id, { promptTimer, userId: message.author.id });
    }
};
