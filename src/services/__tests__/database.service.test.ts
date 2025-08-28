import { disconnectFromDatabase, getDb } from "../database.service";
import { Db } from "mongodb";

// Define mocks for MongoClient methods before the jest.mock call
const mockDbInstance = {} as Db; // A simple mock Db object
const mockClientInstance = {
  db: jest.fn().mockReturnValue(mockDbInstance),
  close: jest.fn().mockResolvedValue(undefined),
};
const mockConnect = jest.fn().mockResolvedValue(mockClientInstance);

// Mock MongoClient
jest.mock("mongodb", () => {
  const originalModule = jest.requireActual("mongodb"); // Import and retain original parts
  return {
    ...originalModule, // Spread original module exports
    MongoClient: jest.fn().mockImplementation(() => ({
      connect: mockConnect,
      db: mockClientInstance.db, // Use the db method from mockClientInstance
      close: mockClientInstance.close,
    })),
  };
});

describe("DatabaseService Connection Lifecycle", () => {
  beforeEach(() => {
    // Reset mocks before each test to ensure test isolation
    mockConnect.mockClear();
    mockClientInstance.db.mockClear();
    mockClientInstance.close.mockClear();
    // Set a dummy connection string for tests that expect it to be present
    process.env.MDB_MCP_CONNECTION_STRING = "mongodb://dummy-connection-string";
  });

  afterEach(async () => {
    // Ensure disconnect is called to reset the internal state of database.service
    await disconnectFromDatabase();
  });

  it("should connect lazily, get DB, and disconnect successfully", async () => {
    // Initial call to getDb should trigger the connection
    const dbInstance = await getDb();
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockClientInstance.db).toHaveBeenCalledTimes(1);
    expect(dbInstance).toEqual(mockDbInstance);

    // Subsequent call to getDb should not trigger a new connection
    await getDb();
    expect(mockConnect).toHaveBeenCalledTimes(1); // Still 1
    expect(mockClientInstance.db).toHaveBeenCalledTimes(2);

    // Disconnect from Database
    await disconnectFromDatabase();
    expect(mockClientInstance.close).toHaveBeenCalledTimes(1);
  });

  it("should throw an error if MDB_MCP_CONNECTION_STRING is not set", async () => {
    const originalConnectionString = process.env.MDB_MCP_CONNECTION_STRING;
    delete process.env.MDB_MCP_CONNECTION_STRING;

    await expect(getDb()).rejects.toThrow(
      "MDB_MCP_CONNECTION_STRING environment variable is required"
    );

    // Restore the original environment variable
    process.env.MDB_MCP_CONNECTION_STRING = originalConnectionString;
  });

  it("should reconnect after disconnection", async () => {
    await getDb();
    expect(mockConnect).toHaveBeenCalledTimes(1);
    await disconnectFromDatabase();
    expect(mockClientInstance.close).toHaveBeenCalledTimes(1);

    // Calling getDb again should trigger a new connection
    await getDb();
    expect(mockConnect).toHaveBeenCalledTimes(2);
  });
});
