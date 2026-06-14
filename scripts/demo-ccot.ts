#!/usr/bin/env node
import { createCCOTDemoPackets, formatCCOTMarkdown } from "../src/reasoning/index.js";

const packets = createCCOTDemoPackets();
for (const [index, packet] of packets.entries()) {
  if (index > 0) console.log("\n" + "=".repeat(80) + "\n");
  console.log(`Packet: ${packet.id} (${packet.kind})`);
  console.log("");
  console.log(formatCCOTMarkdown(packet.analysis));
}
