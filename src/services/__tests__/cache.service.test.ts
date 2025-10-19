import { CacheService } from "../cache.service"; // Import the class
import { getDb } from "../database.service"; // This is already mocked

// These will hold the mock functions retrieved from the mocked getDb instance
let actualMockUpdateOne: jest.Mock;
let actualMockFindOne: jest.Mock;
let actualMockDeleteOne: jest.Mock;

jest.mock("../database.service", () => {
  // Create the mocks within the factory scope
  const factoryMockUpdateOne = jest.fn();
  const factoryMockFindOne = jest.fn();
  const factoryMockDeleteOne = jest.fn();

  return {
    getDb: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnValue({
        updateOne: factoryMockUpdateOne,
        findOne: factoryMockFindOne,
        deleteOne: factoryMockDeleteOne,
      }),
    }),
  };
});

let cacheServiceInstance: CacheService;

describe("CacheService", () => {
  beforeEach(async () => {
    // We need to get the actual mock functions used by the mocked getDb
    // This ensures our tests assert against the correct mock instances.
    const mockDb = await getDb(); // Await the mocked getDb to get the Db object
    const mockCollection = mockDb.collection("test_collection"); // Provide a collection name

    actualMockUpdateOne = mockCollection.updateOne as jest.Mock;
    actualMockFindOne = mockCollection.findOne as jest.Mock;
    actualMockDeleteOne = mockCollection.deleteOne as jest.Mock;

    // Clear all mock states before each test.
    // This is important because the mocks (factoryMockUpdateOne etc.) are created once
    // when the factory runs. Their state (calls, instances) persists across tests
    // unless cleared.
    actualMockUpdateOne.mockClear();
    actualMockFindOne.mockClear();
    actualMockDeleteOne.mockClear();

    // Clear the getDb mock itself and the collection mock function
    // getDb (the imported function) is mocked by jest.mock
    (getDb as jest.Mock).mockClear();
    // mockDb.collection is also a mock function from our factory
    (mockDb.collection as jest.Mock).mockClear();

    // Instantiate CacheService with a connection string by default for tests that expect caching
    cacheServiceInstance = new CacheService("mongodb://test");
  });

  describe("createOperationKey", () => {
    it("should create a consistent hash for the same operation and arguments", () => {
      const key1 = cacheServiceInstance.createOperationKey("testOp", {
        a: 1,
        b: "hello",
      });
      const key2 = cacheServiceInstance.createOperationKey("testOp", {
        b: "hello",
        a: 1,
      });
      const key3 = cacheServiceInstance.createOperationKey("anotherOp", {
        a: 1,
        b: "hello",
      });

      expect(key1).toBe(key2); // Order of arguments should not matter
      expect(key1).not.toBe(key3); // Different operation name should result in different hash
    });

    it("should exclude undefined values from the key", () => {
      const key1 = cacheServiceInstance.createOperationKey("testOp", {
        a: 1,
        b: undefined,
      });
      const key2 = cacheServiceInstance.createOperationKey("testOp", { a: 1 });
      expect(key1).toBe(key2);
    });
  });

  describe("getOrSet", () => {
    const key = "testKey";
    const collectionName = "testCollection";
    const ttlSeconds = 60;
    const freshData = { value: "fresh" };
    const cachedData = { value: "cached" };

    describe("when CacheService is initialized with a connection string", () => {
      // cacheServiceInstance is already initialized with a connection string in the outer beforeEach

      it("should return cached data if available and not expired", async () => {
        actualMockFindOne.mockResolvedValue({
          _id: key,
          data: cachedData,
          expiresAt: new Date(Date.now() + 10000), // 10 seconds in the future
        });

        const operation = jest.fn().mockResolvedValue(freshData);
        const result = await cacheServiceInstance.getOrSet(
          key,
          operation,
          ttlSeconds,
          collectionName
        );

        expect(result).toEqual(cachedData);
        expect(operation).not.toHaveBeenCalled();
        expect(actualMockFindOne).toHaveBeenCalledWith({
          _id: key,
          expiresAt: { $gt: expect.any(Date) },
        });
        expect(actualMockUpdateOne).not.toHaveBeenCalled();
      });

      it("should execute operation, store, and return fresh data if cache is expired or not found", async () => {
        // Simulate no cache or expired cache
        actualMockFindOne.mockResolvedValue(null);

        const operation = jest.fn().mockResolvedValue(freshData);
        const result = await cacheServiceInstance.getOrSet(
          key,
          operation,
          ttlSeconds,
          collectionName
        );

        expect(result).toEqual(freshData);
        expect(operation).toHaveBeenCalledTimes(1);
        expect(actualMockFindOne).toHaveBeenCalledWith({
          _id: key,
          expiresAt: { $gt: expect.any(Date) },
        });
        expect(actualMockUpdateOne).toHaveBeenCalledTimes(1);
        const updateCall = actualMockUpdateOne.mock.calls[0];
        expect(updateCall[0]).toEqual({ _id: key });
        expect(updateCall[1].$set.data).toEqual(freshData);
        expect(updateCall[1].$set.expiresAt.getTime()).toBeGreaterThan(
          Date.now()
        );
        expect(updateCall[2]).toEqual({ upsert: true });
      });

      it("should not cache if fresh data is null or undefined", async () => {
        actualMockFindOne.mockResolvedValue(null);

        const operationNull = jest.fn().mockResolvedValue(null);
        const resultNull = await cacheServiceInstance.getOrSet(
          key,
          operationNull,
          ttlSeconds,
          collectionName
        );
        expect(resultNull).toBeNull();
        expect(actualMockUpdateOne).not.toHaveBeenCalled(); // Should not cache null

        actualMockUpdateOne.mockClear(); // Clear for next assertion

        const operationUndefined = jest.fn().mockResolvedValue(undefined);
        const resultUndefined = await cacheServiceInstance.getOrSet(
          key,
          operationUndefined,
          ttlSeconds,
          collectionName
        );
        expect(resultUndefined).toBeUndefined();
        expect(actualMockUpdateOne).not.toHaveBeenCalled(); // Should not cache undefined
      });

      it("should store params if provided", async () => {
        actualMockFindOne.mockResolvedValue(null);
        const params = { query: "test" };
        const operation = jest.fn().mockResolvedValue(freshData);

        await cacheServiceInstance.getOrSet(
          key,
          operation,
          ttlSeconds,
          collectionName,
          params
        );

        expect(actualMockUpdateOne).toHaveBeenCalledTimes(1);
        const updateCall = actualMockUpdateOne.mock.calls[0];
        expect(updateCall[1].$set.params).toEqual(params);
      });
    });

    describe("when CacheService is initialized without a connection string", () => {
      let bypassCacheServiceInstance: CacheService;

      beforeEach(() => {
        // Instantiate CacheService without a connection string to bypass caching
        bypassCacheServiceInstance = new CacheService();
      });

      it("should bypass caching and execute the operation directly", async () => {
        const operation = jest.fn().mockResolvedValue(freshData);
        const result = await bypassCacheServiceInstance.getOrSet(
          key,
          operation,
          ttlSeconds,
          collectionName
        );

        expect(result).toEqual(freshData);
        expect(operation).toHaveBeenCalledTimes(1);
        expect(getDb).not.toHaveBeenCalled();
        expect(actualMockFindOne).not.toHaveBeenCalled();
        expect(actualMockUpdateOne).not.toHaveBeenCalled();
      });
    });
  });
});
