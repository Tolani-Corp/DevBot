import {
  needsOnboarding,
  ensureWorkspace,
  completeOnboarding,
  getBotName,
  updateBotName,
  getOnboardingMessage,
  getNameConfirmationMessage,
  getHelpMessage,
} from "../src/services/onboarding.js";
import { db } from "../src/db/index.js";
import { workspaces } from "../src/db/schema.js";
import { eq } from "drizzle-orm";

console.log("🧪 DevBot Onboarding Test Suite\n");

// Test data
const testSlackTeam = "T123456789TEST";
const testDiscordGuild = "987654321TEST";

async function cleanup() {
  console.log("🧹 Cleaning up test data...");
  await db.delete(workspaces).where(eq(workspaces.slackTeamId, testSlackTeam));
  await db.delete(workspaces).where(eq(workspaces.discordGuildId, testDiscordGuild));
  console.log("✅ Cleanup complete\n");
}

async function testSlackOnboarding() {
  console.log("📱 Testing Slack Onboarding...\n");

  // Test 1: Check if onboarding needed for new workspace
  console.log("Test 1: Check onboarding needed");
  const needsOnboard = await needsOnboarding({
    platformType: "slack",
    teamId: testSlackTeam,
  });
  console.log(`  Needs onboarding: ${needsOnboard}`);
  if (!needsOnboard) throw new Error("Should need onboarding for new workspace");
  console.log("  ✅ PASS\n");

  // Test 2: Ensure workspace created
  console.log("Test 2: Create workspace");
  const workspace = await ensureWorkspace({
    platformType: "slack",
    teamId: testSlackTeam,
  });
  console.log(`  Workspace ID: ${workspace.id}`);
  console.log(`  Platform: ${workspace.platformType}`);
  console.log(`  Default name: ${workspace.botName}`);
  console.log(`  Onboarding complete: ${workspace.onboardingCompleted}`);
  if (workspace.botName !== "DevBot") throw new Error("Default name should be DevBot");
  if (workspace.onboardingCompleted) throw new Error("Should not be onboarded yet");
  console.log("  ✅ PASS\n");

  // Test 3: Complete onboarding with custom name
  console.log("Test 3: Complete onboarding with custom name 'Debo'");
  await completeOnboarding(
    {
      platformType: "slack",
      teamId: testSlackTeam,
    },
    "Debo"
  );
  const updatedWorkspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slackTeamId, testSlackTeam))
    .limit(1);
  console.log(`  Bot name: ${updatedWorkspace[0].botName}`);
  console.log(`  Bot mention: ${updatedWorkspace[0].botMention}`);
  console.log(`  Onboarding complete: ${updatedWorkspace[0].onboardingCompleted}`);
  if (updatedWorkspace[0].botName !== "Debo") throw new Error("Name should be Debo");
  if (!updatedWorkspace[0].onboardingCompleted) throw new Error("Should be onboarded");
  console.log("  ✅ PASS\n");

  // Test 4: Check onboarding no longer needed
  console.log("Test 4: Verify onboarding not needed after completion");
  const stillNeedsOnboard = await needsOnboarding({
    platformType: "slack",
    teamId: testSlackTeam,
  });
  console.log(`  Still needs onboarding: ${stillNeedsOnboard}`);
  if (stillNeedsOnboard) throw new Error("Should not need onboarding anymore");
  console.log("  ✅ PASS\n");

  // Test 5: Get bot name
  console.log("Test 5: Get bot name");
  const botName = await getBotName({
    platformType: "slack",
    teamId: testSlackTeam,
  });
  console.log(`  Bot name retrieved: ${botName}`);
  if (botName !== "Debo") throw new Error("Should return Debo");
  console.log("  ✅ PASS\n");

  // Test 6: Update bot name
  console.log("Test 6: Update bot name to 'CodeBuddy'");
  await updateBotName(
    {
      platformType: "slack",
      teamId: testSlackTeam,
    },
    "CodeBuddy"
  );
  const newName = await getBotName({
    platformType: "slack",
    teamId: testSlackTeam,
  });
  console.log(`  New bot name: ${newName}`);
  if (newName !== "CodeBuddy") throw new Error("Should return CodeBuddy");
  console.log("  ✅ PASS\n");

  console.log("✅ All Slack tests passed!\n");
}

async function testDiscordOnboarding() {
  console.log("🎮 Testing Discord Onboarding...\n");

  // Test 1: Complete onboarding with "keep DevBot"
  console.log("Test 1: Onboarding with 'keep DevBot'");
  await ensureWorkspace({
    platformType: "discord",
    guildId: testDiscordGuild,
  });
  await completeOnboarding(
    {
      platformType: "discord",
      guildId: testDiscordGuild,
    },
    "keep DevBot"
  );
  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.discordGuildId, testDiscordGuild))
    .limit(1);
  console.log(`  Bot name: ${workspace[0].botName}`);
  if (!workspace[0].botName.includes("DevBot")) throw new Error("Should keep DevBot");
  console.log("  ✅ PASS\n");

  console.log("✅ All Discord tests passed!\n");
}

async function testMessages() {
  console.log("💬 Testing Message Generation...\n");

  // Test onboarding message
  console.log("Test 1: Onboarding message");
  const onboardMsg = getOnboardingMessage();
  console.log("  Message preview:");
  console.log(onboardMsg.substring(0, 100) + "...");
  if (!onboardMsg.includes("DevBot")) throw new Error("Should mention DevBot");
  if (!onboardMsg.includes("call me whatever you like")) throw new Error("Should mention customization");
  console.log("  ✅ PASS\n");

  // Test confirmation message
  console.log("Test 2: Name confirmation message");
  const confirmMsg = getNameConfirmationMessage("Debo");
  console.log("  Message preview:");
  console.log(confirmMsg.substring(0, 100) + "...");
  if (!confirmMsg.includes("Debo")) throw new Error("Should mention custom name");
  console.log("  ✅ PASS\n");

  // Test help message
  console.log("Test 3: Help message with custom name");
  const helpMsg = getHelpMessage("CodeWizard");
  console.log("  Message preview:");
  console.log(helpMsg.substring(0, 100) + "...");
  if (!helpMsg.includes("CodeWizard")) throw new Error("Should mention custom name");
  console.log("  ✅ PASS\n");

  console.log("✅ All message tests passed!\n");
}

async function runTests() {
  try {
    console.log("=" .repeat(60));
    console.log("DevBot Personalization Feature Test Suite");
    console.log("=" .repeat(60) + "\n");

    // Cleanup before tests
    await cleanup();

    // Run test suites
    await testSlackOnboarding();
    await testDiscordOnboarding();
    await testMessages();

    // Cleanup after tests
    await cleanup();

    console.log("=" .repeat(60));
    console.log("🎉 ALL TESTS PASSED!");
    console.log("=" .repeat(60));
    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error);
    await cleanup();
    process.exit(1);
  }
}

// Run tests
runTests();
