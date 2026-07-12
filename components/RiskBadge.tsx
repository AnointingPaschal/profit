import clsx from "clsx";

export default function RiskBadge({ score, isRisky }: { score: number; isRisky: boolean }) {
  const level = isRisky ? (score > 75 ? "high" : "medium") : "low";
  const styles = {
    low: "bg-accent/15 text-accent",
    medium: "bg-warn/15 text-warn",
    high: "bg-danger/15 text-danger",
  }[level];
  const label = { low: "Safer", medium: "Caution", high: "High Risk" }[level];

  return <span className={clsx("pill", styles)}>{label} · {score}</span>;
}
