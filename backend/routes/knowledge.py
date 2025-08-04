# routes/knowledge.py
from flask import Blueprint, jsonify
from utils.decorators import token_required
from models import db


bp = Blueprint('knowledge', __name__, url_prefix='/api/knowledge')

@bp.route('/graph', methods=['GET'])
@token_required
def get_knowledge_graph(current_user):
    # 这里可以从数据库或文件中获取知识图谱数据
    # 为简化示例，返回模拟数据
    
    mock_data = {
        "nodes": [
            {"id": "weapon1", "label": "步枪", "type": "武器"},
            {"id": "weapon2", "label": "手枪", "type": "武器"},
            {"id": "feature1", "label": "射程远", "type": "特性"},
            {"id": "feature2", "label": "射速快", "type": "特性"},
            {"id": "country1", "label": "中国", "type": "国家"},
            {"id": "country2", "label": "美国", "type": "国家"}
        ],
        "edges": [
            {"source": "weapon1", "target": "feature1", "label": "具备"},
            {"source": "weapon1", "target": "country1", "label": "原产于"},
            {"source": "weapon2", "target": "feature2", "label": "具备"},
            {"source": "weapon2", "target": "country2", "label": "原产于"}
        ]
    }
    
    return jsonify({
        'code': 200,
        'message': '获取知识图谱成功',
        'data': mock_data
    }), 200    