# routes/weapon.py
from flask import Blueprint, request, jsonify
import base64
import os
from werkzeug.utils import secure_filename
from utils.decorators import token_required
from services.weapon_service import recognize_weapon
from models import db

bp = Blueprint('weapon', __name__, url_prefix='/api/weapon')

# 配置上传文件夹（实际项目中可移至配置文件）
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@bp.route('/recognize', methods=['POST'])
@token_required
def recognize(current_user):
    # 检查请求中是否有文件部分
    if 'image' not in request.files:
        return jsonify({
            'code': 400,
            'message': '未上传图片'
        }), 400
    
    file = request.files['image']
    
    # 如果用户没有选择文件，浏览器可能会提交一个空文件
    if file.filename == '':
        return jsonify({
            'code': 400,
            'message': '未选择图片'
        }), 400
    
    # 安全保存文件
    filename = secure_filename(file.filename)
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(file_path)
    
    # 调用武器识别服务（实际项目中可能调用 AI 模型）
    result = recognize_weapon(file_path)
    
    # 删除临时文件
    os.remove(file_path)
    
    return jsonify({
        'code': 200,
        'message': '识别成功',
        'result': result
    }), 200

@bp.route('/recognize-base64', methods=['POST'])
@token_required
def recognize_base64(current_user):
    data = request.get_json()
    
    # 验证必要字段
    if not data or 'image_data' not in data:
        return jsonify({
            'code': 400,
            'message': '缺少图片数据'
        }), 400
    
    image_data = data['image_data']
    
    # 移除 Base64 前缀（如果存在）
    if image_data.startswith('data:image'):
        image_data = image_data.split(',')[1]
    
    try:
        # 解码 Base64 数据
        image_bytes = base64.b64decode(image_data)
        
        # 保存临时文件
        filename = f"temp_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        
        with open(file_path, 'wb') as f:
            f.write(image_bytes)
        
        # 调用武器识别服务
        result = recognize_weapon(file_path)
        
        # 删除临时文件
        os.remove(file_path)
        
        return jsonify({
            'code': 200,
            'message': '识别成功',
            'result': result
        }), 200
        
    except Exception as e:
        return jsonify({
            'code': 500,
            'message': f'识别失败: {str(e)}'
        }), 500    