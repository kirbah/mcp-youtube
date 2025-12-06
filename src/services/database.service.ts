import { MongoClient, Db } from "mongodb";

const DATABASE_NAME = "youtube_niche_analysis";

// These will hold the single, shared connection promise and client instance.
let connectionPromise: Promise<MongoClient> | null = null;
let mongoClient: MongoClient | null = null;
let _connectionString: string | null = null; // To store the connection string

/**
 * Initializes the database connection. This should be called once at startup.
 * @param connectionString The MongoDB connection string.
 */
export function initializeDatabase(connectionString: string): void {
  if (!connectionString) {
    throw new Error(
      "MongoDB connection string is required for database initialization."
    );
  }
  _connectionString = connectionString;
}

/**
 * Gets a promise that resolves to the connected MongoClient.
 * This function ensures the connection is only attempted once.
 * @returns A promise that resolves to the connected MongoClient instance.
 */
function getClientPromise(): Promise<MongoClient> {
  // If the promise doesn't exist, create it. This block runs only once.
  if (!connectionPromise) {
    if (!_connectionString) {
      return Promise.reject(
        new Error("Database not initialized. Call initializeDatabase() first.")
      );
    }

    const client = new MongoClient(_connectionString);
    connectionPromise = client
      .connect()
      .then((connectedClient) => {
        mongoClient = connectedClient; // Store the resolved client
        return connectedClient;
      })
      .catch((err) => {
        connectionPromise = null; // Allow for a retry on the next call
        throw err; // Re-throw the original error
      });
  }
  return connectionPromise;
}

/**
 * The new central point for accessing the database.
 * It lazily connects on the first call and returns the Db object.
 * @returns A promise that resolves to the Db instance.
 */
export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(DATABASE_NAME);
}

/**
 * Disconnects from the database if a connection was established.
 */
export async function disconnectFromDatabase(): Promise<void> {
  // We only need to close the client that was successfully connected.
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    connectionPromise = null; // Reset for potential future connections in tests, etc.
  }
}
