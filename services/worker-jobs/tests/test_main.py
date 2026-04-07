from app.main import main


def test_main_smoke_job() -> None:
    assert main(["--job", "smoke"]) == 0

