import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { orchestrate } from "../src/agents/orchestrator.js";

const STUDIO_UPLOADS_DIR = "D:\\ingest\\Editor_vids\\Studio Uploads";
const REPOSITORY = "freakme.fun";

async function main() {
  try {
    const models = await fs.readdir(STUDIO_UPLOADS_DIR);
    
    for (const modelDir of models) {
      const modelPath = path.join(STUDIO_UPLOADS_DIR, modelDir);
      const stat = await fs.stat(modelPath);
      
      if (stat.isDirectory()) {
        // Try to extract a better model name from the files inside
        const files = await fs.readdir(modelPath);
        let modelName = modelDir;
        
        if (files.length > 0) {
          // Use the first file's name (without extension) as a hint if it's not just "modelX"
          const firstFile = files[0];
          const nameWithoutExt = path.parse(firstFile).name;
          // Remove numbers at the end if any (e.g., "Brazilian Barbie2" -> "Brazilian Barbie")
          const cleanName = nameWithoutExt.replace(/\d+$/, '').trim();
          if (cleanName && cleanName.toLowerCase() !== modelDir.toLowerCase()) {
            modelName = cleanName;
          }
        }
        
        console.log(`\n==================================================`);
        console.log(`Generating marketing landing page for: ${modelName} (Dir: ${modelDir})`);
        console.log(`==================================================\n`);
        
        const description = `Create a marketing landing page React component for the model "${modelName}". 
The component should be saved in 'freakme_app/app/src/pages/models/${modelDir}.tsx'. 
It should include:
1. A hero section with a placeholder for the model's main image.
2. A gallery section with placeholders for additional images.
3. A call to action (CTA) section to subscribe to the model's content.
4. Use Tailwind CSS for styling.
5. Follow the existing project conventions (e.g., using Lucide React icons if needed).
6. Export the component as default.`;

        try {
          const result = await orchestrate(description, REPOSITORY, {});
          
          // Write changes to disk
          for (const change of result.changes) {
            const fullPath = path.join("C:\\Users\\terri\\Projects\\freakme.fun", change.file);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, change.content, "utf-8");
            console.log(`Wrote file: ${fullPath}`);
          }
          
          console.log(`\n✅ Successfully generated landing page for ${modelName}`);
          console.log(`Commit Message: ${result.commitMessage}`);
        } catch (error) {
          console.error(`\n❌ Failed to generate landing page for ${modelName}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Error reading Studio Uploads directory:", error);
  }
}

main().catch(console.error);
