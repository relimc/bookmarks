from flask import Blueprint, jsonify, render_template
from flask_login import login_required, current_user
from . import db
from .models import Bookmark

bp = Blueprint('admin', __name__, url_prefix='/admin')

@bp.route('/pending')
@login_required
def admin_pending():
    if current_user.username != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    pending = Bookmark.query.filter_by(status='pending').all()
    return jsonify([{'id': b.id, 'title': b.title, 'url': b.url, 'user_id': b.user_id} for b in pending])

@bp.route('/approve/<int:id>', methods=['POST'])
@login_required
def admin_approve(id):
    if current_user.username != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    b = Bookmark.query.get(id)
    if b:
        b.status = 'approved'
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'error': 'Not found'}), 404

@bp.route('/reject/<int:id>', methods=['POST'])
@login_required
def admin_reject(id):
    if current_user.username != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    b = Bookmark.query.get(id)
    if b:
        b.status = 'private'
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False}), 404

@bp.route('')
@login_required
def admin_page():
    if current_user.username != 'admin':
        return 'Forbidden', 403
    return render_template('admin.html')