import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Chip,
  Stack,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  CircularProgress
} from '@mui/material';
import {
  QrCodeScanner as QrIcon,
  CameraAlt as CameraIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ShoppingCart as CheckoutIcon
} from '@mui/icons-material';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../contexts/AuthContext';
import { getEquipmentById, checkoutItem } from '../lib/supabaseItems';

/**
 * QR Scanner Page Component
 * Allows scanning QR codes to quickly navigate to items or perform actions
 * Uses html5-qrcode library for cross-platform camera access
 */
function Scan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const scannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [cameraPermission, setCameraPermission] = useState('prompt');

  // Express checkout states
  const [scannedItem, setScannedItem] = useState(null);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [notAvailableDialogOpen, setNotAvailableDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [scanPaused, setScanPaused] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    // Check camera permission status on load
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'camera' }).then((result) => {
        setCameraPermission(result.state);
      });
    }
  }, []);

  // Initialize scanner when isScanning becomes true
  useEffect(() => {
    if (isScanning && !scannerRef.current) {
      // Delay to ensure DOM element is rendered
      setTimeout(() => {
        const container = document.getElementById('qr-scanner-container');
        if (!container) {
          console.error('Scanner container not found');
          setError('Failed to initialize scanner');
          setIsScanning(false);
          return;
        }

        try {
          const scanner = new Html5QrcodeScanner(
            'qr-scanner-container',
            {
              fps: 10,
              qrbox: {
                width: 250,
                height: 250,
              },
              aspectRatio: 1.0,
            },
            /* verbose= */ false
          );

          scanner.render(
            (decodedText) => {
              console.log('QR Code scanned:', decodedText);
              handleScanSuccess(decodedText);
              scanner.clear();
            },
            (error) => {
              // Handle scan failure - this is expected for many frames
              if (error.includes('No QR code found')) {
                return; // Normal scanning state
              }
              console.log('QR scan error:', error);
            }
          );

          scannerRef.current = scanner;
        } catch (err) {
          console.error('Error initializing scanner:', err);
          setError('Failed to initialize scanner');
          setIsScanning(false);
        }
      }, 100); // 100ms delay to ensure DOM is ready
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning]);

  const startScanner = () => {
    if (!isScanning) {
      setIsScanning(true);
      setError(null);
      setScanResult(null);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().then(() => {
        setIsScanning(false);
        scannerRef.current = null;
      }).catch((error) => {
        console.error('Error stopping scanner:', error);
        setIsScanning(false);
        scannerRef.current = null;
      });
    }
  };

  const handleScanSuccess = async (decodedText) => {
    // Prevent multiple scans while processing
    if (scanPaused) {
      console.log('Scan paused, ignoring new scan');
      return;
    }

    setScanPaused(true);
    setIsScanning(false);
    setScanResult(decodedText);

    try {
      // Check if it's a URL first
      if (decodedText.startsWith('http')) {
        // Handle URLs
        console.log('Detected URL:', decodedText);
        setTimeout(() => {
          window.open(decodedText, '_blank');
          setScanPaused(false);
        }, 2000);
        return;
      }

      // Try to parse as formatted item ID (item:ABC or id:ABC)
      const itemIdMatch = decodedText.match(/(?:item[/:]?|id[/:]?)([A-Z0-9]+)/i);
      let itemId = null;

      if (itemIdMatch) {
        // Extract ID from formatted QR code
        itemId = itemIdMatch[1].toUpperCase();
        console.log('Detected formatted item ID:', itemId);
      } else if (/^[A-Z0-9]+$/i.test(decodedText.trim())) {
        // Plain alphanumeric code - treat as direct equipment ID
        itemId = decodedText.trim().toUpperCase();
        console.log('Detected plain item ID:', itemId);
      }

      // If we have a potential item ID, try to fetch it
      if (itemId) {
        try {
          const item = await getEquipmentById(itemId);

          if (item) {
            setScannedItem(item);

            // Check item status
            if (item.status === 'available') {
              // Show express checkout dialog
              setCheckoutDialogOpen(true);
            } else {
              // Item is not available, show not available dialog
              setNotAvailableDialogOpen(true);
            }
          } else {
            // Item not found in database
            setToast({
              open: true,
              message: 'Item not found in database',
              severity: 'error'
            });
            setScanPaused(false);
          }
        } catch (err) {
          console.error('Error fetching item:', err);
          setToast({
            open: true,
            message: 'Error fetching item details',
            severity: 'error'
          });
          setScanPaused(false);
        }
      } else {
        // Not a recognized format - show generic result
        console.log('Generic QR code result:', decodedText);
        setToast({
          open: true,
          message: 'QR code scanned but not recognized as equipment',
          severity: 'info'
        });
        setScanPaused(false);
      }
    } catch (err) {
      console.error('Error in handleScanSuccess:', err);
      setScanPaused(false);
    }
  };

  const handleRetry = () => {
    setScanResult(null);
    setError(null);
    setScanPaused(false);
    setScannedItem(null);
    startScanner();
  };

  const handleCheckoutCancel = () => {
    setCheckoutDialogOpen(false);
    setScannedItem(null);
    setScanPaused(false);
    setScanResult(null);
    // Resume scanning
    startScanner();
  };

  const handleNotAvailableClose = () => {
    setNotAvailableDialogOpen(false);
    setScannedItem(null);
    setScanPaused(false);
    setScanResult(null);
    // Resume scanning
    startScanner();
  };

  const handleViewDetails = () => {
    if (scannedItem) {
      navigate(`/item/${scannedItem.id}`);
    }
  };

  const handleCheckoutConfirm = async () => {
    if (!scannedItem || !user) {
      setToast({
        open: true,
        message: 'Unable to checkout: User not authenticated',
        severity: 'error'
      });
      return;
    }

    setProcessing(true);

    try {
      const result = await checkoutItem(scannedItem.id, user.id);

      if (result.success) {
        setCheckoutDialogOpen(false);
        setToast({
          open: true,
          message: `Successfully checked out ${scannedItem.name}!`,
          severity: 'success'
        });

        // Navigate to item detail page after brief delay
        setTimeout(() => {
          navigate(`/item/${scannedItem.id}`);
        }, 1500);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setToast({
        open: true,
        message: err.message || 'Failed to checkout item',
        severity: 'error'
      });
      setCheckoutDialogOpen(false);
      setScanPaused(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleToastClose = () => {
    setToast({ ...toast, open: false });
  };

  useEffect(() => {
    return () => {
      // Cleanup scanner on unmount
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <QrIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
          <Typography
            variant="h1"
            component="h1"
            sx={{
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              fontWeight: 700,
              color: 'primary.main'
            }}
          >
            QR Code Scanner
          </Typography>
        </Box>
        <Typography
          variant="body1"
          sx={{
            color: 'text.secondary',
            fontSize: '1rem',
            maxWidth: '600px'
          }}
        >
          Scan QR codes on lab equipment to quickly access item details and perform actions.
        </Typography>
      </Box>

      {/* Scanner Container */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Camera Permission Check */}
          {cameraPermission === 'denied' && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Camera Access Denied
              </Typography>
              <Typography variant="body2">
                Please enable camera permissions in your browser settings to use the QR scanner.
              </Typography>
            </Alert>
          )}

          {/* Scan Result Display */}
          {scanResult && (
            <Alert
              severity="success"
              icon={<SuccessIcon />}
              sx={{ mb: 3 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={handleRetry}
                  startIcon={<RefreshIcon />}
                >
                  Scan Again
                </Button>
              }
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                QR Code Scanned Successfully!
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
                {scanResult}
              </Typography>
              {scanResult.match(/(?:item[/:]?|id[/:]?)([A-Z0-9]+)/i) && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Redirecting to item details...
                </Typography>
              )}
            </Alert>
          )}

          {/* Error Display */}
          {error && (
            <Alert
              severity="error"
              icon={<ErrorIcon />}
              sx={{ mb: 3 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </Button>
              }
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Scanner Error
              </Typography>
              <Typography variant="body2">
                {error}
              </Typography>
            </Alert>
          )}

          {/* Scanner Interface */}
          <Box sx={{ textAlign: 'center' }}>
            {!isScanning && !scanResult && (
              <Box>
                <Box
                  sx={{
                    width: '100%',
                    maxWidth: { xs: '100%', sm: 500, md: 600 },
                    height: { xs: 250, sm: 300, md: 400 },
                    mx: 'auto',
                    mb: 3,
                    border: '2px dashed',
                    borderColor: 'primary.main',
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'grey.50'
                  }}
                >
                  <QrIcon sx={{ fontSize: '4rem', color: 'primary.main', opacity: 0.6, mb: 2 }} />
                  <Typography variant="h6" sx={{ color: 'text.secondary', mb: 1 }}>
                    Ready to Scan
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Point your camera at a QR code
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  size="large"
                  onClick={startScanner}
                  startIcon={<CameraIcon />}
                  sx={{ mb: 2 }}
                  disabled={cameraPermission === 'denied'}
                >
                  Start Camera
                </Button>
              </Box>
            )}

            {isScanning && (
              <Box>
                <Box
                  id="qr-scanner-container"
                  sx={{
                    width: '100%',
                    maxWidth: { xs: '100%', sm: 500, md: 600 },
                    mx: 'auto',
                    mb: 3,
                    '& video': {
                      borderRadius: 2,
                      maxWidth: '100%',
                      height: 'auto'
                    }
                  }}
                />

                <Stack direction="row" spacing={2} justifyContent="center">
                  <Button
                    variant="outlined"
                    onClick={stopScanner}
                    startIcon={<RefreshIcon />}
                  >
                    Stop Scanner
                  </Button>
                </Stack>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
          width: '100%'
        }}
      >
        {/* How to Use */}
        <Card sx={{ border: '1px solid', borderColor: 'divider', flex: 1 }}>
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <InfoIcon sx={{ fontSize: '1.25rem' }} />
              How to Use
            </Typography>

            <List dense>
              <ListItem sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    1
                  </Typography>
                </ListItemIcon>
                <ListItemText
                  primary="Click 'Start Camera' to begin scanning"
                  slotProps={{ primary: { variant: 'body2' } }}
                />
              </ListItem>

              <ListItem sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    2
                  </Typography>
                </ListItemIcon>
                <ListItemText
                  primary="Point your camera at the QR code"
                  slotProps={{ primary: { variant: 'body2' } }}
                />
              </ListItem>

              <ListItem sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    3
                  </Typography>
                </ListItemIcon>
                <ListItemText
                  primary="Wait for automatic detection and navigation"
                  slotProps={{ primary: { variant: 'body2' } }}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        {/* Supported QR Codes */}
        <Card sx={{ border: '1px solid', borderColor: 'divider', flex: 1 }}>
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <QrIcon sx={{ fontSize: '1.25rem' }} />
              Supported QR Codes
            </Typography>

            <Stack spacing={2}>
              <Box>
                <Chip
                  label="Item IDs"
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ mb: 1 }}
                />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  QR codes containing equipment IDs (e.g., "item:PRS001", "id/END001")
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Chip
                  label="URLs"
                  size="small"
                  color="secondary"
                  variant="outlined"
                  sx={{ mb: 1 }}
                />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Web links starting with http:// or https://
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Chip
                  label="General Text"
                  size="small"
                  variant="outlined"
                  sx={{ mb: 1 }}
                />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Any other QR code content will be displayed
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Browser Compatibility Note */}
      <Alert
        severity="info"
        sx={{ mt: 3 }}
        icon={<InfoIcon />}
      >
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Browser Compatibility
        </Typography>
        <Typography variant="body2">
          QR scanning requires camera access. Works best on modern browsers with HTTPS.
          On mobile devices, make sure to grant camera permissions when prompted.
        </Typography>
      </Alert>

      {/* Express Checkout Dialog */}
      <Dialog
        open={checkoutDialogOpen}
        onClose={handleCheckoutCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckoutIcon color="primary" />
          Express Check-Out
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {scannedItem && (
              <>
                Do you want to check out <strong>{scannedItem.name}</strong> to yourself?
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Item:</strong> {scannedItem.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Category:</strong> {scannedItem.category}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Location:</strong> {scannedItem.locationPath}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    <Chip label="Available" color="success" size="small" />
                  </Typography>
                </Box>
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCheckoutCancel}
            disabled={processing}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCheckoutConfirm}
            disabled={processing}
            variant="contained"
            startIcon={processing ? <CircularProgress size={20} /> : <CheckoutIcon />}
          >
            {processing ? 'Checking Out...' : 'Confirm Check-Out'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Not Available Dialog */}
      <Dialog
        open={notAvailableDialogOpen}
        onClose={handleNotAvailableClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon color="warning" />
          Item Not Available
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {scannedItem && (
              <>
                This item cannot be checked out because it is currently <strong>{scannedItem.status}</strong>.
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Item:</strong> {scannedItem.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Category:</strong> {scannedItem.category}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Location:</strong> {scannedItem.locationPath}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    <Chip
                      label={scannedItem.status === 'checked_out' ? 'Checked Out' : scannedItem.status === 'broken' ? 'Broken' : scannedItem.status}
                      color="warning"
                      size="small"
                    />
                  </Typography>
                </Box>
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleNotAvailableClose}
            variant="outlined"
          >
            Scan Again
          </Button>
          <Button
            onClick={handleViewDetails}
            variant="contained"
            color="primary"
          >
            View Details
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notifications */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleToastClose}
          severity={toast.severity}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Scan;