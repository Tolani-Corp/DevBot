# DevBot Personalization - Quick Reference

## Setup (First Time)

```
@DevBot
→ "Hi! I'm DevBot, but you can call me whatever you like..."
→ Reply: "Debo" (or any name)
→ "Perfect! From now on, you can call me Debo"
```

## Change Name Anytime

```
@YourBotName rename bot
→ "What would you like to call me instead of YourBotName?"
→ Reply: "NewName"
→ "Perfect! From now on, you can call me NewName"
```

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `@DevBot` | First mention triggers onboarding | Initial setup |
| `@BotName rename bot` | Change bot name | Rename anytime |
| `@BotName` (empty) | Show help with current name | Get started |

## Name Examples

**Professional**: DevAssist, CodeHelper, BuildBot  
**Team**: AlphaDev, RocketBot, CoreDev  
**Friendly**: Buddy, Sidekick, Partner  
**Creative**: CodeWizard, ByteBuddy, GitGuru  
**Short**: Dev, Code, Debo

## Platform Support

- ✅ Slack (workspace-level)
- ✅ Discord (server-level)
- 🚧 VS Code (coming soon)

## Name Rules

- 1-50 characters
- Letters, numbers, spaces, hyphens, underscores
- Special: "keep DevBot" = default name

## Flow Diagram

```
Install DevBot
    ↓
First @mention
    ↓
Onboarding Message
    ↓
User replies with name
    ↓
Name confirmed & saved
    ↓
Bot uses custom name
    
    (Later) @BotName rename bot
        ↓
    New name request
        ↓
    User replies with new name
        ↓
    Name updated
```

## Technical

**Database**: `workspaces` table  
**Service**: `src/services/onboarding.ts`  
**Migration**: `drizzle/0001_add_workspaces.sql`

## Docs

Full documentation: [DEVBOT_PERSONALIZATION_GUIDE.md](./DEVBOT_PERSONALIZATION_GUIDE.md)
