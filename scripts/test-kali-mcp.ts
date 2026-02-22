#!/usr/bin/env tsx
/**
 * Kali MCP Server Test Script
 * 
 * Tests the Kali pentest MCP server integration
 * 
 * Usage:
 *   npx tsx scripts/test-kali-mcp.ts
 */

import { spawn } from "child_process";
import path from "path";

const MCP_SERVER_PATH = path.join(__dirname, "../../freakme.fun/mcp-pentest/dist/index.js");

console.log(`🔧 Testing Kali Pentest MCP Server\n`);
console.log(`Server: ${MCP_SERVER_PATH}\n`);

// Start the MCP server
const server = spawn("node", [MCP_SERVER_PATH], {
  stdio: ["pipe", "pipe", "pipe"],
});

let responseBuffer = "";

server.stdout.on("data", (data) => {
  responseBuffer += data.toString();
});

server.stderr.on("data", (data) => {
  console.error(`Server Error: ${data}`);
});

// Test 1: List available tools
setTimeout(() => {
  console.log(`📋 Test 1: Listing available tools\n`);
  const listToolsRequest = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  }) + "\n";

  server.stdin.write(listToolsRequest);

  setTimeout(() => {
    try {
      const lines = responseBuffer.split("\n").filter((l) => l.trim());
      const response = JSON.parse(lines[lines.length - 1]);
      
      if (response.result?.tools) {
        console.log(`✅ Found ${response.result.tools.length} tools:\n`);
        response.result.tools.forEach((tool: any) => {
          console.log(`   • ${tool.name}: ${tool.description.slice(0, 80)}...`);
        });
        console.log();
      } else {
        console.error(`❌ No tools found in response`);
      }
    } catch (error) {
      console.error(`❌ Failed to parse response:`, error);
    }

    responseBuffer = "";

    // Test 2: Search for tools
    setTimeout(() => {
      console.log(`🔍 Test 2: Searching for "nmap" tools\n`);
      const searchRequest = JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "search_kali_tools",
          arguments: {
            query: "nmap",
          },
        },
      }) + "\n";

      server.stdin.write(searchRequest);

      setTimeout(() => {
        try {
          const lines = responseBuffer.split("\n").filter((l) => l.trim());
          const response = JSON.parse(lines[lines.length - 1]);
          
          if (response.result?.content?.[0]?.text) {
            console.log(`✅ Search results:\n`);
            console.log(response.result.content[0].text.slice(0, 500) + "...\n");
          } else {
            console.error(`❌ No search results`);
          }
        } catch (error) {
          console.error(`❌ Failed to parse search response:`, error);
        }

        responseBuffer = "";

        // Test 3: Get pentest methodology
        setTimeout(() => {
          console.log(`📖 Test 3: Getting pentest methodology\n`);
          const methodologyRequest = JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
              name: "get_pentest_methodology",
              arguments: {},
            },
          }) + "\n";

          server.stdin.write(methodologyRequest);

          setTimeout(() => {
            try {
              const lines = responseBuffer.split("\n").filter((l) => l.trim());
              const response = JSON.parse(lines[lines.length - 1]);
              
              if (response.result?.content?.[0]?.text) {
                const methodology = response.result.content[0].text;
                console.log(`✅ Retrieved methodology (${methodology.length} chars)\n`);
                console.log(methodology.slice(0, 400) + "...\n");
              } else {
                console.error(`❌ No methodology found`);
              }
            } catch (error) {
              console.error(`❌ Failed to parse methodology response:`, error);
            }

            // Cleanup
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            console.log(`✅ All tests complete!\n`);
            server.kill();
            process.exit(0);
          }, 1000);
        }, 1000);
      }, 1000);
    }, 1000);
  }, 1000);
}, 500);

server.on("error", (error) => {
  console.error(`❌ Failed to start MCP server:`, error);
  process.exit(1);
});

// Timeout after 15 seconds
setTimeout(() => {
  console.error(`❌ Tests timed out`);
  server.kill();
  process.exit(1);
}, 15000);
