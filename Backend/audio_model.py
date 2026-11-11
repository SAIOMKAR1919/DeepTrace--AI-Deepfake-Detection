import torch
import torch.nn as nn
import numpy as np
import soundfile as sf
# from audio_model import predict_audio

from scipy.signal import resample_poly
from pathlib import Path
from transformers import Wav2Vec2Config, Wav2Vec2Model


# ------------------------------------------------
# CONFIGURATION
# ------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
AUDIO_MODEL_PATH = BASE_DIR / "Model" / "best_wav2vec2_deepfake_model.pth"

DEVICE = torch.device("cpu")

SAMPLE_RATE = 16000
TARGET_SAMPLES = 64000
PEAK_NORMALIZATION = 0.95

audio_model = None


# ------------------------------------------------
# AUDIO CLASSIFIER
# ------------------------------------------------

class AudioDeepfakeClassifier(nn.Module):

    def __init__(self):
        super().__init__()

        # Construct architecture without downloading weights
        config = Wav2Vec2Config()
        self.wav2vec2 = Wav2Vec2Model(config)

        self.classifier = nn.Sequential(
            nn.LayerNorm(768),
            nn.Linear(768, 256),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(256, 2)
        )

    def forward(self, input_values):

        outputs = self.wav2vec2(input_values)

        # Provisional temporal mean pooling
        features = outputs.last_hidden_state.mean(dim=1)

        return self.classifier(features)


# ------------------------------------------------
# LOAD EXISTING CHECKPOINT
# ------------------------------------------------

def load_audio_model():

    if not AUDIO_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Audio checkpoint not found: {AUDIO_MODEL_PATH}"
        )

    print("Loading existing DeepTrace audio checkpoint...")

    checkpoint = torch.load(
        AUDIO_MODEL_PATH,
        map_location=DEVICE,
        weights_only=True
    )

    model = AudioDeepfakeClassifier()

    state_dict = checkpoint["model_state_dict"]

    # Separate backbone and classifier weights
    backbone_weights = {
        key.replace("wav2vec2.", "", 1): value
        for key, value in state_dict.items()
        if key.startswith("wav2vec2.")
    }

    classifier_weights = {
        key.replace("classifier.", "", 1): value
        for key, value in state_dict.items()
        if key.startswith("classifier.")
    }

    model.wav2vec2.load_state_dict(
        backbone_weights,
        strict=True
    )

    model.classifier.load_state_dict(
        classifier_weights,
        strict=True
    )

    model.to(DEVICE)
    model.eval()

    print("Audio checkpoint loaded successfully!")

    return model


def get_audio_model():

    global audio_model

    if audio_model is None:
        audio_model = load_audio_model()

    return audio_model


# ------------------------------------------------
# AUDIO PREPROCESSING
# ------------------------------------------------

def preprocess_audio(uploaded_file):

    audio, sample_rate = sf.read(
        uploaded_file,
        dtype="float32"
    )

    # Convert stereo to mono
    if audio.ndim == 2:
        audio = np.mean(audio, axis=1)

    if audio.size == 0:
        raise ValueError("Uploaded audio is empty")

    # Resample to 16 kHz
    if sample_rate != SAMPLE_RATE:

        from math import gcd

        divisor = gcd(int(sample_rate), SAMPLE_RATE)

        audio = resample_poly(
            audio,
            SAMPLE_RATE // divisor,
            int(sample_rate) // divisor
        )

    # Peak normalization
    peak = np.max(np.abs(audio))

    if peak > 0:
        audio = audio * (PEAK_NORMALIZATION / peak)

    # Pad or truncate to 4 seconds
    if len(audio) < TARGET_SAMPLES:

        audio = np.pad(
            audio,
            (0, TARGET_SAMPLES - len(audio))
        )

    else:
        audio = audio[:TARGET_SAMPLES]

    return torch.tensor(
        audio,
        dtype=torch.float32
    ).unsqueeze(0)


# ------------------------------------------------
# AUDIO PREDICTION
# ------------------------------------------------

def predict_audio(uploaded_file):

    input_tensor = preprocess_audio(uploaded_file)

    active_model = get_audio_model()

    with torch.no_grad():

        output = active_model(input_tensor)

        probabilities = torch.softmax(output, dim=1)

    real_probability = float(probabilities[0][0])
    fake_probability = float(probabilities[0][1])

    if fake_probability >= real_probability:

        label = "LIKELY FAKE AUDIO"
        confidence = fake_probability

    else:

        label = "LIKELY REAL AUDIO"
        confidence = real_probability

    return {
        "label": label,
        "confidence": confidence,
        "fake_probability": fake_probability,
        "real_probability": real_probability
    }