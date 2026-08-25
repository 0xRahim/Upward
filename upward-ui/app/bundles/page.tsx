import { Suspense } from "react";
import { BundlesBrowser, BundlesBrowserFallback } from "./bundles-browser";

export default function Page() {
  return (
    <Suspense fallback={<BundlesBrowserFallback />}>
      <BundlesBrowser />
    </Suspense>
  );
}
