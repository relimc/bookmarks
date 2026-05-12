import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_mail import Mail
from datetime import timedelta
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()

db = SQLAlchemy()
login_manager = LoginManager()
mail = Mail()


def create_app():
    # 获取项目根目录（run.py 所在目录）
    base_dir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    template_dir = os.path.join(base_dir, 'templates')
    static_dir = os.path.join(base_dir, 'static')

    app = Flask(__name__,
                template_folder=template_dir,
                static_folder=static_dir)

    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///bookmarks.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # 邮件配置从环境变量读取
    app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'localhost')
    app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 1025))
    app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'false').lower() == 'true'
    app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'false').lower() == 'true'
    app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', '')
    app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', '')
    app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', app.config['MAIL_USERNAME'])


    # 初始化扩展
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'  # 注意蓝图名称
    mail.init_app(app)

    # 注册蓝图（注意：目前蓝图使用了 url_prefix，确保与之前一致）
    from . import auth, bookmarks, categories, admin, main
    app.register_blueprint(auth.bp)  # 无 url_prefix，直接绑定
    app.register_blueprint(bookmarks.bp)  # 无 url_prefix
    app.register_blueprint(categories.bp)  # 无 url_prefix
    app.register_blueprint(admin.bp, url_prefix='/admin')  # admin 保持 /admin 前缀
    app.register_blueprint(main.bp)  # 处理 / 和 /online

    # 创建数据库表
    with app.app_context():
        db.create_all()

    return app