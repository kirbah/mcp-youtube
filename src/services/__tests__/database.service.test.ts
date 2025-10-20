// --- 1. Mock the 'mongodb' library ---
// We provide a mock implementation for MongoClient and its methods.
const mockConnect = jest.fn();
const mockDb = jest.fn();
const mockClose = jest.fn();

// This is the mock MongoClient constructor
const mockMongoClient = jest.fn(() => ({
  connect: mockConnect,
  db: mockDb,
  close: mockClose,
}));

jest.mock("mongodb", () => {
  // This replaces the actual 'mongodb' library with our mock version
  return {
    MongoClient: mockMongoClient,
  };
});

// --- 2. Import the *actual* service functions we want to test ---
import * as dbService from "../database.service";
import { Db } from "mongodb";

describe("DatabaseService Lifecycle", () => {
  const MOCK_DB_NAME = "youtube_niche_analysis";
  const MOCK_CONN_STRING = "mongodb://test-connection";
  const mockDbInstance = {} as Db; // A dummy Db object for our mock to return

  let mockClientInstance: any;

  beforeEach(() => {
    // Reset mocks as before
    mockMongoClient.mockClear();
    mockConnect.mockClear();
    mockDb.mockClear();
    mockClose.mockClear();

    // Create a single, consistent instance for the test
    mockClientInstance = {
      connect: mockConnect,
      db: mockDb,
      close: mockClose,
    };

    // The constructor mock now returns this specific instance
    mockMongoClient.mockReturnValue(mockClientInstance);

    // The connect mock now resolves with that same instance
    mockConnect.mockResolvedValue(mockClientInstance);

    mockDb.mockReturnValue(mockDbInstance);
  });

  afterEach(async () => {
    // --- 3. This is CRITICAL for test isolation ---
    // Use the real disconnect function to reset the singleton's internal state
    await dbService.disconnectFromDatabase();
  });

  it("should throw an error if getDb is called before initialization", async () => {
    // We expect the real getDb function to reject because _connectionString is null
    await expect(dbService.getDb()).rejects.toThrow(
      "Database not initialized. Call initializeDatabase() first."
    );
  });

  it("should initialize, connect lazily on first getDb call, and return the db instance", async () => {
    // Initialize the service with our test connection string
    dbService.initializeDatabase(MOCK_CONN_STRING);

    // At this point, no connection should have been made yet
    expect(mockConnect).not.toHaveBeenCalled();

    // The first call to getDb should trigger the connection
    const db = await dbService.getDb();

    // Now, we verify the actual logic ran
    expect(mockMongoClient).toHaveBeenCalledWith(MOCK_CONN_STRING);
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockDb).toHaveBeenCalledWith(MOCK_DB_NAME);
    expect(db).toBe(mockDbInstance);
  });

  it("should reuse the existing connection promise on subsequent calls", async () => {
    dbService.initializeDatabase(MOCK_CONN_STRING);

    // Call getDb multiple times
    await dbService.getDb();
    await dbService.getDb();
    const db = await dbService.getDb();

    // The core test of the singleton: connect should only be called ONCE
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(db).toBe(mockDbInstance);
  });

  it("should handle connection failure and allow for a retry", async () => {
    dbService.initializeDatabase(MOCK_CONN_STRING);

    // --- 1. Simulate a failure ---
    // Use mockRejectedValueOnce to make the first call fail
    mockConnect.mockRejectedValueOnce(new Error("Connection failed"));

    // Expect the first call to getDb to fail
    await expect(dbService.getDb()).rejects.toThrow("Connection failed");

    // Verify that the connection was attempted
    expect(mockConnect).toHaveBeenCalledTimes(1);

    // --- 2. Simulate a success on the next try ---
    // The service should have reset its promise, so a second call should try again.
    // Our beforeEach already configured the default mock to succeed.
    await expect(dbService.getDb()).resolves.toBe(mockDbInstance);

    // The critical assertion: connect was called a SECOND time.
    expect(mockConnect).toHaveBeenCalledTimes(2);
  });

  it("should handle concurrent calls by creating only one connection", async () => {
    dbService.initializeDatabase(MOCK_CONN_STRING);

    // Fire off two calls to getDb concurrently without awaiting them individually
    const promise1 = dbService.getDb();
    const promise2 = dbService.getDb();

    // Await them both together
    const [db1, db2] = await Promise.all([promise1, promise2]);

    // The critical assertion: connect was only ever called ONCE for both.
    expect(mockConnect).toHaveBeenCalledTimes(1);

    // And both calls resolved to the exact same Db instance.
    expect(db1).toBe(mockDbInstance);
    expect(db2).toBe(mockDbInstance);
  });

  it("should disconnect and allow for a new connection", async () => {
    dbService.initializeDatabase(MOCK_CONN_STRING);

    // First connection
    await dbService.getDb();
    expect(mockConnect).toHaveBeenCalledTimes(1);

    // Disconnect using the real service function
    await dbService.disconnectFromDatabase();
    expect(mockClose).toHaveBeenCalledTimes(1);

    // Re-initialize and connect again
    dbService.initializeDatabase("mongodb://new-string");
    await dbService.getDb();

    // A new connection should have been made
    expect(mockConnect).toHaveBeenCalledTimes(2); // Called once before, once now
    expect(mockMongoClient).toHaveBeenCalledWith("mongodb://new-string");
  });
});
