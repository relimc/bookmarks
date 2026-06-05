from flask import Blueprint, render_template, current_app
from flask import session, redirect, request, url_for

bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    return render_template('local.html',
        title_id='localTitle',
        title_text='我的书签',
        badge_id='localBadge',
        badge_text='本地版',
        badge_key='local_version'  # 新增
    )

@bp.route('/plus')
def plus():
    return render_template('plus.html',
        title_id='enhancedTitle',
        title_text='我的书签',
        badge_id='enhancedBadge',
        badge_text='增强版',
        badge_key = 'enhanced_version'  # 新增
    )

@bp.route('/lang/<lang>')
def set_lang(lang):
    """切换语言"""
    if lang in current_app.config['LANGUAGES']:
        session['lang'] = lang
    return redirect(request.referrer or url_for('main.index'))