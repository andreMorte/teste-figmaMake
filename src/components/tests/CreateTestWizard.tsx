import React, { useState } from 'react';
import {
  UsabilityTest,
  TestTask,
  MetricConfig,
  CustomQuestion,
  CustomQuestionType
} from '../../types';
import {
  createTest
} from '../../services/dataService';
import { isFigmaUrl, toFigmaEmbedUrl, getShareableTestUrl } from '../../utils/figmaUtils';
import { ScreenMapper, getTaskSteps, withTaskSteps } from './ScreenMapper';
import { MetricsStep } from './MetricsStep';
import { MappedScreen } from '../../types';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  ShieldCheck,
  Share2,
  Copy,
  ExternalLink,
  Sparkles,
  Info,
  CheckCircle2,
  Layers,
  Globe,
  Play,
  QrCode,
  Eye,
  HelpCircle,
  MessageSquare,
  Flame,
  MousePointer,
  Hash,
  Activity,
  Code,
  ScanSearch,
  MousePointerClick
} from 'lucide-react';

interface CreateTestWizardProps {
  onSuccess: (createdTest: UsabilityTest) => void;
  onCancel: () => void;
  onOpenRunner: (testId: string, prototypeUrl?: string) => void;
}

export const CreateTestWizard: React.FC<CreateTestWizardProps> = ({
  onSuccess,
  onCancel,
  onOpenRunner
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // STEP 1 STATE: Info (Aberto para QUALQUER teste)
  const [name, setName] = useState('Novo Teste de Usabilidade de Produto');
  const [description, setDescription] = useState('Avaliação de usabilidade e compreensão da nova jornada digital.');
  const [researchGoal, setResearchGoal] = useState('Identificar fricções na navegação, taxa de sucesso nas tarefas e clareza das telas.');
  const [productName, setProductName] = useState('Plataforma Web / Mobile');
  const [researcherName, setResearcherName] = useState('Staff UX Researcher');
  const [participantLimit, setParticipantLimit] = useState<number>(10);
  const [category, setCategory] = useState<'SaaS / B2B' | 'E-commerce' | 'Mobile App / Fintech' | 'Healthtech' | 'Geral / Customizado'>('Geral / Customizado');

  // STEP 2 STATE: Tasks (Genéricas e abertas)
  const [tasks, setTasks] = useState<TestTask[]>([
    {
      id: 'TASK-1',
      order: 1,
      title: 'Localizar e iniciar o fluxo principal',
      description: 'Avaliar se o participante identifica com facilidade a ação primária na interface.',
      instruction: 'Navegue pela tela inicial, localize a opção principal do serviço e avance para a etapa seguinte.',
      objective: 'Verificar a clareza da chamada para ação (CTA) e arquitetura de informação.',
      expectedPath: ['home', 'fluxo-principal', 'detalhes'],
      successCriteria: 'Chegar à tela de detalhes do serviço com sucesso.',
      errorCriteria: 'Clicar repetidamente em áreas não interativas ou abandonar a tela.'
    },
    {
      id: 'TASK-2',
      order: 2,
      title: 'Completar formulário e confirmar solicitação',
      description: 'Avaliar o preenchimento de campos e envio dos dados.',
      instruction: 'Preencha as informações solicitadas no formulário e confirme o envio até a tela de confirmação.',
      objective: 'Mensurar erros de validação e tempo gasto no preenchimento.',
      expectedPath: ['detalhes', 'formulario', 'confirmacao'],
      successCriteria: 'Visualizar a tela final com a confirmação da operação.',
      errorCriteria: 'Desistir por confusão nos dados solicitados ou travar no formulário.'
    }
  ]);

  const [activeTaskIndex, setActiveTaskIndex] = useState<number>(0);
  const [newStepName, setNewStepName] = useState('');

  // STEP 3 STATE: Custom Questions (Perguntas abertas e livres que o pesquisador define)
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([
    {
      id: 'CQ-1',
      question: 'Qual foi o momento ou tela em que você encontrou maior facilidade ou dificuldade?',
      type: 'open_text',
      required: true
    },
    {
      id: 'CQ-2',
      question: 'Em uma escala de 1 a 5, quão intuitivo foi concluir a tarefa principal?',
      type: 'likert_scale',
      required: false
    }
  ]);

  // STEP 3 STATE: Metric Config
  const [metrics, setMetrics] = useState<MetricConfig>({
    taskSuccessRate: true,
    completionRate: true,
    taskDuration: true,
    screenDuration: true,
    clickCount: true,
    errorClicks: true,
    backReturns: true,
    abandonmentRate: true,
    pathDeviation: true,
    mostUsedPath: true,
    idealPath: true,
    sus: true,
    nps: false,
    qualitativeComments: true,
    customQuestions: true,
    clickZoning: true
  });

  // STEP 4 STATE: Prototype & Publication
  const [prototypeUrl, setPrototypeUrl] = useState('https://evil-chess-37482794.figma.site');
  // Mapeamento de cenários (Etapa 2)
  const [screenMap, setScreenMap] = useState<MappedScreen[]>([]);
  const [isMapperOpen, setIsMapperOpen] = useState(false);
  const [testId, setTestId] = useState(() => 'TEST-' + Math.random().toString(36).substring(2, 7).toUpperCase());
  const [trackingId, setTrackingId] = useState('UX-QK8UY');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationPassed, setVerificationPassed] = useState<boolean | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<string>('');
  const [createdTestResult, setCreatedTestResult] = useState<UsabilityTest | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedProtoDirect, setCopiedProtoDirect] = useState(false);

  // Preset Template loader
  const applyPresetTemplate = (type: 'saas' | 'ecom' | 'mobile' | 'blank') => {
    if (type === 'blank') {
      setName('');
      setDescription('');
      setResearchGoal('');
      setProductName('');
      setCategory('Geral / Customizado');
      setTasks([
        {
          id: 'TASK-1',
          order: 1,
          title: 'Primeira Tarefa do Teste',
          description: '',
          instruction: 'Descreva aqui o que o usuário deve fazer no protótipo...',
          expectedPath: ['tela-1', 'tela-2'],
          successCriteria: 'Concluir a ação solicitada.',
          errorCriteria: 'Desistir ou cometer erros.'
        }
      ]);
      setCustomQuestions([]);
      setActiveTaskIndex(0);
      return;
    }

    if (type === 'saas') {
      setName('Plataforma SaaS: Onboarding & Criação de Projeto');
      setDescription('Avaliação de usabilidade da jornada de setup de novo projeto, convite de membros e permissões.');
      setResearchGoal('Avaliar a clareza e tempo de setup para novos gestores sem suporte.');
      setProductName('SaaS Platform');
      setCategory('SaaS / B2B');
      setTasks([
        {
          id: 'TASK-1',
          order: 1,
          title: 'Criar novo projeto no workspace',
          description: 'Avaliar localização do CTA de novo projeto.',
          instruction: 'Localize o botão de novo projeto, insira um nome e avance para o setup.',
          expectedPath: ['dashboard', 'novo-projeto', 'configuracao'],
          successCriteria: 'Acessar a tela de configuração de projeto.',
          errorCriteria: 'Clicar em menus incorretos mais de 3 vezes.'
        },
        {
          id: 'TASK-2',
          order: 2,
          title: 'Convidar equipe e atribuir papéis',
          description: 'Avaliar clareza dos níveis de permissão.',
          instruction: 'Adicione um membro com permissão de Editor e confirme o envio.',
          expectedPath: ['configuracao', 'membros', 'confirmacao'],
          successCriteria: 'Confirmação de convites enviados.',
          errorCriteria: 'Dúvidas nos papéis ou abandono da tela.'
        }
      ]);
      setCustomQuestions([
        {
          id: 'CQ-1',
          question: 'Quão claro foi o fluxo de permissões de membros da equipe?',
          type: 'likert_scale',
          required: true
        },
        {
          id: 'CQ-2',
          question: 'O que você melhoraria na criação do projeto?',
          type: 'open_text',
          required: false
        }
      ]);
      setActiveTaskIndex(0);
      return;
    }

    if (type === 'ecom') {
      setName('E-commerce: Checkout & Aplicação de Cupom');
      setDescription('Teste do fluxo de 1-clique com cupom promocional e seleção de frete.');
      setResearchGoal('Investigar se a aplicação de cupom gera dúvidas ou abandono antes do pagamento.');
      setProductName('Loja Virtual');
      setCategory('E-commerce');
      setTasks([
        {
          id: 'TASK-1',
          order: 1,
          title: 'Aplicar cupom promocional no carrinho',
          description: 'Avaliar facilidade de encontrar o campo de cupom.',
          instruction: 'Insira o cupom promocional no carrinho e avance para o pagamento.',
          expectedPath: ['carrinho', 'cupom-aplicado', 'checkout'],
          successCriteria: 'Cupom aplicado com valor com desconto exibido.',
          errorCriteria: 'Erro de validação ou abandono antes de aplicar.'
        },
        {
          id: 'TASK-2',
          order: 2,
          title: 'Selecionar frete e confirmar pedido',
          description: 'Avaliar escolha de modalidade de entrega.',
          instruction: 'Escolha a opção de frete expresso e finalize o pedido.',
          expectedPath: ['checkout', 'frete', 'sucesso'],
          successCriteria: 'Tela de pedido confirmado com número de protocolo.',
          errorCriteria: 'Desistência no fechamento do pedido.'
        }
      ]);
      setCustomQuestions([
        {
          id: 'CQ-1',
          question: 'Você teve alguma dúvida ao aplicar o cupom de desconto?',
          type: 'open_text',
          required: true
        }
      ]);
      setActiveTaskIndex(0);
      return;
    }

    if (type === 'mobile') {
      setName('App Mobile: Envio de Transferência Instantânea');
      setDescription('Teste de usabilidade do fluxo rápido de transferência e confirmação biométrica.');
      setResearchGoal('Validar se usuários completam a operação com sensação de segurança em menos de 45s.');
      setProductName('Mobile App');
      setCategory('Mobile App / Fintech');
      setTasks([
        {
          id: 'TASK-1',
          order: 1,
          title: 'Realizar transferência para chave cadastrada',
          description: 'Fluxo rápido de transferência.',
          instruction: 'Transfira o valor solicitado para a chave informada e confirme com biometria.',
          expectedPath: ['home', 'transferir', 'confirmacao', 'comprovante'],
          successCriteria: 'Comprovante emitido com sucesso.',
          errorCriteria: 'Erro nos dados ou abandono na etapa de senha.'
        }
      ]);
      setCustomQuestions([
        {
          id: 'CQ-1',
          question: 'Em uma escala de 1 a 5, quão seguro você se sentiu durante o processo?',
          type: 'likert_scale',
          required: true
        }
      ]);
      setActiveTaskIndex(0);
    }
  };

  // Helper to add task
  const addTask = () => {
    const newTask: TestTask = {
      id: `TASK-${tasks.length + 1}`,
      order: tasks.length + 1,
      title: `Tarefa ${tasks.length + 1}`,
      description: 'Descrição do objetivo avaliado.',
      instruction: 'Instrução clara para o participante executar.',
      objective: 'Avaliar compreensão da interface.',
      expectedPath: ['inicio', 'etapa-1', 'sucesso'],
      successCriteria: 'Concluir a ação principal.',
      errorCriteria: 'Desistir ou cometer cliques errôneos.'
    };
    setTasks([...tasks, newTask]);
    setActiveTaskIndex(tasks.length);
  };

  const removeTask = (index: number) => {
    if (tasks.length <= 1) return;
    const updated = tasks.filter((_, i) => i !== index).map((t, idx) => ({ ...t, order: idx + 1 }));
    setTasks(updated);
    setActiveTaskIndex(Math.max(0, index - 1));
  };

  // Expected Path manipulation (mantém expectedPath[] e os detalhes de cada cenário sincronizados)
  const setTaskSteps = (taskIdx: number, steps: ReturnType<typeof getTaskSteps>) => {
    setTasks((prev) => prev.map((t, i) => (i === taskIdx ? withTaskSteps(t, steps) : t)));
  };

  const addPathStep = (taskIdx: number) => {
    if (!newStepName.trim()) return;
    const label = newStepName.trim();
    const cleanKey = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const mapped = screenMap.find((sc) => sc.screenId === cleanKey);
    setTaskSteps(taskIdx, [
      ...getTaskSteps(tasks[taskIdx], screenMap),
      { screenId: cleanKey, screenName: mapped?.screenName || label }
    ]);
    setNewStepName('');
  };

  const removePathStep = (taskIdx: number, stepIdx: number) => {
    setTaskSteps(taskIdx, getTaskSteps(tasks[taskIdx], screenMap).filter((_, i) => i !== stepIdx));
  };

  const movePathStep = (taskIdx: number, stepIdx: number, direction: 'up' | 'down') => {
    const steps = getTaskSteps(tasks[taskIdx], screenMap);
    const targetIdx = direction === 'up' ? stepIdx - 1 : stepIdx + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    [steps[stepIdx], steps[targetIdx]] = [steps[targetIdx], steps[stepIdx]];
    setTaskSteps(taskIdx, steps);
  };

  // Custom Question manipulation
  const addCustomQuestion = () => {
    const newQ: CustomQuestion = {
      id: `CQ-${customQuestions.length + 1}`,
      question: 'Nova pergunta sobre a experiência do participante...',
      type: 'open_text',
      required: false
    };
    setCustomQuestions([...customQuestions, newQ]);
  };

  const removeCustomQuestion = (index: number) => {
    setCustomQuestions(customQuestions.filter((_, i) => i !== index));
  };

  const updateCustomQuestion = (index: number, updates: Partial<CustomQuestion>) => {
    const updated = [...customQuestions];
    updated[index] = { ...updated[index], ...updates };
    setCustomQuestions(updated);
  };

  // Metric toggle helper
  const toggleMetric = (key: keyof MetricConfig) => {
    setMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Verify Prototype in Runtime (Strict anti-false-positive!)
  const handleVerifyPrototype = async () => {
    setIsVerifying(true);
    setVerificationPassed(null);
    setVerificationFeedback('');

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prototypeUrl: prototypeUrl.trim(),
          testId: testId.trim(),
          trackingId: trackingId.trim()
        })
      });

      const data = await res.json();
      if (data.verified) {
        setVerificationPassed(true);
        setVerificationFeedback(data.summaryMessage || 'Instrumentação validada com sucesso! Os bundles compilados contêm UXLab.init e os identificadores conferem.');
      } else {
        setVerificationPassed(false);
        setVerificationFeedback(data.summaryMessage || 'Não foi possível validar o protótipo com os dados informados.');
      }
    } catch {
      setVerificationPassed(false);
      setVerificationFeedback('Erro de conexão com o validador técnico.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Final Publish Handler
  const handlePublish = async () => {
    const newTest = await createTest({
      id: testId.trim() || undefined,
      name,
      description,
      researchGoal,
      productName,
      researcherName,
      participantLimit,
      category,
      status: 'Publicado',
      prototypeUrl: prototypeUrl.trim(),
      trackingId: trackingId.trim(),
      tasks,
      screenMap,
      // perguntas desligadas ou sem texto não vão para o participante
      customQuestions: metrics.customQuestions === false ? [] : customQuestions.filter((q) => q.question.trim()),
      metricConfig: metrics
    });

    setCreatedTestResult(newTest);
  };

  const copySdkSnippet = () => {
    const code = `UXLab.init({\n  testId: "${testId.trim()}",\n  trackingId: "${trackingId.trim()}"\n});`;
    navigator.clipboard.writeText(code);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const copyLink = (testId: string, customProto?: string) => {
    const fullUrl = getShareableTestUrl(testId, customProto || prototypeUrl);
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyProtoDirectLink = (urlToCopy: string) => {
    if (!urlToCopy) return;
    navigator.clipboard.writeText(urlToCopy);
    setCopiedProtoDirect(true);
    setTimeout(() => setCopiedProtoDirect(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {isMapperOpen && (
        <ScreenMapper
          prototypeUrl={prototypeUrl}
          onPrototypeUrlChange={setPrototypeUrl}
          testId={testId}
          trackingId={trackingId}
          tasks={tasks}
          activeTaskIndex={activeTaskIndex}
          onActiveTaskIndexChange={setActiveTaskIndex}
          onTasksChange={setTasks}
          screens={screenMap}
          onScreensChange={setScreenMap}
          onClose={() => setIsMapperOpen(false)}
        />
      )}
      {/* Step Progress Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between">
          {[
            { step: 1, label: 'Informações' },
            { step: 2, label: 'Tarefas & Caminho' },
            { step: 3, label: 'Métricas' },
            { step: 4, label: 'Publicação & Validação' }
          ].map((item, idx) => (
            <React.Fragment key={item.step}>
              <div
                onClick={() => !createdTestResult && setCurrentStep(item.step as any)}
                className={`flex items-center gap-2.5 cursor-pointer transition-colors ${
                  currentStep === item.step
                    ? 'text-blue-600 font-bold'
                    : currentStep > item.step
                    ? 'text-emerald-700 font-medium'
                    : 'text-slate-600'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep === item.step
                      ? 'bg-blue-600 text-white shadow-xs'
                      : currentStep > item.step
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {currentStep > item.step ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : item.step}
                </div>
                <span className="text-xs font-semibold hidden md:inline">{item.label}</span>
              </div>
              {idx < 3 && <div className="h-px bg-slate-200 flex-1 mx-3 hidden sm:block" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ETAPA 1 — INFORMAÇÕES */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Etapa 1 — Informações do Estudo
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Defina as bases do teste de usabilidade para qualquer produto ou fluxo digital.
              </p>
            </div>

            {/* Presets rápido */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-600 uppercase mr-1">Templates:</span>
              <button
                type="button"
                onClick={() => applyPresetTemplate('saas')}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-xs font-medium transition-colors"
              >
                SaaS B2B
              </button>
              <button
                type="button"
                onClick={() => applyPresetTemplate('ecom')}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-xs font-medium transition-colors"
              >
                E-commerce
              </button>
              <button
                type="button"
                onClick={() => applyPresetTemplate('mobile')}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-xs font-medium transition-colors"
              >
                Mobile App
              </button>
              <button
                type="button"
                onClick={() => applyPresetTemplate('blank')}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 text-xs font-medium transition-colors"
              >
                Em Branco
              </button>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* 1. URL do Protótipo Navegável (Figma ou Web Deploy) */}
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-800 font-bold flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>1. URL do Protótipo Navegável (Figma ou Web Deploy) *</span>
                </label>
                {isFigmaUrl(prototypeUrl) ? (
                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold">
                    Figma Navegável
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold">
                    Web Deploy / Make
                  </span>
                )}
              </div>
              <input
                type="text"
                value={prototypeUrl}
                onChange={(e) => {
                  setPrototypeUrl(e.target.value);
                  setVerificationPassed(null);
                }}
                placeholder="https://evil-chess-37482794.figma.site ou https://www.figma.com/proto/..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 text-xs font-mono outline-none transition-all shadow-2xs"
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-600">
                <span>Esta URL é a <strong>Fonte de Verdade</strong> do protótipo real que o participante navegará.</span>
                {prototypeUrl.trim() && (
                  <a
                    href={prototypeUrl.trim()}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 font-semibold shrink-0"
                  >
                    <span>Abrir URL em Nova Aba</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1.5">Nome do teste de usabilidade *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Plataforma B2B: Redesign de Gestão de Membros"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Categoria de produto</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                >
                  <option value="SaaS / B2B">SaaS / B2B</option>
                  <option value="E-commerce">E-commerce</option>
                  <option value="Mobile App / Fintech">Mobile App / Fintech</option>
                  <option value="Healthtech">Healthtech</option>
                  <option value="Geral / Customizado">Geral / Customizado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Descrição do teste</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve resumo do contexto, escopo da experiência e público-alvo..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Objetivo da pesquisa de usabilidade *</label>
              <input
                type="text"
                value={researchGoal}
                onChange={(e) => setResearchGoal(e.target.value)}
                placeholder="Ex: Avaliar a clareza na conclusão do fluxo sem necessidade de suporte."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Produto / Aplicação</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ex: Web App / Mobile Experience"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Pesquisador responsável</label>
                <input
                  type="text"
                  value={researcherName}
                  onChange={(e) => setResearcherName(e.target.value)}
                  placeholder="Ex: Staff UX Researcher"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Quantidade de participantes (clientes) *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={participantLimit}
                    onChange={(e) => setParticipantLimit(Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)))}
                    className="w-28 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                  />
                  <span className="text-[11px] text-slate-500 leading-snug">
                    Cada pessoa que abrir o link informa o nome e recebe um número (1 de {participantLimit}, 2 de {participantLimit}...). Ao
                    completar {participantLimit}, o link fecha para novos participantes.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <span>Avançar para Tarefas</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 2 — TAREFAS & CAMINHO ESPERADO */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Etapa 2 — Cadastro de Tarefas & Caminho Esperado
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Defina as instruções exibidas ao participante e configure o caminho esperado (<code className="text-blue-600 font-mono">expectedPath[]</code>).
              </p>
            </div>
            <button
              type="button"
              onClick={addTask}
              className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 flex items-center gap-1.5 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Tarefa</span>
            </button>
          </div>

          {/* Task Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100">
            {tasks.map((task, idx) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setActiveTaskIndex(idx)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTaskIndex === idx
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <span>Tarefa {idx + 1}</span>
                {tasks.length > 1 && (
                  <Trash2
                    className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500 ml-1 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTask(idx);
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Active Task Form */}
          {tasks[activeTaskIndex] && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">Título da tarefa *</label>
                  <input
                    type="text"
                    value={tasks[activeTaskIndex].title}
                    onChange={(e) => {
                      const updated = [...tasks];
                      updated[activeTaskIndex].title = e.target.value;
                      setTasks(updated);
                    }}
                    placeholder="Ex: Localizar e acionar o CTA principal de criação"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">Objetivo da tarefa</label>
                  <input
                    type="text"
                    value={tasks[activeTaskIndex].objective}
                    onChange={(e) => {
                      const updated = [...tasks];
                      updated[activeTaskIndex].objective = e.target.value;
                      setTasks(updated);
                    }}
                    placeholder="Ex: Avaliar se o participante localiza a ação inicial sem hesitação."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">
                  Instrução apresentada ao participante *
                </label>
                <textarea
                  rows={2}
                  value={tasks[activeTaskIndex].instruction}
                  onChange={(e) => {
                    const updated = [...tasks];
                    updated[activeTaskIndex].instruction = e.target.value;
                    setTasks(updated);
                  }}
                  placeholder="Ex: Navegue pelo protótipo, encontre a funcionalidade solicitada e avance até a tela final de confirmação."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                />
              </div>

              {/* Expected Path Visual Builder + Mapeador de cenários */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800 flex items-center gap-2 text-xs">
                      <Layers className="w-4 h-4 text-blue-600" />
                      Caminho Esperado (expectedPath[])
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {tasks[activeTaskIndex].expectedPath.length} cenário(s) • {screenMap.length} cenário(s) mapeado(s) no protótipo
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMapperOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
                  >
                    <ScanSearch className="w-4 h-4" />
                    <span>{screenMap.length ? 'Abrir mapeador de cenários' : 'Mapear cenários do protótipo'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  O Figma Make funciona em uma única página e troca componentes na tela. O mapeador abre o protótipo, detecta cada troca de
                  cenário (título, subtítulo, etapa “1 de 3”, modais) e grava o caminho da tarefa com a ação que levou a cada cenário.
                </p>

                {/* Visual Flow Representation */}
                <div className="flex items-center gap-2 overflow-x-auto py-2">
                  <span className="px-2.5 py-1 rounded-lg bg-white text-slate-600 font-bold text-[10px] uppercase border border-slate-200">
                    INÍCIO
                  </span>
                  <span className="text-blue-500 font-bold">→</span>

                  {getTaskSteps(tasks[activeTaskIndex], screenMap).map((step, sIdx, all) => (
                    <React.Fragment key={`${step.screenId}-${sIdx}`}>
                      <div className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2 shrink-0 shadow-xs group">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-[11px] max-w-[220px] truncate" title={step.screenId}>
                          {step.screenName}
                        </span>

                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          {sIdx > 0 && (
                            <button
                              type="button"
                              onClick={() => movePathStep(activeTaskIndex, sIdx, 'up')}
                              className="p-0.5 text-slate-400 hover:text-slate-700"
                              title="Mover para esquerda"
                            >
                              <MoveUp className="w-3 h-3 rotate-270" />
                            </button>
                          )}
                          {sIdx < all.length - 1 && (
                            <button
                              type="button"
                              onClick={() => movePathStep(activeTaskIndex, sIdx, 'down')}
                              className="p-0.5 text-slate-400 hover:text-slate-700"
                              title="Mover para direita"
                            >
                              <MoveDown className="w-3 h-3 rotate-270" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removePathStep(activeTaskIndex, sIdx)}
                            className="p-0.5 text-slate-400 hover:text-rose-500"
                            title="Remover etapa"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <span className="text-blue-500 font-bold">→</span>
                    </React.Fragment>
                  ))}

                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase border border-emerald-200">
                    SUCESSO
                  </span>
                </div>

                {/* Passo a passo detalhado */}
                {getTaskSteps(tasks[activeTaskIndex], screenMap).some((st) => st.trigger || screenMap.some((m) => m.screenId === st.screenId)) && (
                  <div className="rounded-xl bg-white border border-slate-200 divide-y divide-slate-100">
                    {getTaskSteps(tasks[activeTaskIndex], screenMap).map((st, idx) => {
                      const mapped = screenMap.find((m) => m.screenId === st.screenId);
                      return (
                        <div key={`${st.screenId}-detail-${idx}`} className="flex gap-3 p-2.5">
                          <span className="w-5 h-5 shrink-0 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                            {idx + 1}
                          </span>
                          {mapped?.thumbnail && (
                            <img src={mapped.thumbnail} alt="" className="w-20 h-12 rounded-md border border-slate-200 object-cover object-top shrink-0" />
                          )}
                          <div className="min-w-0 space-y-0.5">
                            {st.trigger && idx > 0 && (
                              <div className="text-[11px] text-violet-700 flex items-center gap-1">
                                <MousePointerClick className="w-3 h-3" /> ao clicar em “{st.trigger}”
                              </div>
                            )}
                            <div className="font-semibold text-slate-900">{st.screenName}</div>
                            {mapped && (mapped.stepLabel || mapped.actions.length > 0) && (
                              <div className="text-[11px] text-slate-500 truncate">
                                {mapped.stepLabel ? `Etapa ${mapped.stepLabel} • ` : ''}
                                {mapped.actions.slice(0, 5).join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Step input */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                  <input
                    type="text"
                    value={newStepName}
                    onChange={(e) => setNewStepName(e.target.value)}
                    list="mapped-screens-list"
                    placeholder="Adicionar cenário manualmente (ex: resumo da proposta)..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 outline-none text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                    onKeyDown={(e) => e.key === 'Enter' && addPathStep(activeTaskIndex)}
                  />
                  <datalist id="mapped-screens-list">
                    {screenMap.map((sc) => (
                      <option key={sc.screenId} value={sc.screenId}>
                        {sc.screenName}
                      </option>
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() => addPathStep(activeTaskIndex)}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
                  >
                    + Adicionar Etapa
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">Critério de sucesso</label>
                  <input
                    type="text"
                    value={tasks[activeTaskIndex].successCriteria}
                    onChange={(e) => {
                      const updated = [...tasks];
                      updated[activeTaskIndex].successCriteria = e.target.value;
                      setTasks(updated);
                    }}
                    placeholder="Ex: Acessar a tela de Dados do Veículo."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">Critério de erro</label>
                  <input
                    type="text"
                    value={tasks[activeTaskIndex].errorCriteria}
                    onChange={(e) => {
                      const updated = [...tasks];
                      updated[activeTaskIndex].errorCriteria = e.target.value;
                      setTasks(updated);
                    }}
                    placeholder="Ex: Acessar produtos não relacionados ou errar cliques."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <span>Avançar para Métricas</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 3 — CONFIGURAÇÃO DE MÉTRICAS */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <MetricsStep
          metrics={metrics}
          setMetrics={setMetrics}
          customQuestions={customQuestions}
          setCustomQuestions={setCustomQuestions}
          tasksCount={tasks.length}
          onBack={() => setCurrentStep(2)}
          onNext={() => setCurrentStep(4)}
        />
      )}

      {/* ========================================================================= */}
      {/* ETAPA 4 — PUBLICAÇÃO & VALIDAÇÃO TÉCNICA DO PROTÓTIPO */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <div className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>Etapa 4 — Protótipo Navegável & Publicação do Teste</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Informe o link do protótipo que os participantes navegarão e publique para gerar o link do teste de usabilidade.
            </p>
          </div>

          {/* Published state callout if already created */}
          {createdTestResult ? (
            <div className="p-6 sm:p-7 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-slate-800 space-y-6 shadow-xs animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 shadow-xs">
                  <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Link do Teste de Usabilidade Gerado com Sucesso!
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    Seu teste está ativo e vinculado ao protótipo navegável. Ao acessar o link gerado abaixo, o participante navegará no protótipo fornecido enquanto a plataforma registra as tarefas, cliques, tempo e avaliação SUS.
                  </p>
                </div>
              </div>

              {/* Share URL Box Prominent */}
              <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Link Oficial do Teste para Participantes:</span>
                  </span>
                  <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md font-mono border border-slate-200">
                    ID: {createdTestResult.id}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getShareableTestUrl(createdTestResult.id, createdTestResult.prototypeUrl)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-blue-700 text-xs font-mono select-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyLink(createdTestResult.id, createdTestResult.prototypeUrl)}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0"
                  >
                    {copiedLink ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link do Teste'}</span>
                  </button>
                </div>
              </div>

              {/* Direct Prototype URL Box (Protótipo Validado) */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-800 text-xs font-semibold flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-purple-600" />
                    <span>Protótipo Validado (Link Exato Cadastrado):</span>
                  </span>
                  <span className="text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-semibold border border-purple-200">
                    Protótipo Real
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdTestResult.prototypeUrl}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-purple-700 text-xs font-mono select-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyProtoDirectLink(createdTestResult.prototypeUrl)}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0"
                  >
                    {copiedProtoDirect ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedProtoDirect ? 'URL Copiada!' : 'Copiar Link do Protótipo'}</span>
                  </button>
                </div>
              </div>

              {/* Direct Actions: Run Now vs Open Prototype vs Open Test */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                {/* 1. Abrir o protótipo real em nova aba */}
                <a
                  href={createdTestResult.prototypeUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="py-3 px-4 rounded-xl bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 hover:border-purple-300 font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs text-center"
                  title="Abre diretamente o protótipo do Figma ou o link colocado e validado em uma nova aba"
                >
                  <ExternalLink className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Abrir Protótipo em Nova Aba</span>
                </a>

                {/* 2. Executar o fluxo agora dentro da plataforma */}
                <button
                  type="button"
                  onClick={() => onOpenRunner(createdTestResult.id, createdTestResult.prototypeUrl)}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-xs text-center"
                  title="Executa o teste com o protótipo carregado diretamente no player de avaliação"
                >
                  <Play className="w-4 h-4 fill-current shrink-0" />
                  <span>Fazer Teste no Protótipo</span>
                </button>

                {/* 3. Abrir o ambiente de teste em nova aba */}
                <a
                  href={getShareableTestUrl(createdTestResult.id, createdTestResult.prototypeUrl)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="py-3 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs text-center"
                  title="Abre a tela de execução do participante em uma nova aba com o protótipo validado"
                >
                  <Share2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Abrir Teste em Nova Aba</span>
                </a>
              </div>

              {/* Forward to Results Dashboard */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-3 border-t border-emerald-200/80">
                <div className="text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
                  <span>Protótipo vinculado:</span>
                  <a
                    href={createdTestResult.prototypeUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-blue-600 hover:text-blue-700 underline font-medium flex items-center gap-1 truncate max-w-xs sm:max-w-md"
                    title={createdTestResult.prototypeUrl}
                  >
                    <span>{createdTestResult.prototypeUrl}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => onSuccess(createdTestResult)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shrink-0"
                >
                  Ir para Painel de Resultados →
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Review Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 text-xs space-y-3">
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Resumo da Configuração
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
                  <div><strong className="text-slate-800">Nome:</strong> {name}</div>
                  <div><strong className="text-slate-800">Produto:</strong> {productName}</div>
                  <div><strong className="text-slate-800">Tarefas:</strong> {tasks.length} cadastradas</div>
                  <div><strong className="text-slate-800">SUS Ativado:</strong> {metrics.sus ? 'Sim (10 perguntas)' : 'Não'}</div>
                  <div><strong className="text-slate-800">Pesquisador:</strong> {researcherName}</div>
                  <div><strong className="text-slate-800">Participantes previstos:</strong> {participantLimit} clientes</div>
                  <div><strong className="text-slate-800">Caminhos Esperados:</strong> {tasks.map((t) => t.expectedPath.length).join(' + ')} etapas</div>
                </div>
              </div>

              {/* Tarefas sem caminho mapeado: conclusão manual pelo participante */}
              {(() => {
                const unmapped = tasks
                  .map((t, i) => ({ t, i }))
                  .filter(({ t }) => {
                    const last = t.expectedPath[t.expectedPath.length - 1];
                    return !last || !screenMap.some((m) => m.screenId === last);
                  });
                if (!unmapped.length) return null;
                return (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                    <div className="font-bold">
                      {unmapped.length === tasks.length ? 'Nenhuma tarefa tem caminho mapeado' : `${unmapped.length} tarefa(s) sem caminho mapeado`}
                    </div>
                    <p className="leading-relaxed">
                      {unmapped.map(({ i }) => `Tarefa ${i + 1}`).join(', ')}: o sistema não sabe qual tela encerra a tarefa, então o participante verá o botão
                      “Terminei a tarefa”. A navegação, os prints e o heatmap continuam sendo registrados normalmente. Para conclusão automática e caminho
                      ideal, volte à Etapa 2 e use “Mapear cenários do protótipo”.
                    </p>
                    <button type="button" onClick={() => setCurrentStep(2)} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                      Ir para o mapeamento
                    </button>
                  </div>
                );
              })()}

              {/* Prototype Configuration Section */}
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span>Link do Protótipo Navegável (Figma ou Web Deploy)</span>
                  </div>
                  {isFigmaUrl(prototypeUrl) ? (
                    <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold">
                      Figma Navegável Detectado
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
                      Protótipo Web
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Cole aqui o link compartilhável do seu protótipo no Figma (ex: <code className="text-blue-600 font-mono">https://www.figma.com/proto/...</code> ou link de arquivo navegável) ou a URL do seu protótipo publicado no Figma Make / Web.
                </p>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-700 font-semibold">
                      1. URL do Protótipo Navegável (Figma ou Web Deploy):
                    </label>
                    {prototypeUrl.trim() && (
                      <a
                        href={prototypeUrl.trim()}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline"
                        title="Abrir este link diretamente em uma nova aba do navegador"
                      >
                        <span>Abrir URL em Nova Aba</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <input
                    type="text"
                    value={prototypeUrl}
                    onChange={(e) => {
                      setPrototypeUrl(e.target.value);
                      setVerificationPassed(null);
                    }}
                    placeholder="https://www.figma.com/proto/EXEMPLO/Meu-App-Navegavel ou http://localhost:3000/api/mock/figma-valid"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-colors"
                  />
                </div>

                {/* Identifiers Grid: Test ID & Tracking ID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Test ID Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-blue-600" />
                        <span>2. Test ID (Identificador do Teste):</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTestId('TEST-U92DU');
                            setVerificationPassed(null);
                          }}
                          className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline font-semibold"
                        >
                          TEST-U92DU
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            const rand = 'TEST-' + Math.random().toString(36).substring(2, 7).toUpperCase();
                            setTestId(rand);
                            setVerificationPassed(null);
                          }}
                          className="text-[11px] text-slate-500 hover:text-slate-700 hover:underline"
                        >
                          Novo ID
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Hash className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={testId}
                        onChange={(e) => {
                          setTestId(e.target.value.trim());
                          setVerificationPassed(null);
                        }}
                        placeholder="ex: TEST-U92DU"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-mono uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-colors"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Esperado no protótipo: <code className="text-blue-700 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">testId: "{testId || 'TEST-...'}"</code>
                    </p>
                  </div>

                  {/* Tracking ID Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-blue-600" />
                        <span>3. Tracking ID (Identificador de Telemetria):</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTrackingId('UX-QK8UY');
                            setVerificationPassed(null);
                          }}
                          className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline font-semibold"
                        >
                          UX-QK8UY
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTrackingId('UX-DIXD8');
                            setVerificationPassed(null);
                          }}
                          className="text-[11px] text-amber-600 hover:text-amber-700 hover:underline font-semibold"
                          title="Simular teste com trackingId diferente do bundle"
                        >
                          UX-DIXD8 (Divergente)
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Activity className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={trackingId}
                        onChange={(e) => {
                          setTrackingId(e.target.value.trim());
                          setVerificationPassed(null);
                        }}
                        placeholder="ex: UX-QK8UY"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-mono uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-colors"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Esperado no protótipo: <code className="text-blue-700 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">trackingId: "{trackingId || 'UX-...'}"</code>
                    </p>
                  </div>
                </div>

                {/* SDK Code Snippet Preview */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-700 font-semibold flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-blue-600" />
                      <span>Snippet de Instrumentação para o Protótipo:</span>
                    </span>
                    <button
                      type="button"
                      onClick={copySdkSnippet}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-blue-700 text-xs font-semibold flex items-center gap-1 border border-slate-200 transition-colors"
                    >
                      {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSnippet ? 'Copiado!' : 'Copiar Código'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-900 text-blue-200 font-mono text-xs overflow-x-auto">
                    <code>{`UXLab.init({\n  testId: "${testId || 'TEST-U92DU'}",\n  trackingId: "${trackingId || 'UX-QK8UY'}"\n});`}</code>
                  </pre>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
                    Ou selecione um exemplo rápido para testar agora:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPrototypeUrl('http://localhost:3000/api/mock/figma-valid');
                        setTestId('TEST-U92DU');
                        setTrackingId('UX-QK8UY');
                        setVerificationPassed(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs transition-colors flex items-center gap-1.5 font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Protótipo Figma Make / SDK (Válido TEST-U92DU & UX-QK8UY)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrototypeUrl('http://localhost:3000/api/mock/figma-valid');
                        setTestId('TEST-U92DU');
                        setTrackingId('UX-DIXD8');
                        setVerificationPassed(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs transition-colors font-medium"
                      title="Testa a verificação com trackingId divergente"
                    >
                      Simular Divergência (UX-DIXD8)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrototypeUrl('https://www.figma.com/proto/sample-prototype/App-Fintech?scaling=scale-down');
                        setVerificationPassed(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs transition-colors font-medium"
                    >
                      Figma App Exemplo (figma.com/proto)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrototypeUrl('');
                        setVerificationPassed(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200 text-xs transition-colors"
                    >
                      Limpar campo de URL
                    </button>
                  </div>
                </div>

                {/* Technical Handshake Verifier */}
                <div className="pt-3 border-t border-slate-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-800 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Verificação Técnica em Tempo Real</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Inspeciona o protótipo e bundles .js confirmando se os identificadores testId ({testId}) e trackingId ({trackingId}) batem exatamente.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyPrototype}
                      disabled={isVerifying || !prototypeUrl || !testId || !trackingId}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 shrink-0 shadow-xs"
                    >
                      {isVerifying ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Verificando...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Testar Conexão do Protótipo</span>
                        </>
                      )}
                    </button>
                  </div>

                  {verificationPassed !== null && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs ${
                        verificationPassed
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      <div className="font-bold text-xs mb-0.5 flex items-center gap-1.5">
                        {verificationPassed ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                            <span>Instrumentação Validada com Sucesso</span>
                          </>
                        ) : (
                          <>
                            <Info className="w-4 h-4 text-amber-600" />
                            <span>Aviso de Verificação</span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {verificationFeedback ||
                          (isFigmaUrl(prototypeUrl)
                            ? 'Protótipo Figma válido! Será carregado com o player interativo de telemetria.'
                            : 'Protótipo conectado com sucesso.')}
                      </p>
                      {!verificationPassed && (
                        <div className="mt-2 text-[11px] text-amber-900 bg-white/80 p-2.5 rounded-lg border border-amber-200">
                          Dica: Se o protótipo compilado possui <code className="text-blue-700 font-mono">testId: "TEST-U92DU"</code> e <code className="text-blue-700 font-mono">trackingId: "UX-QK8UY"</code>, certifique-se de preencher esses mesmos valores nos campos 2 e 3 acima ou clique em <strong>"TEST-U92DU"</strong> e <strong>"UX-QK8UY"</strong>.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Publication Buttons */}
              <div className="flex justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={!prototypeUrl.trim()}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-xs disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Publicar e Gerar Link do Teste</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
