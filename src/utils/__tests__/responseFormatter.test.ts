import { formatSuccess, formatVideoMap, formatChannelMap } from '../responseFormatter';

describe('responseFormatter', () => {
  describe('formatSuccess', () => {
    it('should format an object with message and data', () => {
      const data = { message: "Success!", data: { id: 1, value: "test" } };
      expect(formatSuccess(data)).toEqual({
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      });
    });

    it('should format an array payload', () => {
      const data = ["item1", "item2", { nested: true }];
      expect(formatSuccess(data)).toEqual({
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      });
    });

    it('should format a null payload', () => {
      const data = null;
      expect(formatSuccess(data)).toEqual({
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      });
    });
  });

  describe('formatVideoMap', () => {
    it('should map video IDs to video results', () => {
      const videoIds = ["v1", "v2", "v3"];
      const results = [{ id: "v1", title: "Video 1" }, { id: "v2", title: "Video 2" }, { id: "v3", title: "Video 3" }];
      expect(formatVideoMap(videoIds, results)).toEqual({
        "v1": { id: "v1", title: "Video 1" },
        "v2": { id: "v2", title: "Video 2" },
        "v3": { id: "v3", title: "Video 3" },
      });
    });

    it('should return an empty object for empty inputs', () => {
      const videoIds = [];
      const results = [];
      expect(formatVideoMap(videoIds, results)).toEqual({});
    });

    it('should correctly map a single video with complex data', () => {
      const videoIds = ["v1"];
      const results = [{ id: "v1", data: { stats: [1, 2, 3] } }];
      expect(formatVideoMap(videoIds, results)).toEqual({
        "v1": { id: "v1", data: { stats: [1, 2, 3] } },
      });
    });
  });

  describe('formatChannelMap', () => {
    it('should map channel IDs to channel results', () => {
      const channelIds = ["c1", "c2"];
      const results = [{ id: "c1", name: "Channel 1" }, { id: "c2", name: "Channel 2" }];
      expect(formatChannelMap(channelIds, results)).toEqual({
        "c1": { id: "c1", name: "Channel 1" },
        "c2": { id: "c2", name: "Channel 2" },
      });
    });

    it('should return an empty object for empty inputs', () => {
      const channelIds = [];
      const results = [];
      expect(formatChannelMap(channelIds, results)).toEqual({});
    });

    it('should correctly map a single channel with complex details', () => {
      const channelIds = ["chX"];
      const results = [{ id: "chX", details: { subscribers: 1000 } }];
      expect(formatChannelMap(channelIds, results)).toEqual({
        "chX": { id: "chX", details: { subscribers: 1000 } },
      });
    });
  });
});
