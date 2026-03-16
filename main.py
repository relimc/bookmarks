import json
import os
import time
import requests
from bs4 import BeautifulSoup
import extract_favicon
from flask import Flask, request, jsonify, render_template
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
auth = HTTPBasicAuth()

# 从环境变量读取管理员账号密码（生产环境务必设置）
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'change_this_password')

# 存储用户名和密码（这里使用明文，生产环境建议使用哈希）
users = { ADMIN_USERNAME: ADMIN_PASSWORD }

@auth.verify_password
def verify_password(username, password):
    if username in users and users[username] == password:
        return username
    return None

DATA_FILE = 'data/data.json'  # 使用子目录 data，便于 Docker 挂载

# ---------- 数据操作 ----------
def load_data():
    if not os.path.exists(DATA_FILE):
        return {'bookmarks': [], 'categories': {}}
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {'bookmarks': [], 'categories': {}}

def save_data(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ---------- 路由 ----------
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/list')
def list_bookmarks():
    return jsonify(load_data())

@app.route('/add', methods=['POST'])
@auth.login_required
def add_bookmark():
    req = request.get_json()
    url = req.get('url', '').strip()
    if not url:
        return jsonify({'success': False, 'message': 'URL 不能为空'}), 400

    category = req.get('category', '').strip()
    category_icon = req.get('category_icon', '')
    parent_category = req.get('parent_category', '').strip()
    title = req.get('title', '').strip()
    description = req.get('description', '').strip()
    icon = req.get('icon', '').strip()

    data = load_data()
    bookmarks = data['bookmarks']
    categories = data['categories']

    if category and category not in categories and category_icon:
        categories[category] = {
            'name': category,
            'icon': category_icon,
            'parent': parent_category
        }

    new_item = {
        'id': int(time.time() * 1000),
        'url': url,
        'category': category or '未分类',
        'icon': icon or '',
        'title': title or category or '链接',
        'description': description
    }
    bookmarks.append(new_item)
    save_data(data)

    return jsonify({'success': True, 'data': data})

@app.route('/edit/<int:item_id>', methods=['POST'])
@auth.login_required
def edit_bookmark(item_id):
    req = request.get_json()
    data = load_data()
    bookmarks = data['bookmarks']
    categories = data['categories']

    for item in bookmarks:
        if item['id'] == item_id:
            # 更新分类（如果变更）
            if 'category' in req:
                new_category = req['category'].strip() or '未分类'
                # 如果新分类不存在，则自动创建
                if new_category not in categories:
                    # 获取上级分类（如果有）
                    parent = req.get('parent_category', '').strip() or None
                    categories[new_category] = {
                        'name': new_category,
                        'icon': 'fas fa-folder',  # 默认图标
                        'parent': parent
                    }
                item['category'] = new_category

            # 更新其他字段
            if 'icon' in req:
                item['icon'] = req['icon'].strip()
            if 'title' in req:
                item['title'] = req['title'].strip() or item['category']
            if 'description' in req:
                item['description'] = req['description'].strip()

            save_data(data)
            return jsonify({'success': True, 'data': data})

    return jsonify({'success': False, 'message': '条目不存在'}), 404

@app.route('/delete/<int:item_id>', methods=['POST'])
@auth.login_required
def delete_bookmark(item_id):
    data = load_data()
    bookmarks = data['bookmarks']
    categories = data['categories']

    item_to_delete = None
    for item in bookmarks:
        if item['id'] == item_id:
            item_to_delete = item
            break

    if not item_to_delete:
        return jsonify({'success': False, 'message': '条目不存在'}), 404

    category = item_to_delete.get('category')
    new_bookmarks = [item for item in bookmarks if item['id'] != item_id]
    data['bookmarks'] = new_bookmarks

    if category:
        other_in_category = any(b['category'] == category for b in new_bookmarks)
        if not other_in_category:
            has_children = any(cat.get('parent') == category for cat in categories.values())
            if not has_children and category in categories:
                del categories[category]

    save_data(data)
    return jsonify({'success': True, 'data': data})

@app.route('/add_category', methods=['POST'])
@auth.login_required
def add_category():
    req = request.get_json()
    name = req.get('name', '').strip()
    if not name:
        return jsonify({'success': False, 'message': '分类名称不能为空'}), 400

    icon = req.get('icon', '').strip() or 'fas fa-folder'
    parent = req.get('parent', '').strip() or None

    data = load_data()
    categories = data['categories']

    if name in categories:
        return jsonify({'success': False, 'message': '分类已存在'}), 400

    categories[name] = {
        'name': name,
        'icon': icon,
        'parent': parent
    }
    save_data(data)
    return jsonify({'success': True, 'data': data})

@app.route('/import', methods=['POST'])
@auth.login_required
def import_bookmarks():
    """批量导入书签"""
    req = request.get_json()
    bookmarks_data = req.get('bookmarks', [])
    categories_data = req.get('categories', [])

    data = load_data()
    bookmarks = data['bookmarks']
    categories = data['categories']

    # 先创建分类（确保父分类在前）
    for cat in categories_data:
        if cat['name'] not in categories:
            categories[cat['name']] = {
                'name': cat['name'],
                'icon': cat.get('icon', 'fas fa-folder'),
                'parent': cat.get('parent', '')
            }

    # 批量添加书签
    import_count = 0
    for b in bookmarks_data:
        new_item = {
            'id': int(time.time() * 1000) + import_count,
            'url': b['url'],
            'category': b.get('category', '未分类'),
            'icon': b.get('icon', ''),
            'title': b.get('title', b['url']),
            'description': b.get('description', '')
        }
        bookmarks.append(new_item)
        import_count += 1

    save_data(data)
    return jsonify({'success': True, 'data': data, 'imported': import_count})

@app.route('/fetch-metadata', methods=['POST'])
def fetch_metadata():
    req = request.get_json()
    url = req.get('url', '').strip()
    if not url:
        return jsonify({'success': False, 'message': 'URL不能为空'}), 400

    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url

    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(url, headers=headers, timeout=8)
        resp.encoding = 'utf-8'
        soup = BeautifulSoup(resp.text, 'html.parser')

        title = ''
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
        if not title:
            h1 = soup.find('h1')
            title = h1.get_text().strip() if h1 else ''

        description = ''
        meta_desc = soup.find('meta', attrs={'name': 'description'}) or soup.find('meta', attrs={'property': 'og:description'})
        if meta_desc and meta_desc.get('content'):
            description = meta_desc['content'].strip()

        icon_url = ''
        try:
            favicons = extract_favicon.from_url(url, timeout=5)
            if favicons:
                icon_url = favicons[0].url
        except Exception as e:
            print(f"Favicon error: {e}")

        # 如果没抓到图标，尝试构造域名 /favicon.ico
        if not icon_url:
            try:
                parsed = requests.utils.urlparse(url)
                base_url = f"{parsed.scheme}://{parsed.netloc}"
                icon_url = f"{base_url}/favicon.ico"
            except:
                pass

        return jsonify({
            'success': True,
            'title': title[:200],
            'description': description[:300],
            'icon': icon_url
        })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)