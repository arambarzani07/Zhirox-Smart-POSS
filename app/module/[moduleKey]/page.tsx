import PosAppV2 from "../../pos-app-v2";

export default async function ModulePage({ params }: { params: Promise<{ moduleKey: string }> }) {
  const { moduleKey } = await params;
  return <PosAppV2 initialModuleKey={moduleKey} />;
}
