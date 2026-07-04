import { LuxeSnapApp } from "@/components/luxesnap-app";
import { getDashboardState } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialState = await getDashboardState();

  return <LuxeSnapApp initialState={initialState} />;
}
