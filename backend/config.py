# config.py
import os

class Config:
    # 数据库配置
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL', 'sqlite:///database.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # 密钥配置（用于 JWT 等）
    SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-here')
    
    # JWT 配置
    JWT_EXPIRATION_DELTA = 3600  # Token 有效期（秒）
    
    # 其他配置
    DEBUG = True    