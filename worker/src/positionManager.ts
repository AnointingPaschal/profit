import { config } from "./config";
import { Position } from "./types";

/**
 * Exit strategy for a low-mcap snipe. The core idea: these tokens are extremely volatile
 * and most go to zero — so the strategy is built around cutting losses fast and letting
 * winners run in tranches, rather than trying to call the exact top.
 *
 *  1. Stop loss: exit fully if price drops STOP_LOSS_PCT below entry. Non-negotiable —
 *     this is what keeps one bad snipe from wiping the account.
 *  2. Take-profit ladder: sell partial chunks at each level in TAKE_PROFIT_LEVELS
 *     (e.g. +100%, +300%, +900%) so gains get locked in progressively instead of
 *     round-tripping back to a loss.
 *  3. Trailing stop: once gain exceeds TRAILING_STOP_ACTIVATE_PCT, arm a trailing stop
 *     that sells the remainder if price pulls back TRAILING_STOP_PCT from its peak.
 *     This lets a real runner keep running instead of auto-capping at the last TP level.
 *  4. Time stop: if nothing has happened after MAX_HOLD_MINUTES, exit — capital tied up
 *     in a dead token is capital that isn't finding the next opportunity.
 */

export type ExitAction =
  | { type: "none" }
  | { type: "stop_loss"; sellPct: number }
  | { type: "take_profit"; sellPct: number; level: number }
  | { type: "trailing_stop"; sellPct: number }
  | { type: "time_stop"; sellPct: number };

export function openPosition(
  mint: string,
  symbol: string,
  entryPriceUsd: number,
  amountTokens: number,
  solSpent: number
): Position {
  return {
    mint,
    symbol,
    entryPriceUsd,
    entryTimestamp: Date.now(),
    amountTokens,
    solSpent,
    peakPriceUsd: entryPriceUsd,
    remainingPct: 100,
    tpLevelsHit: config.exit.takeProfitLevels.map(() => false),
    trailingStopArmed: false,
  };
}

export function evaluateExit(position: Position, currentPriceUsd: number): ExitAction {
  const { exit } = config;
  const gainPct = ((currentPriceUsd - position.entryPriceUsd) / position.entryPriceUsd) * 100;

  if (currentPriceUsd > position.peakPriceUsd) {
    position.peakPriceUsd = currentPriceUsd;
  }

  // 1. Hard stop loss — always checked first, overrides everything else.
  if (gainPct <= -exit.stopLossPct && position.remainingPct > 0) {
    return { type: "stop_loss", sellPct: 100 };
  }

  // 2. Trailing stop, once armed, takes priority over fixed TP levels for the remainder.
  if (!position.trailingStopArmed && gainPct >= exit.trailingStopActivatePct) {
    position.trailingStopArmed = true;
  }
  if (position.trailingStopArmed) {
    const pullbackPct = ((position.peakPriceUsd - currentPriceUsd) / position.peakPriceUsd) * 100;
    if (pullbackPct >= exit.trailingStopPct) {
      return { type: "trailing_stop", sellPct: 100 };
    }
  }

  // 3. Take-profit ladder — sell a tranche each time a new level is crossed.
  for (let i = 0; i < exit.takeProfitLevels.length; i++) {
    if (!position.tpLevelsHit[i] && gainPct >= exit.takeProfitLevels[i]) {
      position.tpLevelsHit[i] = true;
      return { type: "take_profit", sellPct: exit.takeProfitSellPcts[i], level: exit.takeProfitLevels[i] };
    }
  }

  // 4. Time stop — cut dead weight.
  const heldMinutes = (Date.now() - position.entryTimestamp) / 60000;
  if (heldMinutes >= exit.maxHoldMinutes && gainPct < exit.trailingStopActivatePct) {
    return { type: "time_stop", sellPct: 100 };
  }

  return { type: "none" };
}

export function applySell(position: Position, sellPct: number) {
  position.remainingPct = Math.max(0, position.remainingPct - sellPct);
}
