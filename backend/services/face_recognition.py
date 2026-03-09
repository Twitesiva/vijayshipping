# -*- coding: utf-8 -*-
"""
Face recognition service using FaceNet (InceptionResnetV1) and MTCNN
"""
from __future__ import annotations

import torch 
import numpy as np
import cv2
import json
from facenet_pytorch import MTCNN, InceptionResnetV1
from typing import Optional, Tuple, List

class FaceRecognitionService:
    def __init__(self):
        """Initialize face recognition service"""
        self.device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
        
        # Initialize MTCNN for face detection
        self.mtcnn = MTCNN(
            image_size=160,
            margin=0,
            min_face_size=20,
            thresholds=[0.6, 0.7, 0.7],
            factor=0.709,
            post_process=True,
            device=self.device,
            keep_all=True
        )
        
        # Initialize InceptionResnetV1 for face recognition
        self.resnet = InceptionResnetV1(pretrained='vggface2').eval().to(self.device)
    
    def detect_faces(self, image: np.ndarray) -> Tuple[Optional[torch.Tensor], Optional[np.ndarray], Optional[List]]:
        """
        Detect faces in the image.
        
        Args:
            image: numpy array of the image (BGR format from OpenCV)
            
        Returns:
            tuple: (face_locations, boxes, probabilities)
        """
        try:
            # MTCNN expects RGB
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Detect faces
            face_locations, prob = self.mtcnn(image_rgb, return_prob=True)
            boxes, _ = self.mtcnn.detect(image_rgb)
            
            return face_locations, boxes, prob
        except Exception as e:
            print(f"Face detection error: {str(e)}")
            return None, None, None
    
    def generate_face_encoding(self, image: np.ndarray) -> Optional[np.ndarray]:
        """
        Generate face encoding from image.
        
        Args:
            image: numpy array of the image (BGR format from OpenCV)
            
        Returns:
            numpy array of face encoding (512 dimensions) or None if no face detected
        """
        try:
            face_locations, boxes, prob = self.detect_faces(image)
            
            if face_locations is None or len(face_locations) == 0:
                return None
            
            # Use the first detected face
            torch_loc = torch.stack([face_locations[0]]).to(self.device)
            encoding = self.resnet(torch_loc).detach().cpu().numpy()[0]
            
            return encoding
        except Exception as e:
            print(f"Face encoding error: {str(e)}")
            return None
    
    def encoding_to_json(self, encoding: np.ndarray) -> str:
        """Convert numpy encoding to JSON string"""
        return json.dumps(encoding.tolist())
    
    def json_to_encoding(self, json_str: str) -> np.ndarray:
        """Convert JSON string to numpy encoding"""
        return np.array(json.loads(json_str))
   
    def compare_faces(
        self,
        known_encoding: np.ndarray,
        face_encoding: np.ndarray,
        threshold: float = 0.5
    ) -> Tuple[bool, float]:
        """
        Compare two face encodings.
        
        Args:
            known_encoding: stored face encoding
            face_encoding: new face encoding to compare
            threshold: similarity threshold (lower is more similar)
            
        Returns:
            tuple: (is_match, similarity_score)
        """
        try:
            # Calculate Euclidean distance
            similarity = np.linalg.norm(known_encoding - face_encoding)
            is_match = similarity < threshold
            
            return is_match, float(similarity)
        except Exception as e:
            print(f"Face comparison error: {str(e)}")
            return False, float('inf')
    
    def find_matching_user(
        self,
        face_encoding: np.ndarray,
        user_encodings: List[Tuple[int, str, np.ndarray]],
        threshold: float = 0.5
    ) -> Optional[Tuple[int, str, float]]:
        """
        Find matching user from a list of known encodings.
        
        Args:
            face_encoding: face encoding to match
            user_encodings: list of (user_id, user_name, encoding) tuples
            threshold: similarity threshold
            
        Returns:
            tuple: (user_id, user_name, similarity) or None if no match
        """
        best_match = None
        best_similarity = float('inf')
        
        for user_id, user_name, known_encoding, *rest in user_encodings:
            is_match, similarity = self.compare_faces(known_encoding, face_encoding, threshold)
            
            if is_match and similarity < best_similarity:
                best_similarity = similarity
                best_match = (user_id, user_name, similarity)
        
        return best_match
    
    def draw_face_boxes(
        self,
        image: np.ndarray,
        boxes: np.ndarray,
        labels: List[str] = None
    ) -> np.ndarray:
        """
        Draw bounding boxes on faces.
        
        Args:
            image: numpy array of the image
            boxes: array of bounding boxes
            labels: optional list of labels for each box
            
        Returns:
            image with drawn boxes
        """
        image_copy = image.copy()
        COLOR_DARK = (0, 0, 153)
        COLOR_WHITE = (255, 255, 255)
        
        if boxes is not None:
            boxes_int = boxes.astype(int)
            
            for idx, (left, top, right, bottom) in enumerate(boxes_int):
                # Draw rectangle
                cv2.rectangle(image_copy, (left, top), (right, bottom), COLOR_DARK, 2)
                cv2.rectangle(image_copy, (left, bottom + 35), (right, bottom), COLOR_DARK, cv2.FILLED)
                
                # Draw label
                label = labels[idx] if labels and idx < len(labels) else f"#{idx}"
                font = cv2.FONT_HERSHEY_DUPLEX
                cv2.putText(image_copy, label, (left + 5, bottom + 25), font, 0.55, COLOR_WHITE, 1)
        
        return image_copy

# Global instance
face_recognition_service = FaceRecognitionService()
