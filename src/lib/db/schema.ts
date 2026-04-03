import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  bigint,
  pgEnum,
} from "drizzle-orm/pg-core";

export const providerStatusEnum = pgEnum("provider_status", [
  "active",
  "inactive",
  "error",
]);

export const authTypeEnum = pgEnum("auth_type", [
  "cookie",
  "token",
  "api_key",
]);

export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  baseUrl: text("base_url").notNull(),
  authType: authTypeEnum("auth_type").notNull().default("cookie"),
  authData: jsonb("auth_data").$type<Record<string, unknown>>().default({}),
  status: providerStatusEnum("status").notNull().default("active"),
  quotaUrl: text("quota_url"),
  quotaCheckInterval: integer("quota_check_interval").default(3600), // seconds
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const models = pgTable("models", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id")
    .notNull()
    .references(() => providers.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  modelId: varchar("model_id", { length: 100 }).notNull().unique(),
  upstreamModel: varchar("upstream_model", { length: 100 }),
  supportsVision: boolean("supports_vision").notNull().default(false),
  supportsImageGen: boolean("supports_image_gen").notNull().default(false),
  maxTokens: integer("max_tokens").default(4096),
  status: providerStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  allowedModels: jsonb("allowed_models").$type<string[]>().default([]),
  rateLimit: integer("rate_limit").default(60), // requests per minute
  monthlyQuota: bigint("monthly_quota", { mode: "number" }).default(0), // 0 = unlimited
  usedQuota: bigint("used_quota", { mode: "number" }).notNull().default(0),
  status: providerStatusEnum("status").notNull().default("active"),
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usageLogs = pgTable("usage_logs", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").references(() => apiKeys.id, {
    onDelete: "set null",
  }),
  modelId: varchar("model_id", { length: 100 }).notNull(),
  providerId: integer("provider_id").references(() => providers.id, {
    onDelete: "set null",
  }),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  latencyMs: integer("latency_ms"),
  status: varchar("status", { length: 20 }).notNull().default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const quotaSnapshots = pgTable("quota_snapshots", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id")
    .notNull()
    .references(() => providers.id, { onDelete: "cascade" }),
  totalQuota: bigint("total_quota", { mode: "number" }),
  usedQuota: bigint("used_quota", { mode: "number" }),
  remaining: bigint("remaining", { mode: "number" }),
  snapshotType: varchar("snapshot_type", { length: 20 })
    .notNull()
    .default("calculated"),
  rawData: jsonb("raw_data").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Type exports
export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type UsageLog = typeof usageLogs.$inferSelect;
export type QuotaSnapshot = typeof quotaSnapshots.$inferSelect;
