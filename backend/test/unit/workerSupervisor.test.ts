import assert from "node:assert/strict";
import test from "node:test";

import {
  ERROR_LOG_INTERVAL_MS,
  QUOTA_RETRY_BASE_MS,
  QUOTA_RETRY_MAX_MS,
  STABLE_AFTER_MS,
  createWorkerSupervisor,
} from "../../src/workers/workerSupervisor.js";

const quotaError = () =>
  new Error("ERR max requests limit exceeded. Limit: 500000, Usage: 500006. See https://upstash.com/docs");

const setup = () => {
  let clock = 1_000_000;
  const timers: { id: number; at: number; callback: () => void; cancelled: boolean }[] = [];
  const logs: { level: string; message: string }[] = [];
  const workers: FakeWorker[] = [];

  class FakeWorker {
    closed = false;
    pauses = 0;
    resumes = 0;
    listener: ((error: Error) => void) | null = null;
    on(_event: "error", listener: (error: Error) => void) {
      this.listener = listener;
    }
    async pause() {
      this.pauses += 1;
    }
    resume() {
      this.resumes += 1;
    }
    async close() {
      this.closed = true;
    }
    emit(error: Error) {
      this.listener?.(error);
    }
  }

  const supervisor = createWorkerSupervisor({
    name: "Test Worker",
    create: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    logger: {
      info: (message) => logs.push({ level: "info", message }),
      warn: (message) => logs.push({ level: "warn", message }),
      error: (message) => logs.push({ level: "error", message }),
    },
    now: () => clock,
    schedule: (callback, delayMs) => {
      const entry = { id: timers.length, at: clock + delayMs, callback, cancelled: false };
      timers.push(entry);
      return () => {
        entry.cancelled = true;
      };
    },
  });

  const advance = (ms: number) => {
    clock += ms;
    for (const entry of timers.filter((item) => !item.cancelled && item.at <= clock).sort((a, b) => a.at - b.at)) {
      entry.cancelled = true;
      entry.callback();
    }
  };

  return { supervisor, workers, logs, advance, pendingTimers: () => timers.filter((item) => !item.cancelled).length };
};

test("a quota error pauses the worker once (never closes it), logs once, and resumes it later", () => {
  const { supervisor, workers, logs, advance } = setup();
  supervisor.start();
  assert.equal(workers.length, 1);

  // Hàng trăm lỗi hạn mức liên tiếp chỉ gây một lần tạm dừng và một dòng log.
  for (let index = 0; index < 300; index += 1) workers[0].emit(quotaError());
  assert.equal(workers[0].pauses, 1);
  // Không đóng worker: đóng sẽ gỡ bộ lắng nghe lỗi và làm sập tiến trình khi socket còn phát lỗi.
  assert.equal(workers[0].closed, false);
  assert.equal(supervisor.isPausedForQuota(), true);
  assert.equal(logs.filter((entry) => entry.level === "warn").length, 1);
  assert.equal(logs.filter((entry) => entry.level === "error").length, 0);

  advance(QUOTA_RETRY_BASE_MS - 1);
  assert.equal(workers[0].resumes, 0);
  advance(1);
  assert.equal(workers[0].resumes, 1);
  assert.equal(workers.length, 1);
  assert.equal(supervisor.isPausedForQuota(), false);
});

test("repeated quota failures back off up to the cap, and stability resets the backoff", () => {
  const { supervisor, workers, advance } = setup();
  supervisor.start();
  const worker = workers[0];

  const expectedDelays = [QUOTA_RETRY_BASE_MS, QUOTA_RETRY_BASE_MS * 2, QUOTA_RETRY_BASE_MS * 4, QUOTA_RETRY_MAX_MS, QUOTA_RETRY_MAX_MS];
  expectedDelays.forEach((delay, index) => {
    worker.emit(quotaError());
    advance(delay - 1);
    assert.equal(worker.resumes, index, "no resume before the delay elapses");
    advance(1);
    assert.equal(worker.resumes, index + 1);
  });

  // Chạy ổn định đủ lâu thì lần lỗi tiếp theo lại bắt đầu từ mức lùi nhỏ nhất.
  advance(STABLE_AFTER_MS);
  worker.emit(quotaError());
  const resumesBefore = worker.resumes;
  advance(QUOTA_RETRY_BASE_MS);
  assert.equal(worker.resumes, resumesBefore + 1);
});

test("other errors are logged at most once per interval with the suppressed count", () => {
  const { supervisor, workers, logs, advance } = setup();
  supervisor.start();

  for (let index = 0; index < 50; index += 1) workers[0].emit(new Error("connect ECONNRESET"));
  assert.equal(logs.filter((entry) => entry.level === "error").length, 1);
  assert.equal(supervisor.isPausedForQuota(), false);
  assert.equal(workers[0].pauses, 0);

  advance(ERROR_LOG_INTERVAL_MS);
  workers[0].emit(new Error("connect ECONNRESET"));
  const errors = logs.filter((entry) => entry.level === "error");
  assert.equal(errors.length, 2);
  assert.match(errors[1].message, /49 lỗi/);
});

test("stop closes the worker and cancels any pending resume", async () => {
  const { supervisor, workers, advance, pendingTimers } = setup();
  supervisor.start();
  workers[0].emit(quotaError());
  await supervisor.stop();
  assert.equal(workers[0].closed, true);
  assert.equal(pendingTimers(), 0);
  advance(QUOTA_RETRY_MAX_MS * 2);
  assert.equal(workers[0].resumes, 0);
});
