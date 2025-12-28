import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types";
import { IServiceContainer } from "../../../container";
import { TranscriptService } from "../../../services/transcript.service";
import { BaseResource } from "../base";
import { registerResources } from "../index";
import { TranscriptLocalizedResource, TranscriptResource } from "../transcript";

jest.mock("@modelcontextprotocol/sdk/server/mcp", () => {
  const originalModule = jest.requireActual(
    "@modelcontextprotocol/sdk/server/mcp"
  );
  return {
    ...originalModule,
    // Mock ResourceTemplate to make template string accessible for tests
    ResourceTemplate: jest
      .fn()
      .mockImplementation((template) => ({ toString: () => template })),
  };
});

// Mock BaseResource for direct testing
class MockResource extends BaseResource {
  name = "MockResource";
  uri = "mock://resource/{id}";
  mimeType = "text/plain";

  readImpl(uri: URL, variables?: unknown): Promise<ReadResourceResult> {
    throw new Error("Method not implemented.");
  }
}

describe("BaseResource", () => {
  let container: IServiceContainer;
  let resource: MockResource;

  beforeEach(() => {
    container = {} as IServiceContainer;
    resource = new MockResource(container);
  });

  it("should call readImpl and return its result on success", async () => {
    const successResult: ReadResourceResult = {
      contents: [
        { uri: "mock://resource/123", mimeType: "text/plain", text: "success" },
      ],
    };
    const readImplSpy = jest
      .spyOn(resource as any, "readImpl")
      .mockResolvedValue(successResult);

    const result = await resource.read(new URL("mock://resource/123"), {
      id: "123",
    });

    expect(readImplSpy).toHaveBeenCalledWith(new URL("mock://resource/123"), {
      id: "123",
    });
    expect(result).toBe(successResult);
  });

  it("should catch errors from readImpl, log them, and re-throw", async () => {
    const testError = new Error("Test error");
    jest.spyOn(resource as any, "readImpl").mockRejectedValue(testError);
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(resource.read(new URL("mock://resource/456"))).rejects.toThrow(
      testError
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Resource read failed: MockResource"),
      expect.any(Object)
    );

    consoleErrorSpy.mockRestore();
  });
});

describe("TranscriptResource", () => {
  let container: IServiceContainer;
  let transcriptService: TranscriptService;
  let resource: TranscriptResource;

  beforeEach(() => {
    transcriptService = {
      getTranscriptSegments: jest.fn(),
    } as unknown as TranscriptService;
    container = { transcriptService };
    resource = new TranscriptResource(container);
  });

  it("should use default language 'en' when not provided", async () => {
    (transcriptService.getTranscriptSegments as jest.Mock).mockResolvedValue({
      transcript: "some text",
    });
    await resource["readImpl"](new URL("youtube://transcript/123"), {
      videoId: "123",
    });
    expect(transcriptService.getTranscriptSegments).toHaveBeenCalledWith(
      "123",
      "en",
      "full_text"
    );
  });

  it("should call transcriptService with correct parameters", async () => {
    (transcriptService.getTranscriptSegments as jest.Mock).mockResolvedValue({
      transcript: "some text",
    });
    await resource["readImpl"](new URL("youtube://transcript/123"), {
      videoId: "123",
      language_code: "fr",
    });
    expect(transcriptService.getTranscriptSegments).toHaveBeenCalledWith(
      "123",
      "fr",
      "full_text"
    );
  });

  it("should return a valid ReadResourceResult on success", async () => {
    const mockServiceResult = { transcript: { segments: [{ text: "hello" }] } };
    (transcriptService.getTranscriptSegments as jest.Mock).mockResolvedValue(
      mockServiceResult
    );
    const result = await resource["readImpl"](
      new URL("youtube://transcript/abc"),
      { videoId: "abc" }
    );

    expect(result).toEqual({
      contents: [
        {
          uri: "youtube://transcript/abc",
          mimeType: "application/json",
          text: JSON.stringify(mockServiceResult, null, 2),
        },
      ],
    });
  });

  it("should throw an error if videoId is missing", async () => {
    await expect(
      resource["readImpl"](new URL("youtube://transcript/"), {})
    ).rejects.toThrow("Missing videoId in URI variables");
  });

  it("should throw an error if service returns null", async () => {
    (transcriptService.getTranscriptSegments as jest.Mock).mockResolvedValue(
      null
    );
    await expect(
      resource["readImpl"](new URL("youtube://transcript/456"), {
        videoId: "456",
      })
    ).rejects.toThrow("Transcript not found for video 456 in language en");
  });

  it("should throw an error if service result lacks 'transcript' property", async () => {
    (transcriptService.getTranscriptSegments as jest.Mock).mockResolvedValue({
      other: "data",
    });
    await expect(
      resource["readImpl"](new URL("youtube://transcript/789"), {
        videoId: "789",
      })
    ).rejects.toThrow("Transcript not found for video 789 in language en");
  });
});

describe("TranscriptLocalizedResource", () => {
  let container: IServiceContainer;
  let transcriptService: TranscriptService;
  let resource: TranscriptLocalizedResource;

  beforeEach(() => {
    transcriptService = {
      getTranscriptSegments: jest.fn(),
    } as unknown as TranscriptService;
    container = { transcriptService };
    resource = new TranscriptLocalizedResource(container);
  });

  it("should use the explicit language provided", async () => {
    (transcriptService.getTranscriptSegments as jest.Mock).mockResolvedValue({
      transcript: "some text",
    });
    await resource["readImpl"](new URL("youtube://transcript/123/de"), {
      videoId: "123",
      language_code: "de",
    });
    expect(transcriptService.getTranscriptSegments).toHaveBeenCalledWith(
      "123",
      "de",
      "full_text"
    );
  });

  it("should have the correct URI template", () => {
    expect(resource.uri.toString()).toBe(
      "youtube://transcript/{videoId}/{language_code}"
    );
  });
});

describe("registerResources", () => {
  let server: McpServer;
  let container: IServiceContainer;

  beforeEach(() => {
    server = {
      registerResource: jest.fn(),
    } as unknown as McpServer;
    container = {} as IServiceContainer;
  });

  it("should register exactly two resources", () => {
    registerResources(server, container);
    expect(server.registerResource).toHaveBeenCalledTimes(2);
  });

  it("should register TranscriptResource with correct metadata", () => {
    registerResources(server, container);
    const resource = new TranscriptResource(container);
    const call = (server.registerResource as jest.Mock).mock.calls.find(
      (c) => c[0] === resource.name
    );

    expect(call).toBeDefined();
    expect(call[1].toString()).toBe(resource.uri.toString());
    expect(call[2]).toEqual({
      mimeType: resource.mimeType,
      description: resource.description,
    });
    expect(call[3]).toBeInstanceOf(Function);
  });

  it("should register TranscriptLocalizedResource with correct metadata", () => {
    registerResources(server, container);
    const resource = new TranscriptLocalizedResource(container);
    const call = (server.registerResource as jest.Mock).mock.calls.find(
      (c) => c[0] === resource.name
    );

    expect(call).toBeDefined();
    expect(call[1].toString()).toBe(resource.uri.toString());
    expect(call[2]).toEqual({
      mimeType: resource.mimeType,
      description: resource.description,
    });
    expect(call[3]).toBeInstanceOf(Function);
  });

  it("should wire the callback to the resource's read method", async () => {
    const readSpy = jest
      .spyOn(TranscriptResource.prototype, "read")
      .mockResolvedValue({ contents: [] });

    registerResources(server, container);

    // Get the callback function for TranscriptResource from the mock calls
    const call = (server.registerResource as jest.Mock).mock.calls.find(
      (c) => c[0] === "YouTube Transcript"
    );
    const callback = call[3];

    const testUri = new URL("youtube://transcript/xyz");
    const testVars = { videoId: "xyz" };
    await callback(testUri, testVars);

    expect(readSpy).toHaveBeenCalledWith(testUri, testVars);
    readSpy.mockRestore();
  });
});
