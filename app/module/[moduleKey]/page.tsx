import PosAppV3 from "../../pos-app-v3";

export default async function ModulePage({ params }: { params: Promise<{ moduleKey: string }> }) {
  const { moduleKey } = await params;
  return <PosAppV3 initialModuleKey={moduleKey} />;
}
