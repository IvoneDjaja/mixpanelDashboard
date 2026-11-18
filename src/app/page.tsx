import { redirect } from "next/navigation";
import { DashboardView } from "@/components/DashboardView";
import { getCurrentConfig } from "@/lib/session/requireSession";

/** Home route rendering the dashboard; redirects to /login when not signed in. */
export default async function Home() {
  if (!(await getCurrentConfig())) redirect("/login");
  return <DashboardView />;
}
