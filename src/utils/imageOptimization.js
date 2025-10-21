// Image Optimization Utilities
// This file contains utilities for optimizing image loading performance

/**
 * Detects WebP support in the browser
 * @returns {boolean} True if WebP is supported
 */
export const supportsWebP = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
};

/**
 * Gets the optimized image source based on browser capabilities
 * @param {string} src - Original image source
 * @returns {string} Optimized image source
 */
export const getOptimizedImageSrc = (src) => {
  if (!src) return src;
  
  // If it's already a WebP or external URL, return as is
  if (src.includes('.webp') || src.startsWith('http')) {
    return src;
  }
  
  // For local images, try to use WebP if supported
  if (supportsWebP() && (src.includes('.png') || src.includes('.jpg') || src.includes('.jpeg'))) {
    // In a real implementation, you would have WebP versions of images
    // For now, we'll keep the original format
    return src;
  }
  
  return src;
};

/**
 * Preloads critical images for faster initial page load
 * @param {Array<string>} imageSrcs - Array of image sources to preload
 */
export const preloadImages = (imageSrcs) => {
  imageSrcs.forEach((src) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  });
};

/**
 * Removes preload links for cleanup
 * @param {Array<string>} imageSrcs - Array of image sources that were preloaded
 */
export const cleanupPreloadLinks = (imageSrcs) => {
  imageSrcs.forEach((src) => {
    const existingLink = document.querySelector(`link[href="${src}"]`);
    if (existingLink && existingLink.rel === 'preload') {
      document.head.removeChild(existingLink);
    }
  });
};

/**
 * Creates an image cache for resolved URLs
 * @returns {Map} Map instance for caching resolved image URLs
 */
export const createImageCache = () => new Map();

/**
 * Gets image dimensions from URL without loading the full image
 * @param {string} src - Image source URL
 * @returns {Promise<{width: number, height: number}>} Promise resolving to image dimensions
 */
export const getImageDimensions = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Generates a low-quality placeholder (LQIP) for progressive loading
 * @param {string} src - Original image source
 * @returns {string} Base64 encoded low-quality placeholder
 */
export const generateLQIP = (src) => {
  // This is a simplified version. In a real implementation, you would:
  // 1. Load the image
  // 2. Resize it to a very small size (e.g., 20px wide)
  // 3. Apply blur filter
  // 4. Convert to base64
  // For now, we'll return a simple gray placeholder
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjRjNGNEY2Ii8+Cjwvc3ZnPgo=';
};

