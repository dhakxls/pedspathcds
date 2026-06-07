from __future__ import annotations

from datetime import timedelta
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.main import (
    SMART_ACCESS_TOKEN_TTL_SECONDS,
    SMART_PATIENT_ID,
    _issued_access_tokens,
    _issued_refresh_tokens,
    _utcnow,
    app,
)

client = TestClient(app)


def test_smart_configuration_exposes_required_fields():
    response = client.get("/smart/.well-known/smart-configuration")
    assert response.status_code == 200
    payload = response.json()

    required_keys = {
        "issuer",
        "authorization_endpoint",
        "token_endpoint",
        "registration_endpoint",
        "management_endpoint",
        "response_types_supported",
        "grant_types_supported",
        "scopes_supported",
        "capabilities",
        "token_endpoint_auth_methods_supported",
    }
    assert required_keys.issubset(payload.keys())
    assert payload["issuer"].endswith("/smart")
    assert payload["response_types_supported"] == ["code"]
    assert "authorization_code" in payload["grant_types_supported"]
    assert "refresh_token" in payload["grant_types_supported"]
    assert "launch" in payload["scopes_supported"]


def test_smart_authorize_and_token_flow():
    params = {
        "response_type": "code",
        "client_id": "peds-path-demo-client",
        "redirect_uri": "https://example.org/smart-redirect",
        "scope": "launch patient/*.read",
        "state": "xyz",
    }
    authorize = client.get("/smart/authorize", params=params, follow_redirects=False)
    assert authorize.status_code == 302
    redirected = urlparse(authorize.headers["location"])
    assert redirected.geturl().startswith(params["redirect_uri"])
    query = parse_qs(redirected.query)
    assert query.get("state") == ["xyz"]
    code = query["code"][0]

    token = client.post(
        "/smart/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": params["redirect_uri"],
            "client_id": params["client_id"],
        },
    )
    assert token.status_code == 200
    body = token.json()
    assert body["token_type"] == "Bearer"
    assert body["patient"] == SMART_PATIENT_ID
    assert body["scope"] == params["scope"]
    assert body["expires_in"] == SMART_ACCESS_TOKEN_TTL_SECONDS

    context = client.get("/smart/context", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert context.status_code == 200
    ctx_payload = context.json()
    assert ctx_payload["patient"]["patient_id"] == SMART_PATIENT_ID
    assert ctx_payload["bundle"]["patient"]["id"] == SMART_PATIENT_ID

    # code cannot be reused
    replay = client.post(
        "/smart/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": params["redirect_uri"],
            "client_id": params["client_id"],
        },
    )
    assert replay.status_code == 400


def test_access_token_expiration_enforced():
    params = {
        "response_type": "code",
        "client_id": "peds-path-demo-client",
        "redirect_uri": "https://example.org/smart-redirect",
        "scope": "launch patient/*.read",
    }
    authorize = client.get("/smart/authorize", params=params, follow_redirects=False)
    code = parse_qs(urlparse(authorize.headers["location"]).query)["code"][0]
    token = client.post(
        "/smart/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": params["redirect_uri"],
            "client_id": params["client_id"],
        },
    )
    payload = token.json()

    # force expiration
    _issued_access_tokens[payload["access_token"]]["expires_at"] = _utcnow() - timedelta(seconds=1)

    context = client.get(
        "/smart/context",
        headers={"Authorization": f"Bearer {payload['access_token']}"},
    )
    assert context.status_code == 401


def test_refresh_token_expiration_enforced():
    params = {
        "response_type": "code",
        "client_id": "peds-path-demo-client",
        "redirect_uri": "https://example.org/smart-redirect",
        "scope": "launch patient/*.read",
    }
    authorize = client.get("/smart/authorize", params=params, follow_redirects=False)
    code = parse_qs(urlparse(authorize.headers["location"]).query)["code"][0]
    token = client.post(
        "/smart/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": params["redirect_uri"],
            "client_id": params["client_id"],
        },
    )
    refresh_token_value = token.json()["refresh_token"]

    _issued_refresh_tokens[refresh_token_value]["expires_at"] = _utcnow() - timedelta(seconds=1)

    refresh = client.post(
        "/smart/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token_value,
            "client_id": params["client_id"],
        },
    )
    assert refresh.status_code == 400


def test_smart_authorize_custom_patient():
    custom_patient = "SYN-002"
    params = {
        "response_type": "code",
        "client_id": "peds-path-demo-client",
        "redirect_uri": "https://example.org/smart-redirect",
        "scope": "launch patient/*.read",
        "smart_patient_id": custom_patient,
    }
    authorize = client.get("/smart/authorize", params=params, follow_redirects=False)
    assert authorize.status_code == 302
    code = parse_qs(urlparse(authorize.headers["location"]).query)["code"][0]

    token = client.post(
        "/smart/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": params["redirect_uri"],
            "client_id": params["client_id"],
        },
    )
    assert token.status_code == 200
    body = token.json()
    assert body["patient"] == custom_patient

    context = client.get("/smart/context", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert context.status_code == 200
    ctx_payload = context.json()
    assert ctx_payload["patient"]["patient_id"] == custom_patient


def test_smart_refresh_token_grant():
    params = {
        "response_type": "code",
        "client_id": "peds-path-demo-client",
        "redirect_uri": "https://example.org/smart-redirect",
        "scope": "launch patient/*.read",
    }
    authorize = client.get("/smart/authorize", params=params, follow_redirects=False)
    code = parse_qs(urlparse(authorize.headers["location"]).query)["code"][0]

    token = client.post(
        "/smart/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": params["redirect_uri"],
            "client_id": params["client_id"],
        },
    )
    first_payload = token.json()

    refresh = client.post(
        "/smart/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": first_payload["refresh_token"],
            "client_id": params["client_id"],
        },
    )
    assert refresh.status_code == 200
    refresh_body = refresh.json()
    assert refresh_body["patient"] == first_payload["patient"]
    assert refresh_body["scope"] == params["scope"]
    assert refresh_body["access_token"] != first_payload["access_token"]
    assert refresh_body["expires_in"] == SMART_ACCESS_TOKEN_TTL_SECONDS

    context = client.get(
        "/smart/context",
        headers={"Authorization": f"Bearer {refresh_body['access_token']}"},
    )
    assert context.status_code == 200
    assert context.json()["patient"]["patient_id"] == refresh_body["patient"]


def test_refresh_token_cannot_be_reused():
    params = {
        "response_type": "code",
        "client_id": "peds-path-demo-client",
        "redirect_uri": "https://example.org/smart-redirect",
        "scope": "launch patient/*.read",
    }
    authorize = client.get("/smart/authorize", params=params, follow_redirects=False)
    code = parse_qs(urlparse(authorize.headers["location"]).query)["code"][0]
    token = client.post(
        "/smart/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": params["redirect_uri"],
            "client_id": params["client_id"],
        },
    )
    refresh_token_value = token.json()["refresh_token"]

    refresh = client.post(
        "/smart/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token_value,
            "client_id": params["client_id"],
        },
    )
    assert refresh.status_code == 200

    replay = client.post(
        "/smart/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token_value,
            "client_id": params["client_id"],
        },
    )
    assert replay.status_code == 400
