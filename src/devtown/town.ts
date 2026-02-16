// ──────────────────────────────────────────────────────────────
// DevTown — Town Manager
// Top-level entry point for initializing and managing a DevTown
// workspace. Equivalent to `gt install` / `gt status` in Gas Town.
// ──────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { nanoid } from "nanoid";
import type {
  Town,
  TownConfig,
  TownStatus,
  Rig,
  RigSettings,
  RigStatus,
  AgentRuntime,
  MEOWResult,
} from "./types.js";
import { AgentRegistry, createDevBotRuntime } from "./registry.js";
import { ConvoyStore } from "./convoy.js";
import { FleetManager, type FleetConfig } from "./fleet.js";
import { Mayor } from "./mayor.js";
import { discoverHooks, repairHooks } from "./hooks.js";

// ─── Constants ────────────────────────────────────────────────

const TOWN_DIR = ".devtown";
const TOWN_CONFIG_FILE = "town.json";
const DEFAULT_CONFIG: TownConfig = {
  maxPolecats: 10,
  defaultRuntime: {
    provider: "devbot",
    model: "claude-sonnet-4-20250514",
    enableRag: true,
    enableHealthScan: true,
    enablePrReview: true,
  },
  autoScale: true,
  sharedRag: true,
  redevelopment: {
    maxRetries: 3,
    verifyAfterMerge: true,
    autoFix: true,
  },
  dashboardPort: 0,
};

// ─── Serializable Config ──────────────────────────────────────

interface TownManifest {
  id: string;
  name: string;
  rootPath: string;
  config: TownConfig;
  rigs: RigManifest[];
  createdAt: string;
  status: TownStatus;
}

interface RigManifest {
  id: string;
  name: string;
  repoUrl: string;
  localPath: string;
  defaultBranch: string;
  settings: RigSettings;
}

// ─── Town Manager ─────────────────────────────────────────────

export class TownManager {
  private town: Town;
  private registry: AgentRegistry;
  private store: ConvoyStore;
  private fleet: FleetManager;
  private mayor: Mayor;

  private constructor(
    town: Town,
    registry: AgentRegistry,
    store: ConvoyStore,
    fleet: FleetManager,
    mayor: Mayor,
  ) {
    this.town = town;
    this.registry = registry;
    this.store = store;
    this.fleet = fleet;
    this.mayor = mayor;
  }

  // ─── Lifecycle ─────────────────────────────────────

  /**
   * Initialize a new DevTown workspace.
   * Creates `.devtown/` directory and `town.json` manifest.
   */
  static install(
    rootPath: string,
    name?: string,
    config?: Partial<TownConfig>,
  ): TownManager {
    const townDir = join(rootPath, TOWN_DIR);
    if (!existsSync(townDir)) {
      mkdirSync(townDir, { recursive: true });
    }

    // Create hooks directory
    const hooksDir = join(townDir, "hooks");
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }

    const townConfig: TownConfig = { ...DEFAULT_CONFIG, ...config };
    const town: Town = {
      id: `town-${nanoid(8)}`,
      name: name ?? `devtown-${nanoid(4)}`,
      rootPath,
      rigs: [],
      config: townConfig,
      createdAt: new Date(),
      status: "active",
    };

    // Set up subsystems
    const registry = new AgentRegistry();
    registry.seedDefaults();

    const store = new ConvoyStore();
    const fleet = new FleetManager(registry, store, {
      rootPath,
      autoSpawn: townConfig.autoScale,
    });
    const mayor = new Mayor(town.id, store, fleet);

    const manager = new TownManager(town, registry, store, fleet, mayor);
    manager.save();

    return manager;
  }

  /**
   * Load an existing DevTown workspace from disk.
   */
  static load(rootPath: string): TownManager | null {
    const configPath = join(rootPath, TOWN_DIR, TOWN_CONFIG_FILE);
    if (!existsSync(configPath)) return null;

    try {
      const raw = readFileSync(configPath, "utf-8");
      const manifest: TownManifest = JSON.parse(raw);

      const rigs: Rig[] = manifest.rigs.map((rm) => ({
        id: rm.id,
        name: rm.name,
        repoUrl: rm.repoUrl,
        localPath: rm.localPath,
        defaultBranch: rm.defaultBranch,
        polecats: [],
        hooks: [],
        settings: rm.settings,
        status: "ready" as RigStatus,
      }));

      const town: Town = {
        id: manifest.id,
        name: manifest.name,
        rootPath: manifest.rootPath,
        rigs,
        config: manifest.config,
        createdAt: new Date(manifest.createdAt),
        status: manifest.status,
      };

      const registry = new AgentRegistry();
      registry.seedDefaults();

      const store = new ConvoyStore();
      const fleet = new FleetManager(registry, store, {
        rootPath: manifest.rootPath,
        autoSpawn: manifest.config.autoScale,
      });
      const mayor = new Mayor(town.id, store, fleet);

      return new TownManager(town, registry, store, fleet, mayor);
    } catch {
      return null;
    }
  }

  /** Persist town state to disk. */
  save(): void {
    const manifest: TownManifest = {
      id: this.town.id,
      name: this.town.name,
      rootPath: this.town.rootPath,
      config: this.town.config,
      rigs: this.town.rigs.map((r) => ({
        id: r.id,
        name: r.name,
        repoUrl: r.repoUrl,
        localPath: r.localPath,
        defaultBranch: r.defaultBranch,
        settings: r.settings,
      })),
      createdAt: this.town.createdAt.toISOString(),
      status: this.town.status,
    };

    const configPath = join(this.town.rootPath, TOWN_DIR, TOWN_CONFIG_FILE);
    writeFileSync(configPath, JSON.stringify(manifest, null, 2), "utf-8");
  }

  /** Shut down the town — retire all polecats, save state. */
  shutdown(): void {
    // Retire all polecats
    for (const polecat of this.fleet.listPolecats()) {
      this.fleet.retire(polecat.id, this.town.rootPath);
    }

    this.town = { ...this.town, status: "shutdown" };
    this.save();
  }

  // ─── Rig Management ────────────────────────────────

  /**
   * Add a rig (repository) to the town.
   */
  addRig(params: {
    name: string;
    repoUrl: string;
    localPath: string;
    defaultBranch?: string;
    settings?: Partial<RigSettings>;
  }): Rig {
    const rig: Rig = {
      id: `rig-${nanoid(6)}`,
      name: params.name,
      repoUrl: params.repoUrl,
      localPath: params.localPath,
      defaultBranch: params.defaultBranch ?? "main",
      polecats: [],
      hooks: [],
      settings: {
        ragPatterns: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.md"],
        branchPrefix: "devtown/",
        autoTypecheck: true,
        autoTest: false,
        ...params.settings,
      },
      status: "ready",
    };

    this.town = {
      ...this.town,
      rigs: [...this.town.rigs, rig],
    };
    this.save();

    return rig;
  }

  /** Remove a rig from the town. */
  removeRig(rigId: string): boolean {
    const before = this.town.rigs.length;
    this.town = {
      ...this.town,
      rigs: this.town.rigs.filter((r) => r.id !== rigId),
    };
    if (this.town.rigs.length < before) {
      this.save();
      return true;
    }
    return false;
  }

  /** Get a rig by ID. */
  getRig(rigId: string): Rig | undefined {
    return this.town.rigs.find((r) => r.id === rigId);
  }

  /** List all rigs. */
  listRigs(): Rig[] {
    return this.town.rigs;
  }

  // ─── MEOW — Full Pipeline ─────────────────────────

  /**
   * Submit a feature request to the Mayor for end-to-end execution.
   *
   * This is the top-level API: "Hey DevTown, build me X"
   *
   * Returns the MEOW result with completed beads, PRs, and summary.
   */
  async request(
    request: string,
    rigId: string,
  ): Promise<MEOWResult> {
    const rig = this.getRig(rigId);
    if (!rig) {
      throw new Error(`Rig ${rigId} not found in town ${this.town.id}`);
    }

    return this.mayor.meow(
      request,
      rig.repoUrl,
      rig.id,
      rig.localPath,
    );
  }

  // ─── Status / Health ───────────────────────────────

  /** Get current town status summary. */
  status(): {
    town: { id: string; name: string; status: TownStatus };
    rigs: number;
    polecats: { total: number; active: number; idle: number };
    convoys: { active: number; completed: number };
    beads: { total: number; completed: number; failed: number };
    mayorStatus: string;
  } {
    const snapshot = this.store.getFleetSnapshot();
    const polecats = this.fleet.listPolecats();

    return {
      town: {
        id: this.town.id,
        name: this.town.name,
        status: this.town.status,
      },
      rigs: this.town.rigs.length,
      polecats: {
        total: polecats.length,
        active: this.fleet.listActive().length,
        idle: this.fleet.listIdle().length,
      },
      convoys: {
        active: snapshot.activeConvoys,
        completed: snapshot.completedConvoys,
      },
      beads: {
        total: snapshot.totalBeads,
        completed: snapshot.completedBeads,
        failed: snapshot.failedBeads,
      },
      mayorStatus: this.mayor.getStatus(),
    };
  }

  /**
   * Repair the town — prune stale worktrees, reconnect hooks.
   */
  repair(): { recoveredHooks: number; prunedWorktrees: number } {
    let recoveredHooks = 0;
    let prunedWorktrees = 0;

    for (const rig of this.town.rigs) {
      const result = repairHooks(rig.localPath);
      recoveredHooks += result.recovered;
      prunedWorktrees += result.pruned;
    }

    return { recoveredHooks, prunedWorktrees };
  }

  // ─── Accessors ─────────────────────────────────────

  getTown(): Town {
    return this.town;
  }

  getRegistry(): AgentRegistry {
    return this.registry;
  }

  getStore(): ConvoyStore {
    return this.store;
  }

  getFleet(): FleetManager {
    return this.fleet;
  }

  getMayor(): Mayor {
    return this.mayor;
  }
}
