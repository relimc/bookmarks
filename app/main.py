from flask import Blueprint, render_template, current_app
from flask import session, redirect, request, url_for

bp = Blueprint('main', __name__)


@bp.route('/')
def index():
    host = request.headers.get('Host', '').split(':')[0]

    # 本地开发时，可以通过 URL 参数强制切换版本
    version = request.args.get('version', '')
    if version == 'plus':
        return render_template('plus.html',
                               title_id='enhancedTitle',
                               title_text='我的书签',
                               badge_id='enhancedBadge',
                               badge_text='增强版',
                               badge_key='enhanced_version'
                               )
    if version == 'local':
        return render_template('local.html',
                               title_id='localTitle',
                               title_text='我的书签',
                               badge_id='localBadge',
                               badge_text='本地版',
                               badge_key='local_version'
                               )

    # 根据域名判断
    if host == current_app.config.get('PLUS_DOMAIN', 'navplus.toadlive.top'):
        return render_template('plus.html',
                               title_id='enhancedTitle',
                               title_text='我的书签',
                               badge_id='enhancedBadge',
                               badge_text='增强版',
                               badge_key='enhanced_version'
                               )

    # 默认返回本地版
    return render_template('local.html',
                           title_id='localTitle',
                           title_text='我的书签',
                           badge_id='localBadge',
                           badge_text='本地版',
                           badge_key='local_version'
                           )


@bp.route('/plus')
def plus():
    # 兼容 /plus 路径，方便本地开发
    return render_template('plus.html',
                           title_id='enhancedTitle',
                           title_text='我的书签',
                           badge_id='enhancedBadge',
                           badge_text='增强版',
                           badge_key='enhanced_version'
                           )


@bp.route('/lang/<lang>')
def set_lang(lang):
    """切换语言"""
    if lang in current_app.config['LANGUAGES']:
        session['lang'] = lang
    return redirect(request.referrer or url_for('main.index'))