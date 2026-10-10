import "dotenv/config";

import { validateRuntimeEnvironment } from "./config/environment.js";

validateRuntimeEnvironment();

const [{ createApp }, { prisma }] = await Promise.all([
  import("./app.js"),
  import("./config/prisma.js"),
]);

const app = createApp();

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Force shutdown after timeout");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
