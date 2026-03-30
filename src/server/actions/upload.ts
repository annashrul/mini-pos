"use server";

import { uploadImage, deleteImage } from "@/lib/cloudinary";

export async function uploadProductImage(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: "File tidak ditemukan" };
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (!allowedTypes.includes(file.type)) {
    return { error: "Format file tidak didukung. Gunakan JPG, PNG, atau WebP" };
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { error: "Ukuran file maksimal 5MB" };
  }

  try {
    const result = await uploadImage(file, "pos/products");
    return { url: result.url, publicId: result.publicId };
  } catch {
    return { error: "Gagal mengupload gambar" };
  }
}

export async function deleteProductImage(publicId: string) {
  try {
    await deleteImage(publicId);
    return { success: true };
  } catch {
    return { error: "Gagal menghapus gambar" };
  }
}
