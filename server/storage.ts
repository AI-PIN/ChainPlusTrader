// Storage implementation - referenced from javascript_database and javascript_log_in_with_replit blueprints
import {
  users,
  tradeConfigs,
  tradeLogs,
  botStatus,
  type User,
  type UpsertUser,
  type TradeConfig,
  type InsertTradeConfig,
  type TradeLog,
  type InsertTradeLog,
  type BotStatus,
  type InsertBotStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Trade config operations
  getActiveConfig(userId: string, network: string): Promise<TradeConfig | undefined>;
  getConfigById(id: string): Promise<TradeConfig | undefined>;
  getAllConfigs(userId: string): Promise<TradeConfig[]>;
  getAllActiveConfigs(userId: string): Promise<TradeConfig[]>;
  createConfig(config: InsertTradeConfig): Promise<TradeConfig>;
  updateConfig(id: string, config: Partial<InsertTradeConfig>): Promise<TradeConfig>;
  deactivateConfigsForNetwork(userId: string, network: string): Promise<void>;
  
  // Trade log operations
  createTradeLog(log: InsertTradeLog): Promise<TradeLog>;
  updateTradeLog(id: string, updates: Partial<InsertTradeLog>): Promise<TradeLog>;
  getRecentTrades(userId: string, limit?: number): Promise<TradeLog[]>;
  getAllTrades(userId: string): Promise<TradeLog[]>;
  getNetworkStats(userId: string): Promise<NetworkStats[]>;
  
  // Bot status operations
  getBotStatus(userId: string, network: string): Promise<BotStatus | undefined>;
  getAllBotStatuses(userId: string): Promise<BotStatus[]>;
  upsertBotStatus(status: InsertBotStatus): Promise<BotStatus>;
  updateBotStatus(userId: string, network: string, updates: Partial<InsertBotStatus>): Promise<BotStatus>;
}

export interface NetworkStats {
  network: string;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalGasFees: string;
  totalGasFeesUsd: string;
  totalVolumeUsd: string;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Trade config operations
  async getActiveConfig(userId: string, network: string): Promise<TradeConfig | undefined> {
    const [config] = await db
      .select()
      .from(tradeConfigs)
      .where(and(
        eq(tradeConfigs.userId, userId),
        eq(tradeConfigs.network, network),
        eq(tradeConfigs.isActive, true)
      ))
      .limit(1);
    return config;
  }

  async getAllActiveConfigs(userId: string): Promise<TradeConfig[]> {
    return await db
      .select()
      .from(tradeConfigs)
      .where(and(
        eq(tradeConfigs.userId, userId),
        eq(tradeConfigs.isActive, true)
      ));
  }

  async getConfigById(id: string): Promise<TradeConfig | undefined> {
    const [config] = await db
      .select()
      .from(tradeConfigs)
      .where(eq(tradeConfigs.id, id));
    return config;
  }

  async getAllConfigs(userId: string): Promise<TradeConfig[]> {
    return await db
      .select()
      .from(tradeConfigs)
      .where(eq(tradeConfigs.userId, userId))
      .orderBy(desc(tradeConfigs.updatedAt));
  }

  async createConfig(config: InsertTradeConfig): Promise<TradeConfig> {
    // Deactivate existing configs for this user on this network
    if (config.userId && config.network) {
      await this.deactivateConfigsForNetwork(config.userId, config.network);
    }
    
    const [newConfig] = await db
      .insert(tradeConfigs)
      .values(config)
      .returning();
    return newConfig;
  }

  async updateConfig(id: string, config: Partial<InsertTradeConfig>): Promise<TradeConfig> {
    const [updated] = await db
      .update(tradeConfigs)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(tradeConfigs.id, id))
      .returning();
    return updated;
  }

  async deactivateConfigsForNetwork(userId: string, network: string): Promise<void> {
    await db
      .update(tradeConfigs)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(tradeConfigs.userId, userId),
        eq(tradeConfigs.network, network)
      ));
  }

  // Trade log operations
  async createTradeLog(log: InsertTradeLog): Promise<TradeLog> {
    const [newLog] = await db
      .insert(tradeLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async updateTradeLog(id: string, updates: Partial<InsertTradeLog>): Promise<TradeLog> {
    const [updated] = await db
      .update(tradeLogs)
      .set(updates)
      .where(eq(tradeLogs.id, id))
      .returning();
    return updated;
  }

  async getRecentTrades(userId: string, limit: number = 10): Promise<TradeLog[]> {
    return await db
      .select()
      .from(tradeLogs)
      .where(eq(tradeLogs.userId, userId))
      .orderBy(desc(tradeLogs.createdAt))
      .limit(limit);
  }

  async getAllTrades(userId: string): Promise<TradeLog[]> {
    return await db
      .select()
      .from(tradeLogs)
      .where(eq(tradeLogs.userId, userId))
      .orderBy(desc(tradeLogs.createdAt));
  }

  async getNetworkStats(userId: string): Promise<NetworkStats[]> {
    const trades = await this.getAllTrades(userId);
    
    // Group trades by network
    const networkMap = new Map<string, {
      totalTrades: number;
      successfulTrades: number;
      failedTrades: number;
      totalGasFees: number;
      totalGasFeesUsd: number;
      totalVolumeUsd: number;
    }>();

    // Initialize stats for all networks
    ['ETH', 'BASE', 'BNB', 'SOL'].forEach(network => {
      networkMap.set(network, {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        totalGasFees: 0,
        totalGasFeesUsd: 0,
        totalVolumeUsd: 0,
      });
    });

    // Aggregate stats
    trades.forEach(trade => {
      const stats = networkMap.get(trade.network);
      if (stats) {
        stats.totalTrades++;
        if (trade.status === 'success') {
          stats.successfulTrades++;
        } else if (trade.status === 'failed') {
          stats.failedTrades++;
        }
        stats.totalGasFees += parseFloat(trade.gasFee || '0');
        stats.totalGasFeesUsd += parseFloat(trade.gasFeeUsd || '0');
        stats.totalVolumeUsd += parseFloat(trade.amountUsd || '0');
      }
    });

    // Convert to array
    return Array.from(networkMap.entries()).map(([network, stats]) => ({
      network,
      totalTrades: stats.totalTrades,
      successfulTrades: stats.successfulTrades,
      failedTrades: stats.failedTrades,
      totalGasFees: stats.totalGasFees.toFixed(8),
      totalGasFeesUsd: stats.totalGasFeesUsd.toFixed(2),
      totalVolumeUsd: stats.totalVolumeUsd.toFixed(2),
    }));
  }

  // Bot status operations
  async getBotStatus(userId: string, network: string): Promise<BotStatus | undefined> {
    const [status] = await db
      .select()
      .from(botStatus)
      .where(and(
        eq(botStatus.userId, userId),
        eq(botStatus.network, network)
      ));
    return status;
  }

  async getAllBotStatuses(userId: string): Promise<BotStatus[]> {
    return await db
      .select()
      .from(botStatus)
      .where(eq(botStatus.userId, userId));
  }

  async upsertBotStatus(status: InsertBotStatus): Promise<BotStatus> {
    const existing = await this.getBotStatus(status.userId!, status.network!);
    
    if (existing) {
      const [updated] = await db
        .update(botStatus)
        .set({ ...status, updatedAt: new Date() })
        .where(and(
          eq(botStatus.userId, status.userId!),
          eq(botStatus.network, status.network!)
        ))
        .returning();
      return updated;
    } else {
      const [result] = await db
        .insert(botStatus)
        .values(status)
        .returning();
      return result;
    }
  }

  async updateBotStatus(userId: string, network: string, updates: Partial<InsertBotStatus>): Promise<BotStatus> {
    const [updated] = await db
      .update(botStatus)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(botStatus.userId, userId),
        eq(botStatus.network, network)
      ))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
