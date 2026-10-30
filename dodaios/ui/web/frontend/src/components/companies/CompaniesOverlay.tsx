import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  CircleUserRound,
  FileText,
  FolderKanban,
  Gauge,
  HardDrive,
  MemoryStick,
  Network,
  Plus,
  Settings2,
  Sparkles,
  Users,
  Workflow,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

type AgentStatus = "livre" | "trabalhando" | "aguardando" | "erro";
type CompanyTab =
  | "overview"
  | "building"
  | "departments"
  | "team"
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
  currentTask?: string;
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
  projects: CompanyProject[];
  clients: string[];
  files: string[];
  automations: string[];
  memory: string[];
}

const STORAGE_KEY = "jarvis.companies.v1";
const ACTIVE_KEY = "jarvis.companies.active.v1";

const initialCompanies: CompanyWorkspace[] = [
  {
    id: "moretto-imoveis",
    name: "Moretto Imóveis",
    segment: "Imobiliária",
    description: "Operação de locações, carteira de imóveis, atendimento, contratos, repasses e seguros.",
    departments: [
      { id: "diretoria", name: "Diretoria", floor: 4, mission: "Prioridades, decisões e coordenação geral." },
      { id: "locacoes", name: "Locações", floor: 3, mission: "Contratos, desocupações, seguros, boletos e vistorias." },
      { id: "financeiro", name: "Financeiro", floor: 2, mission: "Recebimentos, repasses, cobrança e conciliação." },
      { id: "comercial", name: "Comercial", floor: 1, mission: "Captação, clientes, imóveis e negociações." },
    ],
    members: [
      { id: "gerente-geral", name: "Gerente Geral", role: "Gerente Geral", departmentId: "diretoria", kind: "gerente", status: "livre", model: "JARVIS Local", autonomy: "autonomo" },
      { id: "contratos", name: "Especialista em Contratos", role: "Contratos e aditivos", departmentId: "locacoes", kind: "especialista", status: "livre", model: "JARVIS Local", autonomy: "semi-autonomo" },
      { id: "seguros", name: "Especialista em Seguros", role: "Incêndio e fiança", departmentId: "locacoes", kind: "especialista", status: "livre", model: "JARVIS Local", autonomy: "semi-autonomo" },
      { id: "financeiro-agent", name: "Analista Financeiro", role: "Cobrança e repasses", departmentId: "financeiro", kind: "funcionario", status: "livre", model: "JARVIS Local", autonomy: "assistido" },
    ],
    projects: [
      { id: "carteira", name: "Operação da carteira de locações", status: "andamento", owner: "Gerente Geral" },
    ],
    clients: [],
    files: [],
    automations: ["Triagem de solicitações de locação", "Acompanhamento de tarefas dos departamentos"],
    memory: ["Contexto, regras e decisões desta empresa ficam isolados das demais empresas."],
  },
  {
    id: "obras",
    name: "Obras",
    segment: "Construção e reformas",
    description: "Orçamentos, execução, medições, SINAPI, documentos e acompanhamento de obras.",
    departments: [
      { id: "diretoria", name: "Diretoria", floor: 3, mission: "Planejamento, decisões e contratos." },
      { id: "engenharia", name: "Engenharia / Orçamentos", floor: 2, mission: "SINAPI, composições, projetos e quantitativos." },
      { id: "operacao", name: "Operação de Obras", floor: 1, mission: "Execução, equipes, compras, diário e medição." },
    ],
    members: [
      { id: "gerente-obras", name: "Gerente de Obras", role: "Coordenação geral", departmentId: "diretoria", kind: "gerente", status: "livre", model: "JARVIS Local", autonomy: "autonomo" },
      { id: "sinapi", name: "Especialista SINAPI", role: "Custos e composições", departmentId: "engenharia", kind: "especialista", status: "livre", model: "JARVIS Local", autonomy: "semi-autonomo" },
    ],
    projects: [], clients: [], files: [], automations: [], memory: [],
  },
  {
    id: "energia-solar",
    name: "Energia Solar",
    segment: "Energia fotovoltaica",
    description: "Clientes, dimensionamento, propostas, instalações e pós-venda de sistemas fotovoltaicos.",
    departments: [
      { id: "diretoria", name: "Diretoria", floor: 3, mission: "Metas e coordenação." },
      { id: "projetos", name: "Projetos", floor: 2, mission: "Dimensionamento e documentação técnica." },
      { id: "comercial", name: "Comercial", floor: 1, mission: "Propostas, leads e fechamento." },
    ],
    members: [
      { id: "gerente-solar", name: "Gerente Solar", role: "Coordenação geral", departmentId: "diretoria", kind: "gerente", status: "livre", model: "JARVIS Local", autonomy: "autonomo" },
    ],
    projects: [], clients: [], files: [], automations: [], memory: [],
  },
  {
    id: "arquitetura",
    name: "Arquitetura",
    segment: "Arquitetura e projetos",
    description: "Clientes, plantas, detalhamentos, renderizações, documentos técnicos e gestão de projetos.",
    departments: [
      { id: "diretoria", name: "Diretoria", floor: 3, mission: "Coordenação criativa e prioridades." },
      { id: "projetos", name: "Projetos", floor: 2, mission: "Plantas, detalhamentos e compatibilização." },
      { id: "visualizacao", name: "Visualização", floor: 1, mission: "Renderizações e apresentações." },
    ],
    members: [
      { id: "gerente-arq", name: "Gerente de Projetos", role: "Coordenação", departmentId: "diretoria", kind: "gerente", status: "livre", model: "JARVIS Local", autonomy: "autonomo" },
      { id: "cad", name: "Especialista CAD", role: "Plantas e detalhamento", departmentId: "projetos", kind: "especialista", status: "livre", model: "JARVIS Local", autonomy: "semi-autonomo" },
    ],
    projects: [], clients: [], files: [], automations: [], memory: [],
  },
];

const tabs: Array<{ id: CompanyTab; label: string; icon: typeof Building2 }> = [
  { id: "overview", label: "Visão geral", icon: Gauge },
  { id: "building", label: "Prédio", icon: Building2 },
  { id: "departments", label: "Departamentos", icon: Network },
  { id: "team", label: "Equipe", icon: Users },
  { id: "projects", label: "Projetos", icon: FolderKanban },
  { id: "clients", label: "Clientes", icon: BriefcaseBusiness },
  { id: "files", label: "Arquivos", icon: HardDrive },
  { id: "automations", label: "Automações", icon: Workflow },
  { id: "indicators", label: "Indicadores", icon: BarChart3 },
  { id: "memory", label: "Memória", icon: MemoryStick },
];

function loadCompanies(): CompanyWorkspace[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialCompanies;
    const parsed = JSON.parse(raw) as CompanyWorkspace[];
    return Array.isArray(parsed) && parsed.length ? parsed : initialCompanies;
  } catch {
    return initialCompanies;
  }
}

function persistCompanies(companies: CompanyWorkspace[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
  } catch {
    // Local persistence is a convenience; the workspace remains usable in-memory.
  }
}

const statusLabel: Record<AgentStatus, string> = {
  livre: "Livre",
  trabalhando: "Trabalhando",
  aguardando: "Aguardando",
  erro: "Erro",
};

function statusClass(status: AgentStatus): string {
  if (status === "trabalhando") return "bg-success/15 text-success border-success/30";
  if (status === "erro") return "bg-destructive/15 text-destructive border-destructive/30";
  if (status === "aguardando") return "bg-warning/15 text-warning border-warning/30";
  return "bg-secondary text-muted-foreground border-border";
}

function promptText(label: string, initial = ""): string | null {
  const value = window.prompt(label, initial);
  if (value === null) return null;
  const next = value.trim();
  return next || null;
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
        className="fixed bottom-20 left-3 z-[70] inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card/95 px-3 text-xs font-semibold text-foreground shadow-xl backdrop-blur hover:bg-secondary"
        title="Empresas"
        aria-label="Abrir Empresas"
        data-testid="companies-launcher"
      >
        <Building2 className="h-4 w-4" />
        <span className="hidden min-[900px]:inline">Empresas</span>
      </button>
      {open && <CompaniesWorkspace onClose={() => setOpen(false)} />}
    </>
  );
}

function CompaniesWorkspace({ onClose }: { onClose: () => void }) {
  const [companies, setCompanies] = useState<CompanyWorkspace[]>(loadCompanies);
  const [activeId, setActiveId] = useState(() => {
    try {
      return window.localStorage.getItem(ACTIVE_KEY) || loadCompanies()[0]?.id || "";
    } catch {
      return loadCompanies()[0]?.id || "";
    }
  });
  const [tab, setTab] = useState<CompanyTab>("overview");
  const [query, setQuery] = useState("");

  const active = companies.find((company) => company.id === activeId) ?? companies[0];

  useEffect(() => persistCompanies(companies), [companies]);
  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_KEY, active?.id ?? "");
    } catch {
      // best effort only
    }
  }, [active?.id]);

  const updateActive = (mutate: (company: CompanyWorkspace) => CompanyWorkspace) => {
    if (!active) return;
    setCompanies((current) => current.map((company) => (company.id === active.id ? mutate(company) : company)));
  };

  const addCompany = () => {
    const name = promptText("Nome da empresa");
    if (!name) return;
    const segment = promptText("Segmento da empresa", "Empresa") ?? "Empresa";
    const id = `${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
    const company: CompanyWorkspace = {
      id,
      name,
      segment,
      description: "Novo workspace empresarial.",
      departments: [{ id: `diretoria-${Date.now()}`, name: "Diretoria", floor: 1, mission: "Coordenação geral." }],
      members: [],
      projects: [],
      clients: [],
      files: [],
      automations: [],
      memory: [],
    };
    setCompanies((current) => [...current, company]);
    setActiveId(company.id);
    setTab("overview");
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
      : kindRaw.toLowerCase().startsWith("fun")
        ? "funcionario"
        : "especialista";
    updateActive((company) => ({
      ...company,
      members: [
        ...company.members,
        {
          id: `member-${Date.now()}`,
          name,
          role,
          departmentId: department.id,
          kind,
          status: "livre",
          model: "JARVIS Local",
          autonomy: kind === "gerente" ? "autonomo" : "semi-autonomo",
        },
      ],
    }));
  };

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[100] flex bg-background text-foreground" data-testid="companies-workspace">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-border bg-card/60">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Empresas</div>
              <div className="text-[11px] text-muted-foreground">JARVIS Business OS</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Fechar Empresas">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3">
          <button type="button" onClick={addCompany} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground">
            <Plus className="h-3.5 w-3.5" /> Adicionar empresa
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              onClick={() => { setActiveId(company.id); setTab("overview"); }}
              className={cn(
                "mb-1 w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                company.id === active.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <div className="truncate text-sm font-medium">{company.name}</div>
              <div className="mt-0.5 truncate text-[11px] opacity-70">{company.segment}</div>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><ChevronLeft className="h-3.5 w-3.5" /> Empresa</div>
            <h1 className="truncate text-xl font-semibold">{active.name}</h1>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] text-muted-foreground">{active.departments.length} departamentos</span>
            <span className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] text-muted-foreground">{active.members.length} pessoas/agentes</span>
            <button type="button" className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Configurações da empresa"><Settings2 className="h-4 w-4" /></button>
          </div>
        </header>

        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-4 py-2">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
                  tab === item.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {item.label}
              </button>
            );
          })}
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {tab === "overview" && <Overview company={active} onGo={setTab} />}
          {tab === "building" && <BuildingView company={active} />}
          {tab === "departments" && <DepartmentsView company={active} onAdd={addDepartment} />}
          {tab === "team" && <TeamView company={active} query={query} setQuery={setQuery} onAdd={addMember} onUpdate={updateActive} />}
          {tab === "projects" && <SimpleList title="Projetos" icon={FolderKanban} values={active.projects.map((project) => `${project.name} · ${project.status} · ${project.owner}`)} empty="Nenhum projeto cadastrado." onAdd={() => {
            const name = promptText("Nome do projeto");
            if (!name) return;
            const owner = promptText("Responsável", "Gerente Geral") ?? "Gerente Geral";
            updateActive((company) => ({ ...company, projects: [...company.projects, { id: `project-${Date.now()}`, name, status: "planejado", owner }] }));
          }} />}
          {tab === "clients" && <SimpleList title="Clientes" icon={BriefcaseBusiness} values={active.clients} empty="Nenhum cliente cadastrado." onAdd={() => {
            const value = promptText("Nome do cliente");
            if (value) updateActive((company) => ({ ...company, clients: [...company.clients, value] }));
          }} />}
          {tab === "files" && <SimpleList title="Arquivos" icon={FileText} values={active.files} empty="Nenhum arquivo vinculado." onAdd={() => {
            const value = promptText("Nome ou referência do arquivo");
            if (value) updateActive((company) => ({ ...company, files: [...company.files, value] }));
          }} />}
          {tab === "automations" && <SimpleList title="Automações" icon={Workflow} values={active.automations} empty="Nenhuma automação cadastrada." onAdd={() => {
            const value = promptText("Nova automação / rotina");
            if (value) updateActive((company) => ({ ...company, automations: [...company.automations, value] }));
          }} />}
          {tab === "indicators" && <IndicatorsView company={active} />}
          {tab === "memory" && <SimpleList title="Memória da empresa" icon={MemoryStick} values={active.memory} empty="A memória desta empresa ainda está vazia." onAdd={() => {
            const value = promptText("Informação, regra ou decisão para guardar");
            if (value) updateActive((company) => ({ ...company, memory: [...company.memory, value] }));
          }} />}
        </main>
      </div>
    </div>
  );
}

function Overview({ company, onGo }: { company: CompanyWorkspace; onGo: (tab: CompanyTab) => void }) {
  const working = company.members.filter((member) => member.status === "trabalhando").length;
  const managers = company.members.filter((member) => member.kind === "gerente").length;
  const metrics = [
    ["Departamentos", company.departments.length, Network],
    ["Equipe / agentes", company.members.length, Users],
    ["Gerentes", managers, CircleUserRound],
    ["Trabalhando agora", working, Activity],
    ["Projetos", company.projects.length, FolderKanban],
    ["Automações", company.automations.length, Workflow],
  ] as const;
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"><Sparkles className="h-3 w-3" /> Workspace empresarial</div>
            <h2 className="text-2xl font-semibold">{company.name}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{company.description}</p>
          </div>
          <button type="button" onClick={() => onGo("building")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><Building2 className="h-4 w-4" /> Abrir prédio</button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, value, Icon]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-muted-foreground" /></div>
            <div className="mt-3 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5"><h3 className="mb-4 text-sm font-semibold">Departamentos</h3><div className="space-y-2">{company.departments.map((department) => <div key={department.id} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2"><div><div className="text-sm font-medium">{department.name}</div><div className="text-[11px] text-muted-foreground">{department.mission}</div></div><span className="text-[11px] text-muted-foreground">{department.floor}º andar</span></div>)}</div></div>
        <div className="rounded-xl border border-border bg-card p-5"><h3 className="mb-4 text-sm font-semibold">Atividade da equipe</h3><div className="space-y-2">{company.members.slice(0, 6).map((member) => <div key={member.id} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2"><div><div className="text-sm font-medium">{member.name}</div><div className="text-[11px] text-muted-foreground">{member.role}</div></div><span className={cn("rounded-full border px-2 py-0.5 text-[10px]", statusClass(member.status))}>{statusLabel[member.status]}</span></div>)}</div></div>
      </div>
    </div>
  );
}

function BuildingView({ company }: { company: CompanyWorkspace }) {
  const floors = [...company.departments].sort((a, b) => b.floor - a.floor);
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5"><h2 className="text-xl font-semibold">Prédio · {company.name}</h2><p className="mt-1 text-sm text-muted-foreground">Cada andar representa um departamento. Gerentes e especialistas aparecem dentro do setor em que trabalham.</p></div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border bg-secondary/30 px-5 py-3 text-xs font-semibold tracking-wide text-muted-foreground">JARVIS COMPANY BUILDING</div>
        {floors.map((department) => {
          const members = company.members.filter((member) => member.departmentId === department.id);
          return (
            <div key={department.id} className="grid min-h-32 border-b border-border last:border-b-0 md:grid-cols-[120px_1fr]">
              <div className="flex items-center justify-center border-b border-border bg-secondary/20 p-4 md:border-b-0 md:border-r"><div className="text-center"><div className="text-2xl font-semibold">{department.floor}º</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">andar</div></div></div>
              <div className="p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{department.name}</h3><p className="text-[11px] text-muted-foreground">{department.mission}</p></div><span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{members.length} na sala</span></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{members.length ? members.map((member) => <div key={member.id} className="rounded-lg border border-border bg-background/60 p-3"><div className="mb-2 flex items-center justify-between"><Bot className="h-4 w-4" /><span className={cn("h-2 w-2 rounded-full", member.status === "trabalhando" ? "bg-success" : member.status === "erro" ? "bg-destructive" : member.status === "aguardando" ? "bg-warning" : "bg-muted-foreground/50")} /></div><div className="truncate text-xs font-semibold">{member.name}</div><div className="truncate text-[10px] text-muted-foreground">{member.role}</div></div>) : <div className="col-span-full rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Sala disponível para novos agentes e funcionários.</div>}</div></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DepartmentsView({ company, onAdd }: { company: CompanyWorkspace; onAdd: () => void }) {
  return <div className="mx-auto max-w-6xl"><SectionHeader title="Departamentos" description="Setores, andares e responsabilidades desta empresa." action="Adicionar departamento" onAction={onAdd} /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{company.departments.map((department) => { const count = company.members.filter((member) => member.departmentId === department.id).length; return <div key={department.id} className="rounded-xl border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between"><div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary"><Network className="h-4 w-4" /></div><span className="text-[11px] text-muted-foreground">{department.floor}º andar</span></div><h3 className="text-sm font-semibold">{department.name}</h3><p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">{department.mission}</p><div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">{count} gerente(s), especialista(s) e funcionário(s)</div></div>; })}</div></div>;
}

function TeamView({ company, query, setQuery, onAdd, onUpdate }: { company: CompanyWorkspace; query: string; setQuery: (value: string) => void; onAdd: () => void; onUpdate: (mutate: (company: CompanyWorkspace) => CompanyWorkspace) => void }) {
  const filtered = useMemo(() => company.members.filter((member) => `${member.name} ${member.role}`.toLowerCase().includes(query.toLowerCase())), [company.members, query]);
  const cycleStatus = (member: CompanyMember) => {
    const order: AgentStatus[] = ["livre", "trabalhando", "aguardando", "erro"];
    const next = order[(order.indexOf(member.status) + 1) % order.length];
    onUpdate((current) => ({ ...current, members: current.members.map((item) => item.id === member.id ? { ...item, status: next } : item) }));
  };
  return <div className="mx-auto max-w-7xl"><SectionHeader title="Equipe" description="Gerentes, especialistas, funcionários e agentes da empresa." action="Adicionar pessoa/agente" onAction={onAdd} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou cargo..." className="mb-4 h-10 w-full max-w-md rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((member) => { const department = company.departments.find((item) => item.id === member.departmentId); return <div key={member.id} className="rounded-xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary"><Bot className="h-5 w-5" /></div><button type="button" onClick={() => cycleStatus(member)} className={cn("rounded-full border px-2 py-1 text-[10px]", statusClass(member.status))} title="Clique para alterar o status">{statusLabel[member.status]}</button></div><h3 className="mt-4 text-sm font-semibold">{member.name}</h3><p className="text-xs text-muted-foreground">{member.role}</p><div className="mt-4 grid grid-cols-2 gap-2 text-[11px]"><div className="rounded-lg bg-secondary/40 p-2"><div className="text-muted-foreground">Departamento</div><div className="mt-1 font-medium text-foreground">{department?.name ?? "Sem setor"}</div></div><div className="rounded-lg bg-secondary/40 p-2"><div className="text-muted-foreground">Tipo</div><div className="mt-1 font-medium capitalize text-foreground">{member.kind}</div></div><div className="rounded-lg bg-secondary/40 p-2"><div className="text-muted-foreground">Modelo</div><div className="mt-1 font-medium text-foreground">{member.model}</div></div><div className="rounded-lg bg-secondary/40 p-2"><div className="text-muted-foreground">Autonomia</div><div className="mt-1 font-medium text-foreground">{member.autonomy}</div></div></div><div className="mt-4 flex gap-2"><button type="button" className="flex-1 rounded-lg border border-border px-3 py-2 text-[11px] font-medium hover:bg-secondary">Conversar</button><button type="button" className="flex-1 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground hover:opacity-90">Delegar tarefa</button></div></div>; })}</div></div>;
}

function IndicatorsView({ company }: { company: CompanyWorkspace }) {
  const working = company.members.filter((member) => member.status === "trabalhando").length;
  const available = company.members.filter((member) => member.status === "livre").length;
  const completed = company.projects.filter((project) => project.status === "concluido").length;
  const indicators = [
    ["Pessoas/agentes ativos", company.members.length, Users],
    ["Trabalhando", working, Activity],
    ["Disponíveis", available, Bot],
    ["Projetos", company.projects.length, FolderKanban],
    ["Projetos concluídos", completed, Gauge],
    ["Automações", company.automations.length, Workflow],
  ] as const;
  return <div className="mx-auto max-w-6xl"><SectionHeader title="Indicadores" description="Painel operacional desta empresa." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{indicators.map(([label, value, Icon]) => <div key={label} className="rounded-xl border border-border bg-card p-5"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><Icon className="h-4 w-4" /></div><div className="mt-4 text-3xl font-semibold">{value}</div></div>)}</div></div>;
}

function SimpleList({ title, icon: Icon, values, empty, onAdd }: { title: string; icon: typeof FileText; values: string[]; empty: string; onAdd: () => void }) {
  return <div className="mx-auto max-w-5xl"><SectionHeader title={title} description={`Área de ${title.toLowerCase()} da empresa.`} action={`Adicionar ${title.toLowerCase().replace(/s$/, "")}`} onAction={onAdd} /><div className="rounded-xl border border-border bg-card">{values.length ? values.map((value, index) => <div key={`${value}-${index}`} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"><div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary"><Icon className="h-4 w-4" /></div><div className="text-sm">{value}</div></div>) : <div className="p-10 text-center text-sm text-muted-foreground">{empty}</div>}</div></div>;
}

function SectionHeader({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{action && onAction && <button type="button" onClick={onAction} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"><Plus className="h-3.5 w-3.5" />{action}</button>}</div>;
}
