import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import PatientListPage from "./pages/PatientListPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import DashboardPage from "./pages/DashboardPage";
import FhirMappingPage from "./pages/FhirMappingPage";
import EpicPlaceholderPage from "./pages/EpicPlaceholderPage";
import Layout from "./components/Layout";

const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/patients" element={<PatientListPage />} />
        <Route path="/patients/:patientId" element={<PatientDetailPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/fhir" element={<FhirMappingPage />} />
        <Route path="/epic" element={<EpicPlaceholderPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
};

export default App;
