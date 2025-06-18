import { MongoClient, Db } from "mongodb";

const DATABASE_NAME = "youtube_niche_analysis";
let mongoClient: MongoClient;
let db: Db | null = null;

export async function connectToDatabase(): Promise<void> {
  try {
    const connectionString = process.env.MDB_MCP_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error(
        "MDB_MCP_CONNECTION_STRING environment variable is required"
      );
    }
    mongoClient = new MongoClient(connectionString);
    await mongoClient.connect();
    db = mongoClient.db(DATABASE_NAME);
  } catch (error) {
    throw new Error(
      `MDB_MCP_CONNECTION_STRING environment variable is required`,
      { cause: error }
    );
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  try {
    if (mongoClient) {
      await mongoClient.close();
      db = null;
    }
  } catch (error) {
    throw new Error(`Failed to disconnect from MongoDB`, { cause: error });
  }
}

export function getDb(): Db {
  if (!db) {
    throw new Error(
      "MongoDB connection not established. Call connectToDatabase() first."
    );
  }
  return db;
}
