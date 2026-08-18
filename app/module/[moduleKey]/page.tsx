import ResilientPosRoot from "../../resilient-pos-root";

export default async function ModulePage({ params }: { params: Promise<{ moduleKey: string }> }) {
  const { moduleKey } = await params;
  return <ResilientPosRoot initialModuleKey={moduleKey} />;
}
