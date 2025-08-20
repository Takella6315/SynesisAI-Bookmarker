import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { useEffect, useState } from 'react'
import blink from './blink/client'
import Dashboard from './pages/Dashboard'
import ChatInterface from './pages/ChatInterface'
import Settings from './pages/Settings'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Initializing neural networks...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md mx-auto p-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">
              Neural Chat
            </h1>
            <p className="text-muted-foreground">
              Access the future of AI conversation
            </p>
          </div>
          <button
            onClick={() => blink.auth.login()}
            className="px-8 py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-all duration-300 glow-purple font-medium"
          >
            Initialize Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <Router>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/chat/:id" element={<ChatInterface />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </Router>
      <Toaster position="top-right" />
    </ThemeProvider>
  )
}

export default App