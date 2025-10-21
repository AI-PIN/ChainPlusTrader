import { sql } from 'drizzle-orm';
import {
  index,
  uniqueIndex,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - mandatory for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Trade configuration table
export const tradeConfigs = pgTable("trade_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  contractAddress: text("contract_address").notNull(),
  walletAddress: text("wallet_address").notNull(),
  network: varchar("network", { length: 10 }).notNull(), // ETH, BASE, BNB, SOL
  dex: varchar("dex", { length: 20 }).notNull(), // Uniswap, PancakeSwap, Jupiter
  dexVersion: varchar("dex_version", { length: 10 }), // v2, v3 (for BASE Uniswap)
  tradeInterval: varchar("trade_interval", { length: 20 }).notNull(), // 1min, 5min, 10min, etc
  tradeAmountUsd: decimal("trade_amount_usd", { precision: 10, scale: 2 }).notNull(),
  maxGasRatio: decimal("max_gas_ratio", { precision: 3, scale: 2 }).notNull().default("0.80"),
  slippageTolerance: decimal("slippage_tolerance", { precision: 3, scale: 2 }).notNull().default("5.00"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTradeConfigSchema = createInsertSchema(tradeConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  userId: z.string().optional(), // Made optional because backend will provide it
  isActive: z.boolean().default(true), // Auto-activate new configs
});

export type InsertTradeConfig = z.infer<typeof insertTradeConfigSchema>;
export type TradeConfig = typeof tradeConfigs.$inferSelect;

// Trade logs table
export const tradeLogs = pgTable("trade_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  configId: varchar("config_id").references(() => tradeConfigs.id),
  network: varchar("network", { length: 10 }).notNull(),
  dex: varchar("dex", { length: 20 }).notNull(),
  tokenAddress: text("token_address").notNull(),
  tradeType: varchar("trade_type", { length: 20 }).notNull(), // automated, manual
  amountUsd: decimal("amount_usd", { precision: 10, scale: 2 }).notNull(),
  tokenAmount: text("token_amount"),
  gasFee: decimal("gas_fee", { precision: 18, scale: 8 }),
  gasFeeUsd: decimal("gas_fee_usd", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 20 }).notNull(), // pending, success, failed
  txHash: text("tx_hash"),
  errorMessage: text("error_message"),
  slippage: decimal("slippage", { precision: 5, scale: 2 }),
  tokenPrice: decimal("token_price", { precision: 18, scale: 8 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTradeLogSchema = createInsertSchema(tradeLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertTradeLog = z.infer<typeof insertTradeLogSchema>;
export type TradeLog = typeof tradeLogs.$inferSelect;

// Bot status table - now supports one bot per network
export const botStatus = pgTable("bot_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  network: varchar("network", { length: 10 }).notNull(), // ETH, BASE, BNB, SOL
  isRunning: boolean("is_running").notNull().default(false),
  activeConfigId: varchar("active_config_id").references(() => tradeConfigs.id),
  lastTradeAt: timestamp("last_trade_at"),
  nextTradeAt: timestamp("next_trade_at"),
  totalTradesCount: integer("total_trades_count").notNull().default(0),
  successfulTradesCount: integer("successful_trades_count").notNull().default(0),
  failedTradesCount: integer("failed_trades_count").notNull().default(0),
  totalVolumeUsd: decimal("total_volume_usd", { precision: 12, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint: one bot status per user per network
  userNetworkUnique: uniqueIndex("bot_status_user_network_idx").on(table.userId, table.network),
}));

export type BotStatus = typeof botStatus.$inferSelect;
export type InsertBotStatus = typeof botStatus.$inferInsert;

// Network type enum
export const NetworkType = z.enum(['ETH', 'BASE', 'BNB', 'SOL']);
export type NetworkType = z.infer<typeof NetworkType>;

// DEX type enum
export const DexType = z.enum(['Uniswap', 'PancakeSwap', 'Jupiter']);
export type DexType = z.infer<typeof DexType>;

// Trade status enum
export const TradeStatus = z.enum(['pending', 'success', 'failed']);
export type TradeStatus = z.infer<typeof TradeStatus>;

// Manual trade request schema
export const manualTradeSchema = z.object({
  contractAddress: z.string().min(1, "Contract address is required"),
  network: NetworkType,
  dexVersion: z.string().optional(), // 'auto', 'v2', 'v3', 'v4' for ETH/BASE Uniswap
  amountUsd: z.number().min(1, "Amount must be at least $1"),
  slippageTolerance: z.number().min(0.1).max(50).default(5),
});

export type ManualTradeRequest = z.infer<typeof manualTradeSchema>;
