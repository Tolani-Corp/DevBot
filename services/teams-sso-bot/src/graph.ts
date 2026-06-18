import { Client } from "@microsoft/microsoft-graph-client";

export type GraphProfile = {
  displayName?: string;
  userPrincipalName?: string;
  mail?: string;
  jobTitle?: string;
  id?: string;
};

export async function getGraphProfile(token: string): Promise<GraphProfile> {
  const graphClient = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => token,
    },
  });

  return (await graphClient
    .api("/me")
    .select("id,displayName,userPrincipalName,mail,jobTitle")
    .get()) as GraphProfile;
}

export function formatGraphIdentity(profile: GraphProfile): string {
  const name = profile.displayName?.trim() || "Teams user";
  const upn = profile.userPrincipalName?.trim() || profile.mail?.trim();
  return upn ? `${name} (${upn})` : name;
}
