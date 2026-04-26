import pytest


@pytest.fixture(autouse=True)
def disable_ratelimit(settings):
    """Disable django-ratelimit for all tests so consecutive runs don't hit the 10/min cap."""
    settings.RATELIMIT_ENABLE = False
