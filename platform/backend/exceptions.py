"""Custom exception hierarchy and global error handlers."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        detail: str,
        status_code: int = 500,
        error_code: str = "INTERNAL_ERROR",
    ):
        self.detail = detail
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(detail)


class NotFoundError(AppException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(detail=detail, status_code=404, error_code="NOT_FOUND")


class ValidationError(AppException):
    def __init__(self, detail: str = "Validation failed"):
        super().__init__(detail=detail, status_code=422, error_code="VALIDATION_ERROR")


class AzureServiceError(AppException):
    def __init__(self, detail: str = "Azure service error"):
        super().__init__(detail=detail, status_code=502, error_code="AZURE_SERVICE_ERROR")


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers on the FastAPI app."""

    @app.exception_handler(AppException)
    def handle_app_exception(_request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.error_code, "message": exc.detail}},
        )

    @app.exception_handler(Exception)
    def handle_generic_exception(_request: Request, exc: Exception) -> JSONResponse:
        import logging
        logging.getLogger(__name__).error("Unhandled exception: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "INTERNAL_ERROR", "message": str(exc)}},
        )
