import PosAppV3 from "./pos-app-v3";

type HomeSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: { searchParams: HomeSearchParams }) {
  const params = await searchParams;
  const rawModule = params.module;
  const initialModuleKey = Array.isArray(rawModule) ? rawModule[0] : rawModule;

  return <PosAppV3 initialModuleKey={initialModuleKey ?? null} />;
}
