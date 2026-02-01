import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Card,
  CardMedia,
  Chip,
  Grid,
  Breadcrumbs,
  Link,
  Alert,
  Snackbar,
  Skeleton,
  Paper,
  Divider,
  Stack,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  OpenInNew as OpenInNewIcon,
  ReportProblem as ReportProblemIcon,
  LocationOn as LocationIcon,
  QrCode as QrCodeIcon,
  Category as CategoryIcon,
  ShoppingCart as ShoppingCartIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";

// API and components
import { getEquipmentById } from "../lib/supabaseItems.js";
import IssueModal from "../components/IssueModal";
import EmptyState from "../components/EmptyState";

/**
 * ItemDetail Page Component
 * Shows comprehensive item information with actions
 * Includes issue reporting modal and 3D map integration
 */
function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State management
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  // Fetch item data
  useEffect(() => {
    const fetchItem = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        const data = await getEquipmentById(id);

        if (!data) {
          setItem(null);
          setError("Item not found in database.");
          return;
        }

        setItem(data);
      } catch (err) {
        console.error("Failed to fetch item:", err);
        setError("Failed to load item details from database.");
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [id]);

  // Navigation handlers
  const handleBack = () => {
    const itemsPath = "/items";
    const query = searchParams.toString();
    navigate(query ? `${itemsPath}?${query}` : itemsPath);
  };

  const handleOpen3D = () => {
    navigate(`/map3d?item=${id}`);

    if (window.flyToItem && typeof window.flyToItem === "function") {
      try {
        window.flyToItem(id);
      } catch (error) {
        console.log("3D integration not available:", error);
      }
    }
  };

  // Modal handlers
  const handleOpenIssueModal = () => {
    setIssueModalOpen(true);
  };

  const handleCloseIssueModal = () => {
    setIssueModalOpen(false);
  };

  const handleIssueSuccess = (notification) => {
    setToast({
      open: true,
      message: notification.message,
      severity: notification.type || "success",
    });
  };

  const handleCloseToast = () => {
    setToast((prev) => ({ ...prev, open: false }));
  };

  // Retry handler
  const handleRetry = () => {
    window.location.reload();
  };

  // Status chip configuration
  const getStatusConfig = (status) => {
    switch (status) {
      case "available":
        return {
          color: "success",
          label: "Available",
          icon: <CheckCircleIcon sx={{ fontSize: 18 }} />
        };
      case "checked_out":
        return {
          color: "warning",
          label: "Checked Out",
          icon: null
        };
      case "broken":
        return {
          color: "error",
          label: "Broken",
          icon: null
        };
      default:
        return {
          color: "default",
          label: status || "Unknown",
          icon: null
        };
    }
  };

  // Loading state
  if (loading) {
    return (
      <Box sx={{ maxWidth: 1400, mx: "auto" }}>
        <Skeleton variant="text" width={200} height={32} sx={{ mb: 3 }} />
        <Card sx={{ overflow: "hidden" }}>
          <Grid container>
            <Grid item xs={5}>
              <Skeleton variant="rectangular" height={500} />
            </Grid>
            <Grid item xs={7}>
              <Box sx={{ p: 4 }}>
                <Skeleton variant="text" width="80%" height={48} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" width={120} height={32} sx={{ mb: 4, borderRadius: 10 }} />
                <Skeleton variant="rectangular" height={200} sx={{ mb: 3, borderRadius: 2 }} />
                <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
              </Box>
            </Grid>
          </Grid>
        </Card>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <EmptyState
        type="error"
        title="Failed to load item"
        description={error}
        onRetry={handleRetry}
      />
    );
  }

  // Item not found
  if (!item) {
    return (
      <EmptyState
        type="noData"
        title="Item not found"
        description={`No item found with ID: ${id}`}
      />
    );
  }

  const statusConfig = getStatusConfig(item.status);

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", pb: 4 }}>
      {/* Breadcrumbs */}
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs aria-label="breadcrumb" separator="›">
          <Link
            component="button"
            variant="body2"
            onClick={handleBack}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              textDecoration: "none",
              color: "primary.main",
              fontWeight: 500,
              "&:hover": {
                textDecoration: "underline",
                color: "primary.dark"
              },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
            Back to Items
          </Link>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {item.name}
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* Main Content */}
      <Card
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          overflow: "hidden",
          transition: "box-shadow 0.3s ease",
          "&:hover": {
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)"
          }
        }}
      >
        <Grid container sx={{ minHeight: 600 }}>
          {/* Image Section */}
          <Grid item xs={5} sx={{ height: 600, maxHeight: 600 }}>
            <Box
              sx={{
                position: "relative",
                height: "100%",
                width: "100%",
                backgroundColor: "grey.50",
                overflow: "hidden",
              }}
            >
              {/* Gradient Overlay */}
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.03) 100%)",
                  zIndex: 1,
                  pointerEvents: "none"
                }}
              />

              <CardMedia
                component="img"
                image={item.thumbnailUrl}
                alt={`${item.name} image`}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transition: "transform 0.3s ease",
                  "&:hover": {
                    transform: "scale(1.02)"
                  }
                }}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />

              {/* Fallback */}
              <Box
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  textAlign: "center",
                  zIndex: 0,
                }}
              >
                <Box sx={{ fontSize: "5rem", mb: 2, opacity: 0.4 }}>📦</Box>
                <Chip
                  label={item.category}
                  sx={{
                    fontWeight: 600,
                    fontSize: "0.875rem"
                  }}
                />
              </Box>

              {/* Status Badge Overlay */}
              <Box
                sx={{
                  position: "absolute",
                  top: 20,
                  right: 20,
                  zIndex: 2,
                }}
              >
                <Chip
                  icon={statusConfig.icon}
                  label={statusConfig.label}
                  color={statusConfig.color}
                  sx={{
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    height: 36,
                    px: 1,
                    backdropFilter: "blur(10px)",
                    backgroundColor: statusConfig.color === "success" ? "rgba(46, 125, 50, 0.95)" :
                                     statusConfig.color === "warning" ? "rgba(237, 108, 2, 0.95)" :
                                     statusConfig.color === "error" ? "rgba(211, 47, 47, 0.95)" :
                                     "rgba(158, 158, 158, 0.95)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                />
              </Box>
            </Box>
          </Grid>

          {/* Details Section */}
          <Grid item xs={7}>
            <Box sx={{ p: { xs: 3, sm: 4, md: 5 }, height: "100%" }}>
              {/* Header */}
              <Box sx={{ mb: 4 }}>
                <Typography
                  variant="h1"
                  sx={{
                    fontSize: { xs: "1.75rem", sm: "2rem", md: "2.5rem" },
                    fontWeight: 700,
                    color: "text.primary",
                    mb: 2,
                    lineHeight: 1.2,
                  }}
                >
                  {item.name}
                </Typography>

                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Chip
                    icon={<QrCodeIcon sx={{ fontSize: 16 }} />}
                    label={`ID: ${item.id}`}
                    size="medium"
                    sx={{
                      fontFamily: "monospace",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      backgroundColor: "primary.main",
                      color: "white",
                      "& .MuiChip-icon": {
                        color: "white"
                      }
                    }}
                  />
                  <Chip
                    icon={<CategoryIcon sx={{ fontSize: 16 }} />}
                    label={item.category}
                    variant="outlined"
                    sx={{
                      fontWeight: 600,
                      borderWidth: 2,
                    }}
                  />
                </Stack>
              </Box>

              <Divider sx={{ mb: 4 }} />

              {/* Information Cards */}
              <Stack spacing={3} sx={{ mb: 4 }}>
                {/* Location Card */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    backgroundColor: "grey.50",
                    border: "1px solid",
                    borderColor: "grey.200",
                    borderRadius: 2,
                    transition: "all 0.2s ease",
                    "&:hover": {
                      borderColor: "primary.main",
                      backgroundColor: "primary.50",
                    }
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        backgroundColor: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <LocationIcon sx={{ fontSize: 28, color: "primary.main" }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={600}
                        textTransform="uppercase"
                        letterSpacing={0.5}
                        sx={{ mb: 0.5, display: "block" }}
                      >
                        Location
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          color: "text.primary",
                          fontSize: "1.125rem"
                        }}
                      >
                        {item.locationPath}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* QR Code Card */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    border: "2px dashed",
                    borderColor: "primary.main",
                    borderRadius: 2,
                    backgroundColor: "primary.50",
                    textAlign: "center",
                  }}
                >
                  <QrCodeIcon sx={{ fontSize: 48, color: "primary.main", mb: 1.5 }} />
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 700,
                      fontFamily: "monospace",
                      color: "primary.dark",
                      mb: 0.5,
                      letterSpacing: 1,
                    }}
                  >
                    {item.id}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Scan this item's QR code label
                  </Typography>
                </Paper>

                {/* Checkout History Card */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    backgroundColor: "grey.50",
                    border: "1px solid",
                    borderColor: "grey.200",
                    borderRadius: 2,
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <HistoryIcon sx={{ fontSize: 24, color: "primary.main" }} />
                    <Typography variant="h6" fontWeight={600}>
                      Checkout History
                    </Typography>
                  </Stack>

                  {item.status === "checked_out" ? (
                    <Box
                      sx={{
                        p: 2,
                        backgroundColor: "warning.50",
                        borderRadius: 1.5,
                        border: "1px solid",
                        borderColor: "warning.200",
                      }}
                    >
                      <Typography variant="body2" color="warning.dark" fontWeight={600} sx={{ mb: 0.5 }}>
                        Currently Checked Out
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Checkout history details will be available when the checkout system is fully implemented.
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: "center", py: 2 }}>
                      <HistoryIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1, opacity: 0.5 }} />
                      <Typography variant="body2" color="text.secondary">
                        {item.status === "available"
                          ? "No active checkouts"
                          : "No checkout history available"}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Stack>

              {/* Action Buttons */}
              <Stack spacing={2}>
                {item.amazonLink && (
                  <Button
                    component="a"
                    href={item.amazonLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="contained"
                    size="large"
                    startIcon={<ShoppingCartIcon />}
                    fullWidth
                    sx={{
                      py: 1.75,
                      fontWeight: 600,
                      fontSize: "1rem",
                      backgroundColor: "#FF9900",
                      color: "#000",
                      boxShadow: "0 2px 8px rgba(255, 153, 0, 0.3)",
                      textTransform: "none",
                      "&:hover": {
                        backgroundColor: "#EC7211",
                        boxShadow: "0 4px 16px rgba(255, 153, 0, 0.4)",
                        transform: "translateY(-1px)",
                      },
                      transition: "all 0.2s ease",
                    }}
                  >
                    View on Amazon
                  </Button>
                )}

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<OpenInNewIcon />}
                      onClick={handleOpen3D}
                      fullWidth
                      sx={{
                        py: 1.75,
                        fontWeight: 600,
                        fontSize: "1rem",
                        textTransform: "none",
                        boxShadow: "0 2px 8px rgba(30, 58, 138, 0.2)",
                        "&:hover": {
                          boxShadow: "0 4px 16px rgba(30, 58, 138, 0.3)",
                          transform: "translateY(-1px)",
                        },
                        transition: "all 0.2s ease",
                      }}
                    >
                      Open in 3D
                    </Button>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Button
                      variant="outlined"
                      size="large"
                      startIcon={<ReportProblemIcon />}
                      onClick={handleOpenIssueModal}
                      color="warning"
                      fullWidth
                      sx={{
                        py: 1.75,
                        fontWeight: 600,
                        fontSize: "1rem",
                        textTransform: "none",
                        borderWidth: 2,
                        "&:hover": {
                          borderWidth: 2,
                          transform: "translateY(-1px)",
                        },
                        transition: "all 0.2s ease",
                      }}
                    >
                      Report Issue
                    </Button>
                  </Grid>
                </Grid>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Issue Reporting Modal */}
      <IssueModal
        open={issueModalOpen}
        onClose={handleCloseIssueModal}
        onSuccess={handleIssueSuccess}
        itemId={item.id}
        itemName={item.name}
      />

      {/* Success/Error Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseToast}
          severity={toast.severity}
          variant="filled"
          elevation={6}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ItemDetail;
