
import torch

path = "Model/best_wav2vec2_deepfake_model.pth"

checkpoint = torch.load(
    path,
    map_location="cpu",
    weights_only=True
)

state = checkpoint["model_state_dict"]

print("\n========== ALL MODEL LAYERS ==========")

for name, tensor in state.items():
    print(f"{name:85} {tuple(tensor.shape)}")

print("\n========== MODEL METADATA ==========")

print("Architecture:", checkpoint["model_architecture"])
print("Backbone:", checkpoint["backbone"])
print("Hyperparameters:", checkpoint["hyperparameters"])


