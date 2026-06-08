import os
from flask import Flask
from flask_babel import Babel
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_mail import Mail
from datetime import timedelta
from flask import Flask, session, request
from dotenv import load_dotenv
import logging
from logging.handlers import RotatingFileHandler

# 加载 .env 文件
load_dotenv()

db = SQLAlchemy()
login_manager = LoginManager()
mail = Mail()
babel = Babel()


def create_app():
    # 获取项目根目录（run.py 所在目录）
    base_dir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    template_dir = os.path.join(base_dir, 'templates')
    static_dir = os.path.join(base_dir, 'static')

    app = Flask(__name__,
                template_folder=template_dir,
                static_folder=static_dir)

    # 读取域名配置
    app.config['LOCAL_DOMAIN'] = os.environ.get('LOCAL_DOMAIN', 'nav.toadlive.top')
    app.config['PLUS_DOMAIN'] = os.environ.get('PLUS_DOMAIN', 'navplus.toadlive.top')

    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///bookmarks.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # 管理员列表配置（支持逗号分隔多个用户名）
    admin_users_str = os.environ.get('ADMIN_USERS', 'admin')
    admin_users = [u.strip() for u in admin_users_str.split(',') if u.strip()]
    app.config['ADMIN_USERS'] = admin_users

    # 邮件配置从环境变量读取
    app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'localhost')
    app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 1025))
    app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'false').lower() == 'true'
    app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'false').lower() == 'true'
    app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', '')
    app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', '')
    app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', app.config['MAIL_USERNAME'])

    # 多语言配置
    app.config['LANGUAGES'] = {
        'zh': '中文',
        'en': 'English'
    }
    app.config['BABEL_DEFAULT_LOCALE'] = 'zh'

    # 定义语言选择函数
    def get_locale():
        from flask import session, request
        lang = session.get('lang')
        if lang and lang in app.config['LANGUAGES']:
            return lang
        return request.accept_languages.best_match(app.config['LANGUAGES'].keys())

    # 初始化扩展
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'  # 注意蓝图名称
    mail.init_app(app)
    babel.init_app(app, locale_selector=get_locale)

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

    # ---------- 日志配置 ----------
    if not app.debug:
        # 确保日志目录存在
        log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)

        # 设置日志格式
        formatter = logging.Formatter(
            '%(asctime)s %(levelname)s [%(name)s] %(message)s [in %(pathname)s:%(lineno)d]'
        )

        # 文件处理器：单个文件最大10MB，保留10个备份
        file_handler = RotatingFileHandler(
            os.path.join(log_dir, 'bookmark.log'),
            maxBytes=10485760,  # 10MB
            backupCount=10
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(logging.INFO)

        # 控制台处理器（可选，用于调试）
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        console_handler.setLevel(logging.INFO)

        # 添加到 Flask 应用日志器
        app.logger.addHandler(file_handler)
        app.logger.addHandler(console_handler)
        app.logger.setLevel(logging.INFO)

        app.logger.info('Bookmark 应用启动')

    return app