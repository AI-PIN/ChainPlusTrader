import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { queryClient } from '@/lib/queryClient';

export function useWebSocket() {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      // Authenticate the connection
      ws.send(JSON.stringify({ type: 'auth', userId: user.id }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle different message types
        if (data.type === 'bot_status') {
          // Invalidate bot status query
          queryClient.invalidateQueries({ queryKey: ['/api/bot/status'] });
        } else if (data.type === 'new_trade') {
          // Invalidate trades queries
          queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
          queryClient.invalidateQueries({ queryKey: ['/api/trades/recent'] });
          queryClient.invalidateQueries({ queryKey: ['/api/bot/status'] });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [user?.id]);

  return { isConnected };
}
