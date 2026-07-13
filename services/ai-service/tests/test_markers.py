import pytest


@pytest.mark.integration
def test_no_external_ai_integration_in_phase_1() -> None:
    pytest.skip("Real provider integration is intentionally deferred to Phase 6")


@pytest.mark.e2e
def test_no_ai_end_to_end_flow_in_phase_1() -> None:
    pytest.skip("No product AI workflow exists in Phase 1")
