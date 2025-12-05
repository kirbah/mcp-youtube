#!/usr/bin/env node

import "dotenv/config";
import { z } from "zod";
import { configSchema } from "./server.js";
import { initializeContainer } from "./container.js";
import { createMcpServer } from "./server.js";

export default function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>;
}) {
  const container = initializeContainer({
    apiKey: config.youtubeApiKey,
    mdbMcpConnectionString: config.mdbMcpConnectionString,
  });

  const server = createMcpServer(container);

  return server.server;
}
