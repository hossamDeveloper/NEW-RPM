import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { createContext, useState, useEffect } from 'react';
import Navbar from './Components/Navbar';
import FlowCalculate from './Components/FlowCalculate';
import FlowSearch from './Components/FlowSearch';
import Home from './Pages/Home';
import Login from './Components/Login';
import Loading from './Components/Loading';
import { Provider } from 'react-redux';
import { store } from './redux/store';

export const AuthContext = createContext({
  isAuthenticated: false,
  userRole: null,
  handleLogin: () => {},
  handleLogout: () => {}
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // التحقق من وجود بيانات المستخدم في localStorage
    const userData = localStorage.getItem('userData');
    if (userData) {
      const { isAuthenticated: auth, role } = JSON.parse(userData);
      setIsAuthenticated(auth);
      setUserRole(role);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500); // زيادة وقت التحميل قليلاً

    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (role) => {
    setIsAuthenticated(true);
    setUserRole(role);
    localStorage.setItem('userData', JSON.stringify({ isAuthenticated: true, role }));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    localStorage.removeItem('userData');
  };

  // حماية المسارات
  const ProtectedRoute = ({ children, allowedRoles }) => {
    if (!isAuthenticated) {
      return <Navigate to="/login" />;
    }

    if (allowedRoles && !allowedRoles.includes(userRole)) {
      return <Navigate to="/" />;
    }

    return children;
  };

  const contextValue = {
    isAuthenticated,
    userRole,
    handleLogin,
    handleLogout
  };

  return (
    <AuthContext.Provider value={contextValue}>
      <Provider store={store}>
        <Router>
          <div className="min-h-screen bg-gradient-to-br from-[#021F59] via-[#03178C] to-[#034AA6]">
            {isLoading ? (
              <Loading />
            ) : (
              <>
                {isAuthenticated && <Navbar />}
                <Routes>
                  <Route path="/login" element={
                    isAuthenticated ? <Navigate to="/" /> : <Login />
                  } />
                  <Route path="/" element={
                    <ProtectedRoute>
                      <Home />
                    </ProtectedRoute>
                  } />
                  <Route path="/flow-calculate" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <FlowCalculate />
                    </ProtectedRoute>
                  } />
                  <Route path="/flow-search" element={
                    <ProtectedRoute>
                      <FlowSearch />
                    </ProtectedRoute>
                  } />
                </Routes>
              </>
            )}
          </div>
        </Router>
      </Provider>
    </AuthContext.Provider>
  );
}

export default App;
