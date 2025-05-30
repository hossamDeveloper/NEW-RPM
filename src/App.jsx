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
import Control from './Components/Control';

export const AuthContext = createContext();

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
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (username, role) => {
    setIsAuthenticated(true);
    setUserRole(role);
    localStorage.setItem('userData', JSON.stringify({ isAuthenticated: true, role }));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    localStorage.removeItem('userData');
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
                  <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
                  
                  {/* Home Route */}
                  <Route
                    path="/"
                    element={
                      isAuthenticated ? (
                        <Home />
                      ) : (
                        <Navigate to="/login" />
                      )
                    }
                  />

                  {/* Flow Search Route */}
                  <Route
                    path="/flow-search"
                    element={
                      isAuthenticated ? (
                        <FlowSearch />
                      ) : (
                        <Navigate to="/login" />
                      )
                    }
                  />

                  {/* Flow Calculate Route - Only accessible by admin */}
                  <Route
                    path="/flow-calculate"
                    element={
                      isAuthenticated && userRole === 'admin' ? (
                        <FlowCalculate />
                      ) : (
                        <Navigate to="/" />
                      )
                    }
                  />

                  {/* Control Route - Only accessible by admin */}
                  <Route
                    path="/control"
                    element={
                      isAuthenticated && userRole === 'admin' ? (
                        <Control />
                      ) : (
                        <Navigate to="/" />
                      )
                    }
                  />

                  {/* Redirect any unknown routes to login */}
                  <Route path="*" element={<Navigate to="/login" />} />
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
