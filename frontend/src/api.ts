import axios from "axios";
import { SmartPatientContext, SmartTokenResponse } from "./types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
});

export const fetchPatients = () => api.get("/patients");
export const fetchPatient = (id: string) => api.get(`/patients/${id}`);
export const fetchAssessment = (id: string) => api.get(`/patients/${id}/pathway-assessment`);
export const fetchSmartphrase = (id: string) => api.get(`/patients/${id}/smartphrase`);
export const fetchFhirBundle = (id: string) => api.get(`/patients/${id}/fhir`);
export const fetchDashboardMetrics = () => api.get(`/dashboard/metrics`);
export const fetchDashboardEncounters = () => api.get(`/dashboard/encounters`);
export const fetchSmartConfiguration = () => api.get(`/smart/.well-known/smart-configuration`);
export const exchangeSmartToken = (payload: URLSearchParams) =>
  api.post<SmartTokenResponse>(`/smart/token`, payload, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

export const refreshSmartToken = (clientId: string, refreshToken: string) => {
  const payload = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  return exchangeSmartToken(payload);
};

export const fetchSmartContext = (accessToken: string) =>
  api.get<SmartPatientContext>(`/smart/context`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

export default api;
