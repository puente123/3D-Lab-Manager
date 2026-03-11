import { supabase } from "./supabase";

/**
 * Check out an equipment item
 * Performs two operations:
 * 1. Updates equipment status from 'available' to 'checked_out'
 * 2. Inserts a checkout log entry with equipment_id, user_id, and checkout_date
 *
 * @param {string} equipmentId - The QR code / ID of the equipment
 * @param {string} userId - The ID of the user checking out the item
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function checkoutEquipment(equipmentId, userId) {
  try {
    // Start by verifying the item is available and get its UUID
    const { data: equipment, error: fetchError } = await supabase
      .from("equipment")
      .select("id, status")
      .eq("qr_code", equipmentId)
      .single();

    if (fetchError) {
      console.error("Error fetching equipment:", fetchError);
      return {
        success: false,
        error: "Failed to verify equipment status.",
      };
    }

    if (!equipment) {
      return {
        success: false,
        error: "Equipment not found.",
      };
    }

    if (equipment.status !== "available") {
      return {
        success: false,
        error: "This item is not available for checkout.",
      };
    }

    // Perform checkout transaction
    // 1. Update equipment status to 'checked_out'
    const { error: updateError } = await supabase
      .from("equipment")
      .update({ status: "checked_out" })
      .eq("qr_code", equipmentId);

    if (updateError) {
      console.error("Error updating equipment status:", updateError);
      return {
        success: false,
        error: "Failed to update equipment status.",
      };
    }

    // 2. Insert checkout log entry using the equipment UUID
    const { error: logError } = await supabase
      .from("checkout_log")
      .insert({
        equipment_id: equipment.id,
        user_id: userId,
        checkout_date: new Date().toISOString(),
      });

    if (logError) {
      console.error("Error creating checkout log:", logError);

      // Attempt to rollback the status update
      await supabase
        .from("equipment")
        .update({ status: "available" })
        .eq("qr_code", equipmentId);

      return {
        success: false,
        error: "Failed to create checkout record.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error during checkout:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Return an equipment item
 * Updates equipment status back to 'available' and updates the checkout log
 *
 * @param {string} equipmentId - The QR code / ID of the equipment
 * @param {string} userId - The ID of the user returning the item
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function returnEquipment(equipmentId, userId) {
  try {
    // Verify the item is checked out and get its UUID
    const { data: equipment, error: fetchError } = await supabase
      .from("equipment")
      .select("id, status")
      .eq("qr_code", equipmentId)
      .single();

    if (fetchError || !equipment) {
      return {
        success: false,
        error: "Equipment not found.",
      };
    }

    if (equipment.status !== "checked_out") {
      return {
        success: false,
        error: "This item is not currently checked out.",
      };
    }

    // Update equipment status to 'available'
    const { error: updateError } = await supabase
      .from("equipment")
      .update({ status: "available" })
      .eq("qr_code", equipmentId);

    if (updateError) {
      console.error("Error updating equipment status:", updateError);
      return {
        success: false,
        error: "Failed to update equipment status.",
      };
    }

    // Update the checkout log with return date using equipment UUID
    const { error: logError } = await supabase
      .from("checkout_log")
      .update({ return_date: new Date().toISOString() })
      .eq("equipment_id", equipment.id)
      .eq("user_id", userId)
      .is("return_date", null);

    if (logError) {
      console.error("Error updating checkout log:", logError);
      // Continue anyway - the important part (status update) succeeded
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error during return:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Get active checkout for an equipment item
 * Returns the current checkout record if the item is checked out
 *
 * @param {string} equipmentId - The QR code / ID of the equipment
 * @returns {Promise<Object|null>} Active checkout record or null
 */
export async function getActiveCheckout(equipmentId) {
  try {
    // First get the equipment UUID from the qr_code
    const { data: equipment, error: equipError } = await supabase
      .from("equipment")
      .select("id, status")
      .eq("qr_code", equipmentId)
      .single();

    if (equipError || !equipment) {
      console.error("Error fetching equipment:", equipError);
      return null;
    }

    // If not checked out, return null
    if (equipment.status !== "checked_out") {
      return null;
    }

    // Get the active checkout record
    const { data, error } = await supabase
      .from("checkout_log")
      .select(`
        *,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .eq("equipment_id", equipment.id)
      .is("return_date", null)
      .order("checkout_date", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("Error fetching active checkout:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Failed to fetch active checkout:", error);
    return null;
  }
}

/**
 * Check if a user can return an equipment item
 * Returns true if the user has an active checkout for this item
 *
 * @param {string} equipmentId - The QR code / ID of the equipment
 * @param {string} userId - The user ID to check
 * @returns {Promise<boolean>} True if user can return the item
 */
export async function canUserReturn(equipmentId, userId) {
  try {
    const activeCheckout = await getActiveCheckout(equipmentId);

    if (!activeCheckout) {
      return false;
    }

    return activeCheckout.user_id === userId;
  } catch (error) {
    console.error("Failed to check return permission:", error);
    return false;
  }
}

/**
 * Get checkout history for an equipment item
 *
 * @param {string} equipmentId - The QR code / ID of the equipment
 * @returns {Promise<Array>} Array of checkout log entries
 */
export async function getCheckoutHistory(equipmentId) {
  try {
    // First get the equipment UUID from the qr_code
    const { data: equipment, error: equipError } = await supabase
      .from("equipment")
      .select("id")
      .eq("qr_code", equipmentId)
      .single();

    if (equipError || !equipment) {
      console.error("Error fetching equipment:", equipError);
      return [];
    }

    // Now fetch checkout history using the UUID
    const { data, error } = await supabase
      .from("checkout_log")
      .select(`
        *,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .eq("equipment_id", equipment.id)
      .order("checkout_date", { ascending: false });

    if (error) {
      console.error("Error fetching checkout history:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Failed to fetch checkout history:", error);
    return [];
  }
}

/**
 * Get active checkout for current user
 *
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} Array of currently checked out items
 */
export async function getUserActiveCheckouts(userId) {
  try {
    const { data, error } = await supabase
      .from("checkout_log")
      .select(`
        *,
        equipment:equipment_id (
          qr_code,
          name,
          category,
          location_path,
          thumbnail_url
        )
      `)
      .eq("user_id", userId)
      .is("return_date", null)
      .order("checkout_date", { ascending: false });

    if (error) {
      console.error("Error fetching user checkouts:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Failed to fetch user checkouts:", error);
    return [];
  }
}
