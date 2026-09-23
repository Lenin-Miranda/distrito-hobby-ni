import { afterEach, expect, test, vi } from "vitest";
import { fetchHealth } from "./health";

afterEach(() => vi.unstubAllGlobals());

test("validates a successful response and uses an uncached, bounded request", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ status: "ok", service: "distrito-hobby-api" }),
      ),
    );
  vi.stubGlobal("fetch", fetchMock);
  await expect(fetchHealth("http://localhost:4000/api/v1/")).resolves.toEqual({
    status: "ok",
    service: "distrito-hobby-api",
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "http://localhost:4000/api/v1/health",
    expect.objectContaining({
      cache: "no-store",
      signal: expect.any(AbortSignal),
    }),
  );
});

test("rejects HTTP failures without leaking the response body", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("private upstream details", { status: 503 }),
      ),
  );
  await expect(
    fetchHealth("http://localhost:4000/api/v1"),
  ).rejects.toMatchObject({
    code: "http",
    message: "The API health response is unavailable",
  });
});

test("rejects a successful response with the wrong contract", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ status: "wrong" }))),
  );
  await expect(
    fetchHealth("http://localhost:4000/api/v1"),
  ).rejects.toMatchObject({ code: "contract" });
});

test("aborts a request that exceeds the timeout", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(new Error("private network details")),
            { once: true },
          );
        }),
    ),
  );
  await expect(
    fetchHealth("http://localhost:4000/api/v1", 10),
  ).rejects.toMatchObject({ code: "unavailable" });
});
