# routes/auth.py
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from datetime import datetime, timedelta
from models import db
from models.user import User
from utils.decorators import token_required

bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # 验证必要字段
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({
            'code': 400,
            'message': '缺少必要字段'
        }), 400
    
    username = data['username']
    password = data['password']
    email = data.get('email')
    
    # 检查用户名是否已存在
    if User.query.filter_by(username=username).first():
        return jsonify({
            'code': 400,
            'message': '用户名已存在'
        }), 400
    
    # 创建新用户
    new_user = User(
        username=username,
        password_hash=generate_password_hash(password),  # 存储密码哈希
        email=email
    )
    
    # 保存到数据库
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({
        'code': 201,
        'message': '注册成功',
        'user': new_user.to_dict()
    }), 201

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    # 验证必要字段
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({
            'code': 400,
            'message': '缺少必要字段'
        }), 400
    
    username = data['username']
    password = data['password']
    
    # 查找用户
    user = User.query.filter_by(username=username).first()
    
    # 验证用户和密码
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({
            'code': 401,
            'message': '用户名或密码错误'
        }), 401
    
    # 生成 JWT token
    payload = {
        'user_id': user.id,
        'exp': datetime.utcnow() + timedelta(seconds=3600)  # 1小时有效期
    }
    
    token = jwt.encode(
        payload,
        request.app.config['SECRET_KEY'],
        algorithm='HS256'
    )
    
    return jsonify({
        'code': 200,
        'message': '登录成功',
        'token': token,
        'user': user.to_dict()
    }), 200

@bp.route('/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    return jsonify({
        'code': 200,
        'user': current_user.to_dict()
    }), 200    