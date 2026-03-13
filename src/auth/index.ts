import {
  DeviceCodeCredential,
  DeviceCodeInfo,
  useIdentityPlugin,
} from "@azure/identity";
import { cachePersistencePlugin } from "@azure/identity-cache-persistence";
import { config, GRAPH_SCOPES } from "../config/index.js";

// Enable persistent token caching via OS keychain
useIdentityPlugin(cachePersistencePlugin);

let _credential: DeviceCodeCredential | null = null;

/**
 * Create a DeviceCodeCredential with persistent caching.
 * On first use, the user must complete the device code flow.
 * On subsequent runs, cached tokens are reused automatically.
 */
export function getCredential(
  onDeviceCode?: (info: DeviceCodeInfo) => void,
): DeviceCodeCredential {
  if (_credential) return _credential;

  _credential = new DeviceCodeCredential({
    tenantId: config.AZURE_TENANT_ID,
    clientId: config.AZURE_CLIENT_ID,
    userPromptCallback:
      onDeviceCode ??
      ((info) => {
        console.log("\n🔐 Device Code Authentication");
        console.log(info.message);
      }),
    tokenCachePersistenceOptions: {
      enabled: true,
      name: "minicharles-token-cache",
    },
  });

  return _credential;
}

/**
 * Run the device code auth flow and verify it works
 * by requesting an access token for Graph API scopes.
 */
export async function authenticate(): Promise<string> {
  const credential = getCredential();

  // Request a token — this triggers the device code flow on first use
  const tokenResponse = await credential.getToken(
    GRAPH_SCOPES.map((s) => `https://graph.microsoft.com/${s}`),
  );

  if (!tokenResponse?.token) {
    throw new Error("Authentication failed: no token received");
  }

  console.log("✅ Authentication successful! Token cached for future use.");
  return tokenResponse.token;
}
