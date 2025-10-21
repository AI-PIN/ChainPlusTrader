import type { NetworkType } from '@shared/schema';
import memoize from 'memoizee';

interface CoinGeckoPrice {
  usd: number;
}

interface CoinGeckoPriceResponse {
  [key: string]: CoinGeckoPrice;
}

// Map network types to CoinGecko IDs
const COIN_GECKO_IDS: Record<NetworkType, string> = {
  ETH: 'ethereum',
  BASE: 'ethereum', // Base uses ETH
  BNB: 'binancecoin',
  SOL: 'solana',
};

// Fallback prices in case API fails
const FALLBACK_PRICES: Record<NetworkType, number> = {
  ETH: 2000,
  BASE: 2000,
  BNB: 600,
  SOL: 150,
};

class PriceService {
  private baseUrl = 'https://api.coingecko.com/api/v3';

  // Memoize price fetches for 30 seconds to avoid rate limits
  private fetchPriceFromAPI = memoize(
    async (coinId: string): Promise<number> => {
      try {
        const response = await fetch(
          `${this.baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd`
        );
        
        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data: CoinGeckoPriceResponse = await response.json();
        const price = data[coinId]?.usd;

        if (!price) {
          throw new Error(`Price not found for ${coinId}`);
        }

        return price;
      } catch (error) {
        console.error(`Failed to fetch price for ${coinId}:`, error);
        throw error;
      }
    },
    { maxAge: 30000, promise: true } // Cache for 30 seconds
  );

  async getPrice(network: NetworkType): Promise<number> {
    const coinId = COIN_GECKO_IDS[network];
    const fallbackPrice = FALLBACK_PRICES[network];

    try {
      const price = await this.fetchPriceFromAPI(coinId);
      console.log(`[PRICE] ${network} current price: $${price.toFixed(2)}`);
      return price;
    } catch (error) {
      console.warn(
        `[PRICE] Using fallback price for ${network}: $${fallbackPrice} (API failed)`
      );
      return fallbackPrice;
    }
  }

  async getPrices(networks: NetworkType[]): Promise<Record<NetworkType, number>> {
    const prices: Partial<Record<NetworkType, number>> = {};
    
    await Promise.all(
      networks.map(async (network) => {
        prices[network] = await this.getPrice(network);
      })
    );

    return prices as Record<NetworkType, number>;
  }
}

export const priceService = new PriceService();
