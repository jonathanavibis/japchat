import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { getMongoDb } from "./db";

const resolvedBaseURL =
  process.env.VERCEL === "1"
    ? process.env.BETTER_AUTH_URL && !process.env.BETTER_AUTH_URL.includes("localhost")
      ? process.env.BETTER_AUTH_URL
      : undefined
    : process.env.BETTER_AUTH_URL || "http://localhost:3000";

export const auth = betterAuth({
  database: mongodbAdapter(getMongoDb()),
  secret: process.env.BETTER_AUTH_SECRET,
  ...(resolvedBaseURL ? { baseURL: resolvedBaseURL } : {}),
  trustedOrigins: ["http://localhost:3000", "https://*.vercel.app", "https://japchat.vercel.app"],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  user: {
    additionalFields: {
      bio: {
        type: "string",
        required: false,
        defaultValue: "Hey there! I am using JapChat.",
      },
      lastSeen: {
        type: "date",
        required: false,
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
