// ---------------------------------------------------------------------------
//  Bluefin — CCXT REST exchange scaffold
//
//  Bluefin is a decentralised perpetual-futures exchange on Sui.  Auth uses
//  Ed25519 wallet signatures (not HMAC); sessions are JWT-based.
//
//  This file is a SCAFFOLD: method bodies contain TODO comments, not real
//  logic.  A team of developers will flesh it out.
// ---------------------------------------------------------------------------
import Exchange from './abstract/bluefin.js';
import { TICK_SIZE } from './base/functions/number.js';
// ---------------------------------------------------------------------------
export default class bluefin extends Exchange {
    describe() {
        return this.deepExtend(super.describe(), {
            'id': 'bluefin',
            'name': 'Bluefin',
            'countries': ['SG'],
            'version': 'v1',
            'rateLimit': 100,
            'certified': false,
            'pro': true,
            'dex': true,
            // ----- credentials -----------------------------------------------
            'requiredCredentials': {
                'apiKey': false,
                'secret': false,
                'walletAddress': true,
                'privateKey': true, // Ed25519 private key
            },
            // ----- capabilities ----------------------------------------------
            'has': {
                'CORS': undefined,
                'spot': false,
                'margin': false,
                'swap': true,
                'future': false,
                'option': false,
                // public
                'fetchMarkets': true,
                'fetchTicker': true,
                'fetchTickers': true,
                'fetchOrderBook': true,
                'fetchTrades': true,
                'fetchOHLCV': true,
                'fetchFundingRateHistory': true,
                // private – account
                'fetchBalance': true,
                'fetchPositions': true,
                'fetchMyTrades': true,
                'fetchOpenOrders': true,
                // private – trading
                'createOrder': true,
                'cancelOrder': true,
                'cancelOrders': true,
                'setLeverage': true,
                'setMarginMode': true,
                'addMargin': true,
                'reduceMargin': true,
                'withdraw': true,
            },
            // ----- timeframes ------------------------------------------------
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
            // ----- URLs ------------------------------------------------------
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
            // ----- API endpoint map ------------------------------------------
            // Each key becomes an auto-generated method on the abstract class.
            // Structure: { group: { method: [ path, ... ] } }
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
                        'api/v1/trade/openOrders',
                        'api/v1/trade/standbyOrders',
                    ],
                },
                'trade': {
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
            // ----- fees ------------------------------------------------------
            'fees': {
                'swap': {
                    'maker': 0.0002,
                    'taker': 0.0005, // 5 bps
                },
            },
            // ----- precision -------------------------------------------------
            'precisionMode': TICK_SIZE,
            // ----- options ---------------------------------------------------
            'options': {
                'defaultType': 'swap',
                'sandboxMode': false,
            },
        });
    }
    // ========================================================================
    //  Public — market data
    // ========================================================================
    async fetchMarkets(params = {}) {
        const response = await this.exchangeGetV1ExchangeInfo(params);
        const markets = this.safeList(response, 'markets', []);
        const result = [];
        for (let i = 0; i < markets.length; i++) {
            result.push(this.parseMarket(markets[i]));
        }
        return result;
    }
    async fetchTicker(symbol, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'symbol': this.bluefinSymbol(symbol),
        };
        const response = await this.exchangeGetV1ExchangeTicker(this.extend(request, params));
        return this.parseTicker(response, market);
    }
    async fetchTickers(symbols = undefined, params = {}) {
        await this.loadMarkets();
        const response = await this.exchangeGetV1ExchangeTickers(params);
        const result = {};
        for (let i = 0; i < response.length; i++) {
            const ticker = this.parseTicker(response[i]);
            const symbol = ticker['symbol'];
            if (symbols !== undefined && !this.inArray(symbol, symbols)) {
                continue;
            }
            result[symbol] = ticker;
        }
        return result;
    }
    async fetchOrderBook(symbol, limit = undefined, params = {}) {
        const request = {
            'symbol': symbol.replace('/USDC:USDC', '-PERP'),
        };
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.exchangeGetV1ExchangeDepth(this.extend(request, params));
        const timestamp = this.safeInteger(response, 'updatedAtMillis');
        const nonce = this.safeInteger(response, 'lastUpdateId');
        // bidsE9/asksE9 are arrays of [priceE9, qtyE9] strings;
        // convert to plain floats before parseOrderBook.
        const rawBids = this.safeList(response, 'bidsE9', []);
        const rawAsks = this.safeList(response, 'asksE9', []);
        const bids = this.convertE9Levels(rawBids);
        const asks = this.convertE9Levels(rawAsks);
        const orderbook = this.parseOrderBook({ 'bids': bids, 'asks': asks }, symbol, timestamp, 'bids', 'asks', 0, 1);
        orderbook['nonce'] = nonce;
        return orderbook;
    }
    async fetchTrades(symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'symbol': this.bluefinSymbol(symbol),
        };
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.exchangeGetV1ExchangeTrades(this.extend(request, params));
        const result = [];
        for (let i = 0; i < response.length; i++) {
            result.push(this.parseTrade(response[i], market));
        }
        return result;
    }
    async fetchOHLCV(symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'symbol': this.bluefinSymbol(symbol),
            'interval': this.safeString(this.timeframes, timeframe, timeframe),
        };
        if (since !== undefined) {
            request['startTime'] = since;
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.exchangeGetV1ExchangeCandlesticks(this.extend(request, params));
        const result = [];
        for (let i = 0; i < response.length; i++) {
            result.push(this.parseOHLCV(response[i], market));
        }
        return result;
    }
    async fetchFundingRateHistory(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        const request = {};
        if (symbol !== undefined) {
            request['symbol'] = symbol.replace('/USDC:USDC', '-PERP');
        }
        if (since !== undefined) {
            request['startTime'] = since;
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.exchangeGetV1ExchangeFundingRateHistory(this.extend(request, params));
        const result = [];
        for (let i = 0; i < response.length; i++) {
            result.push(this.parseFundingRateHistory(response[i]));
        }
        return result;
    }
    // ========================================================================
    //  Private — account
    // ========================================================================
    async fetchBalance(params = {}) {
        // TODO: call accountGetApiV1Account (needs JWT),
        //       parse via parseBalance
        //
        // await this.loadMarkets ();
        // const response = await this.accountGetApiV1Account (params);
        // return this.parseBalance (response);
        throw new Error('fetchBalance not implemented');
    }
    async fetchPositions(symbols = undefined, params = {}) {
        // TODO: call accountGetApiV1Account (needs JWT),
        //       extract positions array, parse each via parsePosition
        throw new Error('fetchPositions not implemented');
    }
    async fetchMyTrades(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        // TODO: call accountGetApiV1AccountTrades (needs JWT),
        //       parse each via parseTrade
        throw new Error('fetchMyTrades not implemented');
    }
    async fetchOpenOrders(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        // TODO: call accountGetApiV1TradeOpenOrders (needs JWT),
        //       parse each via parseOrder
        throw new Error('fetchOpenOrders not implemented');
    }
    // ========================================================================
    //  Private — trading
    // ========================================================================
    async createOrder(symbol, type, side, amount, price = undefined, params = {}) {
        // TODO:
        //  1. loadMarkets, resolve market
        //  2. Build signedFields:
        //     { market, price (E9), quantity (E9), leverage (E9),
        //       side: BUY/SELL, reduceOnly, salt, expiration, orderType }
        //  3. Sign fields with Ed25519 via signRequest()
        //  4. POST to tradePostApiV1TradeOrders with signed payload + JWT
        //  5. Parse response via parseOrder
        throw new Error('createOrder not implemented');
    }
    async cancelOrder(id, symbol = undefined, params = {}) {
        // TODO: build cancel payload with orderId(s),
        //       sign via signRequest, PUT to tradePutApiV1TradeOrdersCancel
        throw new Error('cancelOrder not implemented');
    }
    async cancelOrders(ids, symbol = undefined, params = {}) {
        // TODO: batch cancel — same endpoint, multiple orderIds
        throw new Error('cancelOrders not implemented');
    }
    async setLeverage(leverage, symbol = undefined, params = {}) {
        // TODO: build payload { symbol, leverageE9: toE9(leverage) },
        //       sign with signRequest, PUT to tradePutApiV1TradeLeverage
        throw new Error('setLeverage not implemented');
    }
    async setMarginMode(marginMode, symbol = undefined, params = {}) {
        // TODO: Bluefin sets margin mode via the leverage endpoint
        //       (isolated vs cross is a field on the leverage request)
        throw new Error('setMarginMode not implemented');
    }
    async addMargin(symbol, amount, params = {}) {
        // TODO: PUT to tradePutApiV1TradeAdjustIsolatedMargin
        //       with positive amount (E9)
        throw new Error('addMargin not implemented');
    }
    async reduceMargin(symbol, amount, params = {}) {
        // TODO: PUT to tradePutApiV1TradeAdjustIsolatedMargin
        //       with negative amount (E9)
        throw new Error('reduceMargin not implemented');
    }
    async withdraw(code, amount, address, tag = undefined, params = {}) {
        // TODO: POST to tradePostApiV1TradeWithdraw, signed
        throw new Error('withdraw not implemented');
    }
    // ========================================================================
    //  Parsers
    // ========================================================================
    parseMarket(market) {
        const id = this.safeString(market, 'symbol');
        const base = this.safeString(market, 'baseAssetSymbol');
        const quote = 'USDC';
        const settle = 'USDC';
        const symbol = base + '/' + quote + ':' + settle;
        const status = this.safeString(market, 'status');
        return this.safeMarketStructure({
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
            'active': (status === 'ACTIVE'),
            'contractSize': this.parseNumber('1'),
            'precision': {
                'price': this.parseE9(this.safeString(market, 'tickSizeE9')),
                'amount': this.parseE9(this.safeString(market, 'stepSizeE9')),
            },
            'limits': {
                'amount': {
                    'min': this.parseE9(this.safeString(market, 'minOrderQuantityE9')),
                    'max': this.parseE9(this.safeString(market, 'maxLimitOrderQuantityE9')),
                },
                'price': {
                    'min': this.parseE9(this.safeString(market, 'minOrderPriceE9')),
                    'max': this.parseE9(this.safeString(market, 'maxOrderPriceE9')),
                },
                'leverage': {
                    'min': this.parseNumber('1'),
                    'max': this.parseE9(this.safeString(market, 'defaultLeverageE9')),
                },
            },
            'info': market,
        });
    }
    parseTicker(ticker, market = undefined) {
        const bluefinSym = this.safeString(ticker, 'symbol');
        const symbol = (bluefinSym !== undefined)
            ? this.ccxtSymbol(bluefinSym) : undefined;
        const last = this.parseE9(this.safeString(ticker, 'lastPriceE9'));
        const mark = this.parseE9(this.safeString(ticker, 'markPriceE9'));
        const index = this.parseE9(this.safeString(ticker, 'oraclePriceE9'));
        const high = this.parseE9(this.safeString(ticker, 'highPrice24hrE9'));
        const low = this.parseE9(this.safeString(ticker, 'lowPrice24hrE9'));
        const open = this.parseE9(this.safeString(ticker, 'openPrice24hrE9'));
        const close = last;
        const bid = this.parseE9(this.safeString(ticker, 'bestBidPriceE9'));
        const ask = this.parseE9(this.safeString(ticker, 'bestAskPriceE9'));
        const bidVolume = this.parseE9(this.safeString(ticker, 'bestBidQuantityE9'));
        const askVolume = this.parseE9(this.safeString(ticker, 'bestAskQuantityE9'));
        const baseVolume = this.parseE9(this.safeString(ticker, 'volume24hrE9'));
        const quoteVolume = this.parseE9(this.safeString(ticker, 'quoteVolume24hrE9'));
        const change = this.parseE9(this.safeString(ticker, 'priceChange24hrE9'));
        const percentRaw = this.parseE9(this.safeString(ticker, 'priceChangePercent24hrE9'));
        const percentage = (percentRaw !== undefined)
            ? percentRaw * 100 : undefined;
        const timestamp = this.safeInteger(ticker, 'lastTimeAtMillis');
        return this.safeTicker({
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
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
    parseTrade(trade, market = undefined) {
        const id = this.safeString(trade, 'id');
        const bluefinSym = this.safeString(trade, 'symbol');
        const symbol = (bluefinSym !== undefined)
            ? this.ccxtSymbol(bluefinSym) : undefined;
        const price = this.parseE9(this.safeString(trade, 'priceE9'));
        const amount = this.parseE9(this.safeString(trade, 'quantityE9'));
        const cost = this.parseE9(this.safeString(trade, 'quoteQuantityE9'));
        const side = this.parseOrderSide(this.safeString(trade, 'side'));
        const timestamp = this.safeInteger(trade, 'executedAtMillis');
        return this.safeTrade({
            'id': id,
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'symbol': symbol,
            'order': undefined,
            'type': undefined,
            'side': side,
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': undefined,
        }, market);
    }
    parseOrder(order, market = undefined) {
        const id = this.safeString(order, 'orderHash');
        const clientOrderId = this.safeString(order, 'clientOrderId');
        const bluefinSym = this.safeString(order, 'symbol');
        const symbol = (bluefinSym !== undefined)
            ? this.ccxtSymbol(bluefinSym) : undefined;
        const rawType = this.safeStringLower(order, 'type');
        const side = this.parseOrderSide(this.safeString(order, 'side'));
        const price = this.parseE9(this.safeString(order, 'priceE9'));
        const amount = this.parseE9(this.safeString(order, 'quantityE9'));
        const filled = this.parseE9(this.safeString(order, 'filledQuantityE9'));
        const status = this.parseOrderStatus(this.safeString(order, 'status'));
        const timeInForce = this.safeString(order, 'timeInForce');
        const postOnly = this.safeBool(order, 'postOnly');
        const reduceOnly = this.safeBool(order, 'reduceOnly');
        const timestamp = this.safeInteger(order, 'orderTimeAtMillis');
        return this.safeOrder({
            'id': id,
            'clientOrderId': clientOrderId,
            'info': order,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
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
    parsePosition(position, market = undefined) {
        const bluefinSym = this.safeString(position, 'symbol');
        const symbol = (bluefinSym !== undefined)
            ? this.ccxtSymbol(bluefinSym) : undefined;
        const rawSide = this.safeString(position, 'side');
        const side = (rawSide !== undefined)
            ? rawSide.toLowerCase() : undefined;
        const contracts = this.parseE9(this.safeString(position, 'sizeE9'));
        const entryPrice = this.parseE9(this.safeString(position, 'avgEntryPriceE9'));
        const markPrice = this.parseE9(this.safeString(position, 'markPriceE9'));
        const liquidationPrice = this.parseE9(this.safeString(position, 'liquidationPriceE9'));
        const notional = this.parseE9(this.safeString(position, 'notionalValueE9'));
        const unrealizedPnl = this.parseE9(this.safeString(position, 'unrealizedPnlE9'));
        const initialMargin = this.parseE9(this.safeString(position, 'marginRequiredE9'));
        const maintenanceMargin = this.parseE9(this.safeString(position, 'maintenanceMarginE9'));
        const leverage = this.parseE9(this.safeString(position, 'clientSetLeverageE9'));
        const isIsolated = this.safeBool(position, 'isIsolated');
        const marginMode = isIsolated ? 'isolated' : 'cross';
        const collateral = isIsolated
            ? this.parseE9(this.safeString(position, 'isolatedMarginE9'))
            : initialMargin;
        const timestamp = this.safeInteger(position, 'updatedAtMillis');
        return this.safePosition({
            'id': undefined,
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
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
    parseBalance(response) {
        const result = { 'info': response };
        const assets = this.safeList(response, 'assets', []);
        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            const code = this.safeString(asset, 'symbol');
            const account = this.account();
            account['total'] = this.numberToString(this.parseE9(this.safeString(asset, 'quantityE9')));
            account['free'] = this.numberToString(this.parseE9(this.safeString(asset, 'effectiveBalanceE9')));
            result[code] = account;
        }
        return this.safeBalance(result);
    }
    parseOHLCV(ohlcv, market = undefined) {
        // Bluefin returns candlesticks as arrays of strings:
        //   [startTime, open, high, low, close, volume,
        //    endTime, quoteVolume, tradeCount]
        return [
            this.safeInteger(ohlcv, 0),
            this.safeNumber(ohlcv, 1),
            this.safeNumber(ohlcv, 2),
            this.safeNumber(ohlcv, 3),
            this.safeNumber(ohlcv, 4),
            this.safeNumber(ohlcv, 5),
        ];
    }
    parseFundingRateHistory(entry, market = undefined) {
        const bluefinSym = this.safeString(entry, 'symbol');
        const symbol = (bluefinSym !== undefined)
            ? this.ccxtSymbol(bluefinSym) : undefined;
        const fundingRate = this.parseE9(this.safeString(entry, 'fundingRateE9'));
        const timestamp = this.safeInteger(entry, 'fundingTimeAtMillis');
        return {
            'info': entry,
            'symbol': symbol,
            'fundingRate': fundingRate,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
        };
    }
    parseOrderStatus(status) {
        // Bluefin status → CCXT status
        const statuses = {
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
        return this.safeString(statuses, status, status);
    }
    parseOrderSide(side) {
        // Bluefin uses LONG/SHORT; CCXT uses buy/sell
        const sides = {
            'LONG': 'buy',
            'SHORT': 'sell',
            'BUY': 'buy',
            'SELL': 'sell',
        };
        return this.safeString(sides, side, side);
    }
    // ========================================================================
    //  Authentication
    // ========================================================================
    sign(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        //
        // CCXT calls this for every HTTP request.  We attach auth headers
        // only for private API groups (account, trade).
        //
        let url = this.urls['api'][api] + '/' + path;
        if (api === 'exchange' || api === 'auth') {
            // Public endpoints — no auth header
            if (method === 'GET') {
                if (Object.keys(params).length) {
                    url += '?' + this.urlencode(params);
                }
            }
            else {
                headers = { 'Content-Type': 'application/json' };
                body = this.json(params);
            }
        }
        else {
            // Private endpoints — attach JWT bearer token
            // TODO: call getAccessToken() (which may trigger
            //       authenticate() or refreshAccessToken() as needed)
            //
            // const token = await this.getAccessToken ();
            headers = {
                'Content-Type': 'application/json',
                // 'Authorization': 'Bearer ' + token,
            };
            if (method === 'GET') {
                if (Object.keys(params).length) {
                    url += '?' + this.urlencode(params);
                }
            }
            else {
                body = this.json(params);
            }
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
    async authenticate(params = {}) {
        // TODO: Ed25519 login flow
        //
        //  1. Build LoginRequest:
        //     { userAddress, audience: "bluefin", timestamp }
        //  2. Serialise and sign with Ed25519 (this.privateKey)
        //     to produce a Sui personalMessage signature
        //  3. POST to authPostAuthV2Token with:
        //     { token: base64Signature, userAddress, audience, timestamp }
        //  4. Store response: this.accessToken, this.refreshToken,
        //     this.accessTokenExpiry, this.refreshTokenExpiry
        //  5. Return { accessToken, refreshToken }
        //
        throw new Error('authenticate not implemented');
    }
    async refreshAccessToken(params = {}) {
        // TODO: call authPutAuthTokenRefresh with
        //       { refreshToken: this.refreshToken }
        //       Update stored tokens + expiry times
        throw new Error('refreshAccessToken not implemented');
    }
    async getAccessToken() {
        // TODO:
        //  - If no access token → call authenticate()
        //  - If access token near expiry (< 60s) → call refreshAccessToken()
        //  - Return this.accessToken
        throw new Error('getAccessToken not implemented');
    }
    signRequest(fields) {
        // TODO: Ed25519 personal message signing for trade operations.
        //
        //  Used by createOrder, cancelOrder, setLeverage, withdraw, etc.
        //
        //  1. Deterministically serialise `fields` (sorted keys, specific
        //     Bluefin encoding — see SDK source)
        //  2. Sign with Ed25519 this.privateKey
        //  3. Return { ...fields, signature: base64Signature, signer: walletAddress }
        //
        throw new Error('signRequest not implemented');
    }
    // ========================================================================
    //  Helpers
    // ========================================================================
    parseE9(value) {
        // Bluefin stores prices/quantities as integer strings × 1e9
        return parseFloat(value) / 1e9;
    }
    toE9(value) {
        // Convert a float to Bluefin's E9 string representation
        return Math.round(value * 1e9).toString();
    }
    convertE9Levels(levels) {
        // Convert [[priceE9, qtyE9], ...] to [[price, qty], ...]
        const result = [];
        for (let i = 0; i < levels.length; i++) {
            const level = levels[i];
            result.push([
                this.parseE9(this.safeString(level, 0)),
                this.parseE9(this.safeString(level, 1)),
            ]);
        }
        return result;
    }
    bluefinSymbol(ccxtSymbol) {
        // "ETH/USDC:USDC" → "ETH-PERP"
        const market = this.market(ccxtSymbol);
        return market['base'] + '-PERP';
    }
    ccxtSymbol(bluefinSymbol) {
        // "ETH-PERP" → "ETH/USDC:USDC"
        const base = bluefinSymbol.replace('-PERP', '');
        return base + '/USDC:USDC';
    }
}
