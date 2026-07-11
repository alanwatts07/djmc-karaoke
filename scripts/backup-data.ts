// Read-only snapshot of singers + nights to a JSON file under backups/.
//   bun run scripts/backup-data.ts
import { db } from "@/lib/supabase";
import { writeFileSync } from "fs";
const { data: singers } = await db.from("singers").select("*");
const { data: nights } = await db.from("nights").select("*");
const stamp = process.argv[2] ?? "manual";
const path = `backups/snapshot-${stamp}.json`;
writeFileSync(path, JSON.stringify({ takenFor: stamp, singers, nights }, null, 2));
console.log(`backed up ${singers?.length ?? 0} singers + ${nights?.length ?? 0} nights -> ${path}`);
process.exit(0);
