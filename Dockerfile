# 使用官方 Python 3.10 镜像作为基础
FROM python:3.10-slim

# 设置工作目录
WORKDIR /app

# 复制依赖文件并安装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制项目文件
COPY . .

# 暴露端口（Flask 默认 5000，但 gunicorn 可以使用其他端口）
EXPOSE 5000

# 使用 gunicorn 运行应用，绑定 0.0.0.0 允许外部访问
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "main:app"]