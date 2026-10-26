"""
Tests for Resource Marketplace endpoints.
Tests enrolled user (testagent2026@gmail.com, paid=true) and non-enrolled access.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SUPABASE_URL = 'https://yuadeybycbfqlkdpxbkv.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30.0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA'

ENROLLED_EMAIL = 'testagent2026@gmail.com'
ENROLLED_PASSWORD = 'TestPass123!'


def get_token(email, password):
    """Get Supabase access token for a user via REST auth."""
    r = requests.post(
        f'{SUPABASE_URL}/auth/v1/token?grant_type=password',
        headers={'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json'},
        json={'email': email, 'password': password},
    )
    if r.status_code == 200:
        return r.json().get('access_token')
    return None


@pytest.fixture(scope='module')
def enrolled_token():
    token = get_token(ENROLLED_EMAIL, ENROLLED_PASSWORD)
    if not token:
        pytest.skip('Could not authenticate enrolled user')
    return token


@pytest.fixture(scope='module')
def enrolled_headers(enrolled_token):
    return {'Authorization': f'Bearer {enrolled_token}', 'Content-Type': 'application/json'}


class TestPublicCatalog:
    """Test public resource catalog"""

    def test_catalog_returns_200(self):
        r = requests.get(f'{BASE_URL}/api/resources')
        assert r.status_code == 200

    def test_catalog_has_items_and_categories(self):
        r = requests.get(f'{BASE_URL}/api/resources')
        data = r.json()
        assert 'items' in data
        assert 'categories' in data

    def test_catalog_has_7_published_resources(self):
        r = requests.get(f'{BASE_URL}/api/resources')
        data = r.json()
        items = data.get('items', [])
        assert len(items) == 7, f'Expected 7 resources, got {len(items)}. Items: {[i.get("title") for i in items]}'

    def test_catalog_resource_fields(self):
        r = requests.get(f'{BASE_URL}/api/resources')
        items = r.json().get('items', [])
        for item in items:
            assert 'id' in item
            assert 'title' in item
            assert item.get('is_published') == True


class TestEnrolledUserLibrary:
    """Test /api/resources/my-library for enrolled user"""

    def test_my_library_returns_200(self, enrolled_headers):
        r = requests.get(f'{BASE_URL}/api/resources/my-library', headers=enrolled_headers)
        assert r.status_code == 200

    def test_my_library_has_access_true(self, enrolled_headers):
        r = requests.get(f'{BASE_URL}/api/resources/my-library', headers=enrolled_headers)
        data = r.json()
        assert data.get('has_access') == True, f'Expected has_access=True, got: {data}'

    def test_my_library_access_type_enrolled(self, enrolled_headers):
        r = requests.get(f'{BASE_URL}/api/resources/my-library', headers=enrolled_headers)
        data = r.json()
        assert data.get('access_type') == 'enrolled'

    def test_my_library_returns_7_resources(self, enrolled_headers):
        r = requests.get(f'{BASE_URL}/api/resources/my-library', headers=enrolled_headers)
        data = r.json()
        resources = data.get('resources', [])
        assert len(resources) == 7, f'Expected 7, got {len(resources)}'

    def test_my_library_requires_auth(self):
        r = requests.get(f'{BASE_URL}/api/resources/my-library')
        assert r.status_code in [401, 403]


class TestEnrolledUserDownload:
    """Test POST /api/resources/{id}/download for enrolled user"""

    def get_first_resource_id(self):
        r = requests.get(f'{BASE_URL}/api/resources')
        items = r.json().get('items', [])
        return items[0]['id'] if items else None

    def test_download_returns_200(self, enrolled_headers):
        resource_id = self.get_first_resource_id()
        if not resource_id:
            pytest.skip('No resources found')
        r = requests.post(f'{BASE_URL}/api/resources/{resource_id}/download', headers=enrolled_headers)
        assert r.status_code == 200

    def test_download_returns_is_sample_true(self, enrolled_headers):
        resource_id = self.get_first_resource_id()
        if not resource_id:
            pytest.skip('No resources found')
        r = requests.post(f'{BASE_URL}/api/resources/{resource_id}/download', headers=enrolled_headers)
        data = r.json()
        # Enrolled users with no uploaded file should get is_sample=True
        assert data.get('is_sample') == True, f'Expected is_sample=True, got: {data}'

    def test_download_url_points_to_sample(self, enrolled_headers):
        resource_id = self.get_first_resource_id()
        if not resource_id:
            pytest.skip('No resources found')
        r = requests.post(f'{BASE_URL}/api/resources/{resource_id}/download', headers=enrolled_headers)
        data = r.json()
        url = data.get('url', '')
        assert f'/api/resources/{resource_id}/sample' in url, f'Expected sample URL, got: {url}'

    def test_download_requires_auth(self):
        resource_id = self.get_first_resource_id()
        if not resource_id:
            pytest.skip('No resources found')
        r = requests.post(f'{BASE_URL}/api/resources/{resource_id}/download')
        assert r.status_code in [401, 403]


class TestSampleCSVDownload:
    """Test GET /api/resources/{id}/sample for enrolled user"""

    def get_first_resource_id(self):
        r = requests.get(f'{BASE_URL}/api/resources')
        items = r.json().get('items', [])
        return items[0]['id'] if items else None

    def test_sample_returns_200(self, enrolled_headers):
        resource_id = self.get_first_resource_id()
        if not resource_id:
            pytest.skip('No resources found')
        r = requests.get(f'{BASE_URL}/api/resources/{resource_id}/sample', headers=enrolled_headers)
        assert r.status_code == 200

    def test_sample_content_type_csv(self, enrolled_headers):
        resource_id = self.get_first_resource_id()
        if not resource_id:
            pytest.skip('No resources found')
        r = requests.get(f'{BASE_URL}/api/resources/{resource_id}/sample', headers=enrolled_headers)
        ct = r.headers.get('content-type', '')
        assert 'text/csv' in ct, f'Expected text/csv, got: {ct}'

    def test_sample_denied_for_unauthenticated(self):
        resource_id = self.get_first_resource_id()
        if not resource_id:
            pytest.skip('No resources found')
        r = requests.get(f'{BASE_URL}/api/resources/{resource_id}/sample')
        assert r.status_code in [401, 403]
