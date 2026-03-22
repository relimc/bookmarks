import json
import time
import requests
from bs4 import BeautifulSoup
from flask import Flask, request, jsonify, render_template
from flask_httpauth import HTTPBasicAuth
from urllib.parse import urljoin
import hashlib
import os
import random
from urllib.parse import urlparse

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
            data = json.load(f)
        # 为分类补充 private 字段
        for cat_name, cat in data.get('categories', {}).items():
            if 'private' not in cat:
                cat['private'] = False
        # 为书签补充 private 字段
        for b in data.get('bookmarks', []):
            if 'private' not in b:
                b['private'] = False
        return data
    except:
        return {'bookmarks': [], 'categories': {}}

def download_icon(icon_url):
    """下载图标到本地 static/favicons/，使用URL哈希作为文件名，返回本地路径，失败返回 None"""
    if not icon_url:
        return None
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(icon_url, headers=headers, timeout=5, stream=True)
        if resp.status_code != 200:
            return None

        # 确定文件扩展名
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

        file_hash = hashlib.md5(icon_url.encode('utf-8')).hexdigest()
        filename = f"{file_hash}{ext}"
        filepath = os.path.join(save_dir, filename)

        if os.path.exists(filepath):
            return f"/static/favicons/{filename}"

        with open(filepath, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)

        return f"/static/favicons/{filename}"
    except Exception as e:
        return None

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
    data = load_data()
    # 手动检查认证头
    auth = request.authorization
    if auth and auth.username in users and users[auth.username] == auth.password:
        authenticated = True
        result = data
    else:
        authenticated = False
        # 未登录：返回所有分类，但只返回公开书签
        result = {
            'categories': data['categories'],
            'bookmarks': [b for b in data['bookmarks'] if not b.get('private', False)]
        }

    # 创建响应对象并添加自定义头
    resp = jsonify(result)
    resp.headers['X-Authenticated'] = 'true' if authenticated else 'false'
    resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    resp.headers['Pragma'] = 'no-cache'
    resp.headers['Expires'] = '0'
    return resp

@app.route('/auth_check', methods=['GET'])
@auth.login_required
def auth_check():
    return jsonify({'success': True})

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
    private = req.get('private', False)  # 默认为 False

    tags = req.get('tags', [])  # 默认为空列表
    if not isinstance(tags, list):
        tags = []

    data = load_data()
    bookmarks = data['bookmarks']
    categories = data['categories']

    # 如果分类不存在且提供了分类图标，则创建新分类（默认公开）
    if category and category not in categories and category_icon:
        categories[category] = {
            'name': category,
            'icon': category_icon,
            'parent': parent_category,
            'private': False  # 新增分类默认公开
        }

    # 生成新书签 ID
    new_id = int(time.time() * 1000)
    new_item = {'id': new_id, 'url': url, 'category': category or '未分类', 'icon': icon,
                'title': title or category or '链接', 'description': description, 'private': private, 'tags': tags}

    # 尝试下载图标（仅当是 URL 且不是 base64）
    if icon and not icon.startswith('data:image'):
        local_icon = download_icon(icon)
        if local_icon:
            new_item['icon'] = local_icon

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
                # 如果新分类不存在，则自动创建（默认公开）
                if new_category not in categories:
                    # 获取上级分类（如果有）
                    parent = req.get('parent_category', '').strip() or None
                    categories[new_category] = {
                        'name': new_category,
                        'icon': 'fas fa-folder',
                        'parent': parent,
                        'private': False
                    }
                item['category'] = new_category

            if 'tags' in req:
                if isinstance(req['tags'], list):
                    item['tags'] = req['tags']
                else:
                    # 如果传入的不是列表，忽略或清空
                    item['tags'] = []

            # 更新其他字段
            if 'icon' in req:
                item['icon'] = req['icon'].strip()
            if 'title' in req:
                item['title'] = req['title'].strip() or item['category']
            if 'description' in req:
                item['description'] = req['description'].strip()
            if 'private' in req:
                item['private'] = bool(req['private'])  # 确保布尔值

            save_data(data)
            return jsonify({'success': True, 'data': data})

    return jsonify({'success': False, 'message': '条目不存在'}), 404


@app.route('/delete/<int:item_id>', methods=['POST'])
@auth.login_required
def delete_bookmark(item_id):
    """删除一条收藏，并清理空分类（不删除图标文件）"""
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

    # 删除条目
    new_bookmarks = [item for item in bookmarks if item['id'] != item_id]
    data['bookmarks'] = new_bookmarks

    # 检查该分类是否还有其它书签
    if category:
        other_in_category = any(b['category'] == category for b in new_bookmarks)
        if not other_in_category:
            # 检查该分类是否有子分类
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

        # 安全获取 name
        name_raw = req.get('name')
        name = str(name_raw).strip() if name_raw is not None else ''
        if not name:
            return jsonify({'success': False, 'message': '分类名称不能为空'}), 400

        # 安全获取 icon
        icon_raw = req.get('icon')
        icon = str(icon_raw).strip() if icon_raw is not None else ''
        if not icon:
            icon = 'fas fa-folder'

        # 安全获取 parent
        parent_raw = req.get('parent')
        parent = str(parent_raw).strip() if parent_raw is not None else ''
        if parent == '':
            parent = None

        # 优先级
        priority_raw = req.get('priority', 100)
        try:
            priority = int(priority_raw)
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
    req = request.get_json()
    bookmarks_data = req.get('bookmarks', [])
    categories_data = req.get('categories', [])

    data = load_data()
    bookmarks = data['bookmarks']
    categories = data['categories']

    # 先创建分类
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
        new_id = int(time.time() * 1000) + import_count
        new_item = {
            'id': new_id,
            'url': b['url'],
            'category': b.get('category', '未分类'),
            'icon': b.get('icon', ''),  # 可能是 Base64 或 URL
            'title': b.get('title', b['url']),
            'description': b.get('description', '')
        }
        # 尝试下载图标（仅当图标是 URL 且不是 Base64 时）
        if new_item['icon'] and not new_item['icon'].startswith('data:image'):
            local_icon = download_icon(new_item['icon'])
            if local_icon:
                new_item['icon'] = local_icon
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

# 备用的 User-Agent 列表（当 fake-useragent 不可用时使用）
FALLBACK_UA_LIST = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
]

def get_headers():
    try:
        from fake_useragent import UserAgent
        ua = UserAgent()
        user_agent = ua.random
    except:
        user_agent = random.choice(FALLBACK_UA_LIST)
    headers = {
        'User-Agent': user_agent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',  # 优先中文
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
    }
    return headers

def detect_page_language(soup, headers):
    """检测页面语言，返回语言代码（如 'zh', 'ja', 'en'）或 None"""
    # 1. 从 <html lang> 属性获取
    html_tag = soup.find('html')
    if html_tag and html_tag.get('lang'):
        lang = html_tag['lang'].split('-')[0].lower()
        return lang
    # 2. 从 Content-Language 响应头获取
    content_lang = headers.get('Content-Language', '').split(',')[0].strip().split('-')[0].lower()
    if content_lang:
        return content_lang
    # 3. 从 <meta http-equiv="content-language"> 获取
    meta = soup.find('meta', attrs={'http-equiv': 'content-language'})
    if meta and meta.get('content'):
        lang = meta['content'].split('-')[0].lower()
        return lang
    # 4. 从 <meta name="language"> 获取
    meta_name = soup.find('meta', attrs={'name': 'language'})
    if meta_name and meta_name.get('content'):
        lang = meta_name['content'].split('-')[0].lower()
        return lang
    return None

def find_zh_url(soup, base_url):
    """查找指向中文版本的链接（hreflang="zh"）"""
    # 查找 <link rel="alternate" hreflang="zh" ...>
    links = soup.find_all('link', rel='alternate')
    for link in links:
        hreflang = link.get('hreflang', '').split('-')[0].lower()
        if hreflang == 'zh' and link.get('href'):
            return urljoin(base_url, link['href'])
    # 如果没有hreflang，可以尝试一些常见的中文路径（如 /zh-cn/）
    # 但为避免误判，暂时不添加
    return None

def fetch_single_page(url, retry=1):
    """请求单个页面，返回 (soup, headers) 或 (None, None)"""
    for i in range(retry):
        try:
            time.sleep(random.uniform(1, 3))
            headers = get_headers()
            resp = requests.get(url, headers=headers, timeout=(5, 10))
            resp.encoding = 'utf-8'
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, 'html.parser')
            return soup, resp.headers
        except Exception as e:
            print(f"请求失败 (尝试 {i+1}): {e}")
            if i == retry-1:
                return None, None
    return None, None

def extract_metadata(soup, url):
    """从soup中提取标题、描述、图标"""
    # 标题
    title = ''
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    if not title:
        h1 = soup.find('h1')
        title = h1.get_text().strip() if h1 else ''
    if not title:
        og_title = soup.find('meta', property='og:title')
        if og_title and og_title.get('content'):
            title = og_title['content'].strip()
    if not title:
        twitter_title = soup.find('meta', attrs={'name': 'twitter:title'})
        if twitter_title and twitter_title.get('content'):
            title = twitter_title['content'].strip()

    # 描述
    description = ''
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    if meta_desc and meta_desc.get('content'):
        description = meta_desc['content'].strip()
    if not description:
        og_desc = soup.find('meta', property='og:description')
        if og_desc and og_desc.get('content'):
            description = og_desc['content'].strip()
    if not description:
        twitter_desc = soup.find('meta', attrs={'name': 'twitter:description'})
        if twitter_desc and twitter_desc.get('content'):
            description = twitter_desc['content'].strip()

    # 图标
    icon_url = extract_icon_url(soup, url)  # 复用之前的函数

    return title[:200], description[:300], icon_url

@app.route('/fetch-metadata', methods=['POST'])
def fetch_metadata():
    req = request.get_json()
    url = req.get('url', '').strip()
    if not url:
        return jsonify({'success': False, 'message': 'URL不能为空'}), 400

    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url

    # 第一步：请求原始URL
    soup, headers = fetch_single_page(url)
    if not soup:
        return jsonify({'success': False, 'message': '无法获取页面内容'}), 500

    # 提取元数据
    title, description, icon_url = extract_metadata(soup, url)

    # 检测页面语言
    page_lang = detect_page_language(soup, headers)
    print(f"页面语言: {page_lang}")

    # 如果语言不是中文，尝试查找中文版
    if page_lang and page_lang not in ('zh', 'cn'):  # cn 是旧标准
        zh_url = find_zh_url(soup, url)
        if zh_url:
            # 请求中文版，但避免无限循环（只重试一次）
            zh_soup, zh_headers = fetch_single_page(zh_url)
            if zh_soup:
                zh_title, zh_description, zh_icon = extract_metadata(zh_soup, zh_url)
                # 优先使用中文版的数据，但如果中文版某些字段缺失，则保留原版
                if zh_title:
                    title = zh_title
                if zh_description:
                    description = zh_description
                if zh_icon:
                    icon_url = zh_icon
                # 可以选择在描述后添加提示，表示内容来自中文版
                # if zh_description and description != zh_description:
                #     description += " (来自中文版)"

    return jsonify({
        'success': True,
        'title': title[:200],
        'description': description[:300],
        'icon': icon_url
    })

if __name__ == '__main__':
    app.run(debug=True)