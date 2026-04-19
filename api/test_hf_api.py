import os
import requests
from dotenv import load_dotenv

# Load .env
load_dotenv('.env')

token = os.environ.get("HF_API_TOKEN", "").strip()
print(f"Token: {token[:4]}...{token[-4:] if len(token) > 8 else ''}")

models = [
    "gpt2",
    "mistralai/Mistral-7B-Instruct-v0.1",
    "mistralai/Mixtral-8x7B-Instruct-v0.1"
]

payload = {"inputs": "Test"}
headers = {"Authorization": f"Bearer {token}"}

for model in models:
    url = f"https://api-inference.huggingface.co/models/{model}"
    print(f"\n--- Model: {model} ---")
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Headers: {response.headers}")
        print(f"Body: {response.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")
