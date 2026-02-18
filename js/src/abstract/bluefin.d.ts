import { implicitReturnType } from '../base/types.js';
import { Exchange as _Exchange } from '../base/Exchange.js';
interface Exchange {
    exchangeGetV1ExchangeInfo(params?: {}): Promise<implicitReturnType>;
    exchangeGetV1ExchangeDepth(params?: {}): Promise<implicitReturnType>;
    exchangeGetV1ExchangeTicker(params?: {}): Promise<implicitReturnType>;
    exchangeGetV1ExchangeTickers(params?: {}): Promise<implicitReturnType>;
    exchangeGetV1ExchangeTrades(params?: {}): Promise<implicitReturnType>;
    exchangeGetV1ExchangeCandlesticks(params?: {}): Promise<implicitReturnType>;
    exchangeGetV1ExchangeFundingRateHistory(params?: {}): Promise<implicitReturnType>;
    authPostAuthToken(params?: {}): Promise<implicitReturnType>;
    authPostAuthV2Token(params?: {}): Promise<implicitReturnType>;
    authPutAuthTokenRefresh(params?: {}): Promise<implicitReturnType>;
    accountGetApiV1Account(params?: {}): Promise<implicitReturnType>;
    accountGetApiV1AccountTrades(params?: {}): Promise<implicitReturnType>;
    accountGetApiV1AccountTransactions(params?: {}): Promise<implicitReturnType>;
    accountGetApiV1AccountFundingRateHistory(params?: {}): Promise<implicitReturnType>;
    tradeGetApiV1TradeOpenOrders(params?: {}): Promise<implicitReturnType>;
    tradeGetApiV1TradeStandbyOrders(params?: {}): Promise<implicitReturnType>;
    tradePostApiV1TradeOrders(params?: {}): Promise<implicitReturnType>;
    tradePostApiV1TradeWithdraw(params?: {}): Promise<implicitReturnType>;
    tradePutApiV1TradeOrdersCancel(params?: {}): Promise<implicitReturnType>;
    tradePutApiV1TradeLeverage(params?: {}): Promise<implicitReturnType>;
    tradePutApiV1TradeAdjustIsolatedMargin(params?: {}): Promise<implicitReturnType>;
}
declare abstract class Exchange extends _Exchange {
}
export default Exchange;
