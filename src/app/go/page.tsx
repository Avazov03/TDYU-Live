import { redirect } from "next/navigation";
import { resolveHomePath } from "@/lib/home-path";

export default async function GoPage() {
  redirect(await resolveHomePath());
}
