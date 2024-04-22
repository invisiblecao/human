import cv2
import numpy as np
import requests
import base64
from tkinter import *
from PIL import Image, ImageTk

# Initialize the camera capture

cap = cv2.VideoCapture(0)

# Function to convert and send frame to Node.js server
def send_frame(frame):
    _, buffer = cv2.imencode('.jpg', frame)
    jpg_as_text = base64.b64encode(buffer).decode('utf-8')
    response = requests.post('http://localhost:3000/frame', json={'image': jpg_as_text})
    if response.status_code == 200:
        return response.json()
    return {}

# Emotion to BGR color mapping
emotion_colors = {
    'happy': (0, 255, 255),      # Yellow
    'sad': (255, 0, 0),          # Blue
    'angry': (0, 0, 255),        # Red
    'surprise': (255, 255, 0),   # Cyan
    'neutral': (128, 128, 128),  # Gray
    'disgust': (34, 139, 34),    # Green
    'fear': (255, 0, 255),       # Magenta
    # Add more mappings if there are other emotions
}

# Darken the color based on the emotion score
def darken_color(color, score):
    return tuple(max(0, int(c * (1 - score))) for c in color)

# Helper function to add a background to text for better readability
def draw_labels_with_background(frame, text, origin, font, scale, text_color, thickness, background_color):
    (text_width, text_height), _ = cv2.getTextSize(text, font, scale, thickness)
    rectangle_bgr = (background_color[0], background_color[1], background_color[2])
    box_coords = ((origin[0], origin[1] + 10), (origin[0] + text_width, origin[1] - text_height - 5))
    cv2.rectangle(frame, box_coords[0], box_coords[1], rectangle_bgr, cv2.FILLED)
    cv2.putText(frame, text, (origin[0], origin[1]), font, scale, text_color, thickness, lineType=cv2.LINE_AA)

# Draw detection results on the frame
def draw_results(frame, results):
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = 0.5
    thickness = 2  # Increased thickness for bolder text
    text_color = (255, 255, 255)  # White text
    background_color = (50, 50, 50)  # Dark background for text for better readability

    for face in results.get('face', []):
        # Draw rectangle around the face
        box = face['box']
        highest_emotion = max(face['emotion'], key=lambda e: e['score'])
        box_color = emotion_colors.get(highest_emotion['emotion'], (128, 128, 128))
        cv2.rectangle(frame, (box[0], box[1]), (box[0] + box[2], box[1] + box[3]), box_color, 2)
        
        startY = box[1] - 10  # Start the Y position for drawing text
        gap = 20  # Gap between text lines

        # Display predicted age and gender with percentages
        age = face.get('age', 'N/A')
        gender = face.get('gender', 'N/A')
        genderScore = face.get('genderScore', 0)

        age_text = f"Age: {age if isinstance(age, (int, float)) else 'N/A'}"
        gender_text = f"Gender: {gender} ({genderScore:.2f})"
        combined_text = f"{age_text}, {gender_text}"
        text_origin = (box[0], startY)
        draw_labels_with_background(frame, combined_text, text_origin, font, scale, text_color, thickness, background_color)
        startY -= gap

        # Display all emotions with their percentages
        if face.get('emotion'):
            for em in face['emotion']:
                emotion_text = f"{em['emotion']}: {em['score']*100:.1f}%"
                text_origin = (box[0], startY)
                draw_labels_with_background(frame, emotion_text, text_origin, font, scale, text_color, thickness, background_color)
                startY -= gap


# Get the next frame from the camera and send it to the server
def get_frame():
    ret, frame = cap.read()
    if ret:
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        analysis = send_frame(frame)
        draw_results(frame, analysis)
    return frame if ret else None

# Update the image in the GUI
def update():
    frame = get_frame()
    if frame is not None:
        # Convert the image to a format that tkinter can use
        im = Image.fromarray(frame)
        img = ImageTk.PhotoImage(image=im)
        lbl.config(image=img)
        lbl.image = img  # Keep a reference, prevent garbage collection
    window.after(10, update)  # Refresh the image in the GUI every 10 ms

# Create a GUI window
window = Tk()
window.title("Live Camera Feed")

# Label to display the camera feed
lbl = Label(window)
lbl.pack()

# Start the update function
update()

# Start the GUI main loop
window.mainloop()
