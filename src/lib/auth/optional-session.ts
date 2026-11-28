import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function resolveOptionalUserId(
  logLabel: string
): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    return session?.user?.id ?? null;
  } catch (err) {
    console.error(`[${logLabel}] Session error:`, err);
    if (process.env.NODE_ENV === "production") {
      throw err;
    }
    return null;
  }
}
