// ---------------------------------------------------------------------------
//  Bluefin — CCXT WebSocket exchange scaffold
//
//  Extends the REST class with streaming market-data and private-account
//  subscriptions.  Bluefin uses two separate WebSocket endpoints:
//    - market WS (public):  order books, tickers, trades, candles
//    - account WS (private): orders, fills, balances, positions (needs JWT)
//
//  This file is a SCAFFOLD — method bodies are stubs with TODO comments.
// ---------------------------------------------------------------------------

import bluefinRest from '../bluefin.js';
import type Client from '../base/ws/Client.js';
import type {
    Dict,
    Int,
    Market,
    Num,
    OHLCV,
    Order,
    OrderBook,
    Position,
    Str,
    Strings,
    Ticker,
    Tickers,
    Trade,
    Balances,
} from '../base/types.js';

// ---------------------------------------------------------------------------

export default class bluefin extends bluefinRest {
    describe () {
        return this.deepExtend (super.describe (), {
            'has': {
                'ws': true,
                // public
                'watchOrderBook': true,
                'watchTicker': true,
                'watchTickers': true,
                'watchTrades': true,
                'watchOHLCV': true,
                // private
                'watchOrders': true,
                'watchMyTrades': true,
                'watchBalance': true,
                'watchPositions': true,
            },
            'urls': {
                'api': {
                    'ws': {
                        'public':  'wss://stream.api.sui-prod.bluefin.io/ws/market',
                        'private': 'wss://stream.api.sui-prod.bluefin.io/ws/account',
                    },
                },
                'test': {
                    'ws': {
                        'public':  'wss://stream.api.sui-staging.bluefin.io/ws/market',
                        'private': 'wss://stream.api.sui-staging.bluefin.io/ws/account',
                    },
                },
            },
            'streaming': {
                'ping': this.ping,
                'keepAlive': 20000,
            },
        });
    }

    // ========================================================================
    //  Public watch methods (market WS)
    // ========================================================================

    async watchOrderBook (symbol: string, limit: Int = undefined, params = {}): Promise<OrderBook> {
        // TODO:
        //  1. loadMarkets, resolve market
        //  2. Subscribe to channel: "Partial_Depth_20" or "Diff_Depth_500_ms"
        //     on the public (market) WS
        //  3. Subscription message:
        //     { op: "SUBSCRIBE", channel: "Partial_Depth_20",
        //       symbols: [ bluefinSymbol ] }
        //  4. messageHash = 'orderbook:' + symbol
        //  5. return await this.watch (url, messageHash, message, messageHash)
        throw new Error ('watchOrderBook not implemented');
    }

    async watchTicker (symbol: string, params = {}): Promise<Ticker> {
        // TODO: subscribe to "Ticker" channel on market WS
        //       messageHash = 'ticker:' + symbol
        throw new Error ('watchTicker not implemented');
    }

    async watchTickers (symbols: Strings = undefined, params = {}): Promise<Tickers> {
        // TODO: subscribe to "Ticker_All" channel on market WS
        //       messageHash = 'tickers'
        throw new Error ('watchTickers not implemented');
    }

    async watchTrades (symbol: string, since: Int = undefined, limit: Int = undefined, params = {}): Promise<Trade[]> {
        // TODO: subscribe to "Recent_Trade" channel on market WS
        //       messageHash = 'trades:' + symbol
        throw new Error ('watchTrades not implemented');
    }

    async watchOHLCV (symbol: string, timeframe = '1m', since: Int = undefined, limit: Int = undefined, params = {}): Promise<OHLCV[]> {
        // TODO: subscribe to "Candlestick_{interval}_Last" channel
        //       where interval = this.timeframes[timeframe]
        //       messageHash = 'ohlcv:' + timeframe + ':' + symbol
        throw new Error ('watchOHLCV not implemented');
    }

    // ========================================================================
    //  Private watch methods (account WS, needs JWT auth)
    // ========================================================================

    async watchOrders (symbol: Str = undefined, since: Int = undefined, limit: Int = undefined, params = {}): Promise<Order[]> {
        // TODO:
        //  1. Authenticate if needed (getAccessToken)
        //  2. Subscribe to "AccountOrderUpdate" on account WS
        //  3. Subscription message includes authToken field:
        //     { op: "SUBSCRIBE", channel: "AccountOrderUpdate",
        //       authToken: jwt }
        //  4. messageHash = 'orders'
        throw new Error ('watchOrders not implemented');
    }

    async watchMyTrades (symbol: Str = undefined, since: Int = undefined, limit: Int = undefined, params = {}): Promise<Trade[]> {
        // TODO: subscribe to "AccountTradeUpdate" on account WS
        //       with authToken, messageHash = 'myTrades'
        throw new Error ('watchMyTrades not implemented');
    }

    async watchBalance (params = {}): Promise<Balances> {
        // TODO: subscribe to "AccountUpdate" on account WS
        //       with authToken, messageHash = 'balance'
        throw new Error ('watchBalance not implemented');
    }

    async watchPositions (symbols: Strings = undefined, since: Int = undefined, limit: Int = undefined, params = {}): Promise<Position[]> {
        // TODO: subscribe to "AccountPositionUpdate" on account WS
        //       with authToken, messageHash = 'positions'
        throw new Error ('watchPositions not implemented');
    }

    // ========================================================================
    //  Message router
    // ========================================================================

    handleMessage (client: Client, message: any): void {
        // TODO: route by channel/event type in the incoming message.
        //
        // Expected dispatch table (message.channel → handler):
        //   "OrderbookPartialDepthUpdate"  → handleOrderBook
        //   "OrderbookDiffDepthUpdate"     → handleOrderBook
        //   "TickerUpdate"                 → handleTicker
        //   "RecentTradesUpdates"          → handleTrades
        //   "CandlestickUpdate"            → handleOHLCV
        //   "AccountOrderUpdate"           → handleOrder
        //   "AccountTradeUpdate"           → handleMyTrades
        //   "AccountUpdate"                → handleBalance
        //   "AccountPositionUpdate"        → handlePosition
        //   "pong"                         → handlePong
        //
        // const methods: Dict = {
        //     'OrderbookPartialDepthUpdate': this.handleOrderBook,
        //     'OrderbookDiffDepthUpdate': this.handleOrderBook,
        //     'TickerUpdate': this.handleTicker,
        //     'RecentTradesUpdates': this.handleTrades,
        //     'CandlestickUpdate': this.handleOHLCV,
        //     'AccountOrderUpdate': this.handleOrder,
        //     'AccountTradeUpdate': this.handleMyTrades,
        //     'AccountUpdate': this.handleBalance,
        //     'AccountPositionUpdate': this.handlePosition,
        //     'pong': this.handlePong,
        // };
        // const channel = this.safeString (message, 'channel');
        // const handler = this.safeValue (methods, channel);
        // if (handler !== undefined) {
        //     handler.call (this, client, message);
        // }
    }

    // ========================================================================
    //  Message handlers (stubs)
    // ========================================================================

    handleOrderBook (client: Client, message: Dict): void {
        // TODO: parse OrderbookPartialDepthUpdate / OrderbookDiffDepthUpdate
        //  - Extract symbol, bids, asks from message.data
        //  - For partial: snapshot the order book
        //  - For diff: apply incremental updates
        //  - Resolve messageHash = 'orderbook:' + symbol
    }

    handleTicker (client: Client, message: Dict): void {
        // TODO: parse TickerUpdate
        //  - Extract ticker data from message.data
        //  - Parse via this.parseTicker()
        //  - Resolve messageHash = 'ticker:' + symbol
    }

    handleTrades (client: Client, message: Dict): void {
        // TODO: parse RecentTradesUpdates
        //  - Extract trades array from message.data
        //  - Parse each via this.parseTrade()
        //  - Append to ArrayCache
        //  - Resolve messageHash = 'trades:' + symbol
    }

    handleOHLCV (client: Client, message: Dict): void {
        // TODO: parse CandlestickUpdate
        //  - Extract candle from message.data
        //  - Parse via this.parseOHLCV()
        //  - Append to ArrayCacheByTimestamp
        //  - Resolve messageHash = 'ohlcv:' + timeframe + ':' + symbol
    }

    handleOrder (client: Client, message: Dict): void {
        // TODO: parse AccountOrderUpdate
        //  - Parse via this.parseOrder()
        //  - Update ArrayCacheBySymbolById
        //  - Resolve messageHash = 'orders'
    }

    handleMyTrades (client: Client, message: Dict): void {
        // TODO: parse AccountTradeUpdate
        //  - Parse via this.parseTrade()
        //  - Append to ArrayCache
        //  - Resolve messageHash = 'myTrades'
    }

    handleBalance (client: Client, message: Dict): void {
        // TODO: parse AccountUpdate
        //  - Parse via this.parseBalance()
        //  - Resolve messageHash = 'balance'
    }

    handlePosition (client: Client, message: Dict): void {
        // TODO: parse AccountPositionUpdate
        //  - Parse via this.parsePosition()
        //  - Resolve messageHash = 'positions'
    }

    // ========================================================================
    //  Ping / pong
    // ========================================================================

    ping (client: Client): Dict {
        return { 'op': 'PING' };
    }

    handlePong (client: Client, message: any): void {
        client.lastPong = this.milliseconds ();
    }
}
