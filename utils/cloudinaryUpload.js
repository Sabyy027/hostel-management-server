import cloudinary from '../config/cloudinary.js';
import { Readable } from 'stream';

/**
 * Upload image buffer to Cloudinary
 * @param {Buffer} fileBuffer - The image file buffer from multer
 * @param {String} folder - Cloudinary folder name (e.g., 'profiles', 'announcements')
 * @param {String} publicId - Optional custom public ID for the image
 * @returns {Promise<Object>} - Cloudinary upload result with secure_url
 */
export const uploadToCloudinary = (fileBuffer, folder, publicId = null) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: `hostel-management/${folder}`,
      resource_type: 'image',
      transformation: [
        { width: 800, height: 800, crop: 'limit' }, // Limit max dimensions
        { quality: 'auto' }, // Auto quality optimization
        { fetch_format: 'auto' } // Auto format selection (webp when supported)
      ]
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    // Create a readable stream from the buffer
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    // Create a readable stream from buffer and pipe it to cloudinary
    const readableStream = Readable.from(fileBuffer);
    readableStream.pipe(uploadStream);
  });
};

/**
 * Delete image from Cloudinary
 * @param {String} publicId - The public ID of the image to delete
 * @returns {Promise<Object>} - Cloudinary deletion result
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

/**
 * Extract public ID from Cloudinary URL
 * @param {String} url - Cloudinary image URL
 * @returns {String} - Public ID
 */
export const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  // Extract public_id from cloudinary URL
  // Example: https://res.cloudinary.com/demo/image/upload/v1234567890/hostel-management/profiles/abc123.jpg
  const matches = url.match(/\/hostel-management\/([^/]+)\/([^\.]+)/);
  if (matches && matches.length >= 3) {
    return `hostel-management/${matches[1]}/${matches[2]}`;
  }
  return null;
};
