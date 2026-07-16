import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Code2, Cpu, Download, LoaderCircle, RefreshCw, Upload, Wrench, XCircle } from "lucide-react";
import { validateProjectForBuild } from "../../domain/project/validation";
import {
  generateFirmware,
  getToolchainStatus,
  listSerialPorts,
  prepareToolchain,
  runFirmwareBuild,
  type FirmwareProgress,
  type SerialPortDescriptor,
  type ToolchainProgress,
  type ToolchainStatus
} from "../../services/firmwareService";
import type { LinkPadProject } from "../../types/project";

interface BuildEditorProps {
  project: LinkPadProject;
  onSetProject: (project: LinkPadProject) => void;
}

type Operation = "toolchain" | "generate" | "build" | "flash";
type OperationState = { kind: "idle" } | { kind: "loading"; operation: Operation } | { kind: "success"; message: string } | { kind: "error"; message: string };

const progressStageLabels: Record<string, string> = {
  preparing: "Preparando",
  starting: "Iniciando",
  running: "Executando",
  building: "Configurando build",
  compiling: "Compilando",
  linking: "Vinculando",
  packaging: "Gerando firmware",
  connecting: "Conectando ao device",
  uploading: "Gravando",
  verifying: "Verificando",
  complete: "Concluido",
  failed: "Falhou",
  error: "Diagnostico"
};

export function BuildEditor({ project, onSetProject }: BuildEditorProps) {
  const issues = useMemo(() => validateProjectForBuild(project), [project]);
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const [state, setState] = useState<OperationState>({ kind: "idle" });
  const [toolchain, setToolchain] = useState<ToolchainStatus | null>(null);
  const [toolchainProgress, setToolchainProgress] = useState<ToolchainProgress | null>(null);
  const [firmwareProgress, setFirmwareProgress] = useState<FirmwareProgress | null>(null);
  const [firmwareLog, setFirmwareLog] = useState<string[]>([]);
  const [serialPorts, setSerialPorts] = useState<SerialPortDescriptor[]>([]);
  const [serialPortsLoading, setSerialPortsLoading] = useState(true);
  const [serialPortsError, setSerialPortsError] = useState<string | null>(null);

  const refreshSerialPorts = useCallback(async () => {
    setSerialPortsLoading(true);
    setSerialPortsError(null);
    try {
      setSerialPorts(await listSerialPorts());
    } catch (error) {
      setSerialPorts([]);
      setSerialPortsError(String(error));
    } finally {
      setSerialPortsLoading(false);
    }
  }, []);

  useEffect(() => {
    void getToolchainStatus()
      .then(setToolchain)
      .catch((error) => setState({ kind: "error", message: String(error) }));
    void refreshSerialPorts();
  }, [refreshSerialPorts]);

  useEffect(() => {
    if (
      !serialPortsLoading
      && !serialPortsError
      && serialPorts.length === 1
      && !project.build.serialPort.trim()
    ) {
      onSetProject({
        ...project,
        build: { ...project.build, serialPort: serialPorts[0].name },
        updatedAt: new Date().toISOString()
      });
    }
  }, [onSetProject, project, serialPorts, serialPortsError, serialPortsLoading]);

  function updateBuild(patch: Partial<LinkPadProject["build"]>) {
    onSetProject({ ...project, build: { ...project.build, ...patch }, updatedAt: new Date().toISOString() });
  }

  async function ensureToolchain() {
    if (toolchain?.ready) return true;
    setState({ kind: "loading", operation: "toolchain" });
    setToolchainProgress({ stage: "checking", message: "Iniciando preparação...", percent: 0 });
    try {
      const prepared = await prepareToolchain(setToolchainProgress);
      setToolchain(prepared);
      setState({ kind: "success", message: `${prepared.version ?? "PlatformIO"} preparado pelo LinkPad Studio.` });
      return true;
    } catch (error) {
      setState({ kind: "error", message: String(error) });
      return false;
    }
  }

  async function execute(operation: Exclude<Operation, "toolchain">) {
    if (operation === "flash" && !serialPortAvailable) {
      setState({ kind: "error", message: "Selecione uma porta serial detectada antes de gravar o device." });
      return;
    }
    if (errors.length > 0) {
      setState({ kind: "error", message: "Corrija os erros de validação antes de continuar." });
      return;
    }
    if (operation !== "generate" && !(await ensureToolchain())) return;
    if (operation !== "generate") {
      setFirmwareProgress({ stage: "preparing", message: "Gerando o firmware do projeto...", percent: 0 });
      setFirmwareLog([]);
    }
    setState({ kind: "loading", operation });
    try {
      if (operation === "generate") {
        const result = await generateFirmware(project);
        setState({ kind: "success", message: `Firmware gerado em ${result.outputPath}` });
      } else {
        await generateFirmware(project);
        const result = await runFirmwareBuild(project, operation === "flash", (progress) => {
          setFirmwareProgress(progress);
          setFirmwareLog((current) => {
            if (!progress.message.trim() || current[current.length - 1] === progress.message) return current;
            return [...current, progress.message].slice(-8);
          });
        });
        setState({ kind: "success", message: `${operation === "flash" ? "Firmware gravado" : "Build concluído"}. Log: ${result.logPath}` });
      }
    } catch (error) {
      setState({ kind: "error", message: String(error) });
    }
  }

  const loading = state.kind === "loading";
  const selectedSerialPort = project.build.serialPort.trim();
  const serialPortAvailable = serialPorts.some(
    (port) => port.name.toLocaleLowerCase() === selectedSerialPort.toLocaleLowerCase()
  );
  const savedPortUnavailable = selectedSerialPort.length > 0 && !serialPortAvailable;
  const serialPortHelp = serialPortsLoading
    ? "Detectando portas conectadas..."
    : serialPortsError
      ? "Não foi possível detectar as portas. Clique em atualizar."
      : savedPortUnavailable
        ? `${selectedSerialPort} não está conectada. Selecione uma porta detectada.`
        : serialPorts.length === 0
          ? "Nenhuma porta detectada. Conecte o device e clique em atualizar."
          : serialPortAvailable
            ? "Porta detectada e pronta para gravação."
            : "Selecione a porta do device que sera gravado.";

  return (
    <main className="workbench">
      <section className="editor-surface">
        <div className="editor-header"><div><Wrench size={21} /><h2>Build e gravação</h2></div><span>PlatformIO · M5StickC Plus2</span></div>

        <div className="build-layout">
          <section className="build-actions">
            <div className={`toolchain-card ${toolchain?.ready ? "ready" : "pending"}`}>
              <div>
                {toolchain?.ready ? <CheckCircle2 size={20} /> : <Download size={20} />}
                <span>
                  <strong>Ambiente de compilação</strong>
                  <small>{toolchain === null ? "Verificando..." : toolchain.ready ? `${toolchain.version} · gerenciado pelo Studio` : "Será instalado e mantido pelo LinkPad Studio."}</small>
                </span>
              </div>
              {!toolchain?.ready && toolchain !== null && (
                <button type="button" disabled={loading} onClick={() => void ensureToolchain()}>
                  {state.kind === "loading" && state.operation === "toolchain" ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
                  Preparar ambiente
                </button>
              )}
              {toolchainProgress && state.kind === "loading" && state.operation === "toolchain" && (
                <div className="toolchain-progress">
                  <span style={{ width: `${toolchainProgress.percent}%` }} />
                  <small>{toolchainProgress.message} ({toolchainProgress.percent}%)</small>
                </div>
              )}
            </div>
            <div className="form-grid compact-grid">
              <label>
                Porta serial
                <div className="serial-port-control">
                  <select
                    aria-describedby="serial-port-help"
                    value={selectedSerialPort}
                    onChange={(event) => updateBuild({ serialPort: event.target.value })}
                  >
                    <option value="">{serialPortsLoading ? "Detectando portas..." : "Selecione uma porta"}</option>
                    {savedPortUnavailable && <option value={selectedSerialPort}>{selectedSerialPort} - não detectada</option>}
                    {serialPorts.map((port) => <option key={port.name} value={port.name}>{port.label}</option>)}
                  </select>
                  <button
                    type="button"
                    aria-label="Atualizar portas seriais"
                    title="Atualizar portas seriais"
                    disabled={serialPortsLoading || loading}
                    onClick={() => void refreshSerialPorts()}
                  >
                    <RefreshCw className={serialPortsLoading ? "spin" : undefined} size={17} />
                  </button>
                </div>
                <small
                  id="serial-port-help"
                  className={`serial-port-help ${serialPortsError ? "error" : savedPortUnavailable ? "warning" : ""}`}
                >
                  {serialPortHelp}
                </small>
              </label>
              <label>Baud rate<select value={project.build.baudRate} onChange={(event) => updateBuild({ baudRate: Number(event.target.value) })}><option value={115200}>115200</option><option value={921600}>921600</option><option value={1500000}>1500000</option></select></label>
            </div>
            <div className="build-buttons">
              <button type="button" disabled={loading || errors.length > 0} onClick={() => execute("generate")}><Code2 size={17} /> Gerar código</button>
              <button type="button" disabled={loading || errors.length > 0} onClick={() => execute("build")}><Cpu size={17} /> Compilar</button>
              <button className="primary" type="button" disabled={loading || serialPortsLoading || errors.length > 0 || !serialPortAvailable} onClick={() => execute("flash")}><Upload size={17} /> Gravar device</button>
            </div>
            {state.kind === "loading" && state.operation !== "toolchain" && firmwareProgress && (
              <div className="firmware-progress-card" aria-live="polite">
                <div className="firmware-progress-header">
                  <span><LoaderCircle className="spin" size={18} /> {progressStageLabels[firmwareProgress.stage] ?? "Executando"}</span>
                  <strong>{firmwareProgress.percent}%</strong>
                </div>
                <div className="firmware-progress-track"><span style={{ width: `${firmwareProgress.percent}%` }} /></div>
                <small>{firmwareProgress.message}</small>
                {firmwareLog.length > 0 && <pre>{firmwareLog.join("\n")}</pre>}
              </div>
            )}
            {state.kind === "success" && <div className="operation-state success"><CheckCircle2 size={18} /> {state.message}</div>}
            {state.kind === "error" && <div className="operation-state error"><XCircle size={18} /> {state.message}</div>}
          </section>

          <aside className="validation-panel">
            <h3>Validação do projeto</h3>
            {errors.length === 0 && warnings.length === 0 && <div className="validation-ok"><CheckCircle2 size={18} /> Projeto pronto para gerar.</div>}
            {errors.map((issue) => <div className="validation-item error" key={`${issue.path}-${issue.message}`}><XCircle size={17} /><span><strong>{issue.path}</strong>{issue.message}</span></div>)}
            {warnings.map((issue) => <div className="validation-item warning" key={`${issue.path}-${issue.message}`}><AlertTriangle size={17} /><span><strong>{issue.path}</strong>{issue.message}</span></div>)}
          </aside>
        </div>
      </section>
    </main>
  );
}
