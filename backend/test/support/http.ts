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
      body: responseText ? (JSON.parse(responseText) as JsonRecord) : {},
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

