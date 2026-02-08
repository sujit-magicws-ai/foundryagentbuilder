"""
Mock Microservices API — FastAPI app with sample endpoints.

Provides mock APIs for testing Azure AI Foundry OpenApiTool integration.
FastAPI auto-generates the OpenAPI 3.0 spec at /openapi.json.

Endpoints:
    GET /weather?location=Seattle       — mock weather data
    GET /time?timezone=UTC              — current time
    GET /currency?from=USD&to=EUR&amount=100  — mock currency conversion
    GET /joke?category=tech             — random jokes
"""

import json
from datetime import datetime, timezone

from fastapi import FastAPI, Query
from fastapi.openapi.utils import get_openapi

app = FastAPI(
    title="Mock Microservices API",
    description="A collection of mock APIs for building Azure AI Foundry agents.",
    version="1.0.0",
)

def custom_openapi():
    """Override OpenAPI schema to force 3.0.2 for Azure AI Foundry compatibility."""
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    # Force OpenAPI 3.0.2 (Azure Foundry rejects 3.1.0)
    schema["openapi"] = "3.0.2"
    schema["servers"] = [{"url": "https://foundryskill-mock-apis.azurewebsites.net"}]
    # Fix 3.1.0-only constructs: replace anyOf with plain string type in schemas
    for name, sch in schema.get("components", {}).get("schemas", {}).items():
        for prop_name, prop in sch.get("properties", {}).items():
            items = prop.get("items", {})
            if "anyOf" in items:
                items.pop("anyOf")
                items["type"] = "string"
    app.openapi_schema = schema
    return app.openapi_schema

app.openapi = custom_openapi


# ---------------------------------------------------------------------------
# Weather API
# ---------------------------------------------------------------------------

@app.get(
    "/weather",
    summary="Get current weather",
    description="Returns mock weather data for a given city.",
    operation_id="getWeather",
)
def get_weather(
    location: str = Query(..., description="City name, e.g. 'Seattle' or 'Tokyo'"),
):
    weather_data = {
        "seattle": {"temperature": "55F", "condition": "cloudy with light rain", "humidity": "82%"},
        "new york": {"temperature": "68F", "condition": "partly cloudy", "humidity": "60%"},
        "london": {"temperature": "52F", "condition": "overcast", "humidity": "75%"},
        "tokyo": {"temperature": "72F", "condition": "sunny", "humidity": "45%"},
        "mumbai": {"temperature": "88F", "condition": "hot and humid", "humidity": "90%"},
        "sydney": {"temperature": "65F", "condition": "clear skies", "humidity": "55%"},
    }
    key = location.lower().strip()
    if key in weather_data:
        return {"location": location, **weather_data[key]}
    return {"location": location, "error": f"No weather data available for '{location}'"}


# ---------------------------------------------------------------------------
# Time API
# ---------------------------------------------------------------------------

@app.get(
    "/time",
    summary="Get current time",
    description="Returns the current UTC time. The timezone parameter is for display only.",
    operation_id="getTime",
)
def get_time(
    timezone_name: str = Query(
        "UTC", alias="timezone", description="Timezone label, e.g. 'UTC', 'US/Eastern'"
    ),
):
    now = datetime.now(timezone.utc)
    return {
        "timezone": timezone_name,
        "utc_time": now.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "unix_timestamp": int(now.timestamp()),
    }


# ---------------------------------------------------------------------------
# Currency Conversion API
# ---------------------------------------------------------------------------

@app.get(
    "/currency",
    summary="Convert currency",
    description="Returns a mock currency conversion result.",
    operation_id="convertCurrency",
)
def convert_currency(
    source: str = Query(..., alias="from", description="Source currency code, e.g. 'USD'"),
    target: str = Query(..., alias="to", description="Target currency code, e.g. 'EUR'"),
    amount: float = Query(1.0, description="Amount to convert"),
):
    mock_rates = {
        ("USD", "EUR"): 0.92,
        ("EUR", "USD"): 1.09,
        ("USD", "GBP"): 0.79,
        ("GBP", "USD"): 1.27,
        ("USD", "JPY"): 149.50,
        ("JPY", "USD"): 0.0067,
        ("USD", "INR"): 83.25,
        ("INR", "USD"): 0.012,
        ("EUR", "GBP"): 0.86,
        ("GBP", "EUR"): 1.16,
    }
    pair = (source.upper(), target.upper())
    rate = mock_rates.get(pair)
    if rate:
        return {
            "from": source.upper(),
            "to": target.upper(),
            "amount": amount,
            "rate": rate,
            "converted": round(amount * rate, 2),
        }
    return {
        "from": source.upper(),
        "to": target.upper(),
        "amount": amount,
        "error": f"No rate available for {source.upper()} -> {target.upper()}",
    }


# ---------------------------------------------------------------------------
# Jokes API
# ---------------------------------------------------------------------------

@app.get(
    "/joke",
    summary="Get a random joke",
    description="Returns a random joke, optionally filtered by category.",
    operation_id="getJoke",
)
def get_joke(
    category: str = Query(
        "general", description="Joke category: 'tech', 'dad', 'general'"
    ),
):
    jokes = {
        "tech": [
            {"setup": "Why do programmers prefer dark mode?", "punchline": "Because light attracts bugs."},
            {"setup": "What's a programmer's favorite hangout?", "punchline": "Foo Bar."},
        ],
        "dad": [
            {"setup": "Why don't skeletons fight each other?", "punchline": "They don't have the guts."},
            {"setup": "What do you call cheese that isn't yours?", "punchline": "Nacho cheese."},
        ],
        "general": [
            {"setup": "Why don't scientists trust atoms?", "punchline": "Because they make up everything."},
            {"setup": "What do you call a bear with no teeth?", "punchline": "A gummy bear."},
        ],
    }
    import random
    cat = category.lower().strip()
    joke_list = jokes.get(cat, jokes["general"])
    return {"category": cat, **random.choice(joke_list)}
