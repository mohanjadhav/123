import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Workspace from "@/pages/Workspace";
import SheetData from "@/pages/SheetData";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/data/:sourceId" element={<SheetData />} />
        <Route path="/data" element={<SheetData />} />
        <Route path="*" element={<Workspace />} />
      </Routes>
      <Toaster richColors />
    </>
  );
}
