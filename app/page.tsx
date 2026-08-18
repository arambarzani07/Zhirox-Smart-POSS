import ResilientPosRoot from "./resilient-pos-root";

type HomeSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: { searchParams: HomeSearchParams }) {
  const params = await searchParams;
  const rawModule = params.module;
  const initialModuleKey = Array.isArray(rawModule) ? rawModule[0] : rawModule;

  return <ResilientPosRoot initialModuleKey={initialModuleKey ?? null} />;
}
