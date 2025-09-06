import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navbar from './Components/Navbar';
import Loading from './Components/Loading';
import { Provider, useSelector } from 'react-redux';
import { store } from './redux/store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import FlowSearch from './Pages/FlowSearch.jsx';
import Home from './Pages/Home.jsx';
import Login from './Pages/Login.jsx';
import Control from './Pages/Control.jsx';
import FlowCalculate from './Pages/FlowCalculate.jsx';

function AppRoutes() {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const userRole = useSelector((state) => state.auth.role);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white relative">
      {isAuthenticated && <Navbar />}

      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={isAuthenticated ? <Home /> : <Navigate to="/login" />} />
        <Route path="/flow-search" element={isAuthenticated ? <FlowSearch /> : <Navigate to="/login" />} />
        <Route path="/flow-calculate" element={isAuthenticated && userRole === 'admin' ? <FlowCalculate /> : <Navigate to="/" />} />
        <Route path="/control" element={isAuthenticated && userRole === 'admin' ? <Control /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>

      {showSplash && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-gradient-to-br from-[#E6F0FF] via-[#DDEBFF] to-[#CFE3FF] transition-opacity duration-500 opacity-100">
          <Loading />
        </div>
      )}
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AppRoutes />
        </Router>
      </QueryClientProvider>
    </Provider>
  );
}

export default App;
