import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Activity, TrendingUp, DollarSign, Percent } from "lucide-react";
import type { BotStatus, TradeConfig, TradeLog } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface NetworkStats {
  network: string;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalGasFees: string;
  totalGasFeesUsd: string;
  totalVolumeUsd: string;
}

const NETWORKS = ["ETH", "BASE", "BNB", "SOL"] as const;

export default function Dashboard() {
  const { toast } = useToast();
  
  const { data: botStatuses = [], isLoading: statusLoading } = useQuery<BotStatus[]>({
    queryKey: ["/api/bot/statuses"],
  });

  const { data: activeConfigs = [], isLoading: configLoading } = useQuery<TradeConfig[]>({
    queryKey: ["/api/configs/active"],
  });

  const { data: recentTrades = [], isLoading: tradesLoading } = useQuery<TradeLog[]>({
    queryKey: ["/api/trades/recent"],
  });

  const { data: networkStats = [], isLoading: networkStatsLoading } = useQuery<NetworkStats[]>({
    queryKey: ["/api/trades/network-stats"],
  });

  const startBotMutation = useMutation({
    mutationFn: async (network: string) => 
      apiRequest('POST', '/api/bot/start', { network }),
    onSuccess: (_, network) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot/statuses'] });
      toast({
        title: "Bot Started",
        description: `Trading bot for ${network} is now active.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Start Bot",
        description: error.message || "Please ensure you have an active configuration.",
        variant: "destructive",
      });
    },
  });

  const stopBotMutation = useMutation({
    mutationFn: async (network: string) => 
      apiRequest('POST', '/api/bot/stop', { network }),
    onSuccess: (_, network) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot/statuses'] });
      toast({
        title: "Bot Stopped",
        description: `Trading bot for ${network} has been paused.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Stop Bot",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleBot = (network: string, isRunning: boolean) => {
    if (isRunning) {
      stopBotMutation.mutate(network);
    } else {
      startBotMutation.mutate(network);
    }
  };

  // Get total stats across all networks
  const totalStats = botStatuses.reduce(
    (acc, status) => ({
      totalTrades: acc.totalTrades + status.totalTradesCount,
      successfulTrades: acc.successfulTrades + status.successfulTradesCount,
      totalVolume: acc.totalVolume + parseFloat(status.totalVolumeUsd.toString()),
    }),
    { totalTrades: 0, successfulTrades: 0, totalVolume: 0 }
  );

  const successRate = totalStats.totalTrades 
    ? ((totalStats.successfulTrades / totalStats.totalTrades) * 100).toFixed(1)
    : "0";

  const avgGasFee = recentTrades.length > 0
    ? (recentTrades.reduce((sum, t) => sum + parseFloat(t.gasFeeUsd || "0"), 0) / recentTrades.length).toFixed(2)
    : "0.00";

  return (
    <div className="space-y-8">
      {/* Network Bot Status Cards */}
      <div>
        <h1 className="text-3xl font-bold mb-6">Network Bots</h1>
        <div className="grid md:grid-cols-2 gap-6">
          {NETWORKS.map((network) => {
            const botStatus = botStatuses.find(s => s.network === network);
            const activeConfig = activeConfigs.find(c => c.network === network);
            const isRunning = botStatus?.isRunning || false;
            
            return (
              <Card key={network} className="border-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-2xl">{network}</CardTitle>
                      <CardDescription>
                        {activeConfig ? `${activeConfig.dex} · ${activeConfig.tradeInterval}` : "No configuration"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant={isRunning ? "default" : "secondary"} 
                        className="px-3 py-1"
                        data-testid={`badge-bot-status-${network.toLowerCase()}`}
                      >
                        <div className={`w-2 h-2 rounded-full mr-2 ${isRunning ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                        {isRunning ? "ACTIVE" : "PAUSED"}
                      </Badge>
                      <Button
                        size="sm"
                        variant={isRunning ? "destructive" : "default"}
                        onClick={() => handleToggleBot(network, isRunning)}
                        disabled={!activeConfig || startBotMutation.isPending || stopBotMutation.isPending}
                        data-testid={`button-toggle-bot-${network.toLowerCase()}`}
                      >
                        {isRunning ? (
                          <>
                            <Pause className="w-3 h-3 mr-1" />
                            Stop
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 mr-1" />
                            Start
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {statusLoading || configLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : activeConfig ? (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Trades</p>
                        <p className="font-semibold font-mono">{botStatus?.totalTradesCount || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Volume</p>
                        <p className="font-semibold font-mono">${botStatus?.totalVolumeUsd || "0.00"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Amount</p>
                        <p className="font-semibold font-mono">${activeConfig.tradeAmountUsd}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Success</p>
                        <p className="font-semibold font-mono">
                          {botStatus?.totalTradesCount 
                            ? `${((botStatus.successfulTradesCount / botStatus.totalTradesCount) * 100).toFixed(0)}%`
                            : "0%"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No configuration set</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wide">
              Total Trades
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-bold font-mono" data-testid="text-total-trades">
                {totalStats.totalTrades}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wide">
              Total Volume
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-3xl font-bold font-mono" data-testid="text-total-volume">
                ${totalStats.totalVolume.toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wide">
              Avg Gas Fee
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {tradesLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-bold font-mono" data-testid="text-avg-gas">
                ${avgGasFee}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wide">
              Success Rate
            </CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold font-mono" data-testid="text-success-rate">
                {successRate}%
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Network Statistics */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Network Statistics</h2>
          <p className="text-muted-foreground">Trading activity breakdown by blockchain</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {networkStatsLoading ? (
            [1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-20" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            networkStats.map((stat) => (
              <Card key={stat.network} data-testid={`card-network-${stat.network}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{stat.network}</span>
                    <Badge variant="outline" className="font-mono">
                      {stat.totalTrades}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Total Trades</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Success Rate</span>
                    <span className="font-mono font-semibold text-success" data-testid={`text-success-${stat.network}`}>
                      {stat.totalTrades > 0 
                        ? `${((stat.successfulTrades / stat.totalTrades) * 100).toFixed(1)}%`
                        : "0%"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Gas Fees</span>
                    <span className="font-mono font-semibold" data-testid={`text-gas-${stat.network}`}>
                      ${stat.totalGasFeesUsd}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Volume</span>
                    <span className="font-mono font-semibold" data-testid={`text-volume-${stat.network}`}>
                      ${stat.totalVolumeUsd}
                    </span>
                  </div>
                  {stat.totalTrades > 0 && (
                    <div className="pt-2 border-t">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Success</span>
                        <span className="text-success font-mono">{stat.successfulTrades}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Failed</span>
                        <span className="text-destructive font-mono">{stat.failedTrades}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Recent Trades */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
          <CardDescription>Latest trading activity</CardDescription>
        </CardHeader>
        <CardContent>
          {tradesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentTrades.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No trades executed yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTrades.slice(0, 5).map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between p-4 rounded-md border hover-elevate"
                  data-testid={`trade-${trade.id}`}
                >
                  <div className="flex items-center gap-4">
                    <Badge variant={
                      trade.status === 'success' ? 'default' : 
                      trade.status === 'pending' ? 'secondary' : 
                      'destructive'
                    }>
                      {trade.status}
                    </Badge>
                    <div>
                      <p className="font-semibold">{trade.network} • {trade.dex}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {trade.tokenAddress.slice(0, 6)}...{trade.tokenAddress.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold font-mono">${trade.amountUsd}</p>
                    <p className="text-sm text-muted-foreground">
                      Gas: ${trade.gasFeeUsd || "0.00"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
