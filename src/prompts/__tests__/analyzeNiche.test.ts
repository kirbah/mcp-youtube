import { z } from "zod";
import { IServiceContainer } from "../../container.js";
import { AnalyzeNichePrompt } from "../analyzeNiche.js";

describe("AnalyzeNichePrompt", () => {
  let container: IServiceContainer;
  let prompt: AnalyzeNichePrompt;

  beforeEach(() => {
    container = {} as IServiceContainer;
    prompt = new AnalyzeNichePrompt(container);
  });

  it("should generate a prompt message containing the query", async () => {
    const params = { query: "stoicism" };
    const result = await prompt.get(params);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");

    const content = result.messages[0].content;
    if (
      typeof content !== "object" ||
      content === null ||
      !("text" in content)
    ) {
      fail("Content should be a text object");
    }
    expect(content.type).toBe("text");
    expect(content.text).toMatch(/stoicism/);
    expect(content.text).toMatch(/findConsistentOutlierChannels/);
  });

  it("should throw a ZodError if query is not a string", async () => {
    const params = { query: 123 };
    await expect(prompt.get(params)).rejects.toThrow(z.ZodError);
  });
});
