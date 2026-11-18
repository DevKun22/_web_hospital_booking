import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { Worker } from "bullmq";

import { createWorkerSupervisor } from "../../src/workers/workerSupervisor.js";

// Tái hiện lỗi production: Upstash hết hạn mức nên mọi lệnh đều trả "ERR max requests limit exceeded". Dùng BullMQ thật với
// máy chủ Redis giả để bảo đảm tạm dừng worker không làm sập tiến trình (PR trước đóng worker bằng close() thì socket đóng
// phát sự kiện "error" không còn ai lắng nghe và Node thoát với mã 1).

const startFakeQuotaRedis = () =>
  new Promise<{ port: number; close: () => Promise<void>; commands: () => number }>((resolve) => {
    let commands = 0;
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.on("error", () => undefined);
      socket.on("data", (chunk) => {
        const count = Math.max((chunk.toString().match(/^\*/gm) || []).length, 1);
        commands += count;
        for (let index = 0; index < count; index += 1) {
          socket.write("-ERR max requests limit exceeded. Limit: 500000, Usage: 500006. See https://upstash.com/docs\r\n");
        }
      });
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({
        port: (server.address() as net.AddressInfo).port,
        commands: () => commands,
        close: () =>
          new Promise<void>((done) => {
            for (const socket of sockets) socket.destroy();
            server.close(() => done());
          }),
      });
    });
  });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("pausing a real BullMQ worker on a quota error does not crash the process and stops hammering Redis", async () => {
  const fake = await startFakeQuotaRedis();
  // Lỗi không ai bắt có hai dạng, cả hai đều làm Node thoát với mã 1 nếu xảy ra trên production.
  const uncaught: unknown[] = [];
  const onUncaught = (error: unknown) => uncaught.push(error);
  process.on("uncaughtException", onUncaught);
  process.on("unhandledRejection", onUncaught);

  const warnings: string[] = [];
  const supervisor = createWorkerSupervisor({
    name: "Quota Test Worker",
    create: () =>
      new Worker("quota-test", async () => undefined, {
        connection: { host: "127.0.0.1", port: fake.port, maxRetriesPerRequest: null, enableReadyCheck: false },
      }),
    logger: { info: () => undefined, warn: (message) => warnings.push(message), error: () => undefined },
  });

  try {
    supervisor.start();
    const deadline = Date.now() + 5_000;
    while (!supervisor.isPausedForQuota() && Date.now() < deadline) await wait(50);
    assert.equal(supervisor.isPausedForQuota(), true, "worker should pause after the quota error");
    assert.equal(warnings.length, 1);

    // Sau khi tạm dừng, đợi để các sự kiện lỗi muộn (socket đóng, kết nối lại) có cơ hội làm sập tiến trình.
    const commandsAtPause = fake.commands();
    await wait(1_500);
    assert.deepEqual(uncaught, [], "no unhandled error may escape after pausing");
    assert.equal(warnings.length, 1, "the quota warning must not repeat while paused");
    assert.ok(fake.commands() - commandsAtPause < 20, "a paused worker must not keep polling Redis");
  } finally {
    await supervisor.stop().catch(() => undefined);
    process.off("uncaughtException", onUncaught);
    process.off("unhandledRejection", onUncaught);
    await fake.close();
  }
});
