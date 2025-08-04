# utils/decorators.py
import jwt
from flask import request, jsonify
from functools import wraps
from app import app
from models.user import User

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # 从请求头中获取 token
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].replace('Bearer ', '')
        
        if not token:
            return jsonify({
                'code': 401,
                'message': '认证令牌缺失'
            }), 401
        
        try:
            # 解码 token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            
            # 查找用户
            current_user = User.query.filter_by(id=data['user_id']).first()
            
            if not current_user:
                return jsonify({
                    'code': 401,
                    'message': '用户不存在'
                }), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({
                'code': 401,
                'message': '令牌已过期'
            }), 401
            
        except jwt.InvalidTokenError:
            return jsonify({
                'code': 401,
                'message': '无效令牌'
            }), 401
            
        # 将当前用户作为参数传递给被装饰的函数
        return f(current_user, *args, **kwargs)
    
    return decorated    