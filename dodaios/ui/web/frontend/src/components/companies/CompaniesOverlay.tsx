import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleUserRound,
  FileText,
  FolderKanban,
  Gauge,
  HardDrive,
  LoaderCircle,
  MemoryStick,
  Network,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Users,
  Workflow,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

type AgentStatus = "livre" | "trabalhando" | "aguardando" | "erro";
type TaskStatus = "pendente" | "andamento" | "aguardando" | "concluida" | "erro";
type CompanyTab =
  | "overview"
  | "building"
  | "departments"
  | "team"
  | "tasks"
  | "projects"
  | "clients"
  | "files"
  | "automations"
  | "indicators"
  | "memory";

interface CompanyDepartment {
  id: string;
  name: string;
  floor: number;
  mission: string;
}

interface CompanyMember {
  id: string;
  name: string;
  role: string;
  departmentId: string;
  kind: "gerente" | "especialista" | "funcionario";
  status: AgentStatus;
  model: string;
  autonomy: "assistido" | "semi-autonomo" | "autonomo";
  currentTask?: string | null;
  missionId?: string | null;
}

interface CompanyTask {
  id: string;
  title: string;
  description: string;
  assigneeId?: string | null;
  departmentId?: string | null;
  status: TaskStatus;
  missionId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface CompanyProject {
  id: string;
  name: string;
  status: "planejado" | "andamento" | "aguardando" | "concluido";
  owner: string;
}

interface CompanyWorkspace {
  id: string;
  name: string;
  segment: string;
  description: string;
  departments: CompanyDepartment[];
  members: CompanyMember[];
  tasks: CompanyTask[];
  projects: CompanyProject[];
  clients: string[];
  files: string[];
  automations: string[];
  memory: string[];
}

interface CompaniesState {
  companies: CompanyWorkspace[];
  activeCompanyId: string | null;
  version: number;
}

const LEGACY_STORAGE_KEY = "jarvis.companies.v1";
const API = "/api/companies";
const MISSION_API = "/api/missions";

const tabs: Array<{ id: CompanyTab; label: string; icon: typeof Building2 }> = [
  { id: "overview", label: "Visão geral", icon: Gauge },
  { id: "building", label: "Prédio", icon: Building2 },
  { id: "departments", label: "Departamentos", icon: Network },
  { id: "team", label: "Equipe", icon: Users },
  { id: "tasks", label: "Tarefas", icon: CheckCircle2 },
  { id: "projects", label: "Projetos", icon: FolderKanban },
  { id: "clients", label: "Clientes", icon: BriefcaseBusiness },
  { id: "files", label: "Arquivos", icon: HardDrive },
  { id: "automations", label: "Automações", icon: Workflow },
  { id: "indicators", label: "Indicadores", icon: BarChart3 },
  { id: "memory", label: "Memória", icon: MemoryStick },
];

const statusLabel: Record<AgentStatus, string> = {
  livre: "Livre",
  trabalhando: "Trabalhando",
  aguardando: "Aguardando",
  erro: "Erro",
};

const taskLabel: Record<TaskStatus, string> = {
  pendente: "Pendente",
  andamento: "Em andamento",
  aguardando: "Aguardando",
  concluida: "Concluída",
  erro: "Erro",
};

function statusClass(status: AgentStatus | TaskStatus): string {
  if (status === "trabalhando" || status === "andamento") return "border-success/30 bg-success/15 text-success";
  if (status === "erro") return "border-destructive/30 bg-destructive/15 text-destructive";
  if (status === "aguardando") return "border-warning/30 bg-warning/15 text-warning";
  if (status === "concluida") return "border-primary/30 bg-primary/10 text-primary";
  return "border-border bg-secondary text-muted-foreground";
}

function promptText(label: string, initial = ""): string | null {
  const value = window.prompt(label, initial);
  if (value === null) return null;
  const next = value.trim();
  return next || null;
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : `HTTP ${response.status}`;
    const error = new Error(detail) as Error & { status?: number; payload?: unknown };
    error.status = response.status;
    error.payload = body;
    throw error;
  }
  return body as T;
}

export function CompaniesOverlayHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-3 z-[70] inline-flex h-10 items-center gap-2 rounded-xl border border-primary/30 bg-card/95 px-3 text-xs font-semibold text-foreground shadow-xl backdrop-blur hover:bg-secondary"
        title="Empresas"
        aria-label="Abrir Empresas"
        data-testid="companies-launcher"
      >
        <Building2 className="h-4 w-4 text-primary" />
        <span className="hidden min-[900px]:inline">Empresas</span>
      </button>
      {open && <CompaniesWorkspace onClose={() => setOpen(false)} />}
    </>
  );
}

function CompaniesWorkspace({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<CompaniesState>({ companies: [], activeCompanyId: null, version: 2 });
  const [tab, setTab] = useState<CompanyTab>("overview");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const saveTimer = useRef<number | null>(null);
  const hydrated = useRef(false);

  const active = state.companies.find((company) => company.id === state.activeCompanyId) ?? state.companies[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const remote = await jsonRequest<CompaniesState>(API);
      const normalized = {
        ...remote,
        companies: remote.companies.map((company) => ({ ...company, tasks: company.tasks ?? [] })),
      };
      setState(normalized);
      setSyncedAt(new Date());
      hydrated.current = true;
      try {
        const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy && remote.version < 2) window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // Legacy local storage is optional.
      }
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Não foi possível carregar as empresas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const persist = useCallback(async (next: CompaniesState) => {
    setSaving(true);
    try {
      const saved = await jsonRequest<CompaniesState & { ok: boolean }>(API, {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setSyncedAt(new Date());
      setError(null);
      if (saved.activeCompanyId !== next.activeCompanyId) {
        setState((current) => ({ ...current, activeCompanyId: saved.activeCompanyId }));
      }
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Falha ao salvar as empresas.");
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated.current || loading) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void persist(state), 450);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state, loading, persist]);

  const updateActive = useCallback((mutate: (company: CompanyWorkspace) => CompanyWorkspace) => {
    if (!active) return;
    setState((current) => ({
      ...current,
      companies: current.companies.map((company) => (company.id === active.id ? mutate(company) : company)),
    }));
  }, [active]);

  const setActive = (companyId: string) => {
    setState((current) => ({ ...current, activeCompanyId: companyId }));
    setTab("overview");
  };

  const addCompany = async () => {
    const name = promptText("Nome da empresa");
    if (!name) return;
    const segment = promptText("Segmento da empresa", "Empresa") ?? "Empresa";
    try {
      const company = await jsonRequest<CompanyWorkspace>(API, {
        method: "POST",
        body: JSON.stringify({ name, segment, description: "Novo workspace empresarial." }),
      });
      hydrated.current = false;
      await load();
      setState((current) => ({ ...current, activeCompanyId: company.id }));
      hydrated.current = true;
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Não foi possível criar a empresa.");
    }
  };

  const addDepartment = () => {
    if (!active) return;
    const name = promptText("Nome do departamento");
    if (!name) return;
    const floorText = promptText("Andar", String(active.departments.length + 1));
    const floor = Math.max(1, Number.parseInt(floorText || "1", 10) || 1);
    const mission = promptText("Missão do departamento", "Responsabilidade deste setor.") ?? "Responsabilidade deste setor.";
    updateActive((company) => ({
      ...company,
      departments: [...company.departments, { id: `dept-${Date.now()}`, name, floor, mission }],
    }));
  };

  const addMember = () => {
    if (!active || active.departments.length === 0) return;
    const name = promptText("Nome do gerente, especialista ou funcionário");
    if (!name) return;
    const role = promptText("Cargo / especialidade", "Especialista") ?? "Especialista";
    const departmentName = promptText(
      `Departamento (${active.departments.map((department) => department.name).join(", ")})`,
      active.departments[0].name,
    );
    const department = active.departments.find((item) => item.name.toLowerCase() === departmentName?.toLowerCase()) ?? active.departments[0];
    const kindRaw = promptText("Tipo: gerente, especialista ou funcionario", "especialista") ?? "especialista";
    const kind: CompanyMember["kind"] = kindRaw.toLowerCase().startsWith("ger")
      ? "gerente"
      : kindRaw.toLowerCase().startsWith("fun") ? "funcionario" : "especialista";
    updateActive((company) => ({
      ...company,
      members: [...company.members, {
        id: `member-${Date.now()}`,
        name,
        role,
        departmentId: department.id,
        kind,
        status: "livre",
        model: "JARVIS",
        autonomy: kind === "gerente" ? "autonomo" : "semi-autonomo",
      }],
    }));
  };

  const dispatchToMember = useCallback(async (member: CompanyMember, instruction?: string) => {
    if (!active) return;
    const taskText = instruction ?? promptText(`O que ${member.name} deve fazer?`);
    if (!taskText) return;
    const department = active.departments.find((item) => item.id === member.departmentId);
    const memory = active.memory.length ? active.memory.map((item) => `- ${item}`).join("\n") : "- Sem regras adicionais cadastradas.";
    const prompt = [
      `EMPRESA: ${active.name}`,
      `SEGMENTO: ${active.segment}`,
      `DEPARTAMENTO: ${department?.name ?? "Não definido"}`,
      `RESPONSÁVEL: ${member.name}`,
      `FUNÇÃO: ${member.role}`,
      `AUTONOMIA: ${member.autonomy}`,
      "",
      "CONTEXTO E MEMÓRIA DA EMPRESA:",
      memory,
      "",
      "TAREFA:",
      taskText,
      "",
      "Execute a tarefa respeitando o contexto da empresa. Produza um resultado objetivo, auditável e informe qualquer decisão que dependa do usuário.",
    ].join("\n");

    const send = async (confirmed: boolean) => {
      const response = await fetch(`${MISSION_API}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, language: "pt", confirmed }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 409 && body?.requires_confirm && !confirmed) {
        if (window.confirm(`Esta tarefa pode executar uma ação sensível (${body.matched_text ?? "ação detectada"}). Autorizar?`)) {
          return send(true);
        }
        throw new Error("Tarefa cancelada: autorização não concedida.");
      }
      if (!response.ok) throw new Error(body?.detail ?? `Falha ao delegar (HTTP ${response.status})`);
      return body as { mission_id?: string; id?: string };
    };

    try {
      const response = await send(false);
      const missionId = response.mission_id ?? response.id ?? null;
      const task: CompanyTask = {
        id: `task-${Date.now()}`,
        title: taskText.length > 90 ? `${taskText.slice(0, 87)}…` : taskText,
        description: taskText,
        assigneeId: member.id,
        departmentId: member.departmentId,
        status: "andamento",
        missionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateActive((company) => ({
        ...company,
        tasks: [task, ...company.tasks],
        members: company.members.map((item) => item.id === member.id
          ? { ...item, status: "trabalhando", currentTask: taskText, missionId }
          : item),
      }));
      setTab("tasks");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Não foi possível delegar a tarefa.");
    }
  }, [active, updateActive]);

  useEffect(() => {
    if (!active) return;
    const running = active.tasks.filter((task) => task.missionId && ["andamento", "aguardando"].includes(task.status));
    if (!running.length) return;
    let cancelled = false;
    const syncMissions = async () => {
      const updates = new Map<string, TaskStatus>();
      await Promise.all(running.slice(0, 20).map(async (task) => {
        try {
          const response = await fetch(`${MISSION_API}/${task.missionId}`);
          if (!response.ok) return;
          const body = await response.json();
          const stateName = String(body?.mission?.state ?? "").toUpperCase();
          let status: TaskStatus = "andamento";
          if (["APPROVED", "COMPLETED", "SUCCEEDED"].includes(stateName)) status = "concluida";
          else if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(stateName)) status = "erro";
          else if (["PENDING", "WAITING", "PAUSED"].includes(stateName)) status = "aguardando";
          updates.set(task.id, status);
        } catch {
          // A temporary mission read failure must not erase local task state.
        }
      }));
      if (cancelled || !updates.size) return;
      updateActive((company) => {
        const tasks = company.tasks.map((task) => updates.has(task.id)
          ? { ...task, status: updates.get(task.id)!, updatedAt: new Date().toISOString() }
          : task);
        const activeMissionIds = new Set(tasks.filter((task) => task.status === "andamento" || task.status === "aguardando").map((task) => task.missionId));
        const members = company.members.map((member) => member.missionId && !activeMissionIds.has(member.missionId)
          ? { ...member, status: "livre" as AgentStatus, currentTask: null, missionId: null }
          : member);
        return { ...company, tasks, members };
      });
    };
    void syncMissions();
    const interval = window.setInterval(() => void syncMissions(), 8_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [active?.id, active?.tasks.length, updateActive]);

  if (loading) {
    return <div className="fixed inset-0 z-[100] grid place-items-center bg-background"><div className="flex items-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" /> Carregando JARVIS Business OS…</div></div>;
  }

  return (
    <div className="fixed inset-0 z-[100] flex bg-background text-foreground" data-testid="companies-workspace">
      <aside className="flex w-[270px] shrink-0 flex-col border-r border-border bg-card/70 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></div>
            <div><div className="text-sm font-semibold">Empresas</div><div className="text-[10px] tracking-[0.18em] text-muted-foreground">JARVIS BUSINESS OS</div></div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Fechar Empresas"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-3">
          <button type="button" onClick={() => void addCompany()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground"><Plus className="h-3.5 w-3.5" /> Adicionar empresa</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {state.companies.map((company) => (
            <button key={company.id} type="button" onClick={() => setActive(company.id)} className={cn("mb-1 w-full rounded-xl border px-3 py-3 text-left transition-colors", company.id === active?.id ? "border-primary/25 bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground")}>
              <div className="truncate text-sm font-semibold">{company.name}</div><div className="mt-0.5 truncate text-[11px] opacity-70">{company.segment}</div>
            </button>
          ))}
        </div>
        <div className="border-t border-border p-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">{saving ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} {saving ? "Salvando…" : "Sincronizado no JARVIS"}</div>
          {syncedAt && <div className="mt-1 opacity-60">Última sincronização {syncedAt.toLocaleTimeString()}</div>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
          <div className="min-w-0"><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Central empresarial</div><h1 className="truncate text-xl font-semibold">{active?.name ?? "Empresas"}</h1></div>
          <div className="flex items-center gap-2">
            {error && <span className="hidden max-w-sm truncate rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-[11px] text-destructive lg:block" title={error}>{error}</span>}
            <button type="button" onClick={() => void load()} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Sincronizar"><RefreshCw className="h-4 w-4" /></button>
            <button type="button" className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Configurações da empresa"><Settings2 className="h-4 w-4" /></button>
          </div>
        </header>

        {active ? <>
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-4 py-2">
            {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={cn("inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium", tab === item.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")}><Icon className="h-3.5 w-3.5" />{item.label}</button>; })}
          </nav>
          <main className="min-h-0 flex-1 overflow-y-auto p-6">
            {tab === "overview" && <Overview company={active} onGo={setTab} />}
            {tab === "building" && <BuildingView company={active} onDelegate={dispatchToMember} />}
            {tab === "departments" && <DepartmentsView company={active} onAdd={addDepartment} />}
            {tab === "team" && <TeamView company={active} query={query} setQuery={setQuery} onAdd={addMember} onDelegate={dispatchToMember} />}
            {tab === "tasks" && <TasksView company={active} onDelegate={dispatchToMember} />}
            {tab === "projects" && <SimpleList title="Projetos" icon={FolderKanban} values={active.projects.map((project) => `${project.name} · ${project.status} · ${project.owner}`)} empty="Nenhum projeto cadastrado." onAdd={() => { const name = promptText("Nome do projeto"); if (!name) return; const owner = promptText("Responsável", "Gerente Geral") ?? "Gerente Geral"; updateActive((company) => ({ ...company, projects: [...company.projects, { id: `project-${Date.now()}`, name, status: "planejado", owner }] })); }} />}
            {tab === "clients" && <SimpleList title="Clientes" icon={BriefcaseBusiness} values={active.clients} empty="Nenhum cliente cadastrado." onAdd={() => { const value = promptText("Nome do cliente"); if (value) updateActive((company) => ({ ...company, clients: [...company.clients, value] })); }} />}
            {tab === "files" && <SimpleList title="Arquivos" icon={FileText} values={active.files} empty="Nenhum arquivo vinculado a esta empresa." onAdd={() => { const value = promptText("Nome ou referência do arquivo"); if (value) updateActive((company) => ({ ...company, files: [...company.files, value] })); }} footer="Arquivos reais enviados pelo chat continuam protegidos pelo sistema nativo de uploads e artefatos do JARVIS." />}
            {tab === "automations" && <SimpleList title="Automações" icon={Workflow} values={active.automations} empty="Nenhuma automação cadastrada." onAdd={() => { const value = promptText("Nova automação / rotina"); if (value) updateActive((company) => ({ ...company, automations: [...company.automations, value] })); }} />}
            {tab === "indicators" && <IndicatorsView company={active} />}
            {tab === "memory" && <SimpleList title="Memória da empresa" icon={MemoryStick} values={active.memory} empty="A memória desta empresa ainda está vazia." onAdd={() => { const value = promptText("Informação, regra ou decisão para guardar"); if (value) updateActive((company) => ({ ...company, memory: [...company.memory, value] })); }} footer="Esta memória é isolada por empresa e é enviada como contexto quando você delega uma tarefa." />}
          </main>
        </> : <div className="grid flex-1 place-items-center"><div className="text-center"><Building2 className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Crie a primeira empresa para começar.</p></div></div>}
      </div>
    </div>
  );
}

function Overview({ company, onGo }: { company: CompanyWorkspace; onGo: (tab: CompanyTab) => void }) {
  const working = company.members.filter((member) => member.status === "trabalhando").length;
  const managers = company.members.filter((member) => member.kind === "gerente").length;
  const activeTasks = company.tasks.filter((task) => task.status === "andamento" || task.status === "aguardando").length;
  const metrics = [["Departamentos", company.departments.length, Network], ["Equipe / agentes", company.members.length, Users], ["Gerentes", managers, CircleUserRound], ["Trabalhando agora", working, Activity], ["Tarefas ativas", activeTasks, CheckCircle2], ["Automações", company.automations.length, Workflow]] as const;
  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6"><div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" /><div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"><Sparkles className="h-3 w-3" /> JARVIS Company Command</div><h2 className="text-2xl font-semibold">{company.name}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{company.description}</p></div><div className="flex gap-2"><button type="button" onClick={() => onGo("tasks")} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary"><CheckCircle2 className="h-4 w-4" />Tarefas</button><button type="button" onClick={() => onGo("building")} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><Building2 className="h-4 w-4" />Abrir prédio</button></div></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value, Icon]) => <div key={label} className="rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-muted-foreground" /></div><div className="mt-3 text-2xl font-semibold">{value}</div></div>)}</div>
    <div className="grid gap-4 xl:grid-cols-2"><Panel title="Departamentos">{company.departments.map((department) => <div key={department.id} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2"><div><div className="text-sm font-medium">{department.name}</div><div className="text-[11px] text-muted-foreground">{department.mission}</div></div><span className="text-[11px] text-muted-foreground">{department.floor}º andar</span></div>)}</Panel><Panel title="Operação em tempo real">{company.tasks.length ? company.tasks.slice(0, 6).map((task) => <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2"><div className="min-w-0"><div className="truncate text-sm font-medium">{task.title}</div><div className="text-[11px] text-muted-foreground">{task.missionId ? `Missão ${task.missionId.slice(0, 8)}` : "Tarefa interna"}</div></div><span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px]", statusClass(task.status))}>{taskLabel[task.status]}</span></div>) : <div className="py-8 text-center text-xs text-muted-foreground">Nenhuma tarefa ainda.</div>}</Panel></div>
  </div>;
}

function BuildingView({ company, onDelegate }: { company: CompanyWorkspace; onDelegate: (member: CompanyMember) => void }) {
  const floors = [...company.departments].sort((a, b) => b.floor - a.floor);
  return <div className="mx-auto max-w-6xl"><SectionHeader title={`Prédio · ${company.name}`} description="Centro operacional visual: cada andar é um departamento e cada estação representa um gerente, especialista ou funcionário/agente." /><div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-3"><span className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground">JARVIS COMPANY BUILDING</span><span className="text-[10px] text-muted-foreground">{company.members.filter((m) => m.status === "trabalhando").length} trabalhando agora</span></div>{floors.map((department) => { const members = company.members.filter((member) => member.departmentId === department.id); return <div key={department.id} className="grid min-h-36 border-b border-border last:border-b-0 md:grid-cols-[120px_1fr]"><div className="flex items-center justify-center border-b border-border bg-secondary/20 p-4 md:border-b-0 md:border-r"><div className="text-center"><div className="text-3xl font-semibold">{department.floor}º</div><div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">andar</div></div></div><div className="p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{department.name}</h3><p className="text-[11px] text-muted-foreground">{department.mission}</p></div><span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{members.length} estações</span></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{members.length ? members.map((member) => <button type="button" onClick={() => onDelegate(member)} key={member.id} className="group rounded-xl border border-border bg-background/70 p-3 text-left hover:border-primary/35 hover:bg-primary/5"><div className="mb-2 flex items-center justify-between"><Bot className="h-4 w-4 group-hover:text-primary" /><span className={cn("h-2 w-2 rounded-full", member.status === "trabalhando" ? "bg-success" : member.status === "erro" ? "bg-destructive" : member.status === "aguardando" ? "bg-warning" : "bg-muted-foreground/50")} /></div><div className="truncate text-xs font-semibold">{member.name}</div><div className="truncate text-[10px] text-muted-foreground">{member.role}</div>{member.currentTask && <div className="mt-2 line-clamp-2 text-[9px] leading-4 text-primary">{member.currentTask}</div>}</button>) : <div className="col-span-full rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Sala disponível para novos agentes e funcionários.</div>}</div></div></div>; })}</div></div>;
}

function DepartmentsView({ company, onAdd }: { company: CompanyWorkspace; onAdd: () => void }) {
  return <div className="mx-auto max-w-6xl"><SectionHeader title="Departamentos" description="Setores, andares e responsabilidades desta empresa." action="Adicionar departamento" onAction={onAdd} /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{company.departments.map((department) => { const count = company.members.filter((member) => member.departmentId === department.id).length; return <div key={department.id} className="rounded-xl border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between"><div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary"><Network className="h-4 w-4" /></div><span className="text-[11px] text-muted-foreground">{department.floor}º andar</span></div><h3 className="text-sm font-semibold">{department.name}</h3><p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">{department.mission}</p><div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">{count} pessoa(s) / agente(s)</div></div>; })}</div></div>;
}

function TeamView({ company, query, setQuery, onAdd, onDelegate }: { company: CompanyWorkspace; query: string; setQuery: (value: string) => void; onAdd: () => void; onDelegate: (member: CompanyMember) => void }) {
  const filtered = useMemo(() => company.members.filter((member) => `${member.name} ${member.role}`.toLowerCase().includes(query.toLowerCase())), [company.members, query]);
  return <div className="mx-auto max-w-7xl"><SectionHeader title="Equipe" description="Gerentes, especialistas, funcionários e agentes da empresa." action="Adicionar pessoa/agente" onAction={onAdd} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou cargo…" className="mb-4 h-10 w-full max-w-md rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((member) => { const department = company.departments.find((item) => item.id === member.departmentId); return <div key={member.id} className="rounded-xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary"><Bot className="h-5 w-5" /></div><span className={cn("rounded-full border px-2 py-1 text-[10px]", statusClass(member.status))}>{statusLabel[member.status]}</span></div><h3 className="mt-4 text-sm font-semibold">{member.name}</h3><p className="text-xs text-muted-foreground">{member.role}</p>{member.currentTask && <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2 text-[10px] leading-4 text-primary">{member.currentTask}</div>}<div className="mt-4 grid grid-cols-2 gap-2 text-[11px]"><InfoCell label="Departamento" value={department?.name ?? "Sem setor"} /><InfoCell label="Tipo" value={member.kind} /><InfoCell label="Modelo" value={member.model} /><InfoCell label="Autonomia" value={member.autonomy} /></div><button type="button" onClick={() => onDelegate(member)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground hover:opacity-90"><Send className="h-3.5 w-3.5" />Delegar tarefa</button></div>; })}</div></div>;
}

function TasksView({ company, onDelegate }: { company: CompanyWorkspace; onDelegate: (member: CompanyMember) => void }) {
  return <div className="mx-auto max-w-7xl"><SectionHeader title="Tarefas e missões" description="Delegações executadas pelo motor nativo de missões do JARVIS, com status acompanhado automaticamente." action={company.members.length ? "Delegar nova tarefa" : undefined} onAction={company.members.length ? () => onDelegate(company.members[0]) : undefined} /><div className="grid gap-3">{company.tasks.length ? company.tasks.map((task) => { const member = company.members.find((item) => item.id === task.assigneeId); const department = company.departments.find((item) => item.id === task.departmentId); return <div key={task.id} className="rounded-xl border border-border bg-card p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-semibold">{task.title}</h3><span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px]", statusClass(task.status))}>{taskLabel[task.status]}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{task.description}</p><div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground"><span>Responsável: {member?.name ?? "Não definido"}</span><span>Departamento: {department?.name ?? "Não definido"}</span>{task.missionId && <span>Missão: {task.missionId}</span>}</div></div>{member && task.status !== "concluida" && task.status !== "erro" && <button type="button" onClick={() => onDelegate(member)} className="shrink-0 rounded-lg border border-border px-3 py-2 text-[11px] font-medium hover:bg-secondary">Nova delegação</button>}</div></div>; }) : <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground" /><div className="mt-3 text-sm font-medium">Nenhuma tarefa delegada</div><p className="mt-1 text-xs text-muted-foreground">Escolha um gerente ou especialista e delegue a primeira missão.</p></div>}</div></div>;
}

function IndicatorsView({ company }: { company: CompanyWorkspace }) {
  const working = company.members.filter((member) => member.status === "trabalhando").length;
  const available = company.members.filter((member) => member.status === "livre").length;
  const completed = company.tasks.filter((task) => task.status === "concluida").length;
  const indicators = [["Pessoas/agentes", company.members.length, Users], ["Trabalhando", working, Activity], ["Disponíveis", available, Bot], ["Tarefas", company.tasks.length, CheckCircle2], ["Concluídas", completed, Gauge], ["Automações", company.automations.length, Workflow]] as const;
  return <div className="mx-auto max-w-6xl"><SectionHeader title="Indicadores" description="Painel operacional desta empresa." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{indicators.map(([label, value, Icon]) => <div key={label} className="rounded-xl border border-border bg-card p-5"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><Icon className="h-4 w-4" /></div><div className="mt-4 text-3xl font-semibold">{value}</div></div>)}</div></div>;
}

function SimpleList({ title, icon: Icon, values, empty, onAdd, footer }: { title: string; icon: typeof FileText; values: string[]; empty: string; onAdd: () => void; footer?: string }) {
  return <div className="mx-auto max-w-5xl"><SectionHeader title={title} description={`Área de ${title.toLowerCase()} da empresa.`} action={`Adicionar ${title.toLowerCase().replace(/s$/, "")}`} onAction={onAdd} /><div className="rounded-xl border border-border bg-card">{values.length ? values.map((value, index) => <div key={`${value}-${index}`} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"><div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary"><Icon className="h-4 w-4" /></div><div className="text-sm">{value}</div></div>) : <div className="p-10 text-center text-sm text-muted-foreground">{empty}</div>}</div>{footer && <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{footer}</p>}</div>;
}

function SectionHeader({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{action && onAction && <button type="button" onClick={onAction} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"><Plus className="h-3.5 w-3.5" />{action}</button>}</div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-5"><h3 className="mb-4 text-sm font-semibold">{title}</h3><div className="space-y-2">{children}</div></div>;
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-secondary/40 p-2"><div className="text-muted-foreground">{label}</div><div className="mt-1 truncate font-medium capitalize text-foreground">{value}</div></div>;
}
