import { MongoClient, Db } from "mongodb";

const DATABASE_NAME = "youtube_niche_analysis";

// These will hold the single, shared connection promise and client instance.
let connectionPromise: Promise<MongoClient> | null = null;
let mongoClient: MongoClient | null = null;

/**
 * Gets a promise that resolves to the connected MongoClient.
 * This function ensures the connection is only attempted once.
 * @returns A promise that resolves to the connected MongoClient instance.
 */
function getClientPromise(): Promise<MongoClient> {
  // If the promise doesn't exist, create it. This block runs only once.
  if (!connectionPromise) {
    const connectionString = process.env.MDB_MCP_CONNECTION_STRING;
    if (!connectionString) {
      // Use Promise.reject to handle errors in an async context
      return Promise.reject(
        new Error("MDB_MCP_CONNECTION_STRING environment variable is required")
      );
    }

    const client = new MongoClient(connectionString);
    connectionPromise = client.connect().then((connectedClient) => {
      mongoClient = connectedClient; // Store the resolved client
      return connectedClient;
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
