import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import DeclarativeBase

DB_USER = os.getenv("POSTGRES_USER", "table_tennis_user")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "table_tennis_password")
DB_HOST = os.getenv("DB_HOST", "table-tennis-db")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "table_tennis")

DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)

def get_engine():
    global engine
    return engine

class Base(DeclarativeBase):
    pass

__all__ = ["get_engine"]