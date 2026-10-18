import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Workspace from "@/pages/Workspace";

// Secondary pages load on first visit, so the designer opens faster.
const SheetData = lazy(() => import("@/pages/SheetData"));
const PrintQueue = lazy(() => import("@/pages/PrintQueue"));
const History = lazy(() => import("@/pages/History"));

const Loading = () => <div className="app-screen grid place-items-center bg-[#EEF0F3] text-sm text-[#6B7280]" data-testid="page-loading">Loading…</div>;

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/data/:sourceId" element={<SheetData />} />
          <Route path="/data" element={<SheetData />} />
          <Route path="/queue" element={<PrintQueue />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Workspace />} />
        </Routes>
      </Suspense>
      <Toaster richColors />
    </>
  );
}
