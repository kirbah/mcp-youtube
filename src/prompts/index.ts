import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IServiceContainer } from "../container.js";
import { BasePrompt } from "./base.js";
// import { AnalyzeNichePrompt } from "./analyzeNiche.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromptConstructor = new (container: IServiceContainer) => BasePrompt<any>;
const PROMPT_CLASSES: PromptConstructor[] = [];

// Helper to preserve generic type safety when registering prompts
function registerPromptSafe(
  server: McpServer,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promptInstance: BasePrompt<any>
) {
  server.registerPrompt(
    promptInstance.name,
    promptInstance.getDefinition(),
    (args) => promptInstance.get(args)
  );
}

export function registerPrompts(
  server: McpServer,
  container: IServiceContainer
) {
  if (PROMPT_CLASSES.length === 0) {
    return;
  }

  for (const PromptClass of PROMPT_CLASSES) {
    const promptInstance = new PromptClass(container);
    registerPromptSafe(server, promptInstance);
  }
}
