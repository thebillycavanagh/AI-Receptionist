import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Inbox from './pages/Inbox'
import Simulator from './pages/Simulator'
import BusinessProfileSettings from './pages/Settings/BusinessProfile'
import HandlingRulesSettings from './pages/Settings/HandlingRules'
import FaqSettings from './pages/Settings/FAQs'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Inbox />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/settings/profile" element={<BusinessProfileSettings />} />
        <Route path="/settings/rules" element={<HandlingRulesSettings />} />
        <Route path="/settings/faqs" element={<FaqSettings />} />
      </Route>
    </Routes>
  )
}
