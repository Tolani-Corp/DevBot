# DevBot Personalization Guide

## Overview

DevBot now supports full personalization, allowing each workspace to customize the bot's name and create a unique experience. Users can choose any name they like, from simple nicknames like "Debo" to creative names like "CodeBuddy", "Builder", or "DevPal".

## First-Time Onboarding

When DevBot is first added to a Slack workspace or Discord server, it will introduce itself with a friendly onboarding message:

```
👋 Hi, I'm DevBot, but you can call me whatever you like!

I'm your autonomous AI software engineer. I can help you with:
• 🐛 Bug fixes and debugging
• ✨ New feature implementation
• 📝 Code reviews and suggestions
• 💬 Questions about your codebase
• 🔄 Automated pull requests

What would you like to call me?

You can keep "DevBot" or choose a custom name (like Debo, CodeBuddy, Builder, etc.). 
Just reply with your preferred name, or say "keep DevBot" to continue with the default.
```

## How to Set a Custom Name

### During Onboarding

1. **Mention the bot** for the first time: `@DevBot`
2. **Receive the onboarding message** with the introduction
3. **Reply with your preferred name**: 
   - Simple reply: `Debo`
   - Or keep default: `keep DevBot`
4. **Confirmation**: Bot will confirm the name change

### After Onboarding (Rename Anytime)

You can change the bot's name at any time:

1. **Mention the bot with rename command**: `@DevBot rename bot`
2. **Bot asks for new name**: "What would you like to call me instead of DevBot?"
3. **Reply with new name**: `CodeBuddy`
4. **Confirmation**: Bot adopts the new name

## Example Scenarios

### Scenario 1: Team "Alpha" Names Bot "Alpha-Dev"

```
User: @DevBot
DevBot: 👋 Hi, I'm DevBot, but you can call me whatever you like! ...

User: Alpha-Dev
Alpha-Dev: 🎉 Perfect! From now on, you can call me Alpha-Dev.
You can mention me anytime with @AlphaDev and I'll help you with your development tasks.

User: @AlphaDev fix the login bug
Alpha-Dev: 🤖 Got it! Working on this task...
```

### Scenario 2: Solo Developer Names Bot "Buddy"

```
User: @DevBot
DevBot: 👋 Hi, I'm DevBot, but you can call me whatever you like! ...

User: Buddy
Buddy: 🎉 Perfect! From now on, you can call me Buddy.
You can mention me anytime with @Buddy and I'll help you with your development tasks.

User: @Buddy add dark mode to the dashboard
Buddy: 🤖 Got it! Working on this task...
```

### Scenario 3: Team Wants to Keep Default

```
User: @DevBot
DevBot: 👋 Hi, I'm DevBot, but you can call me whatever you like! ...

User: keep DevBot
DevBot: 🎉 Perfect! From now on, you can call me DevBot.
You can mention me anytime with @DevBot and I'll help you with your development tasks.
```

### Scenario 4: Changing Name Later

```
User: @Debo rename bot
Debo: Sure! What would you like to call me instead of Debo?

User: CodeWizard
CodeWizard: 🎉 Perfect! From now on, you can call me CodeWizard.
You can mention me anytime with @CodeWizard and I'll help you with your development tasks.
```

## Technical Details

### Database Schema

The personalization feature uses a `workspaces` table:

```typescript
export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  
  // Platform identifiers
  slackTeamId: text("slack_team_id").unique(),
  discordGuildId: text("discord_guild_id").unique(),
  platformType: text("platform_type").notNull(),
  
  // Customization
  botName: text("bot_name").notNull().default("DevBot"),
  botMention: text("bot_mention"), // e.g., "@Debo"
  
  // Onboarding
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  
  // Settings
  settings: jsonb("settings"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### Onboarding Service API

Located in `src/services/onboarding.ts`:

```typescript
// Check if workspace needs onboarding
await needsOnboarding({ platformType: "slack", teamId });

// Complete onboarding with custom name
await completeOnboarding(
  { platformType: "slack", teamId },
  "Debo"
);

// Get current bot name
const name = await getBotName({ platformType: "slack", teamId });

// Update bot name
await updateBotName({ platformType: "slack", teamId }, "NewName");
```

### Platform Support

- ✅ **Slack**: Full support with workspace-level customization
- ✅ **Discord**: Full support with server-level customization
- 🚧 **VS Code Extension**: Coming soon
- 🚧 **GitHub Integration**: Coming soon

## Name Requirements

- **Minimum length**: 1 character
- **Maximum length**: 50 characters
- **Allowed characters**: Letters, numbers, spaces, hyphens, underscores
- **Special cases**: 
  - "keep DevBot" → Uses default name "DevBot"
  - Names are trimmed of leading/trailing spaces
  - Mention handle automatically generated (spaces removed)

## Best Practices

### For Teams

1. **Choose team-relevant names**: Align with team culture
2. **Keep it simple**: Easy to type and remember
3. **Avoid confusion**: Don't use names similar to team members
4. **Communicate the name**: Ensure all team members know the bot's custom name

### For Solo Developers

1. **Make it personal**: Choose a name you'll enjoy using
2. **Consider your workflow**: Use a name that fits your development style
3. **Test it out**: Try different names to find what feels right

## Custom Name Examples

**Professional:**
- `DevAssist`
- `CodeHelper`
- `BuildBot`
- `DeployBot`

**Team-Specific:**
- `AlphaDev` (for Team Alpha)
- `RocketBot` (for Rocket Team)
- `CoreDev` (for Core Team)

**Friendly:**
- `Buddy`
- `Sidekick`
- `Partner`
- `Pal`

**Creative:**
- `CodeWizard`
- `ByteBuddy`
- `StackOverflow` (Ironic!)
- `GitGuru`

**Short & Sweet:**
- `Dev`
- `Code`
- `Bot`
- `Debo`

## Future Enhancements

- 🔮 **Avatar customization**: Choose bot profile picture
- 🔮 **Personality settings**: Adjust bot's communication style
- 🔮 **Multiple personas**: Different names for different channels/contexts
- 🔮 **Voice customization**: For future voice integration
- 🔮 **Name history**: Track name changes over time
- 🔮 **Team voting**: Let team vote on bot name

## Troubleshooting

### Name Not Changing

**Problem**: Bot still responds to old name  
**Solution**: 
- Ensure you completed the name change confirmation
- Check database: `SELECT * FROM workspaces;`
- Restart bot if needed

### Onboarding Message Not Appearing

**Problem**: No onboarding prompt on first mention  
**Solution**:
- Check if workspace already exists in database
- Manually trigger: `@DevBot rename bot`

### Custom Mention Not Working

**Problem**: `@CustomName` doesn't trigger bot  
**Solution**:
- Use native platform mention (Slack: `@DevBot`, Discord: mention with @)
- Custom mentions are for display only; bot responds to native platform mentions

## Migration Guide

### Existing Workspaces

For workspaces that already have DevBot installed before this feature:

1. Bot will continue working with default name "DevBot"
2. No onboarding prompt will appear (already in use)
3. To customize: Use `@DevBot rename bot` command
4. First rename will complete onboarding process

### Database Migration

Run the migration to add the workspaces table:

```bash
npm run db:migrate
```

Or manually apply:

```sql
-- See drizzle/0001_add_workspaces.sql
```

## API Reference

### `needsOnboarding(options)`

Check if workspace needs onboarding.

**Parameters:**
- `options.platformType`: "slack" | "discord" | "vscode"
- `options.teamId`: Slack team ID (if Slack)
- `options.guildId`: Discord guild ID (if Discord)

**Returns:** `Promise<boolean>`

### `completeOnboarding(options, customName)`

Complete onboarding and set custom bot name.

**Parameters:**
- `options`: Platform options (same as above)
- `customName`: String (1-50 characters)

**Returns:** `Promise<void>`

### `getBotName(options)`

Get current bot name for workspace.

**Parameters:**
- `options`: Platform options

**Returns:** `Promise<string>`

### `updateBotName(options, newName)`

Update bot name for workspace.

**Parameters:**
- `options`: Platform options
- `newName`: String (1-50 characters)

**Returns:** `Promise<void>`

## Support

For issues or questions about bot personalization:

1. **Documentation**: Check this guide
2. **GitHub Issues**: Open issue in DevBot repository
3. **Slack**: Message in #devbot-support channel
4. **Email**: support@tolani-labs.com

---

**Version**: 1.0.0  
**Last Updated**: 2026-02-13  
**Maintained by**: Tolani Labs / funbot team
