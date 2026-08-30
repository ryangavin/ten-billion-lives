import assert from "node:assert/strict";

import { preview } from "vite";

export async function startProductionPreview() {
  const server = await preview({
    root: "apps/web",
    logLevel: "silent",
    preview: {
      host: "127.0.0.1",
      port: 0,
      strictPort: true,
    },
  });
  const address = server.httpServer.address();
  assert.notEqual(address, null, "production preview address is unavailable");
  assert.notEqual(
    typeof address,
    "string",
    "production preview must use a TCP address",
  );
  const url = `http://127.0.0.1:${address.port}`;
  const response = await fetch(url);
  assert.equal(response.ok, true, `production preview is not ready at ${url}`);
  return {
    close: () => server.close(),
    url,
  };
}
