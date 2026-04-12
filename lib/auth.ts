import { cookies } from "next/headers";

export async function getSessionMode(): Promise<"owner" | "guest"> {
  const lockEnabled = process.env.APP_LOCK_ENABLED?.toLowerCase() === "true";
  const accessToken = process.env.APP_ACCESS_TOKEN;

  // Dev mode or unconfigured — treat as owner
  if (!lockEnabled || !accessToken) {
    return "owner";
  }

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get("whisky_access")?.value;

  return cookieToken === accessToken ? "owner" : "guest";
}
