import { requireUser } from "@/lib/auth";
import NewTeamClient from "./NewTeamClient";

export const dynamic = "force-dynamic";

export default async function TeamNewPage() {
  await requireUser();
  return <NewTeamClient />;
}
