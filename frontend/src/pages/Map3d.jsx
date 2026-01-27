import { Suspense, useMemo, useEffect, useState } from "react";
import * as THREE from "three";
import { Link as RouterLink, useParams } from "react-router-dom";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Bounds,
  Html,
  useProgress,
  Environment,
} from "@react-three/drei";

import { getLabById } from "../lib/supabaseLabs";
import { getEquipmentByLabCode } from "../lib/supabaseItems";
import SearchBar from "../components/SearchBar.jsx";
import {
  Box,
  Button,
  Stack,
  Typography,
  CircularProgress,
} from "@mui/material";

const PLACEHOLDER_MODEL = "/models/items/item_placeholder.glb";

function Loader() {
  const { progress } = useProgress();
  return (
    <Html
      center
      style={{ fontFamily: "system-ui", fontSize: 14, pointerEvents: "none" }}
    >
      {Math.round(progress)}%
    </Html>
  );
}

function LabModel({ path }) {
  useGLTF.preload(path);
  const { scene } = useGLTF(path);
  const { gl, camera } = useThree();
  const group = useState(() => new THREE.Group())[0];

  // Enable local clipping
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  // Clipping plane
  const ceilingPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, -1, 0), -1e6),
    [],
  );

  const bounds = useMemo(() => {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    return { minY: box.min.y, maxY: box.max.y };
  }, [scene]);

  const CLIP_OFFSET = 0.35;
  const CEILING_MARGIN = 0.1;

  useFrame(() => {
    if (camera.position.y >= bounds.maxY - CEILING_MARGIN) {
      ceilingPlane.constant = camera.position.y + CLIP_OFFSET;
    } else {
      ceilingPlane.constant = 1e6;
    }
  });

  // Apply backface culling and cliping planes
  useEffect(() => {
    group.add(scene);
    scene.traverse((child) => {
      if (!child.isMesh) return;

      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];

      mats.forEach((mat) => {
        if (!mat) return;

        const name = (child.name + " " + mat.name).toLowerCase();

        // Keep glass/windows double-sided
        if (name.includes("window") || name.includes("glass")) {
          mat.side = THREE.DoubleSide;
        } else {
          // Backface culling
          mat.side = THREE.FrontSide;
        }

        // Attach clipping plane
        mat.clippingPlanes = [ceilingPlane];
        mat.needsUpdate = true;
      });
    });
  }, [scene, ceilingPlane, group]);

  return <primitive object={group} />;
}

// Component to render a single 3D item model
function ItemModel({ item, isSelected, isHighlighted, onSelect }) {
  const { scene } = useGLTF(item.modelPath);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const scale = item.scale || 1;

  return (
    <group>
      {/* Selection ring */}
      {isSelected && (
        <mesh
          position={[item.x, item.y + 0.2, item.z]}
          rotation={[-Math.PI / 2, 0, 0]} // Lay flat
          raycast={() => null}
        >
          <ringGeometry args={[0.4, 0.45, 32]} />
          <meshBasicMaterial color="blue" />
        </mesh>
      )}

      {/* The model */}
      <primitive
        object={clonedScene}
        position={[item.x, item.y, item.z]}
        rotation={[item.rotX || 0, item.rotY || 0, item.rotZ || 0]}
        scale={[scale, scale, scale]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(item.id);
        }}
      />
    </group>
  );
}

export default function Map3D() {
  const { labId } = useParams();
  const [lab, setLab] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((it) => {
      const name = (it.name ?? "").toLowerCase();
      const tags = (it.tags ?? "").toLowerCase(); // Optional
      return name.includes(q) || tags.includes(q);
    });
  }, [items, search]);

  const highlightedIds = useMemo(
    () => new Set(filtered.map((i) => i.id)),
    [filtered],
  );

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return items.find((it) => it.id === selectedItemId) ?? null;
  }, [items, selectedItemId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch lab details
        const labData = await getLabById(labId);
        setLab(labData);

        const labCode = labData.lab_code;
        const itemsData = await getEquipmentByLabCode(labCode);

        // Normalize fields / set fallback model and  coordinates
        const itemsReady = itemsData.map((item, idx) => ({
          ...item,
          modelPath: item.modelPath || PLACEHOLDER_MODEL,
          x: item.x ?? idx * 1.0,
          y: item.y ?? 0,
          z: item.z ?? 0,
        }));

        setItems(itemsReady);
        // Preload all item models
        itemsReady.forEach((item) => useGLTF.preload(item.modelPath));
      } catch (err) {
        console.error("Failed to load lab or items:", err);
        setError(err.message || "Failed to load lab. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [labId]);

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "50vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error || !lab) {
    return (
      <Box>
        <Typography variant="h2">{error || "Lab not found"}</Typography>
        <Button
          sx={{ mt: 2 }}
          component={RouterLink}
          to="/map3d"
          variant="contained"
        >
          Back to Labs
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h1">{lab.name}</Typography>
          {items.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {items.length} 3D {items.length === 1 ? "item" : "items"} in this
              lab
            </Typography>
          )}
        </Box>
        <Button
          variant="contained"
          color="secondary"
          size="small"
          component={RouterLink}
          to="/map3d"
        >
          Go Back To All Labs
        </Button>
      </Stack>

      {/* Camera View */}
      <div style={{ height: "80vh", width: "100%", position: "relative" }}>
        <Box
          sx={{
            position: "absolute",
            top: 16,
            left: 16,
            width: { xs: "calc(100% - 32px)", sm: 360 },
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          {/* Search island: clickable */}
          <Box sx={{ pointerEvents: "auto" }}>
            <Box
              sx={{
                mb: 2,
                px: 1.5,
                py: 1,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Typography variant="subtiltle2" sx={{ color: "text.secondary" }}>
                Current selected item
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {selectedItem
                  ? selectedItem.name || `Item ${selectedItem.id}`
                  : "None"}
              </Typography>
            </Box>
            <SearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch("")}
              onSearch={() => {}}
              placeholder="Search items in this lab..."
            />
            {search.trim() && (
              <Box
                sx={{
                  mt: 1,
                  maxHeight: 270,
                  overflowY: "auto",
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  boxShadow: 3,
                }}
              >
                {filtered.length === 0 ? (
                  <Typography
                    variant="body2"
                    sx={{ p: 1.5, color: "text.secondary" }}
                  >
                    No matches
                  </Typography>
                ) : (
                  filtered.slice(0, 12).map((item) => (
                    <Box
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      sx={{
                        px: 1.5,
                        py: 1,
                        cursor: "pointer",
                        "&:hover": { bgcolor: "action.hover" },
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        "&:last-child": { borderBottom: "none" },
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.name || `Item ${item.id}`}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {item.category || item.tag || ""}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>
            )}
          </Box>
        </Box>
        <Canvas
          camera={{ position: [5, 5, 5], fov: 45 }}
          onPointerMissed={() => setSelectedItemId(null)}
        >
          <ambientLight />
          <directionalLight position={[5, 5, 5]} intensity={0.9} />
          <Suspense fallback={<Loader />}>
            <Bounds fit observe margin={1}>
              {/* Lab Model */}
              <LabModel key={lab.modelPath} path={lab.modelPath} />

              {/* Item Models */}
              {items.map((item) => (
                <ItemModel
                  key={item.id}
                  item={item}
                  isSelected={selectedItemId === item.id}
                  isHighlighted={highlightedIds.has(item.id)}
                  onSelect={setSelectedItemId}
                />
              ))}
            </Bounds>
            <Environment preset="city" />
          </Suspense>
          <OrbitControls makeDefault enablePan enableZoom enableRotate />
        </Canvas>
      </div>
    </Box>
  );
}
