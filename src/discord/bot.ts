import { Client, GatewayIntentBits, Events, Message } from 'discord.js';
import { answerQuestion } from '../ai/claude';
import { postTweet } from '../twitter/bot';
import {
  needsOnboarding,
  ensureWorkspace,
  completeOnboarding,
  getBotName,
  updateBotName,
  getOnboardingMessage,
  getNameConfirmationMessage,
  getHelpMessage,
} from '@/services/onboarding';
import {
    parseMentionCommand,
    formatMentionCommandResponse,
} from '@/services/mention-parser';
import { executeLiveMentionCommand } from '@/services/live-mentions';
import {
    createFeedbackTicket,
    getFeedbackTicket,
    updateFeedbackStatus,
    formatFeedbackTicketReceipt,
    formatFeedbackTicketStatus,
} from '@/services/feedback-loop';

// Store pending onboarding and rename states
const pendingOnboarding = new Set<string>();
const pendingRename = new Set<string>();

/**
 * Check if a message is a reply to one of the bot's messages
 */
async function isReplyToBotMessage(message: Message, client: Client): Promise<boolean> {
    if (!message.reference?.messageId) return false;

    try {
        // Fetch the referenced message
        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);

        // Check if the referenced message is from the bot
        return referencedMessage.author.id === client.user!.id;
    } catch (error) {
        // If we can't fetch the message, assume it's not a reply to the bot
        console.warn('Failed to fetch referenced message:', error);
        return false;
    }
}

export function startDiscordBot(token: string) {
    console.log('🤖 Starting Discord bot...');

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
    });

    client.once(Events.ClientReady, (c) => {
        console.log(`✅ Ready! Logged in as ${c.user.tag}`);
    });

    client.on('error', (error) => {
        console.error('❌ Discord client error:', error);
    });

    client.on('disconnect', () => {
        console.log('🔌 Discord bot disconnected');
    });

    // Login with error handling
    client.login(token).catch((error) => {
        console.error('❌ Failed to login to Discord:', error);
    });

    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot) return;

        const guildId = message.guildId;
        if (!guildId) return;

        const containsAgentAlias = /(^|\s)@(shark|ace|ice|linemd)\b|^\/?(shark|ace|ice|linemd)\/picks\//i.test(message.content.trim());

        // Check if the bot is mentioned OR if this is a reply to the bot
        const isReplyToBot = message.reference?.messageId ? await isReplyToBotMessage(message, client) : false;
        const shouldRespond = message.mentions.has(client.user!.id) || containsAgentAlias || isReplyToBot;

        if (shouldRespond) {
            try {
                // Check if onboarding is needed
                const requiresOnboarding = await needsOnboarding({
                    platformType: 'discord',
                    guildId,
                });

                if (requiresOnboarding) {
                    await ensureWorkspace({
                        platformType: 'discord',
                        guildId,
                    });
                    
                    pendingOnboarding.add(guildId);
                    await message.reply(getOnboardingMessage());
                    return;
                }

                // Get custom bot name for this server
                const botName = await getBotName({
                    platformType: 'discord',
                    guildId,
                });

                const content = message.content.replace(/<@\d+>/g, '').trim();

                // Check for rename command
                if (content.toLowerCase().includes('rename bot') || content.toLowerCase().includes('change name')) {
                    pendingRename.add(guildId);
                    await message.reply(`Sure! What would you like to call me instead of **${botName}**? Just reply with your preferred name.`);
                    return;
                }

                if (!content) {
                    await message.reply(getHelpMessage(botName));
                    return;
                }

                if (content.toLowerCase() === 'feedback help') {
                    await message.reply(
                        "📝 Feedback commands:\n" +
                        "• @feedback, I requested a weather report for pick #4535 and it returned 'no data'.\n" +
                        "• @feedback, I did not receive my free picks from gamecade.\n" +
                        "• /feedback <issue>\n" +
                        "• /feedback/status/<feedback_id>"
                    );
                    return;
                }

                const mentionCommand = parseMentionCommand(content);
                if (mentionCommand.kind !== 'unknown') {
                    if (mentionCommand.kind === 'feedback_report') {
                        const ticket = await createFeedbackTicket({
                            text: mentionCommand.feedbackText?.trim() || mentionCommand.normalized || 'No feedback details provided.',
                            context: {
                                platformType: 'discord',
                                discordGuildId: guildId,
                                channelId: message.channelId,
                                threadTs: message.id,
                                reporterId: message.author.id,
                            },
                        });
                        await message.reply(formatFeedbackTicketReceipt(ticket));
                        return;
                    }

                    if (mentionCommand.kind === 'feedback_status') {
                        const ticket = await getFeedbackTicket(mentionCommand.feedbackId ?? '');
                        await message.reply(
                            ticket
                                ? formatFeedbackTicketStatus(ticket)
                                : `❌ Feedback ticket \`${mentionCommand.feedbackId ?? 'UNKNOWN'}\` was not found.`
                        );
                        return;
                    }

                    if (mentionCommand.kind === 'feedback_update') {
                        const feedbackId = mentionCommand.feedbackId ?? '';
                        const targetStatus = mentionCommand.feedbackStatus;
                        if (!feedbackId || !targetStatus) {
                            await message.reply('❌ Feedback update requires both feedback ID and status.');
                            return;
                        }

                        const updated = await updateFeedbackStatus({
                            feedbackId,
                            status: targetStatus,
                            resolutionNote:
                                targetStatus === 'resolved'
                                    ? 'Resolved via Discord mention feedback command.'
                                    : `Moved to ${targetStatus} via Discord mention feedback command.`,
                        });

                        await message.reply(
                            updated
                                ? `✅ Updated **${updated.id}** to **${updated.status}**.`
                                : `❌ Feedback ticket \`${feedbackId}\` was not found.`
                        );
                        return;
                    }

                    const liveResponse = await executeLiveMentionCommand(mentionCommand);
                    if (liveResponse) {
                        await message.reply(liveResponse);
                        return;
                    }

                    await message.reply(formatMentionCommandResponse(mentionCommand, botName));
                    return;
                }

                // Command: !tweet [content]
                if (content.includes('!tweet')) {
                    const tweetContent = content.replace('!tweet', '').trim();
                    if (!tweetContent) {
                        await message.reply("❌ Usage: `@" + botName.replace(/\s+/g, "") + " !tweet Hello world`");
                        return;
                    }
                    const result = await postTweet(tweetContent);
                    if (result?.success) {
                        await message.reply(`✅ Tweet posted!`);
                    } else {
                        await message.reply(`❌ Failed to post tweet. Check logs.`);
                    }
                    return;
                }

                // Command: !pentest [target] [--type=scan_type]
                if (content.includes('!pentest')) {
                    const args = content.replace('!pentest', '').trim().split(/\s+/);
                    
                    if (args.length === 0 || !args[0]) {
                        await message.reply(`🔒 **DevBot Security Scanner**

**Usage:** \`@${botName} !pentest <target> [--type=scan_type]\`

**Scan Types:**
• \`full\` - Complete security assessment (default)
• \`dependency-audit\` - Check for vulnerable dependencies
• \`secret-scan\` - Detect leaked credentials
• \`web-security\` - HTTP security headers & TLS
• \`port-scan\` - Network port enumeration

**Examples:**
• \`@${botName} !pentest freakme.fun\`
• \`@${botName} !pentest freakme.fun --type=web-security\`

⚠️ Only scan targets you have authorization to test`);
                        return;
                    }

                    const target = args[0];
                    let scanType: "full" | "dependency-audit" | "secret-scan" | "web-security" | "port-scan" = "full";

                    // Parse --type flag
                    for (const arg of args.slice(1)) {
                        if (arg.startsWith('--type=')) {
                            const type = arg.replace('--type=', '');
                            if (['full', 'dependency-audit', 'secret-scan', 'web-security', 'port-scan'].includes(type)) {
                                scanType = type as typeof scanType;
                            }
                        }
                    }

                    try {
                        const { runPentestScan } = await import('@/services/pentest');
                        
                        await message.reply(`🔒 Starting ${scanType} scan on \`${target}\`...`);

                        const report = await runPentestScan(target, scanType, {
                            authorized: true,
                        });

                        const emoji = {
                            critical: '🔴',
                            high: '🟠',
                            medium: '🟡',
                            low: '🟢',
                            clean: '✅',
                        }[report.summary.riskRating];

                        const summary = `${emoji} **Security Scan Complete**

**Target:** \`${report.target}\`
**Risk Rating:** ${report.summary.riskRating.toUpperCase()} (Score: ${report.summary.riskScore}/100)

**Findings:**
• Critical: ${report.summary.criticalCount}
• High: ${report.summary.highCount}
• Medium: ${report.summary.mediumCount}
• Low: ${report.summary.lowCount}

**Top Recommendation:** ${report.summary.topRecommendation}

🤖 **AI Analysis:**
${report.aiAnalysis.slice(0, 1500)}${report.aiAnalysis.length > 1500 ? '...' : ''}

_Scan ID: ${report.scanId}_`;

                        await message.reply(summary);
                    } catch (error) {
                        console.error('Discord pentest error:', error);
                        await message.reply(`❌ Scan failed: ${error instanceof Error ? error.message : String(error)}`);
                    }
                    return;
                }

                const response = await answerQuestion(content);
                await message.reply(response || "I'm sorry, I couldn't process that request.");
            } catch (error) {
                console.error('Error handling message:', error);
                await message.reply('An error occurred while processing your request.');
            }
        } else {
            // Check if this is a response to onboarding or rename prompt
            if (pendingOnboarding.has(guildId)) {
                const customName = message.content.trim();
                
                if (customName && customName.length > 0 && customName.length <= 50) {
                    const finalName = customName.toLowerCase().includes('keep') ? 'DevBot' : customName;
                    
                    await completeOnboarding(
                        {
                            platformType: 'discord',
                            guildId,
                        },
                        finalName
                    );
                    
                    pendingOnboarding.delete(guildId);
                    await message.reply(getNameConfirmationMessage(finalName));
                } else {
                    await message.reply("Please provide a valid name (1-50 characters) or say 'keep DevBot' to use the default name.");
                }
                return;
            }

            if (pendingRename.has(guildId)) {
                const customName = message.content.trim();
                
                if (customName && customName.length > 0 && customName.length <= 50) {
                    await updateBotName(
                        {
                            platformType: 'discord',
                            guildId,
                        },
                        customName
                    );
                    
                    pendingRename.delete(guildId);
                    await message.reply(getNameConfirmationMessage(customName));
                } else {
                    await message.reply("Please provide a valid name (1-50 characters).");
                }
                return;
            }
        }
    });

    client.login(token).catch(err => console.error("Discord login failed:", err));
}
