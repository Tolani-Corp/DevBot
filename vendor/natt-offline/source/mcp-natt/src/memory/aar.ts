import * as fs from "fs/promises";
import * as path from "path";
import { AAR } from "../testing/e2e-schemas.js";

const MEMORY_DIR = path.join(process.cwd(), ".natt-memory");
const AAR_FILE = path.join(MEMORY_DIR, "aar-history.json");
const WEIGHTS_FILE = path.join(MEMORY_DIR, "algorithm-weights.json");

export async function initAAR() {
  await fs.mkdir(MEMORY_DIR, { recursive: true });
  try { await fs.access(AAR_FILE); } catch { await fs.writeFile(AAR_FILE, JSON.stringify([])); }
  try { await fs.access(WEIGHTS_FILE); } catch { await fs.writeFile(WEIGHTS_FILE, JSON.stringify({})); }
}

export async function submitAAR(report: AAR) {
  await initAAR();
  
  // Save report
  const data = await fs.readFile(AAR_FILE, "utf-8");
  const history: AAR[] = JSON.parse(data);
  history.push(report);
  await fs.writeFile(AAR_FILE, JSON.stringify(history, null, 2));
  
  // Update weights
  const weightsData = await fs.readFile(WEIGHTS_FILE, "utf-8");
  const weights: Record<string, number> = JSON.parse(weightsData);
  
  for (const [key, adjustment] of Object.entries(report.algorithmAdjustments)) {
    weights[key] = (weights[key] || 1.0) * adjustment;
  }
  
  await fs.writeFile(WEIGHTS_FILE, JSON.stringify(weights, null, 2));
  return weights;
}

export async function getAlgorithmWeights() {
  await initAAR();
  const weightsData = await fs.readFile(WEIGHTS_FILE, "utf-8");
  return JSON.parse(weightsData);
}
