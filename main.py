import os
import time
import json
import requests
from urllib.parse import urljoin, urlparse
from flask import Flask, request, jsonify, render_template, redirect, url_for, session
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from bs4 import BeautifulSoup
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///bookmarks.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# ---------- 数据库模型 ----------
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    bookmarks = db.relationship('Bookmark', backref='user', lazy=True)
    categories = db.relationship('Category', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Bookmark(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    title = db.Column(db.String(500))
    description = db.Column(db.Text)
    category = db.Column(db.String(100), default='未分类')
    icon = db.Column(db.String(500))
    tags = db.Column(db.String(200))  # 存储为逗号分隔
    click_count = db.Column(db.Integer, default=0)
    private = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.Integer, default=time.time)
    status = db.Column(db.String(20), default='private')  # private, pending, approved

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    icon = db.Column(db.String(100), default='fas fa-folder')
    parent = db.Column(db.String(100))
    priority = db.Column(db.Integer, default=100)
    private = db.Column(db.Boolean, default=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# 创建数据库表（首次运行）
with app.app_context():
    db.create_all()

# ---------- 辅助函数 ----------
def download_icon(icon_url):
    """下载图标到本地 static/favicons/，返回本地路径或 None"""
    if not icon_url:
        return None
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(icon_url, headers=headers, timeout=5, stream=True)
        if resp.status_code != 200:
            return None
        # 确定扩展名
        content_type = resp.headers.get('content-type', '').lower()
        if 'image/png' in content_type:
            ext = '.png'
        elif 'image/x-icon' in content_type or 'image/vnd.microsoft.icon' in content_type:
            ext = '.ico'
        elif 'image/svg+xml' in content_type:
            ext = '.svg'
        elif 'image/jpeg' in content_type or 'image/jpg' in content_type:
            ext = '.jpg'
        else:
            parsed = urlparse(icon_url)
            path = parsed.path
            ext = os.path.splitext(path)[1]
            if not ext:
                ext = '.ico'
        save_dir = os.path.join('static', 'favicons')
        os.makedirs(save_dir, exist_ok=True)
        import hashlib
        file_hash = hashlib.md5(icon_url.encode('utf-8')).hexdigest()
        filename = f"{file_hash}{ext}"
        filepath = os.path.join(save_dir, filename)
        if not os.path.exists(filepath):
            with open(filepath, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
        return f"/static/favicons/{filename}"
    except Exception as e:
        print(f"下载图标失败: {e}")
        return None

def get_headers():
    """生成请求头，用于爬虫"""
    import random
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    ]
    return {
        'User-Agent': random.choice(user_agents),
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    }

def extract_icon_url(soup, base_url):
    candidates = []
    for link in soup.find_all('link', rel=lambda x: x and ('icon' in x.lower() or 'shortcut icon' in x.lower())):
        href = link.get('href')
        if href:
            candidates.append(urljoin(base_url, href))
    if not candidates:
        parsed = urlparse(base_url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        candidates.append(f"{base}/favicon.ico")
    return candidates[0] if candidates else ''

# ---------- 路由 ----------
@app.route('/')
def index():
    return render_template('local.html',
        title_id='localTitle',
        title_text='我的书签',
        badge_id='localBadge',
        badge_text='本地版'
    )

@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        login_user(user)
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': '用户名或密码错误'}), 401

@app.route('/register', methods=['POST'])
def register():
    username = request.form['username']
    password = request.form['password']
    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'message': '用户名已存在'}), 400
    user = User(username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({'success': True})

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'Unauthorized'}), 401

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/user')
@login_required
def get_current_user():
    return jsonify({'username': current_user.username})


@app.route('/list')
def list_bookmarks():
    if current_user.is_authenticated:
        # 登录用户：返回自己的所有书签（不限状态）
        bookmarks = Bookmark.query.filter_by(user_id=current_user.id).all()
        categories = Category.query.filter_by(user_id=current_user.id).all()
    else:
        # 未登录用户：只返回已审核通过的公开书签
        bookmarks = Bookmark.query.filter_by(status='approved').all()
        # 分类需要返回所有可能用到的（为了侧边栏展示，可以返回所有分类，但这里简单处理）
        categories = Category.query.all()

    # 构建前端所需格式
    bookmarks_data = []
    for b in bookmarks:
        bookmarks_data.append({
            'id': b.id,
            'url': b.url,
            'title': b.title,
            'description': b.description,
            'category': b.category,
            'icon': b.icon,
            'tags': b.tags.split(',') if b.tags else [],
            'click_count': b.click_count,
            'status': b.status
        })

    categories_data = {}
    for c in categories:
        categories_data[c.name] = {
            'name': c.name,
            'icon': c.icon,
            'parent': c.parent,
            'priority': c.priority,
            'private': False  # 分类暂无私密字段
        }

    return jsonify({'bookmarks': bookmarks_data, 'categories': categories_data})

@app.route('/add', methods=['POST'])
@login_required
def add_bookmark():
    req = request.get_json()
    url = req.get('url', '').strip()
    if not url:
        return jsonify({'success': False, 'message': 'URL不能为空'}), 400

    category = req.get('category', '').strip()
    category_icon = req.get('category_icon', '')
    parent_category = req.get('parent_category', '').strip()
    title = req.get('title', '').strip()
    description = req.get('description', '').strip()
    icon = req.get('icon', '').strip()
    tags = req.get('tags', [])
    status = req.get('status', 'private')  # private / public

    # 用户提交公开时，实际状态为待审核
    if status == 'public':
        status = 'pending'

    # 如果分类不存在且提供了图标，则创建分类
    if category and not Category.query.filter_by(user_id=current_user.id, name=category).first() and category_icon:
        new_cat = Category(
            user_id=current_user.id,
            name=category,
            icon=category_icon,
            parent=parent_category or None
        )
        db.session.add(new_cat)

    # 下载图标（如果有）
    local_icon = None
    if icon and not icon.startswith('data:image'):
        local_icon = download_icon(icon)
    final_icon = local_icon or icon

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

    # 返回最新数据（前端会重新请求 /list，这里简化）
    return jsonify({'success': True, 'data': {}})

@app.route('/edit/<int:item_id>', methods=['POST'])
@login_required
def edit_bookmark(item_id):
    req = request.get_json()
    bookmark = Bookmark.query.filter_by(id=item_id, user_id=current_user.id).first()
    if not bookmark:
        return jsonify({'success': False, 'message': '条目不存在'}), 404

    # 更新分类
    if 'category' in req:
        new_category = req['category'].strip() or '未分类'
        # 自动创建不存在的分类
        if not Category.query.filter_by(user_id=current_user.id, name=new_category).first():
            new_cat = Category(
                user_id=current_user.id,
                name=new_category,
                icon='fas fa-folder',
                parent=req.get('parent_category', '') or None
            )
            db.session.add(new_cat)
        bookmark.category = new_category

    # 更新其他字段
    if 'title' in req:
        bookmark.title = req['title'].strip() or bookmark.category
    if 'description' in req:
        bookmark.description = req['description'].strip()
    if 'icon' in req:
        new_icon = req['icon'].strip()
        if new_icon and not new_icon.startswith('data:image'):
            local_icon = download_icon(new_icon)
            bookmark.icon = local_icon or new_icon
        else:
            bookmark.icon = new_icon
    if 'tags' in req:
        tags = req['tags'] if isinstance(req['tags'], list) else []
        bookmark.tags = ','.join(tags) if tags else ''
    if 'status' in req:
        status = req['status']
        if status == 'public':
            # 用户尝试公开 → 待审核
            bookmark.status = 'pending'
        else:
            bookmark.status = 'private'

    db.session.commit()
    return jsonify({'success': True, 'data': {}})

@app.route('/delete/<int:item_id>', methods=['POST'])
@login_required
def delete_bookmark(item_id):
    bookmark = Bookmark.query.filter_by(id=item_id, user_id=current_user.id).first()
    if not bookmark:
        return jsonify({'success': False, 'message': '条目不存在'}), 404
    category = bookmark.category
    db.session.delete(bookmark)
    db.session.commit()
    # 检查该分类是否还有其它书签，如果没有则删除分类（可选）
    if category:
        remaining = Bookmark.query.filter_by(user_id=current_user.id, category=category).count()
        if remaining == 0:
            cat_obj = Category.query.filter_by(user_id=current_user.id, name=category).first()
            if cat_obj:
                db.session.delete(cat_obj)
                db.session.commit()
    return jsonify({'success': True, 'data': {}})

@app.route('/add_category', methods=['POST'])
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

        # 修复 parent = None 时调用 strip 的问题
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

@app.route('/category/<string:name>', methods=['PUT'])
@login_required
def update_category(name):
    req = request.get_json()
    cat = Category.query.filter_by(user_id=current_user.id, name=name).first()
    if not cat:
        return jsonify({'success': False, 'message': '分类不存在'}), 404

    new_name = req.get('new_name', '').strip()
    if new_name and new_name != name:
        if Category.query.filter_by(user_id=current_user.id, name=new_name).first():
            return jsonify({'success': False, 'message': '新分类名称已存在'}), 400
        # 更新所有书签的 category 引用
        Bookmark.query.filter_by(user_id=current_user.id, category=name).update({'category': new_name})
        cat.name = new_name
        name = new_name
    if 'icon' in req:
        cat.icon = req['icon'].strip() or 'fas fa-folder'
    if 'parent' in req:
        cat.parent = req['parent'].strip() or None
    if 'priority' in req:
        cat.priority = req['priority']
    if 'private' in req:
        cat.private = bool(req['private'])
    db.session.commit()
    return jsonify({'success': True, 'data': {}})

@app.route('/category/<string:name>', methods=['DELETE'])
@login_required
def delete_category(name):
    cat = Category.query.filter_by(user_id=current_user.id, name=name).first()
    if not cat:
        return jsonify({'success': False, 'message': '分类不存在'}), 404
    # 检查是否有子分类或书签
    has_children = Category.query.filter_by(user_id=current_user.id, parent=name).count() > 0
    has_bookmarks = Bookmark.query.filter_by(user_id=current_user.id, category=name).count() > 0
    if has_children or has_bookmarks:
        return jsonify({'success': False, 'message': '该分类下还有子分类或书签，无法删除'}), 400
    db.session.delete(cat)
    db.session.commit()
    return jsonify({'success': True, 'data': {}})

@app.route('/fetch-metadata', methods=['POST'])
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
        icon_url = extract_icon_url(soup, url)
        return jsonify({'success': True, 'title': title[:200], 'description': description[:300], 'icon': icon_url})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/import', methods=['POST'])
@login_required
def import_bookmarks():
    req = request.get_json()
    bookmarks_data = req.get('bookmarks', [])
    categories_data = req.get('categories', [])
    for cat in categories_data:
        name = cat.get('name')
        if not Category.query.filter_by(user_id=current_user.id, name=name).first():
            new_cat = Category(
                user_id=current_user.id,
                name=name,
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
    return jsonify({'success': True, 'data': {}})


@app.route('/export', methods=['GET'])
@login_required
def export_bookmarks():
    user_id = current_user.id
    bookmarks = Bookmark.query.filter_by(user_id=user_id).all()
    categories = Category.query.filter_by(user_id=user_id).all()

    data = {
        'bookmarks': [{
            'url': b.url,
            'title': b.title,
            'description': b.description,
            'category': b.category,
            'icon': b.icon,
            'tags': b.tags.split(',') if b.tags else [],
            'click_count': b.click_count,
            'private': b.private,
        } for b in bookmarks],
        'categories': [{
            'name': c.name,
            'icon': c.icon,
            'parent': c.parent,
            'priority': c.priority,
        } for c in categories]
    }

    response = jsonify(data)
    timestamp = datetime.now().strftime('%Y-%m-%dT%H_%M_%S')
    filename = f'bookmarks_backup_{timestamp}.json'
    response.headers['Content-Disposition'] = f'attachment; filename={filename}'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/increment_click/<int:item_id>', methods=['POST'])
@login_required
def increment_click(item_id):
    bookmark = Bookmark.query.filter_by(id=item_id, user_id=current_user.id).first()
    if bookmark:
        bookmark.click_count += 1
        db.session.commit()
        return jsonify({'success': True, 'click_count': bookmark.click_count})
    return jsonify({'success': False}), 404


@app.route('/recommend')
def recommend():
    if current_user.is_authenticated:
        # 登录用户：返回自己的所有书签，按点击次数降序，取前30
        bookmarks = Bookmark.query.filter_by(user_id=current_user.id).order_by(Bookmark.click_count.desc()).limit(
            30).all()
    else:
        # 未登录用户：只返回已审核通过的公开书签，按点击次数降序，取前30
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
        'status': b.status
    } for b in bookmarks])

@app.route('/online')
def online():
    return render_template('online.html',
        title_id='enhancedTitle',
        title_text='我的书签',
        badge_id='enhancedBadge',
        badge_text='增强版'
    )

@app.route('/admin/pending')
@login_required
def admin_pending():
    if current_user.username != 'admin':  # 可改为更灵活的角色
        return jsonify({'error': 'Forbidden'}), 403
    pending = Bookmark.query.filter_by(status='pending').all()
    return jsonify([{'id': b.id, 'title': b.title, 'url': b.url, 'user_id': b.user_id} for b in pending])

@app.route('/admin/approve/<int:id>', methods=['POST'])
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

@app.route('/admin/reject/<int:id>', methods=['POST'])
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

@app.route('/admin')
@login_required
def admin_page():
    if current_user.username != 'admin':
        return 'Forbidden', 403
    return render_template('admin.html')


if __name__ == '__main__':
    app.run(debug=True)