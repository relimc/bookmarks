import time
import requests
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from bs4 import BeautifulSoup
from .utils import download_icon, get_headers, extract_icon_url, is_admin_user, map_icon_to_local
import random
import base64
import os
import requests
from flask import current_app
from . import db
from .models import Bookmark, Category

bp = Blueprint('bookmarks', __name__)

from flask import request
from sqlalchemy.orm import joinedload


from flask import request, jsonify
from sqlalchemy.orm import joinedload

@bp.route('/list')
def list_bookmarks():
    try:
        include_shared = request.args.get('include_shared', 'false').lower() == 'true'

        if current_user.is_authenticated:
            # 自己的书签
            own_bookmarks = Bookmark.query.filter_by(user_id=current_user.id).all()

            if include_shared:
                # 所有公开书签（已审核）但不包括自己的
                shared_bookmarks = Bookmark.query.filter(
                    Bookmark.status == 'approved',
                    Bookmark.user_id != current_user.id
                ).all()
                all_bookmarks = own_bookmarks + shared_bookmarks
            else:
                all_bookmarks = own_bookmarks

            categories = Category.query.filter_by(user_id=current_user.id).all()
        else:
            # 未登录用户：只返回公开书签
            all_bookmarks = Bookmark.query.filter_by(status='approved').all()
            categories = Category.query.all()

        # 构建书签数据（包含 is_owner 和 username）
        bookmarks_data = []
        for b in all_bookmarks:
            # 获取用户名，处理匿名用户情况
            username = None
            if b.user:
                username = b.user.username
            # is_owner 仅当已登录且是本人
            is_owner = (current_user.is_authenticated and b.user_id == current_user.id)
            bookmarks_data.append({
                'id': b.id,
                'url': b.url,
                'title': b.title,
                'description': b.description,
                'category': b.category,
                'icon': map_icon_to_local(b.icon),   # 调用转换函数
                'tags': b.tags.split(',') if b.tags else [],
                'click_count': b.click_count,
                'status': b.status,
                'user_id': b.user_id,
                'username': username,
                'is_owner': is_owner
            })

        categories_data = {}
        for c in categories:
            if c.name is None:
                continue  # 跳过无效分类，避免序列化错误
            categories_data[c.name] = {
                'name': c.name,
                'name_en': c.name_en,
                'icon': c.icon,
                'parent': c.parent,
                'priority': c.priority,
                'private': False
            }

        return jsonify({'bookmarks': bookmarks_data, 'categories': categories_data})
    except Exception as e:
        # 打印错误到控制台，方便调试
        print(f"list_bookmarks 错误: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@bp.route('/convert/<int:bookmark_id>', methods=['POST'])
@login_required
def convert_bookmark(bookmark_id):
    original = Bookmark.query.get(bookmark_id)
    if not original:
        return jsonify({'success': False, 'message': '书签不存在'}), 404
    if original.user_id == current_user.id:
        return jsonify({'success': False, 'message': '不能转换自己的书签'}), 400
    # 复制
    new_bookmark = Bookmark(
        user_id=current_user.id,
        url=original.url,
        title=original.title,
        description=original.description,
        category=original.category,
        icon=original.icon,
        tags=original.tags,
        status='private'  # 默认为私密
    )
    db.session.add(new_bookmark)
    db.session.commit()
    return jsonify({'success': True, 'data': {'id': new_bookmark.id}})


@bp.route('/add', methods=['POST'])
@login_required
def add_bookmark():
    req = request.get_json()
    url = req.get('url', '').strip()
    if not url:
        return jsonify({'success': False, 'message': 'URL不能为空'}), 400

    category = req.get('category', '').strip()
    if not category:
        category = '未分类'
    category_icon = req.get('category_icon', '')
    parent_category = req.get('parent_category', '').strip()
    title = req.get('title', '').strip()
    description = req.get('description', '').strip()
    icon = req.get('icon', '').strip()
    tags = req.get('tags', [])
    status = req.get('status', 'private')

    if status == 'public':
        if is_admin_user():
            status = 'approved'  # 管理员自动通过
        else:
            status = 'pending'

    if category and not Category.query.filter_by(user_id=current_user.id, name=category).first() and category_icon:
        new_cat = Category(
            user_id=current_user.id,
            name=category,
            icon=category_icon,
            parent=parent_category or None
        )
        db.session.add(new_cat)

    if 'icon' in req:
        icon = req['icon'].strip() if req['icon'] else ''
        if icon and not icon.startswith('data:image'):
            local_icon = download_icon(icon)
            final_icon = local_icon or icon
        else:
            final_icon = icon if icon else ''
    else:
        final_icon = ''

    new_bookmark = Bookmark(
        user_id=current_user.id,
        url=url,
        title=title or category or '链接',
        description=description,
        category=category or '未分类',
        icon=final_icon,
        tags=','.join(tags) if tags else '',
        status=status
    )
    db.session.add(new_bookmark)
    db.session.commit()
    current_app.logger.info(f"用户 {current_user.username} 新增书签: {url}, 分类: {category}, 状态: {status}")
    return jsonify({'success': True, 'data': {}})

@bp.route('/edit/<int:item_id>', methods=['POST'])
@login_required
def edit_bookmark(item_id):
    req = request.get_json()
    bookmark = Bookmark.query.filter_by(id=item_id, user_id=current_user.id).first()
    if not bookmark:
        return jsonify({'success': False, 'message': '条目不存在'}), 404

    if 'category' in req:
        new_category = req['category'].strip() or '未分类'
        if not Category.query.filter_by(user_id=current_user.id, name=new_category).first():
            new_cat = Category(
                user_id=current_user.id,
                name=new_category,
                icon='fas fa-folder',
                parent=req.get('parent_category', '') or None
            )
            db.session.add(new_cat)
        bookmark.category = new_category
        current_app.logger.info(f"用户 {current_user.username} 编辑书签 ID: {item_id}, 新分类: {new_category}")

    if 'title' in req:
        bookmark.title = req['title'].strip() or bookmark.category
    if 'description' in req:
        bookmark.description = req['description'].strip()
    if 'icon' in req:
        new_icon = req['icon'].strip() if req['icon'] else ''
        if new_icon:
            if not new_icon.startswith('data:image'):
                local_icon = download_icon(new_icon)
                bookmark.icon = local_icon or new_icon
            else:
                bookmark.icon = new_icon
        else:
            bookmark.icon = ''
    if 'tags' in req:
        tags = req['tags'] if isinstance(req['tags'], list) else []
        bookmark.tags = ','.join(tags) if tags else ''
    if 'status' in req:
        status = req['status']
        if status == 'public':
            if is_admin_user():
                status = 'approved'
                print("Admin: set status to approved")
            else:
                status = 'pending'
                print("Regular user: set status to pending")
        else:
            status = 'private'
        bookmark.status = status

    db.session.commit()
    return jsonify({'success': True, 'data': {}})

@bp.route('/delete/<int:item_id>', methods=['POST'])
@login_required
def delete_bookmark(item_id):
    bookmark = Bookmark.query.filter_by(id=item_id, user_id=current_user.id).first()
    if not bookmark:
        return jsonify({'success': False, 'message': '条目不存在'}), 404
    category = bookmark.category
    db.session.delete(bookmark)
    db.session.commit()
    if category:
        remaining = Bookmark.query.filter_by(user_id=current_user.id, category=category).count()
        if remaining == 0:
            cat_obj = Category.query.filter_by(user_id=current_user.id, name=category).first()
            if cat_obj:
                db.session.delete(cat_obj)
                db.session.commit()
    current_app.logger.info(f"用户 {current_user.username} 删除书签 ID: {item_id}")
    return jsonify({'success': True, 'data': {}})

@bp.route('/import', methods=['POST'])
@login_required
def import_bookmarks():
    req = request.get_json()
    bookmarks_data = req.get('bookmarks', [])
    categories_data = req.get('categories', [])
    for cat in categories_data:
        name = cat.get('name')
        if not name:
            continue  # 跳过无效分类
        # 检查是否已存在
        if not Category.query.filter_by(user_id=current_user.id, name=name).first():
            new_cat = Category(
                user_id=current_user.id,
                name=name,
                name_en=cat.get('name_en', ''),   # 新增
                icon=cat.get('icon', 'fas fa-folder'),
                parent=cat.get('parent', ''),
                priority=cat.get('priority', 100)
            )
            db.session.add(new_cat)
    for b in bookmarks_data:
        icon = b.get('icon', '')
        if icon and not icon.startswith('data:image'):
            local_icon = download_icon(icon)
            final_icon = local_icon or icon
        else:
            final_icon = icon
        new_bm = Bookmark(
            user_id=current_user.id,
            url=b['url'],
            title=b.get('title', b['url']),
            description=b.get('description', ''),
            category=b.get('category', '未分类'),
            icon=final_icon,
            tags=','.join(b.get('tags', [])),
            private=b.get('private', False)
        )
        db.session.add(new_bm)
    db.session.commit()
    current_app.logger.info(f"用户 {current_user.username} 导入书签: {len(bookmarks_data)} 条")
    return jsonify({'success': True, 'data': {}})

def icon_to_base64(icon_value):
    """将图标（URL、本地路径或已有base64）统一转换为 data:image/*;base64, 格式"""
    if not icon_value:
        return ''
    # 已经是 data:image
    if icon_value.startswith('data:image'):
        return icon_value
    # 本地路径： /static/favicons/xxx.png
    if icon_value.startswith('/static/'):
        # 获取绝对路径
        static_folder = current_app.static_folder
        if static_folder:
            filepath = os.path.join(static_folder, icon_value[8:])  # 去掉 '/static/'
            if os.path.exists(filepath):
                with open(filepath, 'rb') as f:
                    data = f.read()
                    # 根据扩展名推断 MIME
                    ext = os.path.splitext(filepath)[1].lower()
                    mime = 'image/png' if ext == '.png' else 'image/jpeg' if ext in ('.jpg', '.jpeg') else 'image/x-icon'
                    return f'data:{mime};base64,' + base64.b64encode(data).decode()
        # 如果文件不存在，返回空（或原值）
        return ''
    # 外部 URL
    if icon_value.startswith(('http://', 'https://')):
        try:
            resp = requests.get(icon_value, timeout=5)
            if resp.status_code == 200:
                content_type = resp.headers.get('content-type', '')
                if content_type.startswith('image/'):
                    return f'data:{content_type};base64,' + base64.b64encode(resp.content).decode()
        except Exception:
            pass
        # 如果下载失败，返回空
        return ''
    # 其他情况（如字体图标类名）不做处理，返回空
    return ''

@bp.route('/export', methods=['GET'])
@login_required
def export_bookmarks():
    user_id = current_user.id
    bookmarks = Bookmark.query.filter_by(user_id=user_id).all()
    categories = Category.query.filter_by(user_id=user_id).all()

    bookmarks_data = []
    for b in bookmarks:
        # 转换图标
        base64_icon = icon_to_base64(b.icon)
        bookmarks_data.append({
            'url': b.url,
            'title': b.title,
            'description': b.description,
            'category': b.category,
            'icon': base64_icon,   # 替换为 base64
            'tags': b.tags.split(',') if b.tags else [],
            'click_count': b.click_count,
            'private': b.private,
        })

    categories_data = [{
        'name': c.name,
        'name_en': c.name_en,
        'icon': c.icon,
        'parent': c.parent,
        'priority': c.priority,
    } for c in categories]

    data = {
        'bookmarks': bookmarks_data,
        'categories': categories_data
    }

    from datetime import datetime
    response = jsonify(data)
    timestamp = datetime.now().strftime('%Y-%m-%dT%H_%M_%S')
    filename = f'bookmarks_backup_{timestamp}.json'
    response.headers['Content-Disposition'] = f'attachment; filename={filename}'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    current_app.logger.info(f"用户 {current_user.username} 导出书签")
    return response

@bp.route('/increment_click/<int:item_id>', methods=['POST'])
@login_required
def increment_click(item_id):
    bookmark = Bookmark.query.filter_by(id=item_id, user_id=current_user.id).first()
    if bookmark:
        bookmark.click_count += 1
        db.session.commit()
        return jsonify({'success': True, 'click_count': bookmark.click_count})
    return jsonify({'success': False}), 404

@bp.route('/recommend')
def recommend():
    if current_user.is_authenticated:
        bookmarks = Bookmark.query.filter_by(user_id=current_user.id).order_by(Bookmark.click_count.desc()).limit(30).all()
    else:
        bookmarks = Bookmark.query.filter_by(status='approved').order_by(Bookmark.click_count.desc()).limit(30).all()

    return jsonify([{
        'id': b.id,
        'url': b.url,
        'title': b.title,
        'description': b.description,
        'category': b.category,
        'icon': b.icon,
        'tags': b.tags.split(',') if b.tags else [],
        'click_count': b.click_count,
        'status': b.status,
        'user_id': b.user_id,         # 新增
        'username': b.user.username   # 新增（需确保查询时 join 或 eager load，或单独查询）
    } for b in bookmarks])

@bp.route('/fetch-metadata', methods=['POST'])
def fetch_metadata():
    req = request.get_json()
    url = req.get('url', '').strip()
    if not url:
        return jsonify({'success': False, 'message': 'URL不能为空'}), 400
    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url
    try:
        time.sleep(1)
        headers = get_headers()
        resp = requests.get(url, headers=headers, timeout=8)
        resp.encoding = 'utf-8'
        soup = BeautifulSoup(resp.text, 'html.parser')
        title = soup.title.string.strip() if soup.title else ''
        if not title:
            h1 = soup.find('h1')
            title = h1.get_text().strip() if h1 else ''
        description = ''
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            description = meta_desc['content'].strip()

        # 提取关键词并清洗（随机选取10个）
        keywords_array = []
        meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
        if meta_keywords and meta_keywords.get('content'):
            keywords_raw = meta_keywords['content'].strip()
            import re
            parts = re.split(r'[，,、;；]+', keywords_raw)
            seen = set()
            cleaned = []
            for p in parts:
                p = p.strip()
                if not p:
                    continue
                lower_p = p.lower()
                if lower_p not in seen:
                    seen.add(lower_p)
                    cleaned.append(p)
            total = len(cleaned)
            if total == 0:
                keywords_array = []
            else:
                count = min(10, total)
                keywords_array = random.sample(cleaned, count)

        icon_url = extract_icon_url(soup, url)

        return jsonify({
            'success': True,
            'title': title,
            'description': description,
            'icon': icon_url,
            'keywords': keywords_array
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500