# buy-and-hold-all — cbBTC race entry

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/fikri92/btc-race-bot-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/fikri92/btc-race-bot-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)



Btc-race-24h entry for `btc-race-24h-20261123-0511`. A deterministic buy-and-hold bot:
it spends the whole account on cbBTC on the first tradable bar (after any warm-up) and
never trades again. The replay flattens the position at the last close.

## What it does

- Reads `agent-fun/bars-replay/v1` through the vendored shim (`vendor/makefun-bars.ts`).
- On the first batch that is not a warm-up and carries a CBBTC close, it sends one buy whose
  notional is the whole account: `min(cash, max_weight_bps x equity / 10000)`, with `equity`
  falling back to `cash` when equity reads 0. `max_slippage_bps` is a fixed 500.
- It is marked **deployed** only when a fill for its order comes back with `status: "filled"`.
  A rejected buy (for example `no_bar` at the next open) is retried on the next tradable bar.
- Once deployed it returns no orders: it holds to the end.

All amounts are `bigint`; the bot reads no clock and uses no randomness, so two executions
produce the same action log byte for byte.

## Why holding beat the trading variants

The dev window drifts up: first open 5,898,691,490, last close 6,110,218,037, **+3.5860%**
over 1,440 one-minute bars.

| Metric (dev window, 1,440 bars) | Value |
|---|---|
| Net drift (first open -> last close) | +3.5860% |
| Up / down / flat bars | 611 / 611 / 218 |
| Mean absolute close-to-close move | 4.776 bps |
| Full-size round-trip cost (fee + slippage + impact) | ~26 bps |

A full-size round trip costs about 26 bps in 4 bps buy fee + 4 bps sell fee + 2 bps slippage
each way plus price impact. The mean close-to-close move is only ~4.8 bps, so any strategy that
trades on the drift pays more in cost than it can catch: each extra round trip is a ~26 bps tax
against a ~4.8 bps signal. Buying once and holding pays a single round trip (~26 bps) and keeps
the whole +3.586% drift. Splitting an order within one reply never helps either — the fills of
one symbol at one open together pay the same as their sum — so there is nothing to gain from
sizing tricks. One buy, zero decisions after it, is the cheapest way to hold the drift.

## Grade (dev window)

```
node cli/makefun.mjs grade-local --kit . --bot <this repo> --driver process
```

| Metric | Result |
|---|---|
| Net PnL | 32.167313 USDC (return 0.032167313) |
| Trades | 1 (1 symbol), 0 rejected |
| Max drawdown | 0.019778194 (1.98%) |
| Guardrails | met (trades ok, symbols ok, drawdown ok) |
| Action log sha256 | d87daf049422bf2b059802d62163782edcdf6d335cd67389ed883cac1b8f4fd1 |

Guardrails require >= 1 trade and <= 25% max drawdown; this entry meets both on the dev window.
