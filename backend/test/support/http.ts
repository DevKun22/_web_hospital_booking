import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { Express } from "express";

type JsonRecord = Record<string, any>;

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export type TestHttpResponse = {
  status: number;
  body: JsonRecord;
  headers: Headers;
};

// Chỉ parse JSON khi server khai báo JSON (redirect 302 có body HTML).
const parseBody = (response: Response, text: string): JsonRecord => {
  if (!text || !(response.headers.get("content-type") || "").includes("json")) return {};
  return JSON.parse(text) as JsonRecord;
};

export const startHttpServer = async (app: Express) => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const request = async (
    path: string,
    options: RequestOptions = {},
  ): Promise<TestHttpResponse> => {
    const headers = new Headers(options.headers);
    let body: BodyInit | undefined;

    if (options.body !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(options.body);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      body,
    });
    const responseText = await response.text();

    return {
      status: response.status,
      body: parseBody(response, responseText),
      headers: response.headers,
    };
  };

  return {
    baseUrl,
    request,
    close: () => closeServer(server),
  };
};

export const getCookie = (headers: Headers, name: string) => {
  const cookieHeader = headers.get("set-cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|,\\s*)${name}=([^;]+)`));

  return match?.[1];
};

const closeServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

