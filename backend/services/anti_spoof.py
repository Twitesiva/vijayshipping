# -*- coding: utf-8 -*-
"""
Anti-spoofing service using MiniFASNet
"""
from __future__ import annotations

import os
import cv2
import numpy as np
import torch
import warnings

from src.anti_spoof_predict import AntiSpoofPredict
from src.generate_patches import CropImage
from src.utility import parse_model_name

warnings.filterwarnings('ignore')

# Get the directory where this file is located
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
MODEL_DIR = os.path.join(BACKEND_DIR, "resources", "anti_spoof_models")

class AntiSpoofService:
    def __init__(self):
        """Initialize anti-spoofing service"""
        self.device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
        self.model_dir = MODEL_DIR
        self.predictor = AntiSpoofPredict(self.device)
        self.image_cropper = CropImage()
        # Pre-cache model file list
        try:
            self.model_files = [f for f in os.listdir(self.model_dir) if f.endswith('.pth')]
        except:
            self.model_files = []
        
    def check_image_ratio(self, image: np.ndarray) -> bool:
        """Check if image has appropriate aspect ratio (3:4)"""
        height, width, channel = image.shape
        if width / height != 3 / 4:
            return False
        return True
    
    def crop_image_with_ratio(self, img: np.ndarray, height: int, width: int, middle: int) -> np.ndarray:
        """Crop image to maintain aspect ratio"""
        h, w = img.shape[:2]
        h = h - h % 4
        new_w = int(h / height) * width
        startx = middle - new_w // 2
        endx = middle + new_w // 2
        
        if startx <= 0:
            cropped_img = img[0:h, 0:new_w]
        elif endx >= w:
            cropped_img = img[0:h, w-new_w:w]
        else:
            cropped_img = img[0:h, startx:endx]
        
        return cropped_img
    
    def test_liveness(self, image: np.ndarray) -> tuple[bool, float, str]:
        """
        Test if the image is a real face or a spoof attempt.
        
        Args:
            image: numpy array of the image (BGR format from OpenCV)
            
        Returns:
            tuple: (is_real, confidence, message)
        """
        try:
            # Resize image to portrait 3:4 if needed (MiniFASNet requirement)
            h, w = image.shape[:2]
            if abs(w/h - 3/4) > 0.01:
                image = cv2.resize(image, (int(h * 3 / 4), h))
            
            # Get bounding box
            image_bbox = self.predictor.get_bbox(image)
            prediction = np.zeros((1, 3))
            
            # Test with all models
            if not self.model_files:
                return False, 0.0, "No anti-spoofing models found"

            model_results = []
            for model_name in self.model_files:
                h_input, w_input, _, scale = parse_model_name(model_name)
                param = {
                    "org_img": image,
                    "bbox": image_bbox,
                    "scale": scale,
                    "out_w": w_input,
                    "out_h": h_input,
                    "crop": True,
                }
                if scale is None:
                    param["crop"] = False
                
                img = self.image_cropper.crop(**param)
                res = self.predictor.predict(img, os.path.join(self.model_dir, model_name))
                model_results.append(res)
                prediction += res
            
            # Average the predictions for the general label
            avg_prediction = prediction / len(self.model_files)
            
            # Label 0, 1 are real, 2 is fake
            # STRICTER CHECK: If ANY model has a high fake score, it's a spoof.
            fake_scores = [float(res[0][2]) for res in model_results]
            max_fake_score = max(fake_scores)
            
            avg_label = np.argmax(avg_prediction)
            avg_fake_score = float(avg_prediction[0][2])
            
            # Use a more balanced threshold:
            # Reject if: 
            # 1. The dominant prediction is 'Fake' (avg_label > 1)
            # 2. OR individual models/average scores are high (indicating spoof)
            # Lowering thresholds slightly for "proper" security as requested
            print(f"DEBUG: Anti-spoof scores - Max: {max_fake_score:.3f}, Avg: {avg_fake_score:.3f}, Label: {avg_label}")
            
            if avg_label > 1 or avg_fake_score > 0.5 or max_fake_score > 0.65:
                # Use the highest relevant index score as confidence
                rejection_score = max(max_fake_score, avg_fake_score)
                return False, float(rejection_score), f"Spoofing detected ({max_fake_score:.2f})"
            
            return True, float(avg_prediction[0][avg_label]), "Real face detected"
                
        except Exception as e:
            return False, 0.0, f"Anti-spoofing check failed: {str(e)}"

# Global instance
anti_spoof_service = AntiSpoofService()
