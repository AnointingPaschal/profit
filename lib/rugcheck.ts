import { Connection, PublicKey } from "@solana/web3.js";
import { RugReport } from "./types";

const RUGCHECK_BASE = "https://api.rugcheck.xyz/v1";

async function fetchRugCheckReport(mint: string): Promise<any | null> {
  try {
    const res = await fetch(`${RUGCHECK_BASE}/tokens/${mint}/report`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function onChainMintChecks(mint: string, rpcUrl: string) {
  const connection = new Connection(rpcUrl, "confirmed");
  const info = await connection.getParsedAccountInfo(new PublicKey(mint));
  const parsed: any = (info.value?.data as any)?.parsed;
  const mintInfo = parsed?.info;
  return {
    mintAuthorityRenounced: mintInfo?.mintAuthority === null,
    freezeAuthorityRenounced: mintInfo?.freezeAuthority === null,
  };
}

export async function assessRisk(mint: string, rpcUrl: string): Promise<RugReport> {
  const reasons: string[] = [];
  const report = await fetchRugCheckReport(mint);

  let mintAuthorityRenounced = false;
  let freezeAuthorityRenounced = false;
  let lpLockedPct = 0;
  let top10HolderPct = 100;
  let score = 100;
  let source: RugReport["source"] = "rugcheck";

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
    source = "onchain-fallback";
    reasons.push("RugCheck API unavailable — using on-chain mint/freeze check only, holder/LP data unknown");
    try {
      const onChain = await onChainMintChecks(mint, rpcUrl);
      mintAuthorityRenounced = onChain.mintAuthorityRenounced;
      freezeAuthorityRenounced = onChain.freezeAuthorityRenounced;
      score = 60;
    } catch {
      reasons.push("on-chain check also failed — treat this token as unverified");
      score = 100;
    }
  }

  if (!mintAuthorityRenounced) reasons.push("mint authority NOT renounced — supply can be inflated");
  if (!freezeAuthorityRenounced) reasons.push("freeze authority NOT renounced — accounts can be frozen");
  if (lpLockedPct < 80) reasons.push(`only ${lpLockedPct.toFixed(0)}% of LP is locked/burned`);
  if (top10HolderPct > 25) reasons.push(`top 10 holders control ${top10HolderPct.toFixed(0)}% of supply`);

  const isRisky =
    !mintAuthorityRenounced || !freezeAuthorityRenounced || lpLockedPct < 80 || top10HolderPct > 25 || score > 50;

  return {
    mint,
    score,
    mintAuthorityRenounced,
    freezeAuthorityRenounced,
    lpLockedPct,
    top10HolderPct,
    isRisky,
    reasons,
    source,
  };
}
