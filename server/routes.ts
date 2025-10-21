// API routes with auth, WebSocket, and trading endpoints - referenced from blueprints
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { tradingService } from "./tradingService";
import { botScheduler } from "./botScheduler";
import { insertTradeConfigSchema, manualTradeSchema } from "@shared/schema";

// WebSocket clients map
const wsClients = new Map<string, Set<WebSocket>>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // ==================== Auth Routes ====================
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ==================== Bot Control Routes ====================
  app.get("/api/bot/statuses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const statuses = await storage.getAllBotStatuses(userId);
      res.json(statuses);
    } catch (error) {
      console.error("Error fetching bot statuses:", error);
      res.status(500).json({ message: "Failed to fetch bot statuses" });
    }
  });

  app.post("/api/bot/start", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { network } = req.body;

      if (!network) {
        return res.status(400).json({ message: "Network is required" });
      }

      const activeConfig = await storage.getActiveConfig(userId, network);

      if (!activeConfig) {
        return res.status(400).json({ message: `No active configuration found for ${network}. Please create a trading configuration first.` });
      }

      await botScheduler.startBot(userId, activeConfig);

      // Broadcast status update
      broadcastToUser(userId, { type: 'bot_status', network, isRunning: true });

      res.json({ message: `Bot started successfully on ${network}` });
    } catch (error: any) {
      console.error("Error starting bot:", error);
      res.status(500).json({ message: error.message || "Failed to start bot" });
    }
  });

  app.post("/api/bot/stop", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { network } = req.body;

      if (!network) {
        return res.status(400).json({ message: "Network is required" });
      }
      
      botScheduler.stopBot(userId, network);
      
      await storage.updateBotStatus(userId, network, {
        isRunning: false,
        nextTradeAt: null,
      });

      // Broadcast status update
      broadcastToUser(userId, { type: 'bot_status', network, isRunning: false });

      res.json({ message: `Bot stopped successfully on ${network}` });
    } catch (error: any) {
      console.error("Error stopping bot:", error);
      res.status(500).json({ message: error.message || "Failed to stop bot" });
    }
  });

  // ==================== Configuration Routes ====================
  app.get("/api/configs/active", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { network } = req.query;
      
      if (!network) {
        // Return all active configs if no network specified
        const configs = await storage.getAllActiveConfigs(userId);
        res.json(configs);
      } else {
        const config = await storage.getActiveConfig(userId, network as string);
        res.json(config || null);
      }
    } catch (error) {
      console.error("Error fetching active config:", error);
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  app.get("/api/configs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const configs = await storage.getAllConfigs(userId);
      res.json(configs);
    } catch (error) {
      console.error("Error fetching configs:", error);
      res.status(500).json({ message: "Failed to fetch configurations" });
    }
  });

  app.post("/api/configs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validatedData = insertTradeConfigSchema.parse({
        ...req.body,
        userId,
      });

      // Create new config (this deactivates existing configs for this network)
      const config = await storage.createConfig(validatedData);

      // If bot is running on this network, restart with new config
      if (botScheduler.isRunning(userId, config.network)) {
        await botScheduler.stopBot(userId, config.network);
        if (config.isActive) {
          await botScheduler.startBot(userId, config);
        }
      }

      res.json(config);
    } catch (error: any) {
      console.error("Error creating config:", error);
      res.status(400).json({ message: error.message || "Failed to create configuration" });
    }
  });

  // ==================== Trade Routes ====================
  app.get("/api/trades/recent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const trades = await storage.getRecentTrades(userId, 10);
      res.json(trades);
    } catch (error) {
      console.error("Error fetching recent trades:", error);
      res.status(500).json({ message: "Failed to fetch recent trades" });
    }
  });

  app.get("/api/trades", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const trades = await storage.getAllTrades(userId);
      res.json(trades);
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  app.get("/api/trades/network-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getNetworkStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching network stats:", error);
      res.status(500).json({ message: "Failed to fetch network stats" });
    }
  });

  app.post("/api/trades/manual", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request
      const validatedData = manualTradeSchema.parse(req.body);

      // Determine DEX based on network
      const dexMap: Record<string, string> = {
        ETH: 'Uniswap',
        BASE: 'Uniswap',
        BNB: 'PancakeSwap',
        SOL: 'Jupiter',
      };

      // Create pending trade log
      const tradeLog = await storage.createTradeLog({
        userId,
        network: validatedData.network,
        dex: dexMap[validatedData.network],
        tokenAddress: validatedData.contractAddress,
        tradeType: 'manual',
        amountUsd: validatedData.amountUsd.toString(),
        status: 'pending',
      });

      // Execute trade
      const result = await tradingService.executeTrade({
        network: validatedData.network,
        dex: dexMap[validatedData.network] as any,
        dexVersion: validatedData.dexVersion || "auto",
        tokenAddress: validatedData.contractAddress,
        amountUsd: validatedData.amountUsd,
        slippageTolerance: validatedData.slippageTolerance,
        maxGasRatio: 0.8, // Default for manual trades
      });

      // Update trade log
      const updatedLog = await storage.updateTradeLog(tradeLog.id, {
        status: result.success ? 'success' : 'failed',
        txHash: result.txHash,
        tokenAmount: result.tokenAmount,
        gasFee: result.gasFee,
        gasFeeUsd: result.gasFeeUsd,
        tokenPrice: result.tokenPrice,
        slippage: result.slippage,
        errorMessage: result.errorMessage,
      });

      // Update bot status counters for this network
      const botStatus = await storage.getBotStatus(userId, validatedData.network);
      if (botStatus) {
        await storage.updateBotStatus(userId, validatedData.network, {
          totalTradesCount: botStatus.totalTradesCount + 1,
          successfulTradesCount: result.success 
            ? botStatus.successfulTradesCount + 1 
            : botStatus.successfulTradesCount,
          failedTradesCount: result.success 
            ? botStatus.failedTradesCount 
            : botStatus.failedTradesCount + 1,
          totalVolumeUsd: result.success 
            ? (parseFloat(botStatus.totalVolumeUsd.toString()) + validatedData.amountUsd).toFixed(2)
            : botStatus.totalVolumeUsd,
        });
      }

      // Broadcast trade update
      broadcastToUser(userId, { type: 'new_trade', trade: updatedLog });

      if (!result.success) {
        return res.status(400).json({ message: result.errorMessage, trade: updatedLog });
      }

      res.json(updatedLog);
    } catch (error: any) {
      console.error("Error executing manual trade:", error);
      res.status(400).json({ message: error.message || "Failed to execute trade" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // ==================== WebSocket Setup ====================
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: any) => {
    console.log('WebSocket client connected');

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'auth' && data.userId) {
          // Register client for this user
          if (!wsClients.has(data.userId)) {
            wsClients.set(data.userId, new Set());
          }
          wsClients.get(data.userId)?.add(ws);
          console.log(`Client authenticated for user ${data.userId}`);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      // Remove client from all user sets
      wsClients.forEach((clients) => {
        clients.delete(ws);
      });
      console.log('WebSocket client disconnected');
    });
  });

  function broadcastToUser(userId: string, data: any) {
    const clients = wsClients.get(userId);
    if (clients) {
      const message = JSON.stringify(data);
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  // Make broadcast function available to scheduler
  botScheduler.setBroadcaster(broadcastToUser);

  return httpServer;
}
