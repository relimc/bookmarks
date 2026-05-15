FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 暴露端口（Flask 默认 5000，但 gunicorn 可以使用其他端口）
EXPOSE 5000

# 使用 gunicorn 启动（假设入口是 app:create_app() 的实例）
# 这里需要根据实际项目调整。如果是使用 run.py 中的 app，则 WSGI 应用名为 app。
# 常见写法：from app import create_app; app = create_app()
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "run:app"]