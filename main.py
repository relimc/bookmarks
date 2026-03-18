import json
import os
import time
import requests
from bs4 import BeautifulSoup
from flask import Flask, request, jsonify, render_template
from flask_httpauth import HTTPBasicAuth
from urllib.parse import urljoin

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
    try:
        req = request.get_json()
        if not req:
            return jsonify({'success': False, 'message': '无效的请求数据'}), 400

        # 获取并验证 name
        name = req.get('name')
        if not name or not isinstance(name, str):
            return jsonify({'success': False, 'message': '分类名称必须为字符串'}), 400
        name = name.strip()
        if not name:
            return jsonify({'success': False, 'message': '分类名称不能为空'}), 400

        # 处理图标
        icon = req.get('icon')
        if icon is None or not isinstance(icon, str):
            icon = 'fas fa-folder'
        else:
            icon = icon.strip() or 'fas fa-folder'

        # 处理上级分类
        parent = req.get('parent')
        if parent is None or not isinstance(parent, str):
            parent = None
        else:
            parent = parent.strip() or None

        # 处理优先级
        priority = req.get('priority')
        if priority is None:
            priority = 100
        else:
            try:
                priority = int(priority)
            except (ValueError, TypeError):
                priority = 100

        data = load_data()
        categories = data['categories']

        if name in categories:
            return jsonify({'success': False, 'message': '分类已存在'}), 400

        categories[name] = {
            'name': name,
            'icon': icon,
            'parent': parent,
            'priority': priority
        }
        save_data(data)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        print(f"Error in add_category: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': '服务器内部错误'}), 500


@app.route('/category/<string:name>', methods=['PUT'])
@auth.login_required
def update_category(name):
    req = request.get_json()
    data = load_data()
    categories = data['categories']
    bookmarks = data['bookmarks']

    if name not in categories:
        return jsonify({'success': False, 'message': '分类不存在'}), 404

    new_name = req.get('new_name', '').strip()
    icon = req.get('icon', '').strip()
    parent = req.get('parent', '').strip() or None
    priority = req.get('priority')
    if priority is not None:
        try:
            priority = int(priority)
        except:
            priority = None

    # 如果修改了分类名称
    if new_name and new_name != name:
        if new_name in categories:
            return jsonify({'success': False, 'message': '新分类名称已存在'}), 400
        categories[new_name] = categories.pop(name)
        categories[new_name]['name'] = new_name
        for b in bookmarks:
            if b['category'] == name:
                b['category'] = new_name
        for cat in categories.values():
            if cat.get('parent') == name:
                cat['parent'] = new_name
        name = new_name

    # 更新字段
    if icon:
        categories[name]['icon'] = icon
    if 'parent' in req:
        categories[name]['parent'] = parent
    if priority is not None:
        categories[name]['priority'] = priority

    save_data(data)
    return jsonify({'success': True, 'data': data})


@app.route('/category/<string:name>', methods=['DELETE'])
@auth.login_required
def delete_category(name):
    """强制删除分类及其所有子分类和下属书签"""
    data = load_data()
    categories = data['categories']
    bookmarks = data['bookmarks']

    if name not in categories:
        return jsonify({'success': False, 'message': '分类不存在'}), 404

    # 递归收集所有要删除的分类（包括自身）
    def collect_categories(cat_name, collected):
        collected.add(cat_name)
        # 查找子分类
        for c_name, c_info in categories.items():
            if c_info.get('parent') == cat_name:
                collect_categories(c_name, collected)

    to_delete = set()
    collect_categories(name, to_delete)

    # 删除所有相关的书签
    new_bookmarks = [b for b in bookmarks if b['category'] not in to_delete]
    data['bookmarks'] = new_bookmarks

    # 删除所有相关分类
    for cat in to_delete:
        if cat in categories:
            del categories[cat]

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

def extract_icon_url(soup, base_url):
    """
    从BeautifulSoup对象中提取最合适的图标URL
    优先级：link[rel="icon"] > link[rel="shortcut icon"] > link[rel="apple-touch-icon"] > meta[property="og:image"] > 域名/favicon.ico
    """
    # 候选链接列表
    candidates = []

    # 1. 查找所有 <link rel="icon"> 或 <link rel="shortcut icon">
    for link in soup.find_all('link', rel=lambda x: x and ('icon' in x.lower() or 'shortcut icon' in x.lower())):
        href = link.get('href')
        if href:
            # 处理相对路径
            full_url = urljoin(base_url, href)
            candidates.append(full_url)

    # 2. 查找 apple-touch-icon（常用于移动端）
    for link in soup.find_all('link', rel=lambda x: x and 'apple-touch-icon' in x.lower()):
        href = link.get('href')
        if href:
            full_url = urljoin(base_url, href)
            candidates.append(full_url)

    # 3. 查找 Open Graph 图片（有些网站用 og:image 作为分享图标，可能不是标准图标，但可作后备）
    og_image = soup.find('meta', property='og:image')
    if og_image and og_image.get('content'):
        full_url = urljoin(base_url, og_image['content'])
        candidates.append(full_url)

    # 4. 如果以上都没找到，尝试构造域名下的 /favicon.ico
    if not candidates:
        # 解析域名
        from urllib.parse import urlparse
        parsed = urlparse(base_url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        candidates.append(f"{base}/favicon.ico")

    # 返回第一个候选（可根据需要调整优先级，如选择 .ico 优先于 .svg 等，但简单起见返回第一个）
    # 注意：有些网站可能有多个图标，我们可以选择第一个，或者按文件类型偏好排序
    # 这里简单返回第一个
    return candidates[0] if candidates else ''

@app.route('/fetch-metadata', methods=['POST'])
def fetch_metadata():
    """接收URL，返回网页的标题、描述和图标（支持多种格式）"""
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

        # 获取标题
        title = ''
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
        if not title:
            h1 = soup.find('h1')
            title = h1.get_text().strip() if h1 else ''

        # 获取描述
        description = ''
        meta_desc = soup.find('meta', attrs={'name': 'description'}) or soup.find('meta', attrs={'property': 'og:description'})
        if meta_desc and meta_desc.get('content'):
            description = meta_desc['content'].strip()

        # 获取图标（增强版）
        icon_url = extract_icon_url(soup, url)

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