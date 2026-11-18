import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentConfig } from "@/lib/session/requireSession";

/** Login route; sends already signed-in users to the dashboard. */
export default async function LoginPage() {
  if (await getCurrentConfig()) redirect("/");
  return <LoginForm />;
}
