import { headers } from "next/headers";
import { auth, AuthSession } from "./auth";

export async function getApiSession(): Promise<AuthSession | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session ?? null;
  } catch {
    return null;
  }
}
