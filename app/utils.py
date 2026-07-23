import os
import random
import string
import threading

import requests
from urllib.parse import urljoin, urlparse
from flask_mail import Message
from . import mail
from flask import current_app
from flask_login import current_user

import os
import hashlib
import requests
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

def download_icon(icon_url):
    if not icon_url:
        logger.info("download_icon: icon_url 为空，返回 None")
        return None

    # 如果是 data: 协议，直接返回 None（无需下载）
    if icon_url.startswith('data:') or icon_url.startswith('data:image'):
        logger.info(f"download_icon: 跳过 data: 图标，返回 None")
        return None

    logger.info(f"download_icon: 尝试下载 {icon_url}")

    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(icon_url, headers=headers, timeout=5, stream=True)
        if resp.status_code != 200:
            logger.warning(f"download_icon: 下载失败，HTTP 状态码 {resp.status_code}")
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
            ext = os.path.splitext(parsed.path)[1]
            if not ext:
                ext = '.ico'

        save_dir = os.path.join('static', 'favicons')
        os.makedirs(save_dir, exist_ok=True)

        file_hash = hashlib.md5(icon_url.encode('utf-8')).hexdigest()
        filename = f"{file_hash}{ext}"
        filepath = os.path.join(save_dir, filename)

        if os.path.exists(filepath):
            logger.info(f"download_icon: 文件已存在，直接使用缓存: {filepath}")
            return f"/static/favicons/{filename}"

        with open(filepath, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)

        logger.info(f"download_icon: 下载成功，保存至 {filepath}")
        return f"/static/favicons/{filename}"

    except Exception as e:
        logger.error(f"download_icon: 下载失败 ({icon_url}): {e}")
        return None

def get_headers():
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    ]
    return {
        'User-Agent': random.choice(user_agents),
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    }

def generate_verification_code(length=6):
    return ''.join(random.choices(string.digits, k=length))

def send_verification_email(email, code):
    subject = "【书签导航】邮箱验证码"
    body = f"您的验证码是：{code}，有效期10分钟。请勿泄露给他人。"
    msg = Message(subject, recipients=[email], body=body)
    try:
        mail.send(msg)
        return True
    except Exception as e:
        print(f"邮件发送失败: {e}")
        return False

def extract_icon_url(soup, base_url):
    """
    从 BeautifulSoup 对象中提取最佳图标 URL，按优先级：
    1. 优先选择 type 为 image/svg+xml 或 image/png
    2. 其次选择 sizes 包含 'any' 或数字较大的（如 64x64）
    3. 最后选择第一个可用的图标
    """
    candidates = []
    for link in soup.find_all('link', rel=lambda x: x and ('icon' in x.lower() or 'shortcut icon' in x.lower())):
        href = link.get('href')
        if not href:
            continue
        # 解析属性
        icon_type = link.get('type', '').lower()
        sizes = link.get('sizes', '').lower()
        href = urljoin(base_url, href)
        candidates.append({
            'href': href,
            'type': icon_type,
            'sizes': sizes,
            'priority': 0
        })

    if not candidates:
        # 没有找到任何图标，返回默认 favicon.ico
        parsed = urlparse(base_url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        return f"{base}/favicon.ico"

    # 根据类型和尺寸分配优先级
    def get_priority(c):
        p = 0
        # 优先 SVG
        if 'svg' in c['type']:
            p += 100
        # 其次 PNG
        elif 'png' in c['type']:
            p += 80
        # 再次 ICO
        elif 'icon' in c['type'] or 'x-icon' in c['type']:
            p += 60
        # 其他类型
        else:
            p += 40
        # 如果 sizes 包含 'any'，加分
        if 'any' in c['sizes']:
            p += 50
        # 如果 sizes 包含数字，尝试解析尺寸
        if 'x' in c['sizes'] and not c['sizes'].startswith('any'):
            try:
                w, h = c['sizes'].split('x')
                size = int(w) * int(h)
                # 尺寸越大，优先级越高（但避免过大，限制）
                if size > 0:
                    p += min(size // 100, 20)
            except:
                pass
        return p

    # 按优先级排序
    candidates.sort(key=get_priority, reverse=True)
    # 返回最高优先级的 URL
    return candidates[0]['href']

def send_review_result_email(user_email, bookmark_title, is_approved):
    """发送审核结果通知邮件"""
    subject = "【书签导航】书签审核结果通知"
    status = "已通过" if is_approved else "已被拒绝"
    if is_approved:
        body = f"您好，您提交的书签《{bookmark_title}》已通过管理员审核，现在可以在网站首页看到啦。感谢您的分享！"
    else:
        body = f"您好，您提交的书签《{bookmark_title}》未通过审核。如有疑问，请联系管理员。"
    msg = Message(subject, recipients=[user_email], body=body)
    try:
        mail.send(msg)
        return True
    except Exception as e:
        print(f"发送审核邮件失败: {e}")
        return False

def is_admin_user(user=None):
    if user is None:
        user = current_user
    if not user.is_authenticated:
        return False
    admin_list = current_app.config.get('ADMIN_USERS', [])
    return user.username in admin_list