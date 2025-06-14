import {
  formatSuccess,
  formatVideoMap,
  formatChannelMap,
} from "../responseFormatter";

describe("responseFormatter", () => {
  describe("formatSuccess", () => {
    it("should format an object with message and data", () => {
      const data = { message: "Success!", data: { id: 1, value: "test" } };
      expect(formatSuccess(data)).toEqual({
        success: true,
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      });
    });

    it("should format an array payload", () => {
      const data = ["item1", "item2", { nested: true }];
      expect(formatSuccess(data)).toEqual({
        success: true,
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      });
    });

    it("should format a null payload", () => {
      const data = null;
      expect(formatSuccess(data)).toEqual({
        success: true,
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      });
    });

    it("should format a string payload", () => {
      const data = "Just a string";
      expect(formatSuccess(data)).toEqual({
        success: true,
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      });
    });

    it("should format an empty object", () => {
      const data = {};
      expect(formatSuccess(data)).toEqual({
        success: true,
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      });
    });
  });

  describe("formatVideoMap", () => {
    it("should correctly map video IDs to results", () => {
      const videoIds = ["id1", "id2"];
      const results = [{ videoData1: "data1" }, { videoData2: "data2" }];
      expect(formatVideoMap(videoIds, results)).toEqual({
        id1: { videoData1: "data1" },
        id2: { videoData2: "data2" },
      });
    });

    it("should return an empty object if videoIds and results are empty", () => {
      expect(formatVideoMap([], [])).toEqual({});
    });
  });

  describe("formatChannelMap", () => {
    it("should correctly map channel IDs to results", () => {
      const channelIds = ["ch1", "ch2"];
      const results = [{ channelData1: "data1" }, { channelData2: "data2" }];
      expect(formatChannelMap(channelIds, results)).toEqual({
        ch1: { channelData1: "data1" },
        ch2: { channelData2: "data2" },
      });
    });

    it("should return an empty object if channelIds and results are empty", () => {
      expect(formatChannelMap([], [])).toEqual({});
    });
  });
});
