import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Box, CircularProgress, Typography, Button } from '@mui/material';

/**
 * Protected route wrapper for admin area
 * Requires user to be authenticated and have appropriate role
 */
const AdminProtectedRoute = ({ children, requiredRole = null }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    if (loading) {
      // Set a timeout for 10 seconds
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 10000);

      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [loading]);

  if (loading) {
    if (loadingTimeout) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            gap: 2,
          }}
        >
          <Typography variant="h6" color="error">
            Authentication is taking longer than expected
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This might be due to network issues or cached session data.
          </Typography>
          <Button
            variant="contained"
            onClick={() => {
              // Clear local storage and reload
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }}
          >
            Clear Cache and Retry
          </Button>
        </Box>
      );
    }

    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Check if specific role is required
  if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminProtectedRoute;
