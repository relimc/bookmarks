from flask import Blueprint, render_template

bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    return render_template('local.html',
        title_id='localTitle',
        title_text='我的书签',
        badge_id='localBadge',
        badge_text='本地版'
    )

@bp.route('/online')
def online():
    return render_template('online.html',
        title_id='enhancedTitle',
        title_text='我的书签',
        badge_id='enhancedBadge',
        badge_text='增强版'
    )