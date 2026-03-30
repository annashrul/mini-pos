import { v2 as cloudinary } from "cloudinary";

// Auto-configured from CLOUDINARY_URL env var
cloudinary.config();

export async function uploadImage(
  file: File,
  folder = "pos/products"
): Promise<{ url: string; publicId: string }> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "image",
          transformation: [
            { width: 800, height: 800, crop: "limit", quality: "auto", format: "webp" },
          ],
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error("Upload failed"));
          } else {
            resolve({ url: result.secure_url, publicId: result.public_id });
          }
        }
      )
      .end(buffer);
  });
}

export async function deleteImage(publicId: string) {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    // Ignore delete errors
  }
}

export function getImageUrl(publicId: string, width = 400, height = 400) {
  return cloudinary.url(publicId, {
    width,
    height,
    crop: "fill",
    quality: "auto",
    format: "webp",
  });
}
