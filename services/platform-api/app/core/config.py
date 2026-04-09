from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "platform-api"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_database_url: str = "sqlite:///./platform_api.db"
    app_jwt_secret: str = "dev-secret-for-platform-api-please-change"
    app_jwt_algorithm: str = "HS256"
    app_cors_origins: list[str] = ["*"]
    app_default_admin_username: str = "admin"
    app_default_admin_password: str = "admin123"
    app_internal_service_token: str = "dev-internal"
    app_bootstrap_default_admin: bool | None = None
    app_bootstrap_sample_data: bool | None = None
    app_minio_endpoint: str | None = None
    app_minio_access_key: str | None = None
    app_minio_secret_key: str | None = None
    app_minio_bucket: str = "knowledge-assets"
    app_minio_secure: bool = False
    app_media_root: str = "./platform_api_media"
    app_database_startup_retries: int = 10
    app_database_startup_retry_delay_seconds: float = 1.5

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def bootstrap_default_admin(self) -> bool:
        if self.app_bootstrap_default_admin is not None:
            return self.app_bootstrap_default_admin
        return not self.is_production

    @property
    def bootstrap_sample_data(self) -> bool:
        if self.app_bootstrap_sample_data is not None:
            return self.app_bootstrap_sample_data
        return not self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()
