import { Link, useLocation } from "react-router-dom";
import Disclaimer from "./common/Disclaimer";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/patients", label: "Synthetic Patients" },
  { to: "/dashboard", label: "QI Dashboard" },
  { to: "/fhir", label: "FHIR Mapping" },
  { to: "/epic", label: "Epic Placeholder" },
];

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-clinical-teal">PedsPath-CDS</p>
            <h1 className="text-xl font-semibold">Bronchiolitis Pathway Prototype</h1>
          </div>
          <nav className="flex items-center gap-3 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-full px-3 py-1 transition hover:bg-clinical-teal/10 ${
                  location.pathname === item.to ? "bg-clinical-teal/10 text-clinical-teal" : "text-slate-600"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <Disclaimer />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      <footer className="bg-white/80 py-6 text-center text-xs text-slate-500">
        PedsPath-CDS synthetic-data prototype. Not for clinical use.
      </footer>
    </div>
  );
};

export default Layout;
