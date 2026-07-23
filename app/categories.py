from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from . import db
from .models import Category, Bookmark

bp = Blueprint('categories', __name__)


@bp.route('/add_category', methods=['POST'])
@login_required
def add_category():
    try:
        req = request.get_json()
        name = req.get('name', '').strip()  # 中文名
        name_en = req.get('name_en', '').strip()  # 英文名

        # 至少一个不为空
        if not name and not name_en:
            return jsonify({'success': False, 'message': '请至少输入一种语言的分类名称'}), 400

        # 如果只有英文名，则 name 为空，但数据库 name 字段 nullable=True
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

        # 检查是否存在同名分类（中文或英文相同？这里简单检查中文名或英文名是否已存在）
        # 注意：如果 name 为空，则跳过检查中文名
        if name and Category.query.filter_by(user_id=current_user.id, name=name).first():
            return jsonify({'success': False, 'message': '中文分类名已存在'}), 400
        if name_en and Category.query.filter_by(user_id=current_user.id, name_en=name_en).first():
            return jsonify({'success': False, 'message': '英文分类名已存在'}), 400

        new_cat = Category(
            user_id=current_user.id,
            name=name or None,  # 如果为空则存 None
            name_en=name_en or None,
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

        # 获取请求字段
        new_name = req.get('new_name')
        new_name_en = req.get('new_name_en')
        icon = req.get('icon')
        parent = req.get('parent')
        priority = req.get('priority')
        private = req.get('private')

        # 1. 处理名称更新（仅当字段存在且不是 None）
        if new_name is not None:
            new_name = new_name.strip()
            # 如果 new_name 为空字符串，且 new_name_en 为空，则不允许
            if not new_name and not new_name_en:
                return jsonify({'success': False, 'message': '请至少输入一种语言的分类名称'}), 400
            if new_name and new_name != cat.name:
                # 检查重名
                if Category.query.filter_by(user_id=current_user.id, name=new_name).first():
                    return jsonify({'success': False, 'message': '中文分类名已存在'}), 400
                cat.name = new_name
            elif not new_name and new_name_en:
                # 如果 new_name 被清空但 new_name_en 有值，将 name 设为 new_name_en（后备）
                cat.name = new_name_en
            else:
                # new_name 为空且 new_name_en 也为空，不允许
                return jsonify({'success': False, 'message': '请至少输入一种语言的分类名称'}), 400
        # 如果 new_name 未提供，保持原值

        if new_name_en is not None:
            new_name_en = new_name_en.strip()
            if new_name_en and new_name_en != cat.name_en:
                if Category.query.filter_by(user_id=current_user.id, name_en=new_name_en).first():
                    return jsonify({'success': False, 'message': '英文分类名已存在'}), 400
                cat.name_en = new_name_en

        # 2. 更新其他字段（仅当提供）
        if icon is not None:
            icon = icon.strip() or 'fas fa-folder'
            cat.icon = icon
        if parent is not None:
            parent = parent.strip() or None
            cat.parent = parent
        if priority is not None:
            cat.priority = int(priority)
        if private is not None:
            cat.private = bool(private)

        db.session.commit()
        return jsonify({'success': True, 'data': {}})
    except Exception as e:
        db.session.rollback()
        print(f"更新分类出错: {e}")
        return jsonify({'success': False, 'message': f'服务器内部错误: {str(e)}'}), 500

@bp.route('/category/<string:name>', methods=['DELETE'])
@login_required
def delete_category(name):
    force = request.args.get('force', 'false').lower() == 'true'
    cat = Category.query.filter_by(user_id=current_user.id, name=name).first()
    if not cat:
        return jsonify({'success': False, 'message': '分类不存在'}), 404

    has_children = Category.query.filter_by(user_id=current_user.id, parent=name).count() > 0
    has_bookmarks = Bookmark.query.filter_by(user_id=current_user.id, category=name).count() > 0

    if not force:
        if has_children or has_bookmarks:
            return jsonify({
                'success': False,
                'message': '该分类下还有子分类或书签，无法删除',
                'has_children': has_children,
                'has_bookmarks': has_bookmarks
            }), 400
        db.session.delete(cat)
        db.session.commit()
        return jsonify({'success': True, 'data': {}})
    else:
        # 强制删除
        try:
            delete_category_recursive(name, current_user.id)
            db.session.commit()
            return jsonify({'success': True, 'data': {}})
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500


def delete_category_recursive(category_name, user_id):
    """递归删除分类及其所有子分类，并删除所有相关书签"""
    # 获取所有子分类名称
    children = Category.query.filter_by(user_id=user_id, parent=category_name).all()
    child_names = [c.name for c in children]
    # 递归删除子分类
    for child in children:
        delete_category_recursive(child.name, user_id)
    # 删除所有属于该分类的书签
    Bookmark.query.filter_by(user_id=user_id, category=category_name).delete()
    # 删除分类自身
    Category.query.filter_by(user_id=user_id, name=category_name).delete()