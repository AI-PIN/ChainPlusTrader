import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Activity, Shield, Zap, TrendingUp } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="relative">
          <div className="max-w-7xl mx-auto px-6 py-24">
            <div className="text-center space-y-8">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                Cross-Chain Trading Bot
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Automated DeFi trading across Ethereum, Base, BNB Chain, and Solana. 
                Advanced safety features, real-time monitoring, and institutional-grade execution.
              </p>
              <div className="flex justify-center gap-4">
                <Button 
                  size="lg" 
                  onClick={() => window.location.href = '/api/login'}
                  data-testid="button-login"
                  className="text-lg px-8"
                >
                  Access Dashboard
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Multi-Chain Support</h3>
            <p className="text-sm text-muted-foreground">
              Trade seamlessly across ETH, BASE, BNB, and SOL networks with automatic DEX routing.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-md bg-success/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-success" />
            </div>
            <h3 className="text-lg font-semibold">Safety First</h3>
            <p className="text-sm text-muted-foreground">
              Gas fee validation, slippage protection, and automatic trade verification keep your funds safe.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-md bg-warning/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-warning" />
            </div>
            <h3 className="text-lg font-semibold">Real-Time Monitoring</h3>
            <p className="text-sm text-muted-foreground">
              Live status updates, trade notifications, and comprehensive analytics dashboard.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-md bg-error/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-error" />
            </div>
            <h3 className="text-lg font-semibold">Automated Trading</h3>
            <p className="text-sm text-muted-foreground">
              Configure intervals, amounts, and let the bot execute trades automatically 24/7.
            </p>
          </Card>
        </div>
      </div>

      {/* Network Support */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center space-y-8">
          <h2 className="text-3xl font-bold">Supported Networks & DEXs</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="p-6 text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-network-eth/10 flex items-center justify-center">
                <div className="text-2xl font-bold text-network-eth">ETH</div>
              </div>
              <h3 className="font-semibold">Ethereum</h3>
              <p className="text-sm text-muted-foreground">Uniswap V2/V3</p>
            </Card>

            <Card className="p-6 text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-network-base/10 flex items-center justify-center">
                <div className="text-2xl font-bold text-network-base">BASE</div>
              </div>
              <h3 className="font-semibold">Base</h3>
              <p className="text-sm text-muted-foreground">Uniswap</p>
            </Card>

            <Card className="p-6 text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-network-bnb/10 flex items-center justify-center">
                <div className="text-2xl font-bold text-network-bnb">BNB</div>
              </div>
              <h3 className="font-semibold">BNB Chain</h3>
              <p className="text-sm text-muted-foreground">PancakeSwap</p>
            </Card>

            <Card className="p-6 text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-network-sol/10 flex items-center justify-center">
                <div className="text-2xl font-bold text-network-sol">SOL</div>
              </div>
              <h3 className="font-semibold">Solana</h3>
              <p className="text-sm text-muted-foreground">Jupiter DEX</p>
            </Card>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Card className="p-8 bg-muted/50">
          <div className="space-y-4 text-center">
            <Shield className="w-12 h-12 mx-auto text-primary" />
            <h3 className="text-xl font-semibold">Private Access Only</h3>
            <p className="text-muted-foreground">
              This trading bot is for authorized users only. All credentials are encrypted, 
              private keys never leave the secure server environment, and all transactions 
              are logged for complete transparency.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
