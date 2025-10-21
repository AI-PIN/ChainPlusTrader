import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { manualTradeSchema, type ManualTradeRequest } from "@shared/schema";
import { AlertCircle, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { isUnauthorizedError } from "@/lib/authUtils";

const networkDexMap = {
  ETH: "Uniswap",
  BASE: "Uniswap",
  BNB: "PancakeSwap",
  SOL: "Jupiter",
} as const;

export default function ManualTrading() {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTrade, setPendingTrade] = useState<ManualTradeRequest | null>(null);

  const form = useForm<ManualTradeRequest>({
    resolver: zodResolver(manualTradeSchema),
    defaultValues: {
      contractAddress: "",
      network: "ETH",
      dexVersion: "auto",
      amountUsd: 20,
      slippageTolerance: 5,
    },
  });

  const network = form.watch("network");

  const executeMutation = useMutation({
    mutationFn: async (data: ManualTradeRequest) => {
      await apiRequest("POST", "/api/trades/manual", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bot/status"] });
      toast({
        title: "Trade executed",
        description: "Your manual trade has been submitted successfully.",
      });
      form.reset();
      setConfirmOpen(false);
      setPendingTrade(null);
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
        title: "Trade failed",
        description: error.message || "Failed to execute trade",
        variant: "destructive",
      });
      setConfirmOpen(false);
      setPendingTrade(null);
    },
  });

  const onSubmit = (data: ManualTradeRequest) => {
    setPendingTrade(data);
    setConfirmOpen(true);
  };

  const confirmTrade = () => {
    if (pendingTrade) {
      executeMutation.mutate(pendingTrade);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manual Trading</h1>
        <p className="text-muted-foreground mt-2">
          Execute one-time trades on-demand
        </p>
      </div>

      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Manual trades execute immediately. Ensure you have reviewed the contract address, 
          network settings, and current gas fees before confirming.
        </AlertDescription>
      </Alert>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Trade Parameters</CardTitle>
            <CardDescription>Configure your manual trade</CardDescription>
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
                          <SelectTrigger data-testid="select-manual-network">
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
                        DEX: {networkDexMap[field.value as keyof typeof networkDexMap]}
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
                            <SelectTrigger data-testid="select-manual-dex-version">
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
                          data-testid="input-manual-contract"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        The token contract address to trade
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amountUsd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trade Amount (USD)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="20" 
                          step="0.01"
                          className="font-mono text-lg"
                          data-testid="input-manual-amount"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
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
                          placeholder="5" 
                          step="0.1"
                          className="font-mono"
                          data-testid="input-manual-slippage"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum acceptable slippage (1-50%)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full"
                  variant="destructive"
                  disabled={executeMutation.isPending}
                  data-testid="button-execute-trade"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Execute Trade
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trade Information</CardTitle>
            <CardDescription>Estimated execution details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                <span className="text-sm text-muted-foreground">Network</span>
                <span className="font-semibold font-mono">{network}</span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                <span className="text-sm text-muted-foreground">DEX</span>
                <span className="font-semibold">
                  {networkDexMap[network as keyof typeof networkDexMap]}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                <span className="text-sm text-muted-foreground">Trade Amount</span>
                <span className="font-semibold font-mono text-lg">
                  ${form.watch("amountUsd") || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                <span className="text-sm text-muted-foreground">Max Slippage</span>
                <span className="font-semibold font-mono">
                  {form.watch("slippageTolerance")}%
                </span>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Gas fees will be estimated before execution. Trade will be cancelled 
                if fees exceed the configured limits.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Trade Execution</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to execute a manual trade with the following parameters:</p>
              <div className="mt-4 space-y-2 font-mono text-sm">
                <p><strong>Network:</strong> {pendingTrade?.network}</p>
                <p><strong>Amount:</strong> ${pendingTrade?.amountUsd}</p>
                <p><strong>Contract:</strong> {pendingTrade?.contractAddress.slice(0, 10)}...</p>
              </div>
              <p className="mt-4 text-destructive">
                This action cannot be undone. Please verify all details are correct.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-trade">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmTrade}
              disabled={executeMutation.isPending}
              data-testid="button-confirm-trade"
            >
              {executeMutation.isPending ? "Executing..." : "Confirm Trade"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
