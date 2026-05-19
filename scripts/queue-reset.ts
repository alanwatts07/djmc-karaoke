import { db } from "@/lib/supabase";

const { error } = await db
  .from("singers")
  .delete()
  .gte("submitted_at", "1970-01-01");

if (error) {
  console.error(error);
  process.exit(1);
}
console.log("Queue cleared.");
