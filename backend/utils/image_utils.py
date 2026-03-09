from __future__ import annotations

import base64
import numpy as np
import cv2
from PIL import Image
import io
import os
from datetime import datetime

def base64_to_image(base64_string: str) -> np.ndarray:
    """Convert base64 string to numpy array (OpenCV format)"""
    try:
        # Remove data URL prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        # Decode base64
        image_bytes = base64.b64decode(base64_string)
        
        # Convert to PIL Image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to numpy array (RGB)
        image_array = np.array(image)
        
        # Convert RGB to BGR for OpenCV
        if len(image_array.shape) == 3 and image_array.shape[2] == 3:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        return image_array
    except Exception as e:
        raise ValueError(f"Failed to decode base64 image: {str(e)}")

def save_image(image_array: np.ndarray, directory: str, filename: str = None) -> str:
    """Save image to disk and return the path"""
    try:
        # Create directory if it doesn't exist
        os.makedirs(directory, exist_ok=True)
        
        # Generate filename if not provided
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            filename = f"attendance_{timestamp}.jpg"
        
        # Full path
        filepath = os.path.join(directory, filename)
        
        # Save image
        cv2.imwrite(filepath, image_array)
        
        return filepath
    except Exception as e:
        raise ValueError(f"Failed to save image: {str(e)}")

def image_to_base64(image_path: str) -> str:
    """Convert image file to base64 string"""
    try:
        with open(image_path, 'rb') as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            return f"data:image/jpeg;base64,{encoded_string}"
    except Exception as e:
        raise ValueError(f"Failed to encode image: {str(e)}")
