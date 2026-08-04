import {
  validateWebAcquisitionMission,
  type WebAcquisitionMission,
} from "../web-acquisition-policy.js";

export async function handle(args: unknown) {
  const mission = (args as { mission?: WebAcquisitionMission } | undefined)?.mission;

  if (!mission) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              approved: false,
              violations: [
                {
                  code: "MISSION_REQUIRED",
                  severity: "blocking",
                  message: "A complete web acquisition mission is required.",
                  field: "mission",
                },
              ],
              normalizedDomains: [],
              requiredApprovals: [],
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  const result = validateWebAcquisitionMission(mission);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    isError: !result.approved,
  };
}
