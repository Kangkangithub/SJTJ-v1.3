# models/__init__.py
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()  # 初始化 db 对象，但不绑定 app