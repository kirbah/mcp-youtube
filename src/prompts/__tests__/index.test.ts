import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { IServiceContainer } from "../../container.js";
import { AnalyzeNichePrompt } from "../analyzeNiche.js";
import { registerPrompts } from "../index.js";

// Mock the prompt classes
jest.mock("../analyzeNiche.js");

describe("registerPrompts", () => {
  let server: McpServer;
  let container: IServiceContainer;

  beforeEach(() => {
    // Mock McpServer
    server = {
      registerPrompt: jest.fn(),
    } as unknown as McpServer;

    // Mock IServiceContainer
    container = {} as IServiceContainer;

    // Clear all mock implementations before each test
    (AnalyzeNichePrompt as jest.Mock).mockClear();
  });

  it("should register all prompts defined in PROMPT_CLASSES", () => {
    // Mock the instance of AnalyzeNichePrompt
    const mockPromptInstance = {
      name: "analyze-niche",
      getDefinition: () => ({
        description: "A test description",
        argsSchema: {},
      }),
      get: jest.fn(),
    };
    (AnalyzeNichePrompt as jest.Mock).mockImplementation(
      () => mockPromptInstance
    );

    registerPrompts(server, container);

    // Expect one prompt to be registered
    expect(server.registerPrompt).toHaveBeenCalledTimes(1);
    expect(AnalyzeNichePrompt).toHaveBeenCalledWith(container);
  });

  it("should call registerPrompt with the correct arguments", async () => {
    const mockGet = jest.fn().mockResolvedValue({ messages: [] });
    const mockDefinition = {
      description: "Deep dive analysis",
      argsSchema: { query: {} },
    };
    const mockPromptInstance = {
      name: "analyze-niche",
      getDefinition: () => mockDefinition,
      get: mockGet,
    };
    (AnalyzeNichePrompt as jest.Mock).mockImplementation(
      () => mockPromptInstance
    );

    registerPrompts(server, container);

    expect(server.registerPrompt).toHaveBeenCalledWith(
      "analyze-niche",
      mockDefinition,
      expect.any(Function)
    );

    // Test the callback
    const callback = (server.registerPrompt as jest.Mock).mock.calls[0][2];
    const testArgs = { query: "test" };
    await callback(testArgs);
    expect(mockGet).toHaveBeenCalledWith(testArgs);
  });
});
