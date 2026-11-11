import "dotenv/config";

import { validateRuntimeEnvironment } from "./config/environment.js";
import { configureHttpServer } from "./config/httpServer.js";

validateRuntimeEnvironment();

const [{ createApp }, { prisma }] = await Promise.all([
  import("./app.js"),
  import("./config/prisma.js"),
]);
const { closeRbacInvalidation } = await import(
  "./services/rbacInvalidation.service.js"
);

const app = createApp();

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});
configureHttpServer(server);

// Gói free chỉ có một tiến trình: cho phép chạy worker OTP/lịch hẹn ngay tại đây.
const { startInlineWorkers } = await import("./workers/inline.js");
void startInlineWorkers();

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);

  server.close(async () => {
    await closeRbacInvalidation();
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
