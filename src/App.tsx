import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { useEffect, useState } from 'react'
import blink from './blink/client'
import LandingPage from './pages/LandingPage.tsx'
import Dashboard from './pages/Dashboard.tsx'
import ChatInterface from './pages/ChatInterface.tsx'
import Settings from './pages/Settings.tsx'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Listen to Blink auth state changes
  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(false)
    })

    // Also check initial auth state
    const checkInitialAuth = async () => {
      try {
        const state = await blink.auth.getAuthState()
        setUser(state.user)
      } catch (error) {
        console.error('Failed to check initial auth state:', error)
      } finally {
        setLoading(false)
      }
    }

    checkInitialAuth()

    return unsubscribe
  }, [])

  // Function to check auth state when needed (called from protected routes)
  const checkAuthState = async () => {
    if (user) return user // Already authenticated
    
    setLoading(true)
    try {
      const state = await blink.auth.getAuthState()
      setUser(state.user)
      return state.user
    } catch (error) {
      console.error('Failed to check auth state:', error)
      return null
    } finally {
      setLoading(false)
    }
  }

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600">Initializing neural networks...</p>
        </div>
      </div>
    )
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <Router>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={user ? <Dashboard /> : <LandingPage />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/dashboard" element={user ? <Dashboard /> : <LandingPage />} />
            <Route path="/chat/:id" element={user ? <ChatInterface /> : <LandingPage />} />
            <Route path="/settings" element={user ? <Settings /> : <LandingPage />} />
          </Routes>
        </div>
      </Router>
      <Toaster position="top-right" />
    </ThemeProvider>
  )
}

export default App