import fs from "fs";
import path from "path";

const workerSource = fs.readFileSync(
  path.join(process.cwd(), "public", "service-worker.js"),
  "utf8"
);

test("offline cache is unique per build and bypasses Safari's stale HTTP cache", () => {
  expect(workerSource).toContain('searchParams.get("v")');
  expect(workerSource).toContain('cache: "reload"');
  expect(workerSource).toContain('cache: "no-store"');
  expect(workerSource).toContain("key !== CACHE_NAME");
  expect(workerSource).toContain("self.skipWaiting()");
  expect(workerSource).toContain("matchCurrentCache");
  expect(workerSource).not.toContain("caches.match(");
  expect(workerSource).toContain("matchapp-shell-v");
  expect(workerSource).toContain("MATCHAPP_OFFLINE_READY");
  expect(workerSource).toContain("requiredShellUrls, true");
  expect(workerSource).toContain('new URL(path, `${baseUrl}/`).href');
});
