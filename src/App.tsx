import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { BeerRatingPage } from './pages/BeerRatingPage'
import { SchedulePage } from './pages/SchedulePage'
import { DrinkPage } from './pages/DrinkPage'
import { PhotosPage } from './pages/PhotosPage'
import { BarsPage } from './pages/BarsPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/beers"
            element={
              <ProtectedRoute>
                <BeerRatingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <SchedulePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/drinks"
            element={
              <ProtectedRoute>
                <DrinkPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/photos"
            element={
              <ProtectedRoute>
                <PhotosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bars"
            element={
              <ProtectedRoute>
                <BarsPage />
              </ProtectedRoute>
            }
          />
          {/* Catch-all: redirect unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
