import { supabase } from "./supabase";

/**
 * Get all equipment (with filters)
 * @param {Object} options - Filter options
 * @param {string} options.q - Search query
 * @param {string} options.category - Category filter
 * @param {string} options.status - Status filter
 * @param {string} options.labId - Lab ID filter (optional)
 * @returns {Promise<Array>} Array of equipment items
 */
export async function getEquipment({
  q = "",
  category = "all",
  status = "all",
  labId = null,
} = {}) {
  let query = supabase.from("equipment").select("*");

  if (q) {
    query = query.or(
      `qr_code.ilike.%${q}%,name.ilike.%${q}%,category.ilike.%${q}%,location_path.ilike.%${q}%`,
    );
  }

  if (category !== "all") {
    query = query.eq("category", category);
  }

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (labId) {
    query = query.eq("lab_id", labId);
  }

  const { data, error } = await query.order("name");

  if (error) throw error;

  //  Map database fields → UI-friendly shape
  return data.map((item) => ({
    id: item.qr_code, // UI expects `id` to be the QR code
    name: item.name,
    category: item.category,
    status: item.status,
    locationPath: item.location_path,
    thumbnailUrl: item.thumbnail_url,
    amazonLink: item.amazon_link,
    modelPath: item.model_path,
    scale: item.scale,
    labId: item.lab_id,
    x: item.x,
    y: item.y,
    z: item.z,
  }));
}

/**
 * Get single equipment by QR code (NOT UUID)
 * @param {string} qrCode - QR code of the equipment
 * @returns {Promise<Object>} Equipment object
 */
export async function getEquipmentById(qrCode) {
  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("qr_code", qrCode)
    .single();

  if (error) throw error;

  //Map to UI structure
  return {
    id: data.qr_code,
    name: data.name,
    category: data.category,
    status: data.status,
    locationPath: data.location_path,
    thumbnailUrl: data.thumbnail_url,
    amazonLink: data.amazon_link,
    modelPath: data.model_path,
    scale: data.scale,
    labId: data.lab_id,
    x: data.x,
    y: data.y,
    z: data.z,
  };
}

export async function getEquipmentByLabCode(labCode) {
  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("lab_id", String(labCode));

  if (error) throw error;

  //Map to UI structure
  return (data || []).map((row) => ({
    id: row.id,
    qrCode: row.qr_code,
    name: row.name,
    category: row.category,
    status: row.status,
    locationPath: row.location_path,
    thumbnailUrl: row.thumbnail_url,
    amazonLink: row.amazon_link,
    modelPath: row.model_path,
    scale: row.scale,
    labId: row.lab_id,
    x: row.x,
    y: row.y,
    z: row.z,
    rotX: row.rot_x,
    rotY: row.rot_y,
    rotZ: row.rot_z,
  }));
}

/**
 * Create new equipment item
 * @param {Object} itemData - Equipment data
 * @returns {Promise<Object>} Created equipment object
 */
export async function createEquipment(itemData) {
  const dbData = {
    qr_code: itemData.id,
    name: itemData.name,
    category: itemData.category,
    status: itemData.status,
    location_path: itemData.locationPath,
    thumbnail_url: itemData.thumbnailUrl,
    amazon_link: itemData.amazonLink,
    model_path: itemData.modelPath,
    scale: itemData.scale,
    lab_id: itemData.labId,
    x: itemData.x,
    y: itemData.y,
    z: itemData.z,
  };

  const { data, error } = await supabase
    .from("equipment")
    .insert([dbData])
    .select()
    .single();

  if (error) throw error;

  // Map to UI structure
  return {
    id: data.qr_code,
    name: data.name,
    category: data.category,
    status: data.status,
    locationPath: data.location_path,
    thumbnailUrl: data.thumbnail_url,
    amazonLink: data.amazon_link,
    modelPath: data.model_path,
    scale: data.scale,
    labId: data.lab_id,
    x: data.x,
    y: data.y,
    z: data.z,
  };
}

/**
 * Update existing equipment item
 * @param {string} qrCode - QR code of the equipment
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated equipment object
 */
export async function updateEquipment(qrCode, updates) {
  const dbUpdates = {};

  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.locationPath !== undefined)
    dbUpdates.location_path = updates.locationPath;
  if (updates.thumbnailUrl !== undefined)
    dbUpdates.thumbnail_url = updates.thumbnailUrl;
  if (updates.amazonLink !== undefined)
    dbUpdates.amazon_link = updates.amazonLink;
  if (updates.modelPath !== undefined) dbUpdates.model_path = updates.modelPath;
  if (updates.scale !== undefined) dbUpdates.scale = updates.scale;
  if (updates.labId !== undefined) dbUpdates.lab_id = updates.labId;
  if (updates.x !== undefined) dbUpdates.x = updates.x;
  if (updates.y !== undefined) dbUpdates.y = updates.y;
  if (updates.z !== undefined) dbUpdates.z = updates.z;

  const { data, error } = await supabase
    .from("equipment")
    .update(dbUpdates)
    .eq("qr_code", qrCode)
    .select()
    .single();

  if (error) throw error;

  // Map to UI structure
  return {
    id: data.qr_code,
    name: data.name,
    category: data.category,
    status: data.status,
    locationPath: data.location_path,
    thumbnailUrl: data.thumbnail_url,
    amazonLink: data.amazon_link,
    modelPath: data.model_path,
    scale: data.scale,
    labId: data.lab_id,
    x: data.x,
    y: data.y,
    z: data.z,
  };
}

/**
 * Delete equipment item
 * @param {string} qrCode - QR code of the equipment
 * @returns {Promise<void>}
 */
export async function deleteEquipment(qrCode) {
  const { error } = await supabase
    .from("equipment")
    .delete()
    .eq("qr_code", qrCode);

  if (error) throw error;
}
