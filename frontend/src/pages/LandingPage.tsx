import { Link } from "react-router-dom";

const LandingPage = () => {
  const cards = [
    {
      title: "Run Synthetic Pediatric Demo",
      to: "/patients",
      description: "Review pathway eligibility, low-value-care flags, and SmartPhrase support.",
    },
    {
      title: "View Dashboard",
      to: "/dashboard",
      description: "Monitor pathway adoption and variation using synthetic encounters.",
    },
    {
      title: "View FHIR Mapping",
      to: "/fhir",
      description: "Explore how synthetic data aligns with FHIR resources for future readiness.",
    },
    {
      title: "Epic Sandbox Demo Placeholder",
      to: "/epic",
      description: "Document future SMART-on-FHIR integration roadmap.",
    },
  ];

  return (
    <section className="space-y-8">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.4em] text-clinical-teal">PedsPath-CDS</p>
        <h2 className="mt-4 text-4xl font-semibold text-slate-900">Synthetic-data pediatric pathway support and QI analytics prototype</h2>
        <p className="mt-3 max-w-3xl text-lg text-slate-600">
          First module: bronchiolitis. Built for homelab experimentation and future Epic SMART-on-FHIR readiness using only
          synthetic data. Phrase outputs as review prompts—not autonomous orders.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.title} to={card.to} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-clinical-teal">
            <h3 className="text-xl font-semibold text-slate-900">{card.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{card.description}</p>
            <div className="mt-4 inline-flex items-center text-sm font-semibold text-clinical-teal">
              Launch module
              <span className="ml-2 transition group-hover:translate-x-1">→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default LandingPage;
