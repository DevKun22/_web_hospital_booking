import "dotenv/config";

type Probe = {
  name: string;
  path: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  requiresAuth?: boolean;
};

type Sample = {
  durationMs: number;
  status: number;
  databaseQueryCount?: number;
};

const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const baseUrl = (process.env.BENCHMARK_BASE_URL || "http://127.0.0.1:4000/api/v1")
  .trim()
  .replace(/\/$/, "");
const iterations = Math.min(
  positiveInteger(process.env.BENCHMARK_ITERATIONS, 20),
  200,
);
const warmupIterations = Math.min(
  positiveInteger(process.env.BENCHMARK_WARMUP_ITERATIONS, 3),
  20,
);
const bearerToken = process.env.BENCHMARK_BEARER_TOKEN?.trim();
const appointmentId = process.env.BENCHMARK_APPOINTMENT_ID?.trim();
const includeChatbotMessage =
  process.env.BENCHMARK_INCLUDE_CHATBOT_MESSAGE?.trim().toLowerCase() === "true";

const probes: Probe[] = [
  { name: "Home - banner", path: "/banners?position=HOME_HERO" },
  { name: "Home - chuyên khoa", path: "/departments" },
  { name: "Home - bác sĩ", path: "/doctors?includeHighlights=true" },
  { name: "Home - gói khám", path: "/packages" },
  { name: "Home - FAQ", path: "/faqs" },
  { name: "Home - cấu hình", path: "/site-settings" },
  { name: "Chatbot - cấu hình", path: "/chatbot/settings" },
];

if (bearerToken) {
  probes.push(
    { name: "Lịch hẹn - danh sách", path: "/me/appointments?page=1&limit=20", requiresAuth: true },
    { name: "Thông báo - danh sách", path: "/me/notifications?page=1&limit=20", requiresAuth: true },
    { name: "Thông báo - chưa đọc", path: "/me/notifications/unread-count", requiresAuth: true },
  );
}

if (bearerToken && appointmentId) {
  probes.push({
    name: "Lịch hẹn - chi tiết",
    path: `/me/appointments/${encodeURIComponent(appointmentId)}`,
    requiresAuth: true,
  });
}

if (includeChatbotMessage) {
  probes.push({
    name: "Chatbot - tin nhắn",
    path: "/chatbot/message",
    method: "POST",
    body: { message: "Tôi muốn tìm hiểu cách đặt lịch khám" },
  });
}

const percentile = (values: number[], percentileValue: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1);
  return sorted[index] ?? 0;
};

const runProbe = async (probe: Probe): Promise<Sample> => {
  const headers = new Headers({ accept: "application/json" });
  if (probe.requiresAuth && bearerToken) {
    headers.set("authorization", `Bearer ${bearerToken}`);
  }
  if (probe.body) headers.set("content-type", "application/json");

  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${probe.path}`, {
    method: probe.method || "GET",
    headers,
    body: probe.body ? JSON.stringify(probe.body) : undefined,
  });
  await response.arrayBuffer();

  const queryCountHeader = response.headers.get("x-database-query-count");
  const databaseQueryCount = queryCountHeader === null
    ? undefined
    : Number(queryCountHeader);

  return {
    durationMs: performance.now() - startedAt,
    status: response.status,
    databaseQueryCount: Number.isFinite(databaseQueryCount)
      ? databaseQueryCount
      : undefined,
  };
};

console.log(
  `[benchmark] base=${baseUrl} warmup=${warmupIterations} iterations=${iterations}`,
);
console.log("| Luồng API | OK | p50 | p95 | Trung bình | DB queries |");
console.log("|---|---:|---:|---:|---:|---:|");

let hasFailures = false;
for (const probe of probes) {
  for (let index = 0; index < warmupIterations; index += 1) {
    await runProbe(probe);
  }

  const samples: Sample[] = [];
  for (let index = 0; index < iterations; index += 1) {
    samples.push(await runProbe(probe));
  }

  const successful = samples.filter(
    (sample) => sample.status >= 200 && sample.status < 400,
  );
  const durations = successful.map((sample) => sample.durationMs);
  const queryCounts = successful
    .map((sample) => sample.databaseQueryCount)
    .filter((value): value is number => value !== undefined);

  if (successful.length !== samples.length) hasFailures = true;
  const average = durations.length
    ? durations.reduce((sum, value) => sum + value, 0) / durations.length
    : 0;
  const averageQueryCount = queryCounts.length
    ? queryCounts.reduce((sum, value) => sum + value, 0) / queryCounts.length
    : undefined;

  console.log(
    `| ${probe.name} | ${successful.length}/${samples.length} | ${percentile(durations, 0.5).toFixed(1)} ms | ${percentile(durations, 0.95).toFixed(1)} ms | ${average.toFixed(1)} ms | ${averageQueryCount?.toFixed(1) ?? "tắt"} |`,
  );
}

if (!bearerToken) {
  console.log("[benchmark] Bỏ qua lịch hẹn/thông báo: chưa có BENCHMARK_BEARER_TOKEN.");
}
if (!includeChatbotMessage) {
  console.log(
    "[benchmark] Chỉ đo cấu hình chatbot; đặt BENCHMARK_INCLUDE_CHATBOT_MESSAGE=true nếu chấp nhận tạo log và gọi AI.",
  );
}

if (hasFailures) process.exitCode = 1;
