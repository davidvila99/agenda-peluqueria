import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastProvider } from "./components/ui";
import { StoreProvider } from "./lib/store";
import AdminLayout from "./pages/admin/AdminLayout";
import AgendaPage from "./pages/admin/AgendaPage";
import BookingFormPage from "./pages/admin/BookingFormPage";
import ClientDetailPage from "./pages/admin/ClientDetailPage";
import ClientFormPage from "./pages/admin/ClientFormPage";
import ClientsPage from "./pages/admin/ClientsPage";
import OutboxPage from "./pages/admin/OutboxPage";
import ServicesPage from "./pages/admin/ServicesPage";
import SettingsPage from "./pages/admin/SettingsPage";
import NotFound from "./pages/NotFound";
import BookingDetailPage from "./pages/public/BookingDetailPage";
import BookingWizard from "./pages/public/BookingWizard";
import HomePage from "./pages/public/HomePage";
import MyBookingsPage from "./pages/public/MyBookingsPage";

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/reservar" element={<BookingWizard />} />
            <Route path="/reserva/:code" element={<BookingDetailPage />} />
            <Route path="/mis-citas" element={<MyBookingsPage />} />
            <Route path="/equipo" element={<AdminLayout />}>
              <Route index element={<Navigate to="agenda" replace />} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="agenda/nueva" element={<BookingFormPage />} />
              <Route path="agenda/cita/:id" element={<BookingFormPage />} />
              <Route path="clientas" element={<ClientsPage />} />
              <Route path="clientas/nueva" element={<ClientFormPage />} />
              <Route path="clientas/:id" element={<ClientDetailPage />} />
              <Route path="clientas/:id/editar" element={<ClientFormPage />} />
              <Route path="servicios" element={<ServicesPage />} />
              <Route path="avisos" element={<OutboxPage />} />
              <Route path="ajustes" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </StoreProvider>
  );
}
