import { ReactNode, useEffect, useMemo, useState } from "react";
import { exchangeSmartToken, fetchSmartConfiguration, fetchSmartContext, fetchPatients, refreshSmartToken } from "../api";
import { SmartConfiguration, SmartPatientContext, SmartTokenResponse, PatientSummary } from "../types";

type SandboxProfile = {
  id: string;
  label: string;
  baseUrl: string;
};

const SANDBOX_STORAGE_KEY = "peds-smart-sandboxes";
const DEFAULT_SANDBOX: SandboxProfile = {
  id: "smart-health-it",
  label: "SMART Health IT R4 Sandbox",
  baseUrl: "https://launch.smarthealthit.org/v/r4/sim/eyJrIjoiMSJ9/fhir",
};

const defaultClientId = import.meta.env.VITE_SMART_CLIENT_ID || "peds-path-demo-client";
const defaultRedirectUri = import.meta.env.VITE_SMART_REDIRECT_URI || "https://example.org/smart-redirect";
const apiBase = import.meta.env.VITE_API_BASE_URL || "/peds/api";

const buildAbsoluteApiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (/^https?:\/\//i.test(apiBase)) {
    const trimmedBase = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
    return `${trimmedBase}${normalizedPath}`;
  }
  const trimmedBase = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
  const prefixedBase = trimmedBase.startsWith("/") ? trimmedBase : `/${trimmedBase}`;
  return `${window.location.origin}${prefixedBase}${normalizedPath}`;
};

type LaunchParams = {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  smart_patient_id: string;
};

const EpicPlaceholderPage = () => {
  const [config, setConfig] = useState<SmartConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenResult, setTokenResult] = useState<SmartTokenResponse | null>(null);
  const [contextResult, setContextResult] = useState<SmartPatientContext | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenCode, setTokenCode] = useState("");
  const [tokenIssuedAt, setTokenIssuedAt] = useState<number | null>(null);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [sandboxProfiles, setSandboxProfiles] = useState<SandboxProfile[]>([DEFAULT_SANDBOX]);
  const [selectedSandboxId, setSelectedSandboxId] = useState<string>(DEFAULT_SANDBOX.id);
  const selectedSandbox = sandboxProfiles.find((profile) => profile.id === selectedSandboxId) ?? sandboxProfiles[0];
  const [sandboxConfig, setSandboxConfig] = useState<SmartConfiguration | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxForm, setSandboxForm] = useState({ label: "", baseUrl: "" });
  const [launchParams, setLaunchParams] = useState<LaunchParams>({
    response_type: "code",
    client_id: defaultClientId,
    redirect_uri: defaultRedirectUri,
    scope: "launch patient/*.read",
    state: "demo-state",
    smart_patient_id: "",
  });

  useEffect(() => {
    let active = true;
    fetchSmartConfiguration()
      .then((res) => {
        if (!active) return;
        setConfig(res.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.response?.data?.detail || err.message || "Failed to load SMART metadata");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    fetchPatients()
      .then((res) => {
        if (!active) return;
        setPatients(res.data.patients || []);
        setLaunchParams((prev) => ({
          ...prev,
          smart_patient_id: res.data.patients?.[0]?.patient_id || prev.smart_patient_id,
        }));
      })
      .catch(() => {
        /* optional UI; keep silent */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(SANDBOX_STORAGE_KEY) : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SandboxProfile[];
        if (parsed.length) {
          setSandboxProfiles(parsed);
          setSelectedSandboxId(parsed[0].id);
        }
      } catch {
        /* ignore malformed */
      }
    } else if (typeof window !== "undefined") {
      localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify([DEFAULT_SANDBOX]));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(sandboxProfiles));
    }
    if (!selectedSandboxId && sandboxProfiles.length) {
      setSelectedSandboxId(sandboxProfiles[0].id);
    }
  }, [sandboxProfiles, selectedSandboxId]);

  useEffect(() => {
    if (!tokenResult) {
      return undefined;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [tokenResult]);

  const authorizeUrl = useMemo(() => {
    const params = new URLSearchParams({ ...launchParams });
    if (!launchParams.smart_patient_id) {
      params.delete("smart_patient_id");
    }
    if (config?.issuer) {
      params.set("aud", config.issuer);
    }
    return `${buildAbsoluteApiUrl("/smart/authorize")}?${params.toString()}`;
  }, [launchParams, config]);

  const handleLaunchChange = (field: keyof LaunchParams, value: string) => {
    setLaunchParams((prev) => ({ ...prev, [field]: value }));
  };

  const handleTokenExchange = async (event: React.FormEvent) => {
    event.preventDefault();
    setTokenLoading(true);
    setTokenError(null);
    setTokenResult(null);
    setContextResult(null);
    setTokenIssuedAt(null);
    setRefreshError(null);
    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: tokenCode.trim(),
        redirect_uri: launchParams.redirect_uri,
        client_id: launchParams.client_id,
      });
      const res = await exchangeSmartToken(body);
      setTokenResult(res.data);
      setTokenIssuedAt(Date.now());
      const ctx = await fetchSmartContext(res.data.access_token);
      setContextResult(ctx.data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err.message || "Token exchange failed";
      setTokenError(detail);
    } finally {
      setTokenLoading(false);
    }
  };

  const handleRefreshExchange = async () => {
    if (!tokenResult?.refresh_token) {
      return;
    }
    setRefreshLoading(true);
    setRefreshError(null);
    setTokenError(null);
    try {
      const res = await refreshSmartToken(launchParams.client_id, tokenResult.refresh_token);
      setTokenResult(res.data);
      setTokenIssuedAt(Date.now());
      const ctx = await fetchSmartContext(res.data.access_token);
      setContextResult(ctx.data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err.message || "Refresh exchange failed";
      setRefreshError(detail);
    } finally {
      setRefreshLoading(false);
    }
  };

  const tokenExpiresAt = tokenResult && tokenIssuedAt ? tokenIssuedAt + tokenResult.expires_in * 1000 : null;
  const secondsRemaining = tokenExpiresAt ? Math.max(0, Math.floor((tokenExpiresAt - now) / 1000)) : null;
  const tokenExpired = tokenExpiresAt ? tokenExpiresAt <= now : false;

  const handleSandboxFetch = async () => {
    if (!selectedSandbox?.baseUrl) return;
    setSandboxLoading(true);
    setSandboxError(null);
    setSandboxConfig(null);
    try {
      const normalizedBase = selectedSandbox.baseUrl.trim().replace(/\/$/, "");
      const response = await fetch(`${normalizedBase}/.well-known/smart-configuration`);
      if (!response.ok) {
        throw new Error(`Sandbox responded with ${response.status}`);
      }
      const data = (await response.json()) as SmartConfiguration;
      setSandboxConfig(data);
    } catch (err: any) {
      setSandboxError(err?.message ?? "Unable to load sandbox configuration");
    } finally {
      setSandboxLoading(false);
    }
  };

  const handleAddSandboxProfile = () => {
    if (!sandboxForm.label.trim() || !sandboxForm.baseUrl.trim()) return;
    const newProfile: SandboxProfile = {
      id: `sandbox-${Date.now()}`,
      label: sandboxForm.label.trim(),
      baseUrl: sandboxForm.baseUrl.trim(),
    };
    setSandboxProfiles((prev) => [newProfile, ...prev]);
    setSelectedSandboxId(newProfile.id);
    setSandboxForm({ label: "", baseUrl: "" });
  };

  const handleDeleteSandboxProfile = (id: string) => {
    setSandboxProfiles((prev) => prev.filter((profile) => profile.id !== id));
    if (selectedSandboxId === id && sandboxProfiles.length > 1) {
      const nextProfile = sandboxProfiles.find((profile) => profile.id !== id);
      setSelectedSandboxId(nextProfile?.id || "");
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-clinical-teal">Epic readiness</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">SMART-on-FHIR sandbox roadmap</h2>
        <p className="mt-2 text-sm text-slate-600">
          Synthetic experience only: use these tools to rehearse SMART client registration, launch URLs, and token exchanges before
          touching the real Epic App Orchard workflows.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">1. SMART metadata snapshot</h3>
          {loading && <p className="mt-4 text-sm text-slate-500">Loading SMART discovery document…</p>}
          {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
          {config && (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-slate-800">Issuer</dt>
                <dd className="text-slate-600">{config.issuer}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-800">Authorization endpoint</dt>
                <dd className="text-slate-600">{config.authorization_endpoint}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-800">Token endpoint</dt>
                <dd className="text-slate-600">{config.token_endpoint}</dd>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-slate-800">Scopes</dt>
                  <dd className="text-slate-600">{config.scopes_supported.join(", ")}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-800">Capabilities</dt>
                  <dd className="text-slate-600">{config.capabilities.join(", ")}</dd>
                </div>
              </div>
              <div>
                <dt className="font-semibold text-slate-800">Grant types</dt>
                <dd className="text-slate-600">{config.grant_types_supported.join(", ")}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-800">Token auth methods</dt>
                <dd className="text-slate-600">{config.token_endpoint_auth_methods_supported.join(", ")}</dd>
              </div>
            </dl>
          )}
          <p className="mt-6 text-xs text-slate-500">
            Production Epic integration still requires vendor provisioning, institutional security review, and real SMART launch,
            none of which are enabled in this homelab build.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">2. Build a launch URL</h3>
          <div className="mt-4 space-y-4 text-sm">
            <label className="block">
              <span className="text-slate-600">Client ID</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                value={launchParams.client_id}
                onChange={(e) => handleLaunchChange("client_id", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-slate-600">Redirect URI</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                value={launchParams.redirect_uri}
                onChange={(e) => handleLaunchChange("redirect_uri", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-slate-600">Scope</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                value={launchParams.scope}
                onChange={(e) => handleLaunchChange("scope", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-slate-600">State</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                value={launchParams.state}
                onChange={(e) => handleLaunchChange("state", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-slate-600">Synthetic patient</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                value={launchParams.smart_patient_id}
                onChange={(e) => handleLaunchChange("smart_patient_id", e.target.value)}
              >
                {patients.map((patient) => (
                  <option key={patient.patient_id} value={patient.patient_id}>
                    {patient.patient_id} — {patient.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">Launch URL</p>
            <p className="break-all text-[11px] text-slate-500">{authorizeUrl}</p>
            <button
              className="mt-3 inline-flex items-center rounded-full bg-clinical-teal px-3 py-1 text-xs font-semibold text-white"
              onClick={() => window.open(authorizeUrl, "_blank")}
              disabled={!config}
            >
              Open authorize endpoint
            </button>
          </div>
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">3. Exchange the returned code</h3>
        <form className="mt-4 space-y-4 text-sm" onSubmit={handleTokenExchange}>
          <label className="block">
            <span className="text-slate-600">Authorization code</span>
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
              value={tokenCode}
              onChange={(e) => setTokenCode(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-40"
              disabled={tokenLoading}
            >
              {tokenLoading ? "Exchanging…" : "Exchange token"}
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
              onClick={() => {
                setTokenCode("");
                setTokenResult(null);
                setContextResult(null);
                setTokenError(null);
                setTokenIssuedAt(null);
                setRefreshError(null);
              }}
            >
              Reset
            </button>
          </div>
        </form>
        {tokenError && <p className="mt-4 text-sm text-rose-600">{tokenError}</p>}
        {refreshError && <p className="mt-2 text-sm text-rose-600">{refreshError}</p>}
        {tokenResult && (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                    tokenExpired ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {tokenExpired ? "Access token expired" : "Access token active"}
                </span>
                {secondsRemaining !== null && !tokenExpired && (
                  <span className="text-[11px] text-slate-500">
                    Expires in ~{secondsRemaining}s ({Math.ceil(secondsRemaining / 60)} min)
                  </span>
                )}
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="font-semibold text-slate-800">Patient binding</dt>
                  <dd className="text-slate-600">{tokenResult.patient}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-800">Scope</dt>
                  <dd className="text-slate-600">{tokenResult.scope}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-800">Refresh token</dt>
                  <dd className="text-slate-600 break-all text-[11px]">{tokenResult.refresh_token}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={refreshLoading}
                  onClick={handleRefreshExchange}
                  className="inline-flex items-center rounded-full bg-clinical-teal px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                >
                  {refreshLoading ? "Refreshing…" : "Refresh token"}
                </button>
                <p className="text-[11px] text-slate-500">
                  Refresh exchanges rotate both access & refresh tokens while keeping the same synthetic patient and scope.
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Token response</p>
              <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-slate-900/90 p-4 text-xs text-slate-100">
                {JSON.stringify(tokenResult, null, 2)}
              </pre>
            </div>
            {contextResult && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Patient context (synthetic)</p>
                  <div className="mt-2 rounded-xl border border-slate-100 bg-white/5 p-4 text-xs text-slate-200">
                    <p className="font-semibold text-white">{contextResult.patient.name}</p>
                    <p className="text-slate-300">ID: {contextResult.patient.patient_id}</p>
                    <p className="text-slate-300">Age: {contextResult.patient.age_months} mo</p>
                    <p className="text-slate-300">Scenario: {contextResult.patient.scenario_description}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">FHIR bundle preview</p>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-slate-900/90 p-4 text-xs text-slate-100">
                    {JSON.stringify(contextResult.bundle, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            {contextResult && (
              <EpicFrame patientName={contextResult.patient.name} mrn={contextResult.patient.patient_id} location={contextResult.patient.location}>
                <EpicStoryboardPreview context={contextResult} />
              </EpicFrame>
            )}
          </div>
        )}
        {!tokenResult && !tokenError && (
          <p className="mt-4 text-xs text-slate-500">
            Paste the `code` parameter from the authorize redirect above and use this form to inspect the synthetic access/refresh
            tokens returned by the backend.
          </p>
        )}
        {tokenResult && tokenExpired && (
          <p className="mt-3 text-xs text-amber-600">
            Access token expired? Use the refresh button to mint a new pair, or relaunch `/smart/authorize` for a brand new code.
          </p>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">4. Explore SMART Health IT sandbox metadata</h3>
        <p className="mt-2 text-sm text-slate-600">
          Use the public SMART Health IT sandbox (or any SMART-on-FHIR server) to inspect real discovery documents before registering
          with Epic Nexus/App Orchard. Save multiple sandbox profiles, switch between them, and fetch their `.well-known/smart-configuration`.
        </p>
        <div className="mt-4 space-y-4 text-sm">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved sandbox profiles</p>
            <div className="mt-3 flex flex-col gap-3">
              {sandboxProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`flex flex-wrap items-center justify-between rounded-2xl border px-3 py-2 ${
                    profile.id === selectedSandboxId ? "border-clinical-teal bg-clinical-teal/10" : "border-slate-200"
                  }`}
                >
                  <div>
                    <p className="font-semibold text-slate-800">{profile.label}</p>
                    <p className="text-xs text-slate-500">{profile.baseUrl}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      className="rounded-full border border-slate-300 px-3 py-1"
                      onClick={() => setSelectedSandboxId(profile.id)}
                    >
                      {profile.id === selectedSandboxId ? "Selected" : "Select"}
                    </button>
                    {profile.id !== DEFAULT_SANDBOX.id && (
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 px-3 py-1 text-rose-600"
                        onClick={() => handleDeleteSandboxProfile(profile.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add sandbox</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-slate-600">Label</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                  value={sandboxForm.label}
                  onChange={(e) => setSandboxForm((prev) => ({ ...prev, label: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-slate-600">FHIR base URL</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                  value={sandboxForm.baseUrl}
                  onChange={(e) => setSandboxForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                />
              </label>
            </div>
            <button
              type="button"
              className="mt-3 rounded-full bg-clinical-teal px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
              onClick={handleAddSandboxProfile}
            >
              Save sandbox
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSandboxFetch}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
              disabled={sandboxLoading || !selectedSandbox}
            >
              {sandboxLoading ? "Fetching…" : `Fetch SMART config (${selectedSandbox?.label ?? ""})`}
            </button>
            <a
              href="https://launch.smarthealthit.org/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700"
            >
              Open SMART Health IT launch builder ↗
            </a>
          </div>
          {sandboxError && <p className="text-sm text-rose-600">{sandboxError}</p>}
          {sandboxConfig && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sandbox discovery document</p>
              <pre className="max-h-64 overflow-auto rounded-xl bg-slate-900/90 p-4 text-xs text-slate-100">
                {JSON.stringify(sandboxConfig, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Tip: when you're ready for Epic, follow the App Orchard / Nexus intake to register your client and map these discovery fields
          to Epic's sandbox issuer.
        </p>
      </article>
    </section>
  );
};

const EpicStoryboardPreview = ({ context }: { context: SmartPatientContext }) => {
  const patient = context.patient;
  const activeOrders = patient.current_orders || [];
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 text-slate-800">
      <div className="rounded-2xl bg-gradient-to-r from-[#0c2340] to-[#12385d] p-4 text-white shadow-inner">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-200">Epic-style storyboard</p>
            <h4 className="text-2xl font-semibold">{patient.name}</h4>
            <p className="text-sm text-slate-200">
              {patient.age_months} mo · {patient.location} · SpO₂ {patient.oxygen_saturation}% · Work of breathing {patient.work_of_breathing}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="text-slate-200">Orders</p>
              <p className="text-lg font-semibold">{activeOrders.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="text-slate-200">Pathway</p>
              <p className="text-lg font-semibold">{patient.pathway_order_set_used ? "In use" : "Missing"}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active orders</p>
          {activeOrders.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {activeOrders.map((order) => (
                <li key={order}>{order.replace(/_/g, " ")}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No orders yet — mirror of Epic "Order Review" column.</p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Storyboard notes</p>
          <ul className="mt-2 space-y-2 text-sm">
            <li className="rounded-xl bg-slate-50 px-3 py-2">Feeding adequate: {patient.feeding_adequate ? "Yes" : "Needs support"}</li>
            <li className="rounded-xl bg-slate-50 px-3 py-2">Bronchiolitis severity: {patient.work_of_breathing}</li>
            <li className="rounded-xl bg-slate-50 px-3 py-2">Return 72h: {patient.return_72h ? "Yes" : "No"}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const EpicFrame = ({ children, patientName, mrn, location }: { children: ReactNode; patientName: string; mrn: string; location: string }) => {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-xs text-slate-100">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400">Epic frame mock</p>
          <p className="text-sm font-semibold">{patientName}</p>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] uppercase text-slate-400">MRN</p>
            <p className="text-sm font-semibold">{mrn}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-400">Location</p>
            <p className="text-sm font-semibold">{location}</p>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-500">
        Storyboard & FHIR preview
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
};

export default EpicPlaceholderPage;
