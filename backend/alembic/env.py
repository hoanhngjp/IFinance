import sys
import os
from logging.config import fileConfig

# 1. Khai báo đường dẫn gốc để Python hiểu được thư mục 'app'
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# 2. Import dotenv và các thư viện từ project của bạn
from dotenv import load_dotenv
from app.db.database import Base
from app.models import * # Bắt buộc phải import dòng này để Alembic quét qua các bảng

# 3. Load cấu hình từ file .env
load_dotenv()

config = context.config

db_url = os.getenv("DATABASE_URL")
if db_url:
    # Nhân đôi dấu % (ví dụ %40 thành %%40) để configparser không bị lỗi
    db_url = db_url.replace("%", "%%")

# 4. Ghi đè URL kết nối Database bằng biến db_url đã xử lý
config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 5. Chỉ định metadata để Alembic biết đối chiếu code với DB
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()