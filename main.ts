// buy-and-hold-all: spend the whole account on cbBTC on the first tradable bar, then hold
// to the end of the window and let the replay flatten.
//
// Why this beats the trading variants on this window: cbBTC drifts up over the dev window
// (first open 5_898_691_490 -> last close 6_110_218_037, +3.5860%), and a full-size round
// trip costs about 26 bps, so every extra trade only pays fee, slippage and price impact to
// keep a position the drift already rewards. One buy and no sell is the cheapest way to hold
// the drift; the automated flattens at the end is free of any trade decision.
//
// Rules kept: amounts are bigint only, no clock, no randomness (the run is deterministic);
// warm-up batches are respected (state.warmingUp); equity falls back to cash when it is 0;
// max_slippage_bps is a fixed 500; and the bot is marked deployed only when a fill comes back
// with status "filled" -- a rejected buy is retried on the next tradable bar.

import { BPS, runBars, type BuyInput } from './vendor/makefun-bars.ts';

const MAX_SLIPPAGE_BPS = 500;
const SYMBOL = 'CBBTC';
const CLIENT_ID = 'hold1';

let sent = false; // a buy for CLIENT_ID has been sent and is waiting on its fill
let deployed = false; // that buy came back status "filled": we are in the position

await runBars({
  onBatch(state, batch) {
    // 1) Read back the fate of our order from this batch's fills.
    if (sent && !deployed) {
      for (const fill of batch.fills) {
        if (fill.client_id !== CLIENT_ID) continue;
        if (fill.status === 'filled') {
          deployed = true; // position confirmed on the account
        } else {
          sent = false; // rejected (max_slippage, no_bar, ...): allow a retry
        }
      }
    }

    // 2) Already holding: never trade again, hold to the end.
    if (deployed) return [];

    // 3) No orders while warming up, and never resend a buy that is still in flight.
    if (state.warmingUp || sent) return [];

    // 4) Wait until the symbol has a price to trade against.
    if (state.close(SYMBOL) === null) return [];

    // 5) Size the buy at the whole account, capped by the weight limit and the cash on hand.
    const equity = state.equity > 0n ? state.equity : state.cash;
    const weightRoom = (BigInt(state.hello.caps.max_weight_bps) * equity) / BPS;
    const notional = state.cash < weightRoom ? state.cash : weightRoom;
    if (notional < BigInt(state.hello.fees.min_notional_quote_units)) return [];

    sent = true;
    const order: BuyInput = { side: 'buy', client_id: CLIENT_ID, symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [order];
  },
});
