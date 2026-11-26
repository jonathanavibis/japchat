import { MongoClient, Db } from "mongodb";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/japchat";

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
  var __mongoosePromise: Promise<typeof mongoose> | undefined;
}

const client = new MongoClient(MONGODB_URI);

/**
 * Returns a connected native MongoClient instance (cached across hot reloads).
 */
export function getMongoClient(): Promise<MongoClient> {
  if (!globalThis.__mongoClientPromise) {
    globalThis.__mongoClientPromise = client.connect();
  }
  return globalThis.__mongoClientPromise;
}

/**
 * Returns the MongoDB Db instance for Better Auth's MongoDB adapter.
 * Note: Better Auth's mongodbAdapter accepts a Db instance synchronously;
 * MongoClient queues operations until connected, or we can call client.db().
 */
export function getMongoDb(): Db {
  return client.db();
}

/**
 * Connects Mongoose using the same MONGODB_URI (cached across hot reloads).
 */
export async function connectMongoose(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  if (!globalThis.__mongoosePromise) {
    globalThis.__mongoosePromise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }
  return globalThis.__mongoosePromise;
}
