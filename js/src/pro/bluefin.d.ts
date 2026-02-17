import bluefinRest from '../bluefin.js';
import type Client from '../base/ws/Client.js';
import type { Dict, Int, OHLCV, Order, OrderBook, Position, Str, Strings, Ticker, Tickers, Trade, Balances } from '../base/types.js';
export default class bluefin extends bluefinRest {
    describe(): any;
    watchOrderBook(symbol: string, limit?: Int, params?: {}): Promise<OrderBook>;
    watchTicker(symbol: string, params?: {}): Promise<Ticker>;
    watchTickers(symbols?: Strings, params?: {}): Promise<Tickers>;
    watchTrades(symbol: string, since?: Int, limit?: Int, params?: {}): Promise<Trade[]>;
    watchOHLCV(symbol: string, timeframe?: string, since?: Int, limit?: Int, params?: {}): Promise<OHLCV[]>;
    watchOrders(symbol?: Str, since?: Int, limit?: Int, params?: {}): Promise<Order[]>;
    watchMyTrades(symbol?: Str, since?: Int, limit?: Int, params?: {}): Promise<Trade[]>;
    watchBalance(params?: {}): Promise<Balances>;
    watchPositions(symbols?: Strings, since?: Int, limit?: Int, params?: {}): Promise<Position[]>;
    handleMessage(client: Client, message: any): void;
    handleOrderBook(client: Client, message: Dict): void;
    handleTicker(client: Client, message: Dict): void;
    handleTrades(client: Client, message: Dict): void;
    handleOHLCV(client: Client, message: Dict): void;
    handleOrder(client: Client, message: Dict): void;
    handleMyTrades(client: Client, message: Dict): void;
    handleBalance(client: Client, message: Dict): void;
    handlePosition(client: Client, message: Dict): void;
    ping(client: Client): Dict;
    handlePong(client: Client, message: any): void;
}
