from flask import Flask, jsonify, request
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

app = Flask(__name__)

# Example model loaded on startup for demonstration
X = np.array([[1], [2], [3], [4], [5]])
y = np.array([100, 120, 140, 155, 170])
model = LinearRegression().fit(X, y)

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json or {}
    amount = data.get('amount')
    if amount is None:
        return jsonify({'error': 'Missing amount'}), 400
    prediction = model.predict(np.array([[amount]]))
    return jsonify({'prediction': float(prediction[0])})

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
