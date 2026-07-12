import { validateConfig } from "./config";
import { runSniperLoop } from "./sniper";

validateConfig();
runSniperLoop().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
