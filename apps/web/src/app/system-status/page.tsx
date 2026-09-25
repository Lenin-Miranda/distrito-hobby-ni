import type { Metadata } from "next";
import { connection } from "next/server";
import { getInternalApiBaseUrl } from "@/config/server";
import { fetchHealth } from "@/lib/api/health";
import { fetchReady } from "@/lib/api/ready";

export const metadata: Metadata = {
  title: "System status | Distrito Hobby",
  robots: { index: false, follow: false },
};

export default async function SystemStatusPage() {
  await connection();
  let available = false;
  let databaseReady = false;
  try {
    await fetchHealth(getInternalApiBaseUrl());
    available = true;
    databaseReady = await fetchReady(getInternalApiBaseUrl());
  } catch {
    // Transport and configuration details stay on the server.
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight">System status</h1>
        <p role="status" className="mt-5 text-lg text-muted-foreground">
          {available
            ? "API available"
            : "API unavailable. Please try again later."}
        </p>
        <p className="mt-3 text-muted-foreground">
          {databaseReady
            ? "Database ready"
            : "Database unavailable or disabled"}
        </p>
      </div>
    </main>
  );
}
