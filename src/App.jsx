import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import AppRoutes from './routes/AppRoutes'
import Splash from './components/ui/Splash'

function Shell() {
  const { splash, endSplash } = useAuth()
  return (
    <>
      <AppRoutes />
      {splash && <Splash onDone={endSplash} />}
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}
