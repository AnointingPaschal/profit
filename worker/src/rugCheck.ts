import fetch from "node-fetch";
import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "./config";
import { RugReport } from "./types";

/**
 * Rug-pull heuristics. IMPORTANT: no automated check catches every scam — insider wallets,
 * delayed mint-authority re-enable via multisig tricks, and fake LP locks all exist.
 * Treat this as a filter that removes obvious rugs, not a guarantee of safety.
 */

async function fetchRugCheckReport(mint: string): Promise<any | null> {
  try {
    const res = await fetch(`${config.rugcheckBaseUrl}/tokens/${mint}/report`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Fallback on-chain checks if RugCheck's API is unavailable or rate-limited. */
async function onChainMintChecks(connection: Connection, mint: string) {
  const mintPubkey = new PublicKey(mint);
  const info = await connection.getParsedAccountInfo(mintPubkey);
  const parsed: any = (info.value?.data as any)?.parsed;
  const mintInfo = parsed?.info;

  return {
    mintAuthorityRenounced: mintInfo?.mintAuthority === null,
    freezeAuthorityRenounced: mintInfo?.freezeAuthority === null,
  };
}

export async function assessRisk(connection: Connection, mint: string): Promise<RugReport> {
  const reasons: string[] = [];
  const report = await fetchRugCheckReport(mint);

  let mintAuthorityRenounced = false;
  let freezeAuthorityRenounced = false;
  let lpLockedPct = 0;
  let top10HolderPct = 100;
  let score = 100; // assume worst until proven otherwise

  if (report) {
    mintAuthorityRenounced = report.mintAuthority
      ? !!report.mintAuthority.renounced
      : report.mint_authority === null;
    freezeAuthorityRenounced = report.freezeAuthority
      ? !!report.freezeAuthority.renounced
      : report.freeze_authority === null;
    lpLockedPct = report.lpLockedPct ?? report.markets?.[0]?.lp?.lpLockedPct ?? 0;
    top10HolderPct = report.topHolderPercent ?? report.top10HolderPercent ?? 100;
    score = report.score ?? score;
  } else {
    reasons.push("RugCheck API unavailable — falling back to on-chain mint/freeze check only");
    const onChain = await onChainMintChecks(connection, mint);
    mintAuthorityRenounced = onChain.mintAuthorityRenounced;
    freezeAuthorityRenounced = onChain.freezeAuthorityRenounced;
    // Without holder/LP data we can't score confidently — treat as elevated risk.
    score = 60;
  }

  if (!mintAuthorityRenounced) reasons.push("mint authority NOT renounced — dev can mint unlimited supply");
  if (!freezeAuthorityRenounced) reasons.push("freeze authority NOT renounced — dev can freeze your tokens");
  if (lpLockedPct < 80) reasons.push(`only ${lpLockedPct.toFixed(0)}% of LP is locked/burned`);
  if (top10HolderPct > 25) reasons.push(`top 10 holders control ${top10HolderPct.toFixed(0)}% of supply`);

  const isRisky =
    !mintAuthorityRenounced ||
    !freezeAuthorityRenounced ||
    lpLockedPct < 80 ||
    top10HolderPct > 25 ||
    score > 50;

  return {
    mintAddress: mint,
    score,
    mintAuthorityRenounced,
    freezeAuthorityRenounced,
    lpLockedPct,
    top10HolderPct,
    isRisky,
    reasons,
  };
}
