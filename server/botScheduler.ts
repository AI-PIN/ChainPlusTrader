import cron, { type ScheduledTask } from 'node-cron';
import { storage } from './storage';
import { tradingService } from './tradingService';
import type { TradeConfig } from '@shared/schema';

class BotScheduler {
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private broadcaster: ((userId: string, data: any) => void) | null = null;
  private readonly intervalMap: Record<string, string> = {
    '1min': '*/1 * * * *',
    '5min': '*/5 * * * *',
    '10min': '*/10 * * * *',
    '30min': '*/30 * * * *',
    '1hour': '0 * * * *',
  };

  private getBotKey(userId: string, network: string): string {
    return `${userId}:${network}`;
  }

  setBroadcaster(broadcaster: (userId: string, data: any) => void) {
    this.broadcaster = broadcaster;
  }

  async startBot(userId: string, config: TradeConfig): Promise<void> {
    const botKey = this.getBotKey(userId, config.network);
    
    // Stop existing bot for this network if running
    this.stopBot(userId, config.network);

    const cronExpression = this.intervalMap[config.tradeInterval];
    if (!cronExpression) {
      throw new Error(`Invalid trade interval: ${config.tradeInterval}`);
    }

    // Create scheduled task
    const task = cron.schedule(cronExpression, async () => {
      await this.executeTrade(userId, config);
    });

    this.scheduledTasks.set(botKey, task);

    // Update bot status
    await storage.upsertBotStatus({
      userId,
      network: config.network,
      isRunning: true,
      activeConfigId: config.id,
      nextTradeAt: this.calculateNextTradeTime(config.tradeInterval),
      updatedAt: new Date(),
    });

    console.log(`Bot started for user ${userId} on ${config.network} with interval ${config.tradeInterval}`);
  }

  stopBot(userId: string, network: string): void {
    const botKey = this.getBotKey(userId, network);
    const task = this.scheduledTasks.get(botKey);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(botKey);
      console.log(`Bot stopped for user ${userId} on ${network}`);
    }
  }

  stopAllBots(userId: string): void {
    // Stop all bots for this user across all networks
    const networks = ['ETH', 'BASE', 'BNB', 'SOL'];
    networks.forEach(network => this.stopBot(userId, network));
  }

  async executeTrade(userId: string, config: TradeConfig): Promise<void> {
    console.log(`Executing automated trade for user ${userId}`);

    // Create pending trade log
    const tradeLog = await storage.createTradeLog({
      userId,
      configId: config.id,
      network: config.network,
      dex: config.dex,
      tokenAddress: config.contractAddress,
      tradeType: 'automated',
      amountUsd: config.tradeAmountUsd.toString(),
      status: 'pending',
    });

    try {
      // Execute the trade
      const result = await tradingService.executeTrade({
        network: config.network as any,
        dex: config.dex as any,
        dexVersion: config.dexVersion || undefined,
        tokenAddress: config.contractAddress,
        amountUsd: parseFloat(config.tradeAmountUsd.toString()),
        slippageTolerance: parseFloat(config.slippageTolerance.toString()),
        maxGasRatio: parseFloat(config.maxGasRatio.toString()),
      });

      // Update trade log with result
      await storage.updateTradeLog(tradeLog.id, {
        status: result.success ? 'success' : 'failed',
        txHash: result.txHash,
        tokenAmount: result.tokenAmount,
        gasFee: result.gasFee,
        gasFeeUsd: result.gasFeeUsd,
        tokenPrice: result.tokenPrice,
        slippage: result.slippage,
        errorMessage: result.errorMessage,
      });

      // Update bot status
      const botStatus = await storage.getBotStatus(userId, config.network);
      if (botStatus) {
        await storage.updateBotStatus(userId, config.network, {
          lastTradeAt: new Date(),
          nextTradeAt: this.calculateNextTradeTime(config.tradeInterval),
          totalTradesCount: botStatus.totalTradesCount + 1,
          successfulTradesCount: result.success 
            ? botStatus.successfulTradesCount + 1 
            : botStatus.successfulTradesCount,
          failedTradesCount: result.success 
            ? botStatus.failedTradesCount 
            : botStatus.failedTradesCount + 1,
          totalVolumeUsd: result.success 
            ? (parseFloat(botStatus.totalVolumeUsd.toString()) + parseFloat(config.tradeAmountUsd.toString())).toFixed(2)
            : botStatus.totalVolumeUsd,
        });
      }

      // Broadcast updates via WebSocket
      if (this.broadcaster) {
        this.broadcaster(userId, { type: 'new_trade' });
        this.broadcaster(userId, { type: 'bot_status' });
      }

      console.log(`Trade ${result.success ? 'succeeded' : 'failed'} for user ${userId}:`, result);
    } catch (error: any) {
      console.error('Trade execution error:', error);
      
      await storage.updateTradeLog(tradeLog.id, {
        status: 'failed',
        errorMessage: error.message || 'Unknown error',
      });
    }
  }

  private calculateNextTradeTime(interval: string): Date {
    const now = new Date();
    const minutes = parseInt(interval.replace(/\D/g, ''));
    
    if (interval.includes('hour')) {
      now.setHours(now.getHours() + minutes);
    } else {
      now.setMinutes(now.getMinutes() + minutes);
    }
    
    return now;
  }

  isRunning(userId: string, network: string): boolean {
    const botKey = this.getBotKey(userId, network);
    return this.scheduledTasks.has(botKey);
  }

  getRunningNetworks(userId: string): string[] {
    const networks = ['ETH', 'BASE', 'BNB', 'SOL'];
    return networks.filter(network => this.isRunning(userId, network));
  }
}

export const botScheduler = new BotScheduler();
