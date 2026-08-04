import {
  selectAcquisitionProvider,
  validateWebAcquisitionMission,
  type AcquisitionProvider,
  type WebAcquisitionMission,
} from "./web-acquisition-policy.js";
import {
  validateWebAcquisitionTaskContract,
  type WebAcquisitionTaskContract,
} from "./web-acquisition-harness.js";

export interface WebAcquisitionDryRunInput {
  mission: WebAcquisitionMission;
  taskContract: WebAcquisitionTaskContract;
  requiresJavascript: boolean;
  requiresStatefulBrowser: boolean;
  knownStaticSource: boolean;
  providerAvailability: Partial<Record<AcquisitionProvider, boolean>>;
  harnessVersion: string;
  modelConfigurationId: string;
}

export interface WebAcquisitionDryRunPlan {
  schema: "devbot.natt.web-acquisition-dry-run.v1";
  missionId: string;
  taskContractId: string;
  approved: boolean;
  willContactTarget: false;
  missionViolations: string[];
  taskContractViolations: string[];
  requiredApprovals: string[];
  proposedProvider: AcquisitionProvider;
  executionPattern: "single-agent-plus-critic";
  maxParallelAgents: 1;
  toolBundleId: "web-acquisition-v1";
  retrievalPolicyVersion: "lexical-first-v1";
  memoryPolicyVersion: "three-layer-file-backed-v1";
  harnessVersion: string;
  modelConfigurationId: string;
}

export function createWebAcquisitionDryRunPlan(
  input: WebAcquisitionDryRunInput,
): WebAcquisitionDryRunPlan {
  const missionValidation = validateWebAcquisitionMission(input.mission);
  const taskContractViolations = validateWebAcquisitionTaskContract(
    input.taskContract,
  );

  if (input.taskContract.missionId !== input.mission.missionId) {
    taskContractViolations.push("task contract mission does not match mission");
  }
  if (input.taskContract.tenantId !== input.mission.tenantId) {
    taskContractViolations.push("task contract tenant does not match mission");
  }

  const approved =
    missionValidation.approved && taskContractViolations.length === 0;
  const proposedProvider = approved
    ? selectAcquisitionProvider({
        requiresJavascript: input.requiresJavascript,
        requiresStatefulBrowser: input.requiresStatefulBrowser,
        knownStaticSource: input.knownStaticSource,
        providerPreference: input.mission.providerPreference,
        providerAvailability: input.providerAvailability,
      })
    : "manual-review";

  return {
    schema: "devbot.natt.web-acquisition-dry-run.v1",
    missionId: input.mission.missionId,
    taskContractId: input.taskContract.id,
    approved,
    willContactTarget: false,
    missionViolations: missionValidation.violations.map(
      (violation) => `${violation.code}: ${violation.message}`,
    ),
    taskContractViolations,
    requiredApprovals: missionValidation.requiredApprovals,
    proposedProvider,
    executionPattern: "single-agent-plus-critic",
    maxParallelAgents: 1,
    toolBundleId: "web-acquisition-v1",
    retrievalPolicyVersion: "lexical-first-v1",
    memoryPolicyVersion: "three-layer-file-backed-v1",
    harnessVersion: input.harnessVersion,
    modelConfigurationId: input.modelConfigurationId,
  };
}
