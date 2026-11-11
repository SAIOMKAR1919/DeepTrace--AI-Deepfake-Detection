
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from pathlib import Path

# ------------------------------------------------
# CONFIGURATION
# ------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = (
    BASE_DIR
    / "Model"
    / "ai_image_detector_resnet50.pth"
)

CLASS_TO_IDX = {
    "fake": 0,
    "real": 1
}

DEVICE = torch.device("cpu")

# ------------------------------------------------
# IMAGE PREPROCESSING
# Must match your original training/inference code
# ------------------------------------------------

IMAGE_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# ------------------------------------------------
# LOAD RESNET50
# ------------------------------------------------

def load_resnet_model():

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Checkpoint not found: {MODEL_PATH}"
        )

    print("Loading DeepTrace ResNet50...")

    checkpoint = torch.load(
        MODEL_PATH,
        map_location=DEVICE,
        weights_only=False
    )

    model = models.resnet50(weights=None)
    model.fc = nn.Linear(model.fc.in_features, 2)

    model.load_state_dict(
        checkpoint["model_state_dict"]
    )

    model.to(DEVICE)
    model.eval()

    print("ResNet50 loaded successfully!")

    return model


# ------------------------------------------------
# IMAGE PREDICTION
# ------------------------------------------------

model = None


def get_model():
    global model

    if model is None:
        model = load_resnet_model()

    return model


def predict_image(uploaded_file):

    image = Image.open(uploaded_file).convert("RGB")

    image_tensor = IMAGE_TRANSFORM(image)
    image_tensor = image_tensor.unsqueeze(0).to(DEVICE)

    active_model = get_model()

    with torch.no_grad():
        output = active_model(image_tensor)
        probabilities = torch.softmax(output, dim=1)

    fake_probability = float(probabilities[0][0])
    real_probability = float(probabilities[0][1])

    if fake_probability >= real_probability:
        label = "LIKELY MANIPULATED"
        confidence = fake_probability
    else:
        label = "LIKELY AUTHENTIC"
        confidence = real_probability

    return {
        "label": label,
        "confidence": confidence,
        "fake_probability": fake_probability,
        "real_probability": real_probability
    }
