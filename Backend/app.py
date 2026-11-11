
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from pathlib import Path
import os

from database import (
    initialize_database,
    get_connection
)

from auth import register_user, login_user
from model import predict_image
from audio_model import predict_audio

app = Flask(__name__)

app.secret_key = os.environ.get(
    "DEEPTRACE_SECRET_KEY",
    "change-this-development-secret"
)

CORS(
    app,
    origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    supports_credentials=True
)

initialize_database()


# ---------------------------------------
# HEALTH CHECK
# ---------------------------------------

@app.route("/api/health", methods=["GET"])
def health():

    return jsonify({
        "success": True,
        "message": "DeepTrace backend is running"
    })


# ---------------------------------------
# SIGNUP
# ---------------------------------------

@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({
            "success": False,
            "message": "All fields are required"
        }), 400

    if len(password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 8 characters"
        }), 400

    result = register_user(name, email, password)

    if not result["success"]:
        return jsonify(result), 409

    # Automatically log in after successful registration
    login_result = login_user(email, password)

    if not login_result["success"]:
        return jsonify(login_result), 500

    session.clear()
    session["user_id"] = login_result["user"]["id"]

    return jsonify(login_result), 201


# ---------------------------------------
# LOGIN
# ---------------------------------------

@app.route("/api/login", methods=["POST"])
def login():

    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip()
    password = data.get("password", "")

    result = login_user(email, password)

    if not result["success"]:
        return jsonify(result), 401

    session["user_id"] = result["user"]["id"]

    return jsonify(result)

# ---------------------------------------
# CHECK CURRENT LOGIN SESSION
# ---------------------------------------

@app.route("/api/me", methods=["GET"])
def current_user():

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Not logged in"
        }), 401

    connection = get_connection()

    user = connection.execute(
        "SELECT id, name, email FROM users WHERE id = ?",
        (user_id,)
    ).fetchone()

    connection.close()

    if not user:
        session.clear()
        return jsonify({
            "success": False,
            "message": "User not found"
        }), 401

    return jsonify({
        "success": True,
        "user": dict(user)
    })

# ---------------------------------------
# LOGOUT
# ---------------------------------------

@app.route("/api/logout", methods=["POST"])
def logout():

    session.clear()

    return jsonify({
        "success": True,
        "message": "Logged out successfully"
    })


# ---------------------------------------
# IMAGE ANALYSIS
# ---------------------------------------

@app.route("/api/analyze/image", methods=["POST"])
def analyze_image():

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Please log in first"
        }), 401

    if "file" not in request.files:
        return jsonify({
            "success": False,
            "message": "No image uploaded"
        }), 400

    uploaded_file = request.files["file"]

    if not uploaded_file.filename:
        return jsonify({
            "success": False,
            "message": "Invalid filename"
        }), 400

    try:
        result = predict_image(uploaded_file.stream)

        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO analyses (
                user_id,
                filename,
                media_type,
                prediction,
                confidence,
                fake_probability,
                real_probability
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            uploaded_file.filename,
            "image",
            result["label"],
            result["confidence"],
            result["fake_probability"],
            result["real_probability"]
        ))

        connection.commit()
        connection.close()

        return jsonify({
            "success": True,
            "result": result
        })

    except Exception as error:

        app.logger.exception("Image analysis failed")

        return jsonify({
            "success": False,
            "message": "Image analysis failed. Check backend logs."
        }), 500

# ---------------------------------------
# AUDIO ANALYSIS
# ---------------------------------------

@app.route("/api/analyze/audio", methods=["POST"])
def analyze_audio():

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Please log in first"
        }), 401

    if "file" not in request.files:
        return jsonify({
            "success": False,
            "message": "No audio uploaded"
        }), 400

    uploaded_file = request.files["file"]

    if not uploaded_file.filename:
        return jsonify({
            "success": False,
            "message": "Invalid filename"
        }), 400

    connection = None

    try:
        result = predict_audio(uploaded_file.stream)

        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO analyses (
                user_id,
                filename,
                media_type,
                prediction,
                confidence,
                fake_probability,
                real_probability
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            uploaded_file.filename,
            "audio",
            result["label"],
            result["confidence"],
            result["fake_probability"],
            result["real_probability"]
        ))

        connection.commit()

        return jsonify({
            "success": True,
            "result": result
        })

    except Exception:

        app.logger.exception("Audio analysis failed")

        return jsonify({
            "success": False,
            "message": "Audio analysis failed. Check backend logs."
        }), 500

    finally:
        if connection:
            connection.close()

# ---------------------------------------
# USER ANALYSIS HISTORY
# ---------------------------------------

@app.route("/api/history", methods=["GET"])
def history():

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Please log in first"
        }), 401

    connection = get_connection()

    rows = connection.execute("""
        SELECT *
        FROM analyses
        WHERE user_id = ?
        ORDER BY created_at DESC
    """, (user_id,)).fetchall()

    connection.close()

    return jsonify({
        "success": True,
        "history": [dict(row) for row in rows]
    })


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
