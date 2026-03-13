import { redirect } from "next/navigation";

import { DEFAULT_DASHBOARD_TAB } from "@/app/dashboard/_constants/tabs";

export default function DashboardPage() {
  redirect(`/dashboard/${DEFAULT_DASHBOARD_TAB}`);
}
