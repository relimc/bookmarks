import os
import random
import string
import hashlib
import requests
from urllib.parse import urljoin, urlparse
from flask_mail import Message
from . import mail

def download_icon(icon_url):
    if not icon_url:
        return None
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(icon_url, headers=headers, timeout=5, stream=True)
        if resp.status_code != 200:
            return None
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
        if not os.path.exists(filepath):
            with open(filepath, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
        return f"/static/favicons/{filename}"
    except Exception as e:
        print(f"下载图标失败: {e}")
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