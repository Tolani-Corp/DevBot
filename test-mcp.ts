import { mediaPlatform } from "./src/mcp/client.js";

async function testConnection() {
  try {
    await mediaPlatform.connect();
    
    console.log("\n--- Available Tools ---");
    const tools = await mediaPlatform.getTools();
    console.log(JSON.stringify(tools, null, 2));

    console.log("\n--- Available Resources ---");
    const resources = await mediaPlatform.getResources();
    console.log(JSON.stringify(resources, null, 2));

    console.log("\n--- Reading Platform README ---");
    const readme = await mediaPlatform.readResource("file:///platform_directory/README.md");
    console.log(readme.contents[0].text.substring(0, 200) + "...");

    await mediaPlatform.disconnect();
    console.log("\nDisconnected successfully.");
  } catch (error) {
    console.error("Connection failed:", error);
  }
}

testConnection();
