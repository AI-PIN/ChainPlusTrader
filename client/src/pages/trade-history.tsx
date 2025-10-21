import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TradeLog } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ExternalLink, Search } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function TradeHistory() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [networkFilter, setNetworkFilter] = useState<string>("all");

  const { data: trades = [], isLoading } = useQuery<TradeLog[]>({
    queryKey: ["/api/trades"],
  });

  const filteredTrades = trades.filter(trade => {
    const matchesSearch = search === "" || 
      trade.tokenAddress.toLowerCase().includes(search.toLowerCase()) ||
      trade.txHash?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || trade.status === statusFilter;
    const matchesNetwork = networkFilter === "all" || trade.network === networkFilter;

    return matchesSearch && matchesStatus && matchesNetwork;
  });

  const getExplorerUrl = (network: string, txHash?: string) => {
    if (!txHash) return null;
    
    const explorers: Record<string, string> = {
      ETH: `https://etherscan.io/tx/${txHash}`,
      BASE: `https://basescan.org/tx/${txHash}`,
      BNB: `https://bscscan.com/tx/${txHash}`,
      SOL: `https://solscan.io/tx/${txHash}`,
    };

    return explorers[network] || null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trade History</h1>
        <p className="text-muted-foreground mt-2">
          Complete log of all executed trades
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter your trade history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by address or tx hash..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-trades"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={networkFilter} onValueChange={setNetworkFilter}>
              <SelectTrigger data-testid="select-network-filter">
                <SelectValue placeholder="Filter by network" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Networks</SelectItem>
                <SelectItem value="ETH">Ethereum</SelectItem>
                <SelectItem value="BASE">Base</SelectItem>
                <SelectItem value="BNB">BNB Chain</SelectItem>
                <SelectItem value="SOL">Solana</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trade Logs</CardTitle>
          <CardDescription>
            {filteredTrades.length} {filteredTrades.length === 1 ? 'trade' : 'trades'} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {search || statusFilter !== "all" || networkFilter !== "all"
                  ? "No trades match your filters"
                  : "No trades executed yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTrades.map((trade) => {
                const explorerUrl = getExplorerUrl(trade.network, trade.txHash);
                
                return (
                  <div
                    key={trade.id}
                    className="p-4 rounded-md border hover-elevate"
                    data-testid={`trade-history-${trade.id}`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge variant={
                            trade.status === 'success' ? 'default' : 
                            trade.status === 'pending' ? 'secondary' : 
                            'destructive'
                          }>
                            {trade.status}
                          </Badge>
                          <Badge variant="outline">{trade.network}</Badge>
                          <Badge variant="outline">{trade.dex}</Badge>
                          <Badge variant="outline">{trade.tradeType}</Badge>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Token:</span>
                            <code className="text-sm font-mono">
                              {trade.tokenAddress.slice(0, 8)}...{trade.tokenAddress.slice(-6)}
                            </code>
                          </div>

                          {trade.txHash && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">TX Hash:</span>
                              <code className="text-sm font-mono">
                                {trade.txHash.slice(0, 8)}...{trade.txHash.slice(-6)}
                              </code>
                              {explorerUrl && (
                                <a
                                  href={explorerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                  data-testid={`link-explorer-${trade.id}`}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          )}

                          {trade.errorMessage && (
                            <p className="text-sm text-destructive">{trade.errorMessage}</p>
                          )}
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <p className="font-semibold font-mono text-lg">
                          ${trade.amountUsd}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Gas: ${trade.gasFeeUsd || "0.00"}
                        </p>
                        {trade.slippage && (
                          <p className="text-sm text-muted-foreground">
                            Slippage: {trade.slippage}%
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {trade.createdAt ? format(new Date(trade.createdAt), "MMM d, yyyy HH:mm") : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
