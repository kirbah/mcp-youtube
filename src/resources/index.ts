import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IServiceContainer } from "../container.js";
import { TranscriptResource } from "./transcript.js";

const RESOURCE_CLASSES = [TranscriptResource];

export function registerResources(
  server: McpServer,
  container: IServiceContainer
) {
  for (const ResourceClass of RESOURCE_CLASSES) {
    const resourceInstance = new ResourceClass(container);

    server.registerResource(
      resourceInstance.name,
      resourceInstance.uri,
      {
        mimeType: resourceInstance.mimeType,
        description: resourceInstance.description,
      },
      (uri, variables) => resourceInstance.read(uri, variables)
    );
  }
}
