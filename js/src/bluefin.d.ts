import Exchange from './abstract/bluefin.js';
import type { Balances, Dict, FundingRateHistory, Int, LeverageTier, LeverageTiers, Market, Num, OHLCV, Order, OrderBook, OrderSide, OrderType, Position, Str, Strings, Ticker, Tickers, Trade } from './base/types.js';
interface BluefinUIOrderRequest {
    readonly type: 'Bluefin Pro Order';
    readonly ids: string;
    readonly account: string;
    readonly market: string;
    readonly price: string;
    readonly quantity: string;
    readonly leverage: string;
    readonly side: string;
    readonly positionType: 'ISOLATED' | 'CROSS';
    readonly expiration: string;
    readonly salt: string;
    readonly signedAt: string;
}
interface BluefinUILeverageRequest {
    readonly type: 'Bluefin Pro Leverage Adjustment';
    readonly ids: string;
    readonly account: string;
    readonly market: string;
    readonly leverage: string;
    readonly salt: string;
    readonly signedAt: string;
}
interface BluefinUIWithdrawRequest {
    readonly type: 'Bluefin Pro Withdrawal';
    readonly eds: string;
    readonly assetSymbol: string;
    readonly account: string;
    readonly amount: string;
    readonly salt: string;
    readonly signedAt: string;
}
interface BluefinUIMarginRequest {
    readonly type: 'Bluefin Pro Margin Adjustment';
    readonly ids: string;
    readonly account: string;
    readonly market: string;
    readonly add: boolean;
    readonly amount: string;
    readonly salt: string;
    readonly signedAt: string;
}
declare type BluefinUISignable = BluefinUIOrderRequest | BluefinUILeverageRequest | BluefinUIWithdrawRequest | BluefinUIMarginRequest;
export default class bluefin extends Exchange {
    describe(): any;
    bcsSerializeBytes(data: Uint8Array): Uint8Array;
    suiSignPersonalMessage(message: Uint8Array, privateKeyHex: string): string;
    signTradeRequest(payload: BluefinUISignable): string;
    authenticate(params?: {}): Promise<Dict>;
    refreshAccessToken(params?: {}): Promise<Dict>;
    isAccessTokenExpired(): boolean;
    isRefreshTokenValid(): boolean;
    getAccessToken(): Promise<string>;
    generateSalt(): string;
    fetchMarkets(params?: {}): Promise<Market[]>;
    fetchTicker(symbol: string, params?: {}): Promise<Ticker>;
    fetchTickers(symbols?: Strings, params?: {}): Promise<Tickers>;
    fetchOrderBook(symbol: string, limit?: Int, params?: {}): Promise<OrderBook>;
    fetchTrades(symbol: string, since?: Int, limit?: Int, params?: {}): Promise<Trade[]>;
    fetchOHLCV(symbol: string, timeframe?: string, since?: Int, limit?: Int, params?: {}): Promise<OHLCV[]>;
    fetchFundingRateHistory(symbol?: Str, since?: Int, limit?: Int, params?: {}): Promise<FundingRateHistory[]>;
    fetchBalance(params?: {}): Promise<Balances>;
    fetchPositions(symbols?: Strings, params?: {}): Promise<Position[]>;
    fetchMyTrades(symbol?: Str, since?: Int, limit?: Int, params?: {}): Promise<Trade[]>;
    fetchOpenOrders(symbol?: Str, since?: Int, limit?: Int, params?: {}): Promise<Order[]>;
    fetchOrder(id: string, symbol?: Str, params?: {}): Promise<Order>;
    fetchClosedOrders(symbol?: Str, since?: Int, limit?: Int, params?: {}): Promise<Order[]>;
    reconstructOrderFromTrades(id: string, trades: Dict[], market?: Market): Order;
    createOrder(symbol: string, type: OrderType, side: OrderSide, amount: number, price?: Num, params?: {}): Promise<Order>;
    cancelOrder(id: string, symbol?: Str, params?: {}): Promise<Order>;
    cancelOrders(ids: string[], symbol?: Str, params?: {}): Promise<Order[]>;
    setLeverage(leverage: Int, symbol?: Str, params?: {}): Promise<any>;
    setMarginMode(marginMode: string, symbol?: Str, params?: {}): Promise<any>;
    addMargin(symbol: string, amount: number, params?: {}): Promise<any>;
    reduceMargin(symbol: string, amount: number, params?: {}): Promise<any>;
    adjustMargin(symbol: string, amount: number, operation: string, params?: {}): Promise<any>;
    withdraw(code: string, amount: number, address: string, tag?: Str, params?: {}): Promise<any>;
    parseMarket(market: Dict): Market;
    parseTicker(ticker: Dict, market?: Market): Ticker;
    parseTrade(trade: Dict, market?: Market): Trade;
    parseOrder(order: Dict, market?: Market): Order;
    parsePosition(position: Dict, market?: Market): Position;
    parseBalance(response: Dict): Balances;
    parseOHLCV(ohlcv: any, market?: Market): OHLCV;
    parseFundingRateHistory(entry: Dict, market?: Market): FundingRateHistory;
    parseOrderStatus(status: Str): string;
    parseOrderSide(side: Str): string;
    fetchLeverageTiers(symbols?: Strings, params?: {}): Promise<LeverageTiers>;
    parseMarketLeverageTiers(info: Dict, market?: Market): LeverageTier[];
    sign(path: string, api?: string, method?: string, params?: Dict, headers?: any, body?: any): Dict;
    parseE9(value: Str): Str;
    toE9(value: Str): Str;
    convertE9Levels(levels: any[]): any[][];
    bluefinSymbol(ccxtSymbol: string): string;
    ccxtSymbol(bluefinSymbol: string): string;
}
export {};
