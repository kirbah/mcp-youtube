import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IServiceContainer } from "../container.js";
import { BaseResource } from "./base.js";
// import {
//   TranscriptResource,
//   TranscriptLocalizedResource,
// } from "./transcript.js";

type ResourceConstructor = new (container: IServiceContainer) => BaseResource;
const RESOURCE_CLASSES: ResourceConstructor[] = [];

export function registerResources(
  server: McpServer,
  container: IServiceContainer
) {
  if (RESOURCE_CLASSES.length === 0) {
    return;
  }

  for (const ResourceClass of RESOURCE_CLASSES) {
    const resourceInstance = new ResourceClass(container);

    server.registerResource(
      resourceInstance.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      resourceInstance.uri as any,
      {
        mimeType: resourceInstance.mimeType,
        description: resourceInstance.description,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (uri: URL, variables: any) => resourceInstance.read(uri, variables)
    );
  }
}
