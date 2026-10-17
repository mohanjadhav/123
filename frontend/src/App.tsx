import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Templates from "@/pages/Templates";
import Editor from "@/pages/Editor";
import Print from "@/pages/Print";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Templates />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="/print" element={<Print />} />
        <Route path="*" element={<Templates />} />
      </Routes>
      <Toaster richColors />
    </>
  );
}
