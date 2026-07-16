import { invoke } from "@tauri-apps/api/core";
import type { LinkPadProject, ProtocolProfile } from "../types/project";

export interface AgentDiagnostic {
  status: {
    ok?: boolean;
    service?: string;
    state?: string;
    version?: string;
    protocolVersion?: string;
    drivers?: string[];
  };
  capabilities: {
    drivers?: Array<{ id: string; displayName?: string }>;
  };
}

export function testAgentConnection(input: {
  host: string;
  port: number;
  token: string;
  timeoutMs: number;
}) {
  return invoke<AgentDiagnostic>("test_agent_connection", {
    host: input.host,
    port: input.port,
    token: input.token,
    timeoutMs: input.timeoutMs
  });
}

export interface ConnectorConnectionDiagnostic {
  ok: boolean;
  status: "connected";
  driver: string;
  endpoint: string;
  latencyMs: number;
  sessionClosed: boolean;
  cleanupWarning?: string | null;
}

export function testConnectorConnection(input: {
  agent: LinkPadProject["agent"];
  projectId: string;
  profile: ProtocolProfile;
}) {
  return invoke<ConnectorConnectionDiagnostic>("test_connector_connection", {
    host: input.agent.host,
    port: input.agent.port,
    token: input.agent.token,
    timeoutMs: input.agent.timeoutMs,
    projectId: input.projectId,
    profile: input.profile
  });
}
