
import sys
from pathlib import Path
from model import predict_image

if len(sys.argv) != 2:
    print('Usage: python test_model.py "image_path"')
    sys.exit(1)

image_path = Path(sys.argv[1])

if not image_path.exists():
    print("Image not found:", image_path)
    sys.exit(1)

try:
    with image_path.open("rb") as image:
        result = predict_image(image)

    print("\n========== DEEPTRACE RESULT ==========")
    print("Prediction:", result["label"])
    print("Confidence:", f'{result["confidence"] * 100:.2f}%')
    print("Fake probability:",
          f'{result["fake_probability"] * 100:.2f}%')
    print("Real probability:",
          f'{result["real_probability"] * 100:.2f}%')
    print("======================================")

except Exception:
    import traceback
    traceback.print_exc()

