import { createServer, Server } from "https";
import { IncomingMessage, ServerResponse } from "http";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { ServerConfig } from "../shared/types.js";

type RequestListener = (
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>
) => void;

export function createTLSServer(
  config: ServerConfig,
  handler: RequestListener
): Server {
  if (!config.tls) {
    throw new Error("TLS config is required but not provided");
  }

  return createServer(
    {
      key: readFileSync(config.tls.key),
      cert: readFileSync(config.tls.cert),
    },
    handler
  );
}

export async function generateSelfSignedCert(): Promise<{
  keyPath: string;
  certPath: string;
}> {
  const homeDir = process.env.HOME || ".";
  const certDir = join(homeDir, ".claude", "claude-status", "certs");
  const keyPath = join(certDir, "key.pem");
  const certPath = join(certDir, "cert.pem");

  if (!existsSync(certDir)) {
    mkdirSync(certDir, { recursive: true });
  }

  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/CN=localhost"`
    );
  } catch {
    throw new Error(
      "openssl is required to generate self-signed certificates. Install it or use mkcert."
    );
  }

  return { keyPath, certPath };
}
