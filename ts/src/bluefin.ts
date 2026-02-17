
// ----------------------------------------------------------------------------

import Exchange from './abstract/bluefin.js';
import { Precise } from './base/Precise.js';
import { TICK_SIZE } from './base/functions/number.js';
import { ed25519 } from './static_dependencies/noble-curves/ed25519.js';
import { blake2b } from './static_dependencies/noble-hashes/blake2b.js';
import { concatBytes, utf8ToBytes } from './static_dependencies/noble-hashes/utils.js';
import { ArgumentsRequired, AuthenticationError } from './base/errors.js';
import type { Balances, Dict, FundingRateHistory, Int, Market, Num, OHLCV, Order, OrderBook, OrderSide, OrderType, Position, Str, Strings, Ticker, Tickers, Trade } from './base/types.js';

// ----------------------------------------------------------------------------
// Discriminated union types for all signable payloads.
// Field names and ordering must match the SDK's UI* interfaces exactly
// so that JSON.stringify produces byte-identical output.

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

type BluefinUISignable = BluefinUIOrderRequest | BluefinUILeverageRequest
    | BluefinUIWithdrawRequest | BluefinUIMarginRequest;

interface BluefinLoginRequest {
    readonly accountAddress: string;
    readonly signedAtMillis: number;
    readonly audience: 'api';
}

// ----------------------------------------------------------------------------

export default class bluefin extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'bluefin',
            'name': 'Bluefin',
            'countries': [ 'SG' ],
            'version': 'v1',
            'rateLimit': 100,
            'certified': false,
            'pro': true,
            'dex': true,
            'requiredCredentials': {
                'apiKey': false,
                'secret': false,
                'walletAddress': true, // Sui Ed25519 address
                'privateKey': true, // Ed25519 private key
            },
            'has': {
                'CORS': undefined,
                'spot': false,
                'margin': false,
                'swap': true,
                'future': false,
                'option': false,
                'addMargin': true,
                'cancelOrder': true,
                'cancelOrders': true,
                'createOrder': true,
                'fetchBalance': true,
                'fetchFundingRateHistory': true,
                'fetchMarkets': true,
                'fetchMyTrades': true,
                'fetchOHLCV': true,
                'fetchOpenOrders': true,
                'fetchOrderBook': true,
                'fetchPositions': true,
                'fetchTicker': true,
                'fetchTickers': true,
                'fetchTrades': true,
                'reduceMargin': true,
                'setLeverage': true,
                'setMarginMode': true,
                'withdraw': true,
            },
            'timeframes': {
                '1m': '1m',
                '3m': '3m',
                '5m': '5m',
                '15m': '15m',
                '30m': '30m',
                '1h': '1h',
                '2h': '2h',
                '4h': '4h',
                '6h': '6h',
                '8h': '8h',
                '12h': '12h',
                '1d': '1d',
                '3d': '3d',
                '1w': '1w',
                '1M': '1Mo',
            },
            'urls': {
                'logo': 'https://bluefin.io/logo.svg',
                'api': {
                    'auth': 'https://auth.api.sui-prod.bluefin.io',
                    'exchange': 'https://api.sui-prod.bluefin.io',
                    'account': 'https://api.sui-prod.bluefin.io',
                    'trade': 'https://trade.api.sui-prod.bluefin.io',
                },
                'test': {
                    'auth': 'https://auth.api.sui-staging.bluefin.io',
                    'exchange': 'https://api.sui-staging.bluefin.io',
                    'account': 'https://api.sui-staging.bluefin.io',
                    'trade': 'https://trade.api.sui-staging.bluefin.io',
                },
                'www': 'https://bluefin.io',
                'doc': [
                    'https://bluefin-exchange.readme.io/reference',
                ],
                'fees': 'https://docs.bluefin.io/fees',
            },
            'api': {
                'exchange': {
                    'get': [
                        'v1/exchange/info',
                        'v1/exchange/depth',
                        'v1/exchange/ticker',
                        'v1/exchange/tickers',
                        'v1/exchange/trades',
                        'v1/exchange/candlesticks',
                        'v1/exchange/fundingRateHistory',
                    ],
                },
                'auth': {
                    'post': [
                        'auth/token',
                        'auth/v2/token',
                    ],
                    'put': [
                        'auth/token/refresh',
                    ],
                },
                'account': {
                    'get': [
                        'api/v1/account',
                        'api/v1/account/trades',
                        'api/v1/account/transactions',
                        'api/v1/account/fundingRateHistory',
                    ],
                },
                'trade': {
                    'get': [
                        'api/v1/trade/openOrders',
                        'api/v1/trade/standbyOrders',
                    ],
                    'post': [
                        'api/v1/trade/orders',
                        'api/v1/trade/withdraw',
                    ],
                    'put': [
                        'api/v1/trade/orders/cancel',
                        'api/v1/trade/leverage',
                        'api/v1/trade/adjustIsolatedMargin',
                    ],
                },
            },
            'fees': {
                'swap': {
                    'maker': 0.0002, // 2 bps
                    'taker': 0.0005, // 5 bps
                },
            },
            'precisionMode': TICK_SIZE,
            'options': {
                'defaultType': 'swap',
                'sandboxMode': false,
            },
        });
    }

    // ---- Sui signing primitives ----

    bcsSerializeBytes (data: Uint8Array): Uint8Array {
        // BCS encoding for a byte vector: ULEB128 length prefix followed by raw bytes
        let len = data.length;
        const lenBytes: number[] = [];
        while (len >= 0x80) {
            lenBytes.push ((len & 0x7f) | 0x80);
            len >>>= 7;
        }
        lenBytes.push (len);
        return concatBytes (new Uint8Array (lenBytes), data);
    }

    suiSignPersonalMessage (message: Uint8Array, privateKeyHex: string): string {
        // Sui personal-message signing:
        // 1. BCS-serialize the message (ULEB128 length + bytes)
        // 2. Prepend intent bytes [3, 0, 0] (PersonalMessage)
        // 3. Blake2b-256 hash the intent-prefixed message
        // 4. Ed25519-sign the hash
        // 5. Envelope: flag(0x00) || sig(64) || pubkey(32)
        // 6. Return base64
        const bcsMsg = this.bcsSerializeBytes (message);
        const intentMsg = concatBytes (new Uint8Array ([ 3, 0, 0 ]), bcsMsg);
        const digest = blake2b (intentMsg, { dkLen: 32 });
        const keyBytes = this.base16ToBinary (privateKeyHex.replace ('0x', ''));
        const sig = ed25519.sign (digest, keyBytes);
        const pubkey = ed25519.getPublicKey (keyBytes);
        const envelope = concatBytes (new Uint8Array ([ 0x00 ]), sig, pubkey);
        return this.binaryToBase64 (envelope);
    }

    // ---- Trade request signing ----

    signTradeRequest (payload: BluefinUISignable): string {
        const json = JSON.stringify (payload, null, 2);
        return this.suiSignPersonalMessage (utf8ToBytes (json), this.privateKey);
    }

    // ---- Auth flow ----

    async authenticate (params = {}): Promise<Dict> {
        this.checkRequiredCredentials ();
        const now = this.milliseconds ();
        const loginRequest: BluefinLoginRequest = {
            'accountAddress': this.walletAddress,
            'signedAtMillis': now,
            'audience': 'api',
        };
        const loginJson = JSON.stringify (loginRequest);
        const signature = this.suiSignPersonalMessage (utf8ToBytes (loginJson), this.privateKey);
        const request: Dict = {
            'accountAddress': loginRequest['accountAddress'],
            'signedAtMillis': loginRequest['signedAtMillis'],
            'audience': loginRequest['audience'],
            'payloadSignature': signature,
        };
        const response = await this.authPostAuthV2Token (this.extend (request, params));
        const accessToken = this.safeString (response, 'accessToken');
        const refreshToken = this.safeString (response, 'refreshToken');
        const accessValidFor = this.safeNumber (response, 'accessTokenValidForSeconds', 300);
        const refreshValidFor = this.safeNumber (response, 'refreshTokenValidForSeconds', 2592000);
        if (accessToken === undefined) {
            throw new AuthenticationError (this.id + ' authenticate() failed — no accessToken in response');
        }
        const nowSeconds = now / 1000;
        this.options['accessToken'] = accessToken;
        this.options['refreshToken'] = refreshToken;
        this.options['tokenSetAtSeconds'] = nowSeconds;
        this.options['accessTokenValidForSeconds'] = accessValidFor;
        this.options['refreshTokenValidForSeconds'] = refreshValidFor;
        return response;
    }

    async refreshAccessToken (params = {}): Promise<Dict> {
        const refreshToken = this.safeString (this.options, 'refreshToken');
        if (refreshToken === undefined) {
            return await this.authenticate (params);
        }
        const request: Dict = {
            'refreshToken': refreshToken,
        };
        const response = await this.authPutAuthTokenRefresh (this.extend (request, params));
        const accessToken = this.safeString (response, 'accessToken');
        const newRefreshToken = this.safeString (response, 'refreshToken');
        const accessValidFor = this.safeNumber (response, 'accessTokenValidForSeconds', 300);
        const refreshValidFor = this.safeNumber (response, 'refreshTokenValidForSeconds', 2592000);
        if (accessToken === undefined) {
            throw new AuthenticationError (this.id + ' refreshAccessToken() failed — no accessToken in response');
        }
        const nowSeconds = this.milliseconds () / 1000;
        this.options['accessToken'] = accessToken;
        this.options['refreshToken'] = newRefreshToken;
        this.options['tokenSetAtSeconds'] = nowSeconds;
        this.options['accessTokenValidForSeconds'] = accessValidFor;
        this.options['refreshTokenValidForSeconds'] = refreshValidFor;
        return response;
    }

    isAccessTokenExpired (): boolean {
        const token = this.safeString (this.options, 'accessToken');
        const tokenSetAt = this.safeNumber (this.options, 'tokenSetAtSeconds');
        if (token === undefined || tokenSetAt === undefined) {
            return true;
        }
        const lifetime = this.safeNumber (this.options, 'accessTokenValidForSeconds', 300);
        const nowSeconds = this.milliseconds () / 1000;
        // Refresh at 80% of lifetime (matching SDK)
        return nowSeconds >= (tokenSetAt + lifetime * 0.8);
    }

    isRefreshTokenValid (): boolean {
        const refreshToken = this.safeString (this.options, 'refreshToken');
        const tokenSetAt = this.safeNumber (this.options, 'tokenSetAtSeconds');
        if (refreshToken === undefined || tokenSetAt === undefined) {
            return false;
        }
        const lifetime = this.safeNumber (this.options, 'refreshTokenValidForSeconds', 2592000);
        const nowSeconds = this.milliseconds () / 1000;
        // 60 second safety buffer
        return nowSeconds < (tokenSetAt + lifetime - 60);
    }

    async getAccessToken (): Promise<string> {
        const token = this.safeString (this.options, 'accessToken');
        if (token === undefined) {
            await this.authenticate ();
            return this.options['accessToken'];
        }
        if (this.isAccessTokenExpired ()) {
            if (this.isRefreshTokenValid ()) {
                await this.refreshAccessToken ();
            } else {
                await this.authenticate ();
            }
        }
        return this.options['accessToken'];
    }

    generateSalt (): string {
        return (this.milliseconds () + Math.floor (Math.random () * 1000000)).toString ();
    }

    // ---- Public API methods ----

    async fetchMarkets (params = {}): Promise<Market[]> {
        const response = await this.exchangeGetV1ExchangeInfo (params);
        const markets = this.safeList (response, 'markets', []);
        const contractsConfig = this.safeDict (response, 'contractsConfig');
        if (contractsConfig !== undefined) {
            this.options['contractsConfig'] = contractsConfig;
        }
        const result: Market[] = [];
        for (let i = 0; i < markets.length; i++) {
            result.push (this.parseMarket (markets[i]));
        }
        return result;
    }

    async fetchTicker (symbol: string, params = {}): Promise<Ticker> {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request: Dict = {
            'symbol': this.bluefinSymbol (symbol),
        };
        const response = await this.exchangeGetV1ExchangeTicker (this.extend (request, params));
        return this.parseTicker (response, market);
    }

    async fetchTickers (symbols: Strings = undefined, params = {}): Promise<Tickers> {
        await this.loadMarkets ();
        const response = await this.exchangeGetV1ExchangeTickers (params);
        const result: Tickers = {};
        for (let i = 0; i < response.length; i++) {
            const ticker = this.parseTicker (response[i]);
            const symbol = ticker['symbol'];
            if (symbols !== undefined && !this.inArray (symbol, symbols)) {
                continue;
            }
            result[symbol] = ticker;
        }
        return result;
    }

    async fetchOrderBook (symbol: string, limit: Int = undefined, params = {}): Promise<OrderBook> {
        const request: Dict = {
            'symbol': symbol.replace ('/USDC:USDC', '-PERP'),
        };
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.exchangeGetV1ExchangeDepth (this.extend (request, params));
        const timestamp = this.safeInteger (response, 'updatedAtMillis');
        const nonce = this.safeInteger (response, 'lastUpdateId');
        // bidsE9/asksE9 are arrays of [priceE9, qtyE9] strings;
        // convert to plain floats before parseOrderBook.
        const rawBids = this.safeList (response, 'bidsE9', []);
        const rawAsks = this.safeList (response, 'asksE9', []);
        const bids = this.convertE9Levels (rawBids);
        const asks = this.convertE9Levels (rawAsks);
        const orderbook = this.parseOrderBook ({ 'bids': bids, 'asks': asks }, symbol, timestamp, 'bids', 'asks', 0, 1);
        orderbook['nonce'] = nonce;
        return orderbook;
    }

    async fetchTrades (symbol: string, since: Int = undefined, limit: Int = undefined, params = {}): Promise<Trade[]> {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request: Dict = {
            'symbol': this.bluefinSymbol (symbol),
        };
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.exchangeGetV1ExchangeTrades (this.extend (request, params));
        const result: Trade[] = [];
        for (let i = 0; i < response.length; i++) {
            result.push (this.parseTrade (response[i], market));
        }
        return result;
    }

    async fetchOHLCV (symbol: string, timeframe = '1m', since: Int = undefined, limit: Int = undefined, params = {}): Promise<OHLCV[]> {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request: Dict = {
            'symbol': this.bluefinSymbol (symbol),
            'interval': this.safeString (this.timeframes, timeframe, timeframe),
        };
        if (since !== undefined) {
            request['startTime'] = since;
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.exchangeGetV1ExchangeCandlesticks (this.extend (request, params));
        const result: OHLCV[] = [];
        for (let i = 0; i < response.length; i++) {
            result.push (this.parseOHLCV (response[i], market));
        }
        return result;
    }

    async fetchFundingRateHistory (symbol: Str = undefined, since: Int = undefined, limit: Int = undefined, params = {}): Promise<FundingRateHistory[]> {
        const request: Dict = {};
        if (symbol !== undefined) {
            request['symbol'] = symbol.replace ('/USDC:USDC', '-PERP');
        }
        if (since !== undefined) {
            request['startTime'] = since;
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.exchangeGetV1ExchangeFundingRateHistory (this.extend (request, params));
        const result: FundingRateHistory[] = [];
        for (let i = 0; i < response.length; i++) {
            result.push (this.parseFundingRateHistory (response[i]));
        }
        return result;
    }

    // ---- Private read-only methods ----

    async fetchBalance (params = {}): Promise<Balances> {
        await this.loadMarkets ();
        await this.getAccessToken ();
        const response = await this.accountGetApiV1Account (params);
        return this.parseBalance (response);
    }

    async fetchPositions (symbols: Strings = undefined, params = {}): Promise<Position[]> {
        await this.loadMarkets ();
        await this.getAccessToken ();
        const response = await this.accountGetApiV1Account (params);
        const positions = this.safeList (response, 'positions', []);
        const result: Position[] = [];
        for (let i = 0; i < positions.length; i++) {
            const position = this.parsePosition (positions[i]);
            if (symbols !== undefined && !this.inArray (position['symbol'], symbols)) {
                continue;
            }
            result.push (position);
        }
        return result;
    }

    async fetchMyTrades (symbol: Str = undefined, since: Int = undefined, limit: Int = undefined, params = {}): Promise<Trade[]> {
        await this.loadMarkets ();
        await this.getAccessToken ();
        const request: Dict = {};
        if (symbol !== undefined) {
            request['symbol'] = this.bluefinSymbol (symbol);
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.accountGetApiV1AccountTrades (this.extend (request, params));
        const market = (symbol !== undefined) ? this.market (symbol) : undefined;
        const result: Trade[] = [];
        const trades = Array.isArray (response) ? response : this.safeList (response, 'trades', []);
        for (let i = 0; i < trades.length; i++) {
            result.push (this.parseTrade (trades[i], market));
        }
        return result;
    }

    async fetchOpenOrders (symbol: Str = undefined, since: Int = undefined, limit: Int = undefined, params = {}): Promise<Order[]> {
        await this.loadMarkets ();
        await this.getAccessToken ();
        const request: Dict = {};
        if (symbol !== undefined) {
            request['symbol'] = this.bluefinSymbol (symbol);
        }
        const response = await this.tradeGetApiV1TradeOpenOrders (this.extend (request, params));
        const market = (symbol !== undefined) ? this.market (symbol) : undefined;
        const orders = Array.isArray (response) ? response : this.safeList (response, 'orders', []);
        const result: Order[] = [];
        for (let i = 0; i < orders.length; i++) {
            result.push (this.parseOrder (orders[i], market));
        }
        return result;
    }

    // ---- Private write methods ----

    async createOrder (symbol: string, type: OrderType, side: OrderSide, amount: number, price: Num = undefined, params = {}): Promise<Order> {
        await this.loadMarkets ();
        await this.getAccessToken ();
        const market = this.market (symbol);
        const contractsConfig = this.safeDict (this.options, 'contractsConfig', {});
        const idsId = this.safeString (contractsConfig, 'idsId');
        if (idsId === undefined) {
            throw new ArgumentsRequired (this.id + ' createOrder() requires contractsConfig.idsId from fetchMarkets()');
        }
        const now = this.milliseconds ();
        const leverage = this.safeString (params, 'leverage', '1');
        const isIsolated = this.safeBool (params, 'isIsolated', false);
        const reduceOnly = this.safeBool (params, 'reduceOnly', false);
        const postOnly = this.safeBool (params, 'postOnly', false);
        const timeInForce = this.safeString (params, 'timeInForce');
        const clientOrderId = this.safeString (params, 'clientOrderId');
        const bluefinSide = (side === 'buy') ? 'LONG' : 'SHORT';
        const priceStr = (price !== undefined) ? this.numberToString (price) : '0';
        const amountStr = this.numberToString (amount);
        const priceE9 = this.toE9 (priceStr);
        const quantityE9 = this.toE9 (amountStr);
        const leverageE9 = this.toE9 (leverage);
        const salt = this.generateSalt ();
        const expiration = (now + 86400000).toString (); // 24h
        const signedAt = now.toString ();
        const uiPayload: BluefinUIOrderRequest = {
            'type': 'Bluefin Pro Order',
            'ids': idsId,
            'account': this.walletAddress,
            'market': market['id'],
            'price': priceE9,
            'quantity': quantityE9,
            'leverage': leverageE9,
            'side': bluefinSide,
            'positionType': isIsolated ? 'ISOLATED' : 'CROSS',
            'expiration': expiration,
            'salt': salt,
            'signedAt': signedAt,
        };
        const signature = this.signTradeRequest (uiPayload);
        const request: Dict = {
            'signedFields': {
                'symbol': market['id'],
                'accountAddress': this.walletAddress,
                'priceE9': priceE9,
                'quantityE9': quantityE9,
                'side': bluefinSide,
                'leverageE9': leverageE9,
                'isIsolated': isIsolated,
                'salt': salt,
                'idsId': idsId,
                'expiresAtMillis': this.parseToInt (expiration),
                'signedAtMillis': now,
            },
            'signature': signature,
            'type': type.toUpperCase (),
            'reduceOnly': reduceOnly,
        };
        if (postOnly) {
            request['postOnly'] = true;
        }
        if (timeInForce !== undefined) {
            request['timeInForce'] = timeInForce;
        }
        if (clientOrderId !== undefined) {
            request['clientOrderId'] = clientOrderId;
        }
        const cleanParams = this.omit (params, [ 'leverage', 'isIsolated', 'reduceOnly', 'postOnly', 'timeInForce', 'clientOrderId' ]);
        const response = await this.tradePostApiV1TradeOrders (this.extend (request, cleanParams));
        return this.parseOrder (response, market);
    }

    async cancelOrder (id: string, symbol: Str = undefined, params = {}): Promise<Order> {
        await this.loadMarkets ();
        await this.getAccessToken ();
        const request: Dict = {
            'orderHashes': [ id ],
        };
        if (symbol !== undefined) {
            request['symbol'] = this.bluefinSymbol (symbol);
        }
        const response = await this.tradePutApiV1TradeOrdersCancel (this.extend (request, params));
        return this.safeOrder ({
            'id': id,
            'info': response,
            'status': 'canceled',
        });
    }

    async cancelOrders (ids: string[], symbol: Str = undefined, params = {}): Promise<Order[]> {
        await this.loadMarkets ();
        await this.getAccessToken ();
        const request: Dict = {
            'orderHashes': ids,
        };
        if (symbol !== undefined) {
            request['symbol'] = this.bluefinSymbol (symbol);
        }
        const response = await this.tradePutApiV1TradeOrdersCancel (this.extend (request, params));
        const cancelledHashes = this.safeList (response, 'orderHashes', ids);
        const result: Order[] = [];
        for (let i = 0; i < cancelledHashes.length; i++) {
            result.push (this.safeOrder ({
                'id': cancelledHashes[i],
                'info': response,
                'status': 'canceled',
            }));
        }
        return result;
    }

    async setLeverage (leverage: Int, symbol: Str = undefined, params = {}): Promise<any> {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' setLeverage() requires a symbol argument');
        }
        await this.loadMarkets ();
        await this.getAccessToken ();
        const market = this.market (symbol);
        const contractsConfig = this.safeDict (this.options, 'contractsConfig', {});
        const idsId = this.safeString (contractsConfig, 'idsId');
        if (idsId === undefined) {
            throw new ArgumentsRequired (this.id + ' setLeverage() requires contractsConfig.idsId from fetchMarkets()');
        }
        const now = this.milliseconds ();
        const leverageE9 = this.toE9 (this.numberToString (leverage));
        const salt = this.generateSalt ();
        const signedAt = now.toString ();
        const uiPayload: BluefinUILeverageRequest = {
            'type': 'Bluefin Pro Leverage Adjustment',
            'ids': idsId,
            'account': this.walletAddress,
            'market': market['id'],
            'leverage': leverageE9,
            'salt': salt,
            'signedAt': signedAt,
        };
        const signature = this.signTradeRequest (uiPayload);
        const request: Dict = {
            'signedFields': {
                'accountAddress': this.walletAddress,
                'symbol': market['id'],
                'leverageE9': leverageE9,
                'salt': salt,
                'idsId': idsId,
                'signedAtMillis': now,
            },
            'signature': signature,
        };
        return await this.tradePutApiV1TradeLeverage (this.extend (request, params));
    }

    async setMarginMode (marginMode: string, symbol: Str = undefined, params = {}): Promise<any> {
        // Bluefin sets margin mode per-order via the isIsolated field.
        // Store the preference so createOrder can use it as default.
        const mode = marginMode.toLowerCase ();
        if (mode !== 'isolated' && mode !== 'cross') {
            throw new ArgumentsRequired (this.id + ' setMarginMode() marginMode must be "isolated" or "cross"');
        }
        this.options['defaultMarginMode'] = mode;
        return { 'info': mode };
    }

    async addMargin (symbol: string, amount: number, params = {}): Promise<any> {
        return await this.adjustMargin (symbol, amount, 'Add', params);
    }

    async reduceMargin (symbol: string, amount: number, params = {}): Promise<any> {
        return await this.adjustMargin (symbol, amount, 'Remove', params);
    }

    async adjustMargin (symbol: string, amount: number, operation: string, params = {}): Promise<any> {
        await this.loadMarkets ();
        await this.getAccessToken ();
        const market = this.market (symbol);
        const contractsConfig = this.safeDict (this.options, 'contractsConfig', {});
        const idsId = this.safeString (contractsConfig, 'idsId');
        if (idsId === undefined) {
            throw new ArgumentsRequired (this.id + ' adjustMargin() requires contractsConfig.idsId from fetchMarkets()');
        }
        const now = this.milliseconds ();
        const quantityE9 = this.toE9 (this.numberToString (amount));
        const salt = this.generateSalt ();
        const signedAt = now.toString ();
        const isAdd = (operation === 'Add');
        const uiPayload: BluefinUIMarginRequest = {
            'type': 'Bluefin Pro Margin Adjustment',
            'ids': idsId,
            'account': this.walletAddress,
            'market': market['id'],
            'add': isAdd,
            'amount': quantityE9,
            'salt': salt,
            'signedAt': signedAt,
        };
        const signature = this.signTradeRequest (uiPayload);
        const request: Dict = {
            'signedFields': {
                'idsId': idsId,
                'accountAddress': this.walletAddress,
                'symbol': market['id'],
                'operation': operation,
                'quantityE9': quantityE9,
                'salt': salt,
                'signedAtMillis': now,
            },
            'signature': signature,
        };
        return await this.tradePutApiV1TradeAdjustIsolatedMargin (this.extend (request, params));
    }

    async withdraw (code: string, amount: number, address: string, tag: Str = undefined, params = {}): Promise<any> {
        await this.loadMarkets ();
        await this.getAccessToken ();
        const contractsConfig = this.safeDict (this.options, 'contractsConfig', {});
        const edsId = this.safeString (contractsConfig, 'edsId');
        if (edsId === undefined) {
            throw new ArgumentsRequired (this.id + ' withdraw() requires contractsConfig.edsId from fetchMarkets()');
        }
        const now = this.milliseconds ();
        const amountE9 = this.toE9 (this.numberToString (amount));
        const salt = this.generateSalt ();
        const signedAt = now.toString ();
        const uiPayload: BluefinUIWithdrawRequest = {
            'type': 'Bluefin Pro Withdrawal',
            'eds': edsId,
            'assetSymbol': code,
            'account': this.walletAddress,
            'amount': amountE9,
            'salt': salt,
            'signedAt': signedAt,
        };
        const signature = this.signTradeRequest (uiPayload);
        const request: Dict = {
            'signedFields': {
                'assetSymbol': code,
                'accountAddress': this.walletAddress,
                'amountE9': amountE9,
                'salt': salt,
                'edsId': edsId,
                'signedAtMillis': now,
            },
            'signature': signature,
        };
        return await this.tradePostApiV1TradeWithdraw (this.extend (request, params));
    }

    // ---- Parsers ----

    parseMarket (market: Dict): Market {
        const id = this.safeString (market, 'symbol');
        const base = this.safeString (market, 'baseAssetSymbol');
        const quote = 'USDC';
        const settle = 'USDC';
        const symbol = base + '/' + quote + ':' + settle;
        const status = this.safeString (market, 'status');
        return this.safeMarketStructure ({
            'id': id,
            'symbol': symbol,
            'base': base,
            'quote': quote,
            'settle': settle,
            'baseId': base,
            'quoteId': quote,
            'settleId': settle,
            'type': 'swap',
            'spot': false,
            'margin': false,
            'swap': true,
            'future': false,
            'option': false,
            'contract': true,
            'linear': true,
            'inverse': false,
            'active': status === 'ACTIVE',
            'contractSize': this.parseNumber ('1'),
            'precision': {
                'price': this.parseE9 (this.safeString (market, 'tickSizeE9')),
                'amount': this.parseE9 (this.safeString (market, 'stepSizeE9')),
            },
            'limits': {
                'amount': {
                    'min': this.parseE9 (this.safeString (market, 'minOrderQuantityE9')),
                    'max': this.parseE9 (this.safeString (market, 'maxLimitOrderQuantityE9')),
                },
                'price': {
                    'min': this.parseE9 (this.safeString (market, 'minOrderPriceE9')),
                    'max': this.parseE9 (this.safeString (market, 'maxOrderPriceE9')),
                },
                'leverage': {
                    'min': this.parseNumber ('1'),
                    'max': this.parseE9 (this.safeString (market, 'defaultLeverageE9')),
                },
            },
            'info': market,
        });
    }

    parseTicker (ticker: Dict, market: Market = undefined): Ticker {
        const bluefinSym = this.safeString (ticker, 'symbol');
        const symbol = (bluefinSym !== undefined) ? this.ccxtSymbol (bluefinSym) : undefined;
        const last = this.parseE9 (this.safeString (ticker, 'lastPriceE9'));
        const mark = this.parseE9 (this.safeString (ticker, 'markPriceE9'));
        const index = this.parseE9 (this.safeString (ticker, 'oraclePriceE9'));
        const high = this.parseE9 (this.safeString (ticker, 'highPrice24hrE9'));
        const low = this.parseE9 (this.safeString (ticker, 'lowPrice24hrE9'));
        const open = this.parseE9 (this.safeString (ticker, 'openPrice24hrE9'));
        const close = last;
        const bid = this.parseE9 (this.safeString (ticker, 'bestBidPriceE9'));
        const ask = this.parseE9 (this.safeString (ticker, 'bestAskPriceE9'));
        const bidVolume = this.parseE9 (this.safeString (ticker, 'bestBidQuantityE9'));
        const askVolume = this.parseE9 (this.safeString (ticker, 'bestAskQuantityE9'));
        const baseVolume = this.parseE9 (this.safeString (ticker, 'volume24hrE9'));
        const quoteVolume = this.parseE9 (this.safeString (ticker, 'quoteVolume24hrE9'));
        const change = this.parseE9 (this.safeString (ticker, 'priceChange24hrE9'));
        const percentRaw = this.parseE9 (this.safeString (ticker, 'priceChangePercent24hrE9'));
        const percentage = Precise.stringMul (percentRaw, '100');
        const timestamp = this.safeInteger (ticker, 'lastTimeAtMillis');
        return this.safeTicker ({
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': high,
            'low': low,
            'bid': bid,
            'bidVolume': bidVolume,
            'ask': ask,
            'askVolume': askVolume,
            'vwap': undefined,
            'open': open,
            'close': close,
            'last': last,
            'previousClose': undefined,
            'change': change,
            'percentage': percentage,
            'average': undefined,
            'baseVolume': baseVolume,
            'quoteVolume': quoteVolume,
            'markPrice': mark,
            'indexPrice': index,
            'mark': mark,
            'index': index,
            'info': ticker,
        }, market);
    }

    parseTrade (trade: Dict, market: Market = undefined): Trade {
        const id = this.safeString (trade, 'id');
        const bluefinSym = this.safeString (trade, 'symbol');
        const symbol = (bluefinSym !== undefined) ? this.ccxtSymbol (bluefinSym) : undefined;
        const price = this.parseE9 (this.safeString (trade, 'priceE9'));
        const amount = this.parseE9 (this.safeString (trade, 'quantityE9'));
        const cost = this.parseE9 (this.safeString (trade, 'quoteQuantityE9'));
        const side = this.parseOrderSide (this.safeString (trade, 'side'));
        const timestamp = this.safeInteger (trade, 'executedAtMillis');
        const orderId = this.safeString (trade, 'orderHash');
        const takerOrMaker = this.safeStringLower (trade, 'makerTaker');
        // Private trades include fee info
        let fee = undefined;
        const feeE9 = this.safeString (trade, 'tradingFeeE9');
        if (feeE9 !== undefined) {
            fee = {
                'cost': this.parseNumber (this.parseE9 (feeE9)),
                'currency': 'USDC',
            };
        }
        return this.safeTrade ({
            'id': id,
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'order': orderId,
            'type': undefined,
            'side': side,
            'takerOrMaker': takerOrMaker,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': fee,
        }, market);
    }

    parseOrder (order: Dict, market: Market = undefined): Order {
        const id = this.safeString (order, 'orderHash');
        const clientOrderId = this.safeString (order, 'clientOrderId');
        const bluefinSym = this.safeString (order, 'symbol');
        const symbol = (bluefinSym !== undefined) ? this.ccxtSymbol (bluefinSym) : undefined;
        const rawType = this.safeStringLower (order, 'type');
        const side = this.parseOrderSide (this.safeString (order, 'side'));
        const price = this.parseE9 (this.safeString (order, 'priceE9'));
        const amount = this.parseE9 (this.safeString (order, 'quantityE9'));
        const filled = this.parseE9 (this.safeString (order, 'filledQuantityE9'));
        const status = this.parseOrderStatus (this.safeString (order, 'status'));
        const timeInForce = this.safeString (order, 'timeInForce');
        const postOnly = this.safeBool (order, 'postOnly');
        const reduceOnly = this.safeBool (order, 'reduceOnly');
        const timestamp = this.safeInteger (order, 'orderTimeAtMillis');
        return this.safeOrder ({
            'id': id,
            'clientOrderId': clientOrderId,
            'info': order,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'lastTradeTimestamp': undefined,
            'symbol': symbol,
            'type': rawType,
            'timeInForce': timeInForce,
            'postOnly': postOnly,
            'reduceOnly': reduceOnly,
            'side': side,
            'price': price,
            'amount': amount,
            'filled': filled,
            'remaining': undefined,
            'cost': undefined,
            'average': undefined,
            'status': status,
            'fee': undefined,
            'trades': undefined,
        }, market);
    }

    parsePosition (position: Dict, market: Market = undefined): Position {
        const bluefinSym = this.safeString (position, 'symbol');
        const symbol = (bluefinSym !== undefined) ? this.ccxtSymbol (bluefinSym) : undefined;
        const rawSide = this.safeString (position, 'side');
        const side = (rawSide !== undefined) ? rawSide.toLowerCase () : undefined;
        const contracts = this.parseE9 (this.safeString (position, 'sizeE9'));
        const entryPrice = this.parseE9 (this.safeString (position, 'avgEntryPriceE9'));
        const markPrice = this.parseE9 (this.safeString (position, 'markPriceE9'));
        const liquidationPrice = this.parseE9 (this.safeString (position, 'liquidationPriceE9'));
        const notional = this.parseE9 (this.safeString (position, 'notionalValueE9'));
        const unrealizedPnl = this.parseE9 (this.safeString (position, 'unrealizedPnlE9'));
        const initialMargin = this.parseE9 (this.safeString (position, 'marginRequiredE9'));
        const maintenanceMargin = this.parseE9 (this.safeString (position, 'maintenanceMarginE9'));
        const leverage = this.parseE9 (this.safeString (position, 'clientSetLeverageE9'));
        const isIsolated = this.safeBool (position, 'isIsolated');
        const marginMode = isIsolated ? 'isolated' : 'cross';
        const collateral = isIsolated
            ? this.parseE9 (this.safeString (position, 'isolatedMarginE9'))
            : initialMargin;
        const timestamp = this.safeInteger (position, 'updatedAtMillis');
        return this.safePosition ({
            'id': undefined,
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'contracts': contracts,
            'contractSize': undefined,
            'side': side,
            'notional': notional,
            'leverage': leverage,
            'unrealizedPnl': unrealizedPnl,
            'realizedPnl': undefined,
            'collateral': collateral,
            'entryPrice': entryPrice,
            'markPrice': markPrice,
            'liquidationPrice': liquidationPrice,
            'marginMode': marginMode,
            'hedged': undefined,
            'maintenanceMargin': maintenanceMargin,
            'maintenanceMarginPercentage': undefined,
            'initialMargin': initialMargin,
            'initialMarginPercentage': undefined,
            'marginRatio': undefined,
            'percentage': undefined,
            'stopLossPrice': undefined,
            'takeProfitPrice': undefined,
            'info': position,
        });
    }

    parseBalance (response: Dict): Balances {
        const result: Dict = { 'info': response };
        const assets = this.safeList (response, 'assets', []);
        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            const code = this.safeString (asset, 'symbol');
            const account = this.account ();
            account['total'] = this.parseE9 (this.safeString (asset, 'quantityE9'));
            account['free'] = this.parseE9 (this.safeString (asset, 'effectiveBalanceE9'));
            result[code] = account;
        }
        return this.safeBalance (result);
    }

    parseOHLCV (ohlcv: any, market: Market = undefined): OHLCV {
        // Bluefin returns candlesticks as arrays of strings:
        //   [startTime, open, high, low, close, volume,
        //    endTime, quoteVolume, tradeCount]
        return [
            this.safeInteger (ohlcv, 0),
            this.safeNumber (ohlcv, 1),
            this.safeNumber (ohlcv, 2),
            this.safeNumber (ohlcv, 3),
            this.safeNumber (ohlcv, 4),
            this.safeNumber (ohlcv, 5),
        ];
    }

    parseFundingRateHistory (entry: Dict, market: Market = undefined): FundingRateHistory {
        const bluefinSym = this.safeString (entry, 'symbol');
        const symbol = (bluefinSym !== undefined) ? this.ccxtSymbol (bluefinSym) : undefined;
        const fundingRate = this.parseE9 (this.safeString (entry, 'fundingRateE9'));
        const timestamp = this.safeInteger (entry, 'fundingTimeAtMillis');
        return {
            'info': entry,
            'symbol': symbol,
            'fundingRate': this.parseNumber (fundingRate),
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
        } as FundingRateHistory;
    }

    parseOrderStatus (status: Str): string {
        const statuses: Dict = {
            'PENDING': 'open',
            'STANDBY': 'open',
            'OPEN': 'open',
            'PARTIAL_FILLED': 'open',
            'PARTIALLY_FILLED_OPEN': 'open',
            'FILLED': 'closed',
            'CANCELLED': 'canceled',
            'CANCELLING': 'canceled',
            'PARTIALLY_FILLED_CANCELED': 'canceled',
            'EXPIRED': 'canceled',
            'PARTIALLY_FILLED_EXPIRED': 'canceled',
            'REJECTED': 'rejected',
        };
        return this.safeString (statuses, status, status);
    }

    parseOrderSide (side: Str): string {
        const sides: Dict = {
            'LONG': 'buy',
            'SHORT': 'sell',
            'BUY': 'buy',
            'SELL': 'sell',
        };
        return this.safeString (sides, side, side);
    }

    // ---- HTTP signing ----

    sign (path: string, api = 'public', method = 'GET', params: Dict = {}, headers: any = undefined, body: any = undefined): Dict {
        let url = this.urls['api'][api] + '/' + path;
        if (api === 'exchange') {
            if (method === 'GET') {
                if (Object.keys (params).length) {
                    url += '?' + this.urlencode (params);
                }
            } else {
                headers = { 'Content-Type': 'application/json' };
                body = this.json (params);
            }
        } else if (api === 'auth') {
            // Auth endpoints: route payloadSignature from params to header
            const payloadSignature = this.safeString (params, 'payloadSignature');
            const cleanParams = this.omit (params, [ 'payloadSignature' ]);
            headers = { 'Content-Type': 'application/json' };
            if (payloadSignature !== undefined) {
                headers['payloadSignature'] = payloadSignature;
            }
            if (method === 'GET') {
                if (Object.keys (cleanParams).length) {
                    url += '?' + this.urlencode (cleanParams);
                }
            } else {
                body = this.json (cleanParams);
            }
        } else {
            // Private endpoints (account, trade): attach JWT bearer token
            const token = this.safeString (this.options, 'accessToken');
            headers = { 'Content-Type': 'application/json' };
            if (token !== undefined) {
                headers['Authorization'] = 'Bearer ' + token;
            }
            if (method === 'GET') {
                if (Object.keys (params).length) {
                    url += '?' + this.urlencode (params);
                }
            } else {
                body = this.json (params);
            }
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    // ---- Utility ----

    parseE9 (value: Str): Str {
        if (value === undefined) {
            return undefined;
        }
        const precise = new Precise (value);
        precise.decimals = precise.decimals + 9;
        precise.reduce ();
        return precise.toString ();
    }

    toE9 (value: Str): Str {
        if (value === undefined) {
            return undefined;
        }
        const precise = new Precise (value);
        precise.decimals = precise.decimals - 9;
        precise.reduce ();
        return precise.toString ();
    }

    convertE9Levels (levels: any[]): any[][] {
        const result: any[][] = [];
        for (let i = 0; i < levels.length; i++) {
            const level = levels[i];
            result.push ([
                this.parseE9 (this.safeString (level, 0)),
                this.parseE9 (this.safeString (level, 1)),
            ]);
        }
        return result;
    }

    bluefinSymbol (ccxtSymbol: string): string {
        // "ETH/USDC:USDC" → "ETH-PERP"
        const market = this.market (ccxtSymbol);
        return market['base'] + '-PERP';
    }

    ccxtSymbol (bluefinSymbol: string): string {
        // "ETH-PERP" → "ETH/USDC:USDC"
        const base = bluefinSymbol.replace ('-PERP', '');
        return base + '/USDC:USDC';
    }
}
