import { IServiceContainer } from "../container.js";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

export abstract class BaseResource {
  constructor(protected container: IServiceContainer) {}

  abstract uri: string | ResourceTemplate; // The specific URI or a URI pattern
  abstract name: string;
  abstract mimeType: string;
  abstract description?: string;

  /**
   * Internal implementation of the resource reading logic.
   */
  protected abstract readImpl(
    uri: URL,
    variables?: unknown
  ): Promise<ReadResourceResult>;

  /**
   * Public entry point that handles error catching and logging.
   */
  public async read(
    uri: URL,
    variables?: unknown
  ): Promise<ReadResourceResult> {
    try {
      return await this.readImpl(uri, variables);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`Resource read failed: ${this.name}`, {
        error: errorMessage,
        uri: uri.toString(),
      });
      throw err; // Re-throw so the MCP client receives the error
    }
  }
}
