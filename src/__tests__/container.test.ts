let initializeContainer: typeof import("../../src/container").initializeContainer;
let mockCacheServiceConstructorFn: jest.Mock;
let mockYoutubeServiceConstructorFn: jest.Mock;
let mockTranscriptServiceConstructorFn: jest.Mock; // Added mock for TranscriptService

describe("initializeContainer", () => {
  beforeEach(async () => {
    jest.resetModules(); // Reset modules before each test

    // For constructor mocks, we mock the class behavior
    // The actual instances will be created by these mocked constructors
    const mockCacheServiceInstance =
      {} as import("../../src/services/cache.service").CacheService; // representative instance
    mockCacheServiceConstructorFn = jest
      .fn()
      .mockImplementation(() => mockCacheServiceInstance);

    const mockYoutubeServiceInstance =
      {} as import("../../src/services/youtube.service").YoutubeService; // representative instance
    mockYoutubeServiceConstructorFn = jest
      .fn()
      .mockImplementation(() => mockYoutubeServiceInstance);

    const mockTranscriptServiceInstance =
      {} as import("../../src/services/transcript.service").TranscriptService; // representative instance
    mockTranscriptServiceConstructorFn = jest
      .fn()
      .mockImplementation(() => mockTranscriptServiceInstance);

    // Use jest.doMock to control the mocks for the dynamically imported module
    jest.doMock("../../src/services/cache.service", () => ({
      CacheService: mockCacheServiceConstructorFn,
    }));
    jest.doMock("../../src/services/youtube.service", () => ({
      YoutubeService: mockYoutubeServiceConstructorFn,
    }));
    jest.doMock("../../src/services/transcript.service", () => ({
      TranscriptService: mockTranscriptServiceConstructorFn,
    }));

    // Dynamically import the module under test AFTER jest.doMock calls
    const containerModule = await import("../../src/container");
    initializeContainer = containerModule.initializeContainer;

    // ClearAllMocks is not strictly necessary here because we are using freshly created jest.fn()s
    // and they haven't been called yet. But it doesn't hurt.
    jest.clearAllMocks();
  });

  it("should initialize services and return the container", async () => {
    const dummyApiKey = "test-api-key";
    const dummyMdbConnectionString = "mongodb://mock-db";
    const container = initializeContainer({
      apiKey: dummyApiKey,
      mdbMcpConnectionString: dummyMdbConnectionString,
    });

    expect(mockCacheServiceConstructorFn).toHaveBeenCalledTimes(1);
    expect(mockCacheServiceConstructorFn).toHaveBeenCalledWith(
      dummyMdbConnectionString
    );
    expect(mockYoutubeServiceConstructorFn).toHaveBeenCalledTimes(1);
    // Assert that YoutubeService constructor was called with the instance created by CacheService mock
    expect(mockYoutubeServiceConstructorFn).toHaveBeenCalledWith(
      dummyApiKey,
      mockCacheServiceConstructorFn.mock.results[0].value
    );
    expect(mockTranscriptServiceConstructorFn).toHaveBeenCalledTimes(1);
    expect(mockTranscriptServiceConstructorFn).toHaveBeenCalledWith(
      mockCacheServiceConstructorFn.mock.results[0].value
    );

    expect(container).toEqual({
      cacheService: mockCacheServiceConstructorFn.mock.results[0].value,
      youtubeService: mockYoutubeServiceConstructorFn.mock.results[0].value,
      transcriptService:
        mockTranscriptServiceConstructorFn.mock.results[0].value, // Added
    });

    // Initialization logic should be called once
    expect(mockCacheServiceConstructorFn).toHaveBeenCalledTimes(1);
    expect(mockYoutubeServiceConstructorFn).toHaveBeenCalledTimes(1);
    expect(mockTranscriptServiceConstructorFn).toHaveBeenCalledTimes(1); // Added
  });
});
