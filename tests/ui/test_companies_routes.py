from __future__ import annotations

from pathlib import Path

from dodaios.ui.web import companies_routes


def test_default_company_state_contains_business_workspaces(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "companies.json"
    monkeypatch.setattr(companies_routes, "_data_file", lambda: path)

    state = companies_routes._read_state()

    assert state.activeCompanyId == "moretto-imoveis"
    assert {company.id for company in state.companies} >= {
        "moretto-imoveis",
        "obras",
        "energia-solar",
        "arquitetura",
    }
    moretto = next(company for company in state.companies if company.id == "moretto-imoveis")
    assert any(member.kind == "gerente" for member in moretto.members)
    assert moretto.tasks == []


def test_company_state_round_trip_is_persistent(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "companies.json"
    monkeypatch.setattr(companies_routes, "_data_file", lambda: path)
    state = companies_routes._default_state()
    state.companies[0].memory.append("Regra operacional persistente")
    state.companies[0].tasks.append(
        companies_routes.CompanyTask(
            id="task-1",
            title="Conferir contrato",
            description="Conferir cláusulas e devolver resumo.",
            assigneeId="contratos",
            departmentId="locacoes",
            status="andamento",
            missionId="mission-1",
        )
    )

    companies_routes._write_state(state)
    restored = companies_routes._read_state()

    assert restored.companies[0].memory[-1] == "Regra operacional persistente"
    assert restored.companies[0].tasks[0].missionId == "mission-1"
    assert path.exists()


def test_empty_saved_state_is_not_reseeded(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "companies.json"
    monkeypatch.setattr(companies_routes, "_data_file", lambda: path)
    state = companies_routes.CompaniesState(companies=[], activeCompanyId=None)

    companies_routes._write_state(state)
    restored = companies_routes._read_state()

    assert restored.companies == []
    assert restored.activeCompanyId is None
