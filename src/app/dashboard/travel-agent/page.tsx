import { Layout } from "@/components/layout/layout";
import { TravelAgentWorkspace } from "@/components/travel-agent/TravelAgentWorkspace";

export default function DashboardTravelAgentPage() {
  return (
    <Layout hideFooter mainClassName="flex flex-col overflow-hidden">
      <TravelAgentWorkspace />
    </Layout>
  );
}
