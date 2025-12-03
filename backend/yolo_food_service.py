import io
import base64
import os
import time
from typing import Dict, List, Optional, Tuple
from PIL import Image, ImageDraw, ImageFont
import numpy as np

class YOLOFoodDetector:
    """High-quality YOLO-based food detection service with comprehensive error handling."""
    
    DEFAULT_MODEL_PATH = os.getenv('YOLO_MODEL_PATH', 'best.pt')
    DEFAULT_FONT_PATHS = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  
        "C:\\Windows\\Fonts\\arial.ttf" 
    ]
    MAX_IMAGE_SIZE = 10 * 1024 * 1024  
    
    def __init__(self, model_path: Optional[str] = None):
        """Initialize YOLO detector with specified or default model.
        
        Args:
            model_path: Path to YOLO model weights file. If None, uses DEFAULT_MODEL_PATH.
            
        Raises:
            FileNotFoundError: If model file doesn't exist
            RuntimeError: If model fails to load
        """
        self.model_path = model_path or self.DEFAULT_MODEL_PATH
        self.is_ready = False
        self.model = None
        self._font = None
        
        print(f"[yolo] Initializing YOLOv8 detector with model: {self.model_path}")
        
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model file not found: {self.model_path}")
        
        try:
            from ultralytics import YOLO
            
            start_time = time.time()
            self.model = YOLO(self.model_path)
            load_time = time.time() - start_time
            
            self.is_ready = True
            print(f"[yolo] ✅ Model loaded successfully in {load_time:.2f}s")
            print(f"[yolo] Model classes: {len(self.model.names)} categories")
            
        except Exception as e:
            print(f"[yolo] ❌ Failed to load model: {e}")
            raise RuntimeError(f"Model initialization failed: {e}") from e

    def detect_and_draw_boxes(
        self, 
        image_data: str, 
        topk: int = 25, 
        score_thresh: float = 0.35,
        low_thresh: float = 0.20
    ) -> Dict[str, any]:
        """Detect food items and draw bounding boxes on image.
        
        Args:
            image_data: Base64-encoded image string
            topk: Maximum number of unique detections to return
            score_thresh: High confidence threshold (auto-selected items)
            low_thresh: Low confidence threshold (user-selectable suggestions)
            
        Returns:
            Dict containing 'detections' (high conf), 'suggestions' (low conf), and 'image_with_boxes'
            
        Raises:
            ValueError: If input validation fails
            RuntimeError: If detection fails
        """
        if not self.is_ready or not self.model:
            raise RuntimeError("Model not initialized")
        
        if not image_data or not isinstance(image_data, str):
            raise ValueError("Invalid image data: must be non-empty string")
        
        if not 0.0 <= score_thresh <= 1.0:
            raise ValueError(f"Invalid threshold: {score_thresh} (must be 0.0-1.0)")
        
        if not 0.0 <= low_thresh <= 1.0:
            raise ValueError(f"Invalid low threshold: {low_thresh} (must be 0.0-1.0)")
        
        if topk < 1 or topk > 100:
            raise ValueError(f"Invalid topk: {topk} (must be 1-100)")
        
        try:
            if ',' in image_data:
                image_data = image_data.split(',', 1)[1]
            
            image_bytes = base64.b64decode(image_data)
            
            if len(image_bytes) > self.MAX_IMAGE_SIZE:
                raise ValueError(f"Image too large: {len(image_bytes)} bytes (max {self.MAX_IMAGE_SIZE})")
            
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            
            start_time = time.time()
            results = self.model(image, conf=low_thresh, verbose=False)
            inference_time = time.time() - start_time
            
            detections = []
            all_detections = []
            
            for result in results:
                boxes = result.boxes
                for i, box in enumerate(boxes):
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    class_name = result.names[cls]
                    
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    
                    detection = {
                        'label': class_name,
                        'confidence': conf,
                        'bbox': [x1, y1, x2, y2]
                    }
                    all_detections.append(detection)
            
            all_detections.sort(key=lambda x: x['confidence'], reverse=True)
            
            print(f"[yolo] Inference completed in {inference_time:.3f}s")
            print(f"[yolo] Found {len(all_detections)} detections (low threshold: {low_thresh})")
            
            if len(all_detections) > 0:
                print(f"[yolo] Top 10 detections:")
                for i, det in enumerate(all_detections[:10]):
                    print(f"  {i+1}. {det['label']}: {det['confidence']:.3f}")
            else:
                print(f"[yolo] ⚠️ No detections found (threshold: {low_thresh})")
            
            seen = set()
            high_confidence = []
            low_confidence = []
            
            for det in all_detections:
                label_lower = det['label'].lower()
                if label_lower not in seen:
                    seen.add(label_lower)
                    if det['confidence'] >= score_thresh:
                        high_confidence.append(det)
                    else:
                        low_confidence.append(det)
                    
                    if len(high_confidence) + len(low_confidence) >= topk:
                        break
            
            print(f"[yolo] High confidence (≥{score_thresh}): {len(high_confidence)} items")
            if high_confidence:
                items_str = ', '.join([f"{d['label']}({d['confidence']:.2f})" for d in high_confidence[:5]])
                print(f"[yolo]   High conf items: {items_str}")
            
            print(f"[yolo] Low confidence ({low_thresh}-{score_thresh}): {len(low_confidence)} items")
            if low_confidence:
                items_str = ', '.join([f"{d['label']}({d['confidence']:.2f})" for d in low_confidence[:5]])
                print(f"[yolo]   Low conf items: {items_str}")
            
            all_to_draw = high_confidence + low_confidence
            print(f"[yolo] Drawing {len(all_to_draw)} total boxes on image")
            print(f"[yolo] Items to draw: {[(d['label'], d['confidence']) for d in all_to_draw]}")
            image_with_boxes = self._draw_boxes(image, all_to_draw, score_thresh)
            image_data_url = self._image_to_data_url(image_with_boxes)
            
            high_conf_list = [
                {
                    'label': det['label'],
                    'confidence': det['confidence'],
                    'bbox': det['bbox']
                }
                for det in high_confidence
            ]
            
            low_conf_list = [
                {
                    'label': det['label'],
                    'confidence': det['confidence'],
                    'bbox': det['bbox']
                }
                for det in low_confidence
            ]
            
            return {
                'detections': high_conf_list,
                'suggestions': low_conf_list,
                'image_with_boxes': image_data_url
            }
            
        except ValueError:
            raise
        except Exception as e:
            print(f"[yolo] Detection error: {e}")
            import traceback
            traceback.print_exc()
            raise RuntimeError(f"Detection failed: {e}") from e

    def _draw_boxes(self, image: Image.Image, detections: List[Dict], high_thresh: float = 0.35) -> Image.Image:
        """Draw bounding boxes and labels on image with different colors for confidence levels.
        
        Args:
            image: PIL Image object
            detections: List of detection dictionaries
            high_thresh: Threshold to determine high vs low confidence colors
            
        Returns:
            Image with drawn boxes
        """
        draw = ImageDraw.Draw(image)
        font = self._get_font()
        
        green_count = 0
        yellow_count = 0
        
        for det in detections:
            bbox = det['bbox']
            label = det['label']
            conf = det['confidence']
            
            if conf >= high_thresh:
                box_color = '#10B981' 
                bg_color = '#10B981'
                green_count += 1
            else:
                box_color = '#F59E0B' 
                bg_color = '#F59E0B'
                yellow_count += 1
            
            draw.rectangle(bbox, outline=box_color, width=4)
            
            label_text = f"{label} ({conf:.2f})"
            
            try:
                left, top, right, bottom = draw.textbbox((bbox[0], bbox[1]), label_text, font=font)
                text_width = right - left
                text_height = bottom - top
            except AttributeError:
                text_width, text_height = draw.textsize(label_text, font=font)
            
            draw.rectangle(
                [bbox[0], bbox[1] - text_height - 4, bbox[0] + text_width + 4, bbox[1]],
                fill=bg_color
            )
            
            draw.text((bbox[0] + 2, bbox[1] - text_height - 2), label_text, fill='white', font=font)
        
        print(f"[yolo] _draw_boxes: Drew {green_count} green boxes and {yellow_count} yellow boxes")
        return image
    
    def _get_font(self, size: int = 20) -> ImageFont.ImageFont:
        """Get font for drawing labels, with fallback options."""
        if self._font is not None:
            return self._font
        
        for font_path in self.DEFAULT_FONT_PATHS:
            try:
                self._font = ImageFont.truetype(font_path, size)
                return self._font
            except (OSError, IOError):
                continue
        
        self._font = ImageFont.load_default()
        return self._font

    def _image_to_data_url(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 data URL."""
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG", quality=90)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/jpeg;base64,{img_str}"


try:
    yolo_vision_service = YOLOFoodDetector()
except Exception as e:
    print(f"[yolo] Failed to initialize: {e}")
    yolo_vision_service = None
