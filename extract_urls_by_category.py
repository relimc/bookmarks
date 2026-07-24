import json
import sys

def extract_urls_by_category(json_file_path):
    """
    从 JSON 文件中提取所有书签的 URL，按 category 分组并打印。
    每个类别先显示类别名，然后每行显示一个 URL。
    """
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"错误：文件 '{json_file_path}' 未找到。")
        return
    except json.JSONDecodeError as e:
        print(f"错误：JSON 解析失败 - {e}")
        return

    bookmarks = data.get('bookmarks', [])
    if not bookmarks:
        print("没有找到任何书签。")
        return

    # 按 category 分组
    grouped_urls = {}
    for item in bookmarks:
        category = item.get('category', '未分类')
        url = item.get('url')
        if url:  # 只处理有 url 的条目
            grouped_urls.setdefault(category, []).append(url)

    # 打印结果
    for category, urls in grouped_urls.items():
        print(f"Category: {category}")
        for url in urls:
            print(url)
        print()  # 类别之间空一行

if __name__ == "__main__":
    # 用法：python extract_urls_by_category.py [你的JSON文件路径]
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    else:
        file_path = "bookmarks.json"  # 默认文件名，可按需修改
    extract_urls_by_category(file_path)