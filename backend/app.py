from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os
from models import db
from routes.auth import bp as auth_bp
from routes.knowledge import bp as knowledge_bp
from routes.weapon import bp as weapon_bp


load_dotenv()


def create_app():
    app = Flask(__name__)

    # 配置密钥和数据库连接
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default-secret-key')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL','sqlite:///database.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # 初始化数据库
    db.init_app(app)

    # 跨域设置，允许所有来源访问，生产环境可按需调整
    CORS(app)

    # 注册各个蓝图
    app.register_blueprint(auth_bp)
    app.register_blueprint(knowledge_bp)
    app.register_blueprint(weapon_bp)

    # 创建数据库表（如果不存在）
    with app.app_context():
        db.create_all()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)
    