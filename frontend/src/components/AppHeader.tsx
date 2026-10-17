import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { Barcode } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Templates", testId: "nav-templates-link" },
  { to: "/print", label: "Print Studio", testId: "nav-print-link" },
];

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header
      data-testid="app-header"
      className="no-print sticky top-0 z-30 flex h-14 shrink-0 items-center gap-6 border-b border-[#2A303C] bg-[#16191F]/95 px-4 backdrop-blur-md"
    >
      <Link to="/" data-testid="brand-home-link" className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-md bg-[#FF5B26] text-[#0F1115]">
          <Barcode className="size-4.5" strokeWidth={2.4} />
        </span>
        <span className="font-heading text-sm font-semibold tracking-[0.18em] text-white">
          BARCODR<span className="text-[#FF5B26]">/</span>
          <span className="font-normal text-neutral-400">STUDIO</span>
        </span>
      </Link>
      <nav className="flex items-center gap-1">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            data-testid={n.testId}
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors duration-150",
                isActive ? "bg-[#1F242C] text-white" : "text-neutral-400 hover:text-white",
              )
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </header>
  );
}
