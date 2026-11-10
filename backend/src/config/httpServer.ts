import type { Server } from "node:http";
import {
  getHttpHeadersTimeoutMs,
  getHttpKeepAliveTimeoutMs,
  getHttpMaxRequestsPerSocket,
  getHttpRequestTimeoutMs,
} from "./environment.js";

type ConfigurableHttpServer = Pick<
  Server,
  | "headersTimeout"
  | "keepAliveTimeout"
  | "maxRequestsPerSocket"
  | "requestTimeout"
>;

// Giới hạn thời gian nhận request và vòng đời kết nối để một client chậm
// không giữ socket của tiến trình API vô thời hạn.
export const configureHttpServer = (
  server: ConfigurableHttpServer,
  env: NodeJS.ProcessEnv = process.env,
) => {
  const requestTimeout = getHttpRequestTimeoutMs(env);
  server.requestTimeout = requestTimeout;
  server.headersTimeout = Math.min(getHttpHeadersTimeoutMs(env), requestTimeout);
  server.keepAliveTimeout = getHttpKeepAliveTimeoutMs(env);
  server.maxRequestsPerSocket = getHttpMaxRequestsPerSocket(env);
};
