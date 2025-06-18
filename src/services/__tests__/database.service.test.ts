import {
  connectToDatabase,
  disconnectFromDatabase,
  getDb,
} from "../database.service";
import { Db } from "mongodb";

// Define mocks for MongoClient methods before the jest.mock call
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDbMethod = jest.fn().mockReturnValue({} as Db);
const mockClose = jest.fn().mockResolvedValue(undefined);

// Mock MongoClient
jest.mock("mongodb", () => {
  const originalModule = jest.requireActual("mongodb"); // Import and retain original parts
  return {
    ...originalModule, // Spread original module exports
    MongoClient: jest.fn().mockImplementation(() => ({
      connect: mockConnect,
      db: mockDbMethod,
      close: mockClose,
    })),
  };
});

describe("DatabaseService Connection Lifecycle", () => {
  beforeEach(() => {
    // Reset mocks before each test to ensure test isolation
    mockConnect.mockClear();
    mockDbMethod.mockClear();
    mockClose.mockClear();
    // Set a dummy connection string for tests that expect it to be present
    process.env.MDB_MCP_CONNECTION_STRING = "mongodb://dummy-connection-string";
  });

  it("should connect, get DB, and disconnect successfully", async () => {
    // 1. Connect to Database
    await connectToDatabase();
    expect(mockConnect).toHaveBeenCalledTimes(1);

    // 2. Get Db instance
    const dbInstance = getDb();
    expect(mockDbMethod).toHaveBeenCalledTimes(1);
    // Ensure the correct database name is passed to client.db() if applicable
    // For now, checking if it's called and returns the mock is sufficient
    expect(dbInstance).toEqual({}); // It returns the mocked Db object

    // 3. Disconnect from Database
    await disconnectFromDatabase();
    expect(mockClose).toHaveBeenCalledTimes(1);

    // 4. Verify Db is null or getDb throws error
    expect(() => getDb()).toThrow(
      "MongoDB connection not established. Call connectToDatabase() first."
    );
  });

  it("should throw an error if MDB_MCP_CONNECTION_STRING is not set", async () => {
    const originalConnectionString = process.env.MDB_MCP_CONNECTION_STRING;
    delete process.env.MDB_MCP_CONNECTION_STRING; // Or set to undefined

    await expect(connectToDatabase()).rejects.toThrow(
      "Failed to connect to MongoDB: MDB_MCP_CONNECTION_STRING environment variable is required"
    );

    // Restore the original environment variable
    process.env.MDB_MCP_CONNECTION_STRING = originalConnectionString;
  });

  it("should throw an error when getDb is called before connectToDatabase", () => {
    expect(() => getDb()).toThrow(
      "MongoDB connection not established. Call connectToDatabase() first."
    );
  });
});
