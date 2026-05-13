from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from . import db
from .models import Category, Bookmark

bp = Blueprint('categories', __name__)

@bp.route('/add_category', methods=['POST'])
@login_required
def add_category():
    try:
        req = request.get_json()
        name = req.get('name', '').strip()
        if not name:
            return jsonify({'success': False, 'message': '分类名称不能为空'}), 400
        if len(name) > 100:
            return jsonify({'success': False, 'message': '分类名称不能超过100个字符'}), 400

        icon = req.get('icon', '').strip() or 'fas fa-folder'
        if len(icon) > 100:
            icon = icon[:100]

        parent = req.get('parent')
        if parent and isinstance(parent, str):
            parent = parent.strip() or None
        else:
            parent = None

        priority = req.get('priority', 100)
        private = req.get('private', False)

        if Category.query.filter_by(user_id=current_user.id, name=name).first():
            return jsonify({'success': False, 'message': '分类已存在'}), 400

        new_cat = Category(
            user_id=current_user.id,
            name=name,
            icon=icon,
            parent=parent,
            priority=priority,
            private=private
        )
        db.session.add(new_cat)
        db.session.commit()
        return jsonify({'success': True, 'data': {}})
    except Exception as e:
        print(f"添加分类出错: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'message': f'服务器内部错误: {str(e)}'}), 500

@bp.route('/category/<string:name>', methods=['PUT'])
@login_required
def update_category(name):
    try:
        req = request.get_json()
        cat = Category.query.filter_by(user_id=current_user.id, name=name).first()
        if not cat:
            return jsonify({'success': False, 'message': '分类不存在'}), 404

        new_name = req.get('new_name', '').strip() if req.get('new_name') else None
        if new_name and new_name != name:
            if Category.query.filter_by(user_id=current_user.id, name=new_name).first():
                return jsonify({'success': False, 'message': '新分类名称已存在'}), 400
            # 更新所有书签的 category 引用
            Bookmark.query.filter_by(user_id=current_user.id, category=name).update({'category': new_name})
            cat.name = new_name
            name = new_name

        if 'icon' in req:
            icon = req['icon'].strip() if req['icon'] else 'fas fa-folder'
            cat.icon = icon
        if 'parent' in req:
            parent = req['parent'].strip() if req['parent'] else None
            cat.parent = parent
        if 'priority' in req:
            cat.priority = int(req['priority'])
        if 'private' in req:
            cat.private = bool(req['private'])

        db.session.commit()
        return jsonify({'success': True, 'data': {}})
    except Exception as e:
        db.session.rollback()
        print(f"更新分类出错: {e}")  # 打印到控制台便于调试
        return jsonify({'success': False, 'message': f'服务器内部错误: {str(e)}'}), 500

@bp.route('/category/<string:name>', methods=['DELETE'])
@login_required
def delete_category(name):
    cat = Category.query.filter_by(user_id=current_user.id, name=name).first()
    if not cat:
        return jsonify({'success': False, 'message': '分类不存在'}), 404
    has_children = Category.query.filter_by(user_id=current_user.id, parent=name).count() > 0
    has_bookmarks = Bookmark.query.filter_by(user_id=current_user.id, category=name).count() > 0
    if has_children or has_bookmarks:
        return jsonify({'success': False, 'message': '该分类下还有子分类或书签，无法删除'}), 400
    db.session.delete(cat)
    db.session.commit()
    return jsonify({'success': True, 'data': {}})