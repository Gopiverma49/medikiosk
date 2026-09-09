"""
Cross-dialect UUID column type.

Production (docker-compose.yml) always runs PostgreSQL, where this stores a
native UUID. The test suite (backend/tests/) runs against in-memory SQLite for
speed/portability, where this transparently falls back to CHAR(36). Business
code never needs to know the difference — it always deals with plain strings.
"""
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


class GUID(TypeDecorator):
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=False))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return str(value)
