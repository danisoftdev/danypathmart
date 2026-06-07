import { Navigate } from 'react-router-dom';

/** Legacy URL — canonical policy lives at /policies/returns */
export default function ReturnsPolicyPage() {
  return <Navigate to="/policies/returns" replace />;
}
