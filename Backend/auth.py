
from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)

from database import get_connection


def register_user(name, email, password):

    connection = get_connection()
    cursor = connection.cursor()

    try:
        password_hash = generate_password_hash(password)

        cursor.execute("""
            INSERT INTO users (name, email, password_hash)
            VALUES (?, ?, ?)
        """, (name, email.lower(), password_hash))

        connection.commit()

        return {
            "success": True,
            "message": "Account created successfully"
        }

    except Exception as error:

        if "UNIQUE constraint failed" in str(error):
            return {
                "success": False,
                "message": "Email already registered"
            }

        raise

    finally:
        connection.close()


def login_user(email, password):

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            "SELECT * FROM users WHERE email = ?",
            (email.lower(),)
        )

        user = cursor.fetchone()

        if user and check_password_hash(
            user["password_hash"], password
        ):
            return {
                "success": True,
                "user": {
                    "id": user["id"],
                    "name": user["name"],
                    "email": user["email"]
                }
            }

        return {
            "success": False,
            "message": "Invalid email or password"
        }

    finally:
        connection.close()
