import { z } from "zod";
import { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { IServiceContainer } from "../../container.js";
import { BasePrompt } from "../base.js";

// Mock implementation of BasePrompt for testing
const TestSchema = z.object({
  name: z.string(),
});

class TestPrompt extends BasePrompt<typeof TestSchema> {
  name = "test-prompt";
  description = "A test prompt";
  schema = TestSchema;

  protected getImpl(
    params: z.infer<typeof TestSchema>
  ): Promise<GetPromptResult> {
    if (params.name === "throw") {
      return Promise.reject(new Error("Test error"));
    }
    return Promise.resolve({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Hello, ${params.name}`,
          },
        },
      ],
    });
  }
}

describe("BasePrompt", () => {
  let container: IServiceContainer;
  let prompt: TestPrompt;

  beforeEach(() => {
    container = {} as IServiceContainer;
    prompt = new TestPrompt(container);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should call getImpl and return its result on success", async () => {
    const params = { name: "World" };
    const result = await prompt.get(params);
    expect(result).toEqual({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Hello, World",
          },
        },
      ],
    });
  });

  it("should throw a ZodError if params are invalid", async () => {
    const params = { name: 123 }; // Invalid type
    await expect(prompt.get(params)).rejects.toThrow(z.ZodError);
  });

  it("should catch errors from getImpl, log them, and re-throw", async () => {
    const params = { name: "throw" };
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(prompt.get(params)).rejects.toThrow("Test error");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Prompt generation failed: test-prompt",
      {
        error: "Test error",
      }
    );
  });

  it("should return the correct definition", () => {
    const definition = prompt.getDefinition();
    expect(definition).toEqual({
      description: "A test prompt",
      argsSchema: {
        name: expect.any(Object), // zod object
      },
    });
  });
});
