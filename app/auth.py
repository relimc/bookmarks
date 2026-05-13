import re
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, render_template, redirect, url_for
from flask_login import login_user, logout_user, login_required, current_user
from . import db, login_manager
from .models import User, VerificationCode
from .utils import generate_verification_code, send_verification_email

bp = Blueprint('auth', __name__)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'Unauthorized'}), 401

@bp.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        login_user(user)
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': '用户名或密码错误'}), 401

@bp.route('/register', methods=['POST'])
def register():
    username = request.form.get('username', '').strip()
    email = request.form.get('email', '').strip().lower()
    password = request.form.get('password', '')
    verification_code = request.form.get('verification_code', '').strip()

    if not username or not email or not password or not verification_code:
        return jsonify({'success': False, 'message': '所有字段都必须填写'}), 400
    if len(username) < 3 or len(username) > 80:
        return jsonify({'success': False, 'message': '用户名长度应为3-80个字符'}), 400
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, email):
        return jsonify({'success': False, 'message': '邮箱格式不正确'}), 400
    if len(password) < 8:
        return jsonify({'success': False, 'message': '密码长度至少为8位'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'message': '用户名已存在'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': '该邮箱已被注册'}), 400

    vc = VerificationCode.query.filter_by(email=email).first()
    if not vc:
        return jsonify({'success': False, 'message': '请先获取验证码'}), 400
    if vc.is_expired():
        return jsonify({'success': False, 'message': '验证码已过期，请重新获取'}), 400
    if vc.code != verification_code:
        return jsonify({'success': False, 'message': '验证码错误'}), 400

    db.session.delete(vc)
    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({'success': True, 'message': '注册成功'})

@bp.route('/send_verification', methods=['POST'])
def send_verification():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({'success': False, 'message': '邮箱不能为空'}), 400
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, email):
        return jsonify({'success': False, 'message': '邮箱格式不正确'}), 400

    last_code = VerificationCode.query.filter_by(email=email).order_by(VerificationCode.created_at.desc()).first()
    if last_code and (datetime.utcnow() - last_code.created_at).total_seconds() < 60:
        return jsonify({'success': False, 'message': '发送过于频繁，请稍后再试'}), 429

    code = generate_verification_code()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    VerificationCode.query.filter_by(email=email).delete()
    vc = VerificationCode(email=email, code=code, created_at=datetime.utcnow(), expires_at=expires_at)
    db.session.add(vc)
    db.session.commit()

    if send_verification_email(email, code):
        return jsonify({'success': True, 'message': '验证码已发送，请注意查收'})
    else:
        return jsonify({'success': False, 'message': '邮件发送失败，请稍后重试'}), 500

@bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('main.index'))

@bp.route('/user')
@login_required
def get_current_user():
    return jsonify({'username': current_user.username})


@bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({'success': False, 'message': '邮箱不能为空'}), 400

    # 检查邮箱是否存在
    user = User.query.filter_by(email=email).first()
    if not user:
        # 为了安全，不明确提示邮箱不存在，返回通用信息
        return jsonify({'success': True, 'message': '如果该邮箱已注册，我们将发送重置验证码'})

    # 生成验证码并存储（复用 VerificationCode 表，可增加 type 字段区分，但简单起见直接覆盖）
    code = generate_verification_code()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    # 删除旧的验证码记录（按邮箱）
    VerificationCode.query.filter_by(email=email).delete()
    vc = VerificationCode(email=email, code=code, created_at=datetime.utcnow(), expires_at=expires_at)
    db.session.add(vc)
    db.session.commit()

    # 发送邮件
    if send_verification_email(email, code):
        return jsonify({'success': True, 'message': '验证码已发送到您的邮箱'})
    else:
        return jsonify({'success': False, 'message': '邮件发送失败，请稍后重试'}), 500

@bp.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    code = data.get('code', '').strip()
    new_password = data.get('new_password', '')

    if not email or not code or not new_password:
        return jsonify({'success': False, 'message': '所有字段都必须填写'}), 400

    if len(new_password) < 8:
        return jsonify({'success': False, 'message': '密码长度至少为8位'}), 400

    # 校验验证码
    vc = VerificationCode.query.filter_by(email=email).first()
    if not vc or vc.is_expired() or vc.code != code:
        return jsonify({'success': False, 'message': '验证码无效或已过期'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'success': False, 'message': '该邮箱未注册'}), 404

    # 更新密码
    user.set_password(new_password)
    db.session.delete(vc)  # 删除已使用的验证码
    db.session.commit()

    return jsonify({'success': True, 'message': '密码重置成功，请重新登录'})