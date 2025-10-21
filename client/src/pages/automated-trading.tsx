import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertTradeConfigSchema, type InsertTradeConfig, type TradeConfig } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isUnauthorizedError } from "@/lib/authUtils";

const networkDexMap = {
  ETH: "Uniswap",
  BASE: "Uniswap",
  BNB: "PancakeSwap",
  SOL: "Jupiter",
} as const;

export default function AutomatedTrading() {
  const { toast } = useToast();

  const form = useForm<InsertTradeConfig>({
    resolver: zodResolver(insertTradeConfigSchema),
    defaultValues: {
      contractAddress: "",
      walletAddress: "",
      network: "ETH",
      dex: "Uniswap",
      dexVersion: "auto",
      tradeInterval: "10min",
      tradeAmountUsd: "20",
      maxGasRatio: "0.80",
      slippageTolerance: "5.00",
      isActive: true,
    },
  });

  const network = form.watch("network");
  const maxGasRatio = parseFloat(form.watch("maxGasRatio") || "0.80");

  // Query active config for the selected network
  const { data: activeConfig, isLoading } = useQuery<TradeConfig>({
    queryKey: ["/api/configs/active", network],
    queryFn: async () => {
      const response = await fetch(`/api/configs/active?network=${network}`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error("Unauthorized");
        throw new Error("Failed to fetch config");
      }
      return response.json();
    },
  });

  // Update form when activeConfig loads or network changes
  useEffect(() => {
    if (activeConfig && activeConfig.network === network) {
      // Derive correct DEX from network to ensure consistency
      const derivedDex = networkDexMap[activeConfig.network as keyof typeof networkDexMap];
      
      form.reset({
        contractAddress: activeConfig.contractAddress,
        walletAddress: activeConfig.walletAddress,
        network: activeConfig.network,
        dex: derivedDex,
        dexVersion: activeConfig.dexVersion || "auto",
        tradeInterval: activeConfig.tradeInterval,
        tradeAmountUsd: activeConfig.tradeAmountUsd.toString(),
        maxGasRatio: activeConfig.maxGasRatio.toString(),
        slippageTolerance: activeConfig.slippageTolerance.toString(),
        isActive: activeConfig.isActive,
      });
    } else if (!activeConfig) {
      // Reset to defaults for this network if no config exists
      const derivedDex = networkDexMap[network as keyof typeof networkDexMap];
      form.reset({
        contractAddress: "",
        walletAddress: "",
        network,
        dex: derivedDex,
        dexVersion: "auto",
        tradeInterval: "10min",
        tradeAmountUsd: "20",
        maxGasRatio: "0.80",
        slippageTolerance: "5.00",
        isActive: true,
      });
    }
  }, [activeConfig, network, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: InsertTradeConfig) => {
      await apiRequest("POST", "/api/configs", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/configs/active", variables.network] });
      toast({
        title: "Configuration saved",
        description: `Trading configuration for ${variables.network} has been updated successfully.`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertTradeConfig) => {
    saveMutation.mutate({
      ...data,
      dex: networkDexMap[data.network as keyof typeof networkDexMap],
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Automated Trading</h1>
        <p className="text-muted-foreground mt-2">
          Configure your automated trading strategy
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          The bot will automatically execute trades at the specified interval when active. 
          Ensure your wallet has sufficient funds and gas fees are within acceptable limits.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Trading Configuration</CardTitle>
          <CardDescription>Set up your automated trading parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="network"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Network</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-network">
                          <SelectValue placeholder="Select network" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                        <SelectItem value="BASE">Base</SelectItem>
                        <SelectItem value="BNB">BNB Chain</SelectItem>
                        <SelectItem value="SOL">Solana</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      DEX: {networkDexMap[network as keyof typeof networkDexMap]}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(network === "BASE" || network === "ETH") && (
                <FormField
                  control={form.control}
                  name="dexVersion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Uniswap Version</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "auto"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-dex-version">
                            <SelectValue placeholder="Auto-detect" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="auto">Auto-detect (V4 → V3 → V2)</SelectItem>
                          <SelectItem value="v2">Uniswap V2 Only</SelectItem>
                          <SelectItem value="v3">Uniswap V3 Only</SelectItem>
                          <SelectItem value="v4">Uniswap V4 Only</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose Uniswap version or let the system auto-detect
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="contractAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token Contract Address</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0x..." 
                        className="font-mono" 
                        data-testid="input-contract-address"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      The ERC20 or SPL token contract address to trade
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="walletAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wallet Address</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0x..." 
                        className="font-mono"
                        data-testid="input-wallet-address"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Your wallet address for trading
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="tradeInterval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trade Interval</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-interval">
                            <SelectValue placeholder="Select interval" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1min">1 minute</SelectItem>
                          <SelectItem value="5min">5 minutes</SelectItem>
                          <SelectItem value="10min">10 minutes</SelectItem>
                          <SelectItem value="30min">30 minutes</SelectItem>
                          <SelectItem value="1hour">1 hour</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tradeAmountUsd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trade Amount (USD)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="20" 
                          step="0.01"
                          className="font-mono"
                          data-testid="input-trade-amount"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="maxGasRatio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Gas Ratio: {(maxGasRatio * 100).toFixed(0)}%</FormLabel>
                    <FormControl>
                      <Slider
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        value={[maxGasRatio]}
                        onValueChange={(values) => field.onChange(values[0].toFixed(2))}
                        data-testid="slider-gas-ratio"
                      />
                    </FormControl>
                    <FormDescription>
                      Skip trade if gas fee exceeds {(maxGasRatio * 100).toFixed(0)}% of trade value
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slippageTolerance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slippage Tolerance (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="5.00" 
                        step="0.1"
                        className="font-mono"
                        data-testid="input-slippage"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum acceptable slippage (default: 5%)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                size="lg" 
                disabled={saveMutation.isPending}
                data-testid="button-save-config"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? "Saving..." : "Save Configuration"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
