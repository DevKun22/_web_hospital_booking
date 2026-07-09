import { Client } from "@elastic/elasticsearch";

const elasticsearchNode = process.env.ELASTICSEARCH_NODE?.trim();
const elasticsearchApiKey = process.env.ELASTICSEARCH_API_KEY?.trim();

export const isElasticsearchEnabled =
  process.env.ELASTICSEARCH_ENABLED === "true" &&
  Boolean(elasticsearchNode && elasticsearchApiKey);

export const elasticsearchIndex =
  process.env.ELASTICSEARCH_INDEX?.trim() || "hospital_public_search";

const rawRequestTimeout = Number(
  process.env.ELASTICSEARCH_REQUEST_TIMEOUT_MS || 700,
);

export const elasticsearchRequestTimeoutMs = Number.isFinite(rawRequestTimeout)
  ? Math.min(Math.max(rawRequestTimeout, 300), 5000)
  : 700;

export const elasticClient = isElasticsearchEnabled
  ? new Client({
      node: elasticsearchNode,
      requestTimeout: elasticsearchRequestTimeoutMs,
      maxRetries: 0,
      auth: {
        apiKey: elasticsearchApiKey!,
      },
    })
  : null;
