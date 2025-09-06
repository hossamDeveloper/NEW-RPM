import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = useSelector((state) => state.auth.token);
  const userRole = useSelector((state) => state.auth.role);

  if (!userRole || !token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/search" replace />;
  }

  return children;
};

export default ProtectedRoute; 