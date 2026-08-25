import { BundleDetail } from "./bundle-detail";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BundleDetail slug={slug} />;
}
