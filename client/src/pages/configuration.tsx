import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Network, Key, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Configuration() {
  const networks = [
    { name: "Ethereum", key: "ETH", hasKey: !!import.meta.env.PRIVATE_KEY_ETH, hasRpc: !!import.meta.env.RPC_URL_ETH },
    { name: "Base", key: "BASE", hasKey: !!import.meta.env.PRIVATE_KEY_BASE, hasRpc: !!import.meta.env.RPC_URL_BASE },
    { name: "BNB Chain", key: "BNB", hasKey: !!import.meta.env.PRIVATE_KEY_BNB, hasRpc: !!import.meta.env.RPC_URL_BNB },
    { name: "Solana", key: "SOL", hasKey: !!import.meta.env.PRIVATE_KEY_SOL, hasRpc: !!import.meta.env.RPC_URL_SOL },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuration</h1>
        <p className="text-muted-foreground mt-2">
          System configuration and network status
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Network credentials are configured via environment variables. Contact your administrator 
          to add or update private keys and RPC endpoints.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Network Configuration</CardTitle>
          <CardDescription>Available networks and their credential status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {networks.map((network) => (
              <div
                key={network.key}
                className="flex items-center justify-between p-4 rounded-md border"
                data-testid={`network-status-${network.key.toLowerCase()}`}
              >
                <div className="flex items-center gap-4">
                  <Network className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{network.name}</p>
                    <p className="text-sm text-muted-foreground font-mono">{network.key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={network.hasKey ? "default" : "secondary"}>
                    <Key className="w-3 h-3 mr-1" />
                    Private Key: {network.hasKey ? "Configured" : "Missing"}
                  </Badge>
                  <Badge variant={network.hasRpc ? "default" : "secondary"}>
                    RPC: {network.hasRpc ? "Configured" : "Missing"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security Information</CardTitle>
          <CardDescription>How your credentials are protected</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-success mt-0.5" />
              <div>
                <p className="font-medium">Encrypted Storage</p>
                <p className="text-sm text-muted-foreground">
                  All private keys are stored as encrypted environment variables and never exposed to the client.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-success mt-0.5" />
              <div>
                <p className="font-medium">Server-Side Execution</p>
                <p className="text-sm text-muted-foreground">
                  All blockchain transactions are signed and executed on the secure server. 
                  Private keys never leave the server environment.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-success mt-0.5" />
              <div>
                <p className="font-medium">Transaction Logging</p>
                <p className="text-sm text-muted-foreground">
                  Every trade is logged with complete details for transparency and audit purposes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-success mt-0.5" />
              <div>
                <p className="font-medium">Safety Checks</p>
                <p className="text-sm text-muted-foreground">
                  Gas fee validation, slippage protection, and automatic trade verification 
                  prevent excessive costs and failed transactions.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DEX Routing</CardTitle>
          <CardDescription>Automatic DEX selection based on network</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-md bg-muted">
              <span className="font-medium">Ethereum (ETH)</span>
              <Badge variant="outline">Uniswap V2/V3</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-muted">
              <span className="font-medium">Base</span>
              <Badge variant="outline">Uniswap</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-muted">
              <span className="font-medium">BNB Chain</span>
              <Badge variant="outline">PancakeSwap</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-muted">
              <span className="font-medium">Solana</span>
              <Badge variant="outline">Jupiter DEX</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
