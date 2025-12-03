
interface Detection {
  name: string;
  confidence: number;
  bbox?: number[];
}

/**
 * Draw bounding boxes on an image
 * @param imageDataUrl - Base64 image data URL
 * @param highConfidenceItems - Array of high confidence detections (green boxes)
 * @param lowConfidenceItems - Array of low confidence detections (yellow boxes)
 * @returns Promise<string> - New image data URL with boxes drawn
 */
export async function drawBoundingBoxes(
  imageDataUrl: string,
  highConfidenceItems: Detection[] = [],
  lowConfidenceItems: Detection[] = []
): Promise<string> {
  console.log('[Drawing] Starting to draw boxes')
  console.log('[Drawing] High confidence items:', highConfidenceItems.length, highConfidenceItems)
  console.log('[Drawing] Low confidence items:', lowConfidenceItems.length, lowConfidenceItems)
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      console.log('[Drawing] Image loaded, dimensions:', img.width, 'x', img.height)
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('[Drawing] Could not get canvas context')
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      console.log('[Drawing] Original image drawn on canvas')
      
      console.log('[Drawing] Drawing', highConfidenceItems.length, 'green boxes')
      highConfidenceItems.forEach((item, idx) => {
        console.log(`[Drawing] Green box ${idx}:`, item.name, item.bbox)
        if (item.bbox && item.bbox.length === 4) {
          const [x1, y1, x2, y2] = item.bbox;
          const width = x2 - x1;
          const height = y2 - y1;
          
          console.log(`[Drawing] Drawing green box at (${x1}, ${y1}) size ${width}x${height}`)
          
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 3;
          ctx.strokeRect(x1, y1, width, height);
          
          const label = `${item.name} ${(item.confidence * 100).toFixed(0)}%`;
          ctx.font = 'bold 16px Arial';
          const textMetrics = ctx.measureText(label);
          const textHeight = 20;
          
          ctx.fillStyle = '#10B981';
          ctx.fillRect(x1, y1 - textHeight - 4, textMetrics.width + 8, textHeight + 4);
          
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(label, x1 + 4, y1 - 8);
        } else {
          console.warn(`[Drawing] Green box ${idx} missing or invalid bbox:`, item.bbox)
        }
      });
      
      console.log('[Drawing] Drawing', lowConfidenceItems.length, 'orange boxes')
      lowConfidenceItems.forEach((item, idx) => {
        console.log(`[Drawing] Orange box ${idx}:`, item.name, item.bbox)
        if (item.bbox && item.bbox.length === 4) {
          const [x1, y1, x2, y2] = item.bbox;
          const width = x2 - x1;
          const height = y2 - y1;
          
          console.log(`[Drawing] Drawing orange box at (${x1}, ${y1}) size ${width}x${height}`)
          
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 3;
          ctx.strokeRect(x1, y1, width, height);
          
          const label = `${item.name} ${(item.confidence * 100).toFixed(0)}%`;
          ctx.font = 'bold 16px Arial';
          const textMetrics = ctx.measureText(label);
          const textHeight = 20;
          
          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(x1, y1 - textHeight - 4, textMetrics.width + 8, textHeight + 4);
          
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(label, x1 + 4, y1 - 8);
        } else {
          console.warn(`[Drawing] Orange box ${idx} missing or invalid bbox:`, item.bbox)
        }
      });
      
      const newImageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      console.log('[Drawing] Canvas converted to data URL, length:', newImageDataUrl.length)
      resolve(newImageDataUrl);
    };
    
    img.onerror = (err) => {
      console.error('[Drawing] Failed to load image:', err)
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageDataUrl;
    console.log('[Drawing] Image src set, waiting for load...')
  });
}
