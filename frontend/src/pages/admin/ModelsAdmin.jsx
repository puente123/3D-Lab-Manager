import { useState, useEffect, useRef } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  RadioButtonUnchecked as NoModelIcon,
  Shuffle as ShuffleIcon,
  ViewInAr as ViewInArIcon,
} from "@mui/icons-material";
import { getEquipment, updateEquipment } from "../../lib/supabaseItems";
import { getLabs } from "../../lib/supabaseLabs";
import { uploadItemModel } from "../../lib/supabaseStorage";

const generateRandomCoords = () => ({
  x: parseFloat((Math.random() * 6 - 3).toFixed(2)), // -3 to +3 (smaller range, closer to center)
  y: 0, // Floor level
  z: parseFloat((Math.random() * 6 - 3).toFixed(2)), // -3 to +3
  rotX: 0,
  rotY: 0,
  rotZ: 0,
});

const emptyForm = () => {
  const coords = generateRandomCoords();
  return { scale: 1, ...coords };
};

const ModelsAdmin = () => {
  const [items, setItems] = useState([]);
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [preSelectedItem, setPreSelectedItem] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [modelFile, setModelFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState(emptyForm());
  const [formErrors, setFormErrors] = useState({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemData, labData] = await Promise.all([
        getEquipment({}),
        getLabs(),
      ]);
      setItems(itemData);
      setLabs(labData);
    } catch {
      showSnackbar("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  /* ─── Dialog open/close ─── */
  const handleOpenDialog = (item = null) => {
    const coords = generateRandomCoords();
    if (item) {
      setPreSelectedItem(item);
      setSelectedItemId(item.id);
      setFormData({
        scale: item.scale ?? 1,
        x: item.x ?? coords.x,
        y: item.y ?? coords.y,
        z: item.z ?? coords.z,
        rotX: item.rotX ?? 0,
        rotY: item.rotY ?? 0,
        rotZ: item.rotZ ?? 0,
      });
    } else {
      setPreSelectedItem(null);
      setSelectedItemId("");
      setFormData({ scale: 1, ...coords });
    }
    setModelFile(null);
    setIsDragging(false);
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setPreSelectedItem(null);
    setSelectedItemId("");
    setModelFile(null);
    setFormErrors({});
  };

  /* ─── Equipment selector in dialog ─── */
  const handleItemSelect = (itemId) => {
    setSelectedItemId(itemId);
    const item = items.find((i) => i.id === itemId);
    if (item) {
      const coords = generateRandomCoords();
      setFormData({
        scale: item.scale ?? 1,
        x: item.x ?? coords.x,
        y: item.y ?? coords.y,
        z: item.z ?? coords.z,
        rotX: item.rotX ?? 0,
        rotY: item.rotY ?? 0,
        rotZ: item.rotZ ?? 0,
      });
    }
    setFormErrors((prev) => ({ ...prev, item: null }));
  };

  /* ─── Drag & Drop ─── */
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };
  const handleFileInput = (e) => {
    processFile(e.target.files[0]);
    e.target.value = null;
  };

  const processFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      showSnackbar("Only .glb files are allowed", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showSnackbar(
        `File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max 10 MB.`,
        "error"
      );
      return;
    }
    setModelFile(file);
    setFormErrors((prev) => ({ ...prev, modelFile: null }));
  };

  /* ─── Randomize coordinates ─── */
  const handleRandomize = () => {
    const coords = generateRandomCoords();
    setFormData((prev) => ({ ...prev, ...coords }));
  };

  /* ─── Submit ─── */
  const handleSubmit = async () => {
    const errors = {};
    const targetItem =
      preSelectedItem || items.find((i) => i.id === selectedItemId);
    if (!targetItem) errors.item = "Please select an equipment item";
    if (!targetItem?.labId) {
      errors.item = "Equipment must be assigned to a lab first. Please assign a lab in Items Admin.";
    }
    if (!modelFile && !targetItem?.modelPath)
      errors.modelFile = "Please upload a .glb file";
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setUploading(true);
    try {
      let modelPath = targetItem.modelPath || "";
      if (modelFile) {
        const result = await uploadItemModel(modelFile);
        if (!result.success) {
          showSnackbar(`Upload failed: ${result.error}`, "error");
          return;
        }
        modelPath = result.url;
      }

      await updateEquipment(targetItem.id, {
        modelPath,
        scale: parseFloat(formData.scale) || 1,
        x: parseFloat(formData.x) || 0,
        y: parseFloat(formData.y) || 0,
        z: parseFloat(formData.z) || 0,
        rotX: parseFloat(formData.rotX) || 0,
        rotY: parseFloat(formData.rotY) || 0,
        rotZ: parseFloat(formData.rotZ) || 0,
      });

      showSnackbar("3D model saved successfully", "success");
      fetchData();
      handleCloseDialog();
    } catch (err) {
      showSnackbar(err.message || "Failed to save model", "error");
    } finally {
      setUploading(false);
    }
  };

  /* ─── Remove model ─── */
  const handleConfirmRemove = async () => {
    if (!itemToRemove) return;
    try {
      await updateEquipment(itemToRemove.id, {
        modelPath: null,
        scale: null,
        x: null,
        y: null,
        z: null,
        rotX: null,
        rotY: null,
        rotZ: null,
      });
      showSnackbar("3D model removed", "success");
      fetchData();
    } catch {
      showSnackbar("Failed to remove model", "error");
    } finally {
      setDeleteDialogOpen(false);
      setItemToRemove(null);
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const withModels = items.filter((i) => i.modelPath);
  const withoutModels = items.filter((i) => !i.modelPath);
  const getLabName = (labId) =>
    labs.find((l) => l.id === labId)?.name || labId;

  const positionLabel = (item) => {
    if (item.x == null) return "—";
    return `(${item.x}, ${item.y}, ${item.z})`;
  };

  return (
    <Box>
      {/* ── Header ── */}
      <Box
        sx={{
          mb: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            3D Models
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Upload &amp; manage 3D models for lab equipment
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Upload 3D Model
        </Button>
      </Box>

      {/* ── Stats ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Total Items", value: items.length, color: "primary.main" },
          {
            label: "With 3D Model",
            value: withModels.length,
            color: "success.main",
          },
          {
            label: "No 3D Model",
            value: withoutModels.length,
            color: "warning.main",
          },
        ].map((stat) => (
          <Grid item xs={12} sm={4} key={stat.label}>
            <Card>
              <CardContent sx={{ textAlign: "center", py: 2, "&:last-child": { pb: 2 } }}>
                <Typography
                  variant="h4"
                  sx={{ fontWeight: 700, color: stat.color }}
                >
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Table ── */}
      {loading ? (
        <LinearProgress />
      ) : (
        <Paper>
          <TableContainer>
            <Table aria-label="3D models table">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Item Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>QR Code</TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: "none", md: "table-cell" } }}>Lab</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>3D Model</TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: "none", sm: "table-cell" } }}>
                    Position (X, Y, Z)
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: "none", sm: "table-cell" } }}>Scale</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <ViewInArIcon
                        sx={{ fontSize: 48, color: "text.disabled", mb: 1 }}
                      />
                      <Typography color="text.secondary">
                        No items found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>
                        {item.name}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: "monospace",
                            bgcolor: "action.hover",
                            px: 0.75,
                            py: 0.25,
                            borderRadius: 1,
                          }}
                        >
                          {item.id}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                        {item.labId ? getLabName(item.labId) : "—"}
                      </TableCell>
                      <TableCell>
                        {item.modelPath ? (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="Uploaded"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        ) : (
                          <Chip
                            icon={<NoModelIcon />}
                            label="None"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {positionLabel(item)}
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                        {item.scale ?? "—"}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip
                          title={item.modelPath ? "Edit Model" : "Upload Model"}
                        >
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenDialog(item)}
                            aria-label={`Upload model for ${item.name}`}
                          >
                            {item.modelPath ? <EditIcon /> : <ViewInArIcon />}
                          </IconButton>
                        </Tooltip>
                        {item.modelPath && (
                          <Tooltip title="Remove Model">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setItemToRemove(item);
                                setDeleteDialogOpen(true);
                              }}
                              aria-label={`Remove model for ${item.name}`}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ── Upload / Edit Dialog ── */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {preSelectedItem?.modelPath
            ? `Edit 3D Model — ${preSelectedItem.name}`
            : preSelectedItem
            ? `Upload 3D Model — ${preSelectedItem.name}`
            : "Upload 3D Model"}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Equipment Selector (only when not opened from a row) */}
            {!preSelectedItem && (
              <FormControl fullWidth error={!!formErrors.item} required>
                <InputLabel>Equipment Item</InputLabel>
                <Select
                  value={selectedItemId}
                  label="Equipment Item"
                  onChange={(e) => handleItemSelect(e.target.value)}
                >
                  {items.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          width: "100%",
                        }}
                      >
                        <Typography sx={{ flex: 1 }}>{item.name}</Typography>
                        {item.modelPath && (
                          <Chip
                            label="Has model"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.item && (
                  <Typography
                    variant="caption"
                    color="error"
                    sx={{ mt: 0.5, ml: 1.75 }}
                  >
                    {formErrors.item}
                  </Typography>
                )}
              </FormControl>
            )}

            {/* ── Lab Assignment Display (Read-Only) ── */}
            <TextField
              label="Lab Assignment"
              value={
                (preSelectedItem || items.find((i) => i.id === selectedItemId))?.labId
                  ? labs.find(
                      (l) => l.id === (preSelectedItem || items.find((i) => i.id === selectedItemId))?.labId
                    )?.name || "Unknown Lab"
                  : "No Lab Assigned"
              }
              fullWidth
              disabled
              helperText="To change lab assignment, use Items Admin. ModelsAdmin is for 3D model management only."
            />

            {/* ── Drag & Drop Upload Zone ── */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                3D Model File (.glb)
                {!preSelectedItem?.modelPath && " *"}
              </Typography>

              <Paper
                variant="outlined"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  p: 3,
                  textAlign: "center",
                  cursor: "pointer",
                  borderStyle: "dashed",
                  borderWidth: 2,
                  borderColor: isDragging
                    ? "primary.main"
                    : formErrors.modelFile
                    ? "error.main"
                    : "divider",
                  bgcolor: isDragging ? "primary.50" : "background.default",
                  transition: "border-color 0.2s, background-color 0.2s",
                  "&:hover": {
                    borderColor: "primary.light",
                    bgcolor: "action.hover",
                  },
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".glb"
                  hidden
                  onChange={handleFileInput}
                />
                <ViewInArIcon
                  sx={{
                    fontSize: 48,
                    color: isDragging ? "primary.main" : "text.secondary",
                    mb: 1,
                    transition: "color 0.2s",
                  }}
                />
                <Typography
                  variant="body2"
                  color={isDragging ? "primary.main" : "text.secondary"}
                >
                  {modelFile ? (
                    <>
                      <strong>{modelFile.name}</strong>
                      <br />({(modelFile.size / 1024 / 1024).toFixed(2)} MB)
                    </>
                  ) : preSelectedItem?.modelPath ? (
                    <>
                      Current:{" "}
                      <strong>
                        {preSelectedItem.modelPath.split("/").pop()}
                      </strong>
                      <br />
                      Drag &amp; drop or click to replace
                    </>
                  ) : isDragging ? (
                    <strong>Drop your .glb file here!</strong>
                  ) : (
                    <>
                      Drag &amp; drop or click to upload
                      <br />
                      GLB files only (max 10 MB)
                    </>
                  )}
                </Typography>
                {uploading && <LinearProgress sx={{ mt: 2 }} />}
              </Paper>

              {formErrors.modelFile && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ mt: 0.5, ml: 1.75, display: "block" }}
                >
                  {formErrors.modelFile}
                </Typography>
              )}
            </Box>

            {/* ── Scale ── */}
            <TextField
              label="Scale"
              type="number"
              inputProps={{ step: 0.1, min: 0.01 }}
              value={formData.scale}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, scale: e.target.value }))
              }
              helperText="Visual size of the model in the lab (default: 1)"
              fullWidth
            />

            {/* ── Position & Rotation ── */}
            <Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 1,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Position &amp; Rotation
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ShuffleIcon />}
                  onClick={handleRandomize}
                >
                  Randomize
                </Button>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 2 }}
              >
                Coordinates are auto-generated. You can fine-tune them later by
                dragging the item inside the 3D lab view.
              </Typography>

              <Grid container spacing={2}>
                {[
                  { key: "x", label: "X Position" },
                  { key: "y", label: "Y Position" },
                  { key: "z", label: "Z Position" },
                  { key: "rotX", label: "X Rotation" },
                  { key: "rotY", label: "Y Rotation" },
                  { key: "rotZ", label: "Z Rotation" },
                ].map(({ key, label }) => (
                  <Grid item xs={4} key={key}>
                    <TextField
                      label={label}
                      type="number"
                      inputProps={{ step: 0.1 }}
                      size="small"
                      fullWidth
                      value={formData[key]}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={uploading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={uploading}
            startIcon={uploading ? <CloudUploadIcon /> : null}
          >
            {uploading ? "Uploading…" : "Save Model"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Remove Confirmation ── */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Remove 3D Model</DialogTitle>
        <DialogContent>
          <Typography>
            Remove the 3D model from{" "}
            <strong>{itemToRemove?.name}</strong>? The equipment record will
            remain but its model data will be cleared.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmRemove}
            color="error"
            variant="contained"
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ModelsAdmin;
