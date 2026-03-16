import json
import os
import time
import requests
from bs4 import BeautifulSoup
import extract_favicon
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)
DATA_FILE = 'data/data.json'


def load_data():
    if not os.path.exists(DATA_FILE):
        return {'bookmarks': [], 'categories': {}}
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {'bookmarks': [], 'categories': {}}


def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/list')
def list_bookmarks():
    data = load_data()
    return jsonify(data)


@app.route('/add', methods=['POST'])
def add_bookmark():
    req = request.get_json()
    url = req.get('url', '').strip()
    if not url:
        return jsonify({'success': False, 'message': 'URL 不能为空'}), 400

    category = req.get('category', '').strip()
    category_icon = req.get('category_icon', '')  # 新增分类时传入的图标
    parent_category = req.get('parent_category', '').strip()
    title = req.get('title', '').strip()
    description = req.get('description', '').strip()
    icon = req.get('icon', '').strip()  # 网址自己的图标

    data = load_data()
    bookmarks = data['bookmarks']
    categories = data['categories']

    # 如果分类不存在且提供了分类图标，则创建新分类
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
        'icon': icon or '',  # 网址图标，优先抓取
        'title': title or category or '链接',
        'description': description
    }
    bookmarks.append(new_item)
    save_data(data)

    return jsonify({'success': True, 'data': data})


@app.route('/edit/<int:item_id>', methods=['POST'])
def edit_bookmark(item_id):
    req = request.get_json()
    data = load_data()
    bookmarks = data['bookmarks']

    for item in bookmarks:
        if item['id'] == item_id:
            if 'category' in req:
                item['category'] = req['category'].strip() or '未分类'
            if 'icon' in req:
                item['icon'] = req['icon'].strip()
            if 'title' in req:
                item['title'] = req['title'].strip() or item['category']
            if 'description' in req:
                item['description'] = req['description'].strip()
            # 注意：编辑时不修改分类图标，分类图标需通过分类管理界面修改（暂未实现）
            save_data(data)
            return jsonify({'success': True, 'data': data})

    return jsonify({'success': False, 'message': '条目不存在'}), 404


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

        return jsonify({
            'success': True,
            'title': title[:200],
            'description': description[:300],
            'icon': icon_url
        })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/delete/<int:item_id>', methods=['POST'])
def delete_bookmark(item_id):
    """删除一条收藏，并清理空分类"""
    data = load_data()
    bookmarks = data['bookmarks']
    categories = data['categories']

    # 找到要删除的条目
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
        # 查找是否还有其它书签属于该分类
        other_in_category = any(b['category'] == category for b in new_bookmarks)
        if not other_in_category:
            # 没有其它书签，检查该分类是否有子分类（即是否有其他分类的 parent 指向它）
            has_children = any(cat.get('parent') == category for cat in categories.values())
            if not has_children:
                # 无子分类且无书签，删除该分类
                if category in categories:
                    del categories[category]

    save_data(data)
    return jsonify({'success': True, 'data': data})


@app.route('/add_category', methods=['POST'])
def add_category():
    """单独创建分类（不关联网址）"""
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


if __name__ == '__main__':
    app.run(debug=True)