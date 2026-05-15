from flask import Blueprint, jsonify, render_template
from flask_login import login_required, current_user
from . import db
from .models import Bookmark, User

bp = Blueprint('admin', __name__, url_prefix='/admin')

@bp.route('/pending')
@login_required
def admin_pending():
    if current_user.username != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    pending = Bookmark.query.filter_by(status='pending').all()
    return jsonify([{
        'id': b.id,
        'title': b.title,
        'url': b.url,
        'description': b.description or '',
        'tags': b.tags,          # 数据库中存储为逗号分隔的字符串
        'user_id': b.user_id
    } for b in pending])

@bp.route('/approve/<int:id>', methods=['POST'])
@login_required
def admin_approve(id):
    if current_user.username != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    b = Bookmark.query.get(id)
    if not b:
        return jsonify({'error': 'Not found'}), 404

    b.status = 'approved'
    db.session.commit()

    # 发送通知邮件
    user = User.query.get(b.user_id)
    if user and user.email:
        from .utils import send_review_result_email
        send_review_result_email(user.email, b.title, is_approved=True)

    return jsonify({'success': True})

@bp.route('/reject/<int:id>', methods=['POST'])
@login_required
def admin_reject(id):
    if current_user.username != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    b = Bookmark.query.get(id)
    if not b:
        return jsonify({'success': False}), 404

    b.status = 'private'
    db.session.commit()

    # 发送通知邮件
    user = User.query.get(b.user_id)
    if user and user.email:
        from .utils import send_review_result_email
        send_review_result_email(user.email, b.title, is_approved=False)

    return jsonify({'success': True})

@bp.route('')
@login_required
def admin_page():
    if current_user.username != 'admin':
        return 'Forbidden', 403
    return render_template('admin.html')