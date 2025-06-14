import { CacheService } from "../cache.service"; // Import the class
// Import types from their actual source if they are not re-exported by CacheService module
import {
  VideoListCache,
  ChannelCache,
} from "../analysis/analysis.types.js";
import { ObjectId } from "mongodb";
import { getDb } from '../database.service'; // This is already mocked

// Mock cache.service and use requireActual to get the real implementations
// This can help with issues related to ES module interop in Jest
// jest.mock('../cache.service', () => ({
//   __esModule: true, // Important for ES modules
//   ...jest.requireActual('../cache.service'),
// }));
// CacheEntry is not used at runtime, so it's fine as a type import.
// VideoListCache and ChannelCache are used as types, so they need to be prefixed.

// These will hold the mock functions retrieved from the mocked getDb instance
let actualMockUpdateOne: jest.Mock;
let actualMockFindOne: jest.Mock;
let actualMockDeleteOne: jest.Mock;
let actualMockFind: jest.Mock;

jest.mock('../database.service', () => {
  // Create the mocks within the factory scope
  const factoryMockUpdateOne = jest.fn();
  const factoryMockFindOne = jest.fn();
  const factoryMockDeleteOne = jest.fn();
  const factoryMockFind = jest.fn();

  return {
    getDb: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnValue({
        updateOne: factoryMockUpdateOne,
        findOne: factoryMockFindOne,
        deleteOne: factoryMockDeleteOne,
        find: factoryMockFind,
      }),
    }),
  };
});

// To ensure getDb().collection() is correctly typed and mocked for tests
// we can call getDb here if needed, or rely on the mock implementation above
// For instance, if you need to type mockDb or mockCollection explicitly:
// const mockDb = getDb() as jest.Mocked<ReturnType<typeof getDb>>;
// const mockActualCollection = mockDb.collection('someCollectionName'); // This would use the mock

let cacheServiceInstance: CacheService;

describe("CacheService", () => {
  beforeEach(() => {
    // We need to get the actual mock functions used by the mocked getDb
    // This ensures our tests assert against the correct mock instances.
    const mockDb = getDb(); // This is the mocked getDb
    const mockCollection = mockDb.collection(); // This is the mocked collection object

    actualMockUpdateOne = mockCollection.updateOne as jest.Mock;
    actualMockFindOne = mockCollection.findOne as jest.Mock;
    actualMockDeleteOne = mockCollection.deleteOne as jest.Mock;
    actualMockFind = mockCollection.find as jest.Mock;

    // Clear all mock states before each test.
    // This is important because the mocks (factoryMockUpdateOne etc.) are created once
    // when the factory runs. Their state (calls, instances) persists across tests
    // unless cleared.
    actualMockUpdateOne.mockClear();
    actualMockFindOne.mockClear();
    actualMockDeleteOne.mockClear();
    actualMockFind.mockClear();

    // Clear the getDb mock itself and the collection mock function
    // getDb (the imported function) is mocked by jest.mock
    (getDb as jest.Mock).mockClear();
    // getDb().collection is also a mock function from our factory
    (mockDb.collection as jest.Mock).mockClear();


    cacheServiceInstance = new CacheService(mockDb);
  });


  describe("storeCachedSearchResults and getCachedSearchResults", () => {
    it("should store and retrieve a valid search result", async () => {
      const searchParams = { query: "test", options: { type: "video" } };
      const results = [{ id: "vid1", title: "Test Video" }];

      // actualMockUpdateOne, actualMockFindOne are cleared in beforeEach

      await cacheServiceInstance.storeCachedSearchResults(searchParams, results);

      expect(actualMockUpdateOne).toHaveBeenCalledTimes(1);
      const filterQuery = actualMockUpdateOne.mock.calls[0][0];
      // The filter query is { searchParamsHash: '...' }, it does not contain 'params'.
      // We can check if a hash was present if needed, or remove this check.
      // For now, let's remove the direct check on filterQuery.params
      // expect(filterQuery.params).toEqual(searchParams);

      const updateDocument = actualMockUpdateOne.mock.calls[0][1]; // Use actualMockUpdateOne
      expect(updateDocument.$set.searchParams).toEqual(searchParams);
      expect(updateDocument.$set.results).toEqual(results);
      expect(updateDocument.$set.expiresAt).toBeInstanceOf(Date);
      expect(updateDocument.$set.expiresAt.getTime()).toBeGreaterThan(
        Date.now()
      );

      expect(actualMockUpdateOne.mock.calls[0][2]).toEqual({ upsert: true });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { params, ...storedDoc } = filterQuery; // Use the dynamically generated hash for _id

      actualMockFindOne.mockResolvedValue({
        _id: storedDoc._id, // Use the hash from the filterQuery
        searchParams,
        results,
        expiresAt: updateDocument.$set.expiresAt, // Use the same expiresAt from the update
      });

      const cachedResults =
        await cacheServiceInstance.getCachedSearchResults(searchParams);
      expect(cachedResults).toEqual(results);
    });

    it("should return null for an expired search result", async () => {
      const searchParams = { query: "expired test", options: {} };
      // actualMockFindOne is cleared in beforeEach
      // If the service query is { searchParamsHash, expiresAt: { $gt: new Date() } },
      // and the item IS expired, then findOne should return null.
      actualMockFindOne.mockResolvedValue(null);

      const cachedResults =
        await cacheServiceInstance.getCachedSearchResults(searchParams);
      expect(cachedResults).toBeNull();
    });
  });

  describe("getVideoListCache", () => {
    it("should return null and delete an expired video list", async () => {
      const channelId = "testChannelId";

      // actualMockFindOne, actualMockDeleteOne are cleared in beforeEach

      const expiredVideoList: VideoListCache = {
        _id: new ObjectId(),
        channelId,
        videoIds: ["vid1", "vid2"],
        fetchedAt: new Date(Date.now() - 73 * 60 * 60 * 1000), // 73 hours ago
      };

      actualMockFindOne.mockResolvedValue(expiredVideoList);

      const result = await cacheServiceInstance.getVideoListCache(channelId);

      expect(result).toBeNull();
      expect(actualMockDeleteOne).toHaveBeenCalledTimes(1);
      expect(actualMockDeleteOne).toHaveBeenCalledWith({ _id: channelId });
    });
  });

  describe("updateChannel", () => {
    it("should upsert new channel data", async () => {
      const channelId = "UCxyz123";
      const channelData = { title: "New Channel", subscriberCount: 1000 };

      // actualMockUpdateOne is cleared in beforeEach

      await cacheServiceInstance.updateChannel(channelId, { $set: channelData }); // Ensure $set is used as per CacheService method signature

      expect(actualMockUpdateOne).toHaveBeenCalledTimes(1);
      expect(actualMockUpdateOne).toHaveBeenCalledWith(
        { _id: channelId }, // Corrected filter query to use _id
        { $set: channelData },
        { upsert: true },
      );
    });
  });

  describe("findChannelsByIds", () => {
    it("should find multiple channels by their IDs", async () => {
      const channelIds = ["UCabc", "UCdef"];
      const channelDocs: ChannelCache[] = [
        {
          _id: new ObjectId(),
          channelId: "UCabc",
          title: "Channel ABC",
          lastUpdated: new Date(),
        },
        {
          _id: new ObjectId(),
          channelId: "UCdef",
          title: "Channel DEF",
          lastUpdated: new Date(),
        },
      ];

      // actualMockFind is cleared in beforeEach
      const mockToArray = jest.fn().mockResolvedValue(channelDocs);
      actualMockFind.mockReturnValue({ toArray: mockToArray } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = await cacheServiceInstance.findChannelsByIds(channelIds);

      expect(actualMockFind).toHaveBeenCalledTimes(1);
      expect(actualMockFind).toHaveBeenCalledWith({
        _id: { $in: channelIds }, // Corrected: find by _id
      });
      expect(mockToArray).toHaveBeenCalledTimes(1);
      expect(result).toEqual(channelDocs);
    });
  });
});
