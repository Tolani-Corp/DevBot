export interface ScoutingSchema {
  target: string;
  ports: number[];
  services: Record<string, string>;
  techStack: string[];
}

export interface OffensiveSchema {
  target: string;
  vector: string;
  payloads: string[];
  success: boolean;
  executionTimeMs: number;
}

export interface DefensiveSchema {
  target: string;
  mechanism: string;
  bypassAttempted: boolean;
  blocked: boolean;
}

export interface MonitoringSchema {
  target: string;
  uptime: number;
  anomalies: string[];
}

export interface AAR {
  campaignId: string;
  timestamp: string;
  scouting?: ScoutingSchema;
  offensive?: OffensiveSchema;
  defensive?: DefensiveSchema;
  monitoring?: MonitoringSchema;
  lessonsLearned: string[];
  algorithmAdjustments: Record<string, number>;
}
