import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(sourceDir, "..", "..", "..");
const outputDir = path.join(
  repoRoot,
  "output",
  "demo-video-series",
  "debo-student-terminal",
);

async function readText(relativePath) {
  return readFile(path.join(sourceDir, relativePath), "utf8");
}

function compactEpisodeForAgent(series, episode, script, snapshot) {
  return {
    series: {
      id: series.id,
      title: series.title,
      tagline: series.tagline,
      brand: series.brand,
      format: series.format,
    },
    episode: {
      id: episode.id,
      title: episode.title,
      runtimeSeconds: episode.runtimeSeconds,
      hook: episode.hook,
      cta: episode.cta,
    },
    productionContext: {
      visualSystem: series.visualSystem,
      voiceover: series.voiceover,
      safety: series.safety,
    },
    source: {
      scriptMarkdown: script,
      terminalSnapshotMarkdown: snapshot,
    },
    buildInstructions: [
      "Render a dark DEBO terminal with a bright green blinking cursor.",
      "Use synthetic data exactly as provided in the terminal snapshot.",
      "Keep commands readable for a YouTube viewer on mobile.",
      "Do not add secrets, real customer names, private IP addresses, or live targets.",
      "Keep high-risk/security/release claims qualified and human-review aware.",
    ],
  };
}

async function main() {
  const context = JSON.parse(await readText("video-agent-context.json"));
  await mkdir(outputDir, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "docs/demo-video-series/debo-student-terminal/video-agent-context.json",
    packets: [],
  };

  for (const episode of context.episodes) {
    const script = await readText(episode.script);
    const snapshot = await readText(episode.snapshot);
    const packet = compactEpisodeForAgent(context.series, episode, script, snapshot);
    const jsonName = `${episode.id}.video-agent.json`;
    const mdName = `${episode.id}.editor-packet.md`;

    await writeFile(
      path.join(outputDir, jsonName),
      `${JSON.stringify(packet, null, 2)}\n`,
      "utf8",
    );

    await writeFile(
      path.join(outputDir, mdName),
      [
        `# ${episode.title}`,
        "",
        `Series: ${context.series.title}`,
        `Runtime: ${episode.runtimeSeconds} seconds`,
        "",
        "## Hook",
        "",
        episode.hook,
        "",
        "## Script",
        "",
        script,
        "",
        "## Terminal Snapshot",
        "",
        snapshot,
        "",
        "## Video Agent Safety",
        "",
        "- Use synthetic data only.",
        "- Keep security scenes authorized, scoped, and non-destructive.",
        "- Do not imply deployment or release approval unless the transcript says so.",
      ].join("\n"),
      "utf8",
    );

    manifest.packets.push({
      episodeId: episode.id,
      title: episode.title,
      json: path.posix.join("output/demo-video-series/debo-student-terminal", jsonName),
      markdown: path.posix.join("output/demo-video-series/debo-student-terminal", mdName),
    });
  }

  await writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(`Wrote ${manifest.packets.length} DEBO student terminal video packets to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
