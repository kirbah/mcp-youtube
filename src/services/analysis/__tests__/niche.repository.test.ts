import { NicheRepository } from "../niche.repository";
import type { ChannelCache } from "../../../types/niche.types";
import { getDb } from "../../database.service";

// These will hold the mock functions retrieved from the mocked getDb instance
let actualMockUpdateOne: jest.Mock;
let actualMockFindOne: jest.Mock; // Not used in these tests, but kept for consistency if needed later
let actualMockDeleteOne: jest.Mock; // Not used in these tests, but kept for consistency if needed later
let actualMockFind: jest.Mock;

jest.mock("../../database.service", () => {
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

let nicheRepositoryInstance: NicheRepository;

describe("NicheRepository", () => {
  beforeEach(() => {
    const mockDb = getDb();
    const mockCollection = mockDb.collection("analysis_channels");

    actualMockUpdateOne = mockCollection.updateOne as jest.Mock;
    actualMockFindOne = mockCollection.findOne as jest.Mock;
    actualMockDeleteOne = mockCollection.deleteOne as jest.Mock;
    actualMockFind = mockCollection.find as jest.Mock;

    actualMockUpdateOne.mockClear();
    actualMockFindOne.mockClear();
    actualMockDeleteOne.mockClear();
    actualMockFind.mockClear();

    (getDb as jest.Mock).mockClear();
    (mockDb.collection as jest.Mock).mockClear();

    nicheRepositoryInstance = new NicheRepository(mockDb);
  });

  describe("updateChannel", () => {
    it("should upsert new channel data", async () => {
      const channelId = "UCxyz123";
      const channelData = { title: "New Channel", subscriberCount: 1000 };

      await nicheRepositoryInstance.updateChannel(channelId, {
        $set: channelData,
      });

      expect(actualMockUpdateOne).toHaveBeenCalledTimes(1);
      expect(actualMockUpdateOne).toHaveBeenCalledWith(
        { _id: channelId },
        { $set: channelData },
        { upsert: true }
      );
    });
  });

  describe("findChannelsByIds", () => {
    it("should find multiple channels by their IDs", async () => {
      const channelIds = ["UCabc", "UCdef"];
      const channelDocs: ChannelCache[] = [
        {
          _id: "UCabc", // Changed to string as per NicheRepository's findChannelsByIds
          channelTitle: "Channel ABC",
          createdAt: new Date(),
          status: "candidate",
          latestStats: {
            fetchedAt: new Date(),
            subscriberCount: 1000,
            videoCount: 100,
            viewCount: 100000,
          },
          analysisHistory: [],
          latestAnalysis: undefined,
        },
        {
          _id: "UCdef", // Changed to string
          channelTitle: "Channel DEF",
          createdAt: new Date(),
          status: "candidate",
          latestStats: {
            fetchedAt: new Date(),
            subscriberCount: 1000,
            videoCount: 100,
            viewCount: 100000,
          },
          analysisHistory: [],
          latestAnalysis: undefined,
        },
      ];

      const mockToArray = jest.fn().mockResolvedValue(channelDocs);
      actualMockFind.mockReturnValue({ toArray: mockToArray } as any);

      const result =
        await nicheRepositoryInstance.findChannelsByIds(channelIds);

      expect(actualMockFind).toHaveBeenCalledTimes(1);
      expect(actualMockFind).toHaveBeenCalledWith({
        _id: { $in: channelIds },
      });
      expect(mockToArray).toHaveBeenCalledTimes(1);
      expect(result).toEqual(channelDocs);
    });
  });
});
