import { createServer } from "node:http";

const resolveListenTarget = () => {
  const portValue = process.env.PORT?.trim();
  if (portValue) {
    const numeric = Number.parseInt(portValue, 10);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }

    return portValue;
  }

  const webhookValue = process.env.WEBHOOK_PORT?.trim();
  if (webhookValue) {
    const numeric = Number.parseInt(webhookValue, 10);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }

    return webhookValue;
  }

  return 3101;
};

const listenTarget = resolveListenTarget();

const server = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "devbot-web", pid: process.pid, ts: Date.now() }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

if (typeof listenTarget === "number") {
  server.listen(listenTarget, "0.0.0.0", () => {
    console.log(`[devbot-web] listening on ${listenTarget}`);
  });
} else {
  server.listen(listenTarget, () => {
    console.log(`[devbot-web] listening on ${listenTarget}`);
  });
}
