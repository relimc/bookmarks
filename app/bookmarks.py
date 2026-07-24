import threading
import time
import hashlib
import requests
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from bs4 import BeautifulSoup
from .utils import download_icon, get_headers, extract_icon_url, is_admin_user
import random
import base64
import os
import requests
from flask import current_app
from . import db
from .models import Bookmark, Category

bp = Blueprint('bookmarks', __name__)


# 图标缓存
_icon_cache = {}
_cache_loaded = False

def _load_icon_cache():
    global _cache_loaded
    if _cache_loaded:
        return
    favicon_dir = os.path.join(current_app.root_path, 'static', 'favicons')
    if os.path.exists(favicon_dir):
        for filename in os.listdir(favicon_dir):
            if '.' in filename:
                file_hash = filename.split('.')[0]
                _icon_cache[file_hash] = filename
    _cache_loaded = True
    current_app.logger.info(f"图标缓存已加载，共 {len(_icon_cache)} 个文件")

def _download_icon_async(icon_url, file_hash, app):
    try:
        with app.app_context():
            local_path = download_icon(icon_url)
            if local_path:
                filename = os.path.basename(local_path)
                _icon_cache[file_hash] = filename
                current_app.logger.info(f"后台下载成功: {icon_url}")
            else:
                current_app.logger.info(f"后台下载失败: {icon_url}")
    except Exception as e:
        current_app.logger.error(f"后台下载异常: {icon_url}, {e}")

def map_icon_to_local(icon_url):
    if not icon_url:
        return ''
    if icon_url.startswith('data:'):
        # 尝试将 Base64 保存为本地文件
        try:
            import base64
            import re
            # 解析 data:image/[type];base64,...
            match = re.match(r'data:image/(?P<type>\w+);base64,(?P<data>.+)', icon_url)
            if match:
                ext = match.group('type')
                data = match.group('data')
                # 解码
                image_data = base64.b64decode(data)
                # 保存到 favicons 目录
                file_hash = hashlib.md5(icon_url.encode('utf-8')).hexdigest()
                filename = f"{file_hash}.{ext}"
                save_dir = os.path.join(current_app.root_path, 'static', 'favicons')
                os.makedirs(save_dir, exist_ok=True)
                filepath = os.path.join(save_dir, filename)
                with open(filepath, 'wb') as f:
                    f.write(image_data)
                # 更新缓存
                _icon_cache[file_hash] = filename
                return f'/static/favicons/{filename}'
        except Exception as e:
            current_app.logger.warning(f"Base64 图标保存失败: {e}")
        # 如果保存失败，仍然返回原始 data URL
        return icon_url

    # 确保缓存已加载
    _load_icon_cache()

    if icon_url.startswith('/static/favicons/'):
        static_dir = current_app.static_folder or os.path.join(current_app.root_path, 'static')
        file_path = os.path.join(static_dir, 'favicons', os.path.basename(icon_url))
        if os.path.exists(file_path):
            return icon_url
        return ''

    file_hash = hashlib.md5(icon_url.encode('utf-8')).hexdigest()

    # 检查缓存
    cached = _icon_cache.get(file_hash)
    if cached:
        static_dir = current_app.static_folder or os.path.join(current_app.root_path, 'static')
        file_path = os.path.join(static_dir, 'favicons', cached)
        if os.path.exists(file_path):
            return f'/static/favicons/{cached}'
        else:
            _icon_cache.pop(file_hash, None)

    # 目录扫描
    favicon_dir = os.path.join(current_app.root_path, 'static', 'favicons')
    if os.path.exists(favicon_dir):
        for filename in os.listdir(favicon_dir):
            if filename.startswith(file_hash):
                _icon_cache[file_hash] = filename
                return f'/static/favicons/{filename}'

    # 启动后台下载
    app = current_app._get_current_object()
    threading.Thread(target=_download_icon_async, args=(icon_url, file_hash, app), daemon=True).start()
    return icon_url

@bp.route('/list')
def list_bookmarks():
    try:
        include_shared = request.args.get('include_shared', 'false').lower() == 'true'

        if current_user.is_authenticated:
            # 登录用户：返回所有书签和所有分类
            own_bookmarks = Bookmark.query.filter_by(user_id=current_user.id).all()
            if include_shared:
                shared_bookmarks = Bookmark.query.filter(
                    Bookmark.status == 'approved',
                    Bookmark.user_id != current_user.id
                ).all()
                all_bookmarks = own_bookmarks + shared_bookmarks
            else:
                all_bookmarks = own_bookmarks

            categories = Category.query.filter_by(user_id=current_user.id).all()
        else:
            # 未登录用户：只返回公开书签，但分类需要包含有公开书签的分类及其祖先
            all_bookmarks = Bookmark.query.filter_by(status='approved').all()
            # 收集有公开书签的分类名称
            bookmark_category_names = {b.category for b in all_bookmarks}
            all_categories = Category.query.all()

            # 构建分类名称集合，包括所有有书签的分类及其父分类
            category_names_set = set(bookmark_category_names)
            # 向上追溯父分类
            for cat_name in list(category_names_set):
                cat = next((c for c in all_categories if c.name == cat_name), None)
                while cat and cat.parent:
                    category_names_set.add(cat.parent)
                    cat = next((c for c in all_categories if c.name == cat.parent), None)

            categories = [c for c in all_categories if c.name in category_names_set]

        # 构建书签数据
        bookmarks_data = []
        for b in all_bookmarks:
            username = b.user.username if b.user else None
            is_owner = (current_user.is_authenticated and b.user_id == current_user.id)
            bookmarks_data.append({
                'id': b.id,
                'url': b.url,
                'title': b.title,
                'description': b.description,
                'category': b.category,
                'icon': map_icon_to_local(b.icon),
                'tags': b.tags.split(',') if b.tags else [],
                'click_count': b.click_count,
                'status': b.status,
                'user_id': b.user_id,
                'username': username,
                'is_owner': is_owner
            })

        # 构建分类数据
        categories_data = {}
        for c in categories:
            if c.name is None:
                continue
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
    raw_icon = req.get('icon', '').strip()
    tags = req.get('tags', [])
    status = req.get('status', 'private')

    # ========== 先处理状态转换 ==========
    if status == 'public':
        if is_admin_user():
            status = 'approved'
        else:
            status = 'pending'

    # ========== 处理图标 ==========
    final_icon = ''
    if raw_icon:
        if not raw_icon.startswith('data:image'):
            local_icon = download_icon(raw_icon)
            print(f"[DEBUG] local_icon: '{local_icon}'")
            final_icon = local_icon or raw_icon
        else:
            final_icon = raw_icon

    # 创建分类（如果有）
    if category and not Category.query.filter_by(user_id=current_user.id, name=category).first() and category_icon:
        new_cat = Category(
            user_id=current_user.id,
            name=category,
            icon=category_icon,
            parent=parent_category or None
        )
        db.session.add(new_cat)

    # 创建 Bookmark 对象（此时 status 已转换）
    new_bookmark = Bookmark(
        user_id=current_user.id,
        url=url,
        title=title or category or '链接',
        description=description,
        category=category or '未分类',
        icon=final_icon,
        tags=','.join(tags) if tags else '',
        status=status  # 使用转换后的 status
    )

    db.session.add(new_bookmark)
    db.session.commit()
    saved = Bookmark.query.get(new_bookmark.id)

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

    # 导入分类
    for cat in categories_data:
        name = cat.get('name')
        if name and not Category.query.filter_by(user_id=current_user.id, name=name).first():
            new_cat = Category(
                user_id=current_user.id,
                name=name,
                name_en=cat.get('name_en', ''),
                icon=cat.get('icon', 'fas fa-folder'),
                parent=cat.get('parent', ''),
                priority=cat.get('priority', 100)
            )
            db.session.add(new_cat)

    # 导入书签
    for b in bookmarks_data:
        icon = b.get('icon', '')
        # 只对非 Base64 且非本地路径的图标尝试下载
        if icon and not icon.startswith('data:image') and not icon.startswith('/static/'):
            local_icon = download_icon(icon)
            final_icon = local_icon or icon
        else:
            final_icon = icon  # 直接使用原值（Base64 或本地路径）

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
    return jsonify({'success': True, 'data': {}})

def icon_to_base64(icon_value):
    """将图标转换为 Base64，如果无法转换则返回原始值"""
    if not icon_value:
        return ''
    if icon_value.startswith('data:image'):
        return icon_value  # 已经是 base64
    if icon_value.startswith('/static/'):
        # 尝试读取本地文件
        filepath = os.path.join(current_app.static_folder, icon_value[8:])
        if os.path.exists(filepath):
            with open(filepath, 'rb') as f:
                data = f.read()
                ext = os.path.splitext(filepath)[1][1:].lower()
                mime = 'image/png' if ext == 'png' else 'image/jpeg' if ext in ('jpg','jpeg') else 'image/x-icon'
                return f'data:{mime};base64,' + base64.b64encode(data).decode()
        # 文件不存在，返回原始值（可能是个路径）
        return icon_value
    if icon_value.startswith('http'):
        # 尝试下载并转换，但为了避免延迟，可选择性实现
        # 简单起见，直接返回原始 URL
        return icon_value
    # 其他情况（如 Font Awesome 类名），原样返回
    return icon_value

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