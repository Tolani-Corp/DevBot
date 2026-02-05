import fs from "fs/promises";
import path from "path";
import { ragEngine } from "../ai/rag.js"; // Explicit extension
import { glob } from "glob";

const IGNORE_PATTERNS = [
    "**/node_modules/**",
    "**/dist/**",
    "**/.git/**",
    "**/*.lock",
    "**/*.png",
    "**/*.jpg",
    "**/*.mp4",
    "**/*.pdf",
    "**/.DS_Store",
];

async function indexRepo(repoPath: string, repoName: string) {
    console.log(`Indexing repository: ${repoName} at ${repoPath}`);

    // Find all files
    const files = await glob("**/*", {
        cwd: repoPath,
        ignore: IGNORE_PATTERNS,
        nodir: true,
    });

    console.log(`Found ${files.length} files to index.`);

    let processed = 0;
    for (const file of files) {
        const filePath = path.join(repoPath, file);
        try {
            const content = await fs.readFile(filePath, "utf-8");

            // Skip empty or very large files
            if (!content.trim() || content.length > 500000) {
                continue;
            }

            await ragEngine.indexFile(repoName, file, content);
            processed++;

            if (processed % 10 === 0) {
                console.log(`Progress: ${processed}/${files.length}`);
            }
        } catch (err) {
            console.error(`Failed to index ${file}:`, err);
        }
    }

    console.log(`Indexing complete! Processed ${processed} files.`);
}

// CLI usage: tsx src/scripts/index-repo.ts <path-to-repo> <repo-name>
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Usage: tsx src/scripts/index-repo.ts <path-to-repo> <repo-name>");
    process.exit(1);
}

const [targetPath, targetName] = args;
indexRepo(path.resolve(targetPath), targetName).catch(console.error);
